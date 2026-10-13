import { prisma } from "./prisma";
import { notifyUser } from "./feishu-notify";
import { platformLabels } from "./labels";

/**
 * 数据回收流程（幂等，可重复调用）：
 * 1. 发布后 7 天自动创建数据回收任务（同 ticketId + platform 已存在则跳过）
 * 2. 每月 1 日生成上月发布内容的数据汇总（yearMonth 唯一，重复调用直接返回已有记录）
 * 3. 截止前未回收完成的数据任务不删除，标记 MISSING（数据待补）保留异常记录
 * 4. 发布 + 30 天自动结束合作流程：状态 → SETTLED，释放达人资源占用
 */

// 发布后 N 天创建回收任务 / 自动结束
export const DATA_TASK_DUE_DAYS = 7;
export const AUTO_CLOSE_DAYS = 30;

// 各平台数据指标字段（与 schema DataCollectionTask.metrics 注释保持一致）
export const METRIC_FIELDS: Record<string, string[]> = {
  XIAOHONGSHU: ["views", "likes", "comments", "favorites"],
  DOUYIN: ["exposures", "views", "likes", "comments", "favorites"],
};

export const metricFieldLabels: Record<string, string> = {
  exposures: "曝光量",
  views: "浏览量/阅读量",
  likes: "点赞数",
  comments: "评论数",
  favorites: "收藏数",
};

export function metricFieldsFor(platform: string): string[] {
  return METRIC_FIELDS[platform] ?? METRIC_FIELDS.XIAOHONGSHU;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function parseYearMonth(yearMonth: string): { start: Date; end: Date } {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(yearMonth);
  if (!m) throw new Error(`yearMonth 格式非法，应为 YYYY-MM，例如 2026-10：${yearMonth}`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
}

function platformName(p: string): string {
  return platformLabels[p] ?? p;
}

/**
 * 发布后创建数据回收任务（幂等）。
 * 对工单的每个平台逐一检查：同 ticketId + platform 已存在任务则跳过。
 * dueAt = publishDate + 7 天。未设置发布日期的工单跳过。
 */
export async function createDataTask(
  ticketId: string
): Promise<{ created: number; existed: number; dueAt: Date | null; reason?: string }> {
  const ticket = await prisma.cooperationTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, title: true, ticketNo: true, platform: true, publishDate: true, publishLink: true, creatorId: true, brandId: true },
  });
  if (!ticket) return { created: 0, existed: 0, dueAt: null, reason: "工单不存在" };
  if (!ticket.publishDate) return { created: 0, existed: 0, dueAt: null, reason: "工单尚未发布" };

  const dueAt = addDays(ticket.publishDate, DATA_TASK_DUE_DAYS);
  let created = 0;
  let existed = 0;

  for (const platform of ticket.platform) {
    const exist = await prisma.dataCollectionTask.findFirst({
      where: { ticketId, platform },
      select: { id: true },
    });
    if (exist) {
      existed++;
      continue;
    }
    await prisma.dataCollectionTask.create({
      data: {
        ticketId,
        brandId: ticket.brandId ?? null, // 品牌从工单自动透传
        platform,
        publishLink: ticket.publishLink ?? null,
        dueAt,
      },
    });
    created++;
  }

  if (created > 0) {
    await notifyUser(
      ticket.creatorId,
      `合作工单「${ticket.title}（${ticket.ticketNo}）」已创建数据回收任务（${ticket.platform
        .map(platformName)
        .join("、")}），请在 ${dueAt.toISOString().slice(0, 10)} 前回收数据。`,
      { type: "DATA_TASK", id: ticket.id, title: "数据回收任务", kind: "REMIND" }
    );
  }

  return { created, existed, dueAt };
}

/**
 * 汇总某个月（上月）发布内容的数据回收情况，按平台分组统计（幂等）。
 * yearMonth 格式 YYYY-MM，例如 "2026-10"。已存在该 yearMonth 的汇总则直接返回。
 */
export async function monthlySummary(
  yearMonth: string
): Promise<{ summary: Record<string, unknown>; created: boolean }> {
  const exist = await prisma.dataCollectionMonthly.findUnique({ where: { yearMonth } });
  if (exist) return { summary: exist.summary as Record<string, unknown>, created: false };

  const { start, end } = parseYearMonth(yearMonth);
  const tasks = await prisma.dataCollectionTask.findMany({
    where: { ticket: { publishDate: { gte: start, lt: end } } },
    include: {
      ticket: { select: { id: true, ticketNo: true, title: true, publishDate: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const platforms: Record<
    string,
    {
      platform: string;
      tasks: number;
      collected: number;
      missing: number;
      pending: number;
      totals: Record<string, number>;
    }
  > = {};
  const ticketIds = new Set<string>();

  for (const t of tasks) {
    ticketIds.add(t.ticketId);
    const p = (platforms[t.platform] ??= {
      platform: platformName(t.platform),
      tasks: 0,
      collected: 0,
      missing: 0,
      pending: 0,
      totals: {},
    });
    p.tasks++;
    if (t.status === "COLLECTED") p.collected++;
    else if (t.status === "MISSING") p.missing++;
    else p.pending++;

    const metrics = (t.metrics ?? {}) as Record<string, unknown>;
    for (const f of metricFieldsFor(t.platform)) {
      const v = metrics[f];
      if (typeof v === "number" && Number.isFinite(v)) {
        p.totals[f] = (p.totals[f] ?? 0) + v;
      }
    }
  }

  const summary = {
    yearMonth,
    range: { from: start.toISOString().slice(0, 10), to: new Date(end.getTime() - 1).toISOString().slice(0, 10) },
    generatedAt: new Date().toISOString(),
    ticketCount: ticketIds.size,
    taskCount: tasks.length,
    platforms,
  };

  await prisma.dataCollectionMonthly.create({ data: { yearMonth, summary } });
  return { summary, created: true };
}

/**
 * 截止前仍未回收完成的数据任务 → 标记 MISSING（数据待补），保留异常记录，不删除。
 */
export async function markMissingTasks(now: Date = new Date()): Promise<number> {
  const res = await prisma.dataCollectionTask.updateMany({
    where: { status: "PENDING", dueAt: { lt: now } },
    data: { status: "MISSING" },
  });
  return res.count;
}

// 不再自动结束的终态（已终结则跳过）
const TERMINAL_STATUSES = ["SETTLED", "VOIDED", "REJECTED"];

/**
 * 发布 + 30 天自动结束合作流程（幂等）：
 * 状态 → SETTLED；释放达人资源占用（influencer.occupiedByTicketId = null）。
 * 尚未发布 / 未满 30 天 / 已终态的工单跳过。
 */
export async function autoCloseTicket(
  ticketId: string,
  now: Date = new Date()
): Promise<{ closed: boolean; reason?: string }> {
  const ticket = await prisma.cooperationTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, title: true, ticketNo: true, status: true, publishDate: true, creatorId: true },
  });
  if (!ticket) return { closed: false, reason: "工单不存在" };
  if (TERMINAL_STATUSES.includes(ticket.status)) return { closed: false, reason: `工单已是终态 ${ticket.status}` };
  if (!ticket.publishDate) return { closed: false, reason: "工单尚未发布" };
  if (addDays(ticket.publishDate, AUTO_CLOSE_DAYS) > now) return { closed: false, reason: "未满 30 天" };

  await prisma.cooperationTicket.update({
    where: { id: ticketId },
    data: { status: "SETTLED" },
  });
  // 释放达人资源占用
  await prisma.influencer.updateMany({
    where: { occupiedByTicketId: ticketId },
    data: { occupiedByTicketId: null },
  });

  await notifyUser(
    ticket.creatorId,
    `合作工单「${ticket.title}（${ticket.ticketNo}）」发布已满 30 天，已自动结束合作流程（状态 → 已结算），达人资源占用已释放。`,
    { type: "TICKET", id: ticket.id, title: "合作流程自动结束", kind: "REMIND" }
  );

  return { closed: true };
}
