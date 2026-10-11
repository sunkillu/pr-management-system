-- 合作需求审批通过自动入库：关联生成的达人；工单关联来源需求
ALTER TABLE "CooperationRequest" ADD COLUMN "influencerId" TEXT;
ALTER TABLE "CooperationTicket" ADD COLUMN "coopRequestId" TEXT;
