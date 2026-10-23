import json
import numpy as np
from pathlib import Path

class ConnectomeBrain:
    """
    Biological Connectome Neural Dynamic Model of Drosophila melanogaster.
    Derived directly from the Janelia FlyEM / Google DeepMind Male CNS Connectome (male-cns:v1.0).
    Simulates 21 functional populations connected by biological synaptic matrices,
    modulated by individualized neurochemical profiles (Dopamine, Octopamine, Serotonin, Fruitless).
    """

    def __init__(self, personality=None, data_path=None):
        if data_path is None:
            data_path = Path(__file__).resolve().parent.parent / "data" / "fruit_fly_connectome_subcircuit.json"
        
        with open(data_path, "r") as f:
            subcircuit = json.load(f)
            
        self.pop_names = subcircuit["populations"]
        self.N = len(self.pop_names)
        self.pop_idx = {name: i for i, name in enumerate(self.pop_names)}
        
        # Raw synaptic weight matrix and normalized matrix
        raw_W = np.array(subcircuit["synapse_matrix"], dtype=np.float32)
        # Apply biological log-scaling and normalization to stabilize dynamics
        # Synapse counts range from 1 to 1,153,805, so log-scaling mimics synaptic saturation
        W_log = np.log1p(raw_W)
        row_sums = W_log.sum(axis=1, keepdims=True)
        row_sums[row_sums == 0] = 1.0
        self.W_base = W_log / row_sums
        
        # Neural state vectors: membrane potentials / firing rates (0.0 to 1.0)
        self.firing_rates = np.zeros(self.N, dtype=np.float32)
        self.potentials = np.zeros(self.N, dtype=np.float32)
        
        # Time constants (tau) for each population in ms
        self.tau = np.full(self.N, 20.0, dtype=np.float32)
        # Escape giant fiber is ultra-fast (5ms)
        self.tau[self.pop_idx["DN_ESCAPE"]] = 5.0
        # P1 courtship has persistent integration (50ms)
        self.tau[self.pop_idx["SOC_P1"]] = 50.0
        # Compass ring attractor (15ms)
        self.tau[self.pop_idx["CX_EPG"]] = 15.0
        
        # Ring Attractor Head-Direction Compass (8 wedges representing 360 degrees)
        self.num_wedges = 8
        self.ring_wedges = np.linspace(0, 2 * np.pi, self.num_wedges, endpoint=False)
        self.compass_activity = np.zeros(self.num_wedges, dtype=np.float32)
        self.internal_heading = 0.0  # radians
        
        # Default Personality & Neurochemical Tone
        # DA (Dopamine), OA (Octopamine), 5HT (Serotonin), Fru (Fruitless/Dsx), Fear (Startle), Hunger (Satiety)
        self.personality = {
            "name": "Standard",
            "dopamine": 0.5,       # 0.0 (lethargic) to 1.0 (hyper-aroused/curious)
            "octopamine": 0.5,     # 0.0 (docile) to 1.0 (aggressive brawler)
            "serotonin": 0.5,      # 0.0 (impulsive) to 1.0 (calm/patient/groomer)
            "fruitless": 0.5,      # 0.0 (asexual/solitary) to 1.0 (passionate courtier)
            "fear": 0.3,           # 0.0 (bold/fearless) to 1.0 (skittish/paranoid)
            "hunger": 0.4          # 0.0 (sated) to 1.0 (starving forager)
        }
        if personality:
            self.personality.update(personality)
            
        # Recent thoughts / neuro-symbolic log
        self.last_thought = "Exploring arena."
        self.thought_timer = 0
        
        # Optogenetic direct neural stimulation channels
        self.opto_stimuli = {}
        
    def inject_optogenetic_stimulus(self, pop_name, intensity=2.5, duration_ms=300):
        """Injects artificial photocurrent into a specific connectome population."""
        if pop_name in self.pop_idx:
            self.opto_stimuli[pop_name] = {
                "intensity": float(intensity),
                "remaining_ms": float(duration_ms)
            }
            # Special feedback for thought stream
            pop_clean = pop_name.replace("SOC_", "").replace("VIS_", "").replace("DN_", "")
            self.last_thought = f"OPTOGENETIC STIMULATION: Photostimulating {pop_clean} ({intensity:.1f}nA)!"

    def set_personality(self, **kwargs):
        self.personality.update(kwargs)

    def update_compass(self, actual_heading, angular_velocity, dt_sec):
        """
        Simulates the Drosophila EPG-PEN biological ring attractor compass in the central complex.
        Maintains an activity bump around the ring matching the fly's heading.
        """
        # Internal heading integrates angular velocity with slight visual heading calibration
        drift_rate = 0.15
        self.internal_heading = (self.internal_heading + angular_velocity * dt_sec) % (2 * np.pi)
        # Visual cue anchoring
        angle_diff = (actual_heading - self.internal_heading + np.pi) % (2 * np.pi) - np.pi
        self.internal_heading = (self.internal_heading + angle_diff * drift_rate) % (2 * np.pi)
        
        # Gaussian bump around the ring
        for i, wedge_angle in enumerate(self.ring_wedges):
            diff = (wedge_angle - self.internal_heading + np.pi) % (2 * np.pi) - np.pi
            self.compass_activity[i] = np.exp(- (diff ** 2) / (2 * 0.45 ** 2))
            
        # Mean activity reflects EPG firing rate
        epg_idx = self.pop_idx["CX_EPG"]
        self.firing_rates[epg_idx] = float(np.mean(self.compass_activity))

    def step(self, sensory_inputs, dt_sec=0.016):
        """
        Simulate one time step of the full connectome dynamical system.
        sensory_inputs: dict with keys:
            - 'visual_fly_dist': distance to nearest fly (mm, 0 to 100)
            - 'visual_fly_angle': relative angle to nearest fly (rad, -pi to pi)
            - 'visual_loom_speed': approaching velocity of nearest object/fly (mm/s)
            - 'visual_food_dist': distance to nearest food patch (mm)
            - 'olfactory_cva': concentration of cVA male pheromone (0.0 to 1.0)
            - 'olfactory_food': concentration of fermenting food odor (0.0 to 1.0)
            - 'chemo_tap_pheromones': contact pheromone detected on foreleg (0.0 to 1.0)
            - 'chemo_tap_gender': 'female', 'male', or None
            - 'gustatory_sugar': contact with sugar/banana (0.0 to 1.0)
            - 'auditory_song_intensity': near-field pulse song detected by antenna (0.0 to 1.0)
        """
        dt_ms = dt_sec * 1000.0
        
        # 1. Map sensory inputs to sensory neural populations
        I_sensory = np.zeros(self.N, dtype=np.float32)
        
        # LC10: Social / Fly Visual Tracking
        # Activates when a fly is within visual field (< 30mm, frontal angle < 90 deg)
        fly_dist = sensory_inputs.get("visual_fly_dist", 999.0)
        fly_ang = abs(sensory_inputs.get("visual_fly_angle", np.pi))
        if fly_dist < 35.0 and fly_ang < (np.pi * 0.65):
            dist_factor = max(0.0, 1.0 - fly_dist / 35.0)
            ang_factor = max(0.0, 1.0 - fly_ang / (np.pi * 0.65))
            I_sensory[self.pop_idx["VIS_LC10"]] = 1.8 * dist_factor * ang_factor
            
        # LC4: Looming / Fast Approach (Threat / Aggression)
        loom_speed = sensory_inputs.get("visual_loom_speed", 0.0)
        if loom_speed > 5.0 and fly_dist < 25.0:
            I_sensory[self.pop_idx["VIS_LC4"]] = min(2.5, (loom_speed / 20.0) * (self.personality["fear"] * 2.0))
            
        # LC11: Small Target (Food drops)
        food_dist = sensory_inputs.get("visual_food_dist", 999.0)
        if food_dist < 30.0:
            I_sensory[self.pop_idx["VIS_LC11"]] = max(0.0, 1.0 - food_dist / 30.0) * 1.5
            
        # Olfactory cVA Pheromone (ORN_DA1)
        cva_conc = sensory_inputs.get("olfactory_cva", 0.0)
        I_sensory[self.pop_idx["OLF_DA1"]] = min(2.5, cva_conc * 2.0)
        
        # Olfactory Food Odor (Vinegar/Yeast)
        food_odor = sensory_inputs.get("olfactory_food", 0.0)
        hunger_gain = 0.5 + 1.2 * self.personality["hunger"]
        I_sensory[self.pop_idx["OLF_FOOD"]] = min(2.5, food_odor * 2.0 * hunger_gain)
        
        # Contact Chemoreceptors (ppk23 / ppk25 foreleg tapping)
        chemo_p = sensory_inputs.get("chemo_tap_pheromones", 0.0)
        I_sensory[self.pop_idx["CHE_PHERO"]] = min(2.5, chemo_p * 2.5)
        
        # Optogenetic Photostimulation Current Injections
        if self.opto_stimuli:
            expired_opto = []
            for pop, stim in self.opto_stimuli.items():
                if pop in self.pop_idx:
                    idx = self.pop_idx[pop]
                    I_sensory[idx] += stim["intensity"]
                    stim["remaining_ms"] -= dt_ms
                    if stim["remaining_ms"] <= 0:
                        expired_opto.append(pop)
            for pop in expired_opto:
                del self.opto_stimuli[pop]
        
        # 2. Neuromodulatory & Genetic Biases on Connectome Synaptic Matrix
        # W_eff is modulated in real-time by neurotransmitter levels
        W_eff = self.W_base.copy()
        
        p = self.personality
        da = p["dopamine"]
        oa = p["octopamine"]
        sht = p["serotonin"]
        fru = p["fruitless"]
        fear = p["fear"]
        hunger = p["hunger"]
        
        p1_idx = self.pop_idx["SOC_P1"]
        mal_idx = self.pop_idx["SOC_MAL"]
        agg_idx = self.pop_idx["SOC_AGG"]
        dan_idx = self.pop_idx["MB_DAN"]
        mbon_idx = self.pop_idx["MB_MBON"]
        lunge_idx = self.pop_idx["DN_LUNGE"]
        song_idx = self.pop_idx["DN_SONG"]
        escape_idx = self.pop_idx["DN_ESCAPE"]
        feed_idx = self.pop_idx["DN_FEED"]
        walk_idx = self.pop_idx["DN_WALK"]
        lc10_idx = self.pop_idx["VIS_LC10"]
        lc4_idx = self.pop_idx["VIS_LC4"]
        
        # Dopamine boosts reward learning, arousal, and P1 courtship persistence
        W_eff[dan_idx, :] *= (0.5 + 1.5 * da)
        W_eff[p1_idx, p1_idx] *= (0.7 + 1.3 * da)
        
        # Biological multi-hop pathways (pre-motor interneuron cascades from connectome)
        # P1 -> courtship pulse song descending neurons (DNpe008)
        W_eff[p1_idx, song_idx] = 0.45 * (0.3 + 1.8 * fru)
        # LC4 looming -> Giant Fiber emergency escape
        W_eff[lc4_idx, escape_idx] = 0.55 * (0.3 + 2.0 * fear)
        # SOC_AGG & SOC_MAL -> aggressive lunge motor command
        W_eff[agg_idx, lunge_idx] = 0.50 * (0.3 + 2.2 * oa)
        # Food MBON & OLF_FOOD -> feeding motor command
        W_eff[mbon_idx, feed_idx] = 0.45 * (0.3 + 2.0 * hunger)
        # Central complex steering -> turn bias
        W_eff[self.pop_idx["CX_FB"], self.pop_idx["DN_TURN"]] = 0.35

        
        # 3. Dynamic Biological Integration with E/I (Excitation-Inhibition) Balance:
        # Synaptic transmission with Dale's principle:
        # SOC_MAL is strongly GABAergic inhibitory (-), MB_MBON has inhibitory output (-),
        # plus global inhibitory pool (local interneurons) to prevent epileptic runaway.
        W_signed = W_eff.copy()
        
        # SOC_MAL (GABAergic) inhibits targets:
        W_signed[mal_idx, :] *= -1.5
        
        # Global inhibition pool (recurrent inhibition from all active interneurons)
        total_activity = np.mean(self.firing_rates)
        global_inhibition = 0.65 * total_activity
        
        # Synaptic current calculation
        synaptic_input = np.dot(W_signed.T, self.firing_rates) * 0.75 - global_inhibition
        
        # Intrinsic excitability offsets
        baseline = np.full(self.N, -0.4, dtype=np.float32)  # negative resting threshold prevents spontaneous firing
        baseline[walk_idx] = 0.15 * (0.6 + 0.8 * da)       # spontaneous exploratory locomotion
        baseline[dan_idx] = 0.1 * da
        baseline[self.pop_idx["CX_EPG"]] = 0.1            # maintain compass bump
        baseline[escape_idx] = -0.8                       # high threshold for emergency escape
        baseline[lunge_idx] = -0.7                        # high threshold for aggressive lunge
        baseline[song_idx] = -0.6                         # high threshold for courtship song
        baseline[feed_idx] = -0.6                         # high threshold for feeding

        
        # Contact tapping interaction logic:
        # If tapping a male (cVA present) -> mAL excited (inhibits P1, primes aggression)
        # If tapping a female (cVA absent, sweet pheromones) -> P1 excited!
        if chemo_p > 0.2:
            gender_tap = sensory_inputs.get("chemo_tap_gender")
            if gender_tap == "male":
                I_sensory[mal_idx] += 2.0 * (0.5 + oa)
                I_sensory[agg_idx] += 1.5 * oa
            elif gender_tap == "female":
                I_sensory[p1_idx] += 2.5 * fru
                
        # Auditory courtship song received
        song_in = sensory_inputs.get("auditory_song_intensity", 0.0)
        if song_in > 0.1:
            # Auditory input alerts the fly
            I_sensory[lc10_idx] += song_in * 0.8
            # In males, hearing another male singing close by triggers territorial rivalry (aggression)
            I_sensory[agg_idx] += song_in * 1.2 * oa

        # Exponential Euler Integration (unconditionally stable for any tau)
        # V(t + dt) = V(t) * exp(-dt/tau) + I_total * (1 - exp(-dt/tau))
        I_total = synaptic_input * 0.75 + I_sensory + baseline
        decay = np.exp(-dt_ms / self.tau)
        self.potentials = self.potentials * decay + I_total * (1.0 - decay)
        self.potentials = np.clip(self.potentials, -2.0, 5.0)

        
        # Sigmoidal activation function for firing rates (0.0 to 1.0)
        # S(V) = 1 / (1 + exp(-2 * (V - V_thresh)))
        v_thresh = 0.25
        self.firing_rates = 1.0 / (1.0 + np.exp(- 3.0 * (self.potentials - v_thresh)))
        
        # Mutual Inhibition between P1 (courtship) and mAL / Aggression:
        # When mAL / cVA is strong, P1 is actively suppressed
        if self.firing_rates[mal_idx] > 0.4:
            self.firing_rates[p1_idx] *= max(0.05, 1.0 - self.firing_rates[mal_idx] * 0.9)
            
        # Generate Neuro-Symbolic Thought Stream
        self._update_internal_monologue(sensory_inputs)
        
        # Return motor descending commands
        r_turn = float(self.firing_rates[self.pop_idx["DN_TURN"]])
        # Calibrate turn_bias relative to baseline resting rate (~0.125) so resting state yields 0.0 bias
        r_turn_rest = 1.0 / (1.0 + np.exp(-3.0 * (-0.4 - v_thresh)))
        calibrated_turn = float(np.clip((r_turn - r_turn_rest) * 2.0, -1.0, 1.0))

        return {
            "walk": float(self.firing_rates[walk_idx]),
            "turn_bias": calibrated_turn,
            "song": float(self.firing_rates[song_idx]),
            "lunge": float(self.firing_rates[lunge_idx]),
            "escape": float(self.firing_rates[escape_idx]),
            "feed": float(self.firing_rates[feed_idx])
        }

    def _update_internal_monologue(self, sensory):
        """Translates real-time neural firing patterns into a transparent thought stream."""
        self.thought_timer += 1
        if self.thought_timer < 10:  # update thought every ~160ms for stability
            return
        self.thought_timer = 0
        
        r = self.firing_rates
        idx = self.pop_idx
        
        # Priority 1: Emergency Escape (Giant Fiber)
        if r[idx["DN_ESCAPE"]] > 0.22:
            self.last_thought = "CRITICAL: Looming threat in visual field! Giant Fiber activated -> EVASIVE TAKEOFF!"
            return
            
        # Priority 2: Aggressive Attack
        if r[idx["DN_LUNGE"]] > 0.20 or r[idx["SOC_AGG"]] > 0.25:
            oa_lvl = self.personality["octopamine"]
            self.last_thought = f"Octopamine surge ({oa_lvl:.1f})! Male intruder detected via cVA pheromone -> LUNGING CHARGE!"
            return
            
        # Priority 3: Courtship Pursuit & Wing Song
        if r[idx["DN_SONG"]] > 0.18 or r[idx["SOC_P1"]] > 0.25:
            fru_lvl = self.personality["fruitless"]
            self.last_thought = f"P1 courtship hub locked on target! (fru: {fru_lvl:.1f}) Extending wing -> Emitting 34ms pulse song!"
            return
            
        # Priority 4: Feeding & Satiety
        if r[idx["DN_FEED"]] > 0.20 or r[idx["MB_MBON"]] > 0.3:
            self.last_thought = f"Yeast/sugar odor detected! MBON appetitive valence high -> Extending proboscis to sip food."
            return
            
        # Priority 5: Visual Tracking of peer
        if r[idx["VIS_LC10"]] > 0.25:
            self.last_thought = "LC10 visual tracking active: conspecific fly spotted ahead, orienting compass heading."
            return
            
        # Priority 6: Foraging / Exploration
        if r[idx["DN_WALK"]] > 0.25:
            self.last_thought = f"EB ring attractor stable. Patrolling territory (DA: {self.personality['dopamine']:.1f}, 5-HT: {self.personality['serotonin']:.1f})."
            return

            
        # Calming / Resting
        self.last_thought = "Grooming antennae and wings. Serotonin calm."

    def get_telemetry(self):
        """Returns neural activity snapshot for visualization."""
        return {
            "firing_rates": {name: round(float(self.firing_rates[i]), 3) for i, name in enumerate(self.pop_names)},
            "internal_heading_deg": round(float(np.degrees(self.internal_heading)), 1),
            "compass_ring": [round(float(x), 3) for x in self.compass_activity],
            "personality": self.personality,
            "last_thought": self.last_thought
        }
