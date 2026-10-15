import { Prisma } from "@prisma/client";
import { writeLog } from "@/lib/approval-log";
import { nextSampleNumber } from "@/lib/sample-number";

type ShipItem = { style: string; degree?: string; note?: string };

// 工单有寄品明细时自动生成寄件请求（PENDING，待维护收件信息）；同一工单只会生成一次
export async function ensureTicketSample(
  tx: Prisma.TransactionClient,
  ticketId: string,
  actorId: string,
  note = "工单审批通过，系统自动创建寄品单",
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sample-ticket:${ticketId}`}))`;
  const ticket = await tx.cooperationTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      title: true,
      brandId: true,
      creatorId: true,
      influencerId: true,
      ticketKind: true,
      sampleRequired: true,
      shipItems: true,
      influencer: { select: { name: true } },
    },
  });
  const items = (Array.isArray(ticket?.shipItems) ? ticket.shipItems : []) as ShipItem[];
  // 维护工单只要勾选“需要寄品”即可先生成空寄品单，寄品明细和收件信息在工单内补齐；
  // 普通合作工单仍要求创建时已有寄品明细。
  if (!ticket || (items.length === 0 && !(ticket.ticketKind === "MAINTENANCE" && ticket.sampleRequired))) return null;
  const existing = await tx.sampleShipment.findFirst({ where: { ticketId } });
  if (existing) return null;

  const created = await tx.sampleShipment.create({
    data: {
      sampleNo: await nextSampleNumber(tx),
      influencerId: ticket.influencerId,
      ticketId,
      brandId: ticket.brandId,
      productName: `工单「${ticket.title}」寄品`,
      quantity: items.length || 1,
      items: items.length > 0 ? items as unknown as Prisma.InputJsonValue : undefined,
      receiverName: ticket.influencer?.name ?? null,
      status: "PENDING",
      // 归属工单创建人：由其维护并确认收件信息；实际操作人记在日志里
      createdById: ticket.creatorId,
    },
  });
  await writeLog(tx, {
    docType: "SAMPLE",
    docId: created.id,
    action: "CREATE",
    actorId,
    fromStatus: null,
    toStatus: "PENDING",
    note,
  });
  return created;
}
