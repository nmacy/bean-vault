CREATE TABLE `coffees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`roaster` text NOT NULL,
	`name` text NOT NULL,
	`origin` text,
	`variety` text,
	`process` text,
	`roast_level` text,
	`roast_date` text,
	`purchase_date` text,
	`price_cents` integer,
	`weight_grams` integer,
	`rating` integer,
	`notes` text,
	`photo_file` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
