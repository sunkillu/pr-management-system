import { NextRequest, NextResponse } from "next/server";
import { sendDueReminders } from "@/lib/reminders";

/**
 * 定时任务入口：扫描到期的 PENDING 提醒并发送，发送后标记 SENT。
 *
 * 触发方式（生产环境）：Vercel Cron / 阿里云定时任务 / cron curl。
 * 可选鉴权：设置环境变量 CRON_SECRET 后，需带请求头
 *   Authorization: Bearer <CRON_SECRET>
 * 未设置 CRON_SECRET 时不校验（内网调用场景）。
 */
export async function POST(req: NextRequest) {
  return run(req);
}

export async function GET(req: NextRequest) {
  return run(req);
}

async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }
  }
  try {
    const { sent, cancelled } = await sendDueReminders();
    return NextResponse.json({ ok: true, sent, cancelled, at: new Date().toISOString() });
  } catch (e) {
    console.error("cron/reminders 执行失败:", e);
    return NextResponse.json({ error: "执行失败" }, { status: 500 });
  }
}
