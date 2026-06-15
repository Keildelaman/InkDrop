$ErrorActionPreference = "Continue"

$EngineRoot = Split-Path -Parent $PSScriptRoot
$VenvPython = Join-Path $EngineRoot ".venv\Scripts\python.exe"
$Python = $env:INKDROP_VIDEO_CAPTIONS_PYTHON
if (-not $Python -and (Test-Path $VenvPython)) {
  $Python = $VenvPython
}
if (-not $Python) {
  $Python = "python"
}

$Failures = 0

function Test-CommandStep {
  param(
    [string]$Name,
    [string]$Command,
    [string[]]$Arguments
  )

  Write-Host ""
  Write-Host "==> $Name" -ForegroundColor Cyan
  try {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "$Command exited with code $LASTEXITCODE"
    }
    Write-Host "OK" -ForegroundColor Green
  } catch {
    Write-Host "FAILED: $_" -ForegroundColor Red
    $script:Failures += 1
  }
}

Test-CommandStep "Node" "node" @("--version")
Test-CommandStep "FFmpeg" "ffmpeg" @("-version")
Test-CommandStep "ffprobe" "ffprobe" @("-version")
Test-CommandStep "Python" $Python @("-c", "import sys; print(sys.executable); print(sys.version)")
Test-CommandStep "WhisperX and CUDA" $Python @("-c", "import torch, whisperx; print('whisperx ready'); print('cuda=' + str(torch.cuda.is_available())); print('device=' + (torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'cpu'))")

Write-Host ""
if ($Failures -eq 0) {
  Write-Host "Video captions environment is ready." -ForegroundColor Green
  exit 0
}

Write-Host "$Failures check(s) failed." -ForegroundColor Red
Write-Host "If WhisperX is missing, run:"
Write-Host "npm run setup:whisperx"
Write-Host ""
Write-Host "To force a specific Python interpreter:"
Write-Host '$env:INKDROP_VIDEO_CAPTIONS_PYTHON="C:\path\to\python.exe"'
exit 1
