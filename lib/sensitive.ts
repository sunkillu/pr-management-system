// 达人信息权限分级
// A级（保密信息）：phone 手机号 / wechat 微信号 / email 邮箱 / quoteAmount 合作报价
//   - 仅 ADMIN 和「对应 PR」可见：对应 PR = 登记人（Influencer.registeredById）
//     或 关联工单的 assignee（CooperationTicket.assigneeId）
//   - 每次查看写入 SensitiveAccessLog（只记字段名，绝不记字段值）
// B级（业务信息）：历史寄品、合作模式、发布链接、归属PR、合作款式和时间
//   - 沿用现有业务权限（PR 仅看自己登记，见 lib/influencer-access.ts），不做额外字段过滤

/** A级敏感字段（全系统统一口径） */
export const LEVEL_A_FIELDS = ["phone", "wechat", "email", "quoteAmount"] as const;
export type LevelAField = (typeof LEVEL_A_FIELDS)[number];

/** Influencer 模型上的 A级字段（quoteAmount 归属 CooperationTicket） */
export const INFLUENCER_LEVEL_A_FIELDS = ["phone", "wechat", "email"] as const;

/** B级字段（文档口径，权限由现有业务逻辑控制） */
export const LEVEL_B_FIELDS = [
  "sampleHistory", // 历史寄品
  "coopMode", // 合作模式
  "publishLink", // 发布链接
  "assigneePR", // 归属PR
  "coopStyleAndDate", // 合作款式和时间
] as const;

export type SensitiveViewer = { role: string; id: string };

/** canViewSensitive 需要的达人侧最小信息；assigneeIds 由调用方按需查工单填入 */
export type InfluencerSensitiveRef = {
  registeredById?: string | null;
  assigneeIds?: string[];
};

/**
 * 是否可以查看 A级敏感字段。
 * @param viewerRole 查看者角色
 * @param viewerId 查看者 id
 * @param influencer 达人对象（至少含 registeredById；工单 assignee 场景传 assigneeIds）
 */
export function canViewSensitive(
  viewerRole: string,
  viewerId: string,
  influencer: InfluencerSensitiveRef
): boolean {
  if (!viewerId) return false;
  if (viewerRole === "ADMIN") return true;
  if (influencer.registeredById && influencer.registeredById === viewerId) return true;
  if (influencer.assigneeIds && influencer.assigneeIds.includes(viewerId)) return true;
  return false;
}

/**
 * 按 viewer 权限过滤达人对象上的 A级字段（phone/wechat/email）。
 * 有权限返回原对象；无权限返回 A级字段置 null 的浅拷贝。
 */
export function filterInfluencer<T extends Record<string, unknown> & InfluencerSensitiveRef>(
  influencer: T,
  viewer: SensitiveViewer
): T {
  if (canViewSensitive(viewer.role, viewer.id, influencer)) return influencer;
  const copy = { ...influencer };
  for (const f of INFLUENCER_LEVEL_A_FIELDS) {
    if (f in copy) (copy as Record<string, unknown>)[f] = null;
  }
  return copy as T;
}
