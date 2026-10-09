import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, thCls, tdCls } from "@/components/ui";
import { coopRequestStatusLabels, badgeClass } from "@/lib/labels";
import Link from "next/link";
import CoopRequestForm from "@/components/CoopRequestForm";

export default async function CoopRequestsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role: string }).role;
  const canWrite = ["ADMIN", "OPERATOR", "PR_MANAGER"].includes(role);

  const list = await prisma.cooperationRequest.findMany({
    where: {
      ...(searchParams.q ? { title: { contains: searchParams.q, mode: "insensitive" } } : {}),
      ...(searchParams.status ? { status: searchParams.status as never } : {}),
    },
    include: { submitter: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="合作需求"
        desc="提出合作需求 → 多选审批人 → 飞书通知审批人 → 或签审批"
        action={canWrite ? <CoopRequestForm /> : undefined}
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
          {Object.entries(coopRequestStatusLabels).map(([k, v]) => (
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
              <th className={thCls}>需求类型</th>
              <th className={thCls}>状态</th>
              <th className={thCls}>提交人</th>
              <th className={thCls}>更新时间</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className={tdCls + " font-medium"}>
                  <Link href={`/coop-requests/${r.id}`} className="text-blue-600 hover:underline">
                    {r.title}
                  </Link>
                </td>
                <td className={tdCls}>{r.reqType}</td>
                <td className={tdCls}>
                  <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(r.status)}`}>
                    {coopRequestStatusLabels[r.status]}
                  </span>
                </td>
                <td className={tdCls}>{r.submitter?.name ?? "-"}</td>
                <td className={tdCls}>{r.updatedAt.toISOString().slice(0, 16).replace("T", " ")}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-500">暂无数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
