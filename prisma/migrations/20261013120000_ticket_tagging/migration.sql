-- 工单支持打标签：TaggingEntityType 加 TICKET
-- 注意：PG 枚举 ADD VALUE 不能与其它 DDL 在同一事务块混用，单独一条语句
ALTER TYPE "TaggingEntityType" ADD VALUE 'TICKET';
