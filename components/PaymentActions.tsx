"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";

// 打款两阶段审批操作按钮
// 一审（业务审批）：ADMIN；二审（财务审批）/ 标记已打款：FINANCE（ADMIN 兜底也有权限）
// 新增：重新提交（被驳回，申请人本人/管理员）、作废
// 所有操作均经二次确认弹窗；驳回/作废必填理由
export default function PaymentActions({
  id,
  status,
  role,
  isRequester,
  voucherCount = 0,
}: {
  id: string;
  status: string;
  role: string;
  isRequester: boolean;
  voucherCount?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<null | {
    title: string;
    message?: string;
    needReason?: boolean;
    reasonLabel?: string;
    reasonPlaceholder?: string;
    reasonOptional?: boolean;
    confirmText?: string;
    danger?: boolean;
    run: (reason: string) => void;
  }>(null);
  const [decision, setDecision] = useState<null | { url: string; title: string }>(null);

  const isAdmin = role === "ADMIN";
  const isFinance = role === "FINANCE" || isAdmin;

  const call = async (url: string, body?: object) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "操作失败");
        return;
      }
      setConfirm(null);
      setDecision(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const openConfirm = (d: NonNullable<typeof confirm>) => {
    setError("");
    setConfirm(d);
  };

  const canResubmit = status === "REJECTED" && (isRequester || isAdmin);
  const canVoid =
    status !== "VOIDED" &&
    status !== "PAID" &&
    (isAdmin || (isRequester && ["PENDING_BIZ", "PENDING_FIN"].includes(status)));

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {isAdmin && status === "PENDING_BIZ" && (
        <button
          disabled={busy}
          onClick={() => {
            setError("");
            setDecision({ url: `/api/payments/${id}/approve-biz`, title: "业务审批" });
          }}
          className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-50"
        >
          业务审批
        </button>
      )}
      {isFinance && status === "PENDING_FIN" && (
        <button
          disabled={busy}
          onClick={() => {
            setError("");
            setDecision({ url: `/api/payments/${id}/approve-fin`, title: "财务审批" });
          }}
          className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-50"
        >
          财务审批
        </button>
      )}
      {isFinance && status === "APPROVED" && (
        <button
          disabled={busy || voucherCount === 0}
          title={voucherCount === 0 ? "请先上传打款凭证" : undefined}
          onClick={() =>
            openConfirm({
              title: "标记已打款",
              message: "确认该笔款项已完成打款吗？",
              confirmText: "确认已打款",
              run: () => call(`/api/payments/${id}/mark-paid`),
            })
          }
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          标记已打款{voucherCount === 0 ? "（需先上传凭证）" : ""}
        </button>
      )}
      {canResubmit && (
        <button
          disabled={busy}
          onClick={() =>
            openConfirm({
              title: "重新提交",
              message: "修改申请内容后重新提交，将回到待业务审批状态并重新走完整审批链。",
              needReason: true,
              reasonLabel: "修改说明",
              reasonPlaceholder: "请说明本次修改了哪些内容（选填，会记入历史记录）",
              reasonOptional: true,
              confirmText: "确认重新提交",
              run: (reason) => call(`/api/payments/${id}/resubmit`, { note: reason }),
            })
          }
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          重新提交
        </button>
      )}
      {canVoid && (
        <button
          disabled={busy}
          onClick={() =>
            openConfirm({
              title: "作废打款单",
              message: "作废后该单据不可再流转，只能查看。确认作废吗？",
              needReason: true,
              reasonLabel: "作废理由",
              reasonPlaceholder: "请说明作废原因",
              confirmText: "确认作废",
              danger: true,
              run: (reason) => call(`/api/payments/${id}/void`, { reason }),
            })
          }
          className="rounded bg-gray-600 px-3 py-1 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
        >
          作废
        </button>
      )}
      {error && <span className="text-sm text-red-600">{error}</span>}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          needReason={confirm.needReason}
          reasonLabel={confirm.reasonLabel}
          reasonPlaceholder={confirm.reasonPlaceholder}
          reasonOptional={confirm.reasonOptional}
          confirmText={confirm.confirmText}
          danger={confirm.danger}
          busy={busy}
          onConfirm={confirm.run}
          onClose={() => setConfirm(null)}
        />
      )}

      {decision && (
        <DecisionDialog
          title={decision.title}
          busy={busy}
          onApprove={(reason) => call(decision.url, { action: "APPROVE", comment: reason || undefined })}
          onReject={(reason) => call(decision.url, { action: "REJECT", comment: reason })}
          onClose={() => setDecision(null)}
        />
      )}
    </span>
  );
}

// 审批决策弹窗：通过 / 驳回两个按钮，驳回必须填理由
function DecisionDialog({
  title,
  busy,
  onApprove,
  onReject,
  onClose,
}: {
  title: string;
  busy: boolean;
  onApprove: (reason: string) => void;
  onReject: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  return (
    <Modal title={title} onClose={onClose}>
      <p className="mb-3 text-sm text-gray-600">请选择审批结果（驳回时必须填写理由）：</p>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        审批意见 <span className="text-xs text-gray-400">（通过可留空，驳回必填）</span>
      </label>
      <textarea
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        rows={4}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="通过可留空，驳回请说明理由"
      />
      <div className="mt-4 flex justify-end gap-2">
        <button
          className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          onClick={onClose}
          disabled={busy}
        >
          取消
        </button>
        <button
          className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          disabled={busy}
          onClick={() => {
            if (!reason.trim()) {
              setError("驳回必须填写理由");
              return;
            }
            onReject(reason.trim());
          }}
        >
          {busy ? "处理中…" : "驳回"}
        </button>
        <button
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={busy}
          onClick={() => onApprove(reason.trim())}
        >
          {busy ? "处理中…" : "通过"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Modal>
  );
}
