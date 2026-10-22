import sys
import os
sys.path.insert(0, os.path.abspath("."))
import math
from src.environment import SimulationEnvironment
from src.fly_agent import FruitFlyAgent
from src.simulation_engine import FruitFlySimulation

def test_health_combat_and_kinetic_entertainment():
    print("=== Testing Fruit Fly Simulation: Health, Combat, Food Depletion & Kinetic Entertainment ===")
    
    # 1. Test Environment Food Depletion and Drought Mechanics
    env = SimulationEnvironment()
    print(f"[1] Initial food patches: {len(env.food_patches)}, is_drought: {env.is_drought}")
    assert len(env.food_patches) > 0, "Environment should start with food patches"
    
    # Manually deplete all food
    env.food_patches.clear()
    env.step(dt_sec=1.0)
    print(f"    After clearing food: is_drought={env.is_drought}, drought_timer={env.drought_timer:.1f}s")
    assert env.is_drought, "Environment should be in drought state when no food patches exist"
    
    # Step until emergency drop triggers (65s threshold)
    env.drought_timer = 64.5
    env.step(dt_sec=1.0)
    print(f"    After 65s drought: food patches count={len(env.food_patches)}, is_drought={env.is_drought}")
    assert len(env.food_patches) >= 1, "Emergency canopy drop should have added food patches"
    assert not env.is_drought, "Drought should clear after emergency food drop"

    # 2. Test Kinetic Playground: Running Wheel & Moss Swing
    print("\n[2] Testing Kinetic Playground: Running Wheel & Hanging Swing")
    wheel_fly = FruitFlyAgent(fly_id=901, archetype_name="Glutton", x=45.0, y=140.0, z=1.6)
    wheel_fly.entertainment = 0.2
    wheel_fly.mood = 0.5
    
    # Step physics with fly on the running wheel
    wheel_fly.step(env, [wheel_fly], dt_sec=0.2)
    env.step(dt_sec=0.2)
    
    print(f"    Wheel fly action: '{wheel_fly.action}', entertainment: {wheel_fly.entertainment:.2f}, mood: {wheel_fly.mood:.2f}")
    print(f"    Running wheel ang_vel: {env.running_wheel['angular_vel']:.2f}, angle: {env.running_wheel['angle']:.2f}")
    assert wheel_fly.action == "exercising", f"Fly on wheel should have action 'exercising', got '{wheel_fly.action}'"
    assert wheel_fly.entertainment > 0.25, f"Fly entertainment should be boosted above 0.25, got {wheel_fly.entertainment}"
    assert env.running_wheel["angular_vel"] > 0, "Running wheel should have acquired angular velocity"
    
    # Test Moss Swing
    swing_fly = FruitFlyAgent(fly_id=902, archetype_name="Skittish", x=110.0, y=95.0, z=32.0)
    swing_fly.entertainment = 0.3
    swing_fly.step(env, [swing_fly], dt_sec=0.2)
    env.step(dt_sec=0.2)
    print(f"    Swing fly action: '{swing_fly.action}', entertainment: {swing_fly.entertainment:.2f}")
    print(f"    Hanging swing vel_x: {env.hanging_swing['vel_x']:.2f}")
    assert swing_fly.action == "swinging", f"Fly on swing should have action 'swinging', got '{swing_fly.action}'"
    assert swing_fly.entertainment > 0.3, "Swinging should boost entertainment"

    # 3. Test Mood Decline and Aggressive Combat
    print("\n[3] Testing Mood Decline & Aggression Combat Mechanics")
    aggressor = FruitFlyAgent(fly_id=101, archetype_name="Brawler", x=50.0, y=50.0, z=0.0)
    victim = FruitFlyAgent(fly_id=102, archetype_name="Zen", x=53.0, y=50.0, z=0.0)
    
    # Put aggressor into bad mood & hunger
    aggressor.mood = 0.15 # < 0.28 bad mood threshold
    aggressor.satiety = 0.1
    aggressor.entertainment = 0.1
    aggressor.attack_cooldown = 0.0
    victim.health = 100.0
    
    flies = [aggressor, victim]
    initial_fights = len(env.fight_events)
    initial_victim_hp = victim.health
    
    # Step aggressor facing victim
    aggressor.step(env, flies, dt_sec=0.1)
    
    print(f"    Aggressor action: '{aggressor.action}', wing_threat_posture: {aggressor.wing_threat_posture}")
    print(f"    Victim health: {victim.health:.1f} / 100.0 (damaged by {initial_victim_hp - victim.health:.1f} HP)")
    print(f"    Total environment fights: {len(env.fight_events)} (was {initial_fights})")
    
    assert victim.health <= 100.0 - 18.0, f"Victim should take at least 18 HP damage, got {victim.health}"
    assert len(env.fight_events) > initial_fights, "Environment should record fight event"
    assert aggressor.action in ["lunging", "fighting"], f"Aggressor action should be 'lunging' or 'fighting', got '{aggressor.action}'"

    # 4. Test Starvation Damage and Vital Healing
    print("\n[4] Testing Starvation Damage and Natural Healing")
    starving_fly = FruitFlyAgent(fly_id=201, archetype_name="Glutton", x=70.0, y=70.0, z=0.0)
    starving_fly.satiety = 0.0 # fully starved
    starving_fly.health = 80.0
    starving_fly.step(env, [starving_fly], dt_sec=1.0)
    print(f"    Starving fly health after 1s: {starving_fly.health:.2f} (took {80.0 - starving_fly.health:.2f} HP starvation damage)")
    assert starving_fly.health < 80.0, "Starving fly should take starvation damage"
    
    well_fed_fly = FruitFlyAgent(fly_id=202, archetype_name="Zen", x=70.0, y=70.0, z=0.0)
    well_fed_fly.satiety = 0.9
    well_fed_fly.mood = 0.8
    well_fed_fly.health = 80.0
    well_fed_fly.step(env, [well_fed_fly], dt_sec=1.0)
    print(f"    Well-fed fly health after 1s: {well_fed_fly.health:.2f} (healed {well_fed_fly.health - 80.0:.2f} HP)")
    assert well_fed_fly.health > 80.0, "Well-fed content fly should naturally heal"

    # 5. Test Mortality, Death Posture and Respawn Dynamics
    print("\n[5] Testing Mortality, Death Posture & Respawn Cycle")
    sim = FruitFlySimulation()
    test_fly = sim.flies[0]
    test_fly_id = test_fly.id
    test_archetype = test_fly.archetype
    
    # Inflict lethal damage
    test_fly.health = 0.0
    test_fly.step(sim.env, sim.flies, dt_sec=0.1)
    
    print(f"    Lethal fly state: is_dead={test_fly.is_dead}, roll={test_fly.roll:.2f} rad, action='{test_fly.action}'")
    assert test_fly.is_dead, "Fly with 0 HP should be marked dead"
    assert abs(test_fly.roll - math.pi) < 0.1, f"Dead fly should be rolled onto dorsal back (~pi rad), got {test_fly.roll}"
    assert test_fly.action == "dead", f"Dead fly action should be 'dead', got '{test_fly.action}'"
    
    # Fast forward death timer to 4.1s
    test_fly.death_timer = 4.1
    sim.step()
        
    respawned_fly = next((f for f in sim.flies if f.id == test_fly_id), None)
    print(f"    Respawned fly: id={respawned_fly.id}, archetype='{respawned_fly.archetype}', health={respawned_fly.health:.1f}, is_dead={respawned_fly.is_dead}")
    assert respawned_fly is not None, "Respawned fly should exist with same ID"
    assert respawned_fly.health == 100.0, f"Respawned fly should have full 100 HP, got {respawned_fly.health}"
    assert not respawned_fly.is_dead, "Respawned fly should be alive"
    assert respawned_fly.archetype == test_archetype, f"Respawned fly should preserve archetype '{test_archetype}'"

    print("\nALL HEALTH, COMBAT, DROUGHT AND KINETIC PLAYGROUND TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_health_combat_and_kinetic_entertainment()
