import { Prisma } from "@prisma/client";

function utcDatePrefix(now: Date): string {
  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("");
}

export async function nextSampleNumber(
  tx: Prisma.TransactionClient,
  now: Date = new Date(),
): Promise<string> {
  const datePrefix = utcDatePrefix(now);
  const samplePrefix = `YP-${datePrefix}-`;

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sample-shipment:${datePrefix}`}))`;
  const rows = await tx.$queryRaw<{ sequence: number }[]>`
    SELECT COALESCE(MAX(split_part("sampleNo", '-', 3)::integer), 0) + 1 AS sequence
    FROM "SampleShipment"
    WHERE "sampleNo" LIKE ${`${samplePrefix}%`}
  `;

  return `${samplePrefix}${String(rows[0].sequence).padStart(4, "0")}`;
}
