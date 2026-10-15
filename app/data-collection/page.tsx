import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import DataTaskList, { type DataTask } from "@/components/DataTaskList";

// 数据回收：发布 7 天后自动生成的回收任务，在此填写各平台指标。
// 读：全部角色；写（填写指标/标记待补）：ADMIN / PR / PR_MANAGER（API 侧同样校验）。
export default async function DataCollectionPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role: string }).role;
  const canEdit = ["ADMIN", "PR", "PR_MANAGER"].includes(role);

  const status = searchParams.status;
  const tasks = await prisma.dataCollectionTask.findMany({
    where: status && ["PENDING", "COLLECTED", "MISSING"].includes(status) ? { status: status as never } : {},
    include: {
      ticket: { select: { id: true, ticketNo: true, title: true, publishDate: true } },
    },
    orderBy: { dueAt: "asc" },
  });

  const initial: DataTask[] = tasks.map((t) => ({
    id: t.id,
    ticketId: t.ticketId,
    platform: t.platform,
    publishLink: t.publishLink,
    metrics: (t.metrics as Record<string, number> | null) ?? null,
    status: t.status,
    dueAt: t.dueAt ? t.dueAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    ticket: {
      id: t.ticket.id,
      ticketNo: t.ticket.ticketNo,
      title: t.ticket.title,
      publishDate: t.ticket.publishDate ? t.ticket.publishDate.toISOString() : null,
    },
  }));

  return (
    <div>
      <PageHeader title="数据回收" desc="发布后 7 天自动生成回收任务，填齐指标后自动置为已回收" />
      <DataTaskList initial={initial} canEdit={canEdit} />
    </div>
  );
}
