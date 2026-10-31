-- Owner-facing dev/staging super admin: satisfies all PlatformStaffGrant-gated admin APIs (RBAC preserved per route).
ALTER TYPE "PlatformStaffRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
