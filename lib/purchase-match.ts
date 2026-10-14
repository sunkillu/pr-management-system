export function normalizeProfileUrl(value: string | null | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const withoutFragment = raw.split("#", 1)[0].split("?", 1)[0].trim();
  if (!withoutFragment) return "";

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(withoutFragment)
    ? withoutFragment
    : `https://${withoutFragment}`;

  try {
    const url = new URL(withProtocol);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const pathname = url.pathname.replace(/\/+$/, "");
    return `${host}${pathname}`.replace(/\/+$/, "");
  } catch {
    return withoutFragment
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/[?#].*$/, "")
      .replace(/\/+$/, "")
      .trim()
      .toLowerCase();
  }
}

export type PurchaseMatchInfluencer = {
  id: string;
  name: string;
  homepageId: string | null;
  xhsUrl: string | null;
  douyinUrl: string | null;
};

export function matchInfluencerByPlatformLink(
  platform: string,
  link: string,
  influencers: PurchaseMatchInfluencer[],
): PurchaseMatchInfluencer | null {
  const normalizedLink = normalizeProfileUrl(link);
  if (!normalizedLink) return null;

  const profileKey = platform === "XIAOHONGSHU" ? "xhsUrl" : platform === "DOUYIN" ? "douyinUrl" : null;
  if (!profileKey) return null;

  for (const influencer of influencers) {
    const profileValue = normalizeProfileUrl(influencer[profileKey]);
    if (profileValue && profileValue === normalizedLink) return influencer;
  }

  for (const influencer of influencers) {
    const homepageValue = normalizeProfileUrl(influencer.homepageId);
    if (homepageValue && homepageValue === normalizedLink) return influencer;
  }

  return null;
}
