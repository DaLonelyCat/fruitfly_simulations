import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.environment import SimulationEnvironment
from src.fly_agent import FruitFlyAgent

def test_events_pruning_and_lifetime_counters():
    env = SimulationEnvironment()
    fly1 = FruitFlyAgent(fly_id=1, archetype_name="Romeo", x=50, y=50)
    fly2 = FruitFlyAgent(fly_id=2, archetype_name="Brawler", x=52, y=52)
    
    # Simulate 150 events
    for _ in range(150):
        env.record_courtship(fly1, fly2)
        env.record_fight(fly1, fly2)
        env.record_dopamine_surge(fly1, "sugar_cube")
    env.step(0.016)
        
    state = env.to_dict()
    print(f"Events length: {len(env.events)}")
    print(f"Total courtships in state: {state['total_courtships']}")
    print(f"Total fights in state: {state['total_fights']}")
    print(f"Total dopamine in state: {state['total_dopamine_surges']}")

if __name__ == "__main__":
    test_events_pruning_and_lifetime_counters()
