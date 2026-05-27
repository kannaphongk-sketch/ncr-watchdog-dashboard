CREATE TABLE `alert_cooldown` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alert_type` varchar(32) NOT NULL,
	`last_alert_at` timestamp NOT NULL DEFAULT (now()),
	`cooldown_minutes` int NOT NULL DEFAULT 30,
	CONSTRAINT `alert_cooldown_id` PRIMARY KEY(`id`),
	CONSTRAINT `alert_cooldown_alert_type_unique` UNIQUE(`alert_type`)
);
--> statement-breakpoint
CREATE TABLE `alert_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alert_type` enum('downtime','high_latency','security') NOT NULL,
	`message` text NOT NULL,
	`auto_fix_applied` boolean DEFAULT false,
	`http_code` int,
	`ttfb_ms` int,
	`resolved` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alert_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monitor_checks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`http_code` int NOT NULL,
	`ttfb_ms` int NOT NULL,
	`cache_status` varchar(32) DEFAULT 'UNKNOWN',
	`cf_ray` varchar(64),
	`is_up` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `monitor_checks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduler_state` (
	`id` int AUTO_INCREMENT NOT NULL,
	`job_name` varchar(64) NOT NULL,
	`schedule_cron_task_uid` varchar(65),
	`last_run_at` timestamp,
	`next_run_at` timestamp,
	`last_status` varchar(32) DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduler_state_id` PRIMARY KEY(`id`),
	CONSTRAINT `scheduler_state_job_name_unique` UNIQUE(`job_name`)
);
