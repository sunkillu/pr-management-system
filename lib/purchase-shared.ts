import { Prisma } from "@prisma/client";

export const PURCHASE_CREATE_ROLES = ["ADMIN", "OPERATOR", "PR_MANAGER"] as const;
export const PURCHASE_VIEW_ROLES = ["ADMIN", "OPERATOR", "PR_MANAGER"] as const;
export const PURCHASE_REVIEW_ROLES = ["ADMIN", "PR_MANAGER"] as const;

export const PURCHASE_PLATFORM_OPTIONS = [
  { value: "XIAOHONGSHU", label: "小红书" },
  { value: "DOUYIN", label: "抖音" },
] as const;

export const PURCHASE_PLATFORM_LABELS: Record<string, string> = {
  XIAOHONGSHU: "小红书",
  DOUYIN: "抖音",
};

export const PURCHASE_REQUEST_STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: "待审批",
  REVIEWED: "待分配",
  ASSIGNED: "已分配",
  REJECTED: "已驳回",
  VOIDED: "已作废",
};

export const PURCHASE_LINE_STATUS_LABELS: Record<string, string> = {
  PENDING: "待审批",
  APPROVED: "已通过",
  REJECTED: "已驳回",
  ASSIGNED: "已分配",
};

export type PurchasePlatform = (typeof PURCHASE_PLATFORM_OPTIONS)[number]["value"];

export function isPurchasePlatform(value: string): value is PurchasePlatform {
  return PURCHASE_PLATFORM_OPTIONS.some((option) => option.value === value);
}

export function isPurchasePageRole(role: string | null | undefined): role is (typeof PURCHASE_VIEW_ROLES)[number] {
  return !!role && PURCHASE_VIEW_ROLES.includes(role as (typeof PURCHASE_VIEW_ROLES)[number]);
}

export function canViewPurchaseRequest(role: string, viewerId: string, creatorId: string): boolean {
  return role === "ADMIN" || role === "PR_MANAGER" || (role === "OPERATOR" && viewerId === creatorId);
}

export function buildPurchaseRequestWhere(role: string, userId: string): Prisma.PurchaseRequestWhereInput {
  if (role === "OPERATOR") {
    return { creatorId: userId };
  }
  return {};
}

export function parsePurchaseQuantity(value: unknown): number | null {
  const num = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isInteger(num) || num <= 0 || num > 9999) return null;
  return num;
}

export function normalizePurchaseText(value: unknown, maxLength: number): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.length <= maxLength ? text : null;
}

export function isValidPurchaseLink(value: string): boolean {
  if (value.length === 0 || value.length > 500) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function sumQuantities(lines: Array<{ quantity: number }>): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
