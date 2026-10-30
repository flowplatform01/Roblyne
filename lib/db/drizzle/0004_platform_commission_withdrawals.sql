CREATE TABLE "platform_payout_destinations" (
  "id" serial PRIMARY KEY NOT NULL,
  "provider" text DEFAULT 'flowpay' NOT NULL,
  "external_recipient_id" text NOT NULL,
  "display_name" text NOT NULL,
  "payout_method" text NOT NULL,
  "masked_target" text NOT NULL,
  "currency" text DEFAULT 'XAF' NOT NULL,
  "verification_status" text DEFAULT 'pending' NOT NULL,
  "confirmation_url" text,
  "last_verified_at" timestamp,
  "created_by_user_id" integer NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "platform_payout_destinations_provider_recipient_uq" ON "platform_payout_destinations" USING btree ("provider", "external_recipient_id");
--> statement-breakpoint
CREATE TABLE "platform_withdrawals" (
  "id" serial PRIMARY KEY NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "currency" text DEFAULT 'XAF' NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  "payout_destination_id" integer NOT NULL REFERENCES "platform_payout_destinations"("id"),
  "payout_provider" text DEFAULT 'flowpay' NOT NULL,
  "provider_payout_id" text,
  "provider_payout_status" text,
  "payout_idempotency_key" text NOT NULL,
  "failure_reason" text,
  "requested_by_user_id" integer NOT NULL REFERENCES "users"("id"),
  "requested_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "platform_withdrawals_status_idx" ON "platform_withdrawals" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "platform_withdrawals_destination_idx" ON "platform_withdrawals" USING btree ("payout_destination_id");
--> statement-breakpoint
CREATE INDEX "platform_withdrawals_provider_payout_idx" ON "platform_withdrawals" USING btree ("provider_payout_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "platform_withdrawals_idempotency_uq" ON "platform_withdrawals" USING btree ("payout_idempotency_key");
--> statement-breakpoint
CREATE TABLE "platform_withdrawal_allocations" (
  "id" serial PRIMARY KEY NOT NULL,
  "platform_withdrawal_id" integer NOT NULL REFERENCES "platform_withdrawals"("id") ON DELETE cascade,
  "financial_transaction_id" integer NOT NULL REFERENCES "financial_transactions"("id") ON DELETE cascade,
  "amount" numeric(12, 2) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "platform_withdrawal_allocations_withdrawal_idx" ON "platform_withdrawal_allocations" USING btree ("platform_withdrawal_id");
--> statement-breakpoint
CREATE INDEX "platform_withdrawal_allocations_transaction_idx" ON "platform_withdrawal_allocations" USING btree ("financial_transaction_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "platform_withdrawal_allocations_withdrawal_transaction_uq" ON "platform_withdrawal_allocations" USING btree ("platform_withdrawal_id", "financial_transaction_id");
