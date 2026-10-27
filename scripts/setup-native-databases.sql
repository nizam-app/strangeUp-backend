-- Native PostgreSQL 18 — StrangeUp local databases (run once as superuser).
-- Replace the password placeholder before executing. Do not commit real passwords.
--
--   "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h localhost -p 5432 -d postgres -f scripts/setup-native-databases.sql
--
-- If role or databases already exist, skip the matching statements.

CREATE ROLE strangeup WITH LOGIN PASSWORD 'CHOOSE_A_STRONG_PASSWORD';

CREATE DATABASE strangeup_dev OWNER strangeup;
CREATE DATABASE strangeup_test OWNER strangeup;
