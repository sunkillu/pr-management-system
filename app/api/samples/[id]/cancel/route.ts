import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { writeLog} from "@/lib/approval-log";
import { notifyUser} from "@/lib/feishu-notify";

// 取消：任意非终态 → CANCELLED，理由必填
const TERMINAL = ["SIGNED", "WRITTEN_OFF", "CANCELLED", "RETURNED"];
export async function POST(req: NextRequest, { params}: { params: { id: string}}) {
const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER", "WAREHOUSE"]);
if (!auth.ok) return auth.res;
const sample = await prisma.sampleShipment.findUnique({ where: { id: params.id}});
if (!sample) return NextResponse.json({ error: "寄件请求不存在"}, { status: 404});
if (TERMINAL.includes(sample.status)) {
return NextResponse.json({ error: "已完结的请求不可取消"}, { status: 400});
}
const body = await req.json().catch(() => ({}));
const reason = String(body.reason?? "").trim();
if (!reason) {
return NextResponse.json({ error: "取消必须填写理由"}, { status: 400});
}
const updated = await prisma.$transaction(async (tx) => {
const u = await tx.sampleShipment.update({
where: { id: params.id},
data: { status: "CANCELLED", cancelReason: reason},
});
await writeLog(tx, {
docType: "SAMPLE",
docId: params.id,
action: "REJECT",
actorId: auth.userId,
fromStatus: sample.status,
toStatus: "CANCELLED",
note: `取消：${reason}`,
});
return u;
});
await notifyUser(
sample.createdById,
`${sample.productName}：${reason}`,
{ type: "SAMPLE", id: sample.id, title: "寄件请求已取消", kind: "REJECTED"}
);
return NextResponse.json(updated);
}
