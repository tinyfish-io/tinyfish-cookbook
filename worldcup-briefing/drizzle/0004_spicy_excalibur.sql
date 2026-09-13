CREATE TABLE "user_keys" (
  "api_key_hash" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);
