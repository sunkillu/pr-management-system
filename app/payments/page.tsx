import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageHeader, thCls, tdCls, btnPrimary } from "@/components/ui";
import { paymentStatusLabels, badgeClass, formatMoney, formatDate } from "@/lib/labels";
import PaymentsClient from "./PaymentsClient";
import type { TicketPrefill } from "@/components/PaymentForm";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; newTicket?: string };
}) {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as unknown as { id: string; role: string };
  const role = sessionUser.role;
  const canSubmit = role === "ADMIN" || role === "OPERATOR";
  const canDelete = role === "ADMIN" || role === "OPERATOR";

  const where: Record<string, unknown> = {};
  if (searchParams.q) where.title = { contains: searchParams.q, mode: "insensitive" };
  if (searchParams.status) where.status = searchParams.status;

  // 工单一键生成打款单：预填收款方/金额/事由
  let ticketPrefill: TicketPrefill | undefined;
  if (searchParams.newTicket && canSubmit) {
    const ticket = await prisma.cooperationTicket.findUnique({
      where: { id: searchParams.newTicket },
      include: {
        influencer: { select: { name: true } },
        makeupArtist: { select: { name: true } },
      },
    });
    if (ticket && ticket.status === "COMPLETED") {
      ticketPrefill = {
        ticketId: ticket.id,
        ticketTitle: `合作工单结算-${ticket.title}`,
        amount: String(ticket.actualFee ?? ticket.budgetFee),
        payeeName: ticket.influencer?.name ?? ticket.makeupArtist?.name ?? "",
        reason: `合作工单「${ticket.title}」结算`,
      };
    }
  }

  const [payments, outlets, campaigns, contents] = await Promise.all([
    prisma.paymentRequest.findMany({
      where,
      include: { outlet: true, campaign: true, requester: true, _count: { select: { vouchers: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.mediaOutlet.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.campaign.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.content.findMany({ select: { id: true, title: true }, orderBy: { updatedAt: "desc" }, take: 200 }),
  ]);

  return (
    <div>
      <PageHeader
        title="打款审批"
        desc="两阶段审批：运营提交 → 管理员业务审批 → 财务审批 → 财务标记已打款。发票为选填，不阻塞流程。"
        action={
          canSubmit ? (
            <PaymentsClient role={role} outlets={outlets} campaigns={campaigns} contents={contents} ticketPrefill={ticketPrefill} />
          ) : undefined
        }
      />

      <form method="GET" className="mb-4 flex flex-wrap gap-2">
        <input
          name="q"
          placeholder="按标题搜索"
          defaultValue={searchParams.q ?? ""}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <select name="status" defaultValue={searchParams.status ?? ""} className="rounded border border-gray-300 px-3 py-2 text-sm">
          <option value="">全部状态</option>
          {Object.entries(paymentStatusLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button className={btnPrimary}>筛选</button>
      </form>

      <div className="overflow-x-auto bg-white rounded-2xl">
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>标题</th>
              <th className={thCls}>金额（元）</th>
              <th className={thCls}>收款方</th>
              <th className={thCls}>关联</th>
              <th className={thCls}>状态</th>
              <th className={thCls}>申请人</th>
              <th className={thCls}>更新时间</th>
              <th className={thCls}>操作</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className={tdCls + " font-medium"}>
                  <Link href={`/payments/${p.id}`} className="text-[#0071e3] hover:underline">
                    {p.title}
                  </Link>
                </td>
                <td className={tdCls}>{formatMoney(p.amount)}</td>
                <td className={tdCls}>{p.payeeName}</td>
                <td className={tdCls + " text-xs text-gray-500"}>
                  {[p.outlet?.name, p.campaign?.name].filter(Boolean).join(" / ") || "-"}
                </td>
                <td className={tdCls}>
                  <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(p.status)}`}>
                    {paymentStatusLabels[p.status]}
                  </span>
                </td>
                <td className={tdCls}>{p.requester.name}</td>
                <td className={tdCls}>{formatDate(p.updatedAt)}</td>
                <td className={tdCls + " whitespace-nowrap"}>
                  <PaymentsClient
                    role={role}
                    outlets={outlets}
                    campaigns={campaigns}
                    contents={contents}
                    editTarget={
                      canSubmit && (p.status === "PENDING_BIZ" || p.status === "REJECTED")
                        ? {
                            id: p.id,
                            title: p.title,
                            amount: String(p.amount),
                            payeeName: p.payeeName,
                            payeeAccount: p.payeeAccount ?? "",
                            reason: p.reason ?? "",
                            outletId: p.outletId ?? "",
                            campaignId: p.campaignId ?? "",
                            contentId: p.contentId ?? "",
                          }
                        : undefined
                    }
                    actionTarget={{ id: p.id, status: p.status, isRequester: p.requesterId === sessionUser.id, voucherCount: p._count.vouchers }}
                    deleteId={canDelete ? p.id : undefined}
                  />
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-500">暂无数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
