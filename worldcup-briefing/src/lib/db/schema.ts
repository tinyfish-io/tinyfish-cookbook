import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const runs = pgTable("runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  query: text("query").notNull(),
  topic: text("topic"),
  status: text("status").notNull().default("processing"),
  mode: text("mode"),
  selectedVideo: jsonb("selected_video"),
  streamUrl: text("stream_url"),
  playerUrl: text("player_url"),
  thumbnailUrl: text("thumbnail_url"),
  events: jsonb("events"),
  timeline: jsonb("timeline"),
  summary: text("summary"),
  statusMessage: text("status_message"),
  statusHistory: jsonb("status_history"),
  errorMessage: text("error_message"),
  isPublic: boolean("is_public").notNull().default(false),
  apiKeyHash: text("api_key_hash"),
  scheduleId: uuid("schedule_id"),
  inngestEventId: text("inngest_event_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const videoCache = pgTable(
  "video_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    youtubeVideoId: text("youtube_video_id").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    vdbVideoId: text("vdb_video_id").notNull(),
    apiKeyHash: text("api_key_hash").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    title: text("title"),
    intentIndexIds: jsonb("intent_index_ids").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    uniqueYoutubePerKey: unique().on(table.youtubeVideoId, table.apiKeyHash),
  }),
);

export const channels = pgTable("channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: text("type").notNull(), // "telegram" | "discord" | "slack"
  credentialsEnc: text("credentials_enc").notNull(),
  apiKeyHash: text("api_key_hash").notNull(),
  isValidated: boolean("is_validated").notNull().default(false),
  lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const schedules = pgTable("schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  query: text("query").notNull(),
  runTime: text("run_time").notNull(),
  timezone: text("timezone").notNull(),
  channel: text("channel").notNull(),
  channelConfig: jsonb("channel_config").notNull(),
  tfApiKeyEnc: text("tf_api_key_enc").notNull(),
  vdbApiKeyEnc: text("vdb_api_key_enc").notNull(),
  apiKeyHash: text("api_key_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const userKeys = pgTable("user_keys", {
  apiKeyHash: text("api_key_hash").primaryKey(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const freeRunCounts = pgTable("free_run_counts", {
  ipHash: text("ip_hash").primaryKey(),
  count: integer("count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
