$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$repoRoot = Split-Path $here -Parent
Set-Location $here

$env:MCQ_USE_IN_MEMORY = "1"
$envFile = Join-Path $repoRoot ".env.local"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$") {
      $n = $matches[1]
      $v = $matches[2].Trim().Trim('"')
      if ($n) { Set-Item -Path "Env:$n" -Value $v }
    }
  }
}

if (-not (Test-Path ".venv")) {
  Write-Host "Creating Python venv in ai-backend/.venv ..."
  python -m venv .venv
}
& .\.venv\Scripts\Activate.ps1
pip install -q -r requirements.txt

# Default 8010 — on some Windows setups port 8001 hits WinError 10013 (blocked / Hyper-V / in use).
$port = $env:MCQ_ENGINE_PORT
if ([string]::IsNullOrWhiteSpace($port)) { $port = "8010" }

Write-Host "MCQ engine: http://127.0.0.1:$port  (in-memory Mongo/Redis; set MCQ_ENGINE_URL in .env.local to match)"
python -m uvicorn mcq_engine.api.main:app --host 127.0.0.1 --port $port --reload
