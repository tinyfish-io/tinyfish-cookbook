CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"topic" text,
	"status" text DEFAULT 'processing' NOT NULL,
	"mode" text,
	"selected_video" jsonb,
	"stream_url" text,
	"player_url" text,
	"thumbnail_url" text,
	"events" jsonb,
	"summary" text,
	"error_message" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"api_key_hash" text,
	"schedule_id" uuid,
	"inngest_event_id" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"run_time" text NOT NULL,
	"timezone" text NOT NULL,
	"channel" text NOT NULL,
	"channel_config" jsonb NOT NULL,
	"tf_api_key_enc" text NOT NULL,
	"vdb_api_key_enc" text NOT NULL,
	"api_key_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"next_run_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "video_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"youtube_video_id" text NOT NULL,
	"canonical_url" text NOT NULL,
	"vdb_video_id" text NOT NULL,
	"api_key_hash" text NOT NULL,
	"thumbnail_url" text,
	"title" text,
	"intent_index_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "video_cache_youtube_video_id_api_key_hash_unique" UNIQUE("youtube_video_id","api_key_hash")
);
