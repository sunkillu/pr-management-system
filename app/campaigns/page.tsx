import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, thCls, tdCls, btnPrimary } from "@/components/ui";
import { campaignStatusLabels, badgeClass, formatDate } from "@/lib/labels";
import CampaignsClient from "./CampaignsClient";

function toDateInput(d: Date | null): string {
  if (!d) return "";
  return d.toISOString().slice(0, 10);
}

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role: string }).role;
  const canWrite = role === "ADMIN" || role === "OPERATOR";

  const where: Record<string, unknown> = {};
  if (searchParams.status) where.status = searchParams.status;

  const [campaigns, contents, users] = await Promise.all([
    prisma.campaign.findMany({
      where,
      include: { owner: true, contents: { select: { id: true, title: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.content.findMany({
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "OPERATOR"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="项目排期"
        desc="大促、新品等传播项目的排期、负责人与进度跟踪"
        action={canWrite ? <CampaignsClient canWrite={canWrite} contents={contents} users={users} /> : undefined}
      />

      <form method="GET" className="mb-4 flex gap-2">
        <select name="status" defaultValue={searchParams.status ?? ""} className="rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部状态</option>
          {Object.entries(campaignStatusLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button className={btnPrimary}>筛选</button>
      </form>

      <div className="overflow-x-auto bg-white rounded-2xl">
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>项目名称</th>
              <th className={thCls}>时间</th>
              <th className={thCls}>负责人</th>
              <th className={thCls}>关联内容</th>
              <th className={thCls}>状态</th>
              <th className={thCls}>进度备注</th>
              {canWrite && <th className={thCls}>操作</th>}
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className={tdCls + " font-medium"}>{c.name}</td>
                <td className={tdCls + " whitespace-nowrap"}>
                  {formatDate(c.startDate)} ~ {formatDate(c.endDate)}
                </td>
                <td className={tdCls}>{c.owner?.name ?? "-"}</td>
                <td className={tdCls}>
                  {c.contents.length > 0 ? `${c.contents.length} 篇` : <span className="text-gray-400">-</span>}
                </td>
                <td className={tdCls}>
                  <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(c.status)}`}>
                    {campaignStatusLabels[c.status]}
                  </span>
                </td>
                <td className={tdCls + " max-w-xs truncate"} title={c.progressNotes ?? ""}>
                  {c.progressNotes ?? "-"}
                </td>
                {canWrite && (
                  <td className={tdCls + " whitespace-nowrap"}>
                    <CampaignsClient
                      canWrite={canWrite}
                      contents={contents}
                      users={users}
                      editTarget={{
                        id: c.id,
                        name: c.name,
                        description: c.description ?? "",
                        startDate: toDateInput(c.startDate),
                        endDate: toDateInput(c.endDate),
                        status: c.status,
                        progressNotes: c.progressNotes ?? "",
                        ownerId: c.ownerId ?? "",
                        contentIds: c.contents.map((x) => x.id),
                      }}
                      deleteId={c.id}
                    />
                  </td>
                )}
              </tr>
            ))}
            {campaigns.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">暂无数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
