import math
import random
import numpy as np

class SimulationEnvironment:
    """
    3D Physical Drosophila Behavior Arena (200mm x 200mm x 100mm).
    Simulates:
    - 3D Terrarium with floor, glass walls, ceiling, and 3D flight airspace.
    - 3D Interactive Objects: Climbing perches, elevated twigs, food pedestals.
    - 3D Food Objects (Banana slices, sugar cubes, yeast drops) with removal support.
    - 3D Hitboxes and physical collision resolution for all flies and obstacles.
    - Dopamine Reward System: Sugar consumption activates PAM dopaminergic influx.
    """

    def __init__(self, width=200.0, depth=200.0, height=100.0):
        self.width = float(width)
        self.depth = float(depth)
        self.height = float(height)
        
        # 3D Interactive Objects (Perches, climbing branches)
        self.objects = [
            # Main central climbing branch: cylinder from floor (Z=0) up to Z=65
            {
                "id": "perch_main",
                "type": "cylinder",
                "x": 100.0, "y": 100.0, "z": 0.0,
                "radius": 4.5, "height": 65.0,
                "color": "#6e4a2e",
                "label": "Climbing Perch"
            },
            # Horizontal twig branch extending from perch
            {
                "id": "twig_a",
                "type": "branch",
                "x1": 100.0, "y1": 100.0, "z1": 50.0,
                "x2": 140.0, "y2": 110.0, "z2": 52.0,
                "radius": 2.2,
                "color": "#7d5435",
                "label": "High Perch Twig"
            },
            # Elevated food platform
            {
                "id": "pedestal_b",
                "type": "cylinder",
                "x": 150.0, "y": 60.0, "z": 0.0,
                "radius": 15.0, "height": 22.0,
                "color": "#334155",
                "label": "Elevated Platform"
            }
        ]
        
        # 3D Food Patches (Banana, Sugar, Yeast)
        self.food_patches = [
            {
                "id": 1,
                "x": 60.0, "y": 60.0, "z": 0.0,
                "radius": 12.0, "height": 3.5,
                "amount": 100.0,
                "sugar_quality": 1.0,
                "type": "banana_slice",
                "label": "Ripe Banana Slice"
            },
            {
                "id": 2,
                "x": 150.0, "y": 60.0, "z": 22.0,  # on the elevated platform
                "radius": 8.0, "height": 8.0,
                "amount": 90.0,
                "sugar_quality": 1.3,  # high dopamine reward
                "type": "sugar_cube",
                "label": "Crystalline Sugar Cube"
            },
            {
                "id": 3,
                "x": 140.0, "y": 150.0, "z": 0.0,
                "radius": 10.0, "height": 2.5,
                "amount": 80.0,
                "sugar_quality": 0.9,
                "type": "yeast_agar",
                "label": "Fermenting Yeast Drop"
            }
        ]
        
        # 3D Pheromone Traces (cVA deposited on surfaces)
        self.pheromone_traces = []
        
        # 3D Acoustic Near-Field Pulse Waves
        self.acoustic_waves_3d = []
        
        # Social & Dopamine Events
        self.events = []
        self.dopamine_events = []
        self.courtship_events = []
        self.fight_events = []
        self.interaction_matrix = {}

    def add_food_patch_3d(self, x, y, z=0.0, food_type="banana_slice", amount=90.0):
        new_id = max([fp["id"] for fp in self.food_patches], default=0) + 1
        sugar_val = 1.3 if food_type == "sugar_cube" else 1.0
        h = 8.0 if food_type == "sugar_cube" else 3.5
        r = 8.0 if food_type == "sugar_cube" else 11.0
        self.food_patches.append({
            "id": new_id,
            "x": float(x),
            "y": float(y),
            "z": float(z),
            "radius": r,
            "height": h,
            "amount": float(amount),
            "sugar_quality": sugar_val,
            "type": food_type,
            "label": "Fresh Banana Slice" if food_type == "banana_slice" else "Sugar Cube"
        })
        return new_id

    def remove_food_patch_3d(self, food_id):
        """Removes a specific food patch by ID."""
        initial_len = len(self.food_patches)
        self.food_patches = [fp for fp in self.food_patches if fp["id"] != int(food_id)]
        return len(self.food_patches) < initial_len

    def clear_all_food(self):
        """Removes all food patches from the terrarium."""
        removed_count = len(self.food_patches)
        self.food_patches = []
        return removed_count

    def get_food_odor_3d(self, x, y, z):
        """Calculates 3D diffusing fermenting food odor intensity at (x, y, z)."""
        total_odor = 0.0
        for fp in self.food_patches:
            if fp["amount"] <= 0:
                continue
            dx = x - fp["x"]
            dy = y - fp["y"]
            dz = z - fp["z"]
            dist_sq = dx*dx + dy*dy + dz*dz
            odor = math.exp(-dist_sq / (2 * 40.0 * 40.0)) * (fp["amount"] / 100.0)
            total_odor += odor
        return min(1.0, total_odor)

    def get_nearest_food_3d(self, x, y, z):
        """Returns distance and gradient vector to nearest food patch."""
        nearest = None
        min_dist = 999.0
        grad_dx, grad_dy, grad_dz = 0.0, 0.0, 0.0
        for fp in self.food_patches:
            if fp["amount"] <= 0:
                continue
            dx = fp["x"] - x
            dy = fp["y"] - y
            dz = fp["z"] - z
            d = math.sqrt(dx*dx + dy*dy + dz*dz)
            if d < min_dist:
                min_dist = d
                nearest = fp
                if d > 0.001:
                    grad_dx, grad_dy, grad_dz = dx/d, dy/d, dz/d
        return min_dist, nearest, (grad_dx, grad_dy, grad_dz)

    def consume_food_3d(self, x, y, z, max_intake=0.04):
        """Consumes food in 3D contact and computes the DOPAMINE REWARD."""
        for fp in self.food_patches:
            if fp["amount"] <= 0:
                continue
            dx = x - fp["x"]
            dy = y - fp["y"]
            dz = z - fp["z"]
            dist_xy = math.hypot(dx, dy)
            if dist_xy <= fp["radius"] and abs(dz) <= (fp["height"] + 2.0):
                eaten = min(fp["amount"], max_intake)
                fp["amount"] -= eaten
                dopamine_surge = eaten * fp["sugar_quality"] * 2.5
                return eaten, dopamine_surge, fp["label"]
        return 0.0, 0.0, None

    def deposit_cva_3d(self, x, y, z, amount=0.08):
        self.pheromone_traces.append({
            "x": float(x),
            "y": float(y),
            "z": float(z),
            "amount": float(amount),
            "life": 45
        })

    def get_pheromone_cva_3d(self, x, y, z):
        total = 0.0
        for p in self.pheromone_traces:
            d = math.sqrt((x - p["x"])**2 + (y - p["y"])**2 + (z - p["z"])**2)
            if d < 18.0:
                total += p["amount"] * (1.0 - d / 18.0)
        return min(1.0, total)

    def emit_song_3d(self, x, y, z, intensity=0.9):
        self.acoustic_waves_3d.append({
            "x": float(x),
            "y": float(y),
            "z": float(z),
            "radius": 2.0,
            "max_radius": 32.0,
            "intensity": float(intensity),
            "life": 16
        })

    def get_acoustic_song_3d(self, x, y, z):
        max_int = 0.0
        for w in self.acoustic_waves_3d:
            d = math.sqrt((x - w["x"])**2 + (y - w["y"])**2 + (z - w["z"])**2)
            if abs(d - w["radius"]) < 6.0:
                max_int = max(max_int, w["intensity"])
        return max_int

    def resolve_hitbox_collisions(self, flies):
        """
        Calculates physical 3D hitbox collisions between flies and obstacles.
        Hitbox: 3D bounding capsule with radius ~1.8mm.
        """
        hitbox_r = 1.8
        min_sep = hitbox_r * 2.0

        # Fly-Fly Collisions
        for i in range(len(flies)):
            f1 = flies[i]
            for j in range(i + 1, len(flies)):
                f2 = flies[j]
                dx = f2.x - f1.x
                dy = f2.y - f1.y
                dz = f2.z - f1.z
                dist = math.sqrt(dx*dx + dy*dy + dz*dz)
                if dist < min_sep and dist > 0.001:
                    # Overlap detected: displace each fly along collision normal
                    overlap = min_sep - dist
                    nx, ny, nz = dx / dist, dy / dist, dz / dist
                    half_overlap = overlap * 0.5
                    f1.x -= nx * half_overlap
                    f1.y -= ny * half_overlap
                    f1.z -= nz * half_overlap
                    f2.x += nx * half_overlap
                    f2.y += ny * half_overlap
                    f2.z += nz * half_overlap
                    
                    # Elastic momentum transfer
                    rel_vx = f1.vx - f2.vx
                    rel_vy = f1.vy - f2.vy
                    rel_vz = f1.vz - f2.vz
                    dot = rel_vx * nx + rel_vy * ny + rel_vz * nz
                    if dot > 0:
                        f1.vx -= dot * nx * 0.5
                        f1.vy -= dot * ny * 0.5
                        f1.vz -= dot * nz * 0.5
                        f2.vx += dot * nx * 0.5
                        f2.vy += dot * ny * 0.5
                        f2.vz += dot * nz * 0.5

        # Fly-Perch Cylinder Collisions
        perch = self.objects[0] # central climbing branch
        px, py = perch["x"], perch["y"]
        pr = perch["radius"]
        ph = perch["height"]

        for f in flies:
            dx = f.x - px
            dy = f.y - py
            dist_xy = math.hypot(dx, dy)
            if dist_xy < (pr + hitbox_r) and 0 <= f.z <= (ph + hitbox_r):
                # Repel outwards horizontally or land on perch
                if dist_xy > 0.001:
                    norm_x = dx / dist_xy
                    norm_y = dy / dist_xy
                    f.x = px + norm_x * (pr + hitbox_r)
                    f.y = py + norm_y * (pr + hitbox_r)
                    f.vx = 0.0
                    f.vy = 0.0

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
            
        push_dx = target.x - aggressor.x
        push_dy = target.y - aggressor.y
        push_dz = target.z - aggressor.z
        norm = math.sqrt(push_dx*push_dx + push_dy*push_dy + push_dz*push_dz) + 0.001
        target.vx += (push_dx / norm) * 35.0
        target.vy += (push_dy / norm) * 35.0
        target.vz += (push_dz / norm) * 15.0
        target.brain.firing_rates[target.brain.pop_idx["DN_ESCAPE"]] = 0.85
        aggressor.fights_won += 1
        
        pair_key = f"{min(aggressor.id, target.id)}-{max(aggressor.id, target.id)}"
        self.interaction_matrix[pair_key] = self.interaction_matrix.get(pair_key, 0) + 1

    def step(self, dt_sec=0.016):
        """Simulates 3D environmental dynamics."""
        alive_p = []
        for p in self.pheromone_traces:
            p["life"] -= 1
            p["amount"] *= 0.985
            if p["life"] > 0:
                alive_p.append(p)
        self.pheromone_traces = alive_p[-120:]
        
        alive_w = []
        for w in self.acoustic_waves_3d:
            w["radius"] += 45.0 * dt_sec
            w["life"] -= 1
            w["intensity"] *= 0.90
            if w["life"] > 0 and w["radius"] < w["max_radius"]:
                alive_w.append(w)
        self.acoustic_waves_3d = alive_w

    def to_dict(self):
        """Serializes 3D environment for Three.js rendering."""
        return {
            "width": self.width,
            "depth": self.depth,
            "height": self.height,
            "objects": self.objects,
            "food_patches": [
                {
                    "id": fp["id"],
                    "x": round(fp["x"], 1), "y": round(fp["y"], 1), "z": round(fp["z"], 1),
                    "radius": fp["radius"], "height": fp["height"],
                    "amount": round(fp["amount"], 1),
                    "type": fp["type"],
                    "label": fp["label"]
                }
                for fp in self.food_patches
            ],
            "acoustic_waves": [
                {"x": round(w["x"], 1), "y": round(w["y"], 1), "z": round(w["z"], 1), "radius": round(w["radius"], 1), "intensity": round(w["intensity"], 2)}
                for w in self.acoustic_waves_3d
            ],
            "recent_events": self.events[-12:],
            "total_courtships": len(self.courtship_events),
            "total_fights": len(self.fight_events),
            "interaction_pairs": self.interaction_matrix
        }
