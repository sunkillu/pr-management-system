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
import StatusBadge from "@/components/StatusBadge";
import {
  invoiceTypeLabels,
  invoiceStatusLabels,
  formatMoney,
  formatDate,
} from "@/lib/labels";
import InvoicesClient from "./InvoicesClient";
import Pagination from "@/components/Pagination";
import { getPagination } from "@/lib/pagination";
import RecordTimestamps from "@/components/RecordTimestamps";
import Link from "next/link";

const selectCls =
  "h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string };
}) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role: string }).role;
  const canUpload = role === "ADMIN" || role === "PR";
  const canDelete = role === "ADMIN";

  const where: Record<string, unknown> = {};
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.q) {
    where.OR = [
      { invoiceNo: { contains: searchParams.q, mode: "insensitive" } },
      { issuer: { contains: searchParams.q, mode: "insensitive" } },
    ];
  }

  const pagination = getPagination(searchParams.page);
  const [invoices, total, payments] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { paymentRequest: { select: { id: true, title: true } }, uploadedBy: true },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.invoice.count({ where }),
    prisma.paymentRequest.findMany({
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="发票管理"
        desc="发票上传、关联打款单、财务核验。发票为选填，不阻塞打款流程。"
        action={canUpload ? <InvoicesClient payments={payments} /> : undefined}
      />

      <form method="GET" className="mb-4 flex flex-wrap gap-2">
        <Input
          name="q"
          placeholder="按发票号码 / 开票方搜索"
          defaultValue={searchParams.q ?? ""}
          className="w-64"
        />
        <select name="status" defaultValue={searchParams.status ?? ""} className={selectCls}>
          <option value="">全部状态</option>
          {Object.entries(invoiceStatusLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <Button type="submit">筛选</Button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>发票号码</TableHead>
              <TableHead>开票方</TableHead>
              <TableHead className="tabular-nums">金额（元）</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>开票日期</TableHead>
              <TableHead>关联打款单</TableHead>
              <TableHead>文件</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>上传人</TableHead>
              <TableHead>记录时间</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">
                  <Link href={`/invoices/${inv.id}`} className="text-primary hover:underline">{inv.invoiceNo}</Link>
                </TableCell>
                <TableCell>{inv.issuer}</TableCell>
                <TableCell className="tabular-nums">{formatMoney(inv.amount)}</TableCell>
                <TableCell>{invoiceTypeLabels[inv.type]}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(inv.issueDate)}</TableCell>
                <TableCell>{inv.paymentRequest?.title ?? <span className="text-muted-foreground">-</span>}</TableCell>
                <TableCell>
                  {inv.fileUrl ? (
                    <a href={inv.fileUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      查看
                    </a>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={inv.status} label={invoiceStatusLabels[inv.status]} />
                </TableCell>
                <TableCell>{inv.uploadedBy.name}</TableCell>
                <TableCell><RecordTimestamps createdAt={inv.createdAt} updatedAt={inv.updatedAt} compact /></TableCell>
                <TableCell className="whitespace-nowrap">
                  <InvoicesClient row={{ id: inv.id, status: inv.status }} role={role} canDelete={canDelete} />
                </TableCell>
              </TableRow>
            ))}
            {invoices.length === 0 && (
              <TableRow><TableCell colSpan={11} className="py-8 text-center text-sm text-muted-foreground">暂无数据</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination pathname="/invoices" page={pagination.page} total={total} query={searchParams} />
    </div>
  );
}
