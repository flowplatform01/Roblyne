ALTER TABLE "legal_documents" ADD COLUMN "language" text DEFAULT 'en' NOT NULL;
--> statement-breakpoint
DROP INDEX "legal_documents_type_version_uq";
--> statement-breakpoint
CREATE UNIQUE INDEX "legal_documents_type_language_version_uq" ON "legal_documents" USING btree ("document_type","language","version");
