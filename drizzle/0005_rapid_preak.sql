CREATE TABLE `cache_diagnostics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cf_cache_status` varchar(32) NOT NULL DEFAULT 'UNKNOWN',
	`cache_control` varchar(512) NOT NULL DEFAULT '',
	`vary` varchar(256) NOT NULL DEFAULT '',
	`wp_cookies_detected` varchar(512) NOT NULL DEFAULT '',
	`potential_cause` varchar(256) NOT NULL DEFAULT '',
	`checked_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cache_diagnostics_id` PRIMARY KEY(`id`)
);
