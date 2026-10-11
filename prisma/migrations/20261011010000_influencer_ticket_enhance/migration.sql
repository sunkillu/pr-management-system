-- 达人登记：附件 + 标签；工单：款式/合作类目改多选必填、新增预估档期

-- Influencer 新增附件、标签
ALTER TABLE "Influencer" ADD COLUMN "attachments" JSONB;
ALTER TABLE "Influencer" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT '{}';

-- CooperationTicket.style: TEXT → TEXT[]（存量单值转为单元素数组）
ALTER TABLE "CooperationTicket" ALTER COLUMN "style" TYPE TEXT[]
  USING CASE WHEN "style" IS NULL OR "style" = '' THEN '{}' ELSE ARRAY["style"] END;
ALTER TABLE "CooperationTicket" ALTER COLUMN "style" SET DEFAULT '{}';
ALTER TABLE "CooperationTicket" ALTER COLUMN "style" SET NOT NULL;

-- CooperationTicket.coopCategory: TEXT → TEXT[]
ALTER TABLE "CooperationTicket" ALTER COLUMN "coopCategory" TYPE TEXT[]
  USING CASE WHEN "coopCategory" IS NULL OR "coopCategory" = '' THEN '{}' ELSE ARRAY["coopCategory"] END;
ALTER TABLE "CooperationTicket" ALTER COLUMN "coopCategory" SET DEFAULT '{}';
ALTER TABLE "CooperationTicket" ALTER COLUMN "coopCategory" SET NOT NULL;

-- CooperationTicket 新增预估档期（必填，存量回填"待补充"）
ALTER TABLE "CooperationTicket" ADD COLUMN "estimatedSchedule" TEXT;
UPDATE "CooperationTicket" SET "estimatedSchedule" = '待补充' WHERE "estimatedSchedule" IS NULL;
ALTER TABLE "CooperationTicket" ALTER COLUMN "estimatedSchedule" SET NOT NULL;
