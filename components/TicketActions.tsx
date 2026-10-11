"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "./ConfirmDialog";
import Modal from "./Modal";
import { inputCls, btnPrimary, btnSecondary, btnDanger, Field } from "./ui";

type Ticket = {
  id: string;
  title: string;
  status: string;
  creatorId: string;
  actualFee?: unknown;
  incompleteSubtasks?: number;
};

export default function TicketActions({
  ticket,
  userId,
  role,
  canOperate,
}: {
  ticket: Ticket;
  userId: string;
  role: string;
  // 是否可推动工单状态：创建人 / 审批链成员 / ADMIN（后端同样校验）
  canOperate: boolean;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<null | { title: string; message: string; onOk: () => Promise<void> }>(null);
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const [showApproveBox, setShowApproveBox] = useState(false);
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [showVoidBox, setShowVoidBox] = useState(false);
  const [showCompleteBox, setShowCompleteBox] = useState(false);
  const [executionSummary, setExecutionSummary] = useState("");
  const [confirmIncomplete, setConfirmIncomplete] = useState(false);
  const [amountConfirmed, setAmountConfirmed] = useState(false);
  const [showOverrideBox, setShowOverrideBox] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [showMaterialApproveBox, setShowMaterialApproveBox] = useState(false);
  const [showMaterialRejectBox, setShowMaterialRejectBox] = useState(false);
  const [materialComment, setMaterialComment] = useState("");
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
  const isAdmin = role === "ADMIN";
  const canApprove = ["ADMIN", "PR_MANAGER"].includes(role);

  function ask(title: string, message: string, onOk: () => Promise<void>) {
    setConfirm({ title, message, onOk });
  }

  const btns: React.ReactNode[] = [];

  // 审批区（待审批）
  if (ticket.status === "PENDING_APPROVAL" && canApprove) {
    btns.push(
      <button key="approve" className={btnPrimary}
        onClick={() => setShowApproveBox(true)}>通过</button>
    );
    btns.push(
      <button key="reject" className={btnDanger}
        onClick={() => setShowRejectBox(true)}>驳回</button>
    );
  }
  // 提醒审批人：仅申请人（创建人）可见
  if (ticket.status === "PENDING_APPROVAL" && ticket.creatorId === userId) {
    btns.push(
      <button key="remind" className="rounded border border-orange-400 px-4 py-2 text-sm text-orange-600 hover:bg-orange-50"
        onClick={() => ask("提醒审批人", "确定向待审批人发送催办提醒吗？", async () => {
          if (await call(`/api/tickets/${ticket.id}/remind`, {})) refresh();
        })}>提醒审批人</button>
    );
  }
  // 审批通过后自动进入执行中，无需手动"开始执行"
  // 标记完成（含评价）：仅创建人 / 审批链成员 / ADMIN；完成后进入待素材审批
  if (ticket.status === "IN_PROGRESS" && canOperate) {
    btns.push(
      <button key="complete" className={btnPrimary}
        onClick={() => setShowCompleteBox(true)}>标记完成</button>
    );
  }
  // 素材审批：待素材审批状态，仅 PR负责人 / ADMIN
  if (ticket.status === "MATERIAL_REVIEW" && canApprove) {
    btns.push(
      <button key="material-approve" className={btnPrimary}
        onClick={() => { setMaterialComment(""); setShowMaterialApproveBox(true); }}>素材审批通过</button>
    );
    btns.push(
      <button key="material-reject" className={btnDanger}
        onClick={() => { setMaterialComment(""); setShowMaterialRejectBox(true); }}>驳回素材</button>
    );
  }
  // 超预算特批：仅管理员，执行中工单可用
  if (ticket.status === "IN_PROGRESS" && isAdmin) {
    btns.push(
      <button key="override" className="rounded border border-amber-400 px-4 py-2 text-sm text-amber-700 hover:bg-amber-50"
        onClick={() => { setOverrideReason(""); setShowOverrideBox(true); }}>超预算特批</button>
    );
  }
  // 生成打款单：已改为标记完成时自动生成，此处不再需要手动按钮
  // 重提：仅创建人 / 审批链成员 / ADMIN
  if (ticket.status === "REJECTED" && canOperate) {
    btns.push(
      <button key="resubmit" className="rounded bg-[#0071e3] px-4 py-2 text-sm text-white hover:bg-[#0077ed]"
        onClick={() => ask("重新提交", "确认重新提交审批吗？将通知原审批人。", async () => {
          if (await call(`/api/tickets/${ticket.id}/resubmit`, {})) refresh();
        })}>重新提交</button>
    );
  }
  // 作废：ADMIN 可作废非终态；创建人/审批链成员仅可作废早期待办状态
  if (!["SETTLED", "VOIDED"].includes(ticket.status) && (isAdmin || (canOperate && ["DRAFT", "PENDING_APPROVAL", "REJECTED"].includes(ticket.status)))) {
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
            <button className={btnDanger} disabled={busy}
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
            <button className={btnDanger} disabled={busy}
              onClick={async () => {
                if (!reason.trim()) { setError("作废必须填写理由"); return; }
                if (await call(`/api/tickets/${ticket.id}/void`, { reason })) {
                  setShowVoidBox(false); refresh();
                }
              }}>确认作废</button>
          </div>
        </Modal>
      )}

      {showOverrideBox && (
        <Modal title="超预算特批" onClose={() => setShowOverrideBox(false)}>
          <p className="mb-3 rounded bg-amber-50 p-2 text-xs text-amber-800">
            特批后，该工单标记完成时不再拦截超预算。请填写特批理由，将记入操作日志。
          </p>
          <Field label="特批理由" required>
            <textarea className={inputCls} rows={3} value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)} placeholder="如：达人临时涨价，已与对方确认" />
          </Field>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setShowOverrideBox(false)}>取消</button>
            <button className={btnPrimary} disabled={busy}
              onClick={async () => {
                if (!overrideReason.trim()) { setError("特批必须填写理由"); return; }
                if (await call(`/api/tickets/${ticket.id}/override-budget`, { reason: overrideReason.trim() })) {
                  setShowOverrideBox(false); setOverrideReason(""); refresh();
                }
              }}>确认特批</button>
          </div>
        </Modal>
      )}

      {showCompleteBox && (
        <Modal title="标记完成并评价" onClose={() => setShowCompleteBox(false)}>          <Field label="实际费用（元）" hint="留空则沿用已有实际费用/预算">
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
          <Field label="执行总结" required hint="对事的说明：合作实际执行情况、交付内容、异常等">
            <textarea className={inputCls} rows={3} value={executionSummary} onChange={(e) => setExecutionSummary(e.target.value)}
              placeholder="请填写执行总结" />
          </Field>
          <Field label="评价内容" hint="对人的评价：将沉淀到合作对象档案，供下次合作参考">
            <textarea className={inputCls} rows={3} value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} />
          </Field>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <p className="mb-3 rounded bg-blue-50 p-2 text-xs text-blue-800">
            确认后将提交素材审批，PR负责人审批通过后自动生成打款单。
          </p>
          <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-800">
            <input
              type="checkbox"
              checked={amountConfirmed}
              onChange={(e) => setAmountConfirmed(e.target.checked)}
              className="h-4 w-4 accent-[#0071e3]"
            />
            我确认以上金额为最终打款金额
          </label>
          {(ticket.incompleteSubtasks ?? 0) > 0 && (
            <div className="mb-3 rounded-[10px] border border-amber-300 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-800">
                还有 {ticket.incompleteSubtasks} 个子任务未完成，确定要标记完成吗？
              </p>
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-amber-700">
                <input
                  type="checkbox"
                  checked={confirmIncomplete}
                  onChange={(e) => setConfirmIncomplete(e.target.checked)}
                  className="h-4 w-4 accent-amber-600"
                />
                我确认子任务未完成仍标记完成
              </label>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => { setShowCompleteBox(false); setConfirmIncomplete(false); }}>取消</button>
            <button className={btnPrimary} disabled={busy || ((ticket.incompleteSubtasks ?? 0) > 0 && !confirmIncomplete) || !amountConfirmed}
              onClick={async () => {
                if (!executionSummary.trim()) { setError("标记完成必须填写执行总结"); return; }
                if (!amountConfirmed) { setError("请确认打款金额"); return; }
                if (await call(`/api/tickets/${ticket.id}/complete`, {
                  rating, reviewComment, executionSummary: executionSummary.trim(), actualFee: actualFee || null,
                  amountConfirmed: true,
                })) { setShowCompleteBox(false); setConfirmIncomplete(false); setExecutionSummary(""); setAmountConfirmed(false); refresh(); }
              }}>确认完成</button>
          </div>
        </Modal>
      )}
      {showMaterialApproveBox && (
        <Modal title="素材审批通过" onClose={() => setShowMaterialApproveBox(false)}>
          <p className="mb-3 rounded bg-blue-50 p-2 text-xs text-blue-800">
            通过后将自动生成打款单并提交业务审批，工单进入结算中。
          </p>
          <Field label="审批意见（选填）">
            <textarea className={inputCls} rows={3} value={materialComment}
              onChange={(e) => setMaterialComment(e.target.value)} />
          </Field>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setShowMaterialApproveBox(false)}>取消</button>
            <button className={btnPrimary} disabled={busy}
              onClick={async () => {
                if (await call(`/api/tickets/${ticket.id}/review-materials`, {
                  action: "APPROVE", comment: materialComment.trim() || null,
                })) { setShowMaterialApproveBox(false); setMaterialComment(""); refresh(); }
              }}>确认通过</button>
          </div>
        </Modal>
      )}

      {showMaterialRejectBox && (
        <Modal title="驳回素材" onClose={() => setShowMaterialRejectBox(false)}>
          <p className="mb-3 rounded bg-amber-50 p-2 text-xs text-amber-800">
            驳回后工单退回执行中，需继续回收素材后重新标记完成。
          </p>
          <Field label="驳回理由" required>
            <textarea className={inputCls} rows={3} value={materialComment}
              onChange={(e) => setMaterialComment(e.target.value)} placeholder="如：缺少发布后的笔记链接" />
          </Field>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setShowMaterialRejectBox(false)}>取消</button>
            <button className={btnDanger} disabled={busy}
              onClick={async () => {
                if (!materialComment.trim()) { setError("驳回必须填写理由"); return; }
                if (await call(`/api/tickets/${ticket.id}/review-materials`, {
                  action: "REJECT", reason: materialComment.trim(),
                })) { setShowMaterialRejectBox(false); setMaterialComment(""); refresh(); }
              }}>确认驳回</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
