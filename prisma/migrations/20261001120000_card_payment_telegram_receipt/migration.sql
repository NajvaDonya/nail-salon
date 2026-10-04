-- AlterEnum Appointment.status
ALTER TABLE `Appointment` MODIFY `status` ENUM('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'AWAITING_PAYMENT', 'EXPIRED') NOT NULL DEFAULT 'PENDING';

-- AlterEnum Payment.status
ALTER TABLE `Payment` MODIFY `status` ENUM('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED') NOT NULL DEFAULT 'PENDING';

-- AlterTable Payment
ALTER TABLE `Payment` ADD COLUMN `expirationMinutes` INTEGER NOT NULL DEFAULT 30,
    ADD COLUMN `paymentSubmittedAt` DATETIME(3) NULL,
    ADD COLUMN `paymentExpiresAt` DATETIME(3) NULL,
    ADD COLUMN `paymentApprovedAt` DATETIME(3) NULL,
    ADD COLUMN `paymentRejectedAt` DATETIME(3) NULL,
    ADD COLUMN `paymentRejectionReason` TEXT NULL,
    ADD COLUMN `approvedBy` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Payment_status_paymentExpiresAt_idx` ON `Payment`(`status`, `paymentExpiresAt`);
