-- 工单流程改造：待寄品/已寄品/待返稿/待发布/已发布 + 评论需求 + 投放需求

-- 1. TicketStatus 加 5 个新值
ALTER TYPE "TicketStatus" ADD VALUE 'PENDING_SAMPLE';
ALTER TYPE "TicketStatus" ADD VALUE 'SAMPLED';
ALTER TYPE "TicketStatus" ADD VALUE 'PENDING_MANUSCRIPT';
ALTER TYPE "TicketStatus" ADD VALUE 'PENDING_PUBLISH';
ALTER TYPE "TicketStatus" ADD VALUE 'PUBLISHED';

-- 2. CooperationTicket 加字段
ALTER TABLE "CooperationTicket" ADD COLUMN "sampleConfirmedAt" TIMESTAMP(3);
ALTER TABLE "CooperationTicket" ADD COLUMN "sampleConfirmedById" TEXT;
ALTER TABLE "CooperationTicket" ADD COLUMN "publishScheduleDate" DATE;
ALTER TABLE "CooperationTicket" ADD COLUMN "publishLink" TEXT;
ALTER TABLE "CooperationTicket" ADD COLUMN "publishAt" TIMESTAMP(3);
ALTER TABLE "CooperationTicket" ADD COLUMN "publishScheduleNotifiedAt" TIMESTAMP(3);

-- 3. 外键：sampleConfirmedById -> User
ALTER TABLE "CooperationTicket" ADD CONSTRAINT "CooperationTicket_sampleConfirmedById_fkey"
  FOREIGN KEY ("sampleConfirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. CommentRequest 表
CREATE TYPE "CommentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DONE');

CREATE TABLE "CommentRequest" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "status" "CommentRequestStatus" NOT NULL DEFAULT 'PENDING',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommentRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CommentRequest" ADD CONSTRAINT "CommentRequest_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "CooperationTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommentRequest" ADD CONSTRAINT "CommentRequest_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "CommentRequest_ticketId_idx" ON "CommentRequest"("ticketId");

-- 5. PromotionRequest 表
CREATE TYPE "PromotionPlatform" AS ENUM ('XIAOHONGSHU_DOUPLUS', 'DOUYIN_QIANCHUAN', 'OTHER');
CREATE TYPE "PromotionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DONE');

CREATE TABLE "PromotionRequest" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "platform" "PromotionPlatform" NOT NULL,
  "budget" DECIMAL(12,2) NOT NULL,
  "plan" TEXT NOT NULL,
  "status" "PromotionRequestStatus" NOT NULL DEFAULT 'PENDING',
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromotionRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PromotionRequest" ADD CONSTRAINT "PromotionRequest_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "CooperationTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionRequest" ADD CONSTRAINT "PromotionRequest_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "PromotionRequest_ticketId_idx" ON "PromotionRequest"("ticketId");
