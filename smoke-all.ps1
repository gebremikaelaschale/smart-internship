$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'

Write-Host '=== Smart Internship Placement Smoke Suite ===' -ForegroundColor Cyan
Write-Host 'Root: ' $root

if (-not (Test-Path $backend)) {
  throw "Backend folder not found: $backend"
}

if (-not (Test-Path $frontend)) {
  throw "Frontend folder not found: $frontend"
}

Write-Host "\n[1/2] Running backend governance smoke..." -ForegroundColor Yellow
Push-Location $backend
npm run smoke:governance
Pop-Location

Write-Host "\n[2/2] Running frontend redirect smoke..." -ForegroundColor Yellow
Push-Location $frontend
npm run smoke:redirects
Pop-Location

Write-Host "\nAll smoke checks passed." -ForegroundColor Green
