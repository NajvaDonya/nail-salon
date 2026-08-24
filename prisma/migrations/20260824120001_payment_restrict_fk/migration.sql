-- Payment: add FK with ON DELETE RESTRICT (table had no FK previously)
ALTER TABLE `payment` ADD CONSTRAINT `payment_appointmentId_fkey` FOREIGN KEY (`appointmentId`) REFERENCES `appointment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
