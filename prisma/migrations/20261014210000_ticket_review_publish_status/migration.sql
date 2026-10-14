-- AlterEnum: TicketStatus 新增 待返稿 / 已返稿 / 已发布（寄品签收 → 确定档期 → 返稿 → 发布）
-- 注意：PostgreSQL 的 ALTER TYPE ... ADD VALUE 不可在事务块内执行，
-- Prisma migrate 会自动处理（PG12+ 支持在事务中执行）。三句分开写，避免 55P04。
ALTER TYPE "TicketStatus" ADD VALUE 'PENDING_REVIEW';
ALTER TYPE "TicketStatus" ADD VALUE 'REVIEWED';
ALTER TYPE "TicketStatus" ADD VALUE 'PUBLISHED';
