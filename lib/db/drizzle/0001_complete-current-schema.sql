CREATE TABLE "platform_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_mode" text DEFAULT 'quantity_first' NOT NULL,
	"default_currency" text DEFAULT 'XAF' NOT NULL,
	"supported_currencies" text DEFAULT 'XAF' NOT NULL,
	"support_email" text,
	"support_phone" text,
	"support_whatsapp" text,
	"support_url" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commission_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"pillar" text NOT NULL,
	"rate" numeric(5, 4) DEFAULT '0.0500' NOT NULL,
	"currency" text DEFAULT 'XAF' NOT NULL,
	"is_active" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "commission_configs_pillar_unique" UNIQUE("pillar")
);
--> statement-breakpoint
CREATE TABLE "financial_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"pillar" text NOT NULL,
	"entity_id" integer NOT NULL,
	"entity_title" text,
	"transaction_type" text NOT NULL,
	"gross_amount" numeric(12, 2) NOT NULL,
	"commission_rate" numeric(5, 4) NOT NULL,
	"commission_amount" numeric(12, 2) NOT NULL,
	"org_earnings" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'XAF' NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"payment_provider" text DEFAULT 'platform' NOT NULL,
	"payment_status" text DEFAULT 'not_required' NOT NULL,
	"flowpay_transaction_id" text,
	"idempotency_key" text,
	"settlement_status" text DEFAULT 'pending' NOT NULL,
	"settlement_id" integer,
	"payer_name" text,
	"payer_email" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlement_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"settlement_id" integer NOT NULL,
	"financial_transaction_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'XAF' NOT NULL,
	"status" text DEFAULT 'pending_settlement' NOT NULL,
	"transaction_count" integer DEFAULT 0 NOT NULL,
	"payout_method" text,
	"payout_account" text,
	"notes" text,
	"released_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_intents" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_reference" text NOT NULL,
	"pillar" text NOT NULL,
	"entity_id" integer NOT NULL,
	"transaction_type" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'XAF' NOT NULL,
	"customer_name" text,
	"customer_email" text,
	"customer_phone" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'initializing' NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"idempotency_key" text NOT NULL,
	"flowpay_transaction_id" text,
	"checkout_url" text,
	"financial_transaction_id" integer,
	"error_message" text,
	"finalized_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_intents_external_reference_unique" UNIQUE("external_reference"),
	CONSTRAINT "payment_intents_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "payment_webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "candidates" ALTER COLUMN "currency" SET DEFAULT 'XAF';--> statement-breakpoint
ALTER TABLE "elections" ALTER COLUMN "currency" SET DEFAULT 'XAF';--> statement-breakpoint
ALTER TABLE "ticket_types" ALTER COLUMN "currency" SET DEFAULT 'XAF';--> statement-breakpoint
ALTER TABLE "campaigns" ALTER COLUMN "currency" SET DEFAULT 'XAF';--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "payment_status" text DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "flowpay_transaction_id" text;--> statement-breakpoint
ALTER TABLE "votes" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "payment_status" text DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "flowpay_transaction_id" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "campaign_responses" ADD COLUMN "payment_status" text DEFAULT 'not_required' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_responses" ADD COLUMN "flowpay_transaction_id" text;--> statement-breakpoint
ALTER TABLE "campaign_responses" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_allocations" ADD CONSTRAINT "settlement_allocations_settlement_id_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_allocations" ADD CONSTRAINT "settlement_allocations_financial_transaction_id_financial_transactions_id_fk" FOREIGN KEY ("financial_transaction_id") REFERENCES "public"."financial_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_intents" ADD CONSTRAINT "payment_intents_financial_transaction_id_financial_transactions_id_fk" FOREIGN KEY ("financial_transaction_id") REFERENCES "public"."financial_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "financial_transactions_org_id_idx" ON "financial_transactions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "financial_transactions_entity_idx" ON "financial_transactions" USING btree ("pillar","entity_id");--> statement-breakpoint
CREATE INDEX "financial_transactions_flowpay_transaction_idx" ON "financial_transactions" USING btree ("flowpay_transaction_id");--> statement-breakpoint
CREATE INDEX "financial_transactions_idempotency_key_idx" ON "financial_transactions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "financial_transactions_settlement_id_idx" ON "financial_transactions" USING btree ("settlement_id");--> statement-breakpoint
CREATE INDEX "financial_transactions_settlement_status_idx" ON "financial_transactions" USING btree ("settlement_status");--> statement-breakpoint
CREATE INDEX "financial_transactions_created_at_idx" ON "financial_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "settlement_allocations_settlement_id_idx" ON "settlement_allocations" USING btree ("settlement_id");--> statement-breakpoint
CREATE INDEX "settlement_allocations_financial_transaction_id_idx" ON "settlement_allocations" USING btree ("financial_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "settlement_allocations_settlement_transaction_uq" ON "settlement_allocations" USING btree ("settlement_id","financial_transaction_id");--> statement-breakpoint
CREATE INDEX "settlements_org_id_idx" ON "settlements" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "settlements_status_idx" ON "settlements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_intents_flowpay_transaction_idx" ON "payment_intents" USING btree ("flowpay_transaction_id");--> statement-breakpoint
CREATE INDEX "payment_intents_pillar_entity_idx" ON "payment_intents" USING btree ("pillar","entity_id");--> statement-breakpoint
CREATE INDEX "payment_intents_status_idx" ON "payment_intents" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_webhook_events_event_id_unique" ON "payment_webhook_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "organizations_owner_id_idx" ON "organizations" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "candidates_election_id_idx" ON "candidates" USING btree ("election_id");--> statement-breakpoint
CREATE INDEX "candidates_position_id_idx" ON "candidates" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "elections_org_id_idx" ON "elections" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "elections_status_idx" ON "elections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "elections_visibility_idx" ON "elections" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "elections_public_discovery_idx" ON "elections" USING btree ("visibility","status","created_at");--> statement-breakpoint
CREATE INDEX "positions_election_id_idx" ON "positions" USING btree ("election_id");--> statement-breakpoint
CREATE INDEX "vote_selections_vote_id_idx" ON "vote_selections" USING btree ("vote_id");--> statement-breakpoint
CREATE INDEX "vote_selections_candidate_id_idx" ON "vote_selections" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "votes_flowpay_transaction_idx" ON "votes" USING btree ("flowpay_transaction_id");--> statement-breakpoint
CREATE INDEX "events_org_id_idx" ON "events" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "events_status_idx" ON "events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "events_visibility_idx" ON "events" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "events_public_discovery_idx" ON "events" USING btree ("visibility","status","created_at");--> statement-breakpoint
CREATE INDEX "ticket_types_event_id_idx" ON "ticket_types" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "tickets_event_id_idx" ON "tickets" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "tickets_ticket_type_id_idx" ON "tickets" USING btree ("ticket_type_id");--> statement-breakpoint
CREATE INDEX "tickets_attendee_email_idx" ON "tickets" USING btree ("attendee_email");--> statement-breakpoint
CREATE INDEX "tickets_flowpay_transaction_idx" ON "tickets" USING btree ("flowpay_transaction_id");--> statement-breakpoint
CREATE INDEX "campaign_responses_campaign_id_idx" ON "campaign_responses" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaign_responses_status_idx" ON "campaign_responses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "campaign_responses_submitter_email_idx" ON "campaign_responses" USING btree ("submitter_email");--> statement-breakpoint
CREATE INDEX "campaign_responses_flowpay_transaction_idx" ON "campaign_responses" USING btree ("flowpay_transaction_id");--> statement-breakpoint
CREATE INDEX "campaigns_org_id_idx" ON "campaigns" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "campaigns_status_idx" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "campaigns_visibility_idx" ON "campaigns" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "campaigns_public_discovery_idx" ON "campaigns" USING btree ("visibility","status","created_at");