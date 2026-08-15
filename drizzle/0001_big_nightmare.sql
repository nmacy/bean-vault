ALTER TABLE `coffees` ADD `source_uuid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `coffees_source_uuid_unique` ON `coffees` (`source_uuid`);