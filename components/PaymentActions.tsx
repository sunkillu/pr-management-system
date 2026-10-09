"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import { Field, inputCls, btnSecondary, btnDanger, btnPrimary } from "./ui";

// 打款两阶段审批操作按钮
// 一审（业务审批）：ADMIN；二审（财务审批）/ 标记已打款：FINANCE（ADMIN 兜底也有权限）
export default function PaymentActions({
  id,
  status,
  role,
}: {
  id: string;
  status: string;
  role: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<null | { url: string; title: string; needReason: boolean }>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

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
      setModal(null);
      setComment("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const openDecision = (url: string, title: string, needReason: boolean) => {
    setComment("");
    setError("");
    setModal({ url, title, needReason });
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {isAdmin && status === "PENDING_BIZ" && (
        <>
          <button
            disabled={busy}
            onClick={() => openDecision(`/api/payments/${id}/approve-biz`, "业务审批", false)}
            className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-50"
          >
            业务审批
          </button>
        </>
      )}
      {isFinance && status === "PENDING_FIN" && (
        <button
          disabled={busy}
          onClick={() => openDecision(`/api/payments/${id}/approve-fin`, "财务审批", false)}
          className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-50"
        >
          财务审批
        </button>
      )}
      {isFinance && status === "APPROVED" && (
        <button
          disabled={busy}
          onClick={() => {
            if (confirm("确认已完成打款吗？")) call(`/api/payments/${id}/mark-paid`);
          }}
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          标记已打款
        </button>
      )}
      {error && <span className="text-sm text-red-600">{error}</span>}

      {modal && (
        <Modal title={modal.title} onClose={() => setModal(null)}>
          <p className="mb-3 text-sm text-gray-600">请选择审批结果{modal.needReason ? "" : "（驳回时必须填写理由）"}：</p>
          <Field label="审批意见">
            <textarea
              className={inputCls}
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="通过可留空，驳回请说明理由"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setModal(null)}>取消</button>
            <button
              className={btnDanger}
              disabled={busy}
              onClick={() => {
                if (!comment.trim()) {
                  setError("驳回必须填写理由");
                  return;
                }
                call(modal.url, { action: "REJECT", comment: comment.trim() });
              }}
            >
              驳回
            </button>
            <button
              className={btnPrimary}
              disabled={busy}
              onClick={() => call(modal.url, { action: "APPROVE", comment: comment.trim() || undefined })}
            >
              通过
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </Modal>
      )}
    </span>
  );
}
