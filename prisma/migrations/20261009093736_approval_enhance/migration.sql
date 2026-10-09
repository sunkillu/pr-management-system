-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('CONTENT', 'PAYMENT');

-- CreateEnum
CREATE TYPE "LogAction" AS ENUM ('SUBMIT', 'RESUBMIT', 'APPROVE', 'REJECT', 'PUBLISH', 'MARK_PAID', 'VOID', 'LINK', 'UNLINK');

-- AlterEnum
ALTER TYPE "ContentStatus" ADD VALUE 'VOIDED';

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'VOIDED';

-- AlterTable
ALTER TABLE "Content" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "voidReason" TEXT;

-- AlterTable
ALTER TABLE "PaymentRequest" ADD COLUMN     "voidReason" TEXT;

-- CreateTable
CREATE TABLE "ApprovalLog" (
    "id" TEXT NOT NULL,
    "docType" "DocType" NOT NULL,
    "docId" TEXT NOT NULL,
    "action" "LogAction" NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "note" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalLink" (
    "id" TEXT NOT NULL,
    "fromType" "DocType" NOT NULL,
    "fromId" TEXT NOT NULL,
    "toType" "DocType" NOT NULL,
    "toId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApprovalLog_docType_docId_createdAt_idx" ON "ApprovalLog"("docType", "docId", "createdAt");

-- CreateIndex
CREATE INDEX "ApprovalLink_fromType_fromId_idx" ON "ApprovalLink"("fromType", "fromId");

-- CreateIndex
CREATE INDEX "ApprovalLink_toType_toId_idx" ON "ApprovalLink"("toType", "toId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalLink_fromType_fromId_toType_toId_key" ON "ApprovalLink"("fromType", "fromId", "toType", "toId");

-- AddForeignKey
ALTER TABLE "Content" ADD CONSTRAINT "Content_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalLog" ADD CONSTRAINT "ApprovalLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalLink" ADD CONSTRAINT "ApprovalLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
