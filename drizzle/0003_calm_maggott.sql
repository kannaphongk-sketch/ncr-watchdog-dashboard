CREATE TABLE `broken_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`url` varchar(2048) NOT NULL,
	`hits` int NOT NULL DEFAULT 0,
	`is_critical` boolean NOT NULL DEFAULT false,
	`last_seen` timestamp NOT NULL DEFAULT (now()),
	`first_seen` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `broken_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `broken_links_url_unique` UNIQUE(`url`)
);
