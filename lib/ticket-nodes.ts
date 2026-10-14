import type { CoopType } from "@prisma/client";

// 工单进度节点模板：按合作类型自动生成
// daysAfter：相对工单档期开始日期（无档期则相对建单日）的偏移天数
export const TICKET_NODE_TEMPLATES: Record<CoopType, { name: string; daysAfter: number }[]> = {
  INFLUENCER_POST: [
    { name: "寄品", daysAfter: 0 },
    { name: "脚本设计", daysAfter: 3 },
    { name: "执行（拍摄/直播）", daysAfter: 7 },
    { name: "返稿", daysAfter: 12 },
    { name: "内容发布", daysAfter: 14 },
    { name: "数据回收", daysAfter: 21 },
  ],
  INFLUENCER_LIVE: [
    { name: "寄品", daysAfter: 0 },
    { name: "脚本设计", daysAfter: 3 },
    { name: "执行（拍摄/直播）", daysAfter: 7 },
    { name: "返稿", daysAfter: 12 },
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
  baseDate: Date
): { name: string; sort: number; expectedAt: Date }[] {
  const tpl = TICKET_NODE_TEMPLATES[type] ?? [];
  return tpl.map((t, i) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + t.daysAfter);
    return { name: t.name, sort: i, expectedAt: d };
  });
}
