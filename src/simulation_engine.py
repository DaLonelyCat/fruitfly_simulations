import time
import random
from src.environment import SimulationEnvironment
from src.fly_agent import FruitFlyAgent

class FruitFlySimulation:
    """
    Master Simulation Coordinator for multi-agent Drosophila connectome dynamics.
    Handles agent spawning, time stepping, event resolution, and telemetry broadcasts.
    """

    def __init__(self, arena_size=300.0, num_flies=6):
        self.arena_size = arena_size
        self.env = SimulationEnvironment(width=arena_size, height=arena_size)
        self.flies = []
        self.step_count = 0
        self.is_paused = False
        self.simulation_speed = 1.0  # multiplier
        self.selected_fly_id = 1
        
        # Initialize default flies across all biological archetypes
        default_archetypes = ["Romeo", "Brawler", "Glutton", "Skittish", "Zen", "Cleopatra"]
        for i, arch in enumerate(default_archetypes[:num_flies]):
            # Place in a ring around arena center
            angle = (2 * 3.14159 * i) / num_flies
            r = 75.0
            x = (arena_size / 2.0) + r * random.uniform(0.7, 1.1) * float(math_cos(angle))
            y = (arena_size / 2.0) + r * random.uniform(0.7, 1.1) * float(math_sin(angle))
            fly = FruitFlyAgent(fly_id=i + 1, archetype_name=arch, x=x, y=y, heading=angle + 1.57)
            self.flies.append(fly)

    def add_fly(self, archetype_name="Romeo", x=None, y=None):
        new_id = max([f.id for f in self.flies], default=0) + 1
        if x is None:
            x = random.uniform(40.0, self.arena_size - 40.0)
        if y is None:
            y = random.uniform(40.0, self.arena_size - 40.0)
        heading = random.uniform(0, 6.28)
        fly = FruitFlyAgent(fly_id=new_id, archetype_name=archetype_name, x=x, y=y, heading=heading)
        self.flies.append(fly)
        return fly

    def remove_fly(self, fly_id):
        self.flies = [f for f in self.flies if f.id != fly_id]
        if self.selected_fly_id == fly_id:
            self.selected_fly_id = self.flies[0].id if self.flies else None

    def get_fly(self, fly_id):
        for f in self.flies:
            if f.id == fly_id:
                return f
        return None

    def update_fly_personality(self, fly_id, personality_updates):
        fly = self.get_fly(fly_id)
        if fly:
            fly.brain.set_personality(**personality_updates)
            return True
        return False

    def step(self, dt_sec=0.016):
        if self.is_paused:
            return
            
        eff_dt = dt_sec * self.simulation_speed
        
        # 1. Update sensory inputs and compute connectome brains for all flies
        decisions = []
        for fly in self.flies:
            res = fly.update_sensors_and_brain(self.env, self.flies, dt_sec=eff_dt)
            decisions.append((fly, res))
            
        # 2. Apply motor commands, physics, and interactions
        for fly, (motor_commands, nearest_fly, min_dist, rel_angle) in decisions:
            fly.apply_physics(motor_commands, nearest_fly, min_dist, rel_angle, self.env, dt_sec=eff_dt)
            
        # 3. Step environmental field dynamics (pheromones, acoustic pulses)
        self.env.step(dt_sec=eff_dt)
        self.step_count += 1

    def get_state(self):
        """Compiles complete state package for WebSocket streaming."""
        return {
            "step": self.step_count,
            "paused": self.is_paused,
            "speed": self.simulation_speed,
            "selected_fly_id": self.selected_fly_id,
            "flies": [f.to_dict() for f in self.flies],
            "environment": self.env.to_dict()
        }

def math_cos(x):
    import math
    return math.cos(x)

def math_sin(x):
    import math
    return math.sin(x)
