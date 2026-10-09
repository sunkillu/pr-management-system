"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import { Field, inputCls, btnSecondary, btnDanger, btnPrimary } from "./ui";

// 发票核验：财务（管理员兜底也有权限）。待核验 → 已核验 / 异常（需备注原因）
export default function InvoiceActions({ id, status, role }: { id: string; status: string; role: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const canVerify = role === "ADMIN" || role === "FINANCE";
  if (!canVerify || status !== "PENDING") return null;

  const call = async (action: "VERIFY" | "INVALID") => {
    if (action === "INVALID" && !note.trim()) {
      setError("标记异常必须填写原因");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/invoices/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "操作失败");
        return;
      }
      setShow(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <span>
      <button
        onClick={() => { setShow(true); setNote(""); setError(""); }}
        className="text-sm text-blue-600 hover:underline"
      >
        核验
      </button>
      {show && (
        <Modal title="发票核验" onClose={() => setShow(false)}>
          <Field label="备注（标记异常时必填）">
            <textarea
              className={inputCls}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="如：发票号码与开票方不符"
            />
          </Field>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setShow(false)}>取消</button>
            <button className={btnDanger} disabled={busy} onClick={() => call("INVALID")}>
              标记异常
            </button>
            <button className={btnPrimary} disabled={busy} onClick={() => call("VERIFY")}>
              核验通过
            </button>
          </div>
        </Modal>
      )}
    </span>
  );
}
