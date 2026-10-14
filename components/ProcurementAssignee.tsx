"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls, btnPrimary, btnSecondary, Field } from "./ui";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";

export default function ProcurementAssignee({
  ticketId,
  ticketTitle,
  hasAssignee,
  role,
}: {
  ticketId: string;
  ticketTitle: string;
  hasAssignee: boolean;
  role: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showAcceptConfirm, setShowAcceptConfirm] = useState(false);
  const [showAssignBox, setShowAssignBox] = useState(false);
  const [prUsers, setPrUsers] = useState<{ id: string; name: string }[]>([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [reason, setReason] = useState("");

  const canAccept = ["PR", "ADMIN", "PR_MANAGER"].includes(role);
  const canAssign = ["ADMIN", "PR_MANAGER"].includes(role);

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

  async function loadPrUsers() {
    try {
      const res = await fetch("/api/approvers?roles=PR");
      const data = await res.json().catch(() => []);
      setPrUsers(Array.isArray(data) ? data : []);
    } catch {
      setPrUsers([]);
    }
  }

  const btns: React.ReactNode[] = [];
  if (!hasAssignee && canAccept) {
    btns.push(
      <button key="accept" className={btnPrimary} onClick={() => setShowAcceptConfirm(true)}>
        接单
      </button>
    );
  }
  if (canAssign) {
    btns.push(
      <button
        key="assign"
        className={btnSecondary}
        onClick={() => { setAssigneeId(""); setReason(""); setShowAssignBox(true); loadPrUsers(); }}
      >
        {hasAssignee ? "重新分配" : "人工分配"}
      </button>
    );
  }
  if (btns.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">{btns}</div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {showAcceptConfirm && (
        <ConfirmDialog
          title="确认接单"
          message={`确认接单采买工单「${ticketTitle}」吗？接单后工单归属到你。`}
          confirmText="确认接单"
          busy={busy}
          onClose={() => setShowAcceptConfirm(false)}
          onConfirm={async () => {
            if (await call(`/api/tickets/${ticketId}/accept`, {})) {
              setShowAcceptConfirm(false);
              router.refresh();
            }
          }}
        />
      )}

      {showAssignBox && (
        <Modal title="人工分配" onClose={() => setShowAssignBox(false)}>
          <Field label="归属 PR" required>
            <select className={inputCls} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">请选择</option>
              {prUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </Field>
          <Field label="分配理由（选填）">
            <textarea className={inputCls} rows={2} value={reason}
              onChange={(e) => setReason(e.target.value)} placeholder="如：12小时未接单，指定处理" />
          </Field>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setShowAssignBox(false)}>取消</button>
            <button className={btnPrimary} disabled={busy || !assigneeId}
              onClick={async () => {
                if (await call(`/api/tickets/${ticketId}/assign`, { assigneeId, reason: reason.trim() || null })) {
                  setShowAssignBox(false);
                  router.refresh();
                }
              }}>确认分配</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
