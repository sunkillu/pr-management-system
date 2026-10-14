// 寄品明细行结构（存于 CooperationTicket.shipItems / SampleShipment.items JSON，不改 schema）
// 款式：下拉，选项 = lib/labels 的 STYLE_OPTIONS（旧自由文本仍兼容展示）
// 度数：下拉预设 + "其他"自定义；抛期/盒数：input + datalist 可搜索下拉
export type ShipItem = {
  style: string;
  degree: string;
  shelfLife: string;
  boxCount: string;
  note: string;
};

export const DEGREE_OPTIONS = [
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "1000",
  "1200",
] as const;

export const SHELF_LIFE_OPTIONS = ["3个月", "6个月", "9个月", "12个月", "18个月", "24个月"] as const;

export const BOX_COUNT_OPTIONS = ["1", "2", "3", "5", "10", "20", "50", "100"] as const;

export function emptyShipItem(): ShipItem {
  return { style: "", degree: "", shelfLife: "", boxCount: "", note: "" };
}

/** 旧数据兼容：把任意 JSON 行规范化为 ShipItem（缺失字段补空串） */
export function normalizeShipItem(s: unknown): ShipItem {
  const o = (s ?? {}) as Record<string, unknown>;
  return {
    style: String(o.style ?? "").trim(),
    degree: String(o.degree ?? "").trim(),
    shelfLife: String(o.shelfLife ?? "").trim(),
    boxCount: String(o.boxCount ?? "").trim(),
    note: String(o.note ?? "").trim(),
  };
}

/** 一行寄品明细的人类可读摘要，用于寄件确认弹窗 / 寄品列表展示 */
export function shipItemSummary(s: ShipItem): string {
  const parts = [s.style];
  if (s.degree) parts.push(`${s.degree}度`);
  if (s.shelfLife) parts.push(`抛期${s.shelfLife}`);
  if (s.boxCount) parts.push(`${s.boxCount}盒`);
  if (s.note) parts.push(`（${s.note}）`);
  return parts.filter(Boolean).join(" · ");
}
