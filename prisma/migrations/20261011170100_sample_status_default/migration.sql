-- 寄件状态默认值 PENDING：枚举新值必须在独立事务中提交后才能使用，故从 20261011170000_sample_request_flow 拆出
ALTER TABLE "SampleShipment" ALTER COLUMN "status" SET DEFAULT 'PENDING';
