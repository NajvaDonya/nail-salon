-- AlterTable Service
ALTER TABLE `Service` ADD COLUMN `depositAmount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `kind` ENUM('BASE', 'ADDON') NOT NULL DEFAULT 'BASE',
    ADD COLUMN `allowQuantity` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `maxQuantity` INTEGER NULL;

-- CreateTable VisitType
CREATE TABLE `VisitType` (
    `id` VARCHAR(191) NOT NULL,
    `salonId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `behavior` ENUM('GENERAL', 'FIRST_TIME', 'RETURNING', 'PREFERRED_STAFF') NOT NULL DEFAULT 'GENERAL',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VisitType_salonId_name_key`(`salonId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable ServiceAddon
CREATE TABLE `ServiceAddon` (
    `id` VARCHAR(191) NOT NULL,
    `baseServiceId` VARCHAR(191) NOT NULL,
    `addonServiceId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `ServiceAddon_baseServiceId_addonServiceId_key`(`baseServiceId`, `addonServiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable Appointment
ALTER TABLE `Appointment` ADD COLUMN `visitTypeId` VARCHAR(191) NULL,
    ADD COLUMN `preferredStaffId` VARCHAR(191) NULL,
    ADD COLUMN `depositAmount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `balanceDue` INTEGER NOT NULL DEFAULT 0;

-- AlterTable AppointmentService
ALTER TABLE `AppointmentService` ADD COLUMN `depositAmount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `quantity` INTEGER NOT NULL DEFAULT 1;

-- AddForeignKey
ALTER TABLE `VisitType` ADD CONSTRAINT `VisitType_salonId_fkey` FOREIGN KEY (`salonId`) REFERENCES `Salon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ServiceAddon` ADD CONSTRAINT `ServiceAddon_baseServiceId_fkey` FOREIGN KEY (`baseServiceId`) REFERENCES `Service`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ServiceAddon` ADD CONSTRAINT `ServiceAddon_addonServiceId_fkey` FOREIGN KEY (`addonServiceId`) REFERENCES `Service`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Appointment` ADD CONSTRAINT `Appointment_visitTypeId_fkey` FOREIGN KEY (`visitTypeId`) REFERENCES `VisitType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
