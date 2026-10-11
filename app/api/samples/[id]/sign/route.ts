import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { writeLog} from "@/lib/approval-log";
import { notifyUser} from "@/lib/feishu-notify";

// 确认签收：SHIPPED → SIGNED
export async function POST(req: NextRequest, { params}: { params: { id: string}}) {
const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
if (!auth.ok) return auth.res;
const sample = await prisma.sampleShipment.findUnique({ where: { id: params.id}});
if (!sample) return NextResponse.json({ error: "寄件请求不存在"}, { status: 404});
if (sample.status!== "SHIPPED") {
return NextResponse.json({ error: "仅已寄出的请求可确认签收"}, { status: 400});
}
const body = await req.json().catch(() => ({}));
const updated = await prisma.$transaction(async (tx) => {
const u = await tx.sampleShipment.update({
where: { id: params.id},
data: {
status: "SIGNED",
signedAt: new Date(),
signedNote: body.note?.trim() || null,
},
});
await writeLog(tx, {
docType: "SAMPLE",
docId: params.id,
action: "APPROVE",
actorId: auth.userId,
fromStatus: "SHIPPED",
toStatus: "SIGNED",
note: body.note?.trim()? `确认签收：${body.note.trim()}`: "确认签收",
});
return u;
});
// 通知仓库
const warehouses = await prisma.user.findMany({
where: { role: { in: ["WAREHOUSE", "ADMIN"]}},
select: { id: true},
});
for (const w of warehouses) {
await notifyUser(
w.id,
`${sample.productName} 已签收。`,
{ type: "SAMPLE", id: sample.id, title: "寄件已签收", kind: "APPROVED"}
);
}
return NextResponse.json(updated);
}
