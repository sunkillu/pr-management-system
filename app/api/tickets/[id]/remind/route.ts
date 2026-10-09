import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { notifyApprovers} from "@/lib/feishu-notify";

// 催办：提醒待审批的审批人
export async function POST(_req: NextRequest, { params}: { params: { id: string}}) {
const auth = await requireRoles(["ADMIN", "OPERATOR", "PR_MANAGER"]);
if (!auth.ok) return auth.res;
const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id}});
if (!ticket) return NextResponse.json({ error: "工单不存在"}, { status: 404});
if (ticket.status!== "PENDING_APPROVAL") {
return NextResponse.json({ error: "仅待审批的工单可催办"}, { status: 400});
}
const pending = await prisma.requestApprover.findMany({
where: { requestType: "TICKET", requestId: params.id, status: "PENDING"},
select: { approverId: true},
});
if (pending.length === 0) return NextResponse.json({ error: "暂无待审批人"}, { status: 400});
await notifyApprovers(
pending.map((p) => p.approverId),
`${auth.userName}提醒您尽快审批合作工单「${ticket.title}」。`,
{ type: "TICKET", id: ticket.id, title: "审批催办", kind: "REMIND"}
);
return NextResponse.json({ ok: true, count: pending.length});
}
