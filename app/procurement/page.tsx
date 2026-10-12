import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { PageHeader, thCls, tdCls, btnPrimary } from "@/components/ui";
import {
  procurementTypeLabels,
  procurementStatusLabels,
  badgeClass,
} from "@/lib/labels";
import Link from "next/link";
import ProcurementForm from "@/components/ProcurementForm";
import Pagination from "@/components/Pagination";
import { getPagination } from "@/lib/pagination";

export default async function ProcurementPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; type?: string; page?: string; mine?: string };
}) {
  const session = await getServerSession(authOptions);
  const me = session?.user as unknown as { id: string; role: string };
  const role = me.role;
  const canCreate = ["ADMIN", "OPERATOR"].includes(role);

  const where: Prisma.ProcurementRequestWhereInput = {
    ...(searchParams.q ? { title: { contains: searchParams.q, mode: "insensitive" } } : {}),
    ...(searchParams.status ? { status: searchParams.status as never } : {}),
    ...(searchParams.type ? { type: searchParams.type as never } : {}),
    ...(role === "OPERATOR" ? { createdById: me.id } : {}),
    ...(role === "PR" ? { tasks: { some: { assigneeId: me.id } } } : {}),
  };
  const pagination = getPagination(searchParams.page);
  const [list, total] = await Promise.all([
    prisma.procurementRequest.findMany({
      where,
      include: {
        createdBy: { select: { name: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.procurementRequest.count({ where }),
  ]);

  return (
    <div>
      <PageHeader
        title="采买需求"
        desc="运营提采买需求 → 管理员分发给PR → PR接单执行 → 按达人授权状态分流"
        action={canCreate ? <ProcurementForm /> : undefined}
      />

      <form method="GET" className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          placeholder="按标题搜索"
          defaultValue={searchParams.q ?? ""}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <select name="type" defaultValue={searchParams.type ?? ""} className="rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部类型</option>
          {Object.entries(procurementTypeLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="status" defaultValue={searchParams.status ?? ""} className="rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部状态</option>
          {Object.entries(procurementStatusLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button className={btnPrimary}>筛选</button>
      </form>

      <div className="overflow-x-auto rounded-2xl bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className={thCls}>标题</th>
              <th className={thCls}>类型</th>
              <th className={thCls}>款式/数量</th>
              <th className={thCls}>状态</th>
              <th className={thCls}>任务数</th>
              <th className={thCls}>提交人</th>
              <th className={thCls}>更新时间</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className={tdCls}>
                  <Link href={`/procurement/${r.id}`} className="text-[#0071e3] hover:underline">{r.title}</Link>
                </td>
                <td className={tdCls}>{procurementTypeLabels[r.type]}</td>
                <td className={tdCls}>
                  {r.type === "WEEKLY_STYLE" ? `${r.styles.join("、")} × ${r.quantity}` : `${r.publishLinks.length} 条链接`}
                </td>
                <td className={tdCls}><span className={badgeClass(r.status)}>{procurementStatusLabels[r.status]}</span></td>
                <td className={tdCls}>{r._count.tasks}</td>
                <td className={tdCls}>{r.createdBy.name}</td>
                <td className={tdCls}>{new Date(r.updatedAt).toLocaleString("zh-CN", { hour12: false })}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">暂无采买需求</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination pathname="/procurement" page={pagination.page} total={total} query={searchParams} />
    </div>
  );
}
