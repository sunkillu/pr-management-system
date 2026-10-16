import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatMoney,
  paymentStatusLabels,
  badgeClass,
  influencerTypeLabels,
  ticketStatusLabels,
} from "@/lib/labels";
import DashboardFilters from "@/components/DashboardFilters";

type Role = "ADMIN" | "OPERATOR" | "FINANCE" | "VIEWER" | "PR_MANAGER" | "PR" | "WAREHOUSE";

// 工单状态卡片（合作工单 6 个核心状态 + 采买待审批）
const STATUS_CARDS = [
  { status: "PENDING_APPROVAL", label: "待审批" },
  { status: "IN_PROGRESS", label: "执行中" },
  { status: "PENDING_REVIEW", label: "待返稿" },
  { status: "PUBLISHED", label: "已发布" },
  { status: "SETTLING", label: "结算中" },
  { status: "FOLLOW_UP", label: "跟进中" },
  { status: "PENDING_PROCUREMENT", label: "待采买审批" },
] as const;

const PUBLISHED_STATUSES = ["PUBLISHED", "SETTLING", "FOLLOW_UP", "SETTLED"] as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { brandId?: string; influencerType?: string; platform?: string };
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as { id: string; role: Role } | undefined;
  const role = user?.role ?? "VIEWER";
  const userId = user?.id ?? "";

  const brandId = searchParams.brandId || undefined;
  const influencerType = searchParams.influencerType || undefined;
  const platform = searchParams.platform || undefined;
  const hasFilter = !!(brandId || influencerType || platform);

  // 三维度筛选透传到工单查询
  const ticketWhere = {
    ...(brandId ? { brandId } : {}),
    ...(platform ? { platform: { has: platform } } : {}),
    ...(influencerType
      ? { influencer: { influencerType: influencerType as "KOL" | "KOC" | "AMATEUR" | "MAKEUP_ARTIST" } }
      : {}),
  };

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);

  const [
    brands,
    outletCount,
    pendingContents,
    gmvAgg,
    bizPending,
    bizPendingSum,
    finPending,
    finPendingSum,
    paidSum,
    invoicePending,
    statusGroups,
    sampleStatusGroups,
    trendTickets,
    brandGroups,
    brandPublishedGroups,
    influencerGroups,
  ] = await Promise.all([
    prisma.brand.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.mediaOutlet.count(),
    prisma.content.count({ where: { status: "PENDING" } }),
    prisma.report.aggregate({ _sum: { gmv: true } }),
    prisma.paymentRequest.count({ where: { status: "PENDING_BIZ", ...(brandId ? { brandId } : {}) } }),
    prisma.paymentRequest.aggregate({
      where: { status: "PENDING_BIZ", ...(brandId ? { brandId } : {}) },
      _sum: { amount: true },
    }),
    prisma.paymentRequest.count({ where: { status: "PENDING_FIN", ...(brandId ? { brandId } : {}) } }),
    prisma.paymentRequest.aggregate({
      where: { status: "PENDING_FIN", ...(brandId ? { brandId } : {}) },
      _sum: { amount: true },
    }),
    prisma.paymentRequest.aggregate({
      where: { status: "PAID", ...(brandId ? { brandId } : {}) },
      _sum: { amount: true },
    }),
    prisma.invoice.count({ where: { status: "PENDING" } }),
    // 工单状态分布（合作工单 + 采买待审批）
    prisma.cooperationTicket.groupBy({
      by: ["status"],
      where: ticketWhere,
      _count: true,
    }),
    // 寄品状态分布（仓库视图；品牌筛选适用，平台/达人类型不适用）
    prisma.sampleShipment.groupBy({
      by: ["status"],
      where: { ...(brandId ? { brandId } : {}) },
      _count: true,
    }),
    // 趋势：近 6 个月新建工单
    prisma.cooperationTicket.findMany({
      where: { ...ticketWhere, createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true, publishDate: true, actualFee: true, status: true },
    }),
    // 品牌统计
    prisma.cooperationTicket.groupBy({
      by: ["brandId"],
      where: ticketWhere,
      _count: true,
      _sum: { actualFee: true },
    }),
    prisma.cooperationTicket.groupBy({
      by: ["brandId"],
      where: { ...ticketWhere, status: { in: [...PUBLISHED_STATUSES] } },
      _count: true,
    }),
    // 达人排行 TOP 10
    prisma.cooperationTicket.groupBy({
      by: ["influencerId"],
      where: { ...ticketWhere, influencerId: { not: null } },
      _count: true,
      _sum: { actualFee: true },
      orderBy: { _count: { influencerId: "desc" } },
      take: 10,
    }),
  ]);

  // ---- 趋势：按月聚合（工单数 / 发布量 / 花费按发布月） ----
  const monthKeys: string[] = [];
  const monthLabels: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(`${d.getFullYear()}-${d.getMonth()}`);
    monthLabels.push(`${d.getMonth() + 1}月`);
  }
  const trend = monthKeys.map((key, idx) => ({ key, label: monthLabels[idx], count: 0, published: 0, spend: 0 }));
  const trendByKey = new Map(trend.map((t) => [t.key, t]));
  for (const t of trendTickets) {
    const createdKey = `${t.createdAt.getFullYear()}-${t.createdAt.getMonth()}`;
    const bucket = trendByKey.get(createdKey);
    if (bucket) bucket.count += 1;
    if (t.publishDate) {
      const pubKey = `${t.publishDate.getFullYear()}-${t.publishDate.getMonth()}`;
      const pubBucket = trendByKey.get(pubKey);
      if (pubBucket) {
        pubBucket.published += 1;
        pubBucket.spend += Number(t.actualFee ?? 0);
      }
    }
  }
  const maxCount = Math.max(1, ...trend.map((t) => t.count));
  const maxPublished = Math.max(1, ...trend.map((t) => t.published));
  const maxSpend = Math.max(1, ...trend.map((t) => t.spend));

  // ---- 品牌统计：合并工单数 / 发布量 / 花费 ----
  const brandNameMap = new Map(brands.map((b) => [b.id, b.name]));
  const publishedByBrand = new Map(brandPublishedGroups.map((g) => [g.brandId, g._count]));
  const brandStats = brandGroups
    .map((g) => ({
      brandId: g.brandId,
      name: brandNameMap.get(g.brandId ?? "") ?? "未知品牌",
      count: g._count,
      published: publishedByBrand.get(g.brandId) ?? 0,
      spend: Number(g._sum.actualFee ?? 0),
    }))
    .sort((a, b) => b.count - a.count);

  // ---- 达人排行：补名字和类型 ----
  const influencerIds = influencerGroups.map((g) => g.influencerId as string).filter(Boolean);
  const influencers = influencerIds.length
    ? await prisma.influencer.findMany({
        where: { id: { in: influencerIds } },
        select: { id: true, name: true, influencerType: true },
      })
    : [];
  const infMap = new Map(influencers.map((i) => [i.id, i]));
  const influencerRanking = influencerGroups.map((g, idx) => {
    const inf = infMap.get(g.influencerId as string);
    return {
      rank: idx + 1,
      name: inf?.name ?? "未知达人",
      type: inf?.influencerType ? influencerTypeLabels[inf.influencerType] ?? inf.influencerType : "-",
      count: g._count,
      spend: Number(g._sum.actualFee ?? 0),
    };
  });

  // ---- 工单状态卡片 ----
  const statusCountMap = new Map(statusGroups.map((g) => [g.status, g._count]));
  const sampleStatusMap = new Map(sampleStatusGroups.map((g) => [g.status, g._count]));

  // ---- 我的待办（按角色） ----
  const todoGroups: { title: string; items: { label: string; href: string; meta?: string }[] }[] = [];
  if (role === "ADMIN" || role === "PR_MANAGER") {
    const pendingTickets = await prisma.cooperationTicket.findMany({
      where: { ...ticketWhere, status: { in: ["PENDING_APPROVAL", "PENDING_PROCUREMENT"] } },
      select: { id: true, title: true, status: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 5,
    });
    todoGroups.push({
      title: "待我审批的工单",
      items: pendingTickets.map((t) => ({
        label: t.title,
        href: `/tickets/${t.id}`,
        meta: ticketStatusLabels[t.status] ?? t.status,
      })),
    });
  }
  if (role === "PR") {
    const [myDoing, mySamples, myFollowups] = await Promise.all([
      prisma.cooperationTicket.findMany({
        where: { ...ticketWhere, assigneeId: userId, status: "IN_PROGRESS" },
        select: { id: true, title: true },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
      prisma.sampleShipment.findMany({
        where: { createdById: userId, infoConfirmed: false, status: "PENDING" },
        select: { id: true, productName: true, sampleNo: true },
        orderBy: { createdAt: "asc" },
        take: 5,
      }),
      prisma.cooperationTicket.findMany({
        where: { ...ticketWhere, assigneeId: userId, status: "FOLLOW_UP" },
        select: { id: true, title: true },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
    ]);
    todoGroups.push(
      { title: "我归属的执行中工单", items: myDoing.map((t) => ({ label: t.title, href: `/tickets/${t.id}` })) },
      {
        title: "待我确认的寄品",
        items: mySamples.map((s) => ({ label: `${s.productName}（${s.sampleNo ?? "-"}）`, href: `/samples` })),
      },
      { title: "待跟进工单", items: myFollowups.map((t) => ({ label: t.title, href: `/tickets/${t.id}` })) },
    );
  }
  if (role === "FINANCE") {
    const pendingInvoices = await prisma.invoice.findMany({
      where: { status: "PENDING" },
      select: { id: true, invoiceNo: true, amount: true },
      orderBy: { createdAt: "asc" },
      take: 5,
    });
    todoGroups.push({
      title: "待核验发票",
      items: pendingInvoices.map((i) => ({
        label: `发票 ${i.invoiceNo ?? "-"}`,
        href: "/invoices",
        meta: formatMoney(i.amount),
      })),
    });
  }
  if (role === "WAREHOUSE") {
    const [toShip, shippedUnreceived] = await Promise.all([
      prisma.sampleShipment.findMany({
        where: { status: "PENDING", infoConfirmed: true, ...(brandId ? { brandId } : {}) },
        select: { id: true, productName: true, sampleNo: true },
        orderBy: { createdAt: "asc" },
        take: 5,
      }),
      prisma.sampleShipment.findMany({
        where: { status: "SHIPPED", ...(brandId ? { brandId } : {}) },
        select: { id: true, productName: true, sampleNo: true, shippedAt: true },
        orderBy: { shippedAt: "asc" },
        take: 5,
      }),
    ]);
    todoGroups.push(
      {
        title: "待寄出寄品",
        items: toShip.map((s) => ({ label: `${s.productName}（${s.sampleNo ?? "-"}）`, href: "/samples" })),
      },
      {
        title: "已寄出未签收",
        items: shippedUnreceived.map((s) => ({ label: `${s.productName}（${s.sampleNo ?? "-"}）`, href: "/samples" })),
      },
    );
  }
  if (role === "OPERATOR") {
    const pendingProc = await prisma.cooperationTicket.findMany({
      where: { ...ticketWhere, ticketKind: "PROCUREMENT", status: "PENDING_PROCUREMENT" },
      select: { id: true, title: true },
      orderBy: { createdAt: "asc" },
      take: 5,
    });
    todoGroups.push({
      title: "待处理的采买需求",
      items: pendingProc.map((t) => ({ label: t.title, href: `/tickets/${t.id}` })),
    });
  }

  // ---- 预警区 ----
  const [overdueTickets, logisticsShipped, logisticsPending, procurementTimeout, publish3dReminders] = await Promise.all([
    prisma.cooperationTicket.findMany({
      where: {
        ...ticketWhere,
        confirmedDate: { lt: todayStart },
        status: { in: ["IN_PROGRESS", "MATERIAL_REVIEW", "PENDING_REVIEW", "REVIEWED"] },
      },
      select: { id: true, title: true, confirmedDate: true },
      orderBy: { confirmedDate: "asc" },
      take: 5,
    }),
    prisma.sampleShipment.findMany({
      where: { status: "SHIPPED", shippedAt: { lt: sevenDaysAgo }, ...(brandId ? { brandId } : {}) },
      select: { id: true, productName: true, sampleNo: true, shippedAt: true },
      orderBy: { shippedAt: "asc" },
      take: 5,
    }),
    prisma.sampleShipment.findMany({
      where: { status: "PENDING", infoConfirmed: true, createdAt: { lt: oneDayAgo }, ...(brandId ? { brandId } : {}) },
      select: { id: true, productName: true, sampleNo: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 5,
    }),
    prisma.cooperationTicket.findMany({
      where: {
        ...ticketWhere,
        ticketKind: "PROCUREMENT",
        status: { in: ["PENDING_PROCUREMENT", "APPROVED"] },
        procurementApprovedAt: { lt: twelveHoursAgo },
        assigneeId: null,
      },
      select: { id: true, title: true, procurementApprovedAt: true },
      orderBy: { procurementApprovedAt: "asc" },
      take: 5,
    }),
    prisma.reminderTask.findMany({
      where: { type: "PUBLISH_3D", status: "PENDING" },
      include: { ticket: { select: { id: true, title: true } } },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
  ]);
  const overdueCount = overdueTickets.length;
  const logisticsCount = logisticsShipped.length + logisticsPending.length;
  const procurementTimeoutCount = procurementTimeout.length;
  const publish3dCount = publish3dReminders.length;
  const totalAlerts = overdueCount + logisticsCount + procurementTimeoutCount + publish3dCount;

  // ---- 打款待办队列（ADMIN / 财务，沿用原有逻辑） ----
  const queueStatus = role === "FINANCE" ? "PENDING_FIN" : role === "ADMIN" ? "PENDING_BIZ" : null;
  const queue = queueStatus
    ? await prisma.paymentRequest.findMany({
        where: { status: queueStatus as "PENDING_BIZ" | "PENDING_FIN", ...(brandId ? { brandId } : {}) },
        include: { requester: true, outlet: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      })
    : [];

  const stats = [
    { label: "媒体资源数", value: String(outletCount), href: "/partners?tab=outlet" },
    { label: "待审批内容", value: String(pendingContents), href: "/contents?status=PENDING" },
    { label: "累计 GMV（元）", value: formatMoney(gmvAgg._sum.gmv), href: "/reports" },
  ];

  const payStats = [
    {
      label: "待业务审批",
      value: `${bizPending} 笔 · ${formatMoney(bizPendingSum._sum.amount)} 元`,
      href: "/payments?status=PENDING_BIZ",
      highlight: role === "ADMIN",
    },
    {
      label: "待财务审批",
      value: `${finPending} 笔 · ${formatMoney(finPendingSum._sum.amount)} 元`,
      href: "/payments?status=PENDING_FIN",
      highlight: role === "FINANCE",
    },
    {
      label: "已打款总额（元）",
      value: formatMoney(paidSum._sum.amount),
      href: "/payments?status=PAID",
      highlight: false,
    },
    {
      label: "待核验发票",
      value: `${invoicePending} 张`,
      href: "/invoices?status=PENDING",
      highlight: role === "FINANCE",
    },
  ];

  return (
    <div>
      <PageHeader title="数据驾驶舱" desc="业务数据一览，点击卡片进入对应模块" />

      {/* 三维度筛选：品牌 / 达人类型 / 平台，联动全部数据 */}
      <DashboardFilters brands={brands} current={{ brandId, influencerType, platform }} />

      {/* ============ 一、数据驾驶舱（主体） ============ */}
      <h2 className="mb-3 text-lg font-semibold">📊 数据驾驶舱</h2>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-colors hover:bg-accent">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{s.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* 趋势：近 6 个月 */}
      <Card className="mt-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">近 6 个月趋势</CardTitle>
          <p className="text-xs text-muted-foreground">花费按发布月统计（实际费用合计）；筛选条件已应用</p>
        </CardHeader>
        <CardContent>
          <div className="flex h-44 items-end justify-around gap-2">
            {trend.map((t) => (
              <div key={t.key} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-32 w-full items-end justify-center gap-1">
                  <div className="flex h-full w-5 flex-col justify-end" title={`合作工单 ${t.count}`}>
                    <span className="mb-1 text-center text-[10px] font-medium text-[#7C3AED]">{t.count}</span>
                    <div className="rounded-t bg-[#7C3AED]" style={{ height: `${(t.count / maxCount) * 100}%` }} />
                  </div>
                  <div className="flex h-full w-5 flex-col justify-end" title={`发布量 ${t.published}`}>
                    <span className="mb-1 text-center text-[10px] font-medium text-emerald-600">{t.published}</span>
                    <div className="rounded-t bg-emerald-500" style={{ height: `${(t.published / maxPublished) * 100}%` }} />
                  </div>
                  <div className="flex h-full w-5 flex-col justify-end" title={`花费 ${formatMoney(t.spend)}`}>
                    <span className="mb-1 text-center text-[10px] font-medium text-amber-600">
                      {t.spend >= 10000 ? `${(t.spend / 10000).toFixed(1)}w` : t.spend}
                    </span>
                    <div className="rounded-t bg-amber-500" style={{ height: `${(t.spend / maxSpend) * 100}%` }} />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{t.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-center gap-5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-[#7C3AED]" />合作工单数</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-emerald-500" />发布量</span>
            <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm bg-amber-500" />花费（元）</span>
          </div>
        </CardContent>
      </Card>

      {/* 品牌统计 + 达人排行 */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">品牌维度统计</CardTitle>
          </CardHeader>
          <CardContent>
            {brandStats.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无数据</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>品牌</TableHead>
                    <TableHead>工单数</TableHead>
                    <TableHead>发布量</TableHead>
                    <TableHead>花费（元）</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brandStats.map((b) => (
                    <TableRow key={b.brandId}>
                      <TableCell>
                        <Link href={`/tickets?brandId=${b.brandId}`} className="text-primary hover:underline">
                          {b.name}
                        </Link>
                      </TableCell>
                      <TableCell>{b.count}</TableCell>
                      <TableCell>{b.published}</TableCell>
                      <TableCell>{formatMoney(b.spend)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">达人合作排行 TOP 10</CardTitle>
          </CardHeader>
          <CardContent>
            {influencerRanking.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无数据</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>排名</TableHead>
                    <TableHead>达人</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>合作次数</TableHead>
                    <TableHead>花费（元）</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {influencerRanking.map((r) => (
                    <TableRow key={r.rank}>
                      <TableCell>{r.rank}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.type}</TableCell>
                      <TableCell>{r.count}</TableCell>
                      <TableCell>{formatMoney(r.spend)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============ 二、业务驾驶舱（次要区块） ============ */}
      <h2 className="mb-3 mt-8 text-lg font-semibold">🧭 业务驾驶舱</h2>

      {/* 工单状态卡片 / 仓库看寄品状态 */}
      {role === "WAREHOUSE" ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {(
            [
              { status: "PENDING", label: "待处理寄品" },
              { status: "SHIPPED", label: "已寄出" },
              { status: "SIGNED", label: "已签收" },
              { status: "WRITTEN_OFF", label: "已核销" },
            ] as const
          ).map((s) => (
            <Link key={s.status} href="/samples">
              <Card className="transition-colors hover:bg-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{sampleStatusMap.get(s.status) ?? 0}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STATUS_CARDS.map((s) => (
            <Link key={s.status} href={`/tickets?status=${s.status}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{statusCountMap.get(s.status) ?? 0}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* 我的待办 + 预警区 */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">我的待办</CardTitle>
          </CardHeader>
          <CardContent>
            {todoGroups.length === 0 || todoGroups.every((g) => g.items.length === 0) ? (
              <p className="text-sm text-muted-foreground">暂无待办</p>
            ) : (
              todoGroups
                .filter((g) => g.items.length > 0)
                .map((g) => (
                  <div key={g.title} className="mb-4 last:mb-0">
                    <p className="mb-1 text-sm font-medium">
                      {g.title}（{g.items.length}）
                    </p>
                    <ul className="space-y-1">
                      {g.items.map((item, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 text-sm">
                          <Link href={item.href} className="truncate text-primary hover:underline">
                            {item.label}
                          </Link>
                          {item.meta && <span className="shrink-0 text-xs text-muted-foreground">{item.meta}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              预警区
              {totalAlerts > 0 ? <Badge className="bg-red-100 text-red-700">{totalAlerts} 条预警</Badge> : <Badge>暂无预警</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalAlerts === 0 ? (
              <p className="text-sm text-muted-foreground">暂无逾期 / 物流 / 采买超时 / 发布提醒</p>
            ) : (
              <div className="space-y-4">
                {overdueCount > 0 && (
                  <div>
                    <p className="mb-1 text-sm font-medium text-red-600">逾期工单（{overdueCount}）</p>
                    <ul className="space-y-1">
                      {overdueTickets.map((t) => (
                        <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                          <Link href={`/tickets/${t.id}`} className="truncate text-primary hover:underline">
                            {t.title}
                          </Link>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            档期 {t.confirmedDate ? new Date(t.confirmedDate).toLocaleDateString() : "-"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {logisticsCount > 0 && (
                  <div>
                    <p className="mb-1 text-sm font-medium text-red-600">
                      物流预警（{logisticsCount}：7 天未签收 {logisticsShipped.length} / T+1 未处理 {logisticsPending.length}）
                    </p>
                    <ul className="space-y-1">
                      {logisticsShipped.map((s) => (
                        <li key={s.id} className="text-sm">
                          <Link href="/samples" className="text-primary hover:underline">
                            {s.productName}（{s.sampleNo ?? "-"}）
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {" "}· 7 天未签收
                          </span>
                        </li>
                      ))}
                      {logisticsPending.map((s) => (
                        <li key={s.id} className="text-sm">
                          <Link href="/samples" className="text-primary hover:underline">
                            {s.productName}（{s.sampleNo ?? "-"}）
                          </Link>
                          <span className="text-xs text-muted-foreground"> · T+1 未处理</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {procurementTimeoutCount > 0 && (
                  <div>
                    <p className="mb-1 text-sm font-medium text-red-600">采买超时 12h 无人接单（{procurementTimeoutCount}）</p>
                    <ul className="space-y-1">
                      {procurementTimeout.map((t) => (
                        <li key={t.id} className="text-sm">
                          <Link href={`/tickets/${t.id}`} className="text-primary hover:underline">
                            {t.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {publish3dCount > 0 && (
                  <div>
                    <p className="mb-1 text-sm font-medium text-amber-600">发布前 3 天提醒（{publish3dCount}）</p>
                    <ul className="space-y-1">
                      {publish3dReminders.map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                          <Link href={`/tickets/${r.ticket.id}`} className="truncate text-primary hover:underline">
                            {r.ticket.title}
                          </Link>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {new Date(r.scheduledAt).toLocaleDateString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============ 三、打款与发票（沿用原有） ============ */}
      <h2 className="mb-3 mt-8 text-lg font-semibold">打款与发票</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {payStats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-colors hover:bg-accent">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  {s.label}
                  {s.highlight && <Badge>待您处理</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{s.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {queue.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">
            待您审批的打款（{paymentStatusLabels[queueStatus as string]}）
          </h2>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>标题</TableHead>
                  <TableHead>金额（元）</TableHead>
                  <TableHead>收款方</TableHead>
                  <TableHead>申请人</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/payments/${p.id}`} className="text-primary hover:underline">
                        {p.title}
                      </Link>
                    </TableCell>
                    <TableCell>{formatMoney(p.amount)}</TableCell>
                    <TableCell>{p.payeeName}</TableCell>
                    <TableCell>{p.requester.name}</TableCell>
                    <TableCell>
                      <Badge className={badgeClass(p.status)}>{paymentStatusLabels[p.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[
          { href: "/partners?tab=outlet", t: "媒体资源库", d: "维护达人 / KOC / 媒体 / 机构资源" },
          { href: "/contents", t: "内容管理", d: "种草文、新闻稿的版本与审批流" },
          { href: "/payments", t: "打款审批", d: "两阶段审批：业务 → 财务 → 打款" },
          { href: "/invoices", t: "发票管理", d: "发票上传、关联打款单、财务核验" },
          { href: "/reports", t: "效果报表", d: "曝光、转化、GMV 汇总与导出" },
        ].map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className="transition-colors hover:bg-accent">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{c.t}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{c.d}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      {hasFilter && (
        <p className="mt-4 text-xs text-muted-foreground">
          已应用筛选：{brandId ? `品牌=${brandNameMap.get(brandId) ?? brandId} ` : ""}
          {influencerType ? `达人类型=${influencerTypeLabels[influencerType] ?? influencerType} ` : ""}
          {platform ? `平台=${platform === "XIAOHONGSHU" ? "小红书" : platform === "DOUYIN" ? "抖音" : platform}` : ""}
          （打款卡片仅应用品牌筛选；寄品/发票不受三维度筛选影响）
        </p>
      )}
    </div>
  );
}
