import math
import random
import numpy as np
from src.connectome_brain import ConnectomeBrain

class FruitFlyAgent:
    """
    3D Articulated Drosophila melanogaster Agent.
    Simulates:
    - 3D physical kinematics (walking on ground/perches, taking off into 3D flight, banking turns).
    - 3D articulated body state: head, compound eyes, antennae, 6 legs (tripod gait), wings, proboscis.
    - Closed-loop Connectome Brain integration.
    - Dopamine Reward System: Ingesting sugar/banana stimulates the PAM dopaminergic cluster.
    """

    ARCHETYPES = {
        "Romeo": {
            "name": "Romeo",
            "gender": "male",
            "color": "#ff3366",  # vibrant rose
            "description": "Hyper-romantic courtier. High fruitless & dopamine; pursues flies and sings relentlessly.",
            "personality": {"dopamine": 0.85, "octopamine": 0.25, "serotonin": 0.5, "fruitless": 0.95, "fear": 0.2, "hunger": 0.3}
        },
        "Brawler": {
            "name": "Brawler",
            "gender": "male",
            "color": "#ff5500",  # blazing amber-red
            "description": "Territorial gladiator. High octopamine; violently lunges at male cVA pheromones.",
            "personality": {"dopamine": 0.6, "octopamine": 0.95, "serotonin": 0.15, "fruitless": 0.35, "fear": 0.1, "hunger": 0.4}
        },
        "Glutton": {
            "name": "Glutton",
            "gender": "male",
            "color": "#ffcc00",  # honey gold
            "description": "Voracious forager. High hunger & appetitive MBON; tracks banana/sugar for dopamine.",
            "personality": {"dopamine": 0.65, "octopamine": 0.4, "serotonin": 0.45, "fruitless": 0.15, "fear": 0.25, "hunger": 0.95}
        },
        "Skittish": {
            "name": "Skittish",
            "gender": "male",
            "color": "#00d2ff",  # electric cyan
            "description": "Neurotic jitterbug. Hyper-sensitive LC4 looming detection; easily startled into 3D flight.",
            "personality": {"dopamine": 0.4, "octopamine": 0.2, "serotonin": 0.7, "fruitless": 0.2, "fear": 0.95, "hunger": 0.4}
        },
        "Zen": {
            "name": "Zen",
            "gender": "male",
            "color": "#00e676",  # emerald green
            "description": "Harmonious observer. High serotonin; peaceful social tolerance, frequent grooming.",
            "personality": {"dopamine": 0.35, "octopamine": 0.1, "serotonin": 0.95, "fruitless": 0.3, "fear": 0.2, "hunger": 0.3}
        },
        "Cleopatra": {
            "name": "Cleopatra",
            "gender": "female",
            "color": "#b388ff",  # soft royal violet
            "description": "Selective female. Emits cuticular aphrodisiacs without cVA; evaluates male courtship songs.",
            "personality": {"dopamine": 0.5, "octopamine": 0.3, "serotonin": 0.6, "fruitless": 0.1, "fear": 0.3, "hunger": 0.5}
        },
        "Curly": {
            "name": "Curly",
            "gender": "female",
            "color": "#eab308",  # vibrant golden amber
            "description": "Curly-winged mutant female (Curly_Female.obj). Features sculpted curved wings, faceted red ommatidia, and balanced exploratory tone.",
            "personality": {"dopamine": 0.65, "octopamine": 0.35, "serotonin": 0.65, "fruitless": 0.15, "fear": 0.25, "hunger": 0.45}
        }
    }

    def __init__(self, fly_id, archetype_name="Romeo", x=100.0, y=100.0, z=0.0, heading=0.0):
        self.id = fly_id
        archetype = self.ARCHETYPES.get(archetype_name, self.ARCHETYPES["Romeo"])
        self.archetype_name = archetype_name
        self.gender = archetype["gender"]
        self.color = archetype["color"]
        self.description = archetype["description"]
        
        # 3D Spatial Position & Kinematics (in mm)
        self.x = float(x)
        self.y = float(y)
        self.z = max(1.6, float(z))
        self.vx = 0.0
        self.vy = 0.0
        self.vz = 0.0
        self.speed = 0.0
        
        # 3D Orientation (radians)
        self.heading = float(heading)  # yaw (around Z)
        self.pitch = 0.0               # pitch (around Y)
        self.roll = 0.0                # roll (around X, banks in flight)
        self.angular_velocity = 0.0
        
        # Physical Body Dimensions (~2.5mm Drosophila melanogaster)
        self.body_length = 3.2  # mm
        self.body_width = 1.5   # mm
        self.body_height = 1.2  # mm
        
        # Locomotion State
        self.is_airborne = False
        self.flight_timer = 0
        self.tripod_phase = random.uniform(0, 2 * math.pi)
        self.wing_stroke_phase = 0.0
        
        # 3D Hitbox Dimensions (mm)
        self.hitbox_radius = 1.8
        self.hitbox_length = 3.6
        
        # Articulated Appendages
        self.wing_left_angle = 12.0    # resting angle ~12 deg
        self.wing_right_angle = 12.0
        self.haltere_phase = 0.0       # gyroscopic haltere oscillation
        self.is_singing = False
        self.singing_wing = "right"
        self.song_pulse_timer = 0
        self.proboscis_extended = 0.0  # 0.0 to 1.0

        
        # Behavioral Action Flags
        self.is_lunging = False
        self.lunge_timer = 0
        self.is_escaping = False
        self.escape_timer = 0
        self.last_action_tag = "walking"
        
        # Metabolic & Dopamine State
        self.satiety = 0.6             # 0.0 (starving) to 1.0 (full)
        self.dopamine_level = float(archetype["personality"].get("dopamine", 0.5))
        self.dopamine_surge_active = False
        self.dopamine_surge_timer = 0
        self.food_eaten_total = 0.0
        
        # Connectome Neural Controller
        self.brain = ConnectomeBrain(personality=archetype["personality"].copy())
        
        # Social Interaction Counters
        self.courtship_bouts = 0
        self.fights_initiated = 0
        self.fights_won = 0
        self.current_target_id = None

    def trigger_flight(self, altitude_target=50.0):
        """Forces the fly to launch into 3D flight toward altitude_target."""
        self.is_airborne = True
        self.flight_timer = random.randint(80, 160) # airborne for 2-3 seconds
        self.vz = max(18.0, (altitude_target - self.z) * 0.8)
        self.last_action_tag = "flying"
        self.brain.last_thought = f"Flight motor initiated! Lift generated -> Climbing to {altitude_target:.0f}mm."

    def stimulate_neuropil(self, pop_name, intensity=2.5, duration_ms=350):
        """Optogenetic current injection into specific connectome population."""
        self.brain.inject_optogenetic_stimulus(pop_name, intensity, duration_ms)

    def update_sensors_and_brain(self, env, other_flies, dt_sec=0.016):

        """Calculates 3D sensory receptive fields and executes the connectome brain."""
        # 1. 3D Nearest Fly Detection
        nearest_fly = None
        min_dist = 999.0
        rel_angle = 0.0
        loom_speed = 0.0
        
        for other in other_flies:
            if other.id == self.id:
                continue
            dx = other.x - self.x
            dy = other.y - self.y
            dz = other.z - self.z
            dist = math.sqrt(dx*dx + dy*dy + dz*dz)
            if dist < min_dist:
                min_dist = dist
                nearest_fly = other
                # Relative azimuth angle
                abs_angle = math.atan2(dy, dx)
                rel_angle = (abs_angle - self.heading + math.pi) % (2 * math.pi) - math.pi
                
                # Approaching loom velocity
                rel_vx = other.vx - self.vx
                rel_vy = other.vy - self.vy
                rel_vz = other.vz - self.vz
                loom_speed = - (rel_vx * (dx / dist) + rel_vy * (dy / dist) + rel_vz * (dz / dist))
                
        # 2. 3D Olfactory: Food Odors & cVA Pheromone
        food_odor = env.get_food_odor_3d(self.x, self.y, self.z)
        cva_odor = env.get_pheromone_cva_3d(self.x, self.y, self.z)
        food_dist, nearest_food_patch, food_grad = env.get_nearest_food_3d(self.x, self.y, self.z)
        
        # 3. Contact Chemoreception (Foreleg Tapping)
        chemo_tap = 0.0
        tap_gender = None
        if nearest_fly and min_dist < 4.2:
            chemo_tap = 1.0
            tap_gender = nearest_fly.gender
            self.current_target_id = nearest_fly.id
        else:
            self.current_target_id = nearest_fly.id if nearest_fly and min_dist < 30.0 else None

        # 4. 3D Auditory Detection (Near-field acoustic song)
        auditory_song = env.get_acoustic_song_3d(self.x, self.y, self.z)
        
        # 5. Build sensory input dictionary
        sensory = {
            "visual_fly_dist": min_dist,
            "visual_fly_angle": rel_angle,
            "visual_loom_speed": max(0.0, loom_speed),
            "visual_food_dist": food_dist,
            "olfactory_cva": cva_odor,
            "olfactory_food": food_odor,
            "chemo_tap_pheromones": chemo_tap,
            "chemo_tap_gender": tap_gender,
            "auditory_song_intensity": auditory_song
        }
        
        # 6. Execute Connectome Brain
        motor_commands = self.brain.step(sensory, dt_sec=dt_sec)
        
        # 7. Update Central Complex Compass
        self.brain.update_compass(self.heading, self.angular_velocity, dt_sec)
        
        return motor_commands, nearest_fly, min_dist, rel_angle, food_dist, food_grad

    def apply_physics(self, motor_commands, nearest_fly, min_dist, rel_angle, food_dist, food_grad, env, dt_sec=0.016):
        """
        Translates descending neural commands into 3D body kinematics, flight transitions,
        wing articulations, and dopamine reward feeding.
        """
        # Decay active dopamine surge visual timer
        if self.dopamine_surge_active:
            self.dopamine_surge_timer -= 1
            if self.dopamine_surge_timer <= 0:
                self.dopamine_surge_active = False

        # A. Emergency Escape (Giant Fiber Activation -> 3D Takeoff)
        if motor_commands["escape"] > 0.22 or self.is_escaping:
            if not self.is_escaping:
                self.is_escaping = True
                self.is_airborne = True
                self.escape_timer = 24  # ~350ms burst
                self.flight_timer = 50   # stay airborne for a few seconds
                self.heading += random.choice([-1.2, 1.2, math.pi])
                self.vz = 40.0          # rapid vertical liftoff
                
            self.escape_timer -= 1
            escape_speed = 65.0
            self.vx = math.cos(self.heading) * escape_speed
            self.vy = math.sin(self.heading) * escape_speed
            self.last_action_tag = "escaping"
            if self.escape_timer <= 0:
                self.is_escaping = False
                
        # B. Aggressive Lunge (DNg02 Strike)
        elif motor_commands["lunge"] > 0.20 or self.is_lunging:
            if not self.is_lunging:
                self.is_lunging = True
                self.lunge_timer = 12
                self.fights_initiated += 1
                if nearest_fly:
                    self.heading += rel_angle * 0.85
                    
            self.lunge_timer -= 1
            lunge_speed = 52.0
            self.vx = math.cos(self.heading) * lunge_speed
            self.vy = math.sin(self.heading) * lunge_speed
            self.last_action_tag = "lunging"
            
            if nearest_fly and min_dist < 4.0:
                env.record_fight(self, nearest_fly)
                
            if self.lunge_timer <= 0:
                self.is_lunging = False
                
        # C. Courtship Pursuit & Wing Vibration Song (P1 & DNpe008)
        elif motor_commands["song"] > 0.18:
            self.is_singing = True
            self.song_pulse_timer += 1
            self.last_action_tag = "courting"
            
            # Unilateral wing extension to 85-90 degrees
            if rel_angle > 0:
                self.singing_wing = "left"
                self.wing_left_angle = 88.0 + 6.0 * math.sin(self.song_pulse_timer * 1.1)
                self.wing_right_angle = 12.0
            else:
                self.singing_wing = "right"
                self.wing_right_angle = 88.0 + 6.0 * math.sin(self.song_pulse_timer * 1.1)
                self.wing_left_angle = 12.0
                
            env.emit_song_3d(self.x, self.y, self.z, intensity=0.9)
            
            if nearest_fly:
                turn_rate = np.clip(rel_angle * 4.0, -5.5, 5.5)
                self.heading += turn_rate * dt_sec
                # Maintain courtship distance
                if min_dist > 6.0:
                    approach_speed = 18.0
                    self.vx = math.cos(self.heading) * approach_speed
                    self.vy = math.sin(self.heading) * approach_speed
                else:
                    self.vx *= 0.65
                    self.vy *= 0.65
                    
            if nearest_fly and min_dist < 5.0 and random.random() < 0.05:
                env.record_courtship(self, nearest_fly)
                self.courtship_bouts += 1

        # D. Feeding & DOPAMINE REWARD Surge (DN_FEED & MB_DAN Activation)
        elif motor_commands["feed"] > 0.20 and food_dist < 14.0:
            self.proboscis_extended = min(1.0, self.proboscis_extended + 0.2)
            self.vx *= 0.4
            self.vy *= 0.4
            self.vz *= 0.4
            self.last_action_tag = "feeding"
            
            # Consume food in 3D and receive Dopamine reward
            eaten, dopamine_surge, food_label = env.consume_food_3d(self.x, self.y, self.z, max_intake=0.035)
            if eaten > 0:
                self.food_eaten_total += eaten
                self.satiety = min(1.0, self.satiety + eaten * 0.8)
                
                # INJECT DOPAMINE INTO BRAIN:
                # Elevates dopamine level, stimulating PAM dopaminergic cluster (MB_DAN)
                self.dopamine_level = min(1.0, self.dopamine_level + dopamine_surge)
                self.brain.personality["dopamine"] = self.dopamine_level
                self.brain.firing_rates[self.brain.pop_idx["MB_DAN"]] = 0.95
                
                # Visual Dopamine Surge flag
                self.dopamine_surge_active = True
                self.dopamine_surge_timer = 20  # ~300ms visual particle duration
                
                # Update Fly Mind thought
                self.brain.last_thought = f"Yeast/sugar ({food_label}) consumed! Dopamine surge (+{dopamine_surge:.2f})! PAM cluster radiating reward."

        # E. 3D Locomotion (Walking on surfaces vs 3D Flight)
        else:
            self.is_singing = False
            self.wing_left_angle = 12.0
            self.wing_right_angle = 12.0
            self.proboscis_extended = max(0.0, self.proboscis_extended - 0.1)
            
            # Flight mode management
            if self.is_airborne:
                self.flight_timer -= 1
                self.last_action_tag = "flying"
                self.wing_stroke_phase = (self.wing_stroke_phase + dt_sec * 45.0) % (2 * math.pi)
                
                # Steer toward food or explore
                turn_noise = random.gauss(0, 0.3)
                if food_grad and self.brain.personality["hunger"] > 0.35:
                    target_yaw = math.atan2(food_grad[1], food_grad[0])
                    steer_diff = (target_yaw - self.heading + math.pi) % (2 * math.pi) - math.pi
                    self.angular_velocity = steer_diff * 2.0 + turn_noise
                    # Adjust altitude toward food Z
                    self.vz = food_grad[2] * 18.0
                else:
                    self.angular_velocity = (motor_commands["turn_bias"] - 0.5) * 4.5 + turn_noise
                    self.vz += random.uniform(-2.0, 1.8)
                    
                self.heading += self.angular_velocity * dt_sec
                flight_speed = 32.0 * (0.6 + 0.8 * self.dopamine_level)  # dopamine increases flight vigor
                target_vx = math.cos(self.heading) * flight_speed
                target_vy = math.sin(self.heading) * flight_speed
                accel = min(1.0, 14.0 * dt_sec)
                self.vx += (target_vx - self.vx) * accel
                self.vy += (target_vy - self.vy) * accel
                
                # Banking roll angle proportional to turn
                self.roll = np.clip(self.angular_velocity * 0.15, -0.45, 0.45)
                self.pitch = np.clip(-self.vz * 0.02, -0.35, 0.35)
                
                # Land if flight timer expires and near ground or perch
                if self.flight_timer <= 0 and self.z < 6.0:
                    self.is_airborne = False
                    self.z = 1.6
                    self.vz = 0.0
                    self.roll = 0.0
                    self.pitch = 0.0
            else:
                # Walking Mode on Ground or Perch (Strict minimum clearance Z >= 1.6mm)
                self.last_action_tag = "walking"
                self.roll = 0.0
                self.pitch = 0.0
                if self.z < 1.6:
                    self.z = 1.6
                self.vz = 0.0
                
                # Occasional spontaneous takeoff if dopamine (arousal) is high
                if random.random() < (0.008 * self.dopamine_level):
                    self.is_airborne = True
                    self.flight_timer = random.randint(35, 80)
                    self.vz = 22.0
                    
                turn_noise = random.gauss(0, 0.35)
                if food_grad and self.brain.personality["hunger"] > 0.4:
                    target_yaw = math.atan2(food_grad[1], food_grad[0])
                    steer_diff = (target_yaw - self.heading + math.pi) % (2 * math.pi) - math.pi
                    self.angular_velocity = steer_diff * 1.8 + turn_noise
                else:
                    self.angular_velocity = (motor_commands["turn_bias"] - 0.5) * 4.0 + turn_noise
                    
                self.heading += self.angular_velocity * dt_sec
                walk_speed = motor_commands["walk"] * 24.0 * (0.7 + 0.6 * self.dopamine_level)
                target_vx = math.cos(self.heading) * walk_speed
                target_vy = math.sin(self.heading) * walk_speed
                accel = min(1.0, 16.0 * dt_sec)
                self.vx += (target_vx - self.vx) * accel
                self.vy += (target_vy - self.vy) * accel
                
                # Tripod Leg Animation
                if math.hypot(self.vx, self.vy) > 1.0:
                    self.tripod_phase = (self.tripod_phase + walk_speed * dt_sec * 4.5) % (2 * math.pi)

        # Update 3D Coordinates
        self.x += self.vx * dt_sec
        self.y += self.vy * dt_sec
        self.z += self.vz * dt_sec
        self.speed = math.sqrt(self.vx*self.vx + self.vy*self.vy + self.vz*self.vz)
        
        # 3D Terrarium Boundary Constraints
        margin = 4.0
        # X walls
        if self.x < margin:
            self.x = margin
            self.vx = abs(self.vx) * 0.6
            self.heading = math.atan2(self.vy, self.vx) + random.uniform(-0.2, 0.2)
        elif self.x > env.width - margin:
            self.x = env.width - margin
            self.vx = -abs(self.vx) * 0.6
            self.heading = math.atan2(self.vy, self.vx) + random.uniform(-0.2, 0.2)
            
        # Y walls
        if self.y < margin:
            self.y = margin
            self.vy = abs(self.vy) * 0.6
            self.heading = math.atan2(self.vy, self.vx) + random.uniform(-0.2, 0.2)
        elif self.y > env.depth - margin:
            self.y = env.depth - margin
            self.vy = -abs(self.vy) * 0.6
            self.heading = math.atan2(self.vy, self.vx) + random.uniform(-0.2, 0.2)
            
        # Floor & Ceiling (Z): Ground clearance anchored at Z >= 1.6mm
        if self.z < 1.6:
            self.z = 1.6
            self.vz = 0.0
            if self.is_airborne and self.flight_timer <= 0:
                self.is_airborne = False
        elif self.z > env.height - margin:
            self.z = env.height - margin
            self.vz = -abs(self.vz) * 0.5
            
        # Deposit cVA pheromone on ground/perches if male
        if self.gender == "male" and not self.is_airborne:
            env.deposit_cva_3d(self.x, self.y, self.z, amount=0.08)
            
        # Metabolic decay
        self.satiety = max(0.05, self.satiety - 0.00025)
        self.brain.personality["hunger"] = max(0.05, 1.0 - self.satiety)

    def to_dict(self):
        """Serializes 3D fly state for Three.js network rendering."""
        return {
            "id": self.id,
            "archetype": self.archetype_name,
            "gender": self.gender,
            "color": self.color,
            "x": round(self.x, 2),
            "y": round(self.y, 2),
            "z": round(max(1.6, self.z), 2),
            "vx": round(self.vx, 2),
            "vy": round(self.vy, 2),
            "vz": round(self.vz, 2),
            "heading": round(self.heading, 3),
            "pitch": round(self.pitch, 3),
            "roll": round(self.roll, 3),
            "speed": round(self.speed, 2),
            "hitbox": {"radius": self.hitbox_radius, "length": self.hitbox_length},
            "is_airborne": self.is_airborne,

            "action": self.last_action_tag,
            "is_singing": self.is_singing,
            "singing_wing": self.singing_wing,
            "wing_left_angle": round(self.wing_left_angle, 1),
            "wing_right_angle": round(self.wing_right_angle, 1),
            "wing_stroke_phase": round(self.wing_stroke_phase, 2),
            "tripod_phase": round(self.tripod_phase, 2),
            "proboscis": round(self.proboscis_extended, 2),
            "satiety": round(self.satiety, 2),
            "dopamine": round(self.dopamine_level, 2),
            "dopamine_surge": self.dopamine_surge_active,
            "target_id": self.current_target_id,
            "telemetry": self.brain.get_telemetry()
        }
