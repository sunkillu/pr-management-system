-- 子内容增加平台/款式/花费字段（平台数据汇总 + 汇总单）
ALTER TABLE "Content" ADD COLUMN "platform" TEXT;
ALTER TABLE "Content" ADD COLUMN "style" TEXT;
ALTER TABLE "Content" ADD COLUMN "cost" DECIMAL(12,2);
