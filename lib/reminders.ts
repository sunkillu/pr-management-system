import { prisma } from "./prisma";
import { notifyUser } from "./feishu-notify";
import { writeLog } from "./approval-log";
import type { ReminderStatus, ReminderType } from "@prisma/client";

const DAY_MS = 24 * 3600 * 1000;

/**
 * 进入以下终态的工单：提醒不再发送，发送时标记为 CANCELLED。
 * （已完成 / 已结算 / 已作废）
 */
const TERMINAL_STATUSES = ["COMPLETED", "SETTLED", "VOIDED"] as const;

/** 档期变更时要重算的档期提醒 */
const SCHEDULE_BOUND_TYPES: ReminderType[] = ["PUBLISH_7D", "PUBLISH_1D", "OVERDUE_7D"];

/** 幂等 key：ticketId + type + scheduledAt（schema 已建唯一索引） */
function idempotencyKey(ticketId: string, type: ReminderType, scheduledAt: Date): string {
  return `${ticketId}:${type}:${scheduledAt.toISOString()}`;
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate()
  ).padStart(2, "0")}`;
}

/**
 * 幂等创建提醒任务。
 * 相同 key 已存在时直接返回现有记录，不做任何修改（upsert update 为空）。
 */
export async function ensureReminder(
  ticketId: string,
  type: ReminderType,
  scheduledAt: Date,
  note?: string
) {
  const key = idempotencyKey(ticketId, type, scheduledAt);
  return prisma.reminderTask.upsert({
    where: { idempotencyKey: key },
    update: {},
    create: {
      ticketId,
      type,
      scheduledAt,
      status: "PENDING",
      idempotencyKey: key,
      note: note ?? null,
    },
  });
}

/** 自动规则写操作日志 */
async function logAutoOp(
  ticketId: string,
  action: "CREATE" | "VOID",
  actorId: string | null,
  note: string,
  actorLabel?: string
) {
  try {
    const actor = actorId ? { actorId } : { actorId: null, actorLabel: actorLabel ?? "系统定时任务" };
    await writeLog(prisma, {
      docType: "TICKET",
      docId: ticketId,
      action,
      ...actor,
      note: actorId ? note : `【系统自动】${note}`,
    });
  } catch (e) {
    console.error("提醒操作日志写入失败:", e);
  }
}

/**
 * 档期变更后重算提醒：
 * 1. 删除该工单所有未发送（PENDING）的档期提醒（旧档期作废）；
 * 2. 按新档期重新生成 PUBLISH_7D / PUBLISH_1D / OVERDUE_7D；
 * 3. 确定档期为空（取消档期）时只做删除。
 *
 * 调用方示例：修改确定档期的 API 在更新 confirmedDate 后调用本函数。
 * 幂等：多次调用不会重复创建（ensureReminder 走 idempotencyKey upsert）。
 */
export async function recalculateReminders(
  ticketId: string,
  actorId?: string
): Promise<{ deleted: number; created: number }> {
  const ticket = await prisma.cooperationTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, confirmedDate: true, creatorId: true, status: true },
  });
  if (!ticket) return { deleted: 0, created: 0 };
  const actor = actorId ?? ticket.creatorId;

  const del = await prisma.reminderTask.deleteMany({
    where: { ticketId, type: { in: SCHEDULE_BOUND_TYPES }, status: "PENDING" },
  });
  if (del.count > 0) {
    await logAutoOp(ticketId, "VOID", actor, `档期变更，作废未发送的档期提醒 ${del.count} 条`);
  }

  if (!ticket.confirmedDate) return { deleted: del.count, created: 0 };

  const confirmed = new Date(ticket.confirmedDate).getTime();
  const plans: Array<[ReminderType, Date, string]> = [
    ["PUBLISH_7D", new Date(confirmed - 7 * DAY_MS), "确定档期前7天：提醒PR催返稿"],
    ["PUBLISH_1D", new Date(confirmed - 1 * DAY_MS), "确定档期前1天：确认返稿/发布安排"],
    ["OVERDUE_7D", new Date(confirmed + 7 * DAY_MS), "确定档期后7天：逾期未发布预警"],
  ];
  let created = 0;
  for (const [type, at, note] of plans) {
    await ensureReminder(ticketId, type, at, note);
    created++;
  }
  await logAutoOp(
    ticketId,
    "CREATE",
    actor,
    `档期变更后重建档期提醒 ${created} 条（${SCHEDULE_BOUND_TYPES.join("/")}，档期 ${fmtDate(
      ticket.confirmedDate
    )}）`
  );
  return { deleted: del.count, created };
}

/**
 * 返稿未确认时每 3 天生成一个 REVIEW_3D 提醒。
 * 条件：工单处于执行中/待素材审批、尚未确认发布（publishDate 为空）。
 * 距上一个 REVIEW_3D 创建不足 3 天时不再重复创建。
 */
export async function ensureReviewReminder(ticketId: string, actorId?: string) {
  const ticket = await prisma.cooperationTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true, publishDate: true, creatorId: true, title: true },
  });
  if (!ticket || ticket.publishDate) return null;
  if (!["IN_PROGRESS", "MATERIAL_REVIEW"].includes(ticket.status)) return null;

  const last = await prisma.reminderTask.findFirst({
    where: { ticketId, type: "REVIEW_3D" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (last && Date.now() - new Date(last.createdAt).getTime() < 3 * DAY_MS) return null;

  const task = await ensureReminder(ticketId, "REVIEW_3D", new Date(), "返稿未确认，每3天滚动提醒");
  await logAutoOp(
    ticketId,
    "CREATE",
    actorId ?? ticket.creatorId,
    `返稿未确认，生成 REVIEW_3D 提醒（工单「${ticket.title}」）`
  );
  return task;
}

/** 各提醒类型的发送文案 */
function reminderText(
  type: ReminderType,
  title: string,
  confirmedDate: Date | null
): { title: string; text: string } {
  const d = fmtDate(confirmedDate);
  switch (type) {
    case "PUBLISH_7D":
      return {
        title: "发布档期临近提醒",
        text: `合作工单「${title}」的确定档期为 ${d}（7天后），请提醒达人及时返稿。`,
      };
    case "PUBLISH_1D":
      return {
        title: "发布档期提醒",
        text: `合作工单「${title}」的确定档期为明天（${d}），请确认返稿与发布安排。`,
      };
    case "OVERDUE_7D":
      return {
        title: "逾期未发布预警",
        text: `合作工单「${title}」的确定档期（${d}）已过去7天仍未发布，请跟进处理。`,
      };
    case "REVIEW_3D":
      return {
        title: "返稿确认提醒",
        text: `合作工单「${title}」返稿尚未确认发布，请及时处理。`,
      };
    case "DATA_7D":
      return {
        title: "数据回收提醒",
        text: `合作工单「${title}」发布已满7天，请及时回收投放数据。`,
      };
    case "SAMPLE_7D":
      return {
        title: "寄品超期预警",
        text: `合作工单「${title}」的寄品状态已超过7天未更新，请跟进物流。`,
      };
    case "SCHEDULE_FILL":
      return {
        title: "补填档期提醒",
        text: `合作工单「${title}」寄品已签收，请及时补填确定档期。`,
      };
  }
}

/**
 * 扫描到期的 PENDING 提醒并发送（cron 入口调用）。
 * - 工单已进入终态（COMPLETED/SETTLED/VOIDED）：标记 CANCELLED，不发送；
 * - 其余：用现有通知模块（notifyUser → NotificationLog）通知创建人+归属人，标记 SENT。
 * 发送走 NotificationLog 即为操作日志；终态取消额外记一条 ApprovalLog。
 * 返回本次发送/取消数量。单条失败不影响后续。
 */
export async function sendDueReminders(): Promise<{ sent: number; cancelled: number }> {
  let sent = 0;
  let cancelled = 0;
  const now = new Date();

  const due = await prisma.reminderTask.findMany({
    where: { status: "PENDING", scheduledAt: { lte: now } },
    include: {
      ticket: {
        select: {
          id: true,
          title: true,
          status: true,
          confirmedDate: true,
          creatorId: true,
          assigneeId: true,
        },
      },
    },
    orderBy: { scheduledAt: "asc" },
    take: 200,
  });

  for (const r of due) {
    try {
      if ((TERMINAL_STATUSES as readonly string[]).includes(r.ticket.status)) {
        const changed = await prisma.$transaction(async (tx) => {
          const result = await tx.reminderTask.updateMany({
            where: { id: r.id, status: "PENDING" },
            data: { status: "CANCELLED", sentAt: new Date(), note: "工单已完结，未发送自动取消" },
          });
          if (result.count === 0) return false;
          await writeLog(tx, {
            docType: "REMINDER_TASK",
            docId: r.id,
            action: "VOID",
            actorLabel: "系统定时任务",
            fromStatus: "PENDING",
            toStatus: "CANCELLED",
            note: "工单已完结，未发送自动取消",
          });
          return true;
        });
        if (!changed) continue;
        await logAutoOp(
          r.ticket.id,
          "VOID",
          null,
          `工单状态为${r.ticket.status}，取消未发送的 ${r.type} 提醒`
        );
        cancelled++;
        continue;
      }

      const { title, text } = reminderText(r.type, r.ticket.title, r.ticket.confirmedDate);
      const receivers = [r.ticket.creatorId, r.ticket.assigneeId].filter(
        (id, idx, arr): id is string => !!id && arr.indexOf(id) === idx
      );
      for (const uid of receivers) {
        await notifyUser(uid, text, {
          type: "TICKET",
          id: r.ticket.id,
          title,
          kind: "REMIND",
        });
      }
      const changed = await prisma.$transaction(async (tx) => {
        const result = await tx.reminderTask.updateMany({
          where: { id: r.id, status: "PENDING" },
          data: { status: "SENT", sentAt: new Date() },
        });
        if (result.count === 0) return false;
        await writeLog(tx, {
          docType: "REMINDER_TASK",
          docId: r.id,
          action: "EDIT",
          actorLabel: "系统定时任务",
          fromStatus: "PENDING",
          toStatus: "SENT",
        });
        return true;
      });
      if (changed) sent++;
    } catch (e) {
      console.error(`提醒 ${r.id} (${r.type}) 发送失败:`, e);
    }
  }

  return { sent, cancelled };
}

/** 供外部判断/复用的终态列表 */
export function isTerminalStatus(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

export type { ReminderStatus, ReminderType };
