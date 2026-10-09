-- CreateEnum
CREATE TYPE "InfluencerType" AS ENUM ('KOL', 'KOC', 'AMATEUR', 'MAKEUP_ARTIST');

-- AlterTable
ALTER TABLE "CooperationRequest" ADD COLUMN     "influencerType" "InfluencerType",
ADD COLUMN     "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Influencer" ADD COLUMN     "influencerType" "InfluencerType";
