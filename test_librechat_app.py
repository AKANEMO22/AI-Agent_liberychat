import requests
import json
import time
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE_URL = "http://127.0.0.1:41792"

def test_app():
    print("=== TESTING OFFICIAL LIBRECHAT APP & BACKEND ===")
    
    # 1. UI Root Check (Official LibreChat HTML)
    r = requests.get(f"{BASE_URL}/")
    print(f"1. Root HTML Status: {r.status_code}, Length: {len(r.text)} bytes")
    assert r.status_code == 200
    assert "assets/" in r.text or "LibreChat" in r.text or "<div id=\"root\">" in r.text

    # 2. Config Endpoint Check
    cfg_res = requests.get(f"{BASE_URL}/api/config")
    print(f"2. Config API Status: {cfg_res.status_code}")
    cfg = cfg_res.json()
    print("   -> App Title:", cfg.get("appTitle"))
    print("   -> Default Model:", cfg.get("defaultModel"))
    assert cfg.get("defaultModel") == "qwen2.5-coder:7b"

    # 3. Models Endpoint Check
    models_res = requests.get(f"{BASE_URL}/api/models")
    print(f"3. Models API Status: {models_res.status_code}")
    models_data = models_res.json()
    print("   -> Models Available:", models_data.get("custom"))
    assert "qwen2.5-coder:7b" in models_data.get("custom", [])

    # 4. User Endpoint Check
    user_res = requests.get(f"{BASE_URL}/api/user")
    print(f"4. User API Status: {user_res.status_code}, User:", user_res.json().get("username"))
    assert user_res.json().get("username") == "developer"

    # 5. Stream Ask Check with Local GPU Ollama
    print("5. Testing Stream Ask with Qwen 2.5 Coder 7B...")
    ask_payload = {
        "text": "Viết hàm Python tính giai thừa của n bằng đệ quy.",
        "model": "qwen2.5-coder:7b",
        "endpoint": "custom",
        "temperature": 0.2
    }
    stream_res = requests.post(f"{BASE_URL}/api/ask", json=ask_payload, stream=True)
    print(f"   -> Ask Stream Status: {stream_res.status_code}")
    assert stream_res.status_code == 200
    
    tokens = []
    for line in stream_res.iter_lines():
        if line:
            decoded = line.decode('utf-8')
            if decoded.startswith("data: "):
                data = json.loads(decoded[6:])
                if "token" in data:
                    tokens.append(data["token"])
                if data.get("done"):
                    print("   -> Stream complete! Total tokens received:", len(tokens))
                    break

    reply = "".join(tokens)
    print("   -> AI Output:", reply[:150].replace("\n", " "), "...")

    # 6. Test Sandbox Subprocess Runner
    sandbox_res = requests.post(f"{BASE_URL}/api/sandbox/run", json={
        "code": "def factorial(n): return 1 if n <= 1 else n * factorial(n-1)\nprint('Factorial 6 =', factorial(6))",
        "language": "python",
        "timeout": 5
    })
    print(f"6. Sandbox Run Status: {sandbox_res.status_code}", sandbox_res.json())
    assert sandbox_res.json().get("success") is True
    assert "720" in sandbox_res.json().get("output")

    print("\n🎉 ALL OFFICIAL LIBRECHAT & LOCAL MODEL CHECKS PASSED 100%!")

if __name__ == '__main__':
    test_app()
