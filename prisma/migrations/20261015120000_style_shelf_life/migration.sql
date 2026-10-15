-- 每个款式维护自己的可用抛期选项
ALTER TABLE "StyleOption"
  ADD COLUMN "shelfLifeOptions" TEXT[] NOT NULL DEFAULT ARRAY['日抛', '月抛', '半年抛']::TEXT[];
