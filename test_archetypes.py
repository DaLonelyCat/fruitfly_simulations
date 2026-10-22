from src.connectome_brain import ConnectomeBrain
from src.fly_agent import FruitFlyAgent

print("=== Test 1: Romeo (Courtier) approaching Female ===")
romeo = FruitFlyAgent(1, "Romeo")
sensory_female = {
    'visual_fly_dist': 8.0,
    'visual_fly_angle': 0.1,
    'visual_loom_speed': 0.0,
    'visual_food_dist': 100.0,
    'olfactory_cva': 0.0,
    'chemo_tap_pheromones': 0.8,
    'chemo_tap_gender': 'female'
}
for _ in range(5):
    cmd = romeo.brain.step(sensory_female)
print(f"Romeo -> Song: {cmd['song']:.2f}, Walk: {cmd['walk']:.2f}, Lunge: {cmd['lunge']:.2f}")
print("Romeo thought:", romeo.brain.last_thought)

print("\n=== Test 2: Brawler (Gladiator) encountering Male cVA ===")
brawler = FruitFlyAgent(2, "Brawler")
sensory_male = {
    'visual_fly_dist': 6.0,
    'visual_fly_angle': 0.05,
    'visual_loom_speed': 0.0,
    'visual_food_dist': 100.0,
    'olfactory_cva': 0.9,
    'chemo_tap_pheromones': 0.9,
    'chemo_tap_gender': 'male'
}
for _ in range(5):
    cmd = brawler.brain.step(sensory_male)
print(f"Brawler -> Lunge: {cmd['lunge']:.2f}, Song: {cmd['song']:.2f}, Walk: {cmd['walk']:.2f}")
print("Brawler thought:", brawler.brain.last_thought)

print("\n=== Test 3: Skittish (Jitterbug) facing Looming Threat ===")
skittish = FruitFlyAgent(3, "Skittish")
sensory_loom = {
    'visual_fly_dist': 12.0,
    'visual_fly_angle': 0.0,
    'visual_loom_speed': 35.0,
    'visual_food_dist': 100.0
}
for _ in range(5):
    cmd = skittish.brain.step(sensory_loom)
print(f"Skittish -> Escape: {cmd['escape']:.2f}, Walk: {cmd['walk']:.2f}, Lunge: {cmd['lunge']:.2f}")
print("Skittish thought:", skittish.brain.last_thought)
