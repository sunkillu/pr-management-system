import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, thCls, tdCls, btnPrimary } from "@/components/ui";
import {
  invoiceTypeLabels,
  invoiceStatusLabels,
  badgeClass,
  formatMoney,
  formatDate,
} from "@/lib/labels";
import InvoicesClient from "./InvoicesClient";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
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

  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: { paymentRequest: { select: { id: true, title: true } }, uploadedBy: true },
      orderBy: { updatedAt: "desc" },
    }),
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
        <input
          name="q"
          placeholder="按发票号码 / 开票方搜索"
          defaultValue={searchParams.q ?? ""}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <select name="status" defaultValue={searchParams.status ?? ""} className="rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部状态</option>
          {Object.entries(invoiceStatusLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button className={btnPrimary}>筛选</button>
      </form>

      <div className="overflow-x-auto bg-white rounded-2xl">
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>发票号码</th>
              <th className={thCls}>开票方</th>
              <th className={thCls}>金额（元）</th>
              <th className={thCls}>类型</th>
              <th className={thCls}>开票日期</th>
              <th className={thCls}>关联打款单</th>
              <th className={thCls}>文件</th>
              <th className={thCls}>状态</th>
              <th className={thCls}>上传人</th>
              <th className={thCls}>操作</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className={tdCls + " font-medium"}>{inv.invoiceNo}</td>
                <td className={tdCls}>{inv.issuer}</td>
                <td className={tdCls}>{formatMoney(inv.amount)}</td>
                <td className={tdCls}>{invoiceTypeLabels[inv.type]}</td>
                <td className={tdCls}>{formatDate(inv.issueDate)}</td>
                <td className={tdCls}>{inv.paymentRequest?.title ?? <span className="text-gray-400">-</span>}</td>
                <td className={tdCls}>
                  {inv.fileUrl ? (
                    <a href={inv.fileUrl} target="_blank" rel="noreferrer" className="text-[#0071e3] hover:underline">
                      查看
                    </a>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className={tdCls}>
                  <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(inv.status)}`}>
                    {invoiceStatusLabels[inv.status]}
                  </span>
                </td>
                <td className={tdCls}>{inv.uploadedBy.name}</td>
                <td className={tdCls + " whitespace-nowrap"}>
                  <InvoicesClient row={{ id: inv.id, status: inv.status }} role={role} canDelete={canDelete} />
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-sm text-gray-500">暂无数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
