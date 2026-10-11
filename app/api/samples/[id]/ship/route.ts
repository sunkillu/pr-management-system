import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { writeLog} from "@/lib/approval-log";
import { notifyUser} from "@/lib/feishu-notify";

// 仓库寄出：PREPARING → SHIPPED，快递公司+单号必填
export async function POST(req: NextRequest, { params}: { params: { id: string}}) {
const auth = await requireRoles(["ADMIN", "WAREHOUSE"]);
if (!auth.ok) return auth.res;
const sample = await prisma.sampleShipment.findUnique({ where: { id: params.id}});
if (!sample) return NextResponse.json({ error: "寄件请求不存在"}, { status: 404});
if (sample.status!== "PREPARING") {
return NextResponse.json({ error: "仅备货中的请求可寄出"}, { status: 400});
}
const body = await req.json().catch(() => ({}));
const courier = String(body.courier?? "").trim();
const trackingNo = String(body.trackingNo?? "").trim();
if (!courier ||!trackingNo) {
return NextResponse.json({ error: "快递公司和快递单号必填"}, { status: 400});
}
const updated = await prisma.$transaction(async (tx) => {
const u = await tx.sampleShipment.update({
where: { id: params.id},
data: {
status: "SHIPPED",
courier,
trackingNo,
shippedDate: new Date(),
shippedBy: body.shippedBy?.trim() || null,
},
});
await writeLog(tx, {
docType: "SAMPLE",
docId: params.id,
action: "APPROVE",
actorId: auth.userId,
fromStatus: "PREPARING",
toStatus: "SHIPPED",
note: `已寄出：${courier} ${trackingNo}`,
});
return u;
});
await notifyUser(
sample.createdById,
`${sample.productName} 已通过 ${courier} 寄出，单号 ${trackingNo}。`,
{ type: "SAMPLE", id: sample.id, title: "寄件已寄出", kind: "APPROVED"}
);
return NextResponse.json(updated);
}
