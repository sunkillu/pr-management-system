-- 运营端采买需求：ProcurementRequest + ProcurementTask
CREATE TYPE "ProcurementType" AS ENUM ('WEEKLY_STYLE', 'LINK_SPECIFIC');
CREATE TYPE "ProcurementStatus" AS ENUM ('PENDING', 'DISTRIBUTED', 'IN_PROGRESS', 'DONE', 'CANCELLED');
CREATE TYPE "ProcurementTaskStatus" AS ENUM ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'DONE', 'CANCELLED');
CREATE TYPE "InfluencerAuthStatus" AS ENUM ('AUTHORIZED', 'COOPERATED_NO_AUTH', 'NEW');

CREATE TABLE "ProcurementRequest" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "type" "ProcurementType" NOT NULL,
  "styles" TEXT[] NOT NULL DEFAULT '{}',
  "quantity" INTEGER,
  "materialType" TEXT,
  "reason" TEXT,
  "publishLinks" TEXT[] NOT NULL DEFAULT '{}',
  "status" "ProcurementStatus" NOT NULL DEFAULT 'PENDING',
  "cancelReason" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProcurementRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProcurementRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProcurementRequest_status_updatedAt_id_idx" ON "ProcurementRequest"("status", "updatedAt", "id");
CREATE INDEX "ProcurementRequest_createdById_updatedAt_id_idx" ON "ProcurementRequest"("createdById", "updatedAt", "id");

CREATE TABLE "ProcurementTask" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "assigneeId" TEXT NOT NULL,
  "quantity" INTEGER,
  "status" "ProcurementTaskStatus" NOT NULL DEFAULT 'PENDING',
  "acceptedAt" TIMESTAMP(3),
  "influencerStatus" "InfluencerAuthStatus",
  "influencerName" TEXT,
  "priceFeedback" TEXT,
  "priceConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "netdiskUploaded" BOOLEAN NOT NULL DEFAULT false,
  "paymentId" TEXT,
  "ticketId" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProcurementTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProcurementTask_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ProcurementRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProcurementTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ProcurementTask_requestId_idx" ON "ProcurementTask"("requestId");
CREATE INDEX "ProcurementTask_assigneeId_status_idx" ON "ProcurementTask"("assigneeId", "status");
