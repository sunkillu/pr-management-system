import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, thCls, tdCls } from "@/components/ui";
import { coopTypeLabels, formatFee } from "@/lib/labels";
import CooperationForm from "@/components/CooperationForm";

export default async function CooperationsPage({
  searchParams,
}: {
  searchParams: { type?: string };
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role: string }).role;
  const canWrite = ["ADMIN", "OPERATOR", "PR_MANAGER"].includes(role);

  const list = await prisma.cooperationRecord.findMany({
    where: { ...(searchParams.type ? { type: searchParams.type as never } : {}) },
    include: {
      influencer: { select: { name: true } },
      makeupArtist: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { coopDate: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="合作记录"
        desc="新增合作后自动累计达人/化妆师的合作次数与累计费用"
        action={canWrite ? <CooperationForm /> : undefined}
      />

      <form method="GET" className="mb-4 flex flex-wrap gap-2">
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
              <th className={thCls}>合作日期</th>
              <th className={thCls}>类型</th>
              <th className={thCls}>合作对象</th>
              <th className={thCls}>费用</th>
              <th className={thCls}>备注</th>
              <th className={thCls}>记录人</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className={tdCls}>{r.coopDate.toISOString().slice(0, 10)}</td>
                <td className={tdCls}>{coopTypeLabels[r.type]}</td>
                <td className={tdCls + " font-medium"}>
                  {r.influencer?.name ?? r.makeupArtist?.name ?? "-"}
                </td>
                <td className={tdCls}>{formatFee(r.fee)}</td>
                <td className={tdCls}>{r.note ?? "-"}</td>
                <td className={tdCls}>{r.createdBy?.name ?? "-"}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-500">暂无数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
