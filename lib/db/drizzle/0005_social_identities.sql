ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
--> statement-breakpoint
CREATE TABLE "social_identities" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "provider" text NOT NULL,
  "provider_subject" text NOT NULL,
  "email" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "social_identities_provider_subject_uq" ON "social_identities" USING btree ("provider", "provider_subject");
--> statement-breakpoint
CREATE UNIQUE INDEX "social_identities_user_provider_uq" ON "social_identities" USING btree ("user_id", "provider");
--> statement-breakpoint
CREATE INDEX "social_identities_user_id_idx" ON "social_identities" USING btree ("user_id");
--> statement-breakpoint
CREATE TABLE "email_otp_tokens" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "purpose" text NOT NULL,
  "code_hash" text NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "email_otp_tokens_user_purpose_idx" ON "email_otp_tokens" USING btree ("user_id", "purpose", "created_at");
