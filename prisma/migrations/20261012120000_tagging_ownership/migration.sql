-- 标签归属：Tagging 表（记录谁给哪个实体打了什么标签）
CREATE TYPE "TaggingEntityType" AS ENUM ('INFLUENCER', 'COOP_REQUEST', 'MATERIAL');

CREATE TABLE "Tagging" (
  "id" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "entityType" "TaggingEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Tagging_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Tagging_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Tagging_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Tagging_tagId_entityType_entityId_createdById_key" ON "Tagging"("tagId", "entityType", "entityId", "createdById");
CREATE INDEX "Tagging_entityType_entityId_idx" ON "Tagging"("entityType", "entityId");
CREATE INDEX "Tagging_tagId_idx" ON "Tagging"("tagId");
CREATE INDEX "Tagging_createdById_idx" ON "Tagging"("createdById");
