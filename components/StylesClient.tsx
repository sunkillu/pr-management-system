"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RecordTimestamps from "@/components/RecordTimestamps";
import StateHistory from "@/components/StateHistory";
import type { TimelineItem } from "@/components/ApprovalTimeline";

type StyleRow = {
  id: string;
  name: string;
  isActive: boolean;
  usedCount: number;
  createdAt: string;
  updatedAt: string;
  history: TimelineItem[];
};

export default function StylesClient({ initialStyles }: { initialStyles: StyleRow[] }) {
  const router = useRouter();
  const [styles, setStyles] = useState(initialStyles);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setStyles(initialStyles), [initialStyles]);

  async function request(url: string, method: string, body?: unknown) {
    setError("");
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "操作失败");
      return false;
    }
    router.refresh();
    return true;
  }

  async function add() {
    if (!name.trim()) return setError("款式名称不能为空");
    setBusy(true);
    if (await request("/api/styles", "POST", { name: name.trim() })) setName("");
    setBusy(false);
  }

  async function saveEdit(s: StyleRow) {
    if (!editName.trim()) return setError("款式名称不能为空");
    if (editName.trim() === s.name) return setEditingId("");
    if (s.usedCount > 0 && !confirm(`「${s.name}」已被 ${s.usedCount} 张工单使用，改名后这些工单会同步显示为「${editName.trim()}」，确定吗？`)) return;
    if (await request(`/api/styles/${s.id}`, "PATCH", { name: editName.trim() })) setEditingId("");
  }

  const visible = styles.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">款式管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          维护工单中可选择的款式。停用后新建工单不再可选，已有工单不受影响。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className="w-64 rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="新款式名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button
          onClick={add}
          disabled={busy}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "添加中…" : "添加款式"}
        </button>
        <input
          className="ml-auto w-56 rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="搜索款式"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">款式名称</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">工单使用</th>
              <th className="px-4 py-3 font-medium">时间</th>
              <th className="px-4 py-3 font-medium">操作历史</th>
              <th className="px-4 py-3 font-medium" style={{ width: 200 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">
                  {editingId === s.id ? (
                    <input
                      autoFocus
                      className="w-44 rounded-md border border-border bg-background px-2 py-1 text-sm"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(s);
                        if (e.key === "Escape") setEditingId("");
                      }}
                    />
                  ) : (
                    s.name
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${s.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {s.isActive ? "启用" : "停用"}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums">{s.usedCount}</td>
                <td className="px-4 py-3"><RecordTimestamps createdAt={s.createdAt} updatedAt={s.updatedAt} compact /></td>
                <td className="px-4 py-3"><StateHistory items={s.history} label="查看" /></td>
                <td className="px-4 py-3">
                  <div className="flex gap-3">
                    {editingId === s.id ? (
                      <>
                        <button onClick={() => saveEdit(s)} className="text-xs text-primary hover:underline">保存</button>
                        <button onClick={() => setEditingId("")} className="text-xs text-muted-foreground hover:underline">取消</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingId(s.id); setEditName(s.name); setError(""); }} className="text-xs text-primary hover:underline">改名</button>
                        <button onClick={() => request(`/api/styles/${s.id}`, "PATCH", { isActive: !s.isActive })} className="text-xs text-primary hover:underline">
                          {s.isActive ? "停用" : "启用"}
                        </button>
                        <button
                          onClick={() => confirm(`删除款式「${s.name}」？`) && request(`/api/styles/${s.id}`, "DELETE")}
                          className="text-xs text-red-600 hover:underline"
                        >
                          删除
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">暂无款式</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
