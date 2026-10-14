export function parsePositiveIntegerQuantity(value: unknown): number | null {
  const raw = typeof value === "string" ? value.trim() : String(value ?? "");
  if (!/^\d+$/.test(raw)) return null;

  const quantity = Number(raw);
  return Number.isSafeInteger(quantity) && quantity > 0 ? quantity : null;
}
