# ==============================================================================
# Local AI Stack - One-Click Start & Port Conflict Resolver
# ==============================================================================

$ErrorActionPreference = "Continue"
$rootDir = $PSScriptRoot
if (-not $rootDir) { $rootDir = "C:\Users\hachimi\Downloads\model train local" }
Set-Location $rootDir

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " KHOI DONG LOCAL QWEN AI (LOCALHOST:3080)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Giai phong cac cong 3080, 27017, 8090 neu bi chiem dung
Write-Host "`n[1/3] Kiem tra va giai phong cong neu bi trung..." -ForegroundColor Yellow
$ports = @(3080, 27017, 8090)
foreach ($port in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conns) {
        foreach ($c in $conns) {
            $p = $c.OwningProcess
            if ($p -gt 0) {
                Write-Host "  -> Phat hien tien trinh chiem cong $($port) (PID: $($p)). Dang kill..." -ForegroundColor Yellow
                Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
                Write-Host "  -> Da giai phong cong $($port) thanh cong!" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "  -> Cong $($port): San sang" -ForegroundColor DarkGray
    }
}

# 2. Khoi dong cac dich vu
Write-Host "`n[2/3] Khoi dong cac dich vu stack..." -ForegroundColor Yellow

# MongoDB (:27017)
Write-Host "  -> Bat MongoDB Memory Server..." -ForegroundColor Gray
$mongoDir = Join-Path $rootDir "LibreChat"
Start-Process -FilePath "node" -ArgumentList "scripts/start-mongo.js" -WorkingDirectory $mongoDir -WindowStyle Hidden
for ($i = 0; $i -lt 15; $i++) {
    $check = Get-NetTCPConnection -LocalPort 27017 -State Listen -ErrorAction SilentlyContinue
    if ($check) { break }
    Start-Sleep -Seconds 1
}
Write-Host "  -> MongoDB san sang (:27017)" -ForegroundColor Green

# Ollama (:11434)
try {
    $null = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "  -> Ollama san sang (:11434)" -ForegroundColor Green
} catch {
    Write-Host "  -> Bat Ollama service..." -ForegroundColor Gray
    Start-Process -FilePath "ollama" -ArgumentList "serve" -WorkingDirectory $rootDir -WindowStyle Hidden
    Start-Sleep -Seconds 3
    Write-Host "  -> Ollama san sang (:11434)" -ForegroundColor Green
}

# Tool Adapter (:8090)
Write-Host "  -> Bat OpenAI Tool Adapter..." -ForegroundColor Gray
$adapterDir = Join-Path $rootDir "openai-tool-adapter"
Start-Process -FilePath "node" -ArgumentList "index.js" -WorkingDirectory $adapterDir -WindowStyle Hidden
for ($i = 0; $i -lt 10; $i++) {
    $check = Get-NetTCPConnection -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue
    if ($check) { break }
    Start-Sleep -Seconds 1
}
Write-Host "  -> OpenAI Tool Adapter san sang (:8090)" -ForegroundColor Green

# LibreChat (:3080)
Write-Host "  -> Bat LibreChat backend..." -ForegroundColor Gray
$libreDir = Join-Path $rootDir "LibreChat"
Start-Process -FilePath "node" -ArgumentList "api/server/index.js" -WorkingDirectory $libreDir -WindowStyle Hidden
for ($i = 0; $i -lt 25; $i++) {
    $check = Get-NetTCPConnection -LocalPort 3080 -State Listen -ErrorAction SilentlyContinue
    if ($check) { break }
    Start-Sleep -Seconds 1
}
Write-Host "  -> LibreChat san sang (:3080)" -ForegroundColor Green

# 3. Mo trinh duyet
Write-Host "`n[3/3] Dang mo trinh duyet vao http://localhost:3080 ..." -ForegroundColor Yellow
Start-Process "http://localhost:3080"

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host " HE THONG DA SAN SANG TAI: http://localhost:3080" -ForegroundColor Green
Write-Host "============================================================`n" -ForegroundColor Cyan
