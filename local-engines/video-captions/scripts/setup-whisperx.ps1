param(
  [string]$Python = "",
  [switch]$CpuOnly,
  [switch]$SkipTorch
)

$ErrorActionPreference = "Stop"

$EngineRoot = Split-Path -Parent $PSScriptRoot
$VenvPath = Join-Path $EngineRoot ".venv"
$VenvPython = Join-Path $VenvPath "Scripts\python.exe"

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

if (-not $Python) {
  $Python = $env:INKDROP_VIDEO_CAPTIONS_PYTHON
}
if (-not $Python) {
  $Python = "python"
}

Write-Step "Checking Python"
& $Python --version

if (-not (Test-Path $VenvPython)) {
  Write-Step "Creating virtual environment"
  & $Python -m venv $VenvPath
} else {
  Write-Step "Using existing virtual environment"
  Write-Host $VenvPython
}

Write-Step "Upgrading pip"
& $VenvPython -m pip install --upgrade pip

if (-not $SkipTorch) {
  Write-Step "Installing PyTorch"
  if ($CpuOnly) {
    & $VenvPython -m pip install torch torchaudio
  } else {
    & $VenvPython -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu126
  }
}

Write-Step "Installing WhisperX"
& $VenvPython -m pip install whisperx

Write-Step "Verifying installation"
& $VenvPython -c "import sys, torch, whisperx; print('python=' + sys.executable); print('torch_cuda=' + str(torch.cuda.is_available())); print('whisperx=ready')"

Write-Host ""
Write-Host "WhisperX setup complete." -ForegroundColor Green
Write-Host "Use this interpreter with the engine:"
Write-Host "`$env:INKDROP_VIDEO_CAPTIONS_PYTHON=`"$VenvPython`""
Write-Host "npm run server"
