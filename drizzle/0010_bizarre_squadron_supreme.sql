CREATE TABLE `roasters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`website` text,
	`state` text,
	`country` text,
	`description` text,
	`specialty` text,
	`founded_year` integer,
	`logo_file` text,
	`ai_enriched` integer DEFAULT false NOT NULL,
	`source_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `roasters_name_unique` ON `roasters` (`name`);--> statement-breakpoint
ALTER TABLE `coffees` ADD `roaster_id` integer REFERENCES roasters(id);