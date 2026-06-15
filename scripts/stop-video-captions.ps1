param(
  [switch]$Quiet
)

$ErrorActionPreference = "Continue"

$Patterns = @(
  "InkDrop\\local-engines\\video-captions.*npm.cmd run server",
  "InkDrop\\local-engines\\video-captions.*src/api/server.ts",
  "InkDrop\\local-engines\\video-captions.*tsx.*server",
  "InkDrop.*npm.cmd run dev.*--port 5173",
  "InkDrop.*npm.cmd run preview.*--port 5173",
  "InkDrop.*vite.*--port.*5173"
)

$Processes = @()
try {
  $Processes = Get-CimInstance Win32_Process | Where-Object {
    $CommandLine = $_.CommandLine
    if (-not $CommandLine) {
      return $false
    }

    foreach ($Pattern in $Patterns) {
      if ($CommandLine -match $Pattern) {
        return $true
      }
    }

    return $false
  }
} catch {
  if (-not $Quiet) {
    Write-Host "Could not inspect running processes. Close the InkDrop/video-captions PowerShell windows manually if needed." -ForegroundColor Yellow
  }
  exit 0
}

foreach ($Process in $Processes) {
  try {
    Stop-Process -Id $Process.ProcessId -Force -ErrorAction Stop
    if (-not $Quiet) {
      Write-Host "Stopped process $($Process.ProcessId): $($Process.Name)"
    }
  } catch {
    if (-not $Quiet) {
      Write-Host "Could not stop process $($Process.ProcessId): $_" -ForegroundColor Yellow
    }
  }
}

if (-not $Quiet -and $Processes.Count -eq 0) {
  Write-Host "No local video caption servers were running."
}
