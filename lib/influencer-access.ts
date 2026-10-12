// 达人库数据权限：PR 只能看自己登记的；ADMIN / FINANCE / PR_MANAGER 可看全部
export function influencerOwnerFilter(role: string, userId: string): Record<string, unknown> {
  if (role === "PR") return { registeredById: userId };
  return {};
}
