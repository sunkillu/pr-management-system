import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { notifyApprovers} from "@/lib/feishu-notify";

// 催办：提醒待审批的审批人们走流程。写入通知记录，不做频率限制。
export async function POST(_req: NextRequest, { params}: { params: { id: string}}) {
const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
if (!auth.ok) return auth.res;
const influencer = await prisma.influencer.findUnique({ where: { id: params.id}});
if (!influencer) return NextResponse.json({ error: "达人登记不存在"}, { status: 404});
if (influencer.status!== "PENDING") {
return NextResponse.json({ error: "仅待审核的登记可催办"}, { status: 400});
}
const pending = await prisma.requestApprover.findMany({
where: { requestType: "INFLUENCER", requestId: params.id, status: "PENDING"},
select: { approverId: true},
});
if (pending.length === 0) {
return NextResponse.json({ error: "暂无待审批人"}, { status: 400});
}
await notifyApprovers(
pending.map((p) => p.approverId),
`达人登记「${influencer.name}」待你审批，请尽快处理（${auth.userName}提醒）。`,
{ type: "INFLUENCER", id: influencer.id, title: "催办提醒", kind: "REMIND"}
);
return NextResponse.json({ ok: true, count: pending.length});
}
