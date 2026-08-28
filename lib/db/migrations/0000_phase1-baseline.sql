CREATE TABLE IF NOT EXISTS "opportunities" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"organisation" text NOT NULL,
	"province" text,
	"location" text,
	"field_of_study" text,
	"industry" text,
	"official_source_url" text NOT NULL,
	"official_application_url" text,
	"closing_date" date,
	"is_rolling" boolean DEFAULT false NOT NULL,
	"opens_date" date,
	"eligibility" jsonb,
	"requirements" text[],
	"required_documents" text[],
	"extracted_facts" jsonb,
	"ai_summary" text,
	"ai_eligibility" text,
	"ai_checklist" jsonb,
	"ai_faq" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"confidence_points" integer,
	"confidence_band" text,
	"confidence_breakdown" jsonb,
	"dedupe_key" text,
	"duplicate_of_id" integer,
	"duplicate_flagged" boolean DEFAULT false NOT NULL,
	"review_flags" text[],
	"source_name" text,
	"last_fetched_at" timestamp with time zone,
	"last_confirmed_at" timestamp with time zone,
	"source_content_hash" text,
	"seo_title" text,
	"meta_description" text,
	"schema_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"state_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "opportunities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "opportunity_types" (
	"type" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"url_prefix" text NOT NULL,
	"schema_org_type" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "opportunity_types_url_prefix_unique" UNIQUE("url_prefix")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "heartbeats" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_extractions" (
	"id" serial PRIMARY KEY NOT NULL,
	"content_hash" text NOT NULL,
	"prompt_version" text NOT NULL,
	"model" text NOT NULL,
	"step" text DEFAULT 'extract' NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "source_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"source_name" text,
	"content_hash" text NOT NULL,
	"content_type" text,
	"http_status" integer,
	"content_text" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organisation" text NOT NULL,
	"url" text NOT NULL,
	"kind" text DEFAULT 'html' NOT NULL,
	"tier" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
"discovery_only" boolean DEFAULT false NOT NULL,
	"robots_allowed" boolean,
	"last_fetched_at" timestamp with time zone,
	"last_fetch_status" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_name_unique" UNIQUE("name")
);

--> statement-breakpoint
-- Idempotent upgrade path for databases created with the Phase 0 schema:
-- add all Phase 1 columns and retire the old float confidence columns.
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "ai_eligibility" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "confidence_points" integer;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "confidence_band" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "confidence_breakdown" jsonb;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "dedupe_key" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "duplicate_of_id" integer;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "duplicate_flagged" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "review_flags" text[];--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "source_name" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "source_content_hash" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "last_fetched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "last_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "opportunities" DROP COLUMN IF EXISTS "closing_date_confidence";--> statement-breakpoint
ALTER TABLE "opportunities" DROP COLUMN IF EXISTS "confidence_score";
ALTER TABLE "sources" ADD COLUMN IF NOT EXISTS "discovery_only" boolean DEFAULT false NOT NULL;
