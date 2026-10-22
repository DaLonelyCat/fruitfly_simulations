from src.connectome_brain import ConnectomeBrain

b = ConnectomeBrain()
sensory = {
    'visual_fly_dist': 50.0,
    'visual_fly_angle': 2.0,
    'visual_loom_speed': 0.0,
    'visual_food_dist': 80.0
}

print("Running 15 baseline steps...")
for i in range(15):
    cmd = b.step(sensory)
    p = b.potentials
    r = b.firing_rates
    print(f"Step {i:2d} | max_r: {r.max():.3f} | min_r: {r.min():.3f} | mean_r: {r.mean():.3f} | walk: {cmd['walk']:.2f} | escape: {cmd['escape']:.2f} | lunge: {cmd['lunge']:.2f}")
