-- 标签管理系统：TagCategory + Tag，MaterialRecord 加 tagIds
CREATE TABLE "TagCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "sort" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "TagCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TagCategory_key_key" ON "TagCategory"("key");
CREATE INDEX "TagCategory_sort_idx" ON "TagCategory"("sort");

CREATE TABLE "Tag" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "sort" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "Tag_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Tag_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TagCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Tag_categoryId_name_key" ON "Tag"("categoryId", "name");
CREATE INDEX "Tag_categoryId_sort_idx" ON "Tag"("categoryId", "sort");

ALTER TABLE "MaterialRecord" ADD COLUMN "tagIds" TEXT[] NOT NULL DEFAULT '{}';
