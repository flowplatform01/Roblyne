CREATE INDEX "tickets_event_issued_at_idx" ON "tickets" USING btree ("event_id","issued_at");
--> statement-breakpoint
CREATE INDEX "campaign_responses_campaign_submitted_at_idx" ON "campaign_responses" USING btree ("campaign_id","submitted_at");
--> statement-breakpoint
CREATE INDEX "org_members_org_invited_at_idx" ON "organization_members" USING btree ("org_id","invited_at");
