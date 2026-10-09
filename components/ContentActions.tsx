"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import { Field, inputCls, btnPrimary, btnSecondary, btnDanger } from "./ui";

// 内容状态流转按钮：提交审批 / 通过 / 驳回 / 标记已发布
export default function ContentActions({
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
  const [showReject, setShowReject] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

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
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const isAdmin = role === "ADMIN";
  const isEditor = role === "ADMIN" || role === "OPERATOR";

  return (
    <span className="space-x-2">
      {isEditor && (status === "DRAFT" || status === "REJECTED") && (
        <button
          disabled={busy}
          onClick={() => call(`/api/contents/${id}/submit`)}
          className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          提交审批
        </button>
      )}
      {isAdmin && status === "PENDING" && (
        <>
          <button
            disabled={busy}
            onClick={() => call(`/api/contents/${id}/approve`, { action: "APPROVE", comment })}
            className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-50"
          >
            通过
          </button>
          <button
            disabled={busy}
            onClick={() => setShowReject(true)}
            className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
          >
            驳回
          </button>
        </>
      )}
      {isEditor && status === "APPROVED" && (
        <button
          disabled={busy}
          onClick={() => call(`/api/contents/${id}/publish`)}
          className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-50"
        >
          标记已发布
        </button>
      )}
      {error && <span className="text-sm text-red-600">{error}</span>}

      {showReject && (
        <Modal title="驳回内容" onClose={() => setShowReject(false)}>
          <Field label="驳回理由" required>
            <textarea
              className={inputCls}
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="请说明需要修改的地方"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setShowReject(false)}>取消</button>
            <button
              className={btnDanger}
              disabled={busy || !comment.trim()}
              onClick={async () => {
                await call(`/api/contents/${id}/approve`, { action: "REJECT", comment: comment.trim() });
                setShowReject(false);
              }}
            >
              确认驳回
            </button>
          </div>
        </Modal>
      )}
    </span>
  );
}

