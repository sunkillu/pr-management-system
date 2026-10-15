ALTER TABLE "CooperationTicket"
  ADD COLUMN "scriptRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "materialApprovedAt" TIMESTAMP(3),
  ADD COLUMN "materialApprovedById" TEXT;
