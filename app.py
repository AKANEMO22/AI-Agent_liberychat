import os
import sys
import io
import json
import time
import uuid
import sqlite3
import urllib.request
import urllib.error
import subprocess
from pathlib import Path
from typing import Dict, Any, List, Optional

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Initialize App
app = FastAPI(title="LoCode LibreChat - Official Local AI Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
UI_DIR = BASE_DIR / "ui"
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
DB_PATH = DATA_DIR / "librechat_local.sqlite"
WORKSPACES_FILE = BASE_DIR / "workspaces.json"

OLLAMA_BASE_URL = "http://127.0.0.1:11434"
DEFAULT_MODEL = "qwen2.5-coder:7b"

# ==============================================================================
# DATABASE INITIALIZATION
# ==============================================================================
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            conversationId TEXT PRIMARY KEY,
            title TEXT,
            endpoint TEXT,
            model TEXT,
            createdAt INTEGER,
            updatedAt INTEGER
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            messageId TEXT PRIMARY KEY,
            conversationId TEXT,
            parentMessageId TEXT,
            sender TEXT,
            text TEXT,
            isCreatedByUser INTEGER,
            createdAt INTEGER,
            FOREIGN KEY (conversationId) REFERENCES conversations(conversationId) ON DELETE CASCADE
        )
    """)
    conn.commit()
    conn.close()

init_db()

# ==============================================================================
# WORKSPACE REGISTRY HELPERS
# ==============================================================================
DEFAULT_WORKSPACES = {
    "activeWorkspaceId": "ws_agent_test",
    "workspaces": [
        {
            "id": "ws_agent_test",
            "name": "workspace-agent-test",
            "root": str(BASE_DIR / "workspace-agent-test"),
            "createdAt": int(time.time() * 1000),
            "lastOpened": int(time.time() * 1000),
            "projectType": "Python / Unit Test Fixture",
            "hasGit": True,
            "type": "project"
        },
        {
            "id": "ws_librechat",
            "name": "LibreChat",
            "root": str(BASE_DIR / "LibreChat"),
            "createdAt": int(time.time() * 1000),
            "lastOpened": int(time.time() * 1000),
            "projectType": "TypeScript / React / Node.js",
            "hasGit": True,
            "type": "project"
        }
    ]
}

def load_workspaces_registry() -> Dict[str, Any]:
    if WORKSPACES_FILE.exists():
        try:
            data = json.loads(WORKSPACES_FILE.read_text(encoding="utf-8"))
            if "workspaces" in data and isinstance(data["workspaces"], list):
                return data
        except Exception:
            pass
    save_workspaces_registry(DEFAULT_WORKSPACES)
    return DEFAULT_WORKSPACES

def save_workspaces_registry(data: Dict[str, Any]):
    try:
        WORKSPACES_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
    except Exception as e:
        print(f"[WorkspaceRegistry] Error saving workspaces.json: {e}")

# ==============================================================================
# WORKSPACE REST API ENDPOINTS
# ==============================================================================

@app.get("/api/workspaces")
def get_workspaces():
    reg = load_workspaces_registry()
    workspaces_list = []
    for w in reg.get("workspaces", []):
        root_path = Path(w.get("root", ""))
        is_avail = False
        try:
            if w.get("type") == "single_file":
                target = w.get("targetFile") or w.get("name")
                file_path = root_path / target
                is_avail = file_path.is_file()
            else:
                is_avail = root_path.is_dir()
        except Exception:
            is_avail = False

        workspaces_list.append({
            "id": w.get("id"),
            "type": w.get("type", "project"),
            "name": w.get("name"),
            "root": str(root_path),
            "targetFile": w.get("targetFile"),
            "allowedFiles": w.get("allowedFiles"),
            "createdAt": w.get("createdAt", int(time.time() * 1000)),
            "lastOpened": w.get("lastOpened", int(time.time() * 1000)),
            "projectType": w.get("projectType", "General Codebase"),
            "hasGit": w.get("hasGit", False),
            "isAvailable": is_avail
        })

    active_id = reg.get("activeWorkspaceId") or (workspaces_list[0]["id"] if workspaces_list else "")
    return {
        "activeWorkspaceId": active_id,
        "workspaces": workspaces_list
    }

class SelectWorkspaceReq(BaseModel):
    workspaceId: str

@app.post("/api/workspaces/select")
def select_workspace(req: SelectWorkspaceReq):
    reg = load_workspaces_registry()
    ws = next((w for w in reg.get("workspaces", []) if w.get("id") == req.workspaceId), None)
    if not ws:
        raise HTTPException(status_code=400, detail=f"Workspace ID '{req.workspaceId}' not found.")

    ws["lastOpened"] = int(time.time() * 1000)
    reg["activeWorkspaceId"] = ws["id"]
    save_workspaces_registry(reg)
    return {"status": "SELECTED", "activeWorkspace": ws}

class BrowsePathReq(BaseModel):
    targetPath: Optional[str] = None
    mode: Optional[str] = "folder"

@app.post("/api/workspaces/browse")
def browse_workspaces(req: BrowsePathReq):
    sys_drive = os.environ.get("SystemDrive", "C:")
    user_home = os.environ.get("USERPROFILE") or str(Path(sys_drive) / "Users")
    target_str = req.targetPath.strip() if req.targetPath else user_home
    mode = req.mode or "folder"

    try:
        current_dir = Path(target_str).resolve()
        if not current_dir.exists():
            current_dir = Path(user_home).resolve()
        if not current_dir.is_dir():
            current_dir = current_dir.parent

        directories = []
        files = []

        try:
            for entry in current_dir.iterdir():
                if entry.name.startswith(".") or entry.name.startswith("$"):
                    continue
                try:
                    if entry.is_dir():
                        directories.append({"name": entry.name, "path": str(entry)})
                    elif entry.is_file() and mode == "file":
                        files.append({"name": entry.name, "path": str(entry), "size": entry.stat().st_size})
                except (PermissionError, OSError):
                    continue
        except (PermissionError, OSError):
            pass

        directories.sort(key=lambda x: x["name"].lower())
        files.sort(key=lambda x: x["name"].lower())

        parent = str(current_dir.parent) if current_dir.parent != current_dir else None

        return {
            "currentPath": str(current_dir),
            "parentPath": parent,
            "directories": directories[:100],
            "files": files[:100]
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

class AddFolderReq(BaseModel):
    folderPath: str
    name: Optional[str] = None

@app.post("/api/workspaces/add")
def add_folder_workspace(req: AddFolderReq):
    folder_path = Path(req.folderPath.strip()).resolve()
    if not folder_path.exists() or not folder_path.is_dir():
        raise HTTPException(status_code=400, detail=f"Folder not found on disk: '{req.folderPath}'")

    reg = load_workspaces_registry()
    ws_name = req.name.strip() if req.name and req.name.strip() else folder_path.name
    ws_id = f"ws_{uuid.uuid4().hex[:8]}"

    has_git = (folder_path / ".git").is_dir()
    new_ws = {
        "id": ws_id,
        "type": "project",
        "name": ws_name,
        "root": str(folder_path),
        "createdAt": int(time.time() * 1000),
        "lastOpened": int(time.time() * 1000),
        "projectType": "Codebase Project",
        "hasGit": has_git
    }

    # Avoid duplicate roots
    existing = next((w for w in reg.get("workspaces", []) if w.get("root") == str(folder_path) and w.get("type") == "project"), None)
    if existing:
        existing["lastOpened"] = int(time.time() * 1000)
        reg["activeWorkspaceId"] = existing["id"]
        save_workspaces_registry(reg)
        return {"status": "REGISTERED", "workspace": existing}

    reg["workspaces"].append(new_ws)
    reg["activeWorkspaceId"] = ws_id
    save_workspaces_registry(reg)
    return {"status": "REGISTERED", "workspace": new_ws}

class AddFileReq(BaseModel):
    filePath: str
    name: Optional[str] = None

@app.post("/api/workspaces/add-file")
def add_file_workspace(req: AddFileReq):
    file_path = Path(req.filePath.strip()).resolve()
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=400, detail=f"File not found on disk: '{req.filePath}'")

    reg = load_workspaces_registry()
    file_name = file_path.name
    parent_dir = str(file_path.parent)
    ws_name = req.name.strip() if req.name and req.name.strip() else file_name
    ws_id = f"ws_file_{uuid.uuid4().hex[:8]}"

    new_ws = {
        "id": ws_id,
        "type": "single_file",
        "name": ws_name,
        "root": parent_dir,
        "targetFile": file_name,
        "allowedFiles": [file_name],
        "createdAt": int(time.time() * 1000),
        "lastOpened": int(time.time() * 1000),
        "projectType": f"{file_path.suffix.upper() or 'Text'} File",
        "hasGit": (file_path.parent / ".git").is_dir()
    }

    reg["workspaces"].append(new_ws)
    reg["activeWorkspaceId"] = ws_id
    save_workspaces_registry(reg)
    return {"status": "REGISTERED", "workspace": new_ws}

class EscalateReq(BaseModel):
    workspaceId: str

@app.post("/api/workspaces/escalate")
def escalate_workspace(req: EscalateReq):
    reg = load_workspaces_registry()
    ws = next((w for w in reg.get("workspaces", []) if w.get("id") == req.workspaceId), None)
    if not ws:
        raise HTTPException(status_code=400, detail="Workspace not found")

    folder_path = Path(ws.get("root", ""))
    return add_folder_workspace(AddFolderReq(folderPath=str(folder_path)))

class PickReq(BaseModel):
    mode: Optional[str] = "folder"
    initialDir: Optional[str] = ""

@app.post("/api/workspaces/pick")
def pick_native_path(req: PickReq):
    mode = req.mode or "folder"
    script_path = BASE_DIR / "LibreChat" / "api" / "server" / "services" / "native-picker.ps1"
    start_dir = req.initialDir if req.initialDir and Path(req.initialDir).exists() else os.environ.get("USERPROFILE", "C:\\")

    try:
        res = subprocess.run(
            [
                "powershell.exe",
                "-NoProfile",
                "-STA",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(script_path),
                "-Mode",
                mode,
                "-InitialDir",
                str(start_dir)
            ],
            capture_output=True,
            text=True,
            timeout=120
        )
        lines = [l.strip() for l in (res.stdout or "").splitlines() if l.strip()]
        selected = None
        for line in reversed(lines):
            try:
                parsed = json.loads(line)
                if parsed.get("status") == "selected" and parsed.get("path"):
                    selected = parsed.get("path")
                    break
                elif parsed.get("status") == "cancelled":
                    return {"status": "CANCELLED", "selectedPath": None}
            except Exception:
                pass
        if not selected and lines:
            raw = lines[-1]
            if Path(raw).exists():
                selected = raw

        if not selected or not Path(selected).exists():
            return {"status": "CANCELLED", "selectedPath": None}

        if mode == "folder":
            ws = add_folder_workspace(AddFolderReq(folderPath=selected))
        else:
            ws = add_file_workspace(AddFileReq(filePath=selected))

        return {"status": "SELECTED", "mode": mode, "selectedPath": selected, "workspace": ws.get("workspace")}
    except Exception as e:
        return JSONResponse(status_code=400, content={"error": str(e)})

@app.delete("/api/workspaces/{workspace_id}")
def delete_workspace(workspace_id: str):
    reg = load_workspaces_registry()
    initial_len = len(reg.get("workspaces", []))
    reg["workspaces"] = [w for w in reg.get("workspaces", []) if w.get("id") != workspace_id]
    if len(reg["workspaces"]) < initial_len:
        if reg.get("activeWorkspaceId") == workspace_id:
            reg["activeWorkspaceId"] = reg["workspaces"][0]["id"] if reg["workspaces"] else ""
        save_workspaces_registry(reg)
        return {"status": "REMOVED_FROM_REGISTRY", "removedId": workspace_id}
    raise HTTPException(status_code=404, detail="Workspace not found")

# ==============================================================================
# LOCAL AUTH & HEALTH STATUS ENDPOINTS
# ==============================================================================

@app.get("/api/auth/local-status")
def get_local_status():
    models_list = []
    ollama_ok = False
    try:
        req = urllib.request.Request(f"{OLLAMA_BASE_URL}/api/tags")
        with urllib.request.urlopen(req, timeout=1.5) as res:
            data = json.loads(res.read().decode("utf-8"))
            if "models" in data:
                models_list = [m["name"] for m in data["models"]]
                ollama_ok = True
    except Exception:
        pass

    reg = load_workspaces_registry()
    active_ws = reg.get("activeWorkspaceId") or "ws_agent_test"

    return {
        "ollama": {
            "ok": ollama_ok,
            "status": "online" if ollama_ok else "offline",
            "model": "qwen2.5-coder-local"
        },
        "adapter": {
            "ok": True,
            "status": "healthy"
        },
        "gpu": {
            "ok": True,
            "status": "NVIDIA GPU Detected (RTX 4050 6GB VRAM)"
        },
        "mcp": {
            "ok": True,
            "toolCount": 10
        },
        "workspace": {
            "ok": True,
            "id": active_ws
        },
        "modes": {
            "light": True,
            "medium": True,
            "high": True
        }
    }

@app.post("/api/auth/local-start")
def local_start_session():
    return {
        "token": "local_dev_token_qwen",
        "user": {
            "id": "locode_user_01",
            "email": "user@locode.local",
            "name": "Local Developer",
            "username": "developer",
            "role": "ADMIN"
        }
    }

@app.post("/api/auth/local-warmup")
def local_warmup():
    return {"success": True, "latencyMs": 10}

# ==============================================================================
# AUXILIARY API ENDPOINTS (PREVENT TANSTACK QUERY RETRY CASCADES)
# ==============================================================================

@app.get("/api/banner")
def get_banner():
    return {"banner": ""}

@app.get("/api/presets")
def get_presets():
    return []

@app.get("/api/prompts")
def get_prompts():
    return {"prompts": [], "pages": 1}

@app.get("/api/agents")
def get_agents():
    return {"agents": []}

@app.get("/api/roles")
def get_roles():
    return {}

@app.get("/api/share")
def get_shares():
    return []

@app.get("/api/keys")
def get_keys():
    return {}

@app.get("/api/tags")
def get_tags():
    return []

@app.get("/api/categories")
def get_categories():
    return []

@app.get("/api/balance")
def get_balance():
    return {"credits": 0}

@app.get("/api/settings")
def get_settings():
    return {}

@app.get("/api/files")
def get_files():
    return []

@app.get("/api/mcp/servers")
def get_mcp_servers():
    return []

# ==============================================================================
# LIBRECHAT CORE API ENDPOINTS
# ==============================================================================

@app.get("/api/config")
def get_librechat_config():
    return {
        "appTitle": "LoCode LibreChat (Local Qwen 2.5 Coder 7B)",
        "version": "v0.8.8",
        "interface": {
            "modelSelect": True,
            "parameters": True,
            "presets": True,
            "prompts": {"use": True, "create": True},
            "bookmarks": True,
            "multiConvo": True,
            "agents": {"use": True, "create": True},
            "artifacts": True
        },
        "endpoints": {
            "custom": [
                {
                    "name": "Local-Ollama",
                    "label": "Qwen 2.5 Coder 7B (Local GPU)",
                    "models": {"default": [DEFAULT_MODEL], "fetch": True},
                    "titleModel": DEFAULT_MODEL,
                    "default": True
                }
            ]
        },
        "modelSpecs": {
            "list": [
                {
                    "name": DEFAULT_MODEL,
                    "label": "Qwen 2.5 Coder 7B",
                    "description": "Default Workspace Coding Assistant running on RTX 4050 GPU",
                    "group": "Local-Ollama",
                    "preset": {
                        "endpoint": "custom",
                        "model": DEFAULT_MODEL,
                        "temperature": 0.2,
                        "top_p": 0.95
                    }
                }
            ]
        },
        "models": {
            "custom": [DEFAULT_MODEL],
            "default": DEFAULT_MODEL
        },
        "defaultEndpoint": "custom",
        "defaultModel": DEFAULT_MODEL
    }

@app.get("/api/models")
def get_models():
    models_list = [DEFAULT_MODEL]
    try:
        req = urllib.request.Request(f"{OLLAMA_BASE_URL}/api/tags")
        with urllib.request.urlopen(req, timeout=1.5) as res:
            data = json.loads(res.read().decode("utf-8"))
            if "models" in data:
                models_list = [m["name"] for m in data["models"]]
    except Exception:
        pass

    return {
        "custom": models_list,
        "initial": {
            "custom": DEFAULT_MODEL
        }
    }

@app.get("/api/endpoints")
def get_endpoints():
    return {
        "custom": {
            "name": "Local-Ollama",
            "availableModels": [DEFAULT_MODEL]
        }
    }

@app.get("/api/user")
def get_current_user():
    return {
        "id": "locode_user_01",
        "email": "user@locode.local",
        "name": "Local Developer",
        "username": "developer",
        "role": "ADMIN",
        "avatar": None,
        "plugins": []
    }

@app.get("/api/convos")
def get_conversations():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM conversations ORDER BY updatedAt DESC")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return {"conversations": rows, "pages": 1, "pageNumber": 1}

@app.get("/api/convos/{conversation_id}")
def get_conversation_messages(conversation_id: str):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM conversations WHERE conversationId = ?", (conversation_id,))
    convo = c.fetchone()
    if not convo:
        conn.close()
        return {"conversation": None, "messages": []}

    c.execute("SELECT * FROM messages WHERE conversationId = ? ORDER BY createdAt ASC", (conversation_id,))
    messages = [dict(r) for r in c.fetchall()]
    conn.close()
    return {"conversation": dict(convo), "messages": messages}

@app.delete("/api/convos/clear")
def clear_all_convos():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("DELETE FROM messages")
    c.execute("DELETE FROM conversations")
    conn.commit()
    conn.close()
    return {"success": True}

# ==============================================================================
# STREAM CHAT / ASK ENDPOINTS (CONNECTED TO LOCAL OLLAMA QWEN 2.5 CODER)
# ==============================================================================

class AskReq(BaseModel):
    conversationId: Optional[str] = None
    parentMessageId: Optional[str] = None
    text: str
    model: Optional[str] = DEFAULT_MODEL
    endpoint: Optional[str] = "custom"
    temperature: Optional[float] = 0.2
    top_p: Optional[float] = 0.95
    promptPrefix: Optional[str] = None

@app.post("/api/ask/custom")
@app.post("/api/ask")
@app.post("/api/chat/stream")
async def handle_ask(req: AskReq):
    convo_id = req.conversationId or str(uuid.uuid4())
    user_msg_id = str(uuid.uuid4())
    ai_msg_id = str(uuid.uuid4())
    now_ms = int(time.time() * 1000)

    # Save to SQLite
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        INSERT OR REPLACE INTO conversations (conversationId, title, endpoint, model, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (convo_id, req.text[:40], req.endpoint or "custom", req.model or DEFAULT_MODEL, now_ms, now_ms))

    c.execute("""
        INSERT INTO messages (messageId, conversationId, parentMessageId, sender, text, isCreatedByUser, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (user_msg_id, convo_id, req.parentMessageId, "User", req.text, 1, now_ms))
    conn.commit()
    conn.close()

    # Build Ollama prompt
    system_prompt = req.promptPrefix or "You are LoCode, an expert AI programming assistant powered by Qwen 2.5 Coder 7B."
    prompt = f"<|im_start|>system\n{system_prompt}<|im_end|>\n<|im_start|>user\n{req.text}<|im_end|>\n<|im_start|>assistant\n"

    ollama_payload = {
        "model": req.model or DEFAULT_MODEL,
        "prompt": prompt,
        "stream": True,
        "options": {
            "temperature": req.temperature or 0.2,
            "top_p": req.top_p or 0.95,
            "num_ctx": 4096
        }
    }

    def sse_stream():
        collected_tokens = []
        try:
            req_data = json.dumps(ollama_payload).encode("utf-8")
            url_req = urllib.request.Request(
                f"{OLLAMA_BASE_URL}/api/generate",
                data=req_data,
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(url_req, timeout=120) as stream_res:
                for line in stream_res:
                    if line:
                        chunk = json.loads(line.decode("utf-8"))
                        token = chunk.get("response", "")
                        collected_tokens.append(token)
                        done = chunk.get("done", False)

                        librechat_chunk = {
                            "messageId": ai_msg_id,
                            "conversationId": convo_id,
                            "parentMessageId": user_msg_id,
                            "sender": "LoCode (Qwen 2.5 Coder 7B)",
                            "text": "".join(collected_tokens),
                            "token": token,
                            "done": done
                        }
                        yield f"data: {json.dumps(librechat_chunk)}\n\n"
                        if done:
                            break
        except Exception as e:
            err_chunk = {
                "messageId": ai_msg_id,
                "conversationId": convo_id,
                "text": f"Lỗi kết nối Ollama: {str(e)}",
                "done": True
            }
            yield f"data: {json.dumps(err_chunk)}\n\n"

        # Save AI reply to SQLite
        final_reply = "".join(collected_tokens)
        if final_reply:
            conn_end = sqlite3.connect(DB_PATH)
            c_end = conn_end.cursor()
            c_end.execute("""
                INSERT INTO messages (messageId, conversationId, parentMessageId, sender, text, isCreatedByUser, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (ai_msg_id, convo_id, user_msg_id, "LoCode", final_reply, 0, int(time.time() * 1000)))
            conn_end.commit()
            conn_end.close()

    return StreamingResponse(sse_stream(), media_type="text/event-stream")

# ==============================================================================
# MULTI-LANGUAGE SANDBOX EXECUTION API
# ==============================================================================
class SandboxRunReq(BaseModel):
    code: str
    language: str
    timeout: Optional[int] = 15

@app.post("/api/sandbox/run")
def run_sandbox(req: SandboxRunReq):
    start_time = time.perf_counter()
    lang = req.language.lower()
    code = req.code
    timeout = req.timeout or 15

    cmd = []
    temp_file = None

    try:
        if lang in ["python", "py"]:
            temp_file = DATA_DIR / f"temp_{uuid.uuid4().hex[:8]}.py"
            temp_file.write_text(code, encoding="utf-8")
            cmd = [sys.executable, str(temp_file)]
        elif lang in ["javascript", "js", "node"]:
            temp_file = DATA_DIR / f"temp_{uuid.uuid4().hex[:8]}.js"
            temp_file.write_text(code, encoding="utf-8")
            cmd = ["node", str(temp_file)]
        else:
            temp_file = DATA_DIR / f"temp_{uuid.uuid4().hex[:8]}.bat"
            temp_file.write_text(code, encoding="utf-8")
            cmd = ["cmd.exe", "/c", str(temp_file)]

        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            encoding="utf-8",
            errors="replace"
        )
        duration_ms = int((time.perf_counter() - start_time) * 1000)
        return {
            "success": proc.returncode == 0,
            "output": proc.stdout,
            "error": proc.stderr,
            "exit_code": proc.returncode,
            "duration_ms": duration_ms,
            "language": lang
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "output": "", "error": f"Quá thời gian thực thi ({timeout}s)", "exit_code": -1, "duration_ms": timeout * 1000, "language": lang}
    except Exception as e:
        return {"success": False, "output": "", "error": str(e), "exit_code": 1, "duration_ms": 0, "language": lang}
    finally:
        if temp_file and temp_file.exists():
            try:
                temp_file.unlink()
            except Exception:
                pass

# ==============================================================================
# SERVE LIBRECHAT CLIENT & SPA FALLBACK
# ==============================================================================
if UI_DIR.exists():
    # Mount assets directory
    assets_dir = UI_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    # Explicit 404 for unmatched /api routes
    @app.api_route("/api/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    async def handle_unmatched_api(path_name: str):
        return JSONResponse(status_code=404, content={"error": f"API endpoint not found: /api/{path_name}"})

    # Catch-all SPA route
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = UI_DIR / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        index_path = UI_DIR / "index.html"
        if index_path.exists():
            return HTMLResponse(index_path.read_text(encoding="utf-8"))
        return HTMLResponse("<h1>LibreChat is building...</h1>")

if __name__ == "__main__":
    port = 41792
    print(f"🚀 Starting LoCode LibreChat on http://127.0.0.1:{port}")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
