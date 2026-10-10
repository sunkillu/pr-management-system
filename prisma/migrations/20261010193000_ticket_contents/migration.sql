-- 内容收进合作工单：Content 新增 ticketId（关联工单）/ link（内容链接）/ attachments（内容附件）

-- AlterTable: Content 新增字段
ALTER TABLE "Content" ADD COLUMN "ticketId" TEXT;
ALTER TABLE "Content" ADD COLUMN "link" TEXT;
ALTER TABLE "Content" ADD COLUMN "attachments" JSONB;

-- AddForeignKey: Content -> CooperationTicket（工单删除时置空，不断链）
ALTER TABLE "Content" ADD CONSTRAINT "Content_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "CooperationTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Content_ticketId_idx" ON "Content"("ticketId");

-- LogAction 新增 CREATE / EDIT
ALTER TYPE "LogAction" ADD VALUE 'CREATE';
ALTER TYPE "LogAction" ADD VALUE 'EDIT';
