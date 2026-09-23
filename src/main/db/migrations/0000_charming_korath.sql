CREATE TABLE `collection_items` (
	`collection_id` text NOT NULL,
	`comic_id` text NOT NULL,
	`position` integer NOT NULL,
	`added_at` integer NOT NULL,
	PRIMARY KEY(`collection_id`, `comic_id`),
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comic_id`) REFERENCES `comics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_items_order` ON `collection_items` (`collection_id`,`position`);--> statement-breakpoint
CREATE INDEX `idx_items_comic` ON `collection_items` (`comic_id`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`name_normalized` text NOT NULL,
	`description` text,
	`cover_mode` text DEFAULT 'auto' NOT NULL,
	`cover_comic_id` text,
	`cover_version` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`cover_comic_id`) REFERENCES `comics`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_collections_type_name` ON `collections` (`type`,`name_normalized`);--> statement-breakpoint
CREATE TABLE `comic_pages` (
	`comic_id` text NOT NULL,
	`page_index` integer NOT NULL,
	`entry_name` text NOT NULL,
	`width` integer,
	`height` integer,
	PRIMARY KEY(`comic_id`, `page_index`),
	FOREIGN KEY (`comic_id`) REFERENCES `comics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `comics` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`title_normalized` text NOT NULL,
	`format` text NOT NULL,
	`file_name` text NOT NULL,
	`original_file_name` text NOT NULL,
	`file_size` integer NOT NULL,
	`file_hash` text NOT NULL,
	`page_count` integer NOT NULL,
	`cover_version` integer DEFAULT 0 NOT NULL,
	`is_favorite` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_comics_title_norm` ON `comics` (`title_normalized`);--> statement-breakpoint
CREATE INDEX `idx_comics_created` ON `comics` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_comics_hash` ON `comics` (`file_hash`);--> statement-breakpoint
CREATE INDEX `idx_comics_fav` ON `comics` (`is_favorite`);--> statement-breakpoint
CREATE TABLE `reading_progress` (
	`comic_id` text PRIMARY KEY NOT NULL,
	`current_page` integer DEFAULT 0 NOT NULL,
	`last_read_at` integer,
	`completed_at` integer,
	`reader_prefs` text,
	FOREIGN KEY (`comic_id`) REFERENCES `comics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_progress_last_read` ON `reading_progress` (`last_read_at`);--> statement-breakpoint
CREATE INDEX `idx_progress_completed` ON `reading_progress` (`completed_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
