import asyncio
import websockets
import json

async def test_ws_client():
    uri = "ws://127.0.0.1:8000/ws"
    print(f"Connecting to {uri}...")
    async with websockets.connect(uri) as ws:
        # 1. Receive initial state
        msg = await ws.recv()
        data = json.loads(msg)
        print(f"Connected! Simulation step: {data['step']}, Flies: {len(data['flies'])}")
        
        # 2. Test dropping food at (150, 150)
        print("Sending add_food command at (150, 150)...")
        await ws.send(json.dumps({"action": "add_food", "x": 150.0, "y": 150.0}))
        
        # 3. Test updating personality: make Fly #1 ultra-romantic courtier
        print("Updating Fly #1 personality (fruitless: 1.0, dopamine: 1.0)...")
        await ws.send(json.dumps({
            "action": "update_personality",
            "fly_id": 1,
            "personality": {"fruitless": 1.0, "dopamine": 1.0}
        }))
        
        # 4. Test startle all
        print("Sending startle_all command...")
        await ws.send(json.dumps({"action": "startle_all"}))
        
        # 5. Receive updated frame
        await asyncio.sleep(0.1)
        msg2 = await ws.recv()
        data2 = json.loads(msg2)
        print(f"State after commands: Food patches count: {len(data2['environment']['food_patches'])}")
        f1 = [f for f in data2['flies'] if f['id'] == 1][0]
        print(f"Fly #1 personality updated: fru={f1['telemetry']['personality']['fruitless']}, action={f1['action']}")
        print("WebSocket client verification complete!")

if __name__ == "__main__":
    asyncio.run(test_ws_client())
