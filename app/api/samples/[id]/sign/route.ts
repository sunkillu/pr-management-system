import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { writeLog} from "@/lib/approval-log";
import { notifyUser} from "@/lib/feishu-notify";

// 确认签收：SHIPPED → SIGNED
export async function POST(req: NextRequest, { params}: { params: { id: string}}) {
const auth = await requireRoles(["ADMIN", "WAREHOUSE"]);
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
if (sample.ticketId) {
  await prisma.$transaction(async (tx) => {
    const ticket = await tx.cooperationTicket.findUnique({ where: { id: sample.ticketId as string }, select: { status: true, title: true, creatorId: true } });
    if (ticket && ["IN_PROGRESS", "APPROVED"].includes(ticket.status)) {
      await tx.cooperationTicket.update({ where: { id: sample.ticketId as string }, data: { status: "AWAITING_DRAFT" } });
      await writeLog(tx, { docType: "TICKET", docId: sample.ticketId as string, action: "EDIT", actorId: auth.userId, fromStatus: ticket.status, toStatus: "AWAITING_DRAFT", note: "寄品签收，进入待返稿" });
      await notifyUser(ticket.creatorId, `工单「${ticket.title}」寄品已签收，请补充确定档期并等待返稿。`, { type: "TICKET", id: sample.ticketId as string, title: "工单待返稿", kind: "SYSTEM" });
    }
  });
}
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
