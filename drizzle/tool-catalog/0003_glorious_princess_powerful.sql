CREATE TABLE "connector_tokens" (
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"refresh_token_sealed" text,
	"access_token_sealed" text,
	"expires_at" bigint,
	"scope" text,
	"provider_account_id" text,
	"provider_account_name" text,
	"auth_failed_at" bigint,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "connector_tokens_user_id_provider_pk" PRIMARY KEY("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"sentiment" text NOT NULL,
	"message" text NOT NULL,
	"page_url" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_files" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"chat_id" text,
	"filename" text NOT NULL,
	"object_key" text NOT NULL,
	"media_type" text NOT NULL,
	"size" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" bigint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"chat_id" text,
	"source_message_id" text,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "connector_tokens_user_idx" ON "connector_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "feedback_user_idx" ON "feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "library_files_user_updated_idx" ON "library_files" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "library_files_user_id_idx" ON "library_files" USING btree ("user_id","id");--> statement-breakpoint
CREATE INDEX "rate_limits_expires_idx" ON "rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "user_notes_user_updated_idx" ON "user_notes" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "user_notes_user_id_idx" ON "user_notes" USING btree ("user_id","id");