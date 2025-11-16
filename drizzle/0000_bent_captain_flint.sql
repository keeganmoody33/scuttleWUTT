DO $$ BEGIN
 CREATE TYPE "delivery_method" AS ENUM('email', 'sms', 'both');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "interaction_type" AS ENUM('viewed', 'saved', 'dismissed', 'clicked');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "source_type" AS ENUM('producthunt', 'twitter', 'hackernews', 'techcrunch', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "update_frequency" AS ENUM('daily', 'weekly', 'biweekly', 'on_demand');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "answer_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"question" text NOT NULL,
	"answer" jsonb NOT NULL,
	"model_used" text DEFAULT 'claude-sonnet-4-5' NOT NULL,
	"snapshot_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "digests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"product_ids" jsonb NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"opened_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "product_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"source_type" "source_type" NOT NULL,
	"source_id" text NOT NULL,
	"source_url" text NOT NULL,
	"source_data" jsonb,
	"scraped_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"tagline" text,
	"description" text,
	"url" text,
	"image_url" text,
	"producer_name" text,
	"producer_url" text,
	"launch_date" timestamp,
	"use_cases" jsonb,
	"upvotes" integer DEFAULT 0,
	"comments" integer DEFAULT 0,
	"stars" integer DEFAULT 0,
	"mentions" integer DEFAULT 0,
	"downsides" jsonb,
	"categories" jsonb DEFAULT '[]'::jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"quality_score" integer DEFAULT 0,
	"relevance_score" integer DEFAULT 0,
	"recency_score" integer DEFAULT 0,
	"processed" boolean DEFAULT false,
	"featured" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "question_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"phone" text,
	"delivery_method" "delivery_method" DEFAULT 'email' NOT NULL,
	"question_id" text NOT NULL,
	"question" text NOT NULL,
	"frequency_days" integer NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"verification_code" text,
	"verification_code_expires_at" timestamp,
	"verification_sent_at" timestamp,
	"last_sent_at" timestamp,
	"next_send_at" timestamp NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "questions" (
	"id" text PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"asked_at" timestamp DEFAULT now() NOT NULL,
	"answer" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scraping_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"source_type" "source_type" NOT NULL,
	"status" text NOT NULL,
	"products_found" integer DEFAULT 0,
	"errors" jsonb,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"interests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"update_frequency" "update_frequency" DEFAULT 'weekly' NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_product_interactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"product_id" text NOT NULL,
	"interaction_type" "interaction_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "answer_snapshots_question_id_idx" ON "answer_snapshots" ("question_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "answer_snapshots_snapshot_date_idx" ON "answer_snapshots" ("snapshot_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "answer_snapshots_model_used_idx" ON "answer_snapshots" ("model_used");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "digests_user_id_idx" ON "digests" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "digests_sent_at_idx" ON "digests" ("sent_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_sources_product_id_idx" ON "product_sources" ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_sources_source_id_idx" ON "product_sources" ("source_type","source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_name_idx" ON "products" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_launch_date_idx" ON "products" ("launch_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_quality_score_idx" ON "products" ("quality_score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "question_subscriptions_email_idx" ON "question_subscriptions" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "question_subscriptions_phone_idx" ON "question_subscriptions" ("phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "question_subscriptions_next_send_at_idx" ON "question_subscriptions" ("next_send_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "question_subscriptions_active_idx" ON "question_subscriptions" ("active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "question_subscriptions_verified_idx" ON "question_subscriptions" ("verified");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "questions_question_idx" ON "questions" ("question");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "questions_asked_at_idx" ON "questions" ("asked_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scraping_jobs_source_type_idx" ON "scraping_jobs" ("source_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scraping_jobs_status_idx" ON "scraping_jobs" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_preferences_user_id_idx" ON "user_preferences" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_product_interactions_user_product_idx" ON "user_product_interactions" ("user_id","product_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "answer_snapshots" ADD CONSTRAINT "answer_snapshots_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "digests" ADD CONSTRAINT "digests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "product_sources" ADD CONSTRAINT "product_sources_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "question_subscriptions" ADD CONSTRAINT "question_subscriptions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_product_interactions" ADD CONSTRAINT "user_product_interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_product_interactions" ADD CONSTRAINT "user_product_interactions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
