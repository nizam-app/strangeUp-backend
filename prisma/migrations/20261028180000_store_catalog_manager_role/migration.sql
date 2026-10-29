-- Task 024B: separate store catalog operator role (distinct from IDENTITY_REVIEWER).
ALTER TYPE "PlatformStaffRole" ADD VALUE IF NOT EXISTS 'STORE_CATALOG_MANAGER';
