-- Phase 2: affiliate links table
CREATE TABLE IF NOT EXISTS "affiliate_links" (
  "id" serial PRIMARY KEY NOT NULL,
  "label" text NOT NULL,
  "url" text NOT NULL,
  "description" text,
  "placement" text NOT NULL DEFAULT 'general',
  "category" text NOT NULL DEFAULT 'general',
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
