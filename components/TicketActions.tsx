"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "./ConfirmDialog";
import Modal from "./Modal";
import { inputCls, btnPrimary, btnSecondary, Field } from "./ui";

type Ticket = {
  id: string;
  title: string;
  status: string;
  creatorId: string;
  actualFee?: unknown;
};

export default function TicketActions({
  ticket,
  userId,
  role,
}: {
  ticket: Ticket;
  userId: string;
  role: string;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<null | { title: string; message: string; onOk: () => Promise<void> }>(null);
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const [showApproveBox, setShowApproveBox] = useState(false);
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [showVoidBox, setShowVoidBox] = useState(false);
  const [showCompleteBox, setShowCompleteBox] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [actualFee, setActualFee] = useState("");
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

  const refresh = () => router.refresh();
  const isCreator = ticket.creatorId === userId;
  const isAdmin = role === "ADMIN";
  const canApprove = ["ADMIN", "PR_MANAGER"].includes(role);

  function ask(title: string, message: string, onOk: () => Promise<void>) {
    setConfirm({ title, message, onOk });
  }

  const btns: React.ReactNode[] = [];

  // 审批区（待审批）
  if (ticket.status === "PENDING_APPROVAL" && canApprove) {
    btns.push(
      <button key="approve" className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
        onClick={() => setShowApproveBox(true)}>通过</button>
    );
    btns.push(
      <button key="reject" className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
        onClick={() => setShowRejectBox(true)}>驳回</button>
    );
    btns.push(
      <button key="remind" className="rounded border border-orange-400 px-4 py-2 text-sm text-orange-600 hover:bg-orange-50"
        onClick={() => ask("提醒审批人", "确定向待审批人发送催办提醒吗？", async () => {
          if (await call(`/api/tickets/${ticket.id}/remind`, {})) refresh();
        })}>提醒审批人</button>
    );
  }
  // 开始执行
  if (ticket.status === "APPROVED" && (isCreator || isAdmin)) {
    btns.push(
      <button key="start" className="rounded bg-[#0071e3] px-4 py-2 text-sm text-white hover:bg-[#0077ed]"
        onClick={() => ask("开始执行", "确认开始执行该合作吗？", async () => {
          if (await call(`/api/tickets/${ticket.id}/start`, {})) refresh();
        })}>开始执行</button>
    );
  }
  // 标记完成（含评价）
  if (ticket.status === "IN_PROGRESS" && (isCreator || isAdmin)) {
    btns.push(
      <button key="complete" className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700"
        onClick={() => setShowCompleteBox(true)}>标记完成</button>
    );
  }
  // 生成打款单：已改为标记完成时自动生成，此处不再需要手动按钮
  // 重提
  if (ticket.status === "REJECTED" && (isCreator || isAdmin)) {
    btns.push(
      <button key="resubmit" className="rounded bg-[#0071e3] px-4 py-2 text-sm text-white hover:bg-[#0077ed]"
        onClick={() => ask("重新提交", "确认重新提交审批吗？将通知原审批人。", async () => {
          if (await call(`/api/tickets/${ticket.id}/resubmit`, {})) refresh();
        })}>重新提交</button>
    );
  }
  // 作废
  if (!["SETTLED", "VOIDED"].includes(ticket.status) && (isAdmin || (isCreator && ["DRAFT", "PENDING_APPROVAL", "REJECTED"].includes(ticket.status)))) {
    btns.push(
      <button key="void" className="rounded border border-gray-400 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
        onClick={() => setShowVoidBox(true)}>作废</button>
    );
  }

  if (btns.length === 0) return null;

  return (
    <div>
      <div className="flex flex-wrap gap-2">{btns}</div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          onClose={() => setConfirm(null)}
          onConfirm={async () => { setConfirm(null); await confirm.onOk(); }}
        />
      )}

      {showApproveBox && (
        <Modal title="通过审批" onClose={() => setShowApproveBox(false)}>
          <Field label="审批意见（选填）">
            <textarea className={inputCls} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
          </Field>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setShowApproveBox(false)}>取消</button>
            <button className={btnPrimary} disabled={busy}
              onClick={async () => {
                if (await call(`/api/tickets/${ticket.id}/approve`, { action: "APPROVE", comment })) {
                  setShowApproveBox(false); refresh();
                }
              }}>确认通过</button>
          </div>
        </Modal>
      )}

      {showRejectBox && (
        <Modal title="驳回工单" onClose={() => setShowRejectBox(false)}>
          <Field label="驳回理由" required>
            <textarea className={inputCls} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
          </Field>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setShowRejectBox(false)}>取消</button>
            <button className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700" disabled={busy}
              onClick={async () => {
                if (!comment.trim()) { setError("驳回必须填写理由"); return; }
                if (await call(`/api/tickets/${ticket.id}/approve`, { action: "REJECT", comment })) {
                  setShowRejectBox(false); refresh();
                }
              }}>确认驳回</button>
          </div>
        </Modal>
      )}

      {showVoidBox && (
        <Modal title="作废工单" onClose={() => setShowVoidBox(false)}>
          <Field label="作废理由" required>
            <textarea className={inputCls} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setShowVoidBox(false)}>取消</button>
            <button className="rounded bg-gray-600 px-4 py-2 text-sm text-white hover:bg-gray-700" disabled={busy}
              onClick={async () => {
                if (!reason.trim()) { setError("作废必须填写理由"); return; }
                if (await call(`/api/tickets/${ticket.id}/void`, { reason })) {
                  setShowVoidBox(false); refresh();
                }
              }}>确认作废</button>
          </div>
        </Modal>
      )}

      {showCompleteBox && (
        <Modal title="标记完成并评价" onClose={() => setShowCompleteBox(false)}>
          <Field label="实际费用（元）" hint="留空则沿用已有实际费用/预算">
            <input type="number" min={0.01} step="0.01" className={inputCls}
              value={actualFee} onChange={(e) => setActualFee(e.target.value)}
              placeholder={String(ticket.actualFee ?? "")} />
          </Field>
          <Field label="合作评价（1-5星）" required>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" onClick={() => setRating(s)}
                  className={`text-2xl ${s <= rating ? "text-yellow-400" : "text-gray-300"}`}>★</button>
              ))}
            </div>
          </Field>
          <Field label="评价内容" hint="将沉淀到合作对象档案，供下次合作参考">
            <textarea className={inputCls} rows={3} value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} />
          </Field>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <p className="mb-3 rounded bg-blue-50 p-2 text-xs text-blue-800">
            确认后将自动生成打款单并提交业务审批，无需手动操作。
          </p>
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setShowCompleteBox(false)}>取消</button>
            <button className={btnPrimary} disabled={busy}
              onClick={async () => {
                if (await call(`/api/tickets/${ticket.id}/complete`, {
                  rating, reviewComment, actualFee: actualFee || null,
                })) { setShowCompleteBox(false); refresh(); }
              }}>确认完成</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
