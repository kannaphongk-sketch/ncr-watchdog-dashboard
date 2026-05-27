CREATE TABLE `action_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`action_type` varchar(64) NOT NULL,
	`description` text NOT NULL,
	`metadata` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `action_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `personal_agenda` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(10) NOT NULL,
	`content` text NOT NULL DEFAULT (''),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `personal_agenda_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quality_audit_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`audit_type` varchar(32) NOT NULL,
	`url` varchar(512) NOT NULL,
	`issue` text NOT NULL,
	`severity` varchar(16) NOT NULL DEFAULT 'warning',
	`is_fixed` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quality_audit_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cf_analytics_cache` ADD `country_json` text;