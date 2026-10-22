# Drosophila Connectome Multi-Agent Simulation

An interactive, multi-agent behavioral and neuro-computational simulation of fruit flies (*Drosophila melanogaster*), directly driven by synaptic connectivity data from the **Google DeepMind & Janelia Male Central Nervous System (CNS) Connectome** (`male-cns:v1.0`).

Each fruit fly in the arena is controlled by an individualized connectome brain with its own biological personality, neurochemical tone (Dopamine, Octopamine, Serotonin), and genetic expression (Fruitless / Doublesex), producing emergent social behaviors such as courtship singing, territorial aggression, food competition, and looming escape.

---

## Scientific Background & Provenance

In September 2024, researchers from **Google Research / DeepMind**, the **HHMI Janelia Research Campus**, and the **Cambridge Connectomics Group** published the complete wiring diagram of an adult male fruit fly central nervous system:
- **166,000+ reconstructed neurons** and **~125 million synapses**.
- Complete brain and ventral nerve cord (VNC) through an intact neck.
- Dataset source: `https://male-cns.janelia.org/download/` (`gs://flyem-male-cns/v1.0/`).
- Scientific announcement: *Google Research: A connectomics milestone mapping the complete male fruit fly brain*.

### Extracted Biological Subcircuit
From the 151,856,684 synaptic edges and 211,577 annotated bodies in the official dataset, we extracted **1,193,723 synaptic connections across 9,398 traced neurons** forming the core sensory-decision-motor behavioral loops:

1. **Sensory Circuits**:
   - `VIS_LC10` (960 neurons): Lobula columnar visual target tracking of conspecific flies.
   - `VIS_LC4` (387 neurons): Visual looming detector for collision threat and predator escape.
   - `VIS_LC11` (143 neurons): Small moving target and food detector.
   - `OLF_DA1` (217 neurons): Glomerulus DA1 detecting male-specific pheromone *cis*-vaccenyl acetate (cVA).
   - `OLF_FOOD` (670 neurons): Antennal lobe glomeruli (DL/DM) detecting fermenting yeast and banana.
   - `CHE_PHERO` (752 neurons): Foreleg contact chemoreceptors (`ppk23`, `ppk25`, `IR52b`) for gender recognition during tapping.

2. **Central Brain Decision Hubs**:
   - `CX_EPG` (50 neurons) & `CX_PEN` (42 neurons): Central complex ring attractor head-direction compass.
   - `CX_FB` (561 neurons): Fan-shaped body columnar neurons for translational steering and goal navigation.
   - `MB_KC` (4,062 neurons), `MB_MBON` (97 neurons), `MB_DAN` (332 neurons): Mushroom body associative learning, dopamine reward modulation (PAM cluster), and valence readout.
   - `SOC_MAL` (159 neurons): Sexually dimorphic GABAergic switch neurons that suppress courtship upon male cVA detection.
   - `SOC_P1` (665 neurons): Master male courtship hub (`pC1` / `P1` cluster) driving mate following and unilateral wing singing.
   - `SOC_AGG` (44 neurons): Fru+ interneurons and octopaminergic nodes driving territorial defense.

3. **Descending Motor Commands (DNs)**:
   - `DN_WALK` (39 neurons): Forward walking velocity and alternating tripod leg gait (`DNge091`).
   - `DN_TURN` (66 neurons): Asymmetric steering control (`DNg08`).
   - `DN_SONG` (29 neurons): Unilateral 90-degree wing extension and 34ms acoustic pulse song (`DNpe008`).
   - `DN_LUNGE` (89 neurons): Aggressive ballistic charge and front-leg boxing (`DNg02`).
   - `DN_FEED` (16 neurons): Proboscis extension reflex (PER) and ingestion pump (`DNge115`).
   - `DN_ESCAPE` (34 neurons): Giant Fiber ultra-fast emergency escape jump (`GFC1-4`).

---

## Fruit Fly Biological Personalities

Individual fruit flies exhibit stable behavioral syndromes shaped by their neuromodulatory profiles and receptor sensitivities:

| Archetype | Gender | Key Neurochemical Profile | Emergent Behavior |
| :--- | :--- | :--- | :--- |
| **Romeo** | Male | High Fru (0.95), High DA (0.85), Low OA (0.25) | Relentless courtier; locks onto peers with LC10, extends one wing to 90 degrees, emits pulse song. |
| **Brawler** | Male | High OA (0.95), Low 5-HT (0.15), Moderate Fru (0.35) | Territorial gladiator; detects male cVA, triggers mAL/AGG hubs, lunges and boxes rivals. |
| **Glutton** | Male | High Hunger (0.95), High MBON gain, Low Fru (0.15) | Voracious forager; follows yeast/banana odor plumes, extends proboscis, pushes rivals off food. |
| **Skittish** | Male | High Fear (0.95), High LC4 gain, Moderate 5-HT (0.7) | Neurotic jitterbug; hyper-sensitive to looming objects; triggers Giant Fiber emergency takeoff. |
| **Zen** | Male | High 5-HT (0.95), Low OA (0.1), Moderate DA (0.35) | Harmonious observer; peaceful social tolerance, frequent grooming of antennae and wings. |
| **Cleopatra** | Female | Fru-null, emits female cuticular pheromones | Selective female; lacks cVA, evaluates acoustic pulse song quality during courtship. |

---

## Interactive Features in the Web Interface

- **Live 60 FPS Arena Canvas**:
  - Anatomically articulated fruit flies with alternating tripod leg gaits, compound brick-red eyes, and twitching antennae.
  - Unilateral wing extension during courtship singing with expanding acoustic sound waves.
  - Substrate cVA pheromone trail heatmap diffusion and decay.
  - Interactive tools: click to inspect flies, drop fresh food patches, or spray cVA pheromone clouds.
- **Connectome Brain Inspector**:
  - Live firing rate telemetry for all 21 populations.
  - Interactive circuit graph showing synaptic transmissions between Sensory, Central Brain, and Descending Motor layers.
  - Real-time `CX_EPG` 8-wedge ring attractor compass dial showing internal head direction.
- **Neuro-Symbolic Thought Stream (Fly Mind)**:
  - Transparent English translation of what the fly's brain is processing based on its active connectome state.
- **Mutant Lab & Neurogenetics Sliders**:
  - Real-time sliders for Dopamine, Octopamine, Serotonin, Fruitless, Fear, and Hunger.
  - One-click genetic mutants: `fru-null` (courtship blind), `hyper-octopamine` (extreme aggression), `hyper-dopamine` (hyper-arousal), `fearless`, and `zen-calm`.
- **Social Dominance Leaderboard & Interaction Matrix**:
  - Tracks individual fight victories, courtship bouts, and conspecific interaction networks.

---

## Quickstart & Running the Application

### Prerequisites
Python 3.10+ with standard scientific libraries:
```bash
pip install fastapi uvicorn websockets numpy pandas pyarrow
```

### Running the Server
```bash
python app.py
```
Open your browser to:
```
http://127.0.0.1:8000
```
