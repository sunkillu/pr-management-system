-- 寄品业务状态收敛为：待寄出（PENDING）、待签收（SHIPPED）、已签收（SIGNED）。
-- 旧的“备货中”只作为历史枚举兼容值，现有记录归并到待寄出。
UPDATE "SampleShipment"
SET status = 'PENDING'
WHERE status = 'PREPARING';
