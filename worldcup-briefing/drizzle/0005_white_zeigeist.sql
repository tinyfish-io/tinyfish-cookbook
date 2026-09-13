CREATE TABLE "free_run_counts" (
  "ip_hash" text PRIMARY KEY NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);
