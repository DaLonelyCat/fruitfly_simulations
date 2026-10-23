import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import math
from src.environment import SimulationEnvironment
from src.fly_agent import FruitFlyAgent

def test_balanced_turning_and_no_right_spin():
    print("=== Testing Balanced Turning & Eradication of Right-Spin Bias ===")
    env = SimulationEnvironment()
    
    # Test across multiple archetypes in free wandering mode
    for arch in ["Romeo", "Zen", "Brawler", "Skittish"]:
        fly = FruitFlyAgent(1, arch, x=100.0, y=100.0, z=1.6)
        fly.entertainment = 0.9  # free exploration mode
        fly.satiety = 0.9        # well fed
        
        ang_vels = []
        left_turns = 0
        right_turns = 0
        
        for _ in range(300):
            fly.step(env, [fly], dt_sec=0.016)
            # Sample during free locomotion
            if fly.action in ["walking", "flying"]:
                ang_vels.append(fly.angular_velocity)
                if fly.angular_velocity > 0.05:
                    left_turns += 1
                elif fly.angular_velocity < -0.05:
                    right_turns += 1
                    
        mean_ang_vel = sum(ang_vels) / len(ang_vels) if ang_vels else 0.0
        total_turns = left_turns + right_turns
        left_ratio = left_turns / total_turns if total_turns > 0 else 0.5
        
        print(f"[{arch}] Steps={len(ang_vels)}, Mean AngVel={mean_ang_vel:+.3f} rad/s, Left={left_turns} ({left_ratio*100:.1f}%), Right={right_turns} ({(1-left_ratio)*100:.1f}%)")
        
        # Verify mean angular velocity is close to zero (unbiased)
        assert abs(mean_ang_vel) < 0.25, f"Mean angular velocity should be near zero, got {mean_ang_vel}"
        # Verify balanced turn ratio between 35% and 65%
        assert 0.35 <= left_ratio <= 0.65, f"Turn ratio should be balanced (35%-65%), got {left_ratio*100:.1f}% left turns"
        
    print("\nALL BALANCED TURNING TESTS PASSED SUCCESSFULLY! No right-spin bias detected.")

if __name__ == "__main__":
    test_balanced_turning_and_no_right_spin()
