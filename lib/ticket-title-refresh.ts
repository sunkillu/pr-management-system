import type { PrismaClient } from "@prisma/client";
import { buildTicketTitle } from "@/lib/ticket-title";

type TicketTitleDb = Pick<PrismaClient, "cooperationTicket">;

type TicketRecord = {
  id: string;
  title: string;
  platform: string[];
  influencer: { name: string } | null;
  makeupArtist: { name: string } | null;
  assignee: { name: string } | null;
  creator: { name: string } | null;
};

export async function refreshTicketTitle(db: TicketTitleDb, ticketId: string) {
  const ticket = (await db.cooperationTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      title: true,
      platform: true,
      influencer: { select: { name: true } },
      makeupArtist: { select: { name: true } },
      assignee: { select: { name: true } },
      creator: { select: { name: true } },
    },
  })) as TicketRecord | null;

  if (!ticket) return null;

  const title = buildTicketTitle({
    partnerName: ticket.influencer?.name ?? ticket.makeupArtist?.name,
    platforms: ticket.platform,
    prName: ticket.assignee?.name ?? ticket.creator?.name,
    fallback: ticket.title,
  });

  return db.cooperationTicket.update({
    where: { id: ticketId },
    data: { title },
  });
}
