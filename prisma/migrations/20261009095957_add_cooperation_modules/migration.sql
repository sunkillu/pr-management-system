-- CreateEnum
CREATE TYPE "InfluencerStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CoopType" AS ENUM ('INFLUENCER_POST', 'INFLUENCER_LIVE', 'MAKEUP');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('INFLUENCER', 'COOP_REQUEST');

-- CreateEnum
CREATE TYPE "ApproverStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CoopRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SampleStatus" AS ENUM ('SHIPPED', 'SIGNED', 'RETURNED', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "NotifyType" AS ENUM ('FEISHU', 'MOCK');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocType" ADD VALUE 'INFLUENCER';
ALTER TYPE "DocType" ADD VALUE 'COOP_REQUEST';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'PR_MANAGER';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "feishuUserId" TEXT;

-- CreateTable
CREATE TABLE "Influencer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platforms" TEXT[],
    "contactInfo" TEXT,
    "bio" TEXT,
    "status" "InfluencerStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "coopCount" INTEGER NOT NULL DEFAULT 0,
    "totalFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "registeredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Influencer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MakeupArtist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactInfo" TEXT,
    "isLongTerm" BOOLEAN NOT NULL DEFAULT false,
    "onboardDate" DATE,
    "notes" TEXT,
    "coopCount" INTEGER NOT NULL DEFAULT 0,
    "totalFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MakeupArtist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CooperationRecord" (
    "id" TEXT NOT NULL,
    "type" "CoopType" NOT NULL,
    "fee" DECIMAL(12,2) NOT NULL,
    "coopDate" DATE NOT NULL,
    "note" TEXT,
    "influencerId" TEXT,
    "makeupArtistId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CooperationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestApprover" (
    "id" TEXT NOT NULL,
    "requestType" "RequestType" NOT NULL,
    "requestId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "status" "ApproverStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestApprover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CooperationRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reqType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "attachments" JSONB,
    "status" "CoopRequestStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "submitterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CooperationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentVoucher" (
    "id" TEXT NOT NULL,
    "paymentRequestId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SampleShipment" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "trackingNo" TEXT,
    "shippedDate" DATE,
    "status" "SampleStatus" NOT NULL DEFAULT 'SHIPPED',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SampleShipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "type" "NotifyType" NOT NULL,
    "receiverId" TEXT,
    "content" TEXT NOT NULL,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Influencer_status_idx" ON "Influencer"("status");

-- CreateIndex
CREATE INDEX "CooperationRecord_coopDate_idx" ON "CooperationRecord"("coopDate");

-- CreateIndex
CREATE INDEX "RequestApprover_requestType_requestId_idx" ON "RequestApprover"("requestType", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "RequestApprover_requestType_requestId_approverId_key" ON "RequestApprover"("requestType", "requestId", "approverId");

-- CreateIndex
CREATE INDEX "CooperationRequest_status_idx" ON "CooperationRequest"("status");

-- CreateIndex
CREATE INDEX "PaymentVoucher_paymentRequestId_idx" ON "PaymentVoucher"("paymentRequestId");

-- CreateIndex
CREATE INDEX "SampleShipment_status_idx" ON "SampleShipment"("status");

-- CreateIndex
CREATE INDEX "NotificationLog_relatedType_relatedId_createdAt_idx" ON "NotificationLog"("relatedType", "relatedId", "createdAt");

-- AddForeignKey
ALTER TABLE "Influencer" ADD CONSTRAINT "Influencer_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperationRecord" ADD CONSTRAINT "CooperationRecord_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperationRecord" ADD CONSTRAINT "CooperationRecord_makeupArtistId_fkey" FOREIGN KEY ("makeupArtistId") REFERENCES "MakeupArtist"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperationRecord" ADD CONSTRAINT "CooperationRecord_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestApprover" ADD CONSTRAINT "RequestApprover_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperationRequest" ADD CONSTRAINT "CooperationRequest_submitterId_fkey" FOREIGN KEY ("submitterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentVoucher" ADD CONSTRAINT "PaymentVoucher_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "PaymentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentVoucher" ADD CONSTRAINT "PaymentVoucher_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleShipment" ADD CONSTRAINT "SampleShipment_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SampleShipment" ADD CONSTRAINT "SampleShipment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
