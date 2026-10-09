import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, thCls, tdCls } from "@/components/ui";
import { badgeClass, formatFee } from "@/lib/labels";
import MakeupArtistForm from "@/components/MakeupArtistForm";

export default async function MakeupArtistsPage({
  searchParams,
}: {
  searchParams: { q?: string; longTerm?: string };
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role: string }).role;
  const canWrite = ["ADMIN", "OPERATOR", "PR_MANAGER"].includes(role);
  const canDelete = ["ADMIN", "PR_MANAGER"].includes(role);

  const list = await prisma.makeupArtist.findMany({
    where: {
      ...(searchParams.q ? { name: { contains: searchParams.q, mode: "insensitive" } } : {}),
      ...(searchParams.longTerm === "1" ? { isLongTerm: true } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="化妆师库"
        desc="长期合作的化妆师必须入库（入库日期必填）；合作次数与累计费用由合作记录自动累计"
        action={canWrite ? <MakeupArtistForm /> : undefined}
      />

      <form method="GET" className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          placeholder="按姓名搜索"
          defaultValue={searchParams.q ?? ""}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-1 rounded border border-gray-300 px-3 py-2 text-sm">
          <input type="checkbox" name="longTerm" value="1" defaultChecked={searchParams.longTerm === "1"} />
          仅长期合作
        </label>
        <button className="rounded bg-gray-800 px-4 py-2 text-sm text-white">筛选</button>
      </form>

      <div className="overflow-x-auto rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>姓名</th>
              <th className={thCls}>联系方式</th>
              <th className={thCls}>长期合作</th>
              <th className={thCls}>入库日期</th>
              <th className={thCls}>合作次数</th>
              <th className={thCls}>累计费用</th>
              <th className={thCls}>备注</th>
              {canWrite && <th className={thCls}>操作</th>}
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className={tdCls + " font-medium"}>{r.name}</td>
                <td className={tdCls}>{r.contactInfo ?? "-"}</td>
                <td className={tdCls}>
                  <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(r.isLongTerm ? "YES" : "NO")}`}>
                    {r.isLongTerm ? "是" : "否"}
                  </span>
                </td>
                <td className={tdCls}>{r.onboardDate ? r.onboardDate.toISOString().slice(0, 10) : "-"}</td>
                <td className={tdCls}>{r.coopCount}</td>
                <td className={tdCls}>{formatFee(r.totalFee)}</td>
                <td className={tdCls}>{r.notes ?? "-"}</td>
                {canWrite && (
                  <td className={tdCls + " whitespace-nowrap"}>
                    <MakeupArtistForm
                      editTarget={{
                        id: r.id,
                        name: r.name,
                        contactInfo: r.contactInfo ?? "",
                        isLongTerm: r.isLongTerm,
                        onboardDate: r.onboardDate ? r.onboardDate.toISOString().slice(0, 10) : "",
                        notes: r.notes ?? "",
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
