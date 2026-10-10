import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, thCls, tdCls, btnPrimary } from "@/components/ui";
import { sampleStatusLabels, badgeClass } from "@/lib/labels";
import SampleForm from "@/components/SampleForm";

export default async function SamplesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role: string }).role;
  const canWrite = ["ADMIN", "OPERATOR", "PR_MANAGER"].includes(role);
  const canDelete = ["ADMIN", "PR_MANAGER"].includes(role);

  const list = await prisma.sampleShipment.findMany({
    where: {
      ...(searchParams.q
        ? {
            OR: [
              { productName: { contains: searchParams.q, mode: "insensitive" } },
              { trackingNo: { contains: searchParams.q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(searchParams.status ? { status: searchParams.status as never } : {}),
    },
    include: {
      influencer: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const influencers = await prisma.influencer.findMany({
    where: { status: "APPROVED" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="寄品管理"
        desc="维护寄给达人的样品信息：产品、数量、快递单号、状态"
        action={canWrite ? <SampleForm influencers={influencers} /> : undefined}
      />

      <form method="GET" className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          placeholder="按产品/快递单号搜索"
          defaultValue={searchParams.q ?? ""}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <select name="status" defaultValue={searchParams.status ?? ""} className="rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部状态</option>
          {Object.entries(sampleStatusLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button className={btnPrimary}>筛选</button>
      </form>

      <div className="overflow-x-auto bg-white rounded-2xl">
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>产品名称</th>
              <th className={thCls}>达人</th>
              <th className={thCls}>数量</th>
              <th className={thCls}>快递单号</th>
              <th className={thCls}>寄出日期</th>
              <th className={thCls}>状态</th>
              <th className={thCls}>记录人</th>
              {canWrite && <th className={thCls}>操作</th>}
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className={tdCls + " font-medium"}>{r.productName}</td>
                <td className={tdCls}>{r.influencer?.name ?? "-"}</td>
                <td className={tdCls}>{r.quantity}</td>
                <td className={tdCls}>{r.trackingNo ?? "-"}</td>
                <td className={tdCls}>{r.shippedDate ? r.shippedDate.toISOString().slice(0, 10) : "-"}</td>
                <td className={tdCls}>
                  <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(r.status)}`}>
                    {sampleStatusLabels[r.status]}
                  </span>
                </td>
                <td className={tdCls}>{r.createdBy?.name ?? "-"}</td>
                {canWrite && (
                  <td className={tdCls + " whitespace-nowrap"}>
                    <SampleForm
                      influencers={influencers}
                      editTarget={{
                        id: r.id,
                        influencerId: r.influencerId ?? "",
                        productName: r.productName,
                        quantity: r.quantity,
                        trackingNo: r.trackingNo ?? "",
                        shippedDate: r.shippedDate ? r.shippedDate.toISOString().slice(0, 10) : "",
                        status: r.status,
                      }}
                      canDelete={canDelete}
                    />
                  </td>
                )}
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-500">暂无数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
