import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { btnPrimary } from "@/components/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import StatusBadge from "@/components/StatusBadge";
import { formatFee } from "@/lib/labels";
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
          className="rounded border border-input px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-1 rounded border border-input px-3 py-2 text-sm">
          <input type="checkbox" name="longTerm" value="1" defaultChecked={searchParams.longTerm === "1"} />
          仅长期合作
        </label>
        <button className={btnPrimary}>筛选</button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead>
              <TableHead>联系方式</TableHead>
              <TableHead>长期合作</TableHead>
              <TableHead>入库日期</TableHead>
              <TableHead>合作次数</TableHead>
              <TableHead>累计费用</TableHead>
              <TableHead>平均评价</TableHead>
              <TableHead>备注</TableHead>
              {canWrite && <TableHead>操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.contactInfo ?? "-"}</TableCell>
                <TableCell>
                  <StatusBadge status={r.isLongTerm ? "APPROVED" : "TODO"} label={r.isLongTerm ? "是" : "否"} />
                </TableCell>
                <TableCell>{r.onboardDate ? r.onboardDate.toISOString().slice(0, 10) : "-"}</TableCell>
                <TableCell>{r.coopCount}</TableCell>
                <TableCell>{formatFee(r.totalFee)}</TableCell>
                <TableCell>
                  {ratingByArtist.get(r.id) != null
                    ? <span className="text-yellow-600">★ {ratingByArtist.get(r.id)!.toFixed(1)}</span>
                    : "-"}
                </TableCell>
                <TableCell>{r.notes ?? "-"}</TableCell>
                {canWrite && (
                  <TableCell className="whitespace-nowrap">
                    <Link
                      href={`/tickets/new?makeupArtistId=${r.id}`}
                      className="mr-2 rounded border border-primary px-2.5 py-1 text-xs text-primary hover:bg-primary/10"
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
                  </TableCell>
                )}
              </TableRow>
            ))}
            {list.length === 0 && (
              <TableRow><TableCell colSpan={canWrite ? 9 : 8} className="py-8 text-center text-sm text-muted-foreground">暂无数据</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination pathname="/partners" page={pagination.page} total={total} query={{ ...searchParams, tab: "makeup" }} />
    </div>
  );
}
