import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  AUTO_CLOSE_DAYS,
  DATA_TASK_DUE_DAYS,
  autoCloseTicket,
  createDataTask,
  markMissingTasks,
  monthlySummary,
} from "@/lib/data-collection";

/**
 * 数据回收定时任务入口（幂等，重复调用安全）：
 * 1. 扫描已发布满 7 天、未建回收任务的工单 → 创建数据回收任务
 * 2. 扫描截止前仍未回收的任务 → 标记 MISSING（数据待补）
 * 3. 每月 1 日生成上月发布内容的数据汇总（yearMonth 唯一，重复调用跳过）
 * 4. 扫描发布满 30 天的工单 → 自动结束合作流程（状态 → SETTLED，释放达人占用）
 *
 * 触发方式（生产环境）：Vercel Cron / 阿里云定时任务 / cron curl，每天执行一次。
 * 可选鉴权：设置环境变量 CRON_SECRET 后，需带请求头
 *   Authorization: Bearer <CRON_SECRET>
 * 未设置 CRON_SECRET 时不校验（内网调用场景）。
 */
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "无权限" }, { status: 401 });
    }
  }

  const now = new Date();
  const result: Record<string, unknown> = { runAt: now.toISOString() };

  try {
    // 1. 已发布满 7 天 → 创建数据回收任务
    const taskCutoff = addDays(now, -DATA_TASK_DUE_DAYS);
    const publishCandidates = await prisma.cooperationTicket.findMany({
      where: {
        publishDate: { lte: taskCutoff },
        status: { notIn: ["DRAFT", "PENDING_APPROVAL", "PENDING_PROCUREMENT", "SETTLED", "VOIDED", "REJECTED"] },
      },
      select: { id: true },
    });
    let tasksCreated = 0;
    for (const t of publishCandidates) {
      const r = await createDataTask(t.id);
      tasksCreated += r.created;
    }
    result.tasksCreated = tasksCreated;

    // 2. 截止前未回收完成 → 标记 MISSING（数据待补，不删除）
    result.missingMarked = await markMissingTasks(now);

    // 3. 每月 1 日 → 生成上月汇总（幂等：yearMonth 唯一）
    if (now.getDate() === 1) {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const yearMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
      const r = await monthlySummary(yearMonth);
      result.monthlySummary = { yearMonth, created: r.created };
    }

    // 4. 发布满 30 天 → 自动结束合作流程
    const closeCutoff = addDays(now, -AUTO_CLOSE_DAYS);
    const closeCandidates = await prisma.cooperationTicket.findMany({
      where: {
        publishDate: { lte: closeCutoff },
        status: { notIn: ["SETTLED", "VOIDED", "REJECTED"] },
      },
      select: { id: true },
    });
    let ticketsClosed = 0;
    for (const t of closeCandidates) {
      const r = await autoCloseTicket(t.id, now);
      if (r.closed) ticketsClosed++;
    }
    result.ticketsClosed = ticketsClosed;

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("数据回收定时任务失败:", e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "未知错误", ...result },
      { status: 500 }
    );
  }
}
