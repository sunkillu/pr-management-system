import type { CoopType, Prisma } from "@prisma/client";

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
  opts?: { scriptRequired?: boolean }
): { name: string; sort: number; expectedAt: Date }[] {
  const tpl = TICKET_NODE_TEMPLATES[type] ?? [];
  // 不需要脚本时去掉“脚本设计”节点
  const filtered = opts?.scriptRequired === false ? tpl.filter((t) => t.name !== "脚本设计") : tpl;
  return filtered.map((t, i) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + t.daysAfter);
    return { name: t.name, sort: i, expectedAt: d };
  });
}

// 节点依赖接线：按 sort 顺序链式依赖（每节点依赖前一节点），已接线的跳过
export async function wireTicketNodeDependencies(
  tx: Prisma.TransactionClient,
  ticketId: string
): Promise<void> {
  const nodes = await tx.ticketNode.findMany({
    where: { ticketId },
    orderBy: { sort: "asc" },
    select: { id: true, dependsOnId: true },
  });
  for (let i = 1; i < nodes.length; i++) {
    if (nodes[i].dependsOnId) continue;
    await tx.ticketNode.update({
      where: { id: nodes[i].id },
      data: { dependsOnId: nodes[i - 1].id },
    });
  }
}
