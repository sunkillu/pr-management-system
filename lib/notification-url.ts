/**
 * 站内通知跳转：relatedType/relatedId → 详情页 URL。
 * 铃铛（NotificationBell）与 toast（NotificationToast）共用，保持一致。
 */
export type RelatedRef = {
  relatedType: string | null;
  relatedId: string | null;
};

const BASE_MAP: Record<string, string> = {
  TICKET: "/tickets",
  INFLUENCER: "/influencers",
  COOP_REQUEST: "/coop-requests",
  PAYMENT: "/payments",
  CONTENT: "/contents",
};

export function relatedUrl(n: RelatedRef): string | null {
  if (!n.relatedType || !n.relatedId) return null;
  const base = BASE_MAP[n.relatedType];
  return base ? `${base}/${n.relatedId}` : null;
}
