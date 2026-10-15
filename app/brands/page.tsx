import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BrandsClient from "@/components/BrandsClient";

export default async function BrandsPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") redirect("/");
  const brands = await prisma.brand.findMany({ orderBy: { name: "asc" } });
  const logs = brands.length
    ? await prisma.approvalLog.findMany({
        where: { docType: "BRAND", docId: { in: brands.map((brand) => brand.id) } },
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const historyByBrand = new Map<string, typeof logs>();
  for (const log of logs) {
    const history = historyByBrand.get(log.docId) ?? [];
    history.push(log);
    historyByBrand.set(log.docId, history);
  }
  const initialBrands = brands.map((brand) => ({
    id: brand.id,
    name: brand.name,
    isActive: brand.isActive,
    createdAt: brand.createdAt.toISOString(),
    updatedAt: null,
    history: (historyByBrand.get(brand.id) ?? []).map((log) => ({
      id: log.id,
      action: log.action,
      actorName: log.actor?.name ?? "系统任务",
      createdAt: log.createdAt.toISOString(),
      note: log.note,
      fromStatusLabel: log.fromStatus,
      toStatusLabel: log.toStatus,
    })),
  }));
  return <BrandsClient initialBrands={initialBrands} />;
}
