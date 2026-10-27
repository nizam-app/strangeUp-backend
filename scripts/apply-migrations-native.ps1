# Native PostgreSQL fallback only. Prefer: npm run db:neon:migrate
# Applies prisma migrate deploy to strangeup_dev and strangeup_test using URLs from .env.
# Requires valid DATABASE_URL / INTEGRATION_DATABASE_URL (native :5432, not YOUR_PASSWORD placeholder).
# Do not use this script against Neon pooler URLs.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot + "\.."

function Get-EnvValue([string]$Name) {
  $line = Get-Content .env | Where-Object { $_ -match "^$Name=" } | Select-Object -First 1
  if (-not $line) { throw "$Name not found in .env" }
  return ($line -replace "^$Name=", "").Trim()
}

$dev = Get-EnvValue "DATABASE_URL"
$test = Get-EnvValue "INTEGRATION_DATABASE_URL"
if ($dev -match "YOUR_PASSWORD" -or $test -match "YOUR_PASSWORD") {
  throw "Replace YOUR_PASSWORD in .env with the strangeup role password (see docs/operations/NATIVE_POSTGRES_LOCAL.md)"
}

Write-Host "Migrating strangeup_dev..."
$env:DATABASE_URL = $dev
npx prisma migrate deploy
Write-Host "Migrating strangeup_test..."
$env:DATABASE_URL = $test
npx prisma migrate deploy
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
Write-Host "Done."
