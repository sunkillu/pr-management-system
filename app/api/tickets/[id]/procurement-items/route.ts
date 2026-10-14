import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { writeLog} from "@/lib/approval-log";

const ALL_ROLES = ["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER"] as const;

// 采买工单逐条审批：GET 列出 ProcurementItem；PATCH 逐条通过/驳回（仅 ADMIN）。
// 逐条审批与整单审批共存：新单（有 ProcurementItem）走逐条 + 分配流程；
// 老单（无 ProcurementItem）仍走整单审批 + 接单流程。

// 逐条审批后同步刷新工单 note 里的列表状态，避免 note 文本过期。
function rebuildProcurementNote(
items: { style: string; quantity: number; status: string; approvedQty: number | null; rejectReason: string | null; link: string | null}[],
) {
const lines = [
"",
...items.map((it, i) => {
const state =
it.status === "APPROVED"
? `已通过（数量：${it.approvedQty?? it.quantity}）`
: it.status === "REJECTED"
? `已驳回${it.rejectReason? `：${it.rejectReason}`: ""}`
: "待审批";
return `${i + 1}. 款式：${it.style} 数量：${it.quantity}（${state}）`;
}),
];
const link = items.find((it) => it.link)?.link;
if (link) lines.push(`参考链接：${link}`);
return lines.join("\n");
}

export async function GET(
req: NextRequest,
{ params}: { params: { id: string}},
) {
const auth = await requireRoles([...ALL_ROLES]);
if (!auth.ok) return auth.res;
const ticket = await prisma.cooperationTicket.findUnique({
where: { id: params.id},
select: { id: true, ticketKind: true},
});
if (!ticket) return NextResponse.json({ error: "工单不存在"}, { status: 404});
if (ticket.ticketKind!== "PROCUREMENT") {
return NextResponse.json({ error: "仅采买工单有逐条请求"}, { status: 400});
}
const items = await prisma.procurementItem.findMany({
where: { ticketId: params.id},
orderBy: { createdAt: "asc"},
});
return NextResponse.json(items);
}

export async function PATCH(
req: NextRequest,
{ params}: { params: { id: string}},
) {
const auth = await requireRoles(["ADMIN"]);
if (!auth.ok) return auth.res;
const body = await req.json();
const itemId = String(body.itemId?? "").trim();
const action = body.action as "approve" | "reject";
if (!itemId) return NextResponse.json({ error: "itemId 不能为空"}, { status: 400});
if (!["approve", "reject"].includes(action)) {
return NextResponse.json({ error: "action 非法"}, { status: 400});
}

const ticket = await prisma.cooperationTicket.findUnique({
where: { id: params.id},
select: { id: true, title: true, ticketKind: true, status: true, creatorId: true},
});
if (!ticket) return NextResponse.json({ error: "工单不存在"}, { status: 404});
if (ticket.ticketKind!== "PROCUREMENT") {
return NextResponse.json({ error: "仅采买工单可逐条审批"}, { status: 400});
}
if (!["PENDING_PROCUREMENT", "APPROVED"].includes(ticket.status)) {
return NextResponse.json({ error: "仅待采买审批 / 已通过的采买工单可逐条审批"}, { status: 400});
}
const item = await prisma.procurementItem.findUnique({ where: { id: itemId}});
if (!item || item.ticketId!== params.id) {
return NextResponse.json({ error: "采买请求不存在"}, { status: 404});
}
if (item.status!== "PENDING") {
return NextResponse.json({ error: "该条已审批，不可重复操作"}, { status: 400});
}

let approvedQty: number | null = null;
let rejectReason: string | null = null;
if (action === "approve") {
const raw = body.approvedQty;
approvedQty = raw == null || raw === ""? item.quantity: Number(raw);
if (!Number.isInteger(approvedQty) || approvedQty <= 0 || approvedQty > item.quantity) {
return NextResponse.json({ error: "通过数量必须为正整数且不超过申请数量"}, { status: 400});
}
} else {
rejectReason = String(body.rejectReason?? "").trim();
if (!rejectReason) {
return NextResponse.json({ error: "驳回必须填写理由"}, { status: 400});
}
}

const updated = await prisma.$transaction(async (tx) => {
const u = await tx.procurementItem.update({
where: { id: itemId},
data: {
status: action === "approve"? "APPROVED": "REJECTED",
approvedQty: action === "approve"? approvedQty: null,
rejectReason,
},
});
// 同步 note 里的状态
const all = await tx.procurementItem.findMany({
where: { ticketId: params.id},
orderBy: { createdAt: "asc"},
});
await tx.cooperationTicket.update({
where: { id: params.id},
data: { note: rebuildProcurementNote(all)},
});
await writeLog(tx, {
docType: "TICKET",
docId: params.id,
action: action === "approve"? "APPROVE": "REJECT",
actorId: auth.userId,
fromStatus: ticket.status,
toStatus: ticket.status,
note: `采买逐条审批：款式 ${item.style} 数量 ${item.quantity} → ${action === "approve"? `通过（${approvedQty}）`: `驳回（${rejectReason}）`}`,
});
return u;
});

return NextResponse.json(updated);
}
