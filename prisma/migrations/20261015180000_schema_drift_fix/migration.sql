-- 对齐 migrate diff 的 2 处装饰性漂移（无行为变化）
-- 1. BrandChangeLog 索引名：迁移建的是 BrandChangeLog_target_idx，schema 约定名是 BrandChangeLog_targetType_targetId_createdAt_idx
ALTER INDEX "BrandChangeLog_target_idx" RENAME TO "BrandChangeLog_targetType_targetId_createdAt_idx";
-- 2. Influencer.brands 默认值：库里已有 DEFAULT '{}'，schema 补 @default([]) 对齐（无 SQL 变更）
