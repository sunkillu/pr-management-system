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
import { formatMoney, paymentStatusLabels, badgeClass } from "@/lib/labels";

type Role = "ADMIN" | "OPERATOR" | "FINANCE" | "VIEWER" | "PR_MANAGER" | "PR";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role: Role }).role;

  const [
    outletCount,
    pendingContents,
    gmvAgg,
    bizPending,
    bizPendingSum,
    finPending,
    finPendingSum,
    paidSum,
    invoicePending,
  ] = await Promise.all([
    prisma.mediaOutlet.count(),
    prisma.content.count({ where: { status: "PENDING" } }),
    prisma.report.aggregate({ _sum: { gmv: true } }),
    prisma.paymentRequest.count({ where: { status: "PENDING_BIZ" } }),
    prisma.paymentRequest.aggregate({
      where: { status: "PENDING_BIZ" },
      _sum: { amount: true },
    }),
    prisma.paymentRequest.count({ where: { status: "PENDING_FIN" } }),
    prisma.paymentRequest.aggregate({
      where: { status: "PENDING_FIN" },
      _sum: { amount: true },
    }),
    prisma.paymentRequest.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
    prisma.invoice.count({ where: { status: "PENDING" } }),
  ]);

  // 按角色展示待办队列
  const queueStatus = role === "FINANCE" ? "PENDING_FIN" : role === "ADMIN" ? "PENDING_BIZ" : null;
  const queue = queueStatus
    ? await prisma.paymentRequest.findMany({
        where: { status: queueStatus as "PENDING_BIZ" | "PENDING_FIN" },
        include: { requester: true, outlet: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      })
    : [];

  const stats = [
    { label: "媒体资源数", value: String(outletCount), href: "/partners?tab=outlet" },
    { label: "待审批内容", value: String(pendingContents), href: "/contents?status=PENDING" },
    {
      label: "累计 GMV（元）",
      value: formatMoney(gmvAgg._sum.gmv),
      href: "/reports",
    },
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
      <PageHeader title="首页仪表盘" desc="核心数据一览，点击卡片进入对应模块" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-colors hover:bg-accent">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{s.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

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
    </div>
  );
}
