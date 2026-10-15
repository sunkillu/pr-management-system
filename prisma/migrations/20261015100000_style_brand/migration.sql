-- 款式按品牌隔离；历史款式归入现有默认品牌，历史工单中的款式文本不变
ALTER TABLE "StyleOption" ADD COLUMN "brandId" TEXT;

UPDATE "StyleOption"
SET "brandId" = 'brand_jianguoli'
WHERE "brandId" IS NULL;

ALTER TABLE "StyleOption"
  ADD CONSTRAINT "StyleOption_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "StyleOption_kind_name_key";
DROP INDEX IF EXISTS "StyleOption_kind_isActive_sort_idx";
CREATE UNIQUE INDEX "StyleOption_kind_brandId_name_key" ON "StyleOption"("kind", "brandId", "name");
CREATE INDEX "StyleOption_brandId_kind_isActive_sort_idx" ON "StyleOption"("brandId", "kind", "isActive", "sort");
CREATE INDEX "StyleOption_kind_isActive_sort_idx" ON "StyleOption"("kind", "isActive", "sort");
