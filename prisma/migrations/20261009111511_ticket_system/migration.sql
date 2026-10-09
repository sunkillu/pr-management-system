-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'SETTLING', 'SETTLED', 'REJECTED', 'VOIDED');

-- AlterEnum
ALTER TYPE "RequestType" ADD VALUE 'TICKET';
ALTER TYPE "DocType" ADD VALUE 'TICKET';
ALTER TYPE "NotifyKind" ADD VALUE 'ESCALATE';

-- CreateTable
CREATE TABLE "CooperationTicket" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "CoopType" NOT NULL,
    "budgetFee" DECIMAL(12,2) NOT NULL,
    "actualFee" DECIMAL(12,2),
    "startDate" DATE,
    "endDate" DATE,
    "note" TEXT,
    "status" "TicketStatus" NOT NULL DEFAULT 'DRAFT',
    "rejectReason" TEXT,
    "voidReason" TEXT,
    "escalatedAt" TIMESTAMP(3),
    "influencerId" TEXT,
    "makeupArtistId" TEXT,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CooperationTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketNode" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "expectedAt" DATE,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "TicketNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CooperationReview" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "influencerId" TEXT,
    "makeupArtistId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "reviewerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CooperationReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mentionedIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CooperationTicket_status_idx" ON "CooperationTicket"("status");
CREATE INDEX "CooperationTicket_creatorId_idx" ON "CooperationTicket"("creatorId");
CREATE INDEX "TicketNode_ticketId_sort_idx" ON "TicketNode"("ticketId", "sort");
CREATE UNIQUE INDEX "CooperationReview_ticketId_key" ON "CooperationReview"("ticketId");
CREATE INDEX "CooperationReview_influencerId_idx" ON "CooperationReview"("influencerId");
CREATE INDEX "CooperationReview_makeupArtistId_idx" ON "CooperationReview"("makeupArtistId");
CREATE INDEX "TicketComment_ticketId_createdAt_idx" ON "TicketComment"("ticketId", "createdAt");

-- AddForeignKey
ALTER TABLE "CooperationTicket" ADD CONSTRAINT "CooperationTicket_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CooperationTicket" ADD CONSTRAINT "CooperationTicket_makeupArtistId_fkey" FOREIGN KEY ("makeupArtistId") REFERENCES "MakeupArtist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CooperationTicket" ADD CONSTRAINT "CooperationTicket_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketNode" ADD CONSTRAINT "TicketNode_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "CooperationTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketNode" ADD CONSTRAINT "TicketNode_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CooperationReview" ADD CONSTRAINT "CooperationReview_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "CooperationTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CooperationReview" ADD CONSTRAINT "CooperationReview_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CooperationReview" ADD CONSTRAINT "CooperationReview_makeupArtistId_fkey" FOREIGN KEY ("makeupArtistId") REFERENCES "MakeupArtist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CooperationReview" ADD CONSTRAINT "CooperationReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "CooperationTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: 打款单关联工单
ALTER TABLE "PaymentRequest" ADD COLUMN "ticketId" TEXT;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "CooperationTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: 超时升级标记
ALTER TABLE "Influencer" ADD COLUMN "escalatedAt" TIMESTAMP(3);
ALTER TABLE "CooperationRequest" ADD COLUMN "escalatedAt" TIMESTAMP(3);
