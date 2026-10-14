import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * v2 达人资源占用规则
 *
 * 不占用：DRAFT 草稿、PENDING_APPROVAL 提报中、PENDING_PROCUREMENT 待确认报价/档期
 * 开始占用：quoteAmount 已填 且 confirmedDate 已填
 * 占用中：工单 occupiesResource=true，且 Influencer.occupiedByTicketId 指向该工单
 * 已发布未满30天：publishDate（或 Influencer.lastPublishDate）在30天内仍视为占用
 * 释放：发布超30天 / SETTLED / VOIDED / CANCELLED
 *
 * 并发安全：占用校验通过 Influencer.occupiedByTicketId 的原子 updateMany（check-and-set）
 * 实现，两个并发请求只有一个能成功，失败方抛 OccupancyConflictError。
 *
 * 注意：quoteAmount 为 A级敏感信息 —— 本模块不向 console 输出任何报价数据。
 */

export const OCCUPANCY_WINDOW_DAYS = 30;

/** 不占用资源的状态 */
export const NON_OCCUPYING_STATUSES = ["DRAFT", "PENDING_APPROVAL", "PENDING_PROCUREMENT"] as const;

/** 释放资源的状态（CANCELLED 为预留值，当前枚举中以 VOIDED 表达取消） */
export const RELEASE_STATUSES = ["SETTLED", "VOIDED", "CANCELLED"] as const;

export interface OccupancyInfo {
  occupied: boolean;
  ticketId: string | null;
  ticketTitle: string | null;
  style: string[];
  platform: string[];
  assigneeName: string | null;
  /** 报价（Decimal 转字符串，JSON 安全；A级敏感，仅展示给授权角色） */
  quoteAmount: string | null;
  /** 确定档期 YYYY-MM-DD */
  confirmedDate: string | null;
  publishLink: string | null;
  /** 剩余占用天数：发布30天保护期内有效；占用中但未发布时为 null */
  daysRemaining: number | null;
}

/** 占用冲突错误：接口层捕获后应返回 409 */
export class OccupancyConflictError extends Error {
  readonly status = 409;
  readonly occupancy: OccupancyInfo;
  constructor(occupancy: OccupancyInfo) {
    super(
      occupancy.ticketTitle
        ? `达人资源正被工单「${occupancy.ticketTitle}」占用，无法重复占用`
        : "达人资源当前被占用（发布后30天保护期内），无法重复占用",
    );
    this.name = "OccupancyConflictError";
    this.occupancy = occupancy;
  }
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 发布保护期剩余天数：date 为 null → null；已超期 → null；否则返回剩余天数（>=0）
 */
export function remainingWindowDays(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;
  const elapsed = Math.floor((startOfDay(new Date()).getTime() - startOfDay(d).getTime()) / 86400000);
  const remaining = OCCUPANCY_WINDOW_DAYS - elapsed;
  return remaining >= 0 ? remaining : null;
}

/** 工单是否应开始占用达人资源：报价 + 确定档期齐全，且不在"不占用"状态 */
export function shouldOccupyTicket(t: {
  status: string;
  quoteAmount: unknown;
  confirmedDate: unknown;
}): boolean {
  if ((NON_OCCUPYING_STATUSES as readonly string[]).includes(t.status)) return false;
  return t.quoteAmount != null && t.confirmedDate != null;
}

/** 工单是否应释放达人资源：结算/作废/取消，或发布已超30天 */
export function shouldReleaseTicket(t: {
  status: string;
  publishDate: Date | string | null | undefined;
}): boolean {
  if ((RELEASE_STATUSES as readonly string[]).includes(t.status)) return true;
  if (t.publishDate) {
    const d = t.publishDate instanceof Date ? t.publishDate : new Date(t.publishDate);
    if (!isNaN(d.getTime())) {
      const elapsed = Math.floor((startOfDay(new Date()).getTime() - startOfDay(d).getTime()) / 86400000);
      if (elapsed > OCCUPANCY_WINDOW_DAYS) return true;
    }
  }
  return false;
}

const EMPTY_OCCUPANCY: OccupancyInfo = {
  occupied: false,
  ticketId: null,
  ticketTitle: null,
  style: [],
  platform: [],
  assigneeName: null,
  quoteAmount: null,
  confirmedDate: null,
  publishLink: null,
  daysRemaining: null,
};

/**
 * 查询达人当前占用状态。
 * 优先级：占用中工单（occupiedByTicketId）→ 发布后30天保护期（lastPublishDate）。
 */
export async function getOccupancyStatus(influencerId: string): Promise<OccupancyInfo> {
  const inf = await prisma.influencer.findUnique({
    where: { id: influencerId },
    select: { id: true, occupiedByTicketId: true, lastPublishDate: true },
  });
  if (!inf) return { ...EMPTY_OCCUPANCY };

  if (inf.occupiedByTicketId) {
    const t = await prisma.cooperationTicket.findUnique({
      where: { id: inf.occupiedByTicketId },
      select: {
        id: true,
        title: true,
        style: true,
        platform: true,
        assignee: { select: { name: true } },
        quoteAmount: true,
        confirmedDate: true,
        publishLink: true,
        publishDate: true,
      },
    });
    if (t) {
      return {
        occupied: true,
        ticketId: t.id,
        ticketTitle: t.title,
        style: t.style ?? [],
        platform: t.platform ?? [],
        assigneeName: t.assignee?.name ?? null,
        quoteAmount: t.quoteAmount ? t.quoteAmount.toString() : null,
        confirmedDate: t.confirmedDate ? toYMD(t.confirmedDate) : null,
        publishLink: t.publishLink,
        daysRemaining: remainingWindowDays(t.publishDate ?? inf.lastPublishDate),
      };
    }
    // 占用指向的工单已不存在：视为未占用（由释放逻辑兜底清理 occupiedByTicketId）
  }

  const remain = remainingWindowDays(inf.lastPublishDate);
  if (remain !== null) {
    return { ...EMPTY_OCCUPANCY, occupied: true, daysRemaining: remain };
  }
  return { ...EMPTY_OCCUPANCY };
}

/**
 * 并发安全的占用检查（check-and-set）：
 * 仅当达人未被占用，或当前占用者就是 excludeTicketId 时，原子地将
 * occupiedByTicketId 置为 excludeTicketId；否则抛 OccupancyConflictError。
 *
 * @param influencerId 达人 id
 * @param excludeTicketId 将要占用该达人的工单 id（创建流程中传入新建工单 id）
 * @param db Prisma client 或事务 client（创建流程中请传入同一事务的 tx）
 */
export async function canOccupy(
  influencerId: string,
  excludeTicketId?: string,
  db: Db = prisma,
): Promise<void> {
  const res = await db.influencer.updateMany({
    where: {
      id: influencerId,
      OR: excludeTicketId
        ? [{ occupiedByTicketId: null }, { occupiedByTicketId: excludeTicketId }]
        : [{ occupiedByTicketId: null }],
    },
    data: { occupiedByTicketId: excludeTicketId ?? null },
  });
  if (res.count === 0) {
    const exists = await db.influencer.findUnique({
      where: { id: influencerId },
      select: { id: true },
    });
    if (!exists) throw new Error("达人不存在");
    // 达人存在但被其他工单占用 → 抛 409 冲突（含当前占用信息；报价不输出到日志）
    throw new OccupancyConflictError(await getOccupancyStatus(influencerId));
  }
}

/**
 * 释放达人占用（原子）：仅当当前占用者为 ticketId（或不传 ticketId 时无条件）才清空。
 */
export async function releaseOccupancy(
  influencerId: string,
  ticketId?: string,
  db: Db = prisma,
): Promise<void> {
  await db.influencer.updateMany({
    where: ticketId ? { id: influencerId, occupiedByTicketId: ticketId } : { id: influencerId },
    data: { occupiedByTicketId: null },
  });
}
