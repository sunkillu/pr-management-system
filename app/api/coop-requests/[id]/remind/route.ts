import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { notifyApprovers} from "@/lib/feishu-notify";

// 催办：提醒待审批的审批人们走流程，写入通知记录
export async function POST(_req: NextRequest, { params}: { params: { id: string}}) {
const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
if (!auth.ok) return auth.res;
const request = await prisma.cooperationRequest.findUnique({ where: { id: params.id}});
if (!request) return NextResponse.json({ error: "合作需求不存在"}, { status: 404});
if (request.submitterId !== auth.userId) {
return NextResponse.json({ error: "仅申请人可催办"}, { status: 403});
}
if (request.status!== "PENDING") {
return NextResponse.json({ error: "仅待审批的需求可催办"}, { status: 400});
}
const pending = await prisma.requestApprover.findMany({
where: { requestType: "COOP_REQUEST", requestId: params.id, status: "PENDING"},
select: { approverId: true},
});
if (pending.length === 0) {
return NextResponse.json({ error: "暂无待审批人"}, { status: 400});
}
await notifyApprovers(
pending.map((p) => p.approverId),
`合作需求「${request.title}」待你审批，请尽快处理（${auth.userName}提醒）。`,
{ type: "COOP_REQUEST", id: request.id, title: "催办提醒", kind: "REMIND"}
);
return NextResponse.json({ ok: true, count: pending.length});
}
