-- Add audit logging table for payment security
CREATE TABLE IF NOT EXISTS `AuditLog` (
  `id` VARCHAR(191) NOT NULL,
  `eventType` VARCHAR(100) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `resourceId` VARCHAR(191) NULL,
  `details` JSON NOT NULL,
  `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
  `ipAddress` VARCHAR(45) NULL,
  `userAgent` TEXT NULL,
  `sessionId` VARCHAR(191) NULL,
  `metadata` JSON NULL,
  `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `AuditLog_userId_idx` (`userId`),
  INDEX `AuditLog_eventType_idx` (`eventType`),
  INDEX `AuditLog_timestamp_idx` (`timestamp`),
  INDEX `AuditLog_severity_idx` (`severity`),
  INDEX `AuditLog_resourceId_idx` (`resourceId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add Invoice table if it doesn't exist
CREATE TABLE IF NOT EXISTS `Invoice` (
  `id` VARCHAR(191) NOT NULL,
  `bookingId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `type` ENUM('PARENT', 'CAREGIVER', 'PLATFORM') NOT NULL,
  `amount` INTEGER NOT NULL,
  `status` ENUM('DRAFT', 'SENT', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `dueDate` DATETIME(3) NOT NULL,
  `paidAt` DATETIME(3) NULL,
  `stripeInvoiceId` VARCHAR(191) NULL,
  `receiptUrl` TEXT NULL,
  `metadata` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  INDEX `Invoice_bookingId_idx` (`bookingId`),
  INDEX `Invoice_userId_idx` (`userId`),
  INDEX `Invoice_status_idx` (`status`),
  INDEX `Invoice_dueDate_idx` (`dueDate`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Update Payment table to include more security fields
ALTER TABLE `Payment` 
ADD COLUMN IF NOT EXISTS `stripeChargeId` VARCHAR(191) NULL,
ADD COLUMN IF NOT EXISTS `paidAt` DATETIME(3) NULL,
ADD COLUMN IF NOT EXISTS `paymentMethod` JSON NULL;

-- Add indexes for better performance on payment queries
CREATE INDEX IF NOT EXISTS `Payment_status_idx` ON `Payment`(`status`);
CREATE INDEX IF NOT EXISTS `Payment_userId_idx` ON `Payment`(`userId`);
CREATE INDEX IF NOT EXISTS `Payment_createdAt_idx` ON `Payment`(`createdAt`);
CREATE INDEX IF NOT EXISTS `Payment_stripePaymentIntentId_idx` ON `Payment`(`stripePaymentIntentId`);

-- Add foreign key constraints if they don't exist
-- Note: These might need to be adjusted based on your existing schema
-- ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `Booking`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
-- ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;