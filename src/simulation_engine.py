import time
import math
import random
from src.environment import SimulationEnvironment
from src.fly_agent import FruitFlyAgent

class FruitFlySimulation:
    """
    3D Master Simulation Coordinator.
    Manages 3D Drosophila terrarium physics, connectome multi-agent loop,
    dopamine reward events, and WebSocket telemetry broadcasts.
    """

    def __init__(self, arena_w=200.0, arena_d=200.0, arena_h=100.0, num_flies=7):
        self.arena_w = arena_w
        self.arena_d = arena_d
        self.arena_h = arena_h
        self.env = SimulationEnvironment(width=arena_w, depth=arena_d, height=arena_h)
        self.flies = []
        self.step_count = 0
        self.is_paused = False
        self.simulation_speed = 1.0
        self.selected_fly_id = 1
        
        # Initialize default biological archetypes in 3D terrarium (including Curly mutant)
        default_archetypes = ["Romeo", "Brawler", "Glutton", "Skittish", "Zen", "Cleopatra", "Curly"]
        for i, arch in enumerate(default_archetypes[:num_flies]):
            angle = (2 * math.pi * i) / num_flies
            r = 50.0
            x = (arena_w / 2.0) + r * math.cos(angle)
            y = (arena_d / 2.0) + r * math.sin(angle)
            z = 1.6  # baseline ground clearance
            fly = FruitFlyAgent(fly_id=i + 1, archetype_name=arch, x=x, y=y, z=z, heading=angle + 1.57)
            self.flies.append(fly)

    def add_fly(self, archetype_name="Romeo", x=None, y=None, z=1.6):
        new_id = max([f.id for f in self.flies], default=0) + 1
        if x is None:
            x = random.uniform(30.0, self.arena_w - 30.0)
        if y is None:
            y = random.uniform(30.0, self.arena_d - 30.0)
        heading = random.uniform(0, 2 * math.pi)
        fly = FruitFlyAgent(fly_id=new_id, archetype_name=archetype_name, x=x, y=y, z=z, heading=heading)
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
            if "dopamine" in personality_updates:
                fly.dopamine_level = float(personality_updates["dopamine"])
            return True
        return False

    def remove_food(self, food_id):
        return self.env.remove_food_patch_3d(food_id)

    def clear_food(self):
        return self.env.clear_all_food()

    def trigger_flight(self, fly_id=None):
        if fly_id is not None:
            f = self.get_fly(fly_id)
            if f:
                f.trigger_flight(altitude_target=random.uniform(35.0, 75.0))
        else:
            # Trigger flight for all flies
            for f in self.flies:
                f.trigger_flight(altitude_target=random.uniform(30.0, 70.0))

    def stimulate_fly_neuropil(self, fly_id, pop_name, intensity=2.5, duration_ms=350):
        f = self.get_fly(fly_id)
        if f:
            f.stimulate_neuropil(pop_name, intensity, duration_ms)
            return True
        return False

    def step(self, dt_sec=0.016):
        if self.is_paused:
            return
            
        eff_dt = dt_sec * self.simulation_speed
        
        # 1. Update 3D sensors and compute connectome brains
        decisions = []
        for fly in self.flies:
            res = fly.update_sensors_and_brain(self.env, self.flies, dt_sec=eff_dt)
            decisions.append((fly, res))
            
        # 2. Apply 3D physics, locomotion, and interactions
        for fly, (motor_commands, nearest_fly, min_dist, rel_angle, food_dist, food_grad) in decisions:
            fly.apply_physics(motor_commands, nearest_fly, min_dist, rel_angle, food_dist, food_grad, self.env, dt_sec=eff_dt)
            
        # 3. Resolve 3D Hitbox Collisions (Fly-Fly and Fly-Obstacle)
        self.env.resolve_hitbox_collisions(self.flies)

        # 4. Step 3D environmental dynamics
        self.env.step(dt_sec=eff_dt)
        self.step_count += 1


    def get_state(self):
        """Compiles 3D state package for WebSocket streaming to Three.js viewports."""
        return {
            "step": self.step_count,
            "paused": self.is_paused,
            "speed": self.simulation_speed,
            "selected_fly_id": self.selected_fly_id,
            "flies": [f.to_dict() for f in self.flies],
            "environment": self.env.to_dict()
        }
