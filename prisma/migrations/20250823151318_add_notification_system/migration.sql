-- AlterTable
ALTER TABLE "user_profiles" ADD COLUMN "apartment" TEXT;

-- CreateTable
CREATE TABLE "manual_payouts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caregiverId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "notes" TEXT,
    "bookingIds" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "processedAt" DATETIME,
    "confirmedAt" DATETIME,
    "referenceNumber" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "manual_payouts_caregiverId_fkey" FOREIGN KEY ("caregiverId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notification_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "recipientId" TEXT,
    "recipientEmail" TEXT,
    "recipientPhone" TEXT,
    "recipientName" TEXT,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "htmlContent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "deliveryStatus" TEXT,
    "scheduledAt" DATETIME,
    "sentAt" DATETIME,
    "deliveredAt" DATETIME,
    "failedAt" DATETIME,
    "openedAt" DATETIME,
    "clickedAt" DATETIME,
    "providerId" TEXT,
    "providerData" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" DATETIME,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "errorDetails" JSONB,
    "isTransactional" BOOLEAN NOT NULL DEFAULT true,
    "consentId" TEXT,
    "unsubscribeToken" TEXT,
    "contextType" TEXT,
    "contextId" TEXT,
    "triggeredBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "notification_retries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "notificationId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "errorDetails" JSONB,
    "providerId" TEXT,
    "providerResponse" JSONB,
    "attemptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_retries_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notification_events" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notification_webhooks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "notificationId" TEXT,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "signature" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" DATETIME,
    "processingError" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_webhooks_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notification_events" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "textContent" TEXT NOT NULL,
    "htmlContent" TEXT,
    "variables" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTransactional" BOOLEAN NOT NULL DEFAULT true,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "requiresConsent" BOOLEAN NOT NULL DEFAULT false,
    "retentionDays" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "marketingEmails" BOOLEAN NOT NULL DEFAULT false,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "marketingSms" BOOLEAN NOT NULL DEFAULT false,
    "bookingUpdates" BOOLEAN NOT NULL DEFAULT true,
    "paymentAlerts" BOOLEAN NOT NULL DEFAULT true,
    "reminderAlerts" BOOLEAN NOT NULL DEFAULT true,
    "securityAlerts" BOOLEAN NOT NULL DEFAULT true,
    "emailConsent" DATETIME,
    "smsConsent" DATETIME,
    "unsubscribeToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "emailProvider" TEXT NOT NULL DEFAULT 'resend',
    "smsProvider" TEXT NOT NULL DEFAULT 'twilio',
    "emailRateLimit" INTEGER NOT NULL DEFAULT 100,
    "smsRateLimit" INTEGER NOT NULL DEFAULT 50,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "retryDelays" JSONB NOT NULL,
    "emergencyBypass" BOOLEAN NOT NULL DEFAULT true,
    "requireDoubleOptIn" BOOLEAN NOT NULL DEFAULT false,
    "retentionDays" INTEGER NOT NULL DEFAULT 365,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "notification_events_recipientEmail_status_idx" ON "notification_events"("recipientEmail", "status");

-- CreateIndex
CREATE INDEX "notification_events_recipientPhone_status_idx" ON "notification_events"("recipientPhone", "status");

-- CreateIndex
CREATE INDEX "notification_events_status_scheduledAt_idx" ON "notification_events"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "notification_events_contextType_contextId_idx" ON "notification_events"("contextType", "contextId");

-- CreateIndex
CREATE INDEX "notification_events_type_channel_createdAt_idx" ON "notification_events"("type", "channel", "createdAt");

-- CreateIndex
CREATE INDEX "notification_webhooks_provider_providerId_idx" ON "notification_webhooks"("provider", "providerId");

-- CreateIndex
CREATE INDEX "notification_webhooks_processed_receivedAt_idx" ON "notification_webhooks"("processed", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_templateId_key" ON "notification_templates"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_unsubscribeToken_key" ON "notification_preferences"("unsubscribeToken");
