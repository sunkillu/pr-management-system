-- 工单类型区分：合作工单 / 采买工单 + 采买子类型
-- 注意：PG 枚举 ADD VALUE 单独成句，不与其它 DDL 混用

-- 1. 新建枚举类型
CREATE TYPE "TicketKind" AS ENUM ('COOPERATION', 'PROCUREMENT');
CREATE TYPE "ProcurementSubType" AS ENUM ('WEEKLY_STYLE', 'LINK_SPECIFIC');

-- 2. TicketStatus 加 PENDING_PROCUREMENT（待采买审批）
ALTER TYPE "TicketStatus" ADD VALUE 'PENDING_PROCUREMENT';

-- 2b. LogAction 加 ACCEPT / ASSIGN（采买工单接单/分配）
ALTER TYPE "LogAction" ADD VALUE 'ACCEPT';
ALTER TYPE "LogAction" ADD VALUE 'ASSIGN';

-- 3. CooperationTicket 加字段
ALTER TABLE "CooperationTicket" ADD COLUMN "ticketKind" "TicketKind" NOT NULL DEFAULT 'COOPERATION';
ALTER TABLE "CooperationTicket" ADD COLUMN "procurementType" "ProcurementSubType";
ALTER TABLE "CooperationTicket" ADD COLUMN "quantity" INTEGER;
ALTER TABLE "CooperationTicket" ADD COLUMN "materialType" TEXT;
ALTER TABLE "CooperationTicket" ADD COLUMN "reason" TEXT;
ALTER TABLE "CooperationTicket" ADD COLUMN "publishLinks" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "CooperationTicket" ADD COLUMN "sourceTicketId" TEXT;

-- 4. 来源采买工单外键
ALTER TABLE "CooperationTicket" ADD CONSTRAINT "CooperationTicket_sourceTicketId_fkey"
  FOREIGN KEY ("sourceTicketId") REFERENCES "CooperationTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. 采买工单接单/分发字段
ALTER TABLE "CooperationTicket" ADD COLUMN "assigneeId" TEXT;
ALTER TABLE "CooperationTicket" ADD COLUMN "acceptedAt" TIMESTAMP(3);
ALTER TABLE "CooperationTicket" ADD COLUMN "procurementApprovedAt" TIMESTAMP(3);
ALTER TABLE "CooperationTicket" ADD CONSTRAINT "CooperationTicket_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. 工单归属人变更记录表
CREATE TABLE "TicketAssigneeLog" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "fromUserId" TEXT,
  "toUserId" TEXT NOT NULL,
  "changedById" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketAssigneeLog_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "TicketAssigneeLog" ADD CONSTRAINT "TicketAssigneeLog_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "CooperationTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TicketAssigneeLog" ADD CONSTRAINT "TicketAssigneeLog_fromUserId_fkey"
  FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TicketAssigneeLog" ADD CONSTRAINT "TicketAssigneeLog_toUserId_fkey"
  FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketAssigneeLog" ADD CONSTRAINT "TicketAssigneeLog_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "CooperationTicket_ticketKind_idx" ON "CooperationTicket"("ticketKind");
CREATE INDEX "CooperationTicket_sourceTicketId_idx" ON "CooperationTicket"("sourceTicketId");
CREATE INDEX "CooperationTicket_assigneeId_idx" ON "CooperationTicket"("assigneeId");
CREATE INDEX "TicketAssigneeLog_ticketId_idx" ON "TicketAssigneeLog"("ticketId");
