import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, thCls, tdCls, btnPrimary } from "@/components/ui";
import { ticketStatusLabels, coopTypeLabels, badgeClass, formatMoney, formatDate, platformTagLabels } from "@/lib/labels";
import { APPROVAL_TIMEOUT_HOURS } from "@/lib/constants";
import Link from "next/link";
import TicketForm from "@/components/TicketForm";
import TicketBoard, { BoardTicket } from "@/components/TicketBoard";
import AutoRefresh from "@/components/AutoRefresh";

const VIEWS = [
  { key: "list", label: "列表" },
  { key: "board", label: "看板" },
] as const;

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; type?: string; view?: string };
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role: string }).role;
  const canWrite = ["ADMIN", "PR", "PR_MANAGER"].includes(role);
  const view = searchParams.view === "board" ? "board" : "list";

  const cutoff = new Date(Date.now() - APPROVAL_TIMEOUT_HOURS * 3600 * 1000);

  const influencers = await prisma.influencer.findMany({
    // PR 只能选择自己登记的达人发起工单
    where: { status: "APPROVED", ...(role === "PR" ? { registeredById: (session?.user as unknown as { id: string }).id } : {}) },
    select: { id: true, name: true, homepageId: true },
    orderBy: { name: "asc" },
  });
  const makeupArtists = await prisma.makeupArtist.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const viewTab = (key: string) =>
    `/tickets${key === "board" ? "?view=board" : ""}`;

  // 看板视图：全量工单，按状态分列
  if (view === "board") {
    const all = await prisma.cooperationTicket.findMany({
      include: {
        influencer: { select: { name: true } },
        makeupArtist: { select: { name: true } },
        creator: { select: { name: true } },
        subtasks: { select: { status: true } },
        paymentRequests: { select: { id: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });
    const boardTickets: BoardTicket[] = all.map((t) => ({
      id: t.id,
      ticketNo: t.ticketNo,
      title: t.title,
      type: t.type,
      status: t.status,
      budgetFee: String(t.budgetFee),
      influencer: t.influencer,
      makeupArtist: t.makeupArtist,
      creator: t.creator,
      overdue: t.status === "PENDING_APPROVAL" && t.updatedAt < cutoff,
      subtasks: t.subtasks.map((s) => ({ status: s.status })),
      paymentRequests: t.paymentRequests,
    }));
    return (
      <div>
        <PageHeader
          title="合作工单"
          desc="PR 发起合作 → 审批 → 进度管理 → 打款结算"
          action={canWrite ? <TicketForm influencers={influencers} makeupArtists={makeupArtists} /> : undefined}
        />
        <div className="mb-5 flex gap-1 border-b border-[#e5e5e5]">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={viewTab(v.key)}
              className={`tab-link -mb-px px-4 py-2.5 text-sm font-medium ${
                view === v.key
                  ? "border-b-2 border-[#0071e3] text-[#0071e3]"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {v.label}
            </Link>
          ))}
        </div>
        <TicketBoard tickets={boardTickets} role={role} />
      </div>
    );
  }

  // 列表视图
  const list = await prisma.cooperationTicket.findMany({
    where: {
      ...(searchParams.q
        ? {
            OR: [
              { title: { contains: searchParams.q, mode: "insensitive" } },
              { ticketNo: { contains: searchParams.q, mode: "insensitive" } },
            ],
          }
        : {}),
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

  return (
    <div>
      <AutoRefresh intervalMs={30000} />
      <PageHeader
        title="合作工单"
        desc="PR 发起合作 → 审批 → 进度管理 → 打款结算"
        action={canWrite ? <TicketForm influencers={influencers} makeupArtists={makeupArtists} /> : undefined}
      />

      <div className="mb-5 flex gap-1 border-b border-[#e5e5e5]">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={viewTab(v.key)}
            className={`tab-link -mb-px px-4 py-2.5 text-sm font-medium ${
              view === v.key
                ? "border-b-2 border-[#0071e3] text-[#0071e3]"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {v.label}
          </Link>
        ))}
      </div>

      <form method="GET" className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          placeholder="按标题/工单编号搜索"
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
        <button className={btnPrimary}>筛选</button>
      </form>

      <div className="overflow-x-auto bg-white rounded-2xl">
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>工单编号</th>
              <th className={thCls}>标题</th>
              <th className={thCls}>类型</th>
              <th className={thCls}>平台</th>
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
                  <td className={tdCls + " whitespace-nowrap font-mono text-xs"}>
                    <Link href={`/tickets/${t.id}`} className="text-[#0071e3] hover:underline">
                      {t.ticketNo}
                    </Link>
                  </td>
                  <td className={tdCls + " font-medium"}>
                    {t.title}
                    {overdue && (
                      <span className="ml-2 rounded bg-red-600 px-1.5 py-0.5 text-xs text-white">已超时</span>
                    )}
                  </td>
                  <td className={tdCls}>{coopTypeLabels[t.type]}</td>
                  <td className={tdCls}>{(t.platform as string[]).map((p) => platformTagLabels[p] ?? p).join("、") || "-"}</td>
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
              <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-500">暂无数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
