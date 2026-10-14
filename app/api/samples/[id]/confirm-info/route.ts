import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { writeLog} from "@/lib/approval-log";
import { notifyApprovers} from "@/lib/feishu-notify";

// 确认寄件信息并推送仓库：仅待处理、仅提交人/管理员
// 校验收件人/电话/地址/明细齐全 → infoConfirmed=true → 通知仓库接单
export async function POST(req: NextRequest, { params}: { params: { id: string}}) {
const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
if (!auth.ok) return auth.res;
const sample = await prisma.sampleShipment.findUnique({ where: { id: params.id}});
if (!sample) return NextResponse.json({ error: "寄件请求不存在"}, { status: 404});
if (sample.status!== "PENDING") {
return NextResponse.json({ error: "仅待处理的请求可确认信息"}, { status: 400});
}
const body = await req.json().catch(() => ({}));
const resend = body.resend === true;
if (sample.infoConfirmed && !resend) {
return NextResponse.json({ error: "信息已推送过仓库，如有修改请确认后重新推送"}, { status: 400});
}
// 仅提交人或管理员可确认
if (auth.role!== "ADMIN" && sample.createdById!== auth.userId) {
return NextResponse.json({ error: "仅提交人或管理员可确认信息"}, { status: 403});
}
// 校验信息齐全
const missing: string[] = [];
if (!sample.receiverName?.trim()) missing.push("收件人");
if (!sample.receiverPhone?.trim()) missing.push("收件电话");
if (!sample.receiverAddress?.trim()) missing.push("收件地址");
const items = sample.items as { style?: string}[] | null;
if (!sample.productName?.trim() && (!Array.isArray(items) || items.length === 0)) {
missing.push("寄品明细（产品名称或明细至少填一项）");
}
if (missing.length > 0) {
return NextResponse.json({ error: `信息不全，请补充：${missing.join("、")}`}, { status: 400});
}
const updated = await prisma.$transaction(async (tx) => {
const u = await tx.sampleShipment.update({
where: { id: params.id},
data: { infoConfirmed: true, pushedAt: new Date(), pushCount: { increment: 1 }},
});
await writeLog(tx, {
docType: "SAMPLE",
docId: params.id,
action: "APPROVE",
actorId: auth.userId,
fromStatus: "PENDING",
toStatus: "PENDING",
note: resend ? "寄件信息修改后重新推送仓库" : "寄件信息已确认，推送仓库",
});
return u;
});
// 通知仓库有新的寄件请求待接单
const warehouses = await prisma.user.findMany({
where: { role: { in: ["WAREHOUSE", "ADMIN"]}},
select: { id: true},
});
await notifyApprovers(
warehouses.map((w) => w.id),
`${resend ? "【寄件信息已修改，重新推送】" : ""}${sample.productName}（收件人：${sample.receiverName}），寄件信息已确认，请仓库接单备货。`,
{ type: "SAMPLE", id: sample.id, title: "寄件请求待接单", kind: "APPROVAL_PENDING"}
);
return NextResponse.json(updated);
}
