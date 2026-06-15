param(
  [string]$Token = ""
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$EngineRoot = Join-Path $Root "local-engines\video-captions"
$StopScript = Join-Path $PSScriptRoot "stop-video-captions.ps1"

if (-not $Token) {
  $Chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".ToCharArray()
  $Token = -join (1..32 | ForEach-Object { $Chars | Get-Random })
}

Write-Host "Stopping old local caption servers..."
& $StopScript -Quiet

$EngineCommand = @"
`$env:INKDROP_VIDEO_CAPTIONS_TOKEN = '$Token'
`$env:INKDROP_VIDEO_CAPTIONS_PORT = '4777'
Set-Location '$EngineRoot'
npm.cmd run server
"@

$AppCommand = @"
Set-Location '$Root'
npm.cmd run build
if (`$LASTEXITCODE -ne 0) { exit `$LASTEXITCODE }
npm.cmd run preview -- --host 127.0.0.1 --port 5173
"@

Write-Host "Starting video captions engine..."
Start-Process -FilePath powershell.exe -ArgumentList @("-NoProfile", "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $EngineCommand) -WindowStyle Minimized | Out-Null

Write-Host "Starting InkDrop local app..."
Start-Process -FilePath powershell.exe -ArgumentList @("-NoProfile", "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $AppCommand) -WindowStyle Minimized | Out-Null

$EngineReady = $false
$AppReady = $false
$Deadline = (Get-Date).AddSeconds(30)

while ((Get-Date) -lt $Deadline -and (-not $EngineReady -or -not $AppReady)) {
  if (-not $EngineReady) {
    try {
      $Response = Invoke-WebRequest -Uri "http://127.0.0.1:4777/health" -UseBasicParsing -TimeoutSec 2
      $EngineReady = $Response.StatusCode -eq 200
    } catch {}
  }

  if (-not $AppReady) {
    try {
      $Response = Invoke-WebRequest -Uri "http://127.0.0.1:5173/InkDrop/" -UseBasicParsing -TimeoutSec 2
      $AppReady = $Response.StatusCode -eq 200
    } catch {}
  }

  if (-not $EngineReady -or -not $AppReady) {
    Start-Sleep -Milliseconds 700
  }
}

Write-Host ""
Write-Host "InkDrop URL:"
Write-Host "http://127.0.0.1:5173/InkDrop/"
Write-Host ""
Write-Host "Video captions engine URL:"
Write-Host "http://127.0.0.1:4777/?token=$Token"
Write-Host ""

if (-not $EngineReady -or -not $AppReady) {
  Write-Host "One or both services did not answer within 30 seconds. Check the opened PowerShell windows for errors." -ForegroundColor Yellow
  exit 1
}

Write-Host "Ready. Keep the two opened PowerShell windows running while using video captions." -ForegroundColor Green
