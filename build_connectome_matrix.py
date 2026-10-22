import pyarrow.feather as feather
import pyarrow.compute as pc
import numpy as np
import pandas as pd
import json

print("Loading annotations...")
ann = feather.read_table('body-annotations-male-cns-v1.0.feather').to_pandas()
print(f"Total annotations: {len(ann)}")

# Define target circuit populations
POP_PATTERNS = {
    # Visual Sensory
    'VIS_LC10': r'^LC10[a-e]?',
    'VIS_LC4': r'^(LC4|LPLC2)',
    'VIS_LC11': r'^LC11',
    # Olfactory / Pheromone
    'OLF_DA1': r'^(ORN_DA1|DA1_lPN)',
    'OLF_FOOD': r'^(ORN_DL[1-5]|ORN_DM[1-5]|ORN_VA2)',
    'CHE_PHERO': r'ppk23|ppk25|IR52b',
    # Central Complex Compass & Steering
    'CX_EPG': r'^(EPG|EPGt)',
    'CX_PEN': r'^(PEN|P-EN)',
    'CX_FB': r'^(FC[1-3]|hDelta|PFN[a-d])',
    # Mushroom Body Learning & Modulation
    'MB_KC': r'^KC(g|ab|a\'b\')',
    'MB_MBON': r'^MBON',
    'MB_DAN': r'^(PAM|PPL1)',
    # Social Circuits
    'SOC_MAL': r'^mAL',
    'SOC_P1': r'^(pC1|P1|LLPC1|LPC1)',
    'SOC_AGG': r'^(aSP2|aSP10)',
    # Descending Motor
    'DN_WALK': r'^(DNge091|DNge094|DNp17)',
    'DN_TURN': r'^(DNg08|DNg07|DNg106|DNge019)',
    'DN_SONG': r'^(DNpe008|DNge071)',
    'DN_LUNGE': r'^(DNg02|DNg10|DNg03)',
    'DN_FEED': r'^(DNge115|DNge085)',
    'DN_ESCAPE': r'^GF(C[1-4])?'
}

body_to_pop = {}
pop_bodies = {pop: [] for pop in POP_PATTERNS}

for pop, pat in POP_PATTERNS.items():
    if pop == 'CHE_PHERO':
        # Check receptorType as well
        m = ann[ann['receptorType'].str.contains(pat, case=False, na=False) | ann['type'].str.contains(pat, case=False, na=False)]
    else:
        m = ann[ann['type'].str.contains(pat, case=False, na=False)]
    
    b_ids = m['bodyId'].dropna().astype(int).tolist()
    pop_bodies[pop] = b_ids
    for b in b_ids:
        body_to_pop[b] = pop
    print(f"Population {pop}: {len(b_ids)} neurons")

all_target_bodies = set(body_to_pop.keys())
print(f"Total target neurons in subcircuit: {len(all_target_bodies)}")

print("Loading connectome weights...")
edges = feather.read_table('connectome-weights-male-cns-v1.0-minconf-0.5.feather')
print(f"Total edges in connectome: {len(edges)}")

pre_arr = edges.column('body_pre').to_numpy()
post_arr = edges.column('body_post').to_numpy()
weight_arr = edges.column('weight').to_numpy()

print("Filtering edges within and between target populations...")
pop_names = list(POP_PATTERNS.keys())
pop_idx = {name: i for i, name in enumerate(pop_names)}
N = len(pop_names)

# Aggregate connection matrix: W_pop[pre, post] = sum of weights
W_syn_count = np.zeros((N, N), dtype=np.float64)
edge_count = np.zeros((N, N), dtype=np.int64)

max_body = max(max(pre_arr.max(), post_arr.max()), max(all_target_bodies)) + 1
print(f"Max bodyId: {max_body}, creating fast lookup array...")
body_map = np.full(max_body, -1, dtype=np.int16)
for b, pop in body_to_pop.items():
    if b < max_body:
        body_map[b] = pop_idx[pop]

print("Vectorized indexing of edges...")
src_pop_arr = body_map[pre_arr]
dst_pop_arr = body_map[post_arr]

valid_mask = (src_pop_arr >= 0) & (dst_pop_arr >= 0)
print(f"Found {np.sum(valid_mask)} synaptic edges between target populations out of 151M!")

src_valid = src_pop_arr[valid_mask]
dst_valid = dst_pop_arr[valid_mask]
w_valid = weight_arr[valid_mask]

# Accumulate weights
for s, d, w in zip(src_valid, dst_valid, w_valid):
    W_syn_count[s, d] += w
    edge_count[s, d] += 1


print("\n=== Population Synaptic Weight Matrix (Synapse Count) ===")
summary_rows = []
for i, src in enumerate(pop_names):
    for j, dst in enumerate(pop_names):
        w = W_syn_count[i, j]
        cnt = edge_count[i, j]
        if w > 0:
            summary_rows.append({'source': src, 'target': dst, 'synapses': int(w), 'edges': int(cnt)})

summary_df = pd.DataFrame(summary_rows)
print(f"Non-zero population links: {len(summary_df)}")
print(summary_df.sort_values(by='synapses', ascending=False).head(25))

# Normalize weights per source population size
pop_sizes = np.array([max(len(pop_bodies[p]), 1) for p in pop_names], dtype=np.float64)
W_norm = W_syn_count / pop_sizes[:, None]

# Save subcircuit data
data_out = {
    'populations': pop_names,
    'population_sizes': {p: len(pop_bodies[p]) for p in pop_names},
    'synapse_matrix': W_syn_count.tolist(),
    'normalized_matrix': W_norm.tolist(),
    'top_connections': summary_rows
}

with open('fruit_fly_connectome_subcircuit.json', 'w') as f:
    json.dump(data_out, f, indent=2)

print("\nSaved fruit_fly_connectome_subcircuit.json successfully!")
