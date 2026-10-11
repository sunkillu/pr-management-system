// 枚举值 → 中文标签，以及状态徽章颜色

export const roleLabels: Record<string, string> = {
  ADMIN: "管理员",
  OPERATOR: "运营",
  FINANCE: "财务",
  VIEWER: "只读",
  PR_MANAGER: "PR负责人",
  PR: "PR",
};

export const outletTypeLabels: Record<string, string> = {
  KOL: "达人",
  KOC: "KOC",
  MEDIA: "媒体",
  AGENCY: "机构",
  MCN: "MCN",
};

export const platformLabels: Record<string, string> = {
  DOUYIN: "抖音",
  XIAOHONGSHU: "小红书",
  WEIBO: "微博",
  BILIBILI: "B站",
  WECHAT: "微信公众号",
  OTHER: "其他",
};

export const outletStatusLabels: Record<string, string> = {
  ACTIVE: "合作中",
  INACTIVE: "停用",
};

export const contentTypeLabels: Record<string, string> = {
  CAO_TEXT: "种草文",
  PRESS: "新闻稿",
  VIDEO_SCRIPT: "短视频脚本",
  POSTER: "海报",
  OTHER: "其他",
};

export const contentStatusLabels: Record<string, string> = {
  DRAFT: "草稿",
  PENDING: "待审批",
  APPROVED: "已通过",
  PUBLISHED: "已发布",
  REJECTED: "已驳回",
  VOIDED: "已作废",
};

// 子任务状态
export const subtaskStatusLabels: Record<string, string> = {
  TODO: "待办",
  DOING: "进行中",
  DONE: "已完成",
};

export const campaignStatusLabels: Record<string, string> = {
  PREPARING: "筹备",
  ONGOING: "进行中",
  ENDED: "已结束",
};

export const paymentStatusLabels: Record<string, string> = {
  PENDING_BIZ: "待业务审批",
  PENDING_FIN: "待财务审批",
  APPROVED: "待打款",
  PAID: "已打款",
  REJECTED: "已驳回",
  VOIDED: "已作废",
};

export const approvalStageLabels: Record<string, string> = {
  CONTENT: "内容审批",
  BIZ: "业务审批",
  FIN: "财务审批",
};

export const approvalActionLabels: Record<string, string> = {
  APPROVE: "通过",
  REJECT: "驳回",
};

export const docTypeLabels: Record<string, string> = {
  CONTENT: "内容",
  PAYMENT: "打款单",
};

export const logActionLabels: Record<string, string> = {
  SUBMIT: "提交审批",
  RESUBMIT: "重新提交",
  APPROVE: "通过",
  REJECT: "驳回",
  PUBLISH: "标记已发布",
  MARK_PAID: "标记已打款",
  VOID: "作废",
  LINK: "关联单据",
  UNLINK: "解除关联",
};

export const invoiceTypeLabels: Record<string, string> = {
  SPECIAL_VAT: "增值税专票",
  NORMAL_VAT: "增值税普票",
  E_INVOICE: "电子发票",
  RECEIPT: "收据",
};

export const invoiceStatusLabels: Record<string, string> = {
  PENDING: "待核验",
  VERIFIED: "已核验",
  INVALID: "异常",
};

// 状态徽章颜色（Tailwind 类名）
const badgeColors: Record<string, string> = {
  // 内容 / 打款：待处理 → 黄；通过/完成 → 绿；驳回/异常 → 红；草稿 → 灰
  DRAFT: "bg-gray-100 text-gray-700",
  PENDING: "bg-yellow-100 text-yellow-800",
  PENDING_BIZ: "bg-yellow-100 text-yellow-800",
  PENDING_FIN: "bg-orange-100 text-orange-800",
  APPROVED: "bg-blue-100 text-blue-800",
  PUBLISHED: "bg-green-100 text-green-800",
  PAID: "bg-green-100 text-green-800",
  VERIFIED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  INVALID: "bg-red-100 text-red-800",
  VOIDED: "bg-gray-200 text-gray-600",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  MATERIAL_REVIEW: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
  SETTLING: "bg-orange-100 text-orange-800",
  FOLLOW_UP: "bg-purple-100 text-purple-800",
  SETTLED: "bg-green-100 text-green-800",
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-500",
  PREPARING: "bg-gray-100 text-gray-700",
  ONGOING: "bg-blue-100 text-blue-800",
  ENDED: "bg-gray-100 text-gray-500",
};

export function badgeClass(status: string): string {
  // 胶囊徽章：柔和底色 + 极细内描边，更精致
  return `${badgeColors[status] ?? "bg-gray-100 text-gray-700"} ring-1 ring-inset ring-black/[0.04]`;
}

// 金额格式化（分 → 元显示，保留两位）
export function formatMoney(v: unknown): string {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return "0.00";
  return n.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// 日期格式化
export function formatDate(v: unknown): string {
  if (!v) return "-";
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("zh-CN");
}

export function formatDateTime(v: unknown): string {
  if (!v) return "-";
  const d = new Date(v as string);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("zh-CN", { hour12: false });
}

// ---------- 合作管理 ----------
export const influencerStatusLabels: Record<string, string> = {
  PENDING: "待审核",
  APPROVED: "已通过",
  REJECTED: "已驳回",
};

// 平台标签（多选，可扩展）
export const PLATFORM_TAG_OPTIONS = [
  { value: "XIAOHONGSHU", label: "小红书" },
  { value: "DOUYIN", label: "抖音" },
] as const;
export const platformTagLabels: Record<string, string> = {
  XIAOHONGSHU: "小红书",
  DOUYIN: "抖音",
};

// 款式（多选，必填，可扩展）
export const STYLE_OPTIONS = [
  { value: "DAILY", label: "日常款" },
  { value: "MAIN", label: "主推款" },
  { value: "CLEARANCE", label: "清仓款" },
  { value: "NEW", label: "新品款" },
] as const;
export const styleLabels: Record<string, string> = {
  DAILY: "日常款",
  MAIN: "主推款",
  CLEARANCE: "清仓款",
  NEW: "新品款",
};

// 合作类目（多选，必填，可扩展）
export const COOP_CATEGORY_OPTIONS = [
  { value: "CAOZHONG", label: "种草" },
  { value: "LIVE", label: "直播" },
  { value: "SHORT_VIDEO", label: "短视频" },
  { value: "IMAGE_TEXT", label: "图文" },
  { value: "TANDIAN", label: "探店" },
] as const;
export const coopCategoryLabels: Record<string, string> = {
  CAOZHONG: "种草",
  LIVE: "直播",
  SHORT_VIDEO: "短视频",
  IMAGE_TEXT: "图文",
  TANDIAN: "探店",
};

export const coopTypeLabels: Record<string, string> = {
  INFLUENCER_POST: "达人挂车",
  INFLUENCER_LIVE: "达播",
  MAKEUP: "化妆师合作",
};

// 回收素材类型
export const MATERIAL_TYPE_OPTIONS = [
  { value: "NOTE_LINK", label: "笔记链接" },
  { value: "VIDEO", label: "视频" },
  { value: "IMAGE", label: "图片" },
  { value: "OTHER", label: "其他" },
] as const;
export const materialTypeLabels: Record<string, string> = {
  NOTE_LINK: "笔记链接",
  VIDEO: "视频",
  IMAGE: "图片",
  OTHER: "其他",
};

// 合作工单状态
export const ticketStatusLabels: Record<string, string> = {  DRAFT: "草稿",
  PENDING_APPROVAL: "待审批",
  APPROVED: "已通过（待执行）",
  IN_PROGRESS: "执行中",
  MATERIAL_REVIEW: "待素材审批",
  COMPLETED: "已完成",
  SETTLING: "结算中",
  FOLLOW_UP: "跟进中",
  SETTLED: "已结算",
  REJECTED: "已驳回",
  VOIDED: "已作废",
};

// 达人类型（合作需求 / 达人库共用）
export const INFLUENCER_TYPE_OPTIONS = [
  { value: "KOL", label: "KOL" },
  { value: "KOC", label: "KOC" },
  { value: "AMATEUR", label: "素人" },
  { value: "MAKEUP_ARTIST", label: "化妆师" },
] as const;
export const influencerTypeLabels: Record<string, string> = {
  KOL: "KOL",
  KOC: "KOC",
  AMATEUR: "素人",
  MAKEUP_ARTIST: "化妆师",
};

export const coopRequestStatusLabels: Record<string, string> = {
  PENDING: "待审批",
  APPROVED: "已通过",
  REJECTED: "已驳回",
};

export const approverStatusLabels: Record<string, string> = {
  PENDING: "待审批",
  APPROVED: "已通过",
  REJECTED: "已驳回",
};

export const sampleStatusLabels: Record<string, string> = {
  SHIPPED: "已寄出",
  SIGNED: "已签收",
  RETURNED: "已归还",
  WRITTEN_OFF: "已核销",
};

export const notifyTypeLabels: Record<string, string> = {
  FEISHU: "飞书已发送",
  MOCK: "Mock记录",
};

export function formatFee(v: unknown): string {
  if (v == null || v === "") return "-";
  return `¥${Number(v).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`;
}
