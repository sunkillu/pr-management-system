import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { notifyApprovers} from "@/lib/feishu-notify";

// 打款单催办：按当前状态找对应审批人（待业务审批→管理员；待财务审批→财务），飞书提醒
export async function POST(_req: NextRequest, { params}: { params: { id: string}}) {
const auth = await requireRoles(["ADMIN", "OPERATOR", "PR_MANAGER"]);
if (!auth.ok) return auth.res;
const payment = await prisma.paymentRequest.findUnique({ where: { id: params.id}});
if (!payment) return NextResponse.json({ error: "打款单不存在"}, { status: 404});

const targetRoles =
payment.status === "PENDING_BIZ"
? ["ADMIN"]
: payment.status === "PENDING_FIN"
? ["FINANCE", "ADMIN"]
: null;
if (!targetRoles) {
return NextResponse.json({ error: "仅待审批的打款单可催办"}, { status: 400});
}
const approvers = await prisma.user.findMany({
where: { role: { in: targetRoles as never[]}},
select: { id: true},
});
if (approvers.length === 0) {
return NextResponse.json({ error: "暂无待审批人"}, { status: 400});
}
await notifyApprovers(
approvers.map((a) => a.id),
`打款申请「${payment.title}」待审批，请尽快处理（${auth.userName}提醒）。`,
{ type: "PAYMENT", id: payment.id, title: "催办提醒", kind: "REMIND" }
);
return NextResponse.json({ ok: true, count: approvers.length});
}
