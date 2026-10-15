"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary, btnSecondary, inputCls } from "./ui";

export default function TicketAssigneeEditor({ ticketId, currentId, users }: { ticketId: string; currentId?: string | null; users: { id: string; name: string; role?: string }[] }) {
  const router = useRouter();
  const [assigneeId, setAssigneeId] = useState(currentId ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    if (!assigneeId) { setMessage("请选择负责人"); return; }
    setBusy(true); setMessage("");
    const res = await fetch(`/api/tickets/${ticketId}/assign`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assigneeId }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMessage(data.error || "分配失败"); return; }
    setMessage("负责人已更新"); router.refresh();
  }
  return <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3">
    <p className="mb-2 text-xs font-medium">工单归属 PR</p>
    <div className="flex flex-wrap gap-2">
      <select className={`${inputCls} min-w-[220px]`} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
        <option value="">请选择负责人</option>
        {users.filter((user) => user.role === "PR" || user.role === "PR_MANAGER").map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
      </select>
      <button className={btnPrimary} disabled={busy} onClick={save}>{busy ? "保存中…" : "保存负责人"}</button>
      <button className={btnSecondary} onClick={() => setAssigneeId(currentId ?? "")}>撤销修改</button>
    </div>
    {message && <p className="mt-2 text-xs text-muted-foreground">{message}</p>}
  </div>;
}
