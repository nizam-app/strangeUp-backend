# Creates strangeup role + strangeup_dev / strangeup_test on native PostgreSQL 18.
# You will be prompted for the postgres superuser password (install-time password).
# After this script, set DATABASE_URL / INTEGRATION_DATABASE_URL in .env (see docs/operations/NATIVE_POSTGRES_LOCAL.md).

$ErrorActionPreference = "Stop"
$Psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
if (-not (Test-Path $Psql)) {
  throw "psql not found at $Psql"
}

$Password = Read-Host "Enter password for new role 'strangeup' (integration/dev app user)" -AsSecureString
$Bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
$Plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($Bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr)

$Sql = @"
DO `$`$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'strangeup') THEN
    CREATE ROLE strangeup WITH LOGIN PASSWORD '$($Plain.Replace("'","''"))';
  END IF;
END `$`$;
"@

& $Psql -U postgres -h localhost -p 5432 -d postgres -v ON_ERROR_STOP=1 -c $Sql
& $Psql -U postgres -h localhost -p 5432 -d postgres -v ON_ERROR_STOP=1 -tc "SELECT 1 FROM pg_database WHERE datname = 'strangeup_dev'" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "psql failed" }
$existsDev = & $Psql -U postgres -h localhost -p 5432 -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'strangeup_dev'"
if (-not $existsDev) {
  & $Psql -U postgres -h localhost -p 5432 -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE strangeup_dev OWNER strangeup"
}
$existsTest = & $Psql -U postgres -h localhost -p 5432 -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'strangeup_test'"
if (-not $existsTest) {
  & $Psql -U postgres -h localhost -p 5432 -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE strangeup_test OWNER strangeup"
}

Write-Host "Created/verified strangeup_dev and strangeup_test. Update .env with strangeup credentials (do not commit)."
