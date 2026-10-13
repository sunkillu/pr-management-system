-- 达人去重机制：去重状态 + 提交记录表
CREATE TYPE "DupStatus" AS ENUM ('NORMAL', 'PENDING_DEDUP', 'MERGED', 'KEPT', 'REJECTED_DUP');
CREATE TYPE "DupResult" AS ENUM ('PENDING', 'MERGED', 'KEPT', 'REJECTED');

-- LogAction 新增去重相关值（独立语句，PG 枚举限制）
ALTER TYPE "LogAction" ADD VALUE 'DUP_DETECTED';
ALTER TYPE "LogAction" ADD VALUE 'DUP_MERGED';
ALTER TYPE "LogAction" ADD VALUE 'DUP_KEPT';
ALTER TYPE "LogAction" ADD VALUE 'DUP_REJECTED';

ALTER TABLE "Influencer" ADD COLUMN "dupStatus" "DupStatus" NOT NULL DEFAULT 'NORMAL';

CREATE TABLE "InfluencerSubmitLog" (
    "id" TEXT NOT NULL,
    "newInfluencerId" TEXT NOT NULL,
    "existingInfluencerId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "newData" JSONB NOT NULL,
    "result" "DupResult" NOT NULL DEFAULT 'PENDING',
    "handledById" TEXT,
    "handledAt" TIMESTAMP(3),
    "reason" TEXT,

    CONSTRAINT "InfluencerSubmitLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InfluencerSubmitLog" ADD CONSTRAINT "InfluencerSubmitLog_newInfluencerId_fkey" FOREIGN KEY ("newInfluencerId") REFERENCES "Influencer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InfluencerSubmitLog" ADD CONSTRAINT "InfluencerSubmitLog_existingInfluencerId_fkey" FOREIGN KEY ("existingInfluencerId") REFERENCES "Influencer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InfluencerSubmitLog" ADD CONSTRAINT "InfluencerSubmitLog_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InfluencerSubmitLog" ADD CONSTRAINT "InfluencerSubmitLog_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "InfluencerSubmitLog_result_idx" ON "InfluencerSubmitLog"("result");
CREATE INDEX "InfluencerSubmitLog_newInfluencerId_idx" ON "InfluencerSubmitLog"("newInfluencerId");
CREATE INDEX "Influencer_dupStatus_idx" ON "Influencer"("dupStatus");
