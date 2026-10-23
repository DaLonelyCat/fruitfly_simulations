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
        
        # 3D Naturalistic Vivarium Food Patches (Rotting Fig, Bruised Grapes, Banana, Sugar)
        self.food_patches = [
            {
                "id": 1,
                "x": 60.0, "y": 60.0, "z": 0.0,
                "vz": 0.0, "settled": True,
                "radius": 12.0, "height": 3.5,
                "amount": 100.0,
                "sugar_quality": 1.0,
                "type": "banana_slice",
                "label": "Ripe Banana Slice"
            },
            {
                "id": 2,
                "x": 150.0, "y": 60.0, "z": 22.0,  # on the elevated platform
                "vz": 0.0, "settled": True,
                "radius": 13.0, "height": 7.0,
                "amount": 110.0,
                "sugar_quality": 1.25,  # rich fermenting fig with seeds
                "type": "rotting_fig",
                "label": "Fermenting Rotting Fig"
            },
            {
                "id": 3,
                "x": 140.0, "y": 150.0, "z": 0.0,
                "vz": 0.0, "settled": True,
                "radius": 10.0, "height": 6.0,
                "amount": 95.0,
                "sugar_quality": 1.15,
                "type": "bruised_grapes",
                "label": "Bruised Vineyard Grapes"
            },
            {
                "id": 4,
                "x": 160.0, "y": 140.0, "z": 0.0,
                "vz": 0.0, "settled": True,
                "radius": 8.0, "height": 8.0,
                "amount": 90.0,
                "sugar_quality": 1.3,
                "type": "sugar_cube",
                "label": "Crystalline Sugar Cube"
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

        # Drought & Carrying Capacity Tracker
        self.drought_timer = 0.0

        # Kinetic Fly Playground: Functional Running Wheel & Swaying Moss Swing
        self.running_wheel = {
            "x": 45.0, "y": 140.0, "z": 1.6,
            "radius": 12.0, "width": 8.0,
            "angle": 0.0, "angular_vel": 0.0
        }
        self.hanging_swing = {
            "anchor_x": 110.0, "anchor_y": 95.0, "anchor_z": 46.5,
            "length": 22.0,
            "angle_x": 0.0, "angle_y": 0.0,
            "vel_x": 0.0, "vel_y": 0.0
        }

        # Spotify TV Lounge & Armchairs
        self.tv = {
            "x": 75.0, "y": 24.0, "z": 0.0,
            "width": 14.0, "height": 11.0, "depth": 7.0,
            "channel": "Spotify Chill Beats",
            "is_on": True
        }
        self.lounge_chairs = [
            {"id": "chair_left", "x": 65.0, "y": 42.0, "z": 0.0, "seat_z": 2.2, "target_yaw": -1.0637, "occupied_by": None},
            {"id": "chair_center", "x": 75.0, "y": 44.0, "z": 0.0, "seat_z": 2.2, "target_yaw": -1.5708, "occupied_by": None},
            {"id": "chair_right", "x": 85.0, "y": 42.0, "z": 0.0, "seat_z": 2.2, "target_yaw": -2.0779, "occupied_by": None}
        ]

    @property
    def is_drought(self):
        return len(self.food_patches) == 0

    def add_food_patch_3d(self, x, y, z=None, food_type="banana_slice", amount=90.0):
        new_id = max([fp["id"] for fp in self.food_patches], default=0) + 1
        if food_type == "sugar_cube":
            sugar_val, h, r, label = 1.3, 8.0, 8.0, "Crystalline Sugar Cube"
        elif food_type == "rotting_fig":
            sugar_val, h, r, label = 1.25, 7.0, 13.0, "Fermenting Rotting Fig"
        elif food_type == "bruised_grapes":
            sugar_val, h, r, label = 1.15, 6.0, 10.0, "Bruised Vineyard Grapes"
        elif food_type == "yeast_agar":
            sugar_val, h, r, label = 0.9, 2.5, 10.0, "Fermenting Yeast Drop"
        else: # banana_slice
            sugar_val, h, r, label = 1.0, 3.5, 12.0, "Ripe Banana Slice"

        drop_z = float(z) if (z is not None and float(z) > 10.0) else 65.0
        self.food_patches.append({
            "id": new_id,
            "x": float(x),
            "y": float(y),
            "z": drop_z,
            "vz": 0.0,
            "settled": False,
            "radius": r,
            "height": h,
            "amount": float(amount),
            "sugar_quality": sugar_val,
            "type": food_type,
            "label": label
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

    def consume_food_3d(self, x, y, z, max_intake=0.15):
        """Consumes food in 3D contact and computes the DOPAMINE REWARD."""
        for fp in self.food_patches:
            if fp["amount"] <= 0:
                continue
            dx = x - fp["x"]
            dy = y - fp["y"]
            dz = z - fp["z"]
            dist_xy = math.hypot(dx, dy)
            reach_r = fp["radius"] + 5.0
            reach_h = fp["height"] + 4.0
            if dist_xy <= reach_r and abs(dz) <= reach_h:
                eaten = min(fp["amount"], max_intake)
                fp["amount"] -= eaten
                dopamine_surge = min(1.0, eaten * fp["sugar_quality"] * 3.5)
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
        Calculates physical 3D hitbox collisions between flies, obstacles, ground, and food.
        Hitbox: 3D bounding volume with radius ~1.8mm.
        Enforces strict non-clipping ground clearance (Z >= 1.6mm) and obstacle perching.
        """
        hitbox_r = 1.8
        min_sep = hitbox_r * 2.0
        ground_z = 1.6  # baseline where fly tarsi/feet make contact with ground at Z=0

        # 1. Fly-to-Ground Anti-Clipping
        for f in flies:
            if f.z < ground_z:
                f.z = ground_z
                if f.vz < 0.0:
                    f.vz = 0.0
                if not f.is_airborne:
                    f.pitch = 0.0
                    f.roll = 0.0

        # 2. Fly-Fly Collisions (Repulsion + Elastic Impulse)
        for i in range(len(flies)):
            f1 = flies[i]
            for j in range(i + 1, len(flies)):
                f2 = flies[j]
                dx = f2.x - f1.x
                dy = f2.y - f1.y
                dz = f2.z - f1.z
                dist = math.sqrt(dx*dx + dy*dy + dz*dz)
                if dist < min_sep and dist > 0.001:
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

        # 3. Feeding Rock Collision (Pedestal: x=150, y=60, radius=15.5, height=22.0)
        rock = self.objects[2]
        rx, ry, rr, rh = rock["x"], rock["y"], rock["radius"], rock["height"]
        rock_top_z = rh + ground_z

        for f in flies:
            dx = f.x - rx
            dy = f.y - ry
            dist_xy = math.hypot(dx, dy)
            if dist_xy < (rr + hitbox_r):
                if f.z >= (rh - 1.2):
                    # Fly is standing/landing on top of the rock
                    if f.z < rock_top_z:
                        f.z = rock_top_z
                        if f.vz < 0.0:
                            f.vz = 0.0
                        if not f.is_airborne:
                            f.pitch = 0.0
                            f.roll = 0.0
                else:
                    # Fly is walking into the rock from the side: push outward horizontally
                    if dist_xy > 0.001:
                        nx = dx / dist_xy
                        ny = dy / dist_xy
                        f.x = rx + nx * (rr + hitbox_r)
                        f.y = ry + ny * (rr + hitbox_r)
                        dot = f.vx * nx + f.vy * ny
                        if dot < 0.0:
                            f.vx -= dot * nx
                            f.vy -= dot * ny

        # 4. Climbing Perch Cylinder Collisions
        perch = self.objects[0]
        px, py, pr, ph = perch["x"], perch["y"], perch["radius"], perch["height"]
        for f in flies:
            dx = f.x - px
            dy = f.y - py
            dist_xy = math.hypot(dx, dy)
            if dist_xy < (pr + hitbox_r) and 0 <= f.z <= (ph + hitbox_r):
                if dist_xy > 0.001:
                    norm_x = dx / dist_xy
                    norm_y = dy / dist_xy
                    f.x = px + norm_x * (pr + hitbox_r)
                    f.y = py + norm_y * (pr + hitbox_r)
                    f.vx = 0.0
                    f.vy = 0.0

        # 5. Food Patch Hitbox Collisions (Prevent sinking into food, allow perching on top)
        for fp in self.food_patches:
            if fp["amount"] <= 0:
                continue
            fx, fy, fz, fr, fh = fp["x"], fp["y"], fp["z"], fp["radius"], fp["height"]
            food_top_z = fz + fh + ground_z

            for f in flies:
                dx = f.x - fx
                dy = f.y - fy
                dist_xy = math.hypot(dx, dy)
                if dist_xy < (fr + hitbox_r):
                    if f.z >= (fz + fh - 1.2):
                        # Fly perches on top of the food item
                        if f.z < food_top_z:
                            f.z = food_top_z
                            if f.vz < 0.0:
                                f.vz = 0.0
                    elif f.z < (fz + fh) and f.z >= fz:
                        # Walking into the food from the side: push outside food radius
                        if dist_xy > 0.001:
                            nx = dx / dist_xy
                            ny = dy / dist_xy
                            f.x = fx + nx * (fr + hitbox_r)
                            f.y = fy + ny * (fr + hitbox_r)
                            dot = f.vx * nx + f.vy * ny
                            if dot < 0.0:
                                f.vx -= dot * nx
                                f.vy -= dot * ny

        # 6. Hanging Moss Swing Perch Hitbox (Allows flies to land on moss seat at Z ≈ 26mm)
        if hasattr(self, 'hanging_swing'):
            sw = self.hanging_swing
            sw_x = sw["anchor_x"] + sw["length"] * math.sin(sw["angle_x"])
            sw_y = sw["anchor_y"] + sw["length"] * math.sin(sw["angle_y"])
            sw_z = sw["anchor_z"] - sw["length"] * math.cos(sw["angle_x"])
            seat_top_z = sw_z + 1.6
            seat_r = 5.0
            
            for f in flies:
                if getattr(f, 'is_perched_on_swing', False):
                    continue
                dx = f.x - sw_x
                dy = f.y - sw_y
                dist_xy = math.hypot(dx, dy)
                if dist_xy < (seat_r + hitbox_r) and abs(f.z - sw_z) < 3.0:
                    if f.vz <= 0.0:
                        f.z = seat_top_z
                        f.vz = 0.0
                        f.is_airborne = False
                        f.is_perched_on_swing = True
                        f.last_action_tag = "swinging"

        # 7. Final Ground Clamp & Bound Enforcement
        for f in flies:
            if getattr(f, 'is_perched_on_swing', False):
                continue
            if f.z < ground_z:
                f.z = ground_z
                if f.vz < 0.0:
                    f.vz = 0.0
                if not f.is_airborne:
                    f.pitch = 0.0
                    f.roll = 0.0

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

        # Mood and Dominance Shift from Combat (No mortal damage)
        if hasattr(target, 'mood'):
            target.mood = max(0.10, target.mood - 0.06)
        if hasattr(aggressor, 'mood'):
            aggressor.mood = min(1.0, aggressor.mood + 0.05)  # Dominance boost
        
        pair_key = f"{min(aggressor.id, target.id)}-{max(aggressor.id, target.id)}"
        self.interaction_matrix[pair_key] = self.interaction_matrix.get(pair_key, 0) + 1

    def record_dopamine_surge(self, fly, food_label="fruit"):
        """Records a successful feeding dopamine reward event."""
        event = {
            "type": "dopamine_surge",
            "fly_id": fly.id,
            "fly_name": fly.archetype_name,
            "food_label": food_label,
            "timestamp_step": len(self.events)
        }
        self.events.append(event)
        self.dopamine_events.append(event)
        if len(self.dopamine_events) > 100:
            self.dopamine_events.pop(0)

    def step(self, dt_sec=0.016, dt=None):
        """Simulates 3D environmental dynamics including food dropping physics."""
        if dt is not None:
            dt_sec = dt
        # 1. Pheromone decay
        alive_p = []
        for p in self.pheromone_traces:
            p["life"] -= 1
            p["amount"] *= 0.985
            if p["life"] > 0:
                alive_p.append(p)
        self.pheromone_traces = alive_p[-120:]
        
        # 2. Acoustic wave propagation
        alive_w = []
        for w in self.acoustic_waves_3d:
            w["radius"] += 45.0 * dt_sec
            w["life"] -= 1
            w["intensity"] *= 0.90
            if w["life"] > 0 and w["radius"] < w["max_radius"]:
                alive_w.append(w)
        self.acoustic_waves_3d = alive_w

        # 3. Food Dropping Physics (Gravity, Rock landing, and Restitution Bounce)
        g = 420.0  # gravity in mm/s^2
        rock = self.objects[2]  # Elevated feeding rock pedestal
        rx, ry, rr, rh = rock["x"], rock["y"], rock["radius"], rock["height"]

        for fp in self.food_patches:
            if not fp.get("settled", True):
                fp["vz"] = fp.get("vz", 0.0) - g * dt_sec
                fp["z"] += fp["vz"] * dt_sec

                # Check if landing on rock platform vs ground
                dist_rock = math.hypot(fp["x"] - rx, fp["y"] - ry)
                target_floor = rh if dist_rock <= (rr + fp["radius"] * 0.4) else 0.0

                if fp["z"] <= target_floor:
                    fp["z"] = target_floor
                    if abs(fp.get("vz", 0.0)) > 20.0:
                        # Elastic restitution bounce
                        fp["vz"] = -fp["vz"] * 0.22
                    else:
                        fp["vz"] = 0.0
                        fp["settled"] = True

        # 4. Prune completely eaten food patches (Food Depletion)
        depleted_food = [fp for fp in self.food_patches if fp.get("amount", 0.0) <= 0.05]
        if depleted_food:
            self.food_patches = [fp for fp in self.food_patches if fp.get("amount", 0.0) > 0.05]
            for dfp in depleted_food:
                self.events.append({
                    "type": "food_depleted",
                    "food_id": dfp["id"],
                    "label": dfp["label"],
                    "timestamp_step": len(self.events)
                })

        # 5. Drought detection & emergency wild drop
        if len(self.food_patches) == 0:
            self.drought_timer += dt_sec
            if self.drought_timer > 65.0:
                self.add_food_patch_3d(100.0, 100.0, z=65.0, food_type="banana_slice", amount=90.0)
                self.drought_timer = 0.0
        else:
            self.drought_timer = 0.0

        # 6. Kinetic Playground Physics (Running Wheel & Hanging Moss Swing)
        # Running Wheel rotation & inertial friction decay
        self.running_wheel["angle"] = (self.running_wheel["angle"] + self.running_wheel["angular_vel"] * dt_sec) % (2 * math.pi)
        self.running_wheel["angular_vel"] *= math.exp(-0.85 * dt_sec)
        if abs(self.running_wheel["angular_vel"]) < 0.01:
            self.running_wheel["angular_vel"] = 0.0

        # Hanging Moss Swing damped harmonic oscillator with subtle vivarium breeze
        # Sub-stepped semi-implicit Euler for rock-solid stability even under large dt_sec
        k_swing = 12.0
        damping = 1.6
        self.swing_breeze_timer = getattr(self, 'swing_breeze_timer', 0.0) + dt_sec
        breeze_x = 0.08 * math.sin(self.swing_breeze_timer * 1.4)
        breeze_y = 0.05 * math.cos(self.swing_breeze_timer * 1.1)

        sub_steps = max(1, min(25, int(math.ceil(dt_sec / 0.02))))
        sub_dt = dt_sec / sub_steps
        for _ in range(sub_steps):
            self.hanging_swing["vel_x"] += (-k_swing * self.hanging_swing["angle_x"] - damping * self.hanging_swing["vel_x"] + breeze_x) * sub_dt
            self.hanging_swing["angle_x"] += self.hanging_swing["vel_x"] * sub_dt
            self.hanging_swing["angle_x"] = max(-0.45, min(0.45, self.hanging_swing["angle_x"]))

            self.hanging_swing["vel_y"] += (-k_swing * self.hanging_swing["angle_y"] - damping * self.hanging_swing["vel_y"] + breeze_y) * sub_dt
            self.hanging_swing["angle_y"] += self.hanging_swing["vel_y"] * sub_dt
            self.hanging_swing["angle_y"] = max(-0.45, min(0.45, self.hanging_swing["angle_y"]))

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
                    "vz": round(fp.get("vz", 0.0), 1),
                    "settled": fp.get("settled", True),
                    "radius": fp["radius"], "height": fp["height"],
                    "amount": round(fp["amount"], 1),
                    "type": fp["type"],
                    "label": fp["label"]
                }
                for fp in self.food_patches
            ],
            "running_wheel": {
                "x": self.running_wheel["x"], "y": self.running_wheel["y"], "z": self.running_wheel["z"],
                "radius": self.running_wheel["radius"], "width": self.running_wheel["width"],
                "angle": round(self.running_wheel["angle"], 3),
                "angular_vel": round(self.running_wheel["angular_vel"], 2)
            },
            "hanging_swing": {
                "anchor_x": self.hanging_swing["anchor_x"], "anchor_y": self.hanging_swing["anchor_y"], "anchor_z": self.hanging_swing["anchor_z"],
                "length": self.hanging_swing["length"],
                "angle_x": round(self.hanging_swing["angle_x"], 3),
                "angle_y": round(self.hanging_swing["angle_y"], 3)
            },
            "tv": self.tv,
            "lounge_chairs": [
                {
                    "id": c["id"],
                    "x": c["x"], "y": c["y"], "z": c["z"],
                    "seat_z": c["seat_z"],
                    "target_yaw": c["target_yaw"],
                    "occupied_by": c.get("occupied_by")
                }
                for c in getattr(self, "lounge_chairs", [])
            ],
            "drought_timer": round(self.drought_timer, 1),
            "is_drought": len(self.food_patches) == 0,
            "acoustic_waves": [
                {"x": round(w["x"], 1), "y": round(w["y"], 1), "z": round(w["z"], 1), "radius": round(w["radius"], 1), "intensity": round(w["intensity"], 2)}
                for w in self.acoustic_waves_3d
            ],
            "recent_events": self.events[-12:],
            "total_courtships": len(self.courtship_events),
            "total_fights": len(self.fight_events),
            "total_dopamine_surges": len(self.dopamine_events),
            "interaction_pairs": self.interaction_matrix
        }
