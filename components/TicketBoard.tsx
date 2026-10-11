"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ticketStatusLabels, coopTypeLabels, badgeClass, formatMoney } from "@/lib/labels";
import { btnPrimarySm, btnDangerSm, btnSecondarySm, cardHoverCls } from "./ui";

export type BoardTicket = {
  id: string;
  ticketNo: string;
  title: string;
  type: string;
  status: string;
  budgetFee: unknown;
  influencer: { name: string } | null;
  makeupArtist: { name: string } | null;
  creator: { name: string } | null;
  overdue: boolean;
  subtasks: { status: string }[];
  paymentRequests: { id: string }[];
};

const MAIN_COLUMNS = [
  "PENDING_APPROVAL",
  "IN_PROGRESS",
  "MATERIAL_REVIEW",
  "SETTLING",
  "FOLLOW_UP",
  "SETTLED",
] as const;
const EXTRA_COLUMNS = ["DRAFT", "REJECTED", "VOIDED"] as const;

function SubtaskBar({ subtasks }: { subtasks: { status: string }[] }) {
  if (subtasks.length === 0) return null;
  const done = subtasks.filter((s) => s.status === "DONE").length;
  const pct = Math.round((done / subtasks.length) * 100);
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e5e5e5]">
        <div
          className="h-full rounded-full bg-[#0071e3] transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-gray-500">
        {done}/{subtasks.length}
      </span>
    </div>
  );
}

export default function TicketBoard({
  tickets,
  role,
}: {
  tickets: BoardTicket[];
  role: string;
}) {
  const router = useRouter();
  const [showExtra, setShowExtra] = useState(false);
  const [busyId, setBusyId] = useState("");

  const columns = showExtra
    ? [...MAIN_COLUMNS, ...EXTRA_COLUMNS]
    : [...MAIN_COLUMNS];

  const canApprove = ["ADMIN", "PR_MANAGER"].includes(role);

  async function postAction(ticketId: string, url: string, body?: Record<string, unknown>) {
    setBusyId(ticketId);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "操作失败");
        return;
      }
      router.refresh();
    } finally {
      setBusyId("");
    }
  }

  function approve(ticketId: string) {
    if (!confirm(`确定通过工单吗？`)) return;
    postAction(ticketId, `/api/tickets/${ticketId}/approve`, { action: "APPROVE" });
  }

  function reject(ticketId: string) {
    const reason = prompt("请输入驳回理由（必填）：");
    if (!reason || !reason.trim()) return;
    postAction(ticketId, `/api/tickets/${ticketId}/approve`, { action: "REJECT", comment: reason.trim() });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showExtra}
            onChange={(e) => setShowExtra(e.target.checked)}
            className="h-4 w-4 accent-[#0071e3]"
          />
          显示草稿 / 驳回 / 作废
        </label>
        <span className="text-xs text-gray-400">点击卡片标题进入详情页</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {columns.map((status) => {
          const list = tickets.filter((t) => t.status === status);
          return (
            <div key={status} className="w-72 shrink-0 rounded-2xl bg-[#f5f5f7] p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${badgeClass(status)}`}>
                  {ticketStatusLabels[status]}
                </span>
                <span className="text-xs text-gray-500">{list.length}</span>
              </div>
              <div className="space-y-2">
                {list.map((t) => {
                  const partner = t.influencer?.name ?? t.makeupArtist?.name ?? "-";
                  return (
                    <div key={t.id} className={`rounded-xl bg-white p-3 ring-1 ring-[#f0f0f0] ${cardHoverCls}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 text-sm font-medium text-gray-900">
                          {t.title}
                        </div>
                        {t.overdue && (
                          <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
                            超时
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 space-y-0.5 text-xs text-gray-500">
                        <Link
                          href={`/tickets/${t.id}`}
                          className="font-mono text-[#0071e3] hover:underline"
                        >
                          {t.ticketNo}
                        </Link>
                        <div>{partner} · {coopTypeLabels[t.type] ?? t.type}</div>
                        <div>¥{formatMoney(t.budgetFee)} · {t.creator?.name ?? "-"}</div>
                      </div>
                      <SubtaskBar subtasks={t.subtasks} />
                      {/* 快捷操作 */}
                      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-[#f0f0f0] pt-2">
                        {t.status === "PENDING_APPROVAL" && canApprove && (
                          <>
                            <button
                              disabled={busyId === t.id}
                              onClick={() => approve(t.id)}
                              className={btnPrimarySm}
                            >
                              通过
                            </button>
                            <button
                              disabled={busyId === t.id}
                              onClick={() => reject(t.id)}
                              className={btnDangerSm}
                            >
                              驳回
                            </button>
                          </>
                        )}
                        {t.status === "IN_PROGRESS" && (
                          <Link
                            href={`/tickets/${t.id}#approval-section`}
                            className={btnPrimarySm}
                          >
                            标记完成
                          </Link>
                        )}
                        {t.status === "MATERIAL_REVIEW" && (
                          <Link
                            href={`/tickets/${t.id}#approval-section`}
                            className={btnPrimarySm}
                          >
                            去审批素材
                          </Link>
                        )}
                        {t.status === "SETTLING" && (
                          <Link
                            href={t.paymentRequests[0] ? `/payments/${t.paymentRequests[0].id}` : "/payments"}
                            className={btnSecondarySm}
                          >
                            去打款单
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
                {list.length === 0 && (
                  <p className="py-6 text-center text-xs text-gray-400">暂无</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
