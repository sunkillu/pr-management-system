-- 工单进度改善：子任务阻塞状态 + 节点前置依赖
-- 注意：ALTER TYPE ... ADD VALUE 不能在事务块中执行，Prisma Migrate 会单独处理

-- 1. 子任务状态加 BLOCKED
ALTER TYPE "SubtaskStatus" ADD VALUE 'BLOCKED';

-- 2. 子任务加阻塞字段
ALTER TABLE "TicketSubtask" ADD COLUMN "blockedReason" TEXT;
ALTER TABLE "TicketSubtask" ADD COLUMN "blockedAt" TIMESTAMP(3);
ALTER TABLE "TicketSubtask" ADD COLUMN "blockedNotifiedAt" TIMESTAMP(3);

-- 3. 节点加前置依赖（自关联）
ALTER TABLE "TicketNode" ADD COLUMN "dependsOnId" TEXT;
ALTER TABLE "TicketNode" ADD COLUMN "unlockedNotifiedAt" TIMESTAMP(3);
ALTER TABLE "TicketNode" ADD CONSTRAINT "TicketNode_dependsOnId_fkey"
  FOREIGN KEY ("dependsOnId") REFERENCES "TicketNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
