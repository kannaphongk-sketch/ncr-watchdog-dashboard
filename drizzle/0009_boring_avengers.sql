CREATE TABLE `reply_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`template` text NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reply_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `toxic_keywords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`keyword` varchar(255) NOT NULL,
	`category` varchar(64) NOT NULL DEFAULT 'spam',
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `toxic_keywords_id` PRIMARY KEY(`id`)
);
