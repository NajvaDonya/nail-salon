-- CreateTable GalleryImage
CREATE TABLE `GalleryImage` (
    `id` VARCHAR(191) NOT NULL,
    `salonId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `imageUrl` VARCHAR(191) NOT NULL,
    `alt` VARCHAR(191) NOT NULL DEFAULT '',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `showInHero` BOOLEAN NOT NULL DEFAULT false,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GalleryImage_salonId_isActive_showInHero_sortOrder_idx`(`salonId`, `isActive`, `showInHero`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable BlogPost
CREATE TABLE `BlogPost` (
    `id` VARCHAR(191) NOT NULL,
    `salonId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `excerpt` TEXT NULL,
    `content` TEXT NOT NULL,
    `coverImage` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'PUBLISHED') NOT NULL DEFAULT 'DRAFT',
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BlogPost_salonId_status_publishedAt_idx`(`salonId`, `status`, `publishedAt`),
    UNIQUE INDEX `BlogPost_salonId_slug_key`(`salonId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `GalleryImage` ADD CONSTRAINT `GalleryImage_salonId_fkey` FOREIGN KEY (`salonId`) REFERENCES `Salon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BlogPost` ADD CONSTRAINT `BlogPost_salonId_fkey` FOREIGN KEY (`salonId`) REFERENCES `Salon`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
