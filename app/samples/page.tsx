import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, thCls, tdCls, btnPrimary } from "@/components/ui";
import { sampleStatusLabels, badgeClass } from "@/lib/labels";
import SampleForm from "@/components/SampleForm";
import SampleShipForm from "@/components/SampleShipForm";
import SampleActions from "@/components/SampleActions";
import AutoRefresh from "@/components/AutoRefresh";

export default async function SamplesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const session = await getServerSession(authOptions);
  const me = session?.user as unknown as { id: string; role: string };
  const role = me.role;
  const canWrite = ["ADMIN", "PR", "PR_MANAGER"].includes(role);
  const canDelete = ["ADMIN", "PR_MANAGER"].includes(role);
  // 仓库维护寄件信息；ADMIN / PR_MANAGER 兜底
  const canShip = ["ADMIN", "PR_MANAGER", "WAREHOUSE"].includes(role);

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
      createdBy: { select: { id: true, name: true } },
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
      <AutoRefresh intervalMs={30000} />
      <PageHeader
        title="寄品管理"
        desc="寄件请求：PR提交 → 仓库接单备货 → 寄出 → 确认签收 → 核销"
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
              <th className={thCls}>收件人</th>
              <th className={thCls}>数量</th>
              <th className={thCls}>快递公司</th>
              <th className={thCls}>快递单号</th>
              <th className={thCls}>状态</th>
              <th className={thCls}>记录人</th>
              <th className={thCls}>流转操作</th>
              {(canWrite || canShip) && <th className={thCls}>维护</th>}
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className={tdCls + " font-medium"}>{r.productName}</td>
                <td className={tdCls}>{r.influencer?.name ?? "-"}</td>
                <td className={tdCls}>{r.receiverName ?? "-"}</td>
                <td className={tdCls}>{r.quantity}</td>
                <td className={tdCls}>{r.courier ?? "-"}</td>
                <td className={tdCls}>{r.trackingNo ?? "-"}</td>
                <td className={tdCls}>
                  <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(r.status)}`}>
                    {sampleStatusLabels[r.status]}
                  </span>
                </td>
                <td className={tdCls}>{r.createdBy?.name ?? "-"}</td>
                <td className={tdCls + " whitespace-nowrap"}>
                  <SampleActions
                    sample={{ id: r.id, productName: r.productName, status: r.status, infoConfirmed: r.infoConfirmed, createdById: r.createdBy.id }}
                    role={role}
                    userId={me.id}
                  />
                </td>
                {(canWrite || canShip) && (
                  <td className={tdCls + " whitespace-nowrap"}>
                    <div className="flex flex-wrap gap-2">
                      {canWrite && (
                        <SampleForm
                          influencers={influencers}
                          editTarget={{
                            id: r.id,
                            influencerId: r.influencerId ?? "",
                            productName: r.productName,
                            quantity: r.quantity,
                            courier: r.courier ?? "",
                            trackingNo: r.trackingNo ?? "",
                            shippedDate: r.shippedDate ? r.shippedDate.toISOString().slice(0, 10) : "",
                            shippedBy: r.shippedBy ?? "",
                            status: r.status,
                          }}
                          canDelete={canDelete}
                        />
                      )}
                      {canShip && (
                        <SampleShipForm
                          sample={{
                            id: r.id,
                            courier: r.courier,
                            trackingNo: r.trackingNo,
                            shippedDate: r.shippedDate ? r.shippedDate.toISOString().slice(0, 10) : null,
                            shippedBy: r.shippedBy,
                            status: r.status,
                          }}
                        />
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={(canWrite || canShip) ? 10 : 9} className="px-3 py-8 text-center text-sm text-gray-500">暂无数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
