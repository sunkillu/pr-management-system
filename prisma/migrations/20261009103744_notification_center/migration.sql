-- CreateEnum
CREATE TYPE "NotifyKind" AS ENUM ('APPROVAL_PENDING', 'APPROVED', 'REJECTED', 'REMIND', 'SYSTEM');

-- AlterTable
ALTER TABLE "NotificationLog" ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kind" "NotifyKind" NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN     "title" TEXT;

-- CreateIndex
CREATE INDEX "NotificationLog_receiverId_isRead_createdAt_idx" ON "NotificationLog"("receiverId", "isRead", "createdAt");
