Param()
$ErrorActionPreference = "Stop"

$ROOT = Resolve-Path "$PSScriptRoot/.."
$PORT = $Env:API_PORT
if (-not $PORT) { $PORT = 5050 }

Set-Location "$ROOT/apps/api"

if (Test-Path ".venv/Scripts/Activate.ps1") {
  . ".venv/Scripts/Activate.ps1"
}

if (-not $Env:PROJECT_ROOT) {
  $Env:PROJECT_ROOT = $ROOT
}

python -m uvicorn main:app --reload --port $PORT
