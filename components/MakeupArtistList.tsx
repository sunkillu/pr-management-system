import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { thCls, tdCls, btnPrimary } from "@/components/ui";
import { badgeClass, formatFee } from "@/lib/labels";
import Link from "next/link";
import MakeupArtistForm from "@/components/MakeupArtistForm";
import Pagination from "@/components/Pagination";
import { getPagination } from "@/lib/pagination";
import { Prisma } from "@prisma/client";

export type MakeupArtistSearchParams = {
  q?: string;
  longTerm?: string;
  page?: string;
};

// 化妆师列表（查询+筛选+表格），用于 /partners 的"化妆师" tab
export default async function MakeupArtistList({
  searchParams,
}: {
  searchParams: MakeupArtistSearchParams;
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role: string }).role;
  const canWrite = ["ADMIN", "PR", "PR_MANAGER"].includes(role);
  const canDelete = ["ADMIN", "PR_MANAGER"].includes(role);

  const where: Prisma.MakeupArtistWhereInput = {
      ...(searchParams.q ? { name: { contains: searchParams.q, mode: "insensitive" } } : {}),
      ...(searchParams.longTerm === "1" ? { isLongTerm: true } : {}),
  };
  const pagination = getPagination(searchParams.page);
  const [list, total] = await Promise.all([
    prisma.makeupArtist.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.makeupArtist.count({ where }),
  ]);
  const ratings = list.length > 0
    ? await prisma.cooperationReview.groupBy({
        by: ["makeupArtistId"],
        where: { makeupArtistId: { in: list.map((artist) => artist.id) } },
        _avg: { rating: true },
      })
    : [];
  const ratingByArtist = new Map(ratings.map((rating) => [rating.makeupArtistId, rating._avg.rating]));

  return (
    <div>
      {canWrite && (
        <div className="mb-4 flex justify-end">
          <MakeupArtistForm />
        </div>
      )}

      <form method="GET" className="mb-4 flex flex-wrap gap-2">
        <input type="hidden" name="tab" value="makeup" />
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
        <button className={btnPrimary}>筛选</button>
      </form>

      <div className="overflow-x-auto bg-white rounded-2xl">
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>姓名</th>
              <th className={thCls}>联系方式</th>
              <th className={thCls}>长期合作</th>
              <th className={thCls}>入库日期</th>
              <th className={thCls}>合作次数</th>
              <th className={thCls}>累计费用</th>
              <th className={thCls}>平均评价</th>
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
                <td className={tdCls}>
                  {ratingByArtist.get(r.id) != null
                    ? <span className="text-yellow-600">★ {ratingByArtist.get(r.id)!.toFixed(1)}</span>
                    : "-"}
                </td>
                <td className={tdCls}>{r.notes ?? "-"}</td>
                {canWrite && (
                  <td className={tdCls + " whitespace-nowrap"}>
                    <Link
                      href={`/tickets/new?makeupArtistId=${r.id}`}
                      className="mr-2 rounded border border-[#0071e3] px-2.5 py-1 text-xs text-[#0071e3] hover:bg-blue-50"
                    >
                      发起工单
                    </Link>
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
              <tr><td colSpan={canWrite ? 9 : 8} className="px-3 py-8 text-center text-sm text-gray-500">暂无数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination pathname="/partners" page={pagination.page} total={total} query={{ ...searchParams, tab: "makeup" }} />
    </div>
  );
}
