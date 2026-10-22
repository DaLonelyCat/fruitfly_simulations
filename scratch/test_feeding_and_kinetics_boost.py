import sys
import os
sys.path.insert(0, os.path.abspath("."))
import math
from src.environment import SimulationEnvironment
from src.fly_agent import FruitFlyAgent

def test_feeding_and_kinetics_boost():
    print("=== Testing Fruit Fly Feeding & Kinetic Playground Boosting ===")
    env = SimulationEnvironment()
    
    # 1. Test Feeding: Satiety must rise rapidly when near food
    print("\n[1] Testing Feeding & Satiety Rise")
    # Food patch 1 is at (100, 100, 0)
    food_x, food_y = env.food_patches[0]["x"], env.food_patches[0]["y"]
    print(f"    Food patch at ({food_x}, {food_y})")
    
    hungry_fly = FruitFlyAgent(fly_id=1, archetype_name="Glutton", x=food_x + 5.0, y=food_y + 5.0, z=1.6)
    hungry_fly.satiety = 0.10 # Starving
    hungry_fly.mood = 0.30
    
    print(f"    Initial state: satiety={hungry_fly.satiety:.2f}, action='{hungry_fly.action}'")
    
    # Step hungry fly for 15 steps (~250ms of real-time simulation)
    for _ in range(15):
        hungry_fly.step(env, [hungry_fly], dt_sec=0.033)
        env.step(dt_sec=0.033)
        
    print(f"    After feeding near food: satiety={hungry_fly.satiety:.2f}, mood={hungry_fly.mood:.2f}, action='{hungry_fly.action}'")
    assert hungry_fly.satiety > 0.15, f"Satiety should have increased significantly, got {hungry_fly.satiety:.2f}"
    assert hungry_fly.action == "feeding", f"Action should be 'feeding', got '{hungry_fly.action}'"
    print("    [OK] Satiety successfully rises when food is nearby!")

    # 2. Test Running Wheel: Entertainment must rise rapidly on the wheel
    print("\n[2] Testing Running Wheel: Fun & Entertainment Rise")
    wheel_x = env.running_wheel["x"]
    wheel_y = env.running_wheel["y"]
    
    bored_fly = FruitFlyAgent(fly_id=2, archetype_name="Brawler", x=wheel_x + 2.0, y=wheel_y + 2.0, z=1.6)
    bored_fly.entertainment = 0.10
    bored_fly.mood = 0.40
    
    print(f"    Initial state: fun={bored_fly.entertainment:.2f}, action='{bored_fly.action}'")
    
    for _ in range(15):
        bored_fly.step(env, [bored_fly], dt_sec=0.033)
        env.step(dt_sec=0.033)
        
    print(f"    After exercising on wheel: fun={bored_fly.entertainment:.2f}, mood={bored_fly.mood:.2f}, action='{bored_fly.action}'")
    assert bored_fly.entertainment > 0.15, f"Entertainment should have increased significantly, got {bored_fly.entertainment:.2f}"
    assert bored_fly.action == "exercising", f"Action should be 'exercising', got '{bored_fly.action}'"
    print("    [OK] Fun & Entertainment successfully rises on the running wheel!")

    # 3. Test Hanging Moss Swing: Entertainment must rise on the swing
    print("\n[3] Testing Hanging Moss Swing: Fun & Entertainment Rise")
    swing_fly = FruitFlyAgent(fly_id=3, archetype_name="Romeo", x=110.0, y=95.0, z=27.6)
    swing_fly.entertainment = 0.10
    
    print(f"    Initial state: fun={swing_fly.entertainment:.2f}, action='{swing_fly.action}'")
    
    for _ in range(15):
        swing_fly.step(env, [swing_fly], dt_sec=0.033)
        env.step(dt_sec=0.033)
        
    print(f"    After swinging on moss swing: fun={swing_fly.entertainment:.2f}, action='{swing_fly.action}'")
    assert swing_fly.entertainment > 0.20, f"Entertainment should have increased significantly, got {swing_fly.entertainment:.2f}"
    assert swing_fly.action == "swinging", f"Action should be 'swinging', got '{swing_fly.action}'"
    print("    [OK] Fun & Entertainment successfully rises on the hanging moss swing!")

    # 4. Test Active Steering: Hungry flies steer toward food; bored flies steer toward playground
    print("\n[4] Testing Active Steering Toward Needs")
    far_hungry_fly = FruitFlyAgent(fly_id=4, archetype_name="Glutton", x=100.0, y=50.0, z=1.6)
    far_hungry_fly.satiety = 0.10 # Very hungry
    far_hungry_fly.heading = -math.pi / 2 # Facing away from food at (100, 100)
    
    far_hungry_fly.step(env, [far_hungry_fly], dt_sec=0.1)
    # Target yaw to food at (100, 100) from (100, 50) is +pi/2
    print(f"    Far hungry fly angular_vel: {far_hungry_fly.angular_velocity:.2f} rad/s (steering toward food)")
    assert abs(far_hungry_fly.angular_velocity) > 0.5, "Hungry fly should turn with purpose toward food"

    print("\nALL FEEDING AND KINETICS TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_feeding_and_kinetics_boost()
