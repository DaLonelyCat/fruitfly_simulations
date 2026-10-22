import math
import numpy as np

class SimulationEnvironment:
    """
    Physical Drosophila Behavior Arena.
    Simulates odor diffusion gradients (fermenting yeast/banana),
    substrate cVA pheromone field, near-field acoustic courtship sound waves,
    food consumption, and social event tracking.
    """

    def __init__(self, width=300.0, height=300.0):
        self.width = float(width)
        self.height = float(height)
        
        # Food patches (x, y, radius_mm, amount)
        self.food_patches = [
            {"id": 1, "x": 80.0, "y": 80.0, "radius": 14.0, "amount": 100.0, "type": "banana_yeast"},
            {"id": 2, "x": 220.0, "y": 210.0, "radius": 12.0, "amount": 80.0, "type": "apple_cider"}
        ]
        
        # Pheromone 2D Grid (cVA - cis-vaccenyl acetate)
        self.grid_res = 60  # 60x60 grid = 5mm per cell
        self.cva_grid = np.zeros((self.grid_res, self.grid_res), dtype=np.float32)
        
        # Acoustic Sound Pulses (recent active song waves)
        # list of dicts: {"x": float, "y": float, "radius": float, "intensity": float, "timer": int}
        self.acoustic_waves = []
        
        # Social Interaction Event Logs
        self.events = []
        self.courtship_events = []
        self.fight_events = []
        
        # Interaction Matrix for Social Graph [fly_id_a][fly_id_b]
        self.interaction_matrix = {}

    def add_food_patch(self, x, y, radius=12.0, amount=80.0):
        new_id = len(self.food_patches) + 1
        self.food_patches.append({
            "id": new_id,
            "x": float(x),
            "y": float(y),
            "radius": float(radius),
            "amount": float(amount),
            "type": "fresh_yeast"
        })
        return new_id

    def deposit_cva(self, x, y, amount=0.1):
        gx = int((x / self.width) * self.grid_res)
        gy = int((y / self.height) * self.grid_res)
        if 0 <= gx < self.grid_res and 0 <= gy < self.grid_res:
            self.cva_grid[gy, gx] = min(1.0, self.cva_grid[gy, gx] + amount)

    def get_pheromone_cva(self, x, y):
        gx = int((x / self.width) * self.grid_res)
        gy = int((y / self.height) * self.grid_res)
        if 0 <= gx < self.grid_res and 0 <= gy < self.grid_res:
            return float(self.cva_grid[gy, gx])
        return 0.0

    def get_food_odor(self, x, y):
        """Calculates total fermenting food odor intensity at (x, y) using Gaussian diffusion."""
        total_odor = 0.0
        for fp in self.food_patches:
            if fp["amount"] <= 0:
                continue
            dist = math.hypot(x - fp["x"], y - fp["y"])
            # Odor plume drops off with distance (characteristic length ~45mm)
            odor = math.exp(- (dist ** 2) / (2 * 45.0 ** 2)) * (fp["amount"] / 100.0)
            total_odor += odor
        return min(1.0, total_odor)

    def get_food_gradient_angle(self, x, y):
        """Calculates direction to maximum food odor gradient."""
        nearest = None
        min_dist = 999.0
        for fp in self.food_patches:
            if fp["amount"] <= 0:
                continue
            dist = math.hypot(x - fp["x"], y - fp["y"])
            if dist < min_dist:
                min_dist = dist
                nearest = fp
        if nearest and min_dist < 90.0:
            return math.atan2(nearest["y"] - y, nearest["x"] - x)
        return None

    def get_nearest_food_dist(self, x, y):
        min_dist = 999.0
        for fp in self.food_patches:
            if fp["amount"] <= 0:
                continue
            dist = math.hypot(x - fp["x"], y - fp["y"])
            if dist < min_dist:
                min_dist = dist
        return min_dist

    def is_on_food(self, x, y):
        for fp in self.food_patches:
            if fp["amount"] > 0 and math.hypot(x - fp["x"], y - fp["y"]) <= fp["radius"]:
                return True
        return False

    def consume_food(self, x, y, amount=0.01):
        for fp in self.food_patches:
            if fp["amount"] > 0 and math.hypot(x - fp["x"], y - fp["y"]) <= fp["radius"]:
                taken = min(fp["amount"], amount)
                fp["amount"] -= taken
                return taken
        return 0.0

    def emit_song(self, x, y, intensity=0.8):
        """Spawns an expanding near-field acoustic pulse wave."""
        self.acoustic_waves.append({
            "x": float(x),
            "y": float(y),
            "radius": 2.0,
            "max_radius": 28.0,
            "intensity": float(intensity),
            "life": 12
        })

    def get_acoustic_song(self, x, y, exclude_fly_id=None):
        """Detects whether (x, y) is within any active acoustic pulse song wave."""
        max_intensity = 0.0
        for wave in self.acoustic_waves:
            dist = math.hypot(x - wave["x"], y - wave["y"])
            if abs(dist - wave["radius"]) < 5.0:
                max_intensity = max(max_intensity, wave["intensity"])
        return max_intensity

    def record_courtship(self, suitor, target):
        event = {
            "type": "courtship",
            "suitor_id": suitor.id,
            "suitor_name": suitor.archetype_name,
            "target_id": target.id,
            "target_name": target.archetype_name,
            "wing": suitor.singing_wing,
            "timestamp_step": len(self.events)
        }
        self.events.append(event)
        self.courtship_events.append(event)
        if len(self.courtship_events) > 100:
            self.courtship_events.pop(0)
            
        # Record in social interaction matrix
        pair_key = f"{min(suitor.id, target.id)}-{max(suitor.id, target.id)}"
        self.interaction_matrix[pair_key] = self.interaction_matrix.get(pair_key, 0) + 1

    def record_fight(self, aggressor, target):
        event = {
            "type": "aggression",
            "aggressor_id": aggressor.id,
            "aggressor_name": aggressor.archetype_name,
            "target_id": target.id,
            "target_name": target.archetype_name,
            "timestamp_step": len(self.events)
        }
        self.events.append(event)
        self.fight_events.append(event)
        if len(self.fight_events) > 100:
            self.fight_events.pop(0)
            
        # Target gets pushed back / startled
        push_angle = math.atan2(target.y - aggressor.y, target.x - aggressor.x)
        target.vx += math.cos(push_angle) * 35.0
        target.vy += math.sin(push_angle) * 35.0
        target.heading = push_angle
        # Target brain startled
        target.brain.firing_rates[target.brain.pop_idx["DN_ESCAPE"]] = 0.8
        aggressor.fights_won += 1
        
        pair_key = f"{min(aggressor.id, target.id)}-{max(aggressor.id, target.id)}"
        self.interaction_matrix[pair_key] = self.interaction_matrix.get(pair_key, 0) + 1

    def step(self, dt_sec=0.016):
        """Simulates environmental dynamics (pheromone evaporation, sound propagation)."""
        # 1. Pheromone decay and slight diffusion
        self.cva_grid *= 0.992
        
        # 2. Update acoustic waves
        alive_waves = []
        for wave in self.acoustic_waves:
            wave["radius"] += 45.0 * dt_sec  # wave expansion speed
            wave["life"] -= 1
            wave["intensity"] *= 0.88
            if wave["life"] > 0 and wave["radius"] < wave["max_radius"]:
                alive_waves.append(wave)
        self.acoustic_waves = alive_waves

    def to_dict(self):
        """Serializes arena state for frontend rendering."""
        return {
            "width": self.width,
            "height": self.height,
            "food_patches": self.food_patches,
            "acoustic_waves": [
                {"x": round(w["x"], 1), "y": round(w["y"], 1), "radius": round(w["radius"], 1), "intensity": round(w["intensity"], 2)}
                for w in self.acoustic_waves
            ],
            "recent_events": self.events[-12:],
            "total_courtships": len(self.courtship_events),
            "total_fights": len(self.fight_events),
            "interaction_pairs": self.interaction_matrix
        }
