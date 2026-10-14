export function normalizeProfileUrl(url: string): string {
  const trimmed = String(url ?? "").trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = parsed.pathname.replace(/\/+$/, "");
    return `${hostname}${pathname}`;
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/[?#].*$/, "")
      .replace(/\/+$/, "");
  }
}
