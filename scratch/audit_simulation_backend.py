import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import math
from src.simulation_engine import FruitFlySimulation

def test_long_simulation_run():
    print("Testing 1000 continuous simulation steps...")
    sim = FruitFlySimulation(num_flies=7)
    
    # Run 1000 steps with dynamic actions
    for step in range(1000):
        # Spontaneously trigger flights, add/remove food, startle
        if step == 100:
            sim.trigger_flight()
        if step == 200:
            sim.env.add_food_patch_3d(80.0, 80.0, z=50.0, food_type="banana_slice", amount=90.0)
        if step == 400:
            sim.add_fly(archetype_name="Curly")
        if step == 600:
            sim.trigger_flight(1)
        if step == 800:
            if len(sim.env.food_patches) > 0:
                sim.remove_food(sim.env.food_patches[0]["id"])
                
        sim.step(dt_sec=0.016)
        
        # Verify fly states for NaN or out of bounds
        for f in sim.flies:
            assert not math.isnan(f.x), f"Fly {f.id} has NaN x"
            assert not math.isnan(f.y), f"Fly {f.id} has NaN y"
            assert not math.isnan(f.z), f"Fly {f.id} has NaN z"
            assert not math.isnan(f.heading), f"Fly {f.id} has NaN heading"
            assert not math.isnan(f.pitch), f"Fly {f.id} has NaN pitch"
            assert not math.isnan(f.roll), f"Fly {f.id} has NaN roll"
            assert 0.0 <= f.satiety <= 1.0, f"Fly {f.id} invalid satiety: {f.satiety}"
            assert 0.0 <= f.mood <= 1.0, f"Fly {f.id} invalid mood: {f.mood}"
            assert 0.0 <= f.entertainment <= 1.0, f"Fly {f.id} invalid entertainment: {f.entertainment}"
            assert f.z >= 1.5, f"Fly {f.id} below ground: {f.z}"
            
        # Verify environment state serialization
        state = sim.get_state()
        assert "flies" in state
        assert "environment" in state
        assert len(state["flies"]) == len(sim.flies)

    print("Success: 1000 steps completed with zero NaNs, zero boundary violations, and healthy state serialization.")

if __name__ == "__main__":
    test_long_simulation_run()
