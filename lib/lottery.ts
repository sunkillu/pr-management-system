export type PrizeItem = { name: string; quantity: number };

export function parsePrizeItems(v: unknown): PrizeItem[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const out: PrizeItem[] = [];
  for (const it of v) {
    const name = String((it as { name?: unknown })?.name ?? "").trim();
    const quantity = Number((it as { quantity?: unknown })?.quantity);
    if (!name || !Number.isInteger(quantity) || quantity < 1) return null;
    out.push({ name, quantity });
  }
  return out;
}

export const LOTTERY_STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  ACTIVE: "进行中",
  ENDED: "已结束",
};
