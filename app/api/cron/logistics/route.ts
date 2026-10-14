import { NextRequest, NextResponse } from "next/server";
import { runLogisticsChecks } from "@/lib/logistics";

export const dynamic = "force-dynamic";

/**
 * 寄品物流定时任务入口：
 * 1. 发货后 T+1 检测物流状态（无接口时标记待手动确认）
 * 2. 寄品停留非终态超 7 天预警
 * 3. 签收后提醒补确定档期
 *
 * 建议部署后在外部调度器（cron / Vercel Cron / 阿里云函数计算定时触发器等）
 * 按天调用 GET /api/cron/logistics。
 *
 * 安全门：若配置了 CRON_SECRET 环境变量，请求须携带 ?secret= 或
 * Authorization: Bearer 头匹配；未配置时直接放行（内网部署场景）。
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const { searchParams } = new URL(req.url);
    const provided =
      searchParams.get("secret") ??
      req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (provided !== secret) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }
  }
  const result = await runLogisticsChecks();
  return NextResponse.json({ ok: true, ...result, ranAt: new Date().toISOString() });
}
