ALTER TABLE `coffees` ADD `status` text DEFAULT 'resting' NOT NULL;--> statement-breakpoint
ALTER TABLE `coffees` ADD `emptied_at` text;--> statement-breakpoint
ALTER TABLE `coffees` ADD `frozen_at` text;--> statement-breakpoint
ALTER TABLE `coffees` ADD `unfrozen_at` text;--> statement-breakpoint
ALTER TABLE `coffees` ADD `frozen_days` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- backfill lifecycle state from legacy 0007 columns
-- (must run before finished_at is dropped)
UPDATE `coffees` SET `status` = 'empty', `emptied_at` = `finished_at` WHERE `finished_at` IS NOT NULL;--> statement-breakpoint
UPDATE `coffees` SET `status` = 'opened' WHERE `status` = 'resting' AND `opened_at` IS NOT NULL;--> statement-breakpoint
ALTER TABLE `coffees` DROP COLUMN `finished_at`;