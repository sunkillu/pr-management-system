import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/ui";
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
import StatusBadge from "@/components/StatusBadge";
import {
  coopRequestStatusLabels,
  influencerTypeLabels,
  INFLUENCER_TYPE_OPTIONS,
  platformTagLabels,
  PLATFORM_TAG_OPTIONS,
} from "@/lib/labels";
import Link from "next/link";
import CoopRequestForm from "@/components/CoopRequestForm";
import Pagination from "@/components/Pagination";
import { getPagination } from "@/lib/pagination";
import RecordTimestamps from "@/components/RecordTimestamps";

const selectCls =
  "h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function CoopRequestsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; type?: string; platform?: string; page?: string };
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role: string }).role;
  const canWrite = ["ADMIN", "PR", "PR_MANAGER"].includes(role);

  const where: Prisma.CooperationRequestWhereInput = {
      ...(searchParams.q ? { title: { contains: searchParams.q, mode: "insensitive" } } : {}),
      ...(searchParams.status ? { status: searchParams.status as never } : {}),
      ...(searchParams.type ? { influencerType: searchParams.type as never } : {}),
      ...(searchParams.platform ? { platforms: { has: searchParams.platform } } : {}),
  };
  const pagination = getPagination(searchParams.page);
  const [list, total] = await Promise.all([
    prisma.cooperationRequest.findMany({
      where,
      include: { submitter: { select: { name: true } } },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.cooperationRequest.count({ where }),
  ]);

  return (
    <div>
      <PageHeader
        title="合作需求"
        desc="提出合作需求 → 多选管理员审批 → 或签审批 → 通过后可一键加入达人库"
        action={canWrite ? <CoopRequestForm /> : undefined}
      />

      <form method="GET" className="mb-4 flex flex-wrap gap-2">
        <Input
          name="q"
          placeholder="按标题搜索"
          defaultValue={searchParams.q ?? ""}
          className="w-64"
        />
        <select name="type" defaultValue={searchParams.type ?? ""} className={selectCls}>
          <option value="">全部达人类型</option>
          {INFLUENCER_TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select name="platform" defaultValue={searchParams.platform ?? ""} className={selectCls}>
          <option value="">全部平台</option>
          {PLATFORM_TAG_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <select name="status" defaultValue={searchParams.status ?? ""} className={selectCls}>
          <option value="">全部状态</option>
          {Object.entries(coopRequestStatusLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <Button type="submit">筛选</Button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>标题</TableHead>
              <TableHead>达人类型</TableHead>
              <TableHead>平台</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>提交人</TableHead>
              <TableHead>记录时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  <Link href={`/coop-requests/${r.id}`} className="text-primary hover:underline">
                    {r.title}
                  </Link>
                </TableCell>
                <TableCell>{r.influencerType ? influencerTypeLabels[r.influencerType] ?? r.influencerType : "-"}</TableCell>
                <TableCell>
                  {r.platforms.length > 0
                    ? r.platforms.map((p) => platformTagLabels[p] ?? p).join("、")
                    : "-"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.status} label={coopRequestStatusLabels[r.status]} />
                </TableCell>
                <TableCell>{r.submitter?.name ?? "-"}</TableCell>
                <TableCell><RecordTimestamps createdAt={r.createdAt} updatedAt={r.updatedAt} compact /></TableCell>
              </TableRow>
            ))}
            {list.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">暂无数据</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination pathname="/coop-requests" page={pagination.page} total={total} query={searchParams} />
    </div>
  );
}
