ALTER TABLE "CooperationTicket" ADD COLUMN IF NOT EXISTS "homepageLinks" JSONB;
ALTER TABLE "CooperationTicket" ADD COLUMN IF NOT EXISTS "sampleRequired" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "ProcurementAllocation" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "prId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "ticketId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcurementAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProcurementAllocation_ticketId_key" UNIQUE ("ticketId"),
  CONSTRAINT "ProcurementAllocation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ProcurementItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProcurementAllocation_prId_fkey" FOREIGN KEY ("prId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ProcurementAllocation_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "CooperationTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ProcurementAllocation_itemId_idx" ON "ProcurementAllocation"("itemId");
CREATE INDEX IF NOT EXISTS "ProcurementAllocation_prId_idx" ON "ProcurementAllocation"("prId");
