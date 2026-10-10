import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, thCls, tdCls } from "@/components/ui";
import { contentTypeLabels, contentStatusLabels, badgeClass, formatDate } from "@/lib/labels";
import ContentsClient from "./ContentsClient";

export default async function ContentsPage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string; status?: string };
}) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as unknown as { id: string; role: string };
  const role = sessionUser.role;
  const canWrite = role === "ADMIN" || role === "OPERATOR";

  const where: Record<string, unknown> = {};
  if (searchParams.q) where.title = { contains: searchParams.q, mode: "insensitive" };
  if (searchParams.type) where.type = searchParams.type;
  if (searchParams.status) where.status = searchParams.status;

  const [contents, outlets] = await Promise.all([
    prisma.content.findMany({
      where,
      include: { outlet: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.mediaOutlet.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="内容管理"
        desc="种草文、新闻稿等内容的版本管理与审批流：草稿 → 待审批 → 已通过 → 已发布"
        action={canWrite ? <ContentsClient outlets={outlets} /> : undefined}
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
          {Object.entries(contentTypeLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="status" defaultValue={searchParams.status ?? ""} className="rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部状态</option>
          {Object.entries(contentStatusLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button className="rounded bg-gray-800 px-4 py-2 text-sm text-white">筛选</button>
      </form>

      <div className="overflow-x-auto bg-white rounded-2xl">
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>标题</th>
              <th className={thCls}>类型</th>
              <th className={thCls}>关联资源</th>
              <th className={thCls}>版本</th>
              <th className={thCls}>状态</th>
              <th className={thCls}>更新时间</th>
              <th className={thCls}>操作</th>
            </tr>
          </thead>
          <tbody>
            {contents.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className={tdCls + " font-medium"}>
                  <Link href={`/contents/${c.id}`} className="text-[#0071e3] hover:underline">
                    {c.title}
                  </Link>
                </td>
                <td className={tdCls}>{contentTypeLabels[c.type]}</td>
                <td className={tdCls}>{c.outlet?.name ?? "-"}</td>
                <td className={tdCls}>v{c.version}</td>
                <td className={tdCls}>
                  <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(c.status)}`}>
                    {contentStatusLabels[c.status]}
                  </span>
                </td>
                <td className={tdCls}>{formatDate(c.updatedAt)}</td>
                <td className={tdCls + " whitespace-nowrap"}>
                  <ContentsClient
                    role={role}
                    outlets={outlets}
                    row={{
                      id: c.id,
                      status: c.status,
                      isOwner: !!c.createdById && c.createdById === sessionUser.id,
                      editTarget:
                        canWrite && (c.status === "DRAFT" || c.status === "REJECTED")
                          ? {
                              id: c.id,
                              title: c.title,
                              type: c.type,
                              body: c.body ?? "",
                              outletId: c.outletId ?? "",
                            }
                          : undefined,
                      deleteId: canWrite ? c.id : undefined,
                    }}
                  />
                </td>
              </tr>
            ))}
            {contents.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">暂无数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
