-- 达人主页链接：保留 homepageId 兼容历史数据
ALTER TABLE "Influencer" ADD COLUMN IF NOT EXISTS "xhsUrl" TEXT;
ALTER TABLE "Influencer" ADD COLUMN IF NOT EXISTS "douyinUrl" TEXT;

-- 新增维护工单类型
ALTER TYPE "TicketKind" ADD VALUE IF NOT EXISTS 'MAINTENANCE';
