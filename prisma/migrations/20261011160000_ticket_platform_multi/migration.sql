-- 合作工单合作平台改为多选：String -> String[]
ALTER TABLE "CooperationTicket" ALTER COLUMN "platform" TYPE TEXT[]
  USING CASE WHEN "platform" IS NULL OR "platform" = '' THEN '{}' ELSE ARRAY["platform"] END;
