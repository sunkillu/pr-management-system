import { prisma} from "./prisma";
import { notifyUser} from "./feishu-notify";
import { APPROVAL_TIMEOUT_HOURS} from "./constants";

/**
* 超时检查（幂等，可重复调用）：
* 1. 审批超时升级：待审批的工单 / 达人登记 / 合作需求，超过 APPROVAL_TIMEOUT_HOURS 未处理
* → 通知所有管理员（kind=ESCALATE），并打 escalatedAt 标记防重复。
* 2. 节点超时提醒：未完成的进度节点超过 expectedAt → 通知工单发起人（kind=REMIND），打 notifiedAt 标记。
* 返回本次新产生的升级/提醒数量。调用方失败时静默吞错，不影响主流程。
*/
export async function checkApprovalTimeouts(): Promise<{ escalated: number; nodeReminded: number}> {
const cutoff = new Date(Date.now() - APPROVAL_TIMEOUT_HOURS * 3600 * 1000);
let escalated = 0;
let nodeReminded = 0;

try {
const admins = await prisma.user.findMany({
where: { role: "ADMIN"},
select: { id: true},
});
const adminIds = admins.map((a) => a.id);

// --- 1. 工单超时 ---
const overdueTickets = await prisma.cooperationTicket.findMany({
where: { status: "PENDING_APPROVAL", escalatedAt: null, updatedAt: { lt: cutoff}},
select: { id: true, title: true, creatorId: true},
});
for (const t of overdueTickets) {
for (const adminId of adminIds) {
await notifyUser(
adminId,
`合作工单「${t.title}」已超过 ${APPROVAL_TIMEOUT_HOURS} 小时未审批，请及时处理。`,
{ type: "TICKET", id: t.id, title: "审批超时升级", kind: "ESCALATE"}
);
}
await prisma.cooperationTicket.update({
where: { id: t.id},
data: { escalatedAt: new Date()},
});
escalated++;
}

// --- 2. 达人登记超时 ---
const overdueInfluencers = await prisma.influencer.findMany({
where: { status: "PENDING", escalatedAt: null, updatedAt: { lt: cutoff}},
select: { id: true, name: true},
});
for (const inf of overdueInfluencers) {
for (const adminId of adminIds) {
await notifyUser(
adminId,
`达人登记「${inf.name}」已超过 ${APPROVAL_TIMEOUT_HOURS} 小时未审批，请及时处理。`,
{ type: "INFLUENCER", id: inf.id, title: "审批超时升级", kind: "ESCALATE"}
);
}
await prisma.influencer.update({ where: { id: inf.id}, data: { escalatedAt: new Date()}});
escalated++;
}

// --- 3. 合作需求超时 ---
const overdueRequests = await prisma.cooperationRequest.findMany({
where: { status: "PENDING", escalatedAt: null, updatedAt: { lt: cutoff}},
select: { id: true, title: true},
});
for (const r of overdueRequests) {
for (const adminId of adminIds) {
await notifyUser(
adminId,
`合作需求「${r.title}」已超过 ${APPROVAL_TIMEOUT_HOURS} 小时未审批，请及时处理。`,
{ type: "COOP_REQUEST", id: r.id, title: "审批超时升级", kind: "ESCALATE"}
);
}
await prisma.cooperationRequest.update({ where: { id: r.id}, data: { escalatedAt: new Date()}});
escalated++;
}

// --- 4. 进度节点超时 ---
const now = new Date();
const overdueNodes = await prisma.ticketNode.findMany({
where: { completedAt: null, notifiedAt: null, expectedAt: { lt: now}},
include: { ticket: { select: { id: true, title: true, creatorId: true, status: true}}},
});
for (const n of overdueNodes) {
if (!["APPROVED", "IN_PROGRESS"].includes(n.ticket.status)) continue;
await notifyUser(
n.ticket.creatorId,
`合作工单「${n.ticket.title}」的进度节点「${n.name}」已超过预期完成时间，请及时跟进。`,
{ type: "TICKET", id: n.ticket.id, title: "节点超时提醒", kind: "REMIND"}
);
await prisma.ticketNode.update({ where: { id: n.id}, data: { notifiedAt: new Date()}});
nodeReminded++;
}

// --- 5. 子任务阻塞超 24 小时提醒 ---
const blockedCutoff = new Date(Date.now() - 24 * 3600 * 1000);
const blockedSubtasks = await prisma.ticketSubtask.findMany({
where: { status: "BLOCKED", blockedNotifiedAt: null, blockedAt: { lt: blockedCutoff }},
include: {
ticket: { select: { id: true, title: true, creatorId: true }},
assignee: { select: { id: true }},
},
});
for (const s of blockedSubtasks) {
const receivers: string[] = [s.ticket.creatorId];
if (s.assignee?.id && !receivers.includes(s.assignee.id)) receivers.push(s.assignee.id);
for (const uid of receivers) {
await notifyUser(
uid,
`合作工单「${s.ticket.title}」的子任务「${s.title}」已阻塞超过 24 小时（原因：${s.blockedReason ?? "未填写"}），请及时处理。`,
{ type: "TICKET", id: s.ticket.id, title: "子任务阻塞提醒", kind: "REMIND"}
);
}
await prisma.ticketSubtask.update({ where: { id: s.id }, data: { blockedNotifiedAt: new Date() }});
nodeReminded++;
}
} catch (e) {
console.error("checkApprovalTimeouts 失败:", e);
}

return { escalated, nodeReminded};
}
