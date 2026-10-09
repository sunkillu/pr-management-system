import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, thCls, tdCls } from "@/components/ui";
import { ticketStatusLabels, coopTypeLabels, badgeClass, formatMoney, formatDate } from "@/lib/labels";
import { APPROVAL_TIMEOUT_HOURS } from "@/lib/constants";
import Link from "next/link";
import TicketForm from "@/components/TicketForm";

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; type?: string };
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role: string }).role;
  const canWrite = ["ADMIN", "OPERATOR", "PR_MANAGER"].includes(role);

  const list = await prisma.cooperationTicket.findMany({
    where: {
      ...(searchParams.q ? { title: { contains: searchParams.q, mode: "insensitive" } } : {}),
      ...(searchParams.status ? { status: searchParams.status as never } : {}),
      ...(searchParams.type ? { type: searchParams.type as never } : {}),
    },
    include: {
      influencer: { select: { name: true } },
      makeupArtist: { select: { name: true } },
      creator: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const influencers = await prisma.influencer.findMany({
    where: { status: "APPROVED" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const makeupArtists = await prisma.makeupArtist.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const cutoff = new Date(Date.now() - APPROVAL_TIMEOUT_HOURS * 3600 * 1000);

  return (
    <div>
      <PageHeader
        title="合作工单"
        desc="PR 发起合作 → 审批 → 进度管理 → 打款结算"
        action={canWrite ? <TicketForm influencers={influencers} makeupArtists={makeupArtists} /> : undefined}
      />

      <form method="GET" className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          placeholder="按标题搜索"
          defaultValue={searchParams.q ?? ""}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <select name="status" defaultValue={searchParams.status ?? ""} className="rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部状态</option>
          {Object.entries(ticketStatusLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="type" defaultValue={searchParams.type ?? ""} className="rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部类型</option>
          {Object.entries(coopTypeLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button className="rounded bg-gray-800 px-4 py-2 text-sm text-white">筛选</button>
      </form>

      <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>标题</th>
              <th className={thCls}>类型</th>
              <th className={thCls}>合作对象</th>
              <th className={thCls}>预算（元）</th>
              <th className={thCls}>档期</th>
              <th className={thCls}>状态</th>
              <th className={thCls}>发起人</th>
            </tr>
          </thead>
          <tbody>
            {list.map((t) => {
              const overdue = t.status === "PENDING_APPROVAL" && t.updatedAt < cutoff;
              return (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className={tdCls + " font-medium"}>
                    <Link href={`/tickets/${t.id}`} className="text-blue-600 hover:underline">
                      {t.title}
                    </Link>
                    {overdue && (
                      <span className="ml-2 rounded bg-red-600 px-1.5 py-0.5 text-xs text-white">已超时</span>
                    )}
                  </td>
                  <td className={tdCls}>{coopTypeLabels[t.type]}</td>
                  <td className={tdCls}>{t.influencer?.name ?? t.makeupArtist?.name ?? "-"}</td>
                  <td className={tdCls}>{formatMoney(t.budgetFee)}</td>
                  <td className={tdCls}>
                    {t.startDate ? formatDate(t.startDate) : "-"} ~ {t.endDate ? formatDate(t.endDate) : "-"}
                  </td>
                  <td className={tdCls}>
                    <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(t.status)}`}>
                      {ticketStatusLabels[t.status]}
                    </span>
                  </td>
                  <td className={tdCls}>{t.creator?.name ?? "-"}</td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">暂无数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
