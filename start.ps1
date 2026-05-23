# Start backend from project root (Windows PowerShell)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example - add your OPENROUTER_API_KEY"
    exit 1
}

if (-not (Test-Path "venv")) {
    python -m venv venv
}

& .\venv\Scripts\Activate.ps1
pip install -r requirements.txt -q
New-Item -ItemType Directory -Force -Path uploads | Out-Null

Write-Host "Starting API at http://localhost:8000"
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
