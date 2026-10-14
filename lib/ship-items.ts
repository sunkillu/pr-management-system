export type ShipItem = {
  style: string;
  period: string;
  degree: string;
  boxes: number;
  note: string;
};

function toTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}

export function sanitizeShipItems(raw: unknown): { items: ShipItem[]; error?: string } {
  if (raw == null) return { items: [] };
  if (!Array.isArray(raw)) return { items: [], error: "寄品明细格式非法" };
  if (raw.length > 50) return { items: [], error: "寄品明细最多填写 50 行" };

  const items: ShipItem[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const item = raw[index];
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const style = toTrimmedString(row.style);
    const period = toTrimmedString(row.period);
    const degree = toTrimmedString(row.degree);
    const note = toTrimmedString(row.note);
    const boxesRaw = row.boxes;
    const boxes = typeof boxesRaw === "number" ? boxesRaw : Number(boxesRaw);

    const hasAnyValue = Boolean(style || period || degree || note || boxesRaw !== undefined && boxesRaw !== null && String(boxesRaw).trim() !== "");
    if (!hasAnyValue) continue;

    if (!style || style.length > 50) return { items: [], error: `第 ${index + 1} 行寄品款式不能为空且不能超过 50 个字` };
    if (!period || period.length > 50) return { items: [], error: `第 ${index + 1} 行抛期不能为空且不能超过 50 个字` };
    if (!degree || degree.length > 50) return { items: [], error: `第 ${index + 1} 行度数不能为空且不能超过 50 个字` };
    if (!Number.isInteger(boxes) || boxes < 1 || boxes > 99) return { items: [], error: `第 ${index + 1} 行盒数必须为 1-99 的整数` };
    if (note.length > 200) return { items: [], error: `第 ${index + 1} 行备注不能超过 200 个字` };

    items.push({ style, period, degree, boxes, note });
  }

  return { items };
}

export function formatShipItem(item: Partial<ShipItem> | null | undefined): string {
  if (!item || typeof item !== "object") return "-";
  const parts = [item.style, item.period, item.degree, Number.isFinite(item.boxes) ? `${Number(item.boxes)}盒` : undefined]
    .map((part) => (typeof part === "string" ? part.trim() : part))
    .filter((part): part is string => Boolean(part));
  return parts.join(" · ") || "-";
}

export function totalBoxes(items: Array<Partial<ShipItem> | null | undefined>): number {
  return items.reduce((sum, item) => {
    const boxes = Number(item?.boxes);
    return sum + (Number.isInteger(boxes) && boxes > 0 ? boxes : 1);
  }, 0);
}
