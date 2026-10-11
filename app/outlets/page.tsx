import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, thCls, tdCls, btnPrimary } from "@/components/ui";
import { outletTypeLabels, platformLabels, outletStatusLabels, badgeClass, formatMoney } from "@/lib/labels";
import OutletsClient from "./OutletsClient";
import Pagination from "@/components/Pagination";
import { getPagination } from "@/lib/pagination";

export default async function OutletsPage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string; platform?: string; status?: string; page?: string };
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role: string }).role;
  const canWrite = role === "ADMIN" || role === "PR";

  const where: Record<string, unknown> = {};
  if (searchParams.q) where.name = { contains: searchParams.q, mode: "insensitive" };
  if (searchParams.type) where.type = searchParams.type;
  if (searchParams.platform) where.platform = searchParams.platform;
  if (searchParams.status) where.status = searchParams.status;

  const pagination = getPagination(searchParams.page);
  const [outlets, total] = await Promise.all([
    prisma.mediaOutlet.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.mediaOutlet.count({ where }),
  ]);

  return (
    <div>
      <PageHeader
        title="媒体资源库"
        desc="维护达人 / KOC / 媒体 / 机构资源，支持搜索与筛选"
        action={<OutletsClient canWrite={canWrite} />}
      />

      <form method="GET" className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          placeholder="按名称搜索"
          defaultValue={searchParams.q ?? ""}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <select name="type" defaultValue={searchParams.type ?? ""} className="rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部类型</option>
          {Object.entries(outletTypeLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="platform" defaultValue={searchParams.platform ?? ""} className="rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部平台</option>
          {Object.entries(platformLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="status" defaultValue={searchParams.status ?? ""} className="rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部状态</option>
          {Object.entries(outletStatusLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button className={btnPrimary}>筛选</button>
      </form>

      <div className="overflow-x-auto bg-white rounded-2xl">
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>名称</th>
              <th className={thCls}>类型</th>
              <th className={thCls}>平台</th>
              <th className={thCls}>粉丝量</th>
              <th className={thCls}>联系人</th>
              <th className={thCls}>报价（元）</th>
              <th className={thCls}>评分</th>
              <th className={thCls}>状态</th>
              {canWrite && <th className={thCls}>操作</th>}
            </tr>
          </thead>
          <tbody>
            {outlets.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className={tdCls + " font-medium"}>{o.name}</td>
                <td className={tdCls}>{outletTypeLabels[o.type]}</td>
                <td className={tdCls}>{platformLabels[o.platform]}</td>
                <td className={tdCls}>{o.followers.toLocaleString()}</td>
                <td className={tdCls}>{o.contactName ?? "-"}<div className="text-xs text-gray-500">{o.contactInfo ?? ""}</div></td>
                <td className={tdCls}>{o.priceQuote ? formatMoney(o.priceQuote) : "-"}</td>
                <td className={tdCls}>{o.rating ?? "-"}</td>
                <td className={tdCls}>
                  <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(o.status)}`}>
                    {outletStatusLabels[o.status]}
                  </span>
                </td>
                {canWrite && (
                  <td className={tdCls + " whitespace-nowrap"}>
                    <OutletsClient
                      canWrite={canWrite}
                      editTarget={{
                        id: o.id,
                        name: o.name,
                        type: o.type,
                        platform: o.platform,
                        followers: o.followers,
                        contactName: o.contactName ?? "",
                        contactInfo: o.contactInfo ?? "",
                        priceQuote: o.priceQuote ? String(o.priceQuote) : "",
                        rating: o.rating ? String(o.rating) : "",
                        notes: o.notes ?? "",
                        status: o.status,
                      }}
                      deleteId={o.id}
                    />
                  </td>
                )}
              </tr>
            ))}
            {outlets.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-500">暂无数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination pathname="/outlets" page={pagination.page} total={total} query={searchParams} />
    </div>
  );
}
