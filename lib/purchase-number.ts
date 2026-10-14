import { Prisma } from "@prisma/client";

function utcDatePrefix(now: Date): string {
  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("");
}

export async function nextPurchaseNumber(
  tx: Prisma.TransactionClient,
  now: Date = new Date(),
): Promise<string> {
  const datePrefix = utcDatePrefix(now);
  const requestPrefix = `CG-${datePrefix}-`;

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`purchase-request:${datePrefix}`}))`;
  const rows = await tx.$queryRaw<{ sequence: number }[]>`
    SELECT COALESCE(MAX(split_part("requestNo", '-', 3)::integer), 0) + 1 AS sequence
    FROM "PurchaseRequest"
    WHERE "requestNo" LIKE ${`${requestPrefix}%`}
  `;

  return `${requestPrefix}${String(rows[0].sequence).padStart(4, "0")}`;
}
