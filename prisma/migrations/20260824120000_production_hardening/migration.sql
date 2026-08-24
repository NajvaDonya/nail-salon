-- AlterTable
ALTER TABLE `AppointmentService` ADD COLUMN `bufferTime` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `duration` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `finalPrice` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `price` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `serviceName` VARCHAR(191) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE `OtpCode` ADD COLUMN `attempts` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `SmsLog` (
    `id` VARCHAR(191) NOT NULL,
    `appointmentId` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NOT NULL,
    `type` ENUM('OTP', 'REMINDER', 'POST_SERVICE', 'REVIEW_REQUEST', 'CONFIRMATION') NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `message` TEXT NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `lastError` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SmsLog_status_createdAt_idx`(`status`, `createdAt`),
    UNIQUE INDEX `SmsLog_appointmentId_type_key`(`appointmentId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `OtpCode_phone_isUsed_expiresAt_idx` ON `OtpCode`(`phone`, `isUsed`, `expiresAt`);
