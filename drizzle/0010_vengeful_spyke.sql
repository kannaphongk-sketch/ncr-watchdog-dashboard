CREATE TABLE `wp_db_latency_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`latency_ms` int NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'ok',
	`http_code` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wp_db_latency_log_id` PRIMARY KEY(`id`)
);
