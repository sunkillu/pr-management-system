-- 对齐 schema.prisma：补上之前漏掉的 migration
-- （relations 在 schema 里声明了 onDelete: SetNull，但对应外键从未建表；
-- 另有已删的索引/default 残留在库定义中）
-- 由 `prisma migrate diff --from-migrations --to-schema-datamodel` 生成并核对

-- DropIndex
DROP INDEX "Content_ticketId_idx";

-- AlterTable
ALTER TABLE "CooperationTicket" ALTER COLUMN "style" DROP DEFAULT,
ALTER COLUMN "coopCategory" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Influencer" ALTER COLUMN "tags" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "CooperationRequest" ADD CONSTRAINT "CooperationRequest_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CooperationTicket" ADD CONSTRAINT "CooperationTicket_coopRequestId_fkey" FOREIGN KEY ("coopRequestId") REFERENCES "CooperationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
