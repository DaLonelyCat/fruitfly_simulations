import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import math
from src.environment import SimulationEnvironment
from src.fly_agent import FruitFlyAgent

def test_lounge_chair_angles():
    print("=== Testing Lounge Chair Inward Facing Angles Toward TV ===")
    env = SimulationEnvironment()
    tv_x, tv_y = env.tv["x"], env.tv["y"]
    assert tv_x == 75.0 and tv_y == 24.0
    
    for chair in env.lounge_chairs:
        cx, cy = chair["x"], chair["y"]
        dx = tv_x - cx
        dy = tv_y - cy
        expected_angle = math.atan2(dy, dx)
        actual_yaw = chair["target_yaw"]
        
        diff = abs((expected_angle - actual_yaw + math.pi) % (2 * math.pi) - math.pi)
        print(f"[{chair['id']}] pos=({cx}, {cy}), target_yaw={actual_yaw:.4f}, expected={expected_angle:.4f}, diff={diff:.6f}")
        assert diff < 0.001, f"Chair {chair['id']} does not face directly at TV center!"
        
        # Test fly sitting in chair adopts this exact inward-facing heading
        fly = FruitFlyAgent(10, "Zen", x=cx, y=cy - 0.5, z=1.6)
        fly.step(env, [fly], dt_sec=0.016)
        if fly.is_sitting:
            heading_diff = abs((fly.heading - expected_angle + math.pi) % (2 * math.pi) - math.pi)
            assert heading_diff < 0.001, f"Sitting fly heading {fly.heading} does not match expected {expected_angle}"
            print(f"    Fly sitting in {chair['id']} correctly facing TV: heading={fly.heading:.4f}")
            
    print("\nALL CHAIR ANGLE TESTS PASSED SUCCESSFULLY! All chairs angle inward directly toward the TV.")

if __name__ == "__main__":
    test_lounge_chair_angles()
