-- 寄件请求状态机：新增 PENDING / PREPARING / CANCELLED（RETURNED 废弃保留）
ALTER TYPE "SampleStatus" ADD VALUE 'PENDING';
ALTER TYPE "SampleStatus" ADD VALUE 'PREPARING';
ALTER TYPE "SampleStatus" ADD VALUE 'CANCELLED';

-- DocType 新增 SAMPLE（寄件请求单）
ALTER TYPE "DocType" ADD VALUE 'SAMPLE';

-- SampleShipment 新增字段
ALTER TABLE "SampleShipment" ADD COLUMN "ticketId" TEXT;
ALTER TABLE "SampleShipment" ADD COLUMN "items" JSONB;
ALTER TABLE "SampleShipment" ADD COLUMN "receiverName" TEXT;
ALTER TABLE "SampleShipment" ADD COLUMN "receiverPhone" TEXT;
ALTER TABLE "SampleShipment" ADD COLUMN "receiverAddress" TEXT;
ALTER TABLE "SampleShipment" ADD COLUMN "signedAt" TIMESTAMP(3);
ALTER TABLE "SampleShipment" ADD COLUMN "signedNote" TEXT;
ALTER TABLE "SampleShipment" ADD COLUMN "cancelReason" TEXT;
ALTER TABLE "SampleShipment" ALTER COLUMN "status" SET DEFAULT 'PENDING';
CREATE INDEX "SampleShipment_ticketId_idx" ON "SampleShipment"("ticketId");
ALTER TABLE "SampleShipment" ADD CONSTRAINT "SampleShipment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "CooperationTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
