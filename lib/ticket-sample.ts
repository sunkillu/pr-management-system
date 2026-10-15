import type { Prisma } from "@prisma/client";
import { nextSampleNumber } from "./sample-number";
import { writeLog } from "./approval-log";

// 审批通过后自动建寄品单：幂等（同工单已有寄品单则直接返回），
// 新建为 PENDING + infoConfirmed=false，由提交人维护收件信息并确认后才推仓库。
export async function ensureTicketSample(
  tx: Prisma.TransactionClient,
  ticketId: string,
  userId: string,
  note: string
) {
  const existing = await tx.sampleShipment.findFirst({
    where: { ticketId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  const ticket = await tx.cooperationTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, title: true, brandId: true },
  });
  if (!ticket) throw new Error("工单不存在");
  const created = await tx.sampleShipment.create({
    data: {
      sampleNo: await nextSampleNumber(tx),
      ticketId: ticket.id,
      brandId: ticket.brandId,
      productName: ticket.title,
      quantity: 1,
      status: "PENDING",
      infoConfirmed: false,
      createdById: userId,
    },
  });
  await writeLog(tx, {
    docType: "SAMPLE",
    docId: created.id,
    action: "CREATE",
    actorId: userId,
    fromStatus: null,
    toStatus: "PENDING",
    note,
  });
  return created;
}
