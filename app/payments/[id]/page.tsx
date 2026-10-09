import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import {
  paymentStatusLabels,
  badgeClass,
  approvalStageLabels,
  approvalActionLabels,
  invoiceStatusLabels,
  invoiceTypeLabels,
  formatMoney,
  formatDate,
  formatDateTime,
} from "@/lib/labels";
import PaymentsClient from "../PaymentsClient";

export default async function PaymentDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as unknown as { role: string }).role;
  const canSubmit = role === "ADMIN" || role === "OPERATOR";

  const payment = await prisma.paymentRequest.findUnique({
    where: { id: params.id },
    include: {
      outlet: true,
      campaign: true,
      content: true,
      requester: true,
      approvalRecords: { include: { approver: true }, orderBy: { createdAt: "asc" } },
      invoices: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!payment) notFound();

  const [outlets, campaigns, contents] = await Promise.all([
    prisma.mediaOutlet.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.campaign.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.content.findMany({ select: { id: true, title: true }, orderBy: { updatedAt: "desc" }, take: 200 }),
  ]);

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
          <Link href="/payments" className="text-sm text-blue-600 hover:underline">
            ← 返回列表
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200 lg:col-span-2">
          <div className="mb-4">
            <span className={`rounded px-2 py-1 text-sm ${badgeClass(payment.status)}`}>
              {paymentStatusLabels[payment.status]}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {info.map(([k, v]) => (
              <div key={k}>
                <dt className="text-gray-500">{k}</dt>
                <dd className="mt-0.5 font-medium">{v}</dd>
              </div>
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
          <div className="mt-5 border-t pt-4">
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
              actionTarget={{ id: payment.id, status: payment.status }}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h3 className="mb-3 font-semibold">审批记录</h3>
            {payment.approvalRecords.length === 0 && (
              <p className="text-sm text-gray-400">暂无审批记录</p>
            )}
            <ol className="space-y-3">
              {payment.approvalRecords.map((r) => (
                <li key={r.id} className="border-l-2 border-gray-200 pl-3 text-sm">
                  <div>
                    <span className="font-medium">{approvalStageLabels[r.stage]}</span>
                    <span
                      className={`ml-2 rounded px-1.5 py-0.5 text-xs ${
                        r.action === "APPROVE" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {approvalActionLabels[r.action]}
                    </span>
                  </div>
                  <div className="text-gray-500">
                    {r.approver.name} · {formatDateTime(r.createdAt)}
                  </div>
                  {r.comment && <div className="mt-1 text-gray-700">意见：{r.comment}</div>}
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">关联发票（选填）</h3>
              <Link href="/invoices" className="text-sm text-blue-600 hover:underline">
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
                      <a href={inv.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                        查看发票文件
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
