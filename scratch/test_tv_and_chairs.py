import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import math
from src.environment import SimulationEnvironment
from src.fly_agent import FruitFlyAgent

def test_environment_tv_and_chairs():
    print("Testing Environment TV, Lounge Chairs, Swing Anchor, and Food Relocation...")
    env = SimulationEnvironment()
    
    # 1. Check TV
    assert hasattr(env, 'tv'), "Environment missing tv object"
    assert env.tv["x"] == 75.0
    assert env.tv["y"] == 24.0
    
    # 2. Check Lounge Chairs
    assert hasattr(env, 'lounge_chairs'), "Environment missing lounge_chairs"
    assert len(env.lounge_chairs) == 3
    chair_ids = [c["id"] for c in env.lounge_chairs]
    assert "chair_left" in chair_ids
    assert "chair_center" in chair_ids
    assert "chair_right" in chair_ids
    
    # 3. Check Swing Anchor
    assert env.hanging_swing["anchor_z"] == 46.5, f"Expected swing anchor_z=46.5, got {env.hanging_swing['anchor_z']}"
    
    # 4. Check Sugar Cube Relocation
    sugar = next((fp for fp in env.food_patches if fp["type"] == "sugar_cube"), None)
    assert sugar is not None, "Sugar cube not found in food patches"
    assert sugar["x"] == 160.0 and sugar["y"] == 140.0, f"Expected sugar cube at (160, 140), got ({sugar['x']}, {sugar['y']})"
    
    # 5. Serialization Check
    data = env.to_dict()
    assert "tv" in data
    assert "lounge_chairs" in data
    assert len(data["lounge_chairs"]) == 3
    print("Environment test passed!")

def test_fly_sitting_in_lounge_chair():
    print("Testing Fly Autonomous Sitting and Leaving in TV Lounge Chairs...")
    env = SimulationEnvironment()
    fly = FruitFlyAgent(fly_id=1, archetype_name="Zen", x=75.0, y=43.5, z=1.6)
    
    assert hasattr(fly, 'is_sitting')
    assert hasattr(fly, 'sitting_chair_id')
    assert hasattr(fly, 'sitting_timer')
    assert hasattr(fly, 'sitting_cooldown')
    assert not fly.is_sitting
    
    # Step fly while next to center chair
    for _ in range(5):
        fly.step(env, [fly], dt_sec=0.016)
        if fly.is_sitting:
            break
            
    assert fly.is_sitting, "Fly should have autonomously sat in lounge chair"
    assert fly.sitting_chair_id == "chair_center"
    assert fly.last_action_tag == "listening"
    assert math.isclose(fly.pitch, -1.22, abs_tol=0.01)
    print(f"Fly successfully sat: action={fly.last_action_tag}, pitch={fly.pitch:.2f}, chair={fly.sitting_chair_id}")
    
    # Test voluntary exit when timer expires
    fly.sitting_timer = 1
    fly.step(env, [fly], dt_sec=0.016)
    assert not fly.is_sitting, "Fly should have voluntarily stood up when sitting_timer expired"
    assert fly.sitting_cooldown > 0.0, "Fly should have a cooldown before sitting again"
    print("Fly successfully stood up and dismounted from chair!")

def test_fly_sitting_on_swing():
    print("Testing Fly Upright Sitting Posture on Swing...")
    env = SimulationEnvironment()
    # Swing seat is at anchor (110, 95, 46.5) - length 22.0 -> z ≈ 24.5
    swing = env.hanging_swing
    sw_x = swing["anchor_x"]
    sw_y = swing["anchor_y"]
    sw_z = swing["anchor_z"] - swing["length"]
    
    fly = FruitFlyAgent(fly_id=2, archetype_name="Romeo", x=sw_x, y=sw_y, z=sw_z + 1.0)
    
    # Step to perch on swing
    fly.step(env, [fly], dt_sec=0.016)
    assert fly.is_perched_on_swing, "Fly should have perched on the swing"
    assert fly.last_action_tag == "swinging"
    assert fly.pitch < -1.0, f"Fly should have an upright sitting posture (pitch ~ -1.22), got {fly.pitch}"
    print(f"Fly successfully sitting on swing basket chair: action={fly.last_action_tag}, pitch={fly.pitch:.2f}")

    # Test leaving swing voluntarily
    fly.swing_timer = 1
    fly.step(env, [fly], dt_sec=0.016)
    assert not fly.is_perched_on_swing, "Fly should have taken off into flight when swing timer expired"
    assert fly.is_airborne, "Fly should be airborne after leaving swing"
    print("Fly successfully took off from swing!")

if __name__ == "__main__":
    test_environment_tv_and_chairs()
    test_fly_sitting_in_lounge_chair()
    test_fly_sitting_on_swing()
    print("All TV and Chair tests passed successfully!")
