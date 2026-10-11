import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, Section, InfoRow } from "@/components/ui";
import {
  paymentStatusLabels,
  badgeClass,
  invoiceStatusLabels,
  invoiceTypeLabels,
  formatMoney,
  formatDate,
  formatDateTime,
} from "@/lib/labels";
import { getLinksWithCounterparts } from "@/lib/approval-links";
import ApprovalTimeline, { TimelineItem } from "@/components/ApprovalTimeline";
import ApprovalLinks from "@/components/ApprovalLinks";
import { PaymentVoucherSection, PaymentRemindButton } from "@/components/PaymentVouchers";
import PaymentsClient from "../PaymentsClient";

export default async function PaymentDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as unknown as { id: string; role: string };
  const role = sessionUser.role;
  const canSubmit = role === "ADMIN" || role === "PR";
  const canUploadVoucher = ["ADMIN", "PR", "FINANCE"].includes(role);

  const payment = await prisma.paymentRequest.findUnique({
    where: { id: params.id },
    include: {
      outlet: true,
      campaign: true,
      content: true,
      requester: true,
      invoices: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } },
      _count: { select: { vouchers: true } },
    },
  });
  if (!payment) notFound();

  const logs = await prisma.approvalLog.findMany({
    where: { docType: "PAYMENT", docId: payment.id },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
  });

  const links = await getLinksWithCounterparts("PAYMENT", payment.id);
  const isRequester = payment.requesterId === sessionUser.id;
  const canEditLinks = role !== "VIEWER";

  const [outlets, campaigns, contents] = await Promise.all([
    prisma.mediaOutlet.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.campaign.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.content.findMany({ select: { id: true, title: true }, orderBy: { updatedAt: "desc" }, take: 200 }),
  ]);

  const timeline: TimelineItem[] = logs.map((l) => ({
    id: l.id,
    action: l.action,
    actorName: l.actor.name,
    createdAt: l.createdAt,
    note: l.note,
    fromStatusLabel: l.fromStatus ? paymentStatusLabels[l.fromStatus] ?? l.fromStatus : null,
    toStatusLabel: l.toStatus ? paymentStatusLabels[l.toStatus] ?? l.toStatus : null,
  }));

  const info: [string, React.ReactNode][] = [
    ["金额", `${formatMoney(payment.amount)} 元`],
    ["收款方", payment.payeeName],
    ["收款账号", payment.payeeAccount ?? "-"],
    ["关联资源", payment.outlet?.name ?? "-"],
    ["关联项目", payment.campaign?.name ?? "-"],
    ["关联内容", payment.content?.title ?? "-"],
    ["申请人", `${payment.requester.name}（${payment.requester.email}）`],
    ["申请时间", formatDateTime(payment.createdAt)],
  ];

  return (
    <div>
      <PageHeader
        title={payment.title}
        desc="打款申请详情"
        action={
          <Link href="/payments" className="text-sm text-[#0071e3] hover:underline">
            ← 返回列表
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="bg-white rounded-2xl p-6 lg:col-span-2 h-fit">
          <div className="mb-4">
            <span className={`rounded px-2 py-1 text-sm ${badgeClass(payment.status)}`}>
              {paymentStatusLabels[payment.status]}
            </span>
          </div>
          <dl>
            {info.map(([k, v]) => (
              <InfoRow key={k} label={k}><span className="font-medium">{v}</span></InfoRow>
            ))}
          </dl>
          {payment.reason && (
            <div className="mt-4 text-sm">
              <div className="text-gray-500">申请事由</div>
              <div className="mt-1 whitespace-pre-wrap">{payment.reason}</div>
            </div>
          )}
          {payment.status === "REJECTED" && payment.rejectReason && (
            <div className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">
              驳回理由：{payment.rejectReason}
            </div>
          )}
          {payment.status === "VOIDED" && payment.voidReason && (
            <div className="mt-4 rounded bg-gray-100 p-3 text-sm text-gray-600">
              作废理由：{payment.voidReason}
            </div>
          )}
          <div className="mt-5 border-t pt-4" id="approval-section">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {["PENDING_BIZ", "PENDING_FIN"].includes(payment.status) &&
                isRequester && (
                  <PaymentRemindButton paymentId={payment.id} />
                )}
            </div>
            <PaymentsClient
              role={role}
              outlets={outlets}
              campaigns={campaigns}
              contents={contents}
              editTarget={
                canSubmit && (payment.status === "PENDING_BIZ" || payment.status === "REJECTED")
                  ? {
                      id: payment.id,
                      title: payment.title,
                      amount: String(payment.amount),
                      payeeName: payment.payeeName,
                      payeeAccount: payment.payeeAccount ?? "",
                      reason: payment.reason ?? "",
                      outletId: payment.outletId ?? "",
                      campaignId: payment.campaignId ?? "",
                      contentId: payment.contentId ?? "",
                    }
                  : undefined
              }
              actionTarget={{ id: payment.id, status: payment.status, isRequester, voucherCount: payment._count.vouchers }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl h-fit [&>section:first-child]:border-t-0">
          <Section title="操作历史">
            <ApprovalTimeline items={timeline} />
          </Section>

          <Section>
            <ApprovalLinks
              docType="PAYMENT"
              docId={payment.id}
              initialLinks={links.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() }))}
              canEdit={canEditLinks}
            />
          </Section>

          <Section title="打款凭证">
            <PaymentVoucherSection paymentId={payment.id} canUpload={canUploadVoucher} />
          </Section>

          <Section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">关联发票（选填）</h3>
              <Link href="/invoices" className="text-sm text-[#0071e3] hover:underline">
                去上传
              </Link>
            </div>
            {payment.invoices.length === 0 ? (
              <p className="text-sm text-gray-400">暂无关联发票（发票为选填，不影响打款流程）</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {payment.invoices.map((inv) => (
                  <li key={inv.id} className="rounded border border-gray-200 p-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{inv.invoiceNo}</span>
                      <span className={`rounded px-1.5 py-0.5 text-xs ${badgeClass(inv.status)}`}>
                        {invoiceStatusLabels[inv.status]}
                      </span>
                    </div>
                    <div className="text-gray-500">
                      {inv.issuer} · {invoiceTypeLabels[inv.type]} · {formatMoney(inv.amount)} 元 ·
                      开票 {formatDate(inv.issueDate)}
                    </div>
                    {inv.fileUrl && (
                      <a href={inv.fileUrl} target="_blank" rel="noreferrer" className="text-[#0071e3] hover:underline">
                        查看发票文件
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
