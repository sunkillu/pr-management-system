import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/labels";
import { PLATFORM_TAG_OPTIONS, platformTagLabels } from "@/lib/labels";

// 平台数据汇总：按平台（小红书/抖音）汇总内容数、总花费、平均费用、达人数
// 数据来源：Content.platform / Content.cost（子内容）；达人数经工单关联去重
const selectCls =
  "h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function PlatformReportsPage({
  searchParams,
}: {
  searchParams: { platform?: string; from?: string; to?: string };
}) {
  const session = await getServerSession(authOptions);
  const me = session?.user as unknown as { id: string; role: string };
  const role = me?.role ?? "";
  if (!["ADMIN", "PR_MANAGER", "FINANCE"].includes(role)) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-lg font-medium">无权限</p>
          <p className="mt-2 text-sm text-muted-foreground">平台数据汇总仅管理员 / PR负责人 / 财务可查看。</p>
        </CardContent>
      </Card>
    );
  }

  const platformFilter = searchParams.platform || "";
  const from = searchParams.from || "";
  const to = searchParams.to || "";

  const where: Record<string, unknown> = { platform: { not: null } };
  if (platformFilter) where.platform = platformFilter;
  const createdAt: Record<string, Date> = {};
  if (from) {
    const d = new Date(from + "T00:00:00");
    if (!isNaN(d.getTime())) createdAt.gte = d;
  }
  if (to) {
    const d = new Date(to + "T23:59:59");
    if (!isNaN(d.getTime())) createdAt.lte = d;
  }
  if (Object.keys(createdAt).length > 0) where.createdAt = createdAt;

  const contents = await prisma.content.findMany({
    where,
    select: {
      id: true,
      platform: true,
      cost: true,
      ticketId: true,
      ticket: { select: { influencerId: true } },
    },
    take: 20000,
  });

  type Agg = { count: number; totalCost: number; costCount: number; influencers: Set<string> };
  const byPlatform = new Map<string, Agg>();
  for (const c of contents) {
    const p = c.platform as string;
    let a = byPlatform.get(p);
    if (!a) {
      a = { count: 0, totalCost: 0, costCount: 0, influencers: new Set() };
      byPlatform.set(p, a);
    }
    a.count++;
    if (c.cost != null) {
      a.totalCost += Number(c.cost);
      a.costCount++;
    }
    if (c.ticket?.influencerId) a.influencers.add(c.ticket.influencerId);
  }

  const rows = Array.from(byPlatform.entries()).map(([p, a]) => ({
    platform: p,
    label: platformTagLabels[p] ?? p,
    count: a.count,
    totalCost: a.totalCost,
    avgCost: a.costCount > 0 ? a.totalCost / a.costCount : 0,
    influencerCount: a.influencers.size,
  }));

  const totalCount = rows.reduce((s, r) => s + r.count, 0);
  const totalCost = rows.reduce((s, r) => s + r.totalCost, 0);

  const query = new URLSearchParams();
  if (platformFilter) query.set("platform", platformFilter);
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  const qs = query.toString();

  return (
    <div>
      <PageHeader
        title="平台数据汇总"
        desc={`按平台汇总子内容数据：内容数 ${totalCount} · 总花费 ¥${formatMoney(totalCost)}`}
        action={
          <Button asChild>
            <a href={`/api/admin/export?type=contents${qs ? `&${qs}` : ""}`}>
              导出明细
            </a>
          </Button>
        }
      />

      <form method="GET" className="mb-4 flex flex-wrap items-center gap-2">
        <select
          name="platform"
          defaultValue={platformFilter}
          className={selectCls}
        >
          <option value="">全部平台</option>
          {PLATFORM_TAG_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <Input
          type="date"
          name="from"
          defaultValue={from}
          className="w-auto"
        />
        <span className="text-sm text-muted-foreground">至</span>
        <Input
          type="date"
          name="to"
          defaultValue={to}
          className="w-auto"
        />
        <Button type="submit">筛选</Button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>平台</TableHead>
              <TableHead className="tabular-nums">内容数</TableHead>
              <TableHead className="tabular-nums">总花费（元）</TableHead>
              <TableHead className="tabular-nums">平均费用（元）</TableHead>
              <TableHead className="tabular-nums">合作达人数</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.platform}>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell className="tabular-nums">{r.count}</TableCell>
                <TableCell className="tabular-nums">¥{formatMoney(r.totalCost)}</TableCell>
                <TableCell className="tabular-nums">¥{formatMoney(r.avgCost)}</TableCell>
                <TableCell className="tabular-nums">{r.influencerCount}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  暂无数据（子内容需填写平台后才会统计）
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        说明：统计口径为工单下的子内容（Content.platform / cost）；平均费用按有花费的子内容计算。
      </p>
    </div>
  );
}
