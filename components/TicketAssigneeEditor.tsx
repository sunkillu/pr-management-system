"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls, btnPrimary, btnSecondary, Field } from "./ui";
import Modal from "./Modal";

// 工单归属人编辑：仅 ADMIN / PR负责人可见（父组件控制），
// 下拉选 PR / PR负责人 + 改动原因，调 POST /api/tickets/[id]/assign
export default function TicketAssigneeEditor({
  ticketId,
  currentId,
  users,
}: {
  ticketId: string;
  currentId: string | null;
  users: { id: string; name: string; role: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [assigneeId, setAssigneeId] = useState(currentId ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const current = users.find((u) => u.id === currentId);
  const candidates = users.filter((u) => ["PR", "PR_MANAGER"].includes(u.role));

  async function save() {
    if (!assigneeId) {
      setError("请选择归属 PR");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/tickets/${ticketId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId, reason: reason.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "修改归属失败");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">
        归属：{current ? current.name : "未分配"}
      </span>
      <button className={btnSecondary} onClick={() => { setAssigneeId(currentId ?? ""); setReason(""); setError(""); setOpen(true); }}>
        修改归属
      </button>
      {open && (
        <Modal title="修改工单归属" onClose={() => setOpen(false)}>
          <Field label="归属 PR" required>
            <select className={inputCls} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">请选择</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>{u.name}（{u.role === "PR_MANAGER" ? "PR负责人" : "PR"}）</option>
              ))}
            </select>
          </Field>
          <Field label="改动原因（选填）">
            <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="如：原 PR 离职，转交" />
          </Field>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setOpen(false)}>取消</button>
            <button className={btnPrimary} disabled={busy} onClick={save}>
              {busy ? "保存中…" : "确认修改"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
