import type { CoopType, Prisma, PrismaClient } from "@prisma/client";

// 工单进度节点模板：按合作类型自动生成
// daysAfter：相对工单档期开始日期（无档期则相对建单日）的偏移天数
export const TICKET_NODE_TEMPLATES: Record<CoopType, { name: string; daysAfter: number }[]> = {
  INFLUENCER_POST: [
    { name: "寄品", daysAfter: 0 },
    { name: "脚本设计", daysAfter: 3 },
    { name: "执行（拍摄/直播）", daysAfter: 7 },
    { name: "内容发布", daysAfter: 14 },
    { name: "数据回收", daysAfter: 21 },
  ],
  INFLUENCER_LIVE: [
    { name: "寄品", daysAfter: 0 },
    { name: "脚本设计", daysAfter: 3 },
    { name: "执行（拍摄/直播）", daysAfter: 7 },
    { name: "内容发布", daysAfter: 14 },
    { name: "数据回收", daysAfter: 21 },
  ],
  MAKEUP: [
    { name: "档期确认", daysAfter: 0 },
    { name: "到场执行", daysAfter: 7 },
    { name: "结算", daysAfter: 14 },
  ],
};

export function buildNodesForTicket(
  type: CoopType,
  baseDate: Date,
  options: { scriptRequired?: boolean } = {},
): { name: string; sort: number; expectedAt: Date }[] {
  const tpl = (TICKET_NODE_TEMPLATES[type] ?? []).filter(
    (t) => t.name !== "脚本设计" || options.scriptRequired !== false,
  );
  return tpl.map((t, i) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + t.daysAfter);
    return { name: t.name, sort: i, expectedAt: d };
  });
}

// 新建节点默认按模板顺序串联，避免用户绕过寄品/脚本/执行直接完成发布或数据回收。
// 仍保留详情页手动调整前置节点的能力，特殊项目可由负责人改成其他依赖。
export async function wireTicketNodeDependencies(
  db: Prisma.TransactionClient | PrismaClient,
  ticketId: string,
) {
  const nodes = await db.ticketNode.findMany({
    where: { ticketId },
    orderBy: { sort: "asc" },
    select: { id: true },
  });
  for (let i = 1; i < nodes.length; i += 1) {
    await db.ticketNode.update({
      where: { id: nodes[i].id },
      data: { dependsOnId: nodes[i - 1].id, unlockedNotifiedAt: null },
    });
  }
}
