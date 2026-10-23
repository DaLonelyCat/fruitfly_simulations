import urllib.request
import json

def test_api():
    print("Testing /api/state...")
    res = urllib.request.urlopen("http://localhost:8000/api/state")
    assert res.status == 200
    data = json.loads(res.read().decode())
    assert "flies" in data
    assert "environment" in data
    env = data["environment"]
    print("total_courtships:", env.get("total_courtships"))
    print("total_fights:", env.get("total_fights"))
    print("total_dopamine_surges:", env.get("total_dopamine_surges"))
    assert "total_courtships" in env
    assert "total_fights" in env
    assert "total_dopamine_surges" in env
    
    # Check fly fields for duplicate satiety
    for f in data["flies"]:
        assert "satiety" in f
        assert "dopamine" in f
        assert "mood" in f
        assert "is_sitting" in f
        
    print("API state verified successfully!")

    print("Testing static files...")
    for path in ["/static/app.js", "/static/arena_3d_view.js", "/skybox/posx.jpg"]:
        res = urllib.request.urlopen(f"http://localhost:8000{path}")
        assert res.status == 200
        print(f"Verified {path} (200 OK)")

if __name__ == "__main__":
    test_api()
