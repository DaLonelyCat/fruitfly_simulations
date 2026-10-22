import json

with open('fruit_fly_connectome_subcircuit.json') as f:
    data = json.load(f)

print("=== Direct Motor / Social / Sensory Connections ===")
for c in data['top_connections']:
    src = c['source']
    dst = c['target']
    if 'DN_' in dst or 'SOC_' in dst or 'DN_' in src or 'SOC_' in src:
        print(f"{src:12} -> {dst:12} | Synapses: {c['synapses']:6d} | Edges: {c['edges']:4d}")
