import { Prisma } from "@prisma/client";

function utcDatePrefix(now: Date): string {
  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("");
}

export async function nextTicketNumber(
  tx: Prisma.TransactionClient,
  now: Date = new Date(),
): Promise<string> {
  const datePrefix = utcDatePrefix(now);

  // Serialize number allocation per UTC day across all ticket creation routes.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`cooperation-ticket:${datePrefix}`}))`;
  const existingCount = await tx.cooperationTicket.count({
    where: { ticketNo: { startsWith: datePrefix } },
  });

  return `${datePrefix}${String(existingCount + 1).padStart(4, "0")}`;
}
