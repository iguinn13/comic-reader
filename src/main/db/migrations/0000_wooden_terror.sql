CREATE TABLE `library_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_folders_path` ON `library_folders` (`path`);--> statement-breakpoint
CREATE TABLE `comics` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`title_normalized` text NOT NULL,
	`format` text NOT NULL,
	`file_path` text NOT NULL,
	`dir_path` text NOT NULL,
	`folder_id` text NOT NULL,
	`original_file_name` text NOT NULL,
	`file_size` integer NOT NULL,
	`file_hash` text NOT NULL,
	`page_count` integer NOT NULL,
	`cover_version` integer DEFAULT 0 NOT NULL,
	`is_favorite` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`folder_id`) REFERENCES `library_folders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_comics_title_norm` ON `comics` (`title_normalized`);--> statement-breakpoint
CREATE INDEX `idx_comics_created` ON `comics` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_comics_hash` ON `comics` (`file_hash`);--> statement-breakpoint
CREATE INDEX `idx_comics_fav` ON `comics` (`is_favorite`);--> statement-breakpoint
CREATE INDEX `idx_comics_dir` ON `comics` (`dir_path`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_comics_file_path` ON `comics` (`file_path`);--> statement-breakpoint
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
