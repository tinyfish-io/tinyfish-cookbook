ALTER TABLE "runs" ADD COLUMN IF NOT EXISTS "status_message" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN IF NOT EXISTS "status_history" jsonb;
