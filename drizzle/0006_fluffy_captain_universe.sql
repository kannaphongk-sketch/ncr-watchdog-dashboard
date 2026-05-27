CREATE TABLE `banned_ips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ip` varchar(64) NOT NULL,
	`count_404` int NOT NULL DEFAULT 0,
	`waf_blocked` boolean NOT NULL DEFAULT false,
	`block_message` text,
	`banned_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `banned_ips_id` PRIMARY KEY(`id`),
	CONSTRAINT `banned_ips_ip_unique` UNIQUE(`ip`)
);
