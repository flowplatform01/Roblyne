CREATE TABLE "payout_destinations" (
  "id" serial PRIMARY KEY NOT NULL,
  "org_id" integer NOT NULL,
  "provider" text DEFAULT 'flowpay' NOT NULL,
  "external_recipient_id" text NOT NULL,
  "display_name" text NOT NULL,
  "payout_method" text NOT NULL,
  "masked_target" text NOT NULL,
  "currency" text DEFAULT 'XAF' NOT NULL,
  "verification_status" text DEFAULT 'pending' NOT NULL,
  "confirmation_url" text,
  "last_verified_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "payout_destinations_org_id_organizations_id_fk"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE "settlements" ADD COLUMN "payout_destination_id" integer;
--> statement-breakpoint
ALTER TABLE "settlements" ADD COLUMN "payout_provider" text;
--> statement-breakpoint
ALTER TABLE "settlements" ADD COLUMN "provider_payout_id" text;
--> statement-breakpoint
ALTER TABLE "settlements" ADD COLUMN "provider_payout_status" text;
--> statement-breakpoint
ALTER TABLE "settlements" ADD COLUMN "payout_idempotency_key" text;
--> statement-breakpoint
ALTER TABLE "settlements" ADD COLUMN "payout_failure_reason" text;
--> statement-breakpoint
ALTER TABLE "settlements" ADD COLUMN "payout_attempted_at" timestamp;
--> statement-breakpoint
CREATE INDEX "payout_destinations_org_id_idx" ON "payout_destinations" USING btree ("org_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "payout_destinations_provider_recipient_uq" ON "payout_destinations" USING btree ("provider", "external_recipient_id");
--> statement-breakpoint
CREATE INDEX "settlements_provider_payout_id_idx" ON "settlements" USING btree ("provider_payout_id");
