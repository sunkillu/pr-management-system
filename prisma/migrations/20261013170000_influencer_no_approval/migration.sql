-- 达人登记去掉审批：默认状态改为已通过（APPROVED）
-- 枚举值 PENDING/REJECTED 保留，历史数据不受影响
ALTER TABLE "Influencer" ALTER COLUMN "status" SET DEFAULT 'APPROVED';
