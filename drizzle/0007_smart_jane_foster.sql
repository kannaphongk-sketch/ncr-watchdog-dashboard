CREATE TABLE `cf_analytics_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`total_requests` int NOT NULL DEFAULT 0,
	`cached_requests` int NOT NULL DEFAULT 0,
	`bandwidth` bigint NOT NULL DEFAULT 0,
	`threats` int NOT NULL DEFAULT 0,
	`visits` int NOT NULL DEFAULT 0,
	`page_views` int NOT NULL DEFAULT 0,
	`cache_hit_rate` int NOT NULL DEFAULT 0,
	`block_rate` int NOT NULL DEFAULT 0,
	`count_404` int NOT NULL DEFAULT 0,
	`top_posts_json` text NOT NULL DEFAULT ('[]'),
	`window_days` int NOT NULL DEFAULT 1,
	`snapshot_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cf_analytics_cache_id` PRIMARY KEY(`id`)
);
