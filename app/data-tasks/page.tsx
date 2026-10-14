import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import DataTaskList, { DataTask } from "@/components/DataTaskList";

export default async function DataTasksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/data-tasks");
  const role = (session.user as { role?: string }).role ?? "";

  const tasks = await prisma.dataCollectionTask.findMany({
    include: {
      ticket: {
        select: { id: true, ticketNo: true, title: true, publishDate: true },
      },
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });
  const logs = tasks.length
    ? await prisma.approvalLog.findMany({
        where: { docType: "DATA_TASK", docId: { in: tasks.map((task) => task.id) } },
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const historyByTask = new Map<string, typeof logs>();
  for (const log of logs) {
    const history = historyByTask.get(log.docId) ?? [];
    history.push(log);
    historyByTask.set(log.docId, history);
  }

  const initial: DataTask[] = tasks.map((task) => ({
    id: task.id,
    ticketId: task.ticketId,
    platform: task.platform,
    publishLink: task.publishLink,
    metrics:
      task.metrics && typeof task.metrics === "object" && !Array.isArray(task.metrics)
        ? Object.fromEntries(
            Object.entries(task.metrics).filter((entry): entry is [string, number] => typeof entry[1] === "number")
          )
        : null,
    status: task.status,
    dueAt: task.dueAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt?.toISOString() ?? null,
    stateHistory: (historyByTask.get(task.id) ?? []).map((log) => ({
      id: log.id,
      action: log.action,
      actorName: log.actor?.name ?? log.actorLabel ?? "系统任务",
      createdAt: log.createdAt.toISOString(),
      note: log.note,
      fromStatus: log.fromStatus,
      toStatus: log.toStatus,
    })),
    ticket: {
      id: task.ticket.id,
      ticketNo: task.ticket.ticketNo,
      title: task.ticket.title,
      publishDate: task.ticket.publishDate?.toISOString() ?? null,
    },
  }));

  return (
    <div>
      <PageHeader
        title="数据回收"
        desc="跟踪已发布合作内容的数据采集状态与操作历史"
      />
      <DataTaskList initial={initial} canEdit={["ADMIN", "PR", "PR_MANAGER"].includes(role)} />
    </div>
  );
}
