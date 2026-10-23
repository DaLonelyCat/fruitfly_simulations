import sys
import os
sys.path.insert(0, os.path.abspath("."))
import math
from src.environment import SimulationEnvironment
from src.fly_agent import FruitFlyAgent
from src.simulation_engine import FruitFlySimulation

def test_no_death_and_hanging_moss_swing():
    print("=== Testing Fruit Fly Simulation: No-Death & Hanging Moss Swing Fix ===")
    
    # 1. Test Starvation: Zero satiety must NEVER kill the fly
    print("\n[1] Testing Starvation: Flies must remain alive at 0.0 satiety")
    env = SimulationEnvironment()
    starving_fly = FruitFlyAgent(fly_id=1, archetype_name="Glutton", x=50.0, y=50.0, z=1.6)
    starving_fly.satiety = 0.0
    
    for step_i in range(100):
        starving_fly.step(env, [starving_fly], dt_sec=0.1)
        env.step(dt_sec=0.1)
        
    print(f"    After 100 steps of zero satiety: is_dead={starving_fly.is_dead}, action='{starving_fly.action}', roll={starving_fly.roll:.2f}")
    assert not starving_fly.is_dead, "Fly should NOT be dead even when completely starved"
    assert starving_fly.action != "dead", f"Fly action should not be 'dead', got '{starving_fly.action}'"
    assert abs(starving_fly.roll - math.pi) > 1.0, "Fly should not be flipped onto dorsal back in rigor mortis"

    # 2. Test Combat: Enraged flies brawl without mortal consequences (in open arena)
    print("\n[2] Testing Bad-Mood Combat: Aggression without lethal damage")
    aggressor = FruitFlyAgent(fly_id=10, archetype_name="Brawler", x=90.0, y=30.0, z=1.6)
    victim = FruitFlyAgent(fly_id=11, archetype_name="Zen", x=93.0, y=30.0, z=1.6)
    
    aggressor.mood = 0.10  # Enraged
    aggressor.attack_cooldown = 0.0
    aggressor.satiety = 0.1
    victim.mood = 0.8
    
    initial_fights = len(env.fight_events)
    aggressor.step(env, [aggressor, victim], dt_sec=0.1)
    
    print(f"    Combat result: aggressor_action='{aggressor.action}', fights={len(env.fight_events)}, victim_is_dead={victim.is_dead}")
    assert len(env.fight_events) > initial_fights, "Fight event should be recorded"
    assert not victim.is_dead, "Victim should remain alive after combat"
    assert not aggressor.is_dead, "Aggressor should remain alive after combat"
    assert aggressor.action in ["lunging", "fighting"], f"Aggressor action should be lunging or fighting, got '{aggressor.action}'"

    # 3. Test Hanging Moss Swing: Flight wake and perching mechanics
    print("\n[3] Testing Hanging Moss Swing: Ambient breeze, flight wake, and perching")
    
    # A. Ambient breeze motion
    env.step(dt_sec=0.5)
    print(f"    Ambient breeze swing: angle_x={env.hanging_swing['angle_x']:.3f}, angle_y={env.hanging_swing['angle_y']:.3f}")
    assert abs(env.hanging_swing['angle_x']) > 0 or abs(env.hanging_swing['vel_x']) > 0, "Swing should exhibit subtle ambient breeze motion"

    # B. Flight wake pushing swing
    flying_fly = FruitFlyAgent(fly_id=20, archetype_name="Skittish", x=112.0, y=95.0, z=28.0)
    flying_fly.is_airborne = True
    flying_fly.vx = 25.0
    initial_vel_x = env.hanging_swing['vel_x']
    
    flying_fly.step(env, [flying_fly], dt_sec=0.1)
    print(f"    Flight wake swing vel_x: {env.hanging_swing['vel_x']:.3f} (was {initial_vel_x:.3f})")
    assert abs(env.hanging_swing['vel_x'] - initial_vel_x) > 0.001, "Airborne fly wake should nudge the swing"

    # C. Perching on the moss swing seat
    sw = env.hanging_swing
    sw_x = sw["anchor_x"] + sw["length"] * math.sin(sw["angle_x"])
    sw_y = sw["anchor_y"] + sw["length"] * math.sin(sw["angle_y"])
    sw_z = sw["anchor_z"] - sw["length"] * math.cos(sw["angle_x"])
    perching_fly = FruitFlyAgent(fly_id=30, archetype_name="Romeo", x=sw_x, y=sw_y, z=sw_z + 1.0)
    perching_fly.is_airborne = False
    perching_fly.entertainment = 0.2
    
    perching_fly.step(env, [perching_fly], dt_sec=0.1)
    env.step(dt_sec=0.1)
    
    print(f"    Perching fly action: '{perching_fly.action}', is_perched={perching_fly.is_perched_on_swing}, entertainment={perching_fly.entertainment:.2f}")
    assert perching_fly.is_perched_on_swing, "Fly should be perched on the moss swing seat"
    assert perching_fly.action == "swinging", f"Perched fly action should be 'swinging', got '{perching_fly.action}'"
    assert perching_fly.entertainment > 0.2, "Perching on swing should boost entertainment"

    # 4. Test Master Simulation: All 7 flies survive indefinitely without respawn
    print("\n[4] Testing Master Simulation Coordinator: Continuous lifetime without despawns")
    sim = FruitFlySimulation()
    initial_fly_ids = [f.id for f in sim.flies]
    
    # Step simulation for 60 frames
    for _ in range(60):
        sim.step(dt_sec=0.033)
        
    current_fly_ids = [f.id for f in sim.flies]
    all_alive = all(not getattr(f, 'is_dead', False) for f in sim.flies)
    print(f"    Fly count: {len(sim.flies)}, all alive={all_alive}, fly IDs preserved={initial_fly_ids == current_fly_ids}")
    assert len(sim.flies) == 7, "Simulation must maintain all 7 flies"
    assert all_alive, "All flies must be alive"
    assert initial_fly_ids == current_fly_ids, "Original flies must be preserved without despawning or respawning"

    print("\nALL NO-DEATH AND HANGING MOSS SWING TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_no_death_and_hanging_moss_swing()
