CREATE TABLE "legal_documents" (
  "id" serial PRIMARY KEY NOT NULL,
  "document_type" text NOT NULL,
  "title" text NOT NULL,
  "content" text NOT NULL,
  "version" integer NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "effective_at" timestamp,
  "requires_reacceptance" boolean DEFAULT false NOT NULL,
  "published_at" timestamp,
  "created_by_user_id" integer REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "legal_documents_type_version_uq" ON "legal_documents" USING btree ("document_type","version");
--> statement-breakpoint
CREATE INDEX "legal_documents_public_lookup_idx" ON "legal_documents" USING btree ("document_type","status","effective_at");
--> statement-breakpoint
CREATE TABLE "legal_acceptances" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "legal_document_id" integer NOT NULL REFERENCES "legal_documents"("id") ON DELETE restrict,
  "document_type" text NOT NULL,
  "document_version" integer NOT NULL,
  "accepted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "legal_acceptances_user_document_uq" ON "legal_acceptances" USING btree ("user_id","legal_document_id");
--> statement-breakpoint
CREATE INDEX "legal_acceptances_user_type_version_idx" ON "legal_acceptances" USING btree ("user_id","document_type","document_version");
