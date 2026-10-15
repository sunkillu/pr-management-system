"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "./ConfirmDialog";
import Modal from "./Modal";
import { inputCls, btnPrimary, btnSecondary, btnDanger, Field } from "./ui";

// 工单返稿/发布/结算流转区（寄品签收 → 待返稿 → 已返稿 → 已发布 → 发布后结算）
// 仅在相关状态下渲染对应操作；所有状态推进均经二次确认。
export default function TicketReviewFlow({
  ticketId,
  ticketTitle,
  status,
  canOperate,
  canApproveSettle,
  hasSignedSample,
  materialsCount,
  publishLink,
  confirmedDate,
  settlement,
}: {
  ticketId: string;
  ticketTitle: string;
  status: string;
  canOperate: boolean;
  canApproveSettle: boolean;
  hasSignedSample: boolean;
  materialsCount: number;
  publishLink: string | null;
  confirmedDate: string | null;
  // 同工单未终结的发布后结算请求（REJECTED/VOIDED 除外），有则不再重复发起
  settlement: { id: string; amount: unknown; status: string } | null;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<null | { title: string; message: string; onOk: () => Promise<void> }>(null);
  const [schedule, setSchedule] = useState(confirmedDate ?? "");
  const [link, setLink] = useState(publishLink ?? "");
  const [settleOpen, setSettleOpen] = useState(false);
  const [actualFee, setActualFee] = useState("");
  const [settleNote, setSettleNote] = useState("");
  const [settleComment, setSettleComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function call(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "操作失败");
        return false;
      }
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function advance(to: string, extra: Record<string, unknown> = {}) {
    if (await call(`/api/tickets/${ticketId}/advance-status`, { to, ...extra })) {
      router.refresh();
    }
  }

  // 已返稿 / 已发布走专用入口（advance-status 只负责进待返稿）
  async function markReviewed() {
    if (await call(`/api/tickets/${ticketId}/return-draft`, {})) router.refresh();
  }

  async function markPublished(publishLink: string) {
    if (await call(`/api/tickets/${ticketId}/publish`, { publishLink })) router.refresh();
  }

  // 寄品签收后引导：填写确定档期 → 待返稿
  const showScheduleBanner =
    canOperate && (status === "IN_PROGRESS" || status === "COMPLETED") && hasSignedSample;
  // 待返稿：有返稿素材后可标记已返稿
  const showReviewed = canOperate && status === "PENDING_REVIEW";
  // 已返稿：填写发布链接 → 已发布
  const showPublish = canOperate && status === "REVIEWED";
  // 已发布：结算请求
  const showSettle = canOperate && status === "PUBLISHED";

  if (!showScheduleBanner && !showReviewed && !showPublish && !showSettle) return null;

  return (
    <div className="space-y-3">
      {showScheduleBanner && (
        <div className="rounded-lg border border-blue-300 bg-blue-50 p-3">
          <p className="text-sm font-medium text-blue-900">寄品已完成，请填写确定档期</p>
          <p className="mt-1 text-xs text-blue-800">保存后工单进入「待返稿」。</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="date"
              className={inputCls}
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              style={{ maxWidth: 200 }}
            />
            <button
              className={btnPrimary}
              disabled={busy}
              onClick={() =>
                setConfirm({
                  title: "填写确定档期",
                  message: `确定档期：${schedule || "（未填）"}\n保存后工单进入「待返稿」，确认吗？`,
                  onOk: async () => {
                    setConfirm(null);
                    await advance("PENDING_REVIEW", { confirmedDate: schedule });
                  },
                })
              }
            >
              填写确定档期
            </button>
          </div>
        </div>
      )}

      {showReviewed &&
        (materialsCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
            <p className="text-sm text-amber-900">已回收 {materialsCount} 条返稿素材，可标记已返稿。</p>
            <button
              className={btnPrimary}
              disabled={busy}
              onClick={() =>
                setConfirm({
                  title: "标记已返稿",
                  message: `确认工单「${ticketTitle}」已返稿吗？状态将变为「已返稿」。`,
                  onOk: async () => {
                    setConfirm(null);
                    await markReviewed();
                  },
                })
              }
            >
              标记已返稿
            </button>
          </div>
        ) : (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            待返稿：请先上传返稿素材，上传后可标记已返稿。
          </p>
        ))}

      {showPublish && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-3">
          <p className="text-sm font-medium text-green-900">已返稿，请填写发布链接</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              className={inputCls}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="粘贴发布链接"
              style={{ minWidth: 260, flex: 1 }}
            />
            <button
              className={btnPrimary}
              disabled={busy}
              onClick={() =>
                setConfirm({
                  title: "标记已发布",
                  message: `发布链接：${link.trim() || "（未填）"}\n保存后工单进入「已发布」，确认吗？`,
                  onOk: async () => {
                    setConfirm(null);
                    await markPublished(link.trim());
                  },
                })
              }
            >
              保存并标记已发布
            </button>
          </div>
        </div>
      )}

      {showSettle &&
        (settlement ? (
          settlement.status === "PENDING_BIZ" ? (
            <div className="rounded-lg border border-purple-300 bg-purple-50 p-3">
              <p className="text-sm font-medium text-purple-900">
                结算请求待审批：实际价格 ¥{Number(settlement.amount).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
              </p>
              {canApproveSettle ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    className={inputCls}
                    value={settleComment}
                    onChange={(e) => setSettleComment(e.target.value)}
                    placeholder="审批意见（驳回时必填）"
                    style={{ minWidth: 220, flex: 1 }}
                  />
                  <button
                    className={btnPrimary}
                    disabled={busy}
                    onClick={async () => {
                      if (await call(`/api/tickets/${ticketId}/settlement-request`, { action: "APPROVE", paymentId: settlement.id, comment: settleComment.trim() })) router.refresh();
                    }}
                  >
                    结算审批通过
                  </button>
                  <button
                    className={btnDanger}
                    disabled={busy}
                    onClick={async () => {
                      if (!settleComment.trim()) {
                        setError("驳回必须填写理由");
                        return;
                      }
                      if (await call(`/api/tickets/${ticketId}/settlement-request`, { action: "REJECT", paymentId: settlement.id, comment: settleComment.trim() })) router.refresh();
                    }}
                  >
                    驳回结算
                  </button>
                </div>
              ) : (
                <p className="mt-1 text-xs text-purple-800">等待 PR负责人审批。</p>
              )}
            </div>
          ) : (
            <p className="rounded-lg border border-purple-300 bg-purple-50 p-3 text-sm text-purple-900">
              结算请求已提交，当前打款单状态：{settlement.status}，请在打款审批中跟进。
            </p>
          )
        ) : (
          <div>
            <button className={btnPrimary} disabled={busy} onClick={() => { setActualFee(""); setSettleNote(""); setSettleOpen(true); }}>
              发送结算请求
            </button>
          </div>
        ))}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          onClose={() => setConfirm(null)}
          onConfirm={confirm.onOk}
        />
      )}

      {settleOpen && (
        <Modal title="发送结算请求" onClose={() => setSettleOpen(false)}>
          <p className="mb-3 rounded bg-purple-50 p-2 text-xs text-purple-800">
            工单已发布，填写实际价格后将生成一笔发布后结算打款单，由 PR负责人审批，审批通过后自动进入财务审批。
          </p>
          <Field label="实际价格（元）" required>
            <input
              type="number"
              min={0.01}
              step="0.01"
              className={inputCls}
              value={actualFee}
              onChange={(e) => setActualFee(e.target.value)}
              placeholder="如：5000"
            />
          </Field>
          <Field label="备注（选填）">
            <textarea className={inputCls} rows={2} value={settleNote} onChange={(e) => setSettleNote(e.target.value)} />
          </Field>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setSettleOpen(false)}>取消</button>
            <button
              className={btnPrimary}
              disabled={busy}
              onClick={async () => {
                const fee = Number(actualFee);
                if (!Number.isFinite(fee) || fee <= 0) {
                  setError("实际价格必须为大于 0 的数字");
                  return;
                }
                if (await call(`/api/tickets/${ticketId}/settlement-request`, { actualFee: fee, note: settleNote.trim() })) {
                  setSettleOpen(false);
                  router.refresh();
                }
              }}
            >
              {busy ? "提交中…" : "确认发送"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
