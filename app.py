import os
import asyncio
import json
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from src.simulation_engine import FruitFlySimulation

app = FastAPI(title="Drosophila Connectome Multi-Agent Simulation")

# Enable Cross-Origin Resource Sharing (CORS) for Cloudflare Pages
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global simulation instance
sim = FruitFlySimulation(arena_w=200.0, arena_d=200.0, arena_h=100.0, num_flies=7)


# Mount static files
web_dir = Path(__file__).resolve().parent / "web"
data_dir = Path(__file__).resolve().parent / "data"
curly_dir = Path(__file__).resolve().parent / "CurlyWing"

app.mount("/static", StaticFiles(directory=str(web_dir)), name="static")
if curly_dir.exists():
    app.mount("/CurlyWing", StaticFiles(directory=str(curly_dir)), name="CurlyWing")

@app.get("/")
async def get_index():
    return FileResponse(web_dir / "index.html")

@app.get("/api/connectome")
async def get_connectome_info():
    with open(data_dir / "connectome_summary.json", "r") as f:
        summary = json.load(f)
    with open(data_dir / "fruit_fly_connectome_subcircuit.json", "r") as f:
        subcircuit = json.load(f)
    return {
        "summary": summary,
        "subcircuit": subcircuit
    }

@app.get("/api/archetypes")
async def get_archetypes():
    from src.fly_agent import FruitFlyAgent
    return FruitFlyAgent.ARCHETYPES

@app.get("/api/state")
async def get_state_snapshot():
    return sim.get_state()

# Connected WebSocket clients
connected_clients = set()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    try:
        while True:
            # Receive client command
            data_text = await websocket.receive_text()
            msg = json.loads(data_text)
            action = msg.get("action")
            
            if action == "pause":
                sim.is_paused = True
            elif action == "resume":
                sim.is_paused = False
            elif action == "toggle_pause":
                sim.is_paused = not sim.is_paused
            elif action == "set_speed":
                sim.simulation_speed = max(0.2, min(5.0, float(msg.get("speed", 1.0))))
            elif action == "select_fly":
                sim.selected_fly_id = int(msg.get("fly_id", 1))
            elif action == "add_fly":
                arch = msg.get("archetype", "Romeo")
                x = msg.get("x")
                y = msg.get("y")
                sim.add_fly(archetype_name=arch, x=x, y=y)
            elif action == "remove_fly":
                sim.remove_fly(int(msg.get("fly_id")))
            elif action == "add_food":
                x = float(msg.get("x", 100.0))
                y = float(msg.get("y", 100.0))
                z = float(msg.get("z", 0.0))
                food_type = msg.get("food_type", "banana_slice")
                sim.env.add_food_patch_3d(x, y, z=z, food_type=food_type, amount=90.0)
            elif action == "remove_food":
                fid = int(msg.get("food_id"))
                sim.remove_food(fid)
            elif action == "clear_food":
                sim.clear_food()
            elif action == "trigger_flight":
                fid = msg.get("fly_id")
                if fid is not None:
                    sim.trigger_flight(int(fid))
                else:
                    sim.trigger_flight(None)
            elif action == "stimulate_neuropil":
                fid = msg.get("fly_id")
                fly_id = int(fid) if fid is not None else sim.selected_fly_id
                pop_name = msg.get("population")
                intensity = float(msg.get("intensity", 2.5))
                duration_ms = float(msg.get("duration_ms", 350))
                sim.stimulate_fly_neuropil(fly_id, pop_name, intensity, duration_ms)
            elif action == "add_pheromone":

                x = float(msg.get("x", 100.0))
                y = float(msg.get("y", 100.0))
                z = float(msg.get("z", 0.0))
                amount = float(msg.get("amount", 0.6))
                sim.env.deposit_cva_3d(x, y, z=z, amount=amount)

            elif action == "update_personality":
                fid = int(msg.get("fly_id"))
                pers = msg.get("personality", {})
                sim.update_fly_personality(fid, pers)
            elif action == "gene_knockout":
                fid = int(msg.get("fly_id"))
                gene = msg.get("gene")
                fly = sim.get_fly(fid)
                if fly:
                    if gene == "fru_null":
                        # Fruitless mutant: completely abolishes courtship
                        fly.brain.set_personality(fruitless=0.0)
                    elif gene == "hyper_octopamine":
                        # Extreme aggression mutant
                        fly.brain.set_personality(octopamine=1.0, serotonin=0.0)
                    elif gene == "hyper_dopamine":
                        # Hyper-aroused, hyper-exploratory
                        fly.brain.set_personality(dopamine=1.0)
                    elif gene == "fearless":
                        # Fearless mutant (no startle)
                        fly.brain.set_personality(fear=0.0)
                    elif gene == "zen_calm":
                        # Ultra-serotonergic
                        fly.brain.set_personality(serotonin=1.0, octopamine=0.05)
            elif action == "startle_all":
                # Startle all flies with visual loom
                for f in sim.flies:
                    f.brain.firing_rates[f.brain.pop_idx["DN_ESCAPE"]] = 0.95
                    f.is_escaping = True
                    f.escape_timer = 25
                    
    except WebSocketDisconnect:
        connected_clients.remove(websocket)
    except Exception:
        if websocket in connected_clients:
            connected_clients.remove(websocket)

async def simulation_loop():
    """Background task running simulation physics and broadcasting updates at ~30 FPS."""
    frame_interval = 1.0 / 30.0  # 30 updates per second over network
    while True:
        t0 = asyncio.get_event_loop().time()
        
        # Step simulation (2 physics sub-steps for smooth 60Hz dynamics)
        sim.step(dt_sec=0.016)
        sim.step(dt_sec=0.016)
        
        # Broadcast state to all connected clients
        if connected_clients:
            state = sim.get_state()
            state_json = json.dumps(state)
            # Create tasks for all connected clients
            dead_clients = []
            for ws in connected_clients:
                try:
                    await ws.send_text(state_json)
                except Exception:
                    dead_clients.append(ws)
            for ws in dead_clients:
                connected_clients.discard(ws)
                
        elapsed = asyncio.get_event_loop().time() - t0
        sleep_time = max(0.005, frame_interval - elapsed)
        await asyncio.sleep(sleep_time)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(simulation_loop())

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
