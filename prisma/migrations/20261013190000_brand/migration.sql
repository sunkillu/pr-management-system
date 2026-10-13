-- 品牌维度：Brand 表 + Influencer.brands + CooperationTicket.brandId（必填）
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

ALTER TABLE "Influencer" ADD COLUMN "brands" TEXT[] NOT NULL DEFAULT '{}';

-- brandId 必填：先加可空列，预置品牌并回填历史数据后设为 NOT NULL
ALTER TABLE "CooperationTicket" ADD COLUMN "brandId" TEXT;

-- 预置品牌
INSERT INTO "Brand" ("id", "name", "isActive") VALUES
  ('brand_jianguoli', '坚果力', true),
  ('brand_bompop', 'BOM POP', true)
ON CONFLICT ("id") DO NOTHING;

-- 历史工单回填默认品牌（坚果力）
UPDATE "CooperationTicket" SET "brandId" = 'brand_jianguoli' WHERE "brandId" IS NULL;

ALTER TABLE "CooperationTicket" ALTER COLUMN "brandId" SET NOT NULL;
ALTER TABLE "CooperationTicket" ADD CONSTRAINT "CooperationTicket_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 寄件品牌：从关联工单自动带入（可空，允许手动改）
ALTER TABLE "SampleShipment" ADD COLUMN "brandId" TEXT;
UPDATE "SampleShipment" s SET "brandId" = t."brandId"
FROM "CooperationTicket" t WHERE s."ticketId" = t."id" AND s."brandId" IS NULL;
ALTER TABLE "SampleShipment" ADD CONSTRAINT "SampleShipment_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 品牌透传：打款单 / 素材 / 数据回收任务自动从工单带入 brandId
ALTER TABLE "PaymentRequest" ADD COLUMN "brandId" TEXT;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaterialRecord" ADD COLUMN "brandId" TEXT;
ALTER TABLE "MaterialRecord" ADD CONSTRAINT "MaterialRecord_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DataCollectionTask" ADD COLUMN "brandId" TEXT;
ALTER TABLE "DataCollectionTask" ADD CONSTRAINT "DataCollectionTask_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 品牌变更审计表
CREATE TABLE "BrandChangeLog" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "oldBrandId" TEXT,
    "newBrandId" TEXT,
    "changedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandChangeLog_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "BrandChangeLog" ADD CONSTRAINT "BrandChangeLog_oldBrandId_fkey" FOREIGN KEY ("oldBrandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BrandChangeLog" ADD CONSTRAINT "BrandChangeLog_newBrandId_fkey" FOREIGN KEY ("newBrandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BrandChangeLog" ADD CONSTRAINT "BrandChangeLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "BrandChangeLog_target_idx" ON "BrandChangeLog"("targetType", "targetId", "createdAt");
