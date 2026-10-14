import { NextRequest, NextResponse} from "next/server";
import { prisma} from "@/lib/prisma";
import { requireRoles} from "@/lib/api-auth";
import { parseProcurementNote } from "@/lib/procurement-note";

// 采买工单 → 合作工单：返回预填映射，表单里可编辑
// 映射：标题加""前缀；款式→款式；数量/素材类型/理由/发布链接→备注；预算→预算
export async function GET(req: NextRequest, { params}: { params: { id: string}}) {
const auth = await requireRoles(["ADMIN", "PR", "PR_MANAGER"]);
if (!auth.ok) return auth.res;

const ticket = await prisma.cooperationTicket.findUnique({ where: { id: params.id}});
if (!ticket) return NextResponse.json({ error: "工单不存在"}, { status: 404});
if (ticket.ticketKind!== "PROCUREMENT") {
return NextResponse.json({ error: "仅采买工单可转合作工单"}, { status: 400});
}
if (ticket.status!== "APPROVED") {
return NextResponse.json({ error: "仅采买通过的工单可转合作工单"}, { status: 400});
}

const procurementData = parseProcurementNote(ticket.note);
const noteParts: string[] = [];
if (procurementData.quantity) noteParts.push(`采买数量：${procurementData.quantity}`);
if (ticket.contentDirection) noteParts.push(`素材类型：${ticket.contentDirection}`);
if (procurementData.reason) noteParts.push(`需求理由：${procurementData.reason}`);
if (procurementData.publishLinks.length > 0) {
noteParts.push(`发布链接：\n${procurementData.publishLinks.map((link, i) => `${i + 1}. ${link}`).join("\n")}`);
}
if (procurementData.note) noteParts.push(`原采买备注：${procurementData.note}`);

return NextResponse.json({
sourceTicketId: ticket.id,
sourceTicketNo: ticket.ticketNo,
title: `${ticket.title}`,
style: ticket.style as string[],
budgetFee: String(ticket.budgetFee),
note: noteParts.join("\n"),
contentDirection: ticket.contentDirection || null,
});
}
