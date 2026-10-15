-- 样品寄送请求字段（枚举值已在上一条迁移提交后可安全使用）
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
