// 工单标题规范（v2 父子工单模型）
// 父工单与各环节子工单的标题统一由此生成，避免手工填写不一致。
import { coopTypeLabels, platformTagLabels, styleLabels } from "./labels";

// 标题内部分隔符：全角竖线 ｜
const SEP = "｜";

function joinNames(names: (string | null | undefined)[]): string {
  const s = names.filter((x): x is string => !!x && String(x).trim() !== "").join("、");
  return s || "-";
}

function toStyleNames(styles: (string | null | undefined)[] | null | undefined): string {
  return joinNames((styles ?? []).map((s) => (s ? styleLabels[s] ?? s : s)));
}

function toPlatformNames(platforms: (string | null | undefined)[] | null | undefined): string {
  return joinNames((platforms ?? []).map((p) => (p ? platformTagLabels[p] ?? p : p)));
}

function toCoopType(t: string | null | undefined): string {
  return t ? coopTypeLabels[t] ?? t : "-";
}

function toDate(v: string | null | undefined): string {
  return v?.trim() || "-";
}

export type ParentTitleInput = {
  influencerName: string;
  styles?: (string | null | undefined)[] | null;
  coopType?: string | null;
  estimatedPublishMonth?: string | null;
};

export type ChildTitleInput = {
  influencerName: string;
  styles?: (string | null | undefined)[] | null;
  platforms?: (string | null | undefined)[] | null;
  confirmedDate?: string | null;
  publishDate?: string | null;
};

export type TicketTitleInput = {
  partnerName?: string | null;
  platforms?: (string | null | undefined)[] | null;
  prName?: string | null;
  fallback?: string | null;
};

/** 采买转合作、维护转合作等场景使用的父工单标题。 */
export function buildTicketTitle(input: TicketTitleInput): string {
  const partner = input.partnerName?.trim() || "待补达人";
  const platform = toPlatformNames(input.platforms);
  const pr = input.prName?.trim() || "待分配PR";
  return `[合作] ${partner}${SEP}${platform}${SEP}${pr}` || input.fallback || "合作工单";
}

/** 父工单标题：[达人合作] 达人昵称｜款式｜合作类型；不再拼接预估发布年月 */
export function buildParentTitle(input: ParentTitleInput): string {
  return `[达人合作] ${joinNames([input.influencerName])}${SEP}${toStyleNames(input.styles)}${SEP}${toCoopType(input.coopType)}`;
}

/** 子工单·寄品标题：[寄品] 达人昵称｜款式 */
export function buildSampleTitle(input: ChildTitleInput): string {
  return `[寄品] ${joinNames([input.influencerName])}${SEP}${toStyleNames(input.styles)}`;
}

/** 子工单·返稿标题：[返稿] 达人昵称｜款式｜确认档期 */
export function buildReviewTitle(input: ChildTitleInput): string {
  return `[返稿] ${joinNames([input.influencerName])}${SEP}${toStyleNames(input.styles)}${SEP}${toDate(
    input.confirmedDate,
  )}`;
}

/** 子工单·发布标题：[发布] 达人昵称｜平台｜确认档期 */
export function buildPublishTitle(input: ChildTitleInput): string {
  return `[发布] ${joinNames([input.influencerName])}${SEP}${toPlatformNames(input.platforms)}${SEP}${toDate(
    input.confirmedDate,
  )}`;
}

/** 子工单·数据回收标题：[数据回收] 达人昵称｜平台｜发布日期 */
export function buildDataTitle(input: ChildTitleInput): string {
  return `[数据回收] ${joinNames([input.influencerName])}${SEP}${toPlatformNames(input.platforms)}${SEP}${toDate(
    input.publishDate,
  )}`;
}

// 子工单类型（TicketSubType 中作为环节单据的类型）
export type ChildTicketSubType = "SAMPLE" | "REVIEW" | "PUBLISH" | "DATA";

export const CHILD_SUB_TYPES: ChildTicketSubType[] = ["SAMPLE", "REVIEW", "PUBLISH", "DATA"];

export const childSubTypeLabels: Record<ChildTicketSubType, string> = {
  SAMPLE: "寄品",
  REVIEW: "返稿",
  PUBLISH: "发布",
  DATA: "数据回收",
};

/** 按子工单类型分发标题生成（标题自动按规范生成） */
export function buildChildTitle(subType: ChildTicketSubType, input: ChildTitleInput): string {
  switch (subType) {
    case "SAMPLE":
      return buildSampleTitle(input);
    case "REVIEW":
      return buildReviewTitle(input);
    case "PUBLISH":
      return buildPublishTitle(input);
    case "DATA":
      return buildDataTitle(input);
  }
}
