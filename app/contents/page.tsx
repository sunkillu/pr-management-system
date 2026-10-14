import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { contentTypeLabels, contentStatusLabels, badgeClass } from "@/lib/labels";
import ContentsClient from "./ContentsClient";
import Pagination from "@/components/Pagination";
import { getPagination } from "@/lib/pagination";
import RecordTimestamps from "@/components/RecordTimestamps";

const selectCls =
  "flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export default async function ContentsPage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string; status?: string; page?: string };
}) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as unknown as { id: string; role: string };
  const role = sessionUser.role;
  const canWrite = role === "ADMIN" || role === "PR";

  const where: Record<string, unknown> = {};
  if (searchParams.q) where.title = { contains: searchParams.q, mode: "insensitive" };
  if (searchParams.type) where.type = searchParams.type;
  if (searchParams.status) where.status = searchParams.status;

  const pagination = getPagination(searchParams.page);
  const [contents, total, outlets] = await Promise.all([
    prisma.content.findMany({
      where,
      include: { outlet: true },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.content.count({ where }),
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
        <Input name="q" placeholder="按标题搜索" defaultValue={searchParams.q ?? ""} className="w-48" />
        <select name="type" defaultValue={searchParams.type ?? ""} className={selectCls}>
          <option value="">全部类型</option>
          {Object.entries(contentTypeLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="status" defaultValue={searchParams.status ?? ""} className={selectCls}>
          <option value="">全部状态</option>
          {Object.entries(contentStatusLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <Button type="submit">筛选</Button>
      </form>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>标题</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>关联资源</TableHead>
              <TableHead>版本</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>记录时间</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contents.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <Link href={`/contents/${c.id}`} className="text-primary hover:underline">
                    {c.title}
                  </Link>
                </TableCell>
                <TableCell>{contentTypeLabels[c.type]}</TableCell>
                <TableCell>{c.outlet?.name ?? "-"}</TableCell>
                <TableCell>v{c.version}</TableCell>
                <TableCell>
                  <Badge className={badgeClass(c.status)}>
                    {contentStatusLabels[c.status]}
                  </Badge>
                </TableCell>
                <TableCell><RecordTimestamps createdAt={c.createdAt} updatedAt={c.updatedAt} compact /></TableCell>
                <TableCell className="whitespace-nowrap">
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
                </TableCell>
              </TableRow>
            ))}
            {contents.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  暂无数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      <Pagination pathname="/contents" page={pagination.page} total={total} query={searchParams} />
    </div>
  );
}
