import { NextRequest } from "next/server";
import { requireRoles } from "@/lib/api-auth";
import { toCSV, csvResponse } from "@/lib/csv";

// 导入模板下载（仅 ADMIN）
const TEMPLATES: Record<string, { filename: string; headers: string[]; sample: string[][] }> = {
  influencers: {
    filename: "达人导入模板.csv",
    headers: ["姓名", "类型", "平台", "主页ID", "报价", "标签", "备注"],
    sample: [
      ["达人甲", "KOL", "小红书", "xiaohongshu123", "5000", "美妆、种草", "合作过两次"],
      ["达人乙", "KOC", "小红书、抖音", "douyin456", "2000", "穿搭", ""],
    ],
  },
  records: {
    filename: "历史合作记录导入模板.csv",
    headers: ["达人名", "平台", "款式", "费用", "日期", "备注"],
    sample: [
      ["达人甲", "小红书", "春季新品", "5000", "2026-09-15", "首单合作"],
      ["达人乙", "抖音", "清仓款", "2000", "2026-09-20", ""],
    ],
  },
};

export async function GET(req: NextRequest) {
  const auth = await requireRoles(["ADMIN"]);
  if (!auth.ok) return auth.res;
  const kind = new URL(req.url).searchParams.get("kind") ?? "";
  const tpl = TEMPLATES[kind];
  if (!tpl) {
    return new Response(JSON.stringify({ error: "kind 仅支持 influencers / records" }), {
      status: 400,
    });
  }
  return csvResponse(tpl.filename, toCSV(tpl.headers, tpl.sample));
}
