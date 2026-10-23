import sys
import os
sys.path.insert(0, os.path.abspath("."))
import math
from src.environment import SimulationEnvironment
from src.fly_agent import FruitFlyAgent
from src.simulation_engine import FruitFlySimulation

def test_feeding_happiness_and_tolerance():
    print("=== Testing Fly Happiness, Satiety Satisfaction & Social Feeding Tolerance ===")
    
    # 1. Test Social Feeding Tolerance & Happiness at Food Patch
    print("\n[1] Testing Social Feeding: 4 low-mood flies must feed peacefully and become Content/Euphoric")
    env = SimulationEnvironment()
    # 4 flies close together directly at the ripe banana slice at (60, 60)
    f1 = FruitFlyAgent(fly_id=1, archetype_name="Romeo", x=60.0, y=60.0, z=1.6)
    f2 = FruitFlyAgent(fly_id=2, archetype_name="Brawler", x=62.0, y=60.0, z=1.6)
    f3 = FruitFlyAgent(fly_id=3, archetype_name="Glutton", x=60.0, y=62.0, z=1.6)
    f4 = FruitFlyAgent(fly_id=4, archetype_name="Cleopatra", x=62.0, y=62.0, z=1.6)
    group = [f1, f2, f3, f4]
    
    for f in group:
        f.satiety = 0.15
        f.mood = 0.15 # starts enraged/starving
        f.entertainment = 0.0
        
    fights_while_near_food = 0
    for step in range(120): # ~4 seconds of dining at food patch
        for f in group:
            f.step(env, group, dt_sec=0.033)
        env.step(dt_sec=0.033)
        for ev in env.fight_events:
            aggr = next((x for x in group if x.id == ev["aggressor_id"]), None)
            if aggr:
                fd, _, _ = env.get_nearest_food_3d(aggr.x, aggr.y, aggr.z)
                if fd < 22.0:
                    fights_while_near_food += 1
        
    print(f"    Fights recorded at food patch: {fights_while_near_food} (must be 0)")
    assert fights_while_near_food == 0, "Flies should not attack each other while feeding (social feeding tolerance)"
    
    for f in group:
        print(f"    Fly #{f.id} ({f.archetype_name}): satiety={f.satiety:.2f}, mood={f.mood:.2f}, action='{f.action}'")
        assert f.satiety > 0.70, f"Fly {f.id} should have replenished satiety, got {f.satiety:.2f}"
        assert f.mood > 0.70, f"Fly {f.id} should be happy/content after eating, got {f.mood:.2f}"
        
    assert len(env.dopamine_events) > 0, "Dopamine surge events must be recorded in environment"
    print(f"    [OK] Vivarium recorded {len(env.dopamine_events)} dopamine surges during feeding!")

    # 2. Test Running Wheel Dismount & Cooldown
    print("\n[2] Testing Running Wheel: Sustained exercise, exit dismount, and cooldown")
    single_env = SimulationEnvironment()
    wheel = single_env.running_wheel
    runner = FruitFlyAgent(fly_id=10, archetype_name="Zen", x=wheel["x"], y=wheel["y"], z=1.6)
    runner.satiety = 0.80
    runner.exercise_cooldown = 0.0
    
    # Step onto wheel
    for _ in range(5):
        runner.step(single_env, [runner], dt_sec=0.033)
        if runner.exercise_timer > 0:
            break
    assert runner.exercise_timer > 0, "Runner should trigger exercise session on wheel"
    assert runner.action == "exercising", f"Action should be 'exercising', got '{runner.action}'"
    
    # Run until workout completes
    while runner.exercise_timer > 0:
        runner.step(single_env, [runner], dt_sec=0.033)
        
    # Step once more to complete dismount
    runner.step(single_env, [runner], dt_sec=0.033)
    
    print(f"    Post-workout: cooldown={runner.exercise_cooldown:.1f}s, speed={runner.speed:.1f}mm/s, action='{runner.action}'")
    assert runner.exercise_cooldown > 10.0, "Runner should have exercise cooldown to prevent instant re-entry"
    assert (runner.speed > 0.5) or (math.hypot(runner.x - wheel["x"], runner.y - wheel["y"]) > 1.0), "Runner should have dismounted and moved away"
    
    # Starving fly should not enter wheel
    starving_fly = FruitFlyAgent(fly_id=11, archetype_name="Glutton", x=wheel["x"], y=wheel["y"], z=1.6)
    starving_fly.satiety = 0.10 # Starving
    starving_fly.exercise_cooldown = 0.0
    starving_fly.step(single_env, [starving_fly], dt_sec=0.033)
    assert starving_fly.exercise_timer == 0, "Starving fly must prioritize food over running wheel"
    print("    [OK] Starving flies successfully bypass running wheel to focus on foraging!")

    # 3. Test Master Simulation: Long-term Stability
    print("\n[3] Testing Master Simulation: Satiety, Happiness & Playground Balance across 7 flies")
    sim = FruitFlySimulation()
    for _ in range(600): # 20 seconds
        sim.step(dt_sec=0.033)
        
    state = sim.get_state()
    avg_satiety = sum(f["satiety"] for f in state["flies"]) / len(state["flies"])
    avg_mood = sum(f["mood"] for f in state["flies"]) / len(state["flies"])
    print(f"    After 600 steps: Avg Satiety={avg_satiety:.2f}, Avg Mood={avg_mood:.2f}, Total Surges={state['environment'].get('total_dopamine_surges', 0)}")
    assert avg_satiety > 0.50, f"Flies should maintain healthy satiety, got {avg_satiety:.2f}"
    assert avg_mood > 0.60, f"Flies should maintain happy/content mood, got {avg_mood:.2f}"
    assert state['environment'].get('total_dopamine_surges', 0) > 0, "Simulation must track dopamine surges"
    print("    [OK] Master simulation maintains happy, well-fed flies across extended runtime!")

    print("\nALL FLY HAPPINESS & SATIETY TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_feeding_happiness_and_tolerance()
