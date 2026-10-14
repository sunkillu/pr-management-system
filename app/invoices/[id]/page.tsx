import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, InfoRow, Section } from "@/components/ui";
import {
  invoiceStatusLabels,
  invoiceTypeLabels,
  formatDate,
  formatDateTime,
  formatMoney,
} from "@/lib/labels";
import ApprovalTimeline, { TimelineItem } from "@/components/ApprovalTimeline";
import RecordTimestamps from "@/components/RecordTimestamps";

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) notFound();

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      uploadedBy: { select: { name: true } },
      paymentRequest: { select: { id: true, title: true } },
    },
  });
  if (!invoice) notFound();

  const logs = await prisma.approvalLog.findMany({
    where: { docType: "INVOICE", docId: invoice.id },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const timeline: TimelineItem[] = logs.map((log) => ({
    id: log.id,
    action: log.action,
    actorName: log.actor?.name ?? log.actorLabel ?? "系统任务",
    createdAt: log.createdAt,
    note: log.note,
    fromStatusLabel: log.fromStatus ? invoiceStatusLabels[log.fromStatus] ?? log.fromStatus : null,
    toStatusLabel: log.toStatus ? invoiceStatusLabels[log.toStatus] ?? log.toStatus : null,
  }));

  return (
    <div>
      <PageHeader
        title={invoice.invoiceNo}
        desc={`${invoice.issuer} · ${invoiceStatusLabels[invoice.status] ?? invoice.status}`}
        action={<Link href="/invoices" className="text-sm text-primary hover:underline">← 返回发票管理</Link>}
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-lg bg-card p-6 lg:col-span-2">
          <div className="mb-4 border-b pb-3">
            <RecordTimestamps createdAt={invoice.createdAt} updatedAt={invoice.updatedAt} />
          </div>
          <Section title="发票信息">
            <dl>
              <InfoRow label="发票号码">{invoice.invoiceNo}</InfoRow>
              <InfoRow label="开票方">{invoice.issuer}</InfoRow>
              <InfoRow label="金额">{formatMoney(invoice.amount)} 元</InfoRow>
              <InfoRow label="发票类型">{invoiceTypeLabels[invoice.type]}</InfoRow>
              <InfoRow label="开票日期">{formatDate(invoice.issueDate)}</InfoRow>
              <InfoRow label="状态">{invoiceStatusLabels[invoice.status] ?? invoice.status}</InfoRow>
              <InfoRow label="关联打款单">
                {invoice.paymentRequest ? (
                  <Link href={`/payments/${invoice.paymentRequest.id}`} className="text-primary hover:underline">
                    {invoice.paymentRequest.title}
                  </Link>
                ) : "-"}
              </InfoRow>
              <InfoRow label="上传人">{invoice.uploadedBy.name}</InfoRow>
              <InfoRow label="上传时间">{formatDateTime(invoice.createdAt)}</InfoRow>
              {invoice.note && <InfoRow label="备注">{invoice.note}</InfoRow>}
            </dl>
            {invoice.fileUrl && (
              <a href={invoice.fileUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-primary hover:underline">
                查看发票文件
              </a>
            )}
          </Section>
        </div>
        <div className="rounded-lg bg-card [&>section:first-child]:border-t-0">
          <Section title="操作历史">
            <ApprovalTimeline items={timeline} />
          </Section>
        </div>
      </div>
    </div>
  );
}
