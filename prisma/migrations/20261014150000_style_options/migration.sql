ALTER TYPE "DocType" ADD VALUE 'STYLE';

CREATE TABLE "StyleOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StyleOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StyleOption_name_key" ON "StyleOption"("name");
CREATE INDEX "StyleOption_isActive_sort_idx" ON "StyleOption"("isActive", "sort");

INSERT INTO "StyleOption" ("id", "name", "sort", "updatedAt") VALUES
  ('style_daily', '日常款', 1, CURRENT_TIMESTAMP),
  ('style_main', '主推款', 2, CURRENT_TIMESTAMP),
  ('style_clearance', '清仓款', 3, CURRENT_TIMESTAMP),
  ('style_new', '新品款', 4, CURRENT_TIMESTAMP);

-- 历史工单按旧固定编码存款式，统一换成配置中的名称
UPDATE "CooperationTicket"
SET "style" = array_replace(array_replace(array_replace(array_replace("style",
  'DAILY', '日常款'), 'MAIN', '主推款'), 'CLEARANCE', '清仓款'), 'NEW', '新品款')
WHERE "style" && ARRAY['DAILY', 'MAIN', 'CLEARANCE', 'NEW'];

UPDATE "MaterialRecord"
SET "style" = array_replace(array_replace(array_replace(array_replace("style",
  'DAILY', '日常款'), 'MAIN', '主推款'), 'CLEARANCE', '清仓款'), 'NEW', '新品款')
WHERE "style" && ARRAY['DAILY', 'MAIN', 'CLEARANCE', 'NEW'];
