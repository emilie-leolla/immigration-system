-- CreateIndex
CREATE INDEX "Application_clientId_idx" ON "Application"("clientId");

-- CreateIndex
CREATE INDEX "Application_agentId_idx" ON "Application"("agentId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "Document_procedureId_idx" ON "Document"("procedureId");

-- CreateIndex
CREATE INDEX "Message_procedureId_idx" ON "Message"("procedureId");

-- CreateIndex
CREATE INDEX "OfficialMessage_receiverId_idx" ON "OfficialMessage"("receiverId");

-- CreateIndex
CREATE INDEX "OfficialMessage_senderId_idx" ON "OfficialMessage"("senderId");

-- CreateIndex
CREATE INDEX "Procedure_applicationId_idx" ON "Procedure"("applicationId");

-- CreateIndex
CREATE INDEX "payment_subscriptionId_idx" ON "payment"("subscriptionId");

-- CreateIndex
CREATE INDEX "user_agentId_idx" ON "user"("agentId");
