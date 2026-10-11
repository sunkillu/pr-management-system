-- 需求4：新增 WAREHOUSE 角色；SampleShipment 加寄件信息字段
ALTER TYPE "Role" ADD VALUE 'WAREHOUSE';
ALTER TABLE "SampleShipment" ADD COLUMN "courier" TEXT;
ALTER TABLE "SampleShipment" ADD COLUMN "shippedBy" TEXT;

-- 需求3：内容发布后评论及处理
CREATE TABLE "ContentComment" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "author" TEXT,
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ContentComment_contentId_idx" ON "ContentComment"("contentId");
ALTER TABLE "ContentComment" ADD CONSTRAINT "ContentComment_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentComment" ADD CONSTRAINT "ContentComment_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContentComment" ADD CONSTRAINT "ContentComment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 需求5：工单寄品明细
ALTER TABLE "CooperationTicket" ADD COLUMN "shipItems" JSONB;
