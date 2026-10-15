import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import StylesClient from "@/components/StylesClient";

export default async function StylesPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!role || !["ADMIN", "PR_MANAGER"].includes(role)) redirect("/");

  const [styles, brands] = await Promise.all([
    prisma.styleOption.findMany({ where: { kind: "STYLE" }, include: { brand: { select: { name: true } } }, orderBy: [{ sort: "asc" }, { name: "asc" }] }),
    prisma.brand.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const names = styles.map((s) => s.name);
  const [logs, usage] = await Promise.all([
    styles.length
      ? prisma.approvalLog.findMany({
          where: { docType: "STYLE", docId: { in: styles.map((s) => s.id) } },
          include: { actor: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        })
      : [],
    names.length
      ? prisma.$queryRaw<{ name: string; count: bigint }[]>`
          SELECT s AS name, COUNT(*) AS count
          FROM "CooperationTicket", unnest("style") AS s
          WHERE s = ANY(${names})
          GROUP BY s`
      : [],
  ]);
  const usageByName = new Map(usage.map((u) => [u.name, Number(u.count)]));
  const historyById = new Map<string, typeof logs>();
  for (const log of logs) {
    const list = historyById.get(log.docId) ?? [];
    list.push(log);
    historyById.set(log.docId, list);
  }

  return (
    <StylesClient
      brands={brands}
      initialStyles={styles.map((s) => ({
        id: s.id,
        brandId: s.brandId ?? "",
        brandName: s.brand?.name ?? "未分配",
        name: s.name,
        shelfLifeOptions: s.shelfLifeOptions,
        isActive: s.isActive,
        usedCount: usageByName.get(s.name) ?? 0,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        history: (historyById.get(s.id) ?? []).map((log) => ({
          id: log.id,
          action: log.action,
          actorName: log.actor?.name ?? log.actorLabel ?? "系统任务",
          createdAt: log.createdAt.toISOString(),
          note: log.note,
          fromStatusLabel: log.fromStatus,
          toStatusLabel: log.toStatus,
        })),
      }))}
    />
  );
}
