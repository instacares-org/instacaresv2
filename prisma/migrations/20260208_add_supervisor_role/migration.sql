-- Add SUPERVISOR to UserType enum
ALTER TYPE "UserType" ADD VALUE IF NOT EXISTS 'SUPERVISOR';

-- Create supervisor_permissions table
CREATE TABLE IF NOT EXISTS "supervisor_permissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canApproveUsers" BOOLEAN NOT NULL DEFAULT false,
    "canManageUsers" BOOLEAN NOT NULL DEFAULT false,
    "canModerateReviews" BOOLEAN NOT NULL DEFAULT false,
    "canModerateChat" BOOLEAN NOT NULL DEFAULT false,
    "canViewFinancials" BOOLEAN NOT NULL DEFAULT false,
    "canProcessPayouts" BOOLEAN NOT NULL DEFAULT false,
    "canManageExtensions" BOOLEAN NOT NULL DEFAULT false,
    "canViewAnalytics" BOOLEAN NOT NULL DEFAULT false,
    "canViewAuditLogs" BOOLEAN NOT NULL DEFAULT false,
    "canManageSupport" BOOLEAN NOT NULL DEFAULT false,
    "canManageWarnings" BOOLEAN NOT NULL DEFAULT false,
    "canManageNotifications" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supervisor_permissions_pkey" PRIMARY KEY ("id")
);

-- Create unique index on userId
CREATE UNIQUE INDEX IF NOT EXISTS "supervisor_permissions_userId_key" ON "supervisor_permissions"("userId");

-- Add foreign key constraint
ALTER TABLE "supervisor_permissions" ADD CONSTRAINT "supervisor_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
