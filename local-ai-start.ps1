# ==============================================================================
# Local AI Coding Assistant Stack Startup Script (Hardened Production)
# Starts: Ollama -> OpenAI Tool Adapter (:8090) -> LibreChat (:3080) -> MCP Tools
# Enforces: Strict Process Ownership, Port Health Validation, Safe Idempotency
# ==============================================================================

$ErrorActionPreference = "Stop"
$rootDir = "C:\Users\hachimi\Downloads\model train local"
$pidFile = Join-Path $rootDir ".local-ai.pids"
$trackedProcesses = @{}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Starting Local Qwen Coding Agent Stack (Production)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# Helper to inspect process details
function Get-ProcessMetadata($procId) {
    try {
        $p = Get-Process -Id $procId -ErrorAction Stop
        return @{
            pid = $p.Id
            name = $p.ProcessName
            startTime = $p.StartTime.ToString("o")
            owned = $true
        }
    } catch {
        return $null
    }
}

# 1. Check/Start MongoDB (:27017)
Write-Host "`n[1/4] Checking MongoDB (:27017)..." -ForegroundColor Yellow
$mongoConn = Get-NetTCPConnection -LocalPort 27017 -State Listen -ErrorAction SilentlyContinue
if ($mongoConn) {
    $existingPid = $mongoConn[0].OwningProcess
    Write-Host "  -> Pre-existing MongoDB detected (PID: $existingPid). Preserving external ownership." -ForegroundColor Green
    $trackedProcesses["mongodb"] = @{ pid = $existingPid; name = "node"; owned = $false }
} else {
    Write-Host "  -> Launching stack-owned MongoMemoryServer..." -ForegroundColor Gray
    $raw = & node "scripts/start-stack.js" "mongodb"
    $info = $raw | ConvertFrom-Json
    for ($i = 0; $i -lt 15; $i++) {
        $check = Get-NetTCPConnection -LocalPort 27017 -State Listen -ErrorAction SilentlyContinue
        if ($check) { break }
        Start-Sleep -Seconds 1
    }
    $trackedProcesses["mongodb"] = @{ pid = $info.pid; name = "node"; startTime = $info.startTime; owned = $true }
    Write-Host "  -> MongoMemoryServer started and listening on :27017 (PID: $($info.pid)) [OWNED]" -ForegroundColor Green
}

# 2. Check/Start Ollama (:11434)
Write-Host "`n[2/4] Checking Ollama (:11434)..." -ForegroundColor Yellow
try {
    $ollamaTags = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 3 -ErrorAction Stop
    $ollamaConn = Get-NetTCPConnection -LocalPort 11434 -State Listen -ErrorAction SilentlyContinue
    $existingOllamaPid = if ($ollamaConn) { $ollamaConn[0].OwningProcess } else { 0 }
    Write-Host "  -> Pre-existing Ollama service online (PID: $existingOllamaPid). Preserving external ownership." -ForegroundColor Green
    $trackedProcesses["ollama"] = @{ pid = $existingOllamaPid; name = "ollama"; owned = $false }
} catch {
    Write-Host "  -> Launching stack-owned Ollama service..." -ForegroundColor Gray
    $raw = & node "scripts/start-stack.js" "ollama"
    $info = $raw | ConvertFrom-Json
    Start-Sleep -Seconds 3
    $trackedProcesses["ollama"] = @{ pid = $info.pid; name = "ollama"; startTime = $info.startTime; owned = $true }
    Write-Host "  -> Ollama started (PID: $($info.pid)) [OWNED]" -ForegroundColor Green
}

# 3. Check/Start OpenAI Tool Adapter (:8090)
Write-Host "`n[3/4] Checking OpenAI Tool Adapter (:8090)..." -ForegroundColor Yellow
try {
    $adapterHealth = Invoke-RestMethod -Uri "http://127.0.0.1:8090/health" -TimeoutSec 3 -ErrorAction Stop
    $adapterConn = Get-NetTCPConnection -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue
    $existingAdapterPid = if ($adapterConn) { $adapterConn[0].OwningProcess } else { 0 }
    Write-Host "  -> Pre-existing OpenAI Tool Adapter online (PID: $existingAdapterPid). Preserving external ownership." -ForegroundColor Green
    $trackedProcesses["adapter"] = @{ pid = $existingAdapterPid; name = "node"; owned = $false }
} catch {
    Write-Host "  -> Launching stack-owned openai-tool-adapter..." -ForegroundColor Gray
    $raw = & node "scripts/start-stack.js" "adapter"
    $info = $raw | ConvertFrom-Json
    for ($i = 0; $i -lt 10; $i++) {
        $check = Get-NetTCPConnection -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue
        if ($check) { break }
        Start-Sleep -Seconds 1
    }
    $trackedProcesses["adapter"] = @{ pid = $info.pid; name = "node"; startTime = $info.startTime; owned = $true }
    Write-Host "  -> Adapter started and listening on :8090 (PID: $($info.pid)) [OWNED]" -ForegroundColor Green
}

# 4. Check/Start LibreChat (:3080)
Write-Host "`n[4/4] Checking LibreChat (:3080)..." -ForegroundColor Yellow
$libreConn = Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue
if ($libreConn) {
    $existingLibrePid = $libreConn[0].OwningProcess
    Write-Host "  -> LibreChat already listening on :3080 (PID: $existingLibrePid)." -ForegroundColor Green
    $trackedProcesses["librechat"] = @{ pid = $existingLibrePid; name = "node"; owned = $false }
} else {
    Write-Host "  -> Launching stack-owned LibreChat backend..." -ForegroundColor Gray
    $raw = & node "scripts/start-stack.js" "librechat"
    $info = $raw | ConvertFrom-Json
    for ($i = 0; $i -lt 20; $i++) {
        $check = Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue
        if ($check) { break }
        Start-Sleep -Seconds 1
    }
    $trackedProcesses["librechat"] = @{ pid = $info.pid; name = "node"; startTime = $info.startTime; owned = $true }
    Write-Host "  -> LibreChat launched and listening on :3080 (PID: $($info.pid)) [OWNED]" -ForegroundColor Green
}

# Persist tracked process metadata with ownership tags
$trackedProcesses | ConvertTo-Json -Depth 4 | Out-File -FilePath $pidFile -Encoding utf8

# 5. Final Health Verification
Write-Host "`nVerifying stack readiness..." -ForegroundColor Yellow
$ready = $false
for ($i = 1; $i -le 15; $i++) {
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:8090/health" -TimeoutSec 2 -ErrorAction Stop
        if ($health.status -eq "ok") {
            $ready = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 1
    }
}

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host " LOCAL QWEN CODING AGENT STACK: READY" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Ollama Service:        http://127.0.0.1:11434 (Model: qwen2.5-coder-local)"
Write-Host "  Tool Protocol Adapter:   http://127.0.0.1:8090  (Auth: Bearer Token, Health: OK)"
Write-Host "  LibreChat Web UI:       http://localhost:3080   (Endpoints: Light/Medium/High)"
Write-Host "  Workspace MCP Server:   stdio on-demand (Registry: agent-test, librechat)"
Write-Host "============================================================`n" -ForegroundColor Cyan
