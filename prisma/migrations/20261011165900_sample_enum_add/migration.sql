-- 寄件请求状态机：先单独加枚举值（必须独立事务提交，
-- 后续 migration 才能使用这些新值做 SET DEFAULT 等操作，
-- 否则 PostgreSQL 报 55P04 unsafe use of new value）
ALTER TYPE "SampleStatus" ADD VALUE 'PENDING';
ALTER TYPE "SampleStatus" ADD VALUE 'PREPARING';
ALTER TYPE "SampleStatus" ADD VALUE 'CANCELLED';

-- DocType 新增 SAMPLE（寄件请求单）
ALTER TYPE "DocType" ADD VALUE 'SAMPLE';
