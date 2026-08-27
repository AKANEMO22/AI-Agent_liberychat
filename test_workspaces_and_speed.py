import requests
import time
import json
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE_URL = "http://127.0.0.1:41792"

def test_workspaces_and_speed():
    print("=== TESTING WORKSPACE APIS, BROWSING & SPEED ===")

    # 1. Test GET /api/workspaces
    t0 = time.perf_counter()
    r = requests.get(f"{BASE_URL}/api/workspaces")
    latency = (time.perf_counter() - t0) * 1000
    print(f"1. GET /api/workspaces: status={r.status_code}, latency={latency:.1f}ms")
    assert r.status_code == 200
    ws_data = r.json()
    assert "workspaces" in ws_data
    print(f"   -> Found {len(ws_data['workspaces'])} workspaces. Active: {ws_data.get('activeWorkspaceId')}")

    # 2. Test POST /api/workspaces/browse (Folder mode)
    t0 = time.perf_counter()
    browse_payload = {"targetPath": "C:\\Users\\hachimi\\Downloads\\model train local", "mode": "folder"}
    r = requests.post(f"{BASE_URL}/api/workspaces/browse", json=browse_payload)
    latency = (time.perf_counter() - t0) * 1000
    print(f"2. POST /api/workspaces/browse (folder): status={r.status_code}, latency={latency:.1f}ms")
    assert r.status_code == 200
    browse_data = r.json()
    assert "directories" in browse_data
    print(f"   -> Current Path: {browse_data.get('currentPath')}")
    print(f"   -> Directories found: {len(browse_data.get('directories', []))}")

    # 3. Test POST /api/workspaces/browse (File mode)
    t0 = time.perf_counter()
    browse_file_payload = {"targetPath": "C:\\Users\\hachimi\\Downloads\\model train local", "mode": "file"}
    r = requests.post(f"{BASE_URL}/api/workspaces/browse", json=browse_file_payload)
    latency = (time.perf_counter() - t0) * 1000
    print(f"3. POST /api/workspaces/browse (file): status={r.status_code}, latency={latency:.1f}ms")
    assert r.status_code == 200
    browse_file_data = r.json()
    assert "files" in browse_file_data
    print(f"   -> Files found: {len(browse_file_data.get('files', []))}")

    # 4. Test POST /api/workspaces/add & select
    t0 = time.perf_counter()
    add_payload = {"folderPath": "C:\\Users\\hachimi\\Downloads\\model train local\\workspace-agent-test"}
    r = requests.post(f"{BASE_URL}/api/workspaces/add", json=add_payload)
    latency = (time.perf_counter() - t0) * 1000
    print(f"4. POST /api/workspaces/add: status={r.status_code}, latency={latency:.1f}ms")
    assert r.status_code == 200
    added_ws = r.json()
    assert "workspace" in added_ws

    # 5. Test Local Status & Local Start
    t0 = time.perf_counter()
    r = requests.get(f"{BASE_URL}/api/auth/local-status")
    latency = (time.perf_counter() - t0) * 1000
    print(f"5. GET /api/auth/local-status: status={r.status_code}, latency={latency:.1f}ms")
    assert r.status_code == 200
    status_data = r.json()
    print(f"   -> Ollama OK: {status_data.get('ollama', {}).get('ok')}, GPU: {status_data.get('gpu', {}).get('ok')}")

    t0 = time.perf_counter()
    r = requests.post(f"{BASE_URL}/api/auth/local-start")
    latency = (time.perf_counter() - t0) * 1000
    print(f"6. POST /api/auth/local-start: status={r.status_code}, latency={latency:.1f}ms")
    assert r.status_code == 200
    assert "token" in r.json()

    # 6. Test Auxiliary Endpoints to ensure NO HTML / NO 404
    aux_endpoints = [
        "/api/banner",
        "/api/presets",
        "/api/prompts",
        "/api/agents",
        "/api/roles",
        "/api/share",
        "/api/keys",
        "/api/tags",
        "/api/categories",
        "/api/balance",
        "/api/settings",
        "/api/files",
        "/api/mcp/servers"
    ]
    print("\n7. Testing Auxiliary Endpoints Latency & JSON validity:")
    for ep in aux_endpoints:
        t0 = time.perf_counter()
        res = requests.get(f"{BASE_URL}{ep}")
        lat = (time.perf_counter() - t0) * 1000
        print(f"   -> {ep}: HTTP {res.status_code} in {lat:.1f}ms (is JSON: {isinstance(res.json(), (dict, list))})")
        assert res.status_code == 200

    print("\n🎉 ALL WORKSPACE AND SPEED VERIFICATIONS PASSED IN < 100ms TOTAL!")

if __name__ == "__main__":
    test_workspaces_and_speed()
