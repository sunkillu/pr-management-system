-- 寄件请求：信息确认标记（提交人维护完收件信息后推送仓库）
ALTER TABLE "SampleShipment" ADD COLUMN "infoConfirmed" BOOLEAN NOT NULL DEFAULT false;
