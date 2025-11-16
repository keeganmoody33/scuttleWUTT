CREATE TABLE IF NOT EXISTS "brand_trackers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"brand_name" text NOT NULL,
	"tracked_prompts" jsonb NOT NULL,
	"share_of_voice" integer DEFAULT 0,
	"sentiment_score" integer DEFAULT 50,
	"consensus_score" integer DEFAULT 0,
	"provider_bias" jsonb,
	"alerts_enabled" boolean DEFAULT true NOT NULL,
	"alert_threshold" integer DEFAULT 10,
	"last_alert_sent_at" timestamp,
	"last_checked_at" timestamp,
	"next_check_at" timestamp NOT NULL,
	"check_frequency_days" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "opportunity_trackers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"idea_name" text NOT NULL,
	"idea_description" text,
	"keywords" jsonb NOT NULL,
	"intent_score" integer DEFAULT 0,
	"intent_trend" text DEFAULT 'flat',
	"saturation_score" integer DEFAULT 0,
	"competitive_consensus" integer DEFAULT 0,
	"opportunity_score" integer DEFAULT 50,
	"window_status" text DEFAULT 'unknown',
	"alerts_enabled" boolean DEFAULT true NOT NULL,
	"last_alert_sent_at" timestamp,
	"last_checked_at" timestamp,
	"next_check_at" timestamp NOT NULL,
	"check_frequency_days" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brand_trackers_user_id_idx" ON "brand_trackers" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brand_trackers_brand_name_idx" ON "brand_trackers" ("brand_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brand_trackers_next_check_at_idx" ON "brand_trackers" ("next_check_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "brand_trackers_active_idx" ON "brand_trackers" ("active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunity_trackers_user_id_idx" ON "opportunity_trackers" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunity_trackers_next_check_at_idx" ON "opportunity_trackers" ("next_check_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunity_trackers_active_idx" ON "opportunity_trackers" ("active");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brand_trackers" ADD CONSTRAINT "brand_trackers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunity_trackers" ADD CONSTRAINT "opportunity_trackers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
