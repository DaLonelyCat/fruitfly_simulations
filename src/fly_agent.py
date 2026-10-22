import math
import random
import numpy as np
from src.connectome_brain import ConnectomeBrain

class FruitFlyAgent:
    """
    Simulated Drosophila melanogaster agent powered by the ConnectomeBrain.
    Models physical biomechanics, wing articulation, tripod walking gait,
    sensory receptive fields, and social behavioral states.
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
            "description": "Voracious forager. High hunger & appetitive MBON; monopolizes yeast/banana drops.",
            "personality": {"dopamine": 0.65, "octopamine": 0.4, "serotonin": 0.45, "fruitless": 0.15, "fear": 0.25, "hunger": 0.95}
        },
        "Skittish": {
            "name": "Skittish",
            "gender": "male",
            "color": "#00ccff",  # electric cyan
            "description": "Neurotic jitterbug. Hyper-sensitive LC4 looming detection; easily startled into escape flight.",
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
        }
    }

    def __init__(self, fly_id, archetype_name="Romeo", x=150.0, y=150.0, heading=0.0):
        self.id = fly_id
        archetype = self.ARCHETYPES.get(archetype_name, self.ARCHETYPES["Romeo"])
        self.archetype_name = archetype_name
        self.gender = archetype["gender"]
        self.color = archetype["color"]
        self.description = archetype["description"]
        
        # Spatial Position & Kinematics (in mm)
        self.x = float(x)
        self.y = float(y)
        self.heading = float(heading)  # radians, 0 is rightward, counterclockwise
        self.vx = 0.0
        self.vy = 0.0
        self.speed = 0.0
        self.angular_velocity = 0.0
        
        # Physical Body Dimensions (~2.5mm length, standard adult Drosophila)
        self.body_length = 3.5  # mm in simulation coordinates
        self.body_width = 1.6   # mm
        
        # Articulated Appendages
        self.tripod_phase = random.uniform(0, 2 * math.pi)
        self.wing_left_angle = 12.0   # degrees (resting is ~10-15)
        self.wing_right_angle = 12.0
        self.is_singing = False
        self.singing_wing = "right"   # "left" or "right" unilateral extension
        self.song_pulse_timer = 0
        self.proboscis_extended = 0.0 # 0.0 to 1.0
        self.is_lunging = False
        self.lunge_timer = 0
        self.is_escaping = False
        self.escape_timer = 0
        self.is_grooming = False
        self.groom_timer = 0
        
        # Metabolic / Satiety State
        self.satiety = 0.6  # 1.0 = fully fed, 0.0 = starving
        
        # Connectome Neural Controller
        self.brain = ConnectomeBrain(personality=archetype["personality"].copy())
        
        # Social Interaction Counters
        self.courtship_bouts = 0
        self.fights_initiated = 0
        self.fights_won = 0
        self.food_eaten = 0.0
        self.current_target_id = None
        self.last_action_tag = "exploring"

    def update_sensors_and_brain(self, env, other_flies, dt_sec=0.016):
        """
        Calculates sensory receptive fields in the environment and executes the connectome brain.
        """
        # 1. Detect Nearest Fly
        nearest_fly = None
        min_dist = 999.0
        rel_angle = 0.0
        loom_speed = 0.0
        
        for other in other_flies:
            if other.id == self.id:
                continue
            dx = other.x - self.x
            dy = other.y - self.y
            dist = math.hypot(dx, dy)
            if dist < min_dist:
                min_dist = dist
                nearest_fly = other
                # Angle to other fly in self coordinate frame
                abs_angle = math.atan2(dy, dx)
                rel_angle = (abs_angle - self.heading + math.pi) % (2 * math.pi) - math.pi
                
                # Approaching loom velocity (projection of relative velocity onto distance vector)
                rel_vx = other.vx - self.vx
                rel_vy = other.vy - self.vy
                # Positive if approaching
                loom_speed = - (rel_vx * (dx / dist) + rel_vy * (dy / dist))
                
        # 2. Olfactory: Food Odors and Pheromones from Environment Grid
        food_odor = env.get_food_odor(self.x, self.y)
        cva_odor = env.get_pheromone_cva(self.x, self.y)
        food_dist = env.get_nearest_food_dist(self.x, self.y)
        
        # 3. Contact Chemoreception (Foreleg Tapping)
        # Occurs if another fly is within 4mm
        chemo_tap = 0.0
        tap_gender = None
        if nearest_fly and min_dist < 4.5:
            chemo_tap = 1.0
            tap_gender = nearest_fly.gender
            self.current_target_id = nearest_fly.id
        else:
            self.current_target_id = nearest_fly.id if nearest_fly and min_dist < 25.0 else None

        # 4. Auditory Detection (Near-field particle velocity from singing flies)
        auditory_song = env.get_acoustic_song(self.x, self.y, exclude_fly_id=self.id)
        
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
        
        # Return motor descending commands & target info
        return motor_commands, nearest_fly, min_dist, rel_angle

    def apply_physics(self, motor_commands, nearest_fly, min_dist, rel_angle, env, dt_sec=0.016):
        """
        Translates descending neural commands into body physics, leg gaits, and wing motions.
        """
        # A. Emergency Escape (Giant Fiber Activation)
        if motor_commands["escape"] > 0.22 or self.is_escaping:
            if not self.is_escaping:
                self.is_escaping = True
                self.escape_timer = 20  # ~300ms burst
                # Dart away from threat or jump forward
                self.heading += random.choice([-1.2, 1.2, math.pi])
                
            self.escape_timer -= 1
            escape_speed = 65.0  # mm/s rapid dart
            self.vx = math.cos(self.heading) * escape_speed
            self.vy = math.sin(self.heading) * escape_speed
            self.last_action_tag = "escaping"
            if self.escape_timer <= 0:
                self.is_escaping = False
                
        # B. Aggressive Lunge (DNg02 strike)
        elif motor_commands["lunge"] > 0.20 or self.is_lunging:
            if not self.is_lunging:
                self.is_lunging = True
                self.lunge_timer = 12  # ~200ms ballistic charge
                self.fights_initiated += 1
                # Aim directly at target fly
                if nearest_fly:
                    self.heading += rel_angle * 0.8
                    
            self.lunge_timer -= 1
            lunge_speed = 50.0  # mm/s high-speed ram
            self.vx = math.cos(self.heading) * lunge_speed
            self.vy = math.sin(self.heading) * lunge_speed
            self.last_action_tag = "lunging"
            
            # Strike effect on target fly
            if nearest_fly and min_dist < 4.0:
                env.record_fight(self, nearest_fly)
                
            if self.lunge_timer <= 0:
                self.is_lunging = False
                
        # C. Courtship Pursuit & Wing Vibration Song (P1 & DNpe008)
        elif motor_commands["song"] > 0.18:
            self.is_singing = True
            self.song_pulse_timer += 1
            self.last_action_tag = "courting"
            
            # Choose wing to extend based on relative angle to target
            if rel_angle > 0:
                self.singing_wing = "left"
                self.wing_left_angle = 85.0 + 8.0 * math.sin(self.song_pulse_timer * 0.9)
                self.wing_right_angle = 12.0
            else:
                self.singing_wing = "right"
                self.wing_right_angle = 85.0 + 8.0 * math.sin(self.song_pulse_timer * 0.9)
                self.wing_left_angle = 12.0
                
            # Emit acoustic near-field song pulse in environment
            env.emit_song(self.x, self.y, intensity=0.85)
            
            # Follow target fly smoothly
            if nearest_fly:
                turn_rate = np.clip(rel_angle * 3.5, -5.0, 5.0)
                self.heading += turn_rate * dt_sec
                # Maintain ~5-8mm courtship distance
                if min_dist > 6.0:
                    approach_speed = 18.0
                    self.vx = math.cos(self.heading) * approach_speed
                    self.vy = math.sin(self.heading) * approach_speed
                else:
                    self.vx *= 0.7
                    self.vy *= 0.7
                    
            if nearest_fly and min_dist < 5.0 and random.random() < 0.05:
                env.record_courtship(self, nearest_fly)
                self.courtship_bouts += 1

        # D. Feeding (DN_FEED & Proboscis Extension Reflex)
        elif motor_commands["feed"] > 0.20 and env.is_on_food(self.x, self.y):

            self.proboscis_extended = min(1.0, self.proboscis_extended + 0.15)
            self.vx *= 0.5
            self.vy *= 0.5
            self.last_action_tag = "feeding"
            # Consume food & replenish satiety
            eaten = env.consume_food(self.x, self.y, amount=0.01)
            self.food_eaten += eaten
            self.satiety = min(1.0, self.satiety + eaten * 0.5)
            # Update hunger in brain
            self.brain.personality["hunger"] = max(0.05, 1.0 - self.satiety)
            
        # E. Normal Walking / Steering / Foraging (DN_WALK & DN_TURN)
        else:
            self.is_singing = False
            self.wing_left_angle = 12.0
            self.wing_right_angle = 12.0
            self.proboscis_extended = max(0.0, self.proboscis_extended - 0.1)
            
            # Steering
            turn_noise = random.gauss(0, 0.4)
            # If food odor gradient is present, steer toward it
            food_grad_angle = env.get_food_gradient_angle(self.x, self.y)
            if food_grad_angle is not None and self.brain.personality["hunger"] > 0.4:
                steer_diff = (food_grad_angle - self.heading + math.pi) % (2 * math.pi) - math.pi
                turn_command = steer_diff * 1.5 + turn_noise
            else:
                turn_command = (motor_commands["turn_bias"] - 0.5) * 4.0 + turn_noise
                
            self.angular_velocity = turn_command
            self.heading += self.angular_velocity * dt_sec
            self.heading = (self.heading + 2 * math.pi) % (2 * math.pi)
            
            # Walking Speed
            base_walk = motor_commands["walk"] * 24.0  # mm/s
            self.vx = math.cos(self.heading) * base_walk
            self.vy = math.sin(self.heading) * base_walk
            self.last_action_tag = "walking"

        # Update Position with Arena Boundary Collisions
        self.x += self.vx * dt_sec
        self.y += self.vy * dt_sec
        self.speed = math.hypot(self.vx, self.vy)
        
        # Leg Tripod Gait Animation
        if self.speed > 1.0:
            self.tripod_phase = (self.tripod_phase + self.speed * dt_sec * 4.0) % (2 * math.pi)
            
        # Arena Bounds (e.g. 0 to env.width, 0 to env.height)
        margin = 6.0
        if self.x < margin:
            self.x = margin
            self.heading = math.pi - self.heading + random.uniform(-0.3, 0.3)
        elif self.x > env.width - margin:
            self.x = env.width - margin
            self.heading = math.pi - self.heading + random.uniform(-0.3, 0.3)
            
        if self.y < margin:
            self.y = margin
            self.heading = -self.heading + random.uniform(-0.3, 0.3)
        elif self.y > env.height - margin:
            self.y = env.height - margin
            self.heading = -self.heading + random.uniform(-0.3, 0.3)
            
        # Male Flies emit cVA Pheromone on Substrate
        if self.gender == "male":
            env.deposit_cva(self.x, self.y, amount=0.08)
            
        # Metabolic Satiety Decay
        self.satiety = max(0.05, self.satiety - 0.0003)
        self.brain.personality["hunger"] = max(0.05, 1.0 - self.satiety)

    def to_dict(self):
        """Serializes fly state for network transmission to frontend."""
        return {
            "id": self.id,
            "archetype": self.archetype_name,
            "gender": self.gender,
            "color": self.color,
            "x": round(self.x, 2),
            "y": round(self.y, 2),
            "heading": round(self.heading, 3),
            "heading_deg": round(math.degrees(self.heading), 1),
            "speed": round(self.speed, 2),
            "action": self.last_action_tag,
            "is_singing": self.is_singing,
            "singing_wing": self.singing_wing,
            "wing_left_angle": round(self.wing_left_angle, 1),
            "wing_right_angle": round(self.wing_right_angle, 1),
            "tripod_phase": round(self.tripod_phase, 2),
            "proboscis": round(self.proboscis_extended, 2),
            "satiety": round(self.satiety, 2),
            "target_id": self.current_target_id,
            "telemetry": self.brain.get_telemetry()
        }
