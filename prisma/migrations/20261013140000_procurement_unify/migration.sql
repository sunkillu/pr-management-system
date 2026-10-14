-- 采买工单字段统一为合作工单子集：删除独立字段，采买特有信息改存 note / contentDirection
ALTER TABLE "CooperationTicket" DROP CONSTRAINT IF EXISTS "CooperationTicket_sourceTicketId_fkey";
DROP INDEX IF EXISTS "CooperationTicket_sourceTicketId_idx";
ALTER TABLE "CooperationTicket" DROP COLUMN IF EXISTS "sourceTicketId";
ALTER TABLE "CooperationTicket" DROP COLUMN IF EXISTS "quantity";
ALTER TABLE "CooperationTicket" DROP COLUMN IF EXISTS "materialType";
ALTER TABLE "CooperationTicket" DROP COLUMN IF EXISTS "reason";
ALTER TABLE "CooperationTicket" DROP COLUMN IF EXISTS "publishLinks";
