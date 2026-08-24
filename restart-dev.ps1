# Restart Next.js dev server (kills port 3000, then starts fresh)
$ErrorActionPreference = "SilentlyContinue"

Write-Host "Stopping processes on port 3000..." -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 2

Write-Host "Starting dev server..." -ForegroundColor Green
Set-Location $PSScriptRoot
npm run dev
