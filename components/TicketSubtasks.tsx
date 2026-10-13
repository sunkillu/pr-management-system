"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { subtaskStatusLabels, formatDate } from "@/lib/labels";
import { inputCls, btnPrimary } from "./ui";
import ConfirmDialog from "./ConfirmDialog";

type Subtask = {
  id: string;
  title: string;
  status: "TODO" | "DOING" | "DONE" | "BLOCKED";
  assigneeId: string | null;
  assignee: { id: string; name: string } | null;
  dueDate: string | null;
  sortOrder: number;
  blockedReason: string | null;
  blockedAt: string | null;
};

const NEXT_STATUS: Record<Subtask["status"], Subtask["status"]> = {
  TODO: "DOING",
  DOING: "DONE",
  DONE: "TODO",
  BLOCKED: "TODO",
};

const statusPill: Record<Subtask["status"], string> = {
  TODO: "bg-muted text-muted-foreground",
  DOING: "bg-blue-100 text-blue-700",
  DONE: "bg-green-100 text-green-700",
  BLOCKED: "bg-red-100 text-red-700",
};

export default function TicketSubtasks({
  ticketId,
  initial,
  users,
  canManage,
}: {
  ticketId: string;
  initial: Subtask[];
  users: { id: string; name: string }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Subtask[]>(initial);
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [doneConfirm, setDoneConfirm] = useState<Subtask | null>(null);
  const [blockTarget, setBlockTarget] = useState<Subtask | null>(null);

  const done = items.filter((s) => s.status === "DONE").length;
  const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;

  async function call(url: string, method: string, body?: Record<string, unknown>) {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || "操作失败");
      return null;
    }
    return data;
  }

  async function refreshList() {
    const data = await call(`/api/tickets/${ticketId}/subtasks`, "GET");
    if (data) setItems(data);
    router.refresh();
  }

  async function add() {
    const title = newTitle.trim();
    if (!title || busy) return;
    setBusy(true);
    const created = await call(`/api/tickets/${ticketId}/subtasks`, "POST", { title });
    setBusy(false);
    if (created) {
      setNewTitle("");
      setItems((prev) => [...prev, created]);
      router.refresh();
    }
  }

  async function patch(id: string, body: Record<string, unknown>) {
    const updated = await call(`/api/tickets/${ticketId}/subtasks/${id}`, "PATCH", body);
    if (updated) {
      setItems((prev) => prev.map((s) => (s.id === id ? updated : s)));
      router.refresh();
    }
  }

  async function remove(id: string) {
    if (!confirm("确定删除这个子任务吗？")) return;
    const ok = await call(`/api/tickets/${ticketId}/subtasks/${id}`, "DELETE");
    if (ok) {
      setItems((prev) => prev.filter((s) => s.id !== id));
      router.refresh();
    }
  }

  // 状态切换：标记完成需要二次确认（核对子任务名）
  async function requestStatusChange(s: Subtask, next: Subtask["status"]) {
    if (next === "DONE" && s.status !== "DONE") { setDoneConfirm(s); return; }
    await patch(s.id, { status: next });
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      {/* 进度条 */}
      <div className="mb-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {done}/{items.length} · {pct}%
        </span>
      </div>

      {/* 清单 */}
      <div className="space-y-2">
        {items.map((s) => {
          const overdue = s.status !== "DONE" && s.status !== "BLOCKED" && s.dueDate && s.dueDate < today;
          const blocked = s.status === "BLOCKED";
          return (
            <div
              key={s.id}
              className={`flex items-center gap-2 rounded-[10px] border px-3 py-2 transition-colors ${
                blocked
                  ? "border-red-300 bg-red-50"
                  : overdue
                    ? "border-red-300 bg-red-50"
                    : "border-border bg-card hover:border-input"
              }`}
            >
              {canManage ? (
                <input
                  type="checkbox"
                  checked={s.status === "DONE"}
                  disabled={blocked}
                  onChange={() => requestStatusChange(s, s.status === "DONE" ? "TODO" : "DONE")}
                  className="h-4 w-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                  title={blocked ? "阻塞中，先解除阻塞" : "勾选完成 / 取消完成"}
                />
              ) : (
                <span className={`text-sm ${s.status === "DONE" ? "text-green-600" : blocked ? "text-red-500" : "text-gray-300"}`}>
                  {s.status === "DONE" ? "✓" : blocked ? "⛔" : "○"}
                </span>
              )}
              <div className="flex-1">
                <span
                  className={`text-sm ${s.status === "DONE" ? "text-muted-foreground line-through" : blocked ? "text-red-700" : "text-foreground"}`}
                >
                  {s.title}
                </span>
                {blocked && s.blockedReason && (
                  <p className="mt-0.5 text-xs text-red-600">阻塞原因：{s.blockedReason}</p>
                )}
              </div>
              {blocked && (
                <span className="rounded bg-red-600 px-1.5 py-0.5 text-xs text-white">已阻塞</span>
              )}
              {overdue && (
                <span className="rounded bg-red-600 px-1.5 py-0.5 text-xs text-white">已超时</span>
              )}
              {canManage ? (
                <button
                  onClick={() => requestStatusChange(s, NEXT_STATUS[s.status])}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium transition-all hover:opacity-80 active:scale-95 ${statusPill[s.status]}`}
                  title="点击切换状态"
                >
                  {subtaskStatusLabels[s.status]}
                </button>
              ) : (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusPill[s.status]}`}>
                  {subtaskStatusLabels[s.status]}
                </span>
              )}
              {canManage ? (
                <>
                  {blocked ? (
                    <button
                      onClick={() => patch(s.id, { status: "TODO" })}
                      className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium text-white transition-all hover:opacity-80 active:scale-95"
                      title="解除阻塞，回到待办"
                    >
                      解除阻塞
                    </button>
                  ) : (
                    <button
                      onClick={() => setBlockTarget(s)}
                      className="rounded-full px-2 py-0.5 text-xs font-medium text-muted-foreground transition-all hover:bg-red-50 hover:text-red-600 active:scale-95"
                      title="标为阻塞（需填原因）"
                    >
                      阻塞
                    </button>
                  )}
                  <select
                    value={s.assigneeId ?? ""}
                    onChange={(e) => patch(s.id, { assigneeId: e.target.value || null })}
                    className="max-w-[96px] rounded-lg border border-input px-1 py-1 text-xs transition-colors focus:border-primary focus:outline-none"
                    title="负责人"
                  >
                    <option value="">未指派</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={s.dueDate ? s.dueDate.slice(0, 10) : ""}
                    onChange={(e) => patch(s.id, { dueDate: e.target.value || null })}
                    className="w-[128px] rounded-lg border border-input px-1 py-1 text-xs transition-colors focus:border-primary focus:outline-none"
                    title="截止日期"
                  />
                  <button
                    onClick={() => remove(s.id)}
                    className="rounded-md px-1.5 py-0.5 text-base leading-none text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600"
                    title="删除"
                  >
                    ×
                  </button>
                </>
              ) : (
                <>
                  {s.assignee && <span className="text-xs text-muted-foreground">{s.assignee.name}</span>}
                  {s.dueDate && <span className="text-xs text-muted-foreground">{formatDate(s.dueDate)}</span>}
                </>
              )}
            </div>
          );
        })}
        {items.length === 0 && (
          <p className="rounded-[10px] border border-dashed border-border py-4 text-center text-sm text-muted-foreground">暂无子任务，可将执行工作拆解为对接 / 拍摄 / 剪辑 / 发布等</p>
        )}
      </div>

      {/* 新增 */}
      {canManage && (
        <div className="mt-3 flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="新增子任务，如：达人寄样确认"
            className={inputCls}
          />
          <button onClick={add} disabled={busy || !newTitle.trim()} className={btnPrimary}>
            添加
          </button>
        </div>
      )}

      {doneConfirm && (
        <ConfirmDialog
          title="子任务标记完成"
          message={`子任务：${doneConfirm.title}\n\n确认将其标记为完成吗？`}
          confirmText="确认完成"
          onClose={() => setDoneConfirm(null)}
          onConfirm={async () => { const s = doneConfirm; setDoneConfirm(null); await patch(s.id, { status: "DONE" }); }}
        />
      )}

      {blockTarget && (
        <ConfirmDialog
          title={`阻塞子任务「${blockTarget.title}」`}
          message="标为阻塞后，阻塞超 24 小时未解除将提醒工单负责人。请填写阻塞原因："
          needReason
          reasonLabel="阻塞原因"
          reasonPlaceholder="如：等达人回复档期"
          confirmText="确认阻塞"
          onClose={() => setBlockTarget(null)}
          onConfirm={async (reason) => {
            const s = blockTarget;
            setBlockTarget(null);
            await patch(s.id, { status: "BLOCKED", blockedReason: reason });
          }}
        />
      )}
    </div>
  );
}
