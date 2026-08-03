-- CreateIndex
CREATE INDEX "calendar_events_startsAt_endsAt_idx" ON "calendar_events"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "leads_source_createdAt_idx" ON "leads"("source", "createdAt");

-- CreateIndex
CREATE INDEX "project_status_history_toStatus_changedAt_idx" ON "project_status_history"("toStatus", "changedAt");

-- CreateIndex
CREATE INDEX "projects_source_createdAt_idx" ON "projects"("source", "createdAt");
