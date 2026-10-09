CREATE TYPE "public"."catalog_auth" AS ENUM('none', 'api_key', 'oauth', 'bearer', 'basic', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."catalog_entry_type" AS ENUM('rest', 'openapi', 'mcp');--> statement-breakpoint
CREATE TYPE "public"."catalog_verification_status" AS ENUM('verified', 'unverified', 'dead', 'requires_auth', 'invalid_spec', 'rate_limited', 'temporarily_unavailable', 'requires_params');--> statement-breakpoint
CREATE TABLE "catalog_sync_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_catalog" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'Uncategorized' NOT NULL,
	"source" text DEFAULT 'atlas' NOT NULL,
	"type" "catalog_entry_type" DEFAULT 'rest' NOT NULL,
	"endpoint" text,
	"documentation_url" text,
	"repository" text,
	"transport" text,
	"auth" "catalog_auth" DEFAULT 'unknown' NOT NULL,
	"free" boolean DEFAULT false NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"https" boolean DEFAULT false NOT NULL,
	"cors" boolean,
	"vercel_compatible" boolean,
	"capabilities" text[] DEFAULT '{}' NOT NULL,
	"keywords" text[] DEFAULT '{}' NOT NULL,
	"rate_limit" text,
	"license" text,
	"reliability" double precision DEFAULT 0.5 NOT NULL,
	"last_checked" timestamp with time zone,
	"executable_now" boolean DEFAULT false NOT NULL,
	"requires_credential" boolean DEFAULT false NOT NULL,
	"credential_configured" boolean DEFAULT false NOT NULL,
	"verification_status" "catalog_verification_status" DEFAULT 'unverified' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"failure_reason" text,
	"requires_external_host" boolean DEFAULT false NOT NULL,
	"execution_plan" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_catalog_live" (
	"id" text PRIMARY KEY NOT NULL,
	"entries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool_catalog_meta" (
	"id" text PRIMARY KEY NOT NULL,
	"last_sync" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "tool_catalog_type_idx" ON "tool_catalog" USING btree ("type");--> statement-breakpoint
CREATE INDEX "tool_catalog_auth_idx" ON "tool_catalog" USING btree ("auth");--> statement-breakpoint
CREATE INDEX "tool_catalog_free_idx" ON "tool_catalog" USING btree ("free") WHERE free;--> statement-breakpoint
CREATE INDEX "tool_catalog_verified_idx" ON "tool_catalog" USING btree ("verified") WHERE verified;--> statement-breakpoint
CREATE INDEX "tool_catalog_executable_now_idx" ON "tool_catalog" USING btree ("executable_now") WHERE executable_now;--> statement-breakpoint
CREATE INDEX "tool_catalog_verification_status_idx" ON "tool_catalog" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "tool_catalog_category_idx" ON "tool_catalog" USING btree ("category");--> statement-breakpoint
CREATE INDEX "tool_catalog_source_idx" ON "tool_catalog" USING btree ("source");--> statement-breakpoint
CREATE INDEX "tool_catalog_capabilities_gin" ON "tool_catalog" USING gin ("capabilities");