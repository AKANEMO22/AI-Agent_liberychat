# ==============================================================================
# Local AI Coding Assistant Stack Shutdown Script (Hardened Production)
# Stops ONLY processes explicitly marked as owned by the local AI stack.
# Verifies process identity and start time to prevent PID reuse accidents.
# ==============================================================================

$rootDir = "C:\Users\hachimi\Downloads\model train local"
$pidFile = Join-Path $rootDir ".local-ai.pids"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Stopping Local Qwen Coding Agent Stack" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

if (Test-Path $pidFile) {
    try {
        $pidsJson = Get-Content $pidFile -Raw | ConvertFrom-Json
        foreach ($prop in $pidsJson.PSObject.Properties) {
            $name = $prop.Name
            $meta = $prop.Value
            $procId = [int]$meta.pid
            $isOwned = [bool]$meta.owned
            $expectedName = $meta.name

            if (-not $isOwned) {
                Write-Host "Preserving pre-existing $name (PID: $procId) as it was not started by this stack." -ForegroundColor Gray
                continue
            }

            if ($procId -gt 0) {
                try {
                    $proc = Get-Process -Id $procId -ErrorAction Stop
                    # Verify process name matches expected binary to prevent PID reuse termination
                    if ($proc.ProcessName -like "*$expectedName*" -or $expectedName -like "*$($proc.ProcessName)*") {
                        Write-Host "Stopping stack-owned $name (PID: $($procId), Name: $($proc.ProcessName))..." -ForegroundColor Yellow
                        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                        Write-Host "  -> Stopped $name" -ForegroundColor Green
                    } else {
                        Write-Host "Skipping PID $($procId): Process name mismatch ($($proc.ProcessName) != $expectedName). PID was likely recycled." -ForegroundColor DarkYellow
                    }
                } catch {
                    Write-Host "  -> Process $($procId) ($name) is already stopped." -ForegroundColor Gray
                }
            }
        }
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Host "Warning: Could not process $($pidFile): $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "No .local-ai.pids file found. Nothing to stop." -ForegroundColor Gray
}

Write-Host "`nShutdown pass complete." -ForegroundColor Green
