param(
    [ValidateRange(1, 4)]
    [int]$Player = 1
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# --- Read config -------------------------------------------------------------
$config = Get-Content (Join-Path $root "config/config.json") -Raw | ConvertFrom-Json
$port = $config.gamePort
$base = "http://localhost:$port"

# --- Bail out early if the port is already taken -----------------------------
$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Port $port is already in use (pid $($existing.OwningProcess)). Stop that process first." -ForegroundColor Red
    exit 1
}

# --- Reset the database and start the server ---------------------------------
Write-Host "Resetting database and starting server on $base ..."
$server = Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run devReset" `
    -WorkingDirectory $root -NoNewWindow -PassThru

try {
    # --- Wait for the server to come up --------------------------------------
    $deadline = (Get-Date).AddSeconds(60)
    while ($true) {
        if ($server.HasExited) {
            Write-Host "Server process exited unexpectedly." -ForegroundColor Red
            exit 1
        }
        try {
            Invoke-WebRequest -Uri $base -UseBasicParsing -TimeoutSec 2 | Out-Null
            break
        } catch {
            if ((Get-Date) -gt $deadline) {
                Write-Host "Server did not respond within 60 seconds." -ForegroundColor Red
                exit 1
            }
            Start-Sleep -Milliseconds 500
        }
    }

    # --- Read the freshly generated IDs --------------------------------------
    $db = Get-Content (Join-Path $root "data/db.json") -Raw | ConvertFrom-Json
    $hostUrl = "$base/controller?id=$($db.players[0].id)"
    $playerUrl = "$base/player?id=$($db.players[$Player].id)"

    # --- Open both views in the default browser ------------------------------
    Write-Host "Opening host view:  $hostUrl"
    Start-Process $hostUrl
    Write-Host "Opening player $($Player) view: $playerUrl"
    Start-Process $playerUrl

    Write-Host ""
    Write-Host "Server is running (pid $($server.Id)). Press Ctrl+C to stop." -ForegroundColor Green
    Wait-Process -Id $server.Id
    return
}
finally {
    if ($server -and -not $server.HasExited) {
        # /T kills the whole tree (npm -> nodemon -> node)
        taskkill /PID $server.Id /T /F | Out-Null
    }
}
