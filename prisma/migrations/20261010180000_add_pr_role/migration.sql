-- AlterEnum: Role 新增 PR（提单干活角色）
-- 注意：PostgreSQL 的 ALTER TYPE ... ADD VALUE 不可在事务块内执行，
-- Prisma migrate 会自动处理（PG12+ 支持在事务中执行）
ALTER TYPE "Role" ADD VALUE 'PR';
