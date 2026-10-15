-- 补发布前3天提醒类型 PUBLISH_3D（此前只有 7 天 / 1 天 / 逾期 7 天）
ALTER TYPE "ReminderType" ADD VALUE IF NOT EXISTS 'PUBLISH_3D';
