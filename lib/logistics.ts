import { prisma} from "./prisma";
import { notifyUser} from "./feishu-notify";

/**
* 寄品物流检查（全部幂等，可重复调用，重复运行不重复创建提醒）。
*
* 1. checkLogisticsT1：发货后 T+1 检测物流状态。无真实物流接口时，
* 仅将 logisticsStatus 标记为「待手动确认」并打 logisticsCheckedAt 标记，
* 不编造物流数据；同时通知仓库人工确认。
* 2. checkSampleOverdue：寄品停留在非终态（待处理/备货中/已寄出）超过 7 天
* 预警，打 overdueWarnedAt 标记防重复。
* 3. remindScheduleAfterSign：已签收且尚未提醒过补档期时，提醒相关人员
* 确定档期，打 scheduleRemindedAt 标记防重复。
* 每个检查返回本次新产生的处理数量；单条失败静默跳过，不影响主流程。
*/

// 物流状态白名单：仅允许手动维护或 cron 写入以下值
export const LOGISTICS_STATUSES = ["待手动确认", "运输中", "已签收"] as const;
// 异常标记白名单：拒收 / 退回 / 异常单独标记
export const ABNORMAL_FLAGS = ["拒收", "退回", "异常"] as const;

export const logisticsStatusLabels: Record<string, string> = {
待手动确认: "待手动确认",
运输中: "运输中",
已签收: "已签收",
};

export const abnormalFlagLabels: Record<string, string> = {
拒收: "拒收",
退回: "退回",
异常: "异常",
};

/** 物流状态徽章（颜色仅用 shadcn CSS 变量：secondary / primary） */
export function logisticsBadgeClass(status: string): string {
const base = "ring-1 ring-inset";
switch (status) {
case "运输中":
return `bg-primary/10 text-primary ${base} ring-primary/20`;
default:
return `bg-secondary text-secondary-foreground ${base} ring-black/[0.04]`;
}
}

/** 异常标记徽章：destructive 变量 */
export function abnormalBadgeClass(): string {
return "bg-destructive/10 text-destructive ring-1 ring-inset ring-destructive/20";
}

/** 数组去重（替代 Set 迭代，兼容项目 TS target） */
function uniq(ids: Array<string | null | undefined>): string[] {
return ids.filter((v, i, a) =>!!v && a.indexOf(v) === i) as string[];
}

/** 取有管理/跟进寄品的角色用户 id（ADMIN / PR_MANAGER） */
async function getOwnerIds(): Promise<string[]> {
const users = await prisma.user.findMany({
where: { role: { in: ["ADMIN", "PR_MANAGER"]}},
select: { id: true},
});
return users.map((u) => u.id);
}

/** 取仓库用户 id */
async function getWarehouseIds(): Promise<string[]> {
const users = await prisma.user.findMany({
where: { role: { in: ["WAREHOUSE", "ADMIN"]}},
select: { id: true},
});
return users.map((u) => u.id);
}

/**
* T+1 物流检测：发货（shippedAt/shippedDate）超过 24 小时、尚未检测过的已寄出记录。
* 无真实物流接口 → logisticsStatus 置「待手动确认」，打 logisticsCheckedAt 标记，
* 并通知仓库人工确认。绝不编造物流轨迹数据。
*/
export async function checkLogisticsT1(): Promise<number> {
const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
let checked = 0;
try {
const pendings = await prisma.sampleShipment.findMany({
where: {
status: "SHIPPED",
logisticsCheckedAt: null,
abnormalFlag: null, // 已标记异常的走人工流程，不再检测
OR: [
{ shippedAt: { lte: cutoff}},
{ AND: [{ shippedAt: null}, { shippedDate: { lte: cutoff}}]},
],
},
select: { id: true, productName: true, courier: true, trackingNo: true, createdById: true},
});
const warehouseIds = await getWarehouseIds();
for (const s of pendings) {
try {
await prisma.sampleShipment.update({
where: { id: s.id},
data: { logisticsStatus: "待手动确认", logisticsCheckedAt: new Date()},
});
const tip = `${s.productName}${
s.courier? `（${s.courier}${s.trackingNo? ` ${s.trackingNo}`: ""}）`: ""
}已发货超过 24 小时，暂无物流接口自动查询，请人工确认物流状态。`;
const targets = uniq([...warehouseIds, s.createdById]);
for (const uid of targets) {
await notifyUser(uid, tip, {
type: "SAMPLE",
id: s.id,
title: "物流待手动确认",
kind: "REMIND",
});
}
checked++;
} catch {
// 单条失败跳过，不影响后续
}
}
} catch {
// 整体失败静默返回
}
return checked;
}

/**
 * 寄品超 7 天预警：非终态停留超过 7 天。
 * 基准时间不取 updatedAt —— 任何字段更新（包括 T+1 检测自身写入 logisticsStatus）
 * 都会刷新 updatedAt，导致"已寄出 8 天"的记录因 T+1 刚跑过而永远不预警。
 * 基准：SHIPPED 按发货时间（shippedAt / shippedDate，取"7 天未签收"本意）；
 * PENDING / PREPARING 按创建时间（无独立的状态停留时间字段，createdAt 为最接近的口径）。
 */
export async function checkSampleOverdue(): Promise<number> {
const ACTIVE: Array<"PENDING" | "PREPARING" | "SHIPPED"> = ["PENDING", "PREPARING", "SHIPPED"];
const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000);
let warned = 0;
try {
const actives = await prisma.sampleShipment.findMany({
where: { status: { in: ACTIVE}, overdueWarnedAt: null },
select: { id: true, productName: true, status: true, createdById: true, createdAt: true, shippedAt: true, shippedDate: true },
});
const overdue = actives.filter((s) => {
const base = s.status === "SHIPPED" ? s.shippedAt ?? s.shippedDate ?? s.createdAt : s.createdAt;
return base.getTime() < cutoff.getTime();
});
const ownerIds = await getOwnerIds();
const statusNames: Record<string, string> = {
PENDING: "待处理",
PREPARING: "备货中",
SHIPPED: "已寄出",
};
for (const s of overdue) {
try {
await prisma.sampleShipment.update({
where: { id: s.id},
data: { overdueWarnedAt: new Date()},
});
const tip = `${s.productName} 已在「${statusNames[s.status]?? s.status}」状态停留超过 7 天，请跟进处理。`;
const targets = uniq([...ownerIds, s.createdById]);
for (const uid of targets) {
await notifyUser(uid, tip, {
type: "SAMPLE",
id: s.id,
title: "寄品超期预警",
kind: "SYSTEM",
});
}
warned++;
} catch {
// 单条失败跳过
}
}
} catch {
// 整体失败静默返回
}
return warned;
}

/** 签收后提醒补档期：已签收且尚未提醒过。通知工单发起人/归属人或寄品提交人。 */
export async function remindScheduleAfterSign(): Promise<number> {
let reminded = 0;
try {
const signed = await prisma.sampleShipment.findMany({
where: { status: "SIGNED", signedAt: { not: null}, scheduleRemindedAt: null},
select: {
id: true,
productName: true,
createdById: true,
ticket: { select: { id: true, creatorId: true, assigneeId: true, title: true}},
},
});
for (const s of signed) {
try {
await prisma.sampleShipment.update({
where: { id: s.id},
data: { scheduleRemindedAt: new Date()},
});
const tip = `${s.productName} 已签收${
s.ticket? `（关联工单「${s.ticket.title}」）`: ""
}，请及时补确定档期。`;
const targets = uniq([s.ticket?.creatorId, s.ticket?.assigneeId, s.createdById]);
for (const uid of targets) {
await notifyUser(uid, tip, {
type: "SAMPLE",
id: s.id,
title: "签收后补档期提醒",
kind: "REMIND",
});
}
reminded++;
} catch {
// 单条失败跳过
}
}
} catch {
// 整体失败静默返回
}
return reminded;
}

/** 一次运行全部三项检查，返回各自计数。供定时任务入口调用。 */
export async function runLogisticsChecks(): Promise<{
t1Checked: number;
overdueWarned: number;
scheduleReminded: number;
}> {
const [t1Checked, overdueWarned, scheduleReminded] = await Promise.all([
checkLogisticsT1(),
checkSampleOverdue(),
remindScheduleAfterSign(),
]);
return { t1Checked, overdueWarned, scheduleReminded};
}
