-- 采买逐条审批：ProcurementItem 表（采买工单每行款式请求，逐条审批 + 分配建单）
CREATE TABLE "ProcurementItem" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "link" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedQty" INTEGER,
    "rejectReason" TEXT,
    "allocatedTicketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProcurementItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ProcurementItem_ticketId_idx" ON "ProcurementItem"("ticketId");
ALTER TABLE "ProcurementItem" ADD CONSTRAINT "ProcurementItem_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "CooperationTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
