-- TicketStatus 新增待素材审批（标记完成 → PR负责人审批回收素材 → 通过后生成打款单）
ALTER TYPE "TicketStatus" ADD VALUE 'MATERIAL_REVIEW';

-- 回收素材类型枚举
CREATE TYPE "MaterialType" AS ENUM ('NOTE_LINK', 'VIDEO', 'IMAGE', 'OTHER');

-- 回收素材记录表
CREATE TABLE "MaterialRecord" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "type" "MaterialType" NOT NULL,
    "url" TEXT NOT NULL,
    "note" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MaterialRecord_ticketId_idx" ON "MaterialRecord"("ticketId");

ALTER TABLE "MaterialRecord" ADD CONSTRAINT "MaterialRecord_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "CooperationTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MaterialRecord" ADD CONSTRAINT "MaterialRecord_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
