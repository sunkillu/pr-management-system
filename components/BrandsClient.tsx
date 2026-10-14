"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/labels";
import ApprovalTimeline, { TimelineItem } from "@/components/ApprovalTimeline";

type Brand = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
  history: TimelineItem[];
};

export default function BrandsClient({ initialBrands }: { initialBrands: Brand[] }) {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>(initialBrands);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setBrands(initialBrands); }, [initialBrands]);

  async function add() {
    if (!name.trim()) return setError("品牌名称不能为空");
    setError(""); setBusy(true);
    const res = await fetch("/api/brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "添加失败");
    setName("");
    router.refresh();
  }

  async function toggle(b: Brand) {
    const res = await fetch(`/api/brands/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !b.isActive }),
    });
    if (res.ok) router.refresh();
  }

  async function remove(b: Brand) {
    if (!confirm(`删除品牌「${b.name}」？`)) return;
    setError("");
    const res = await fetch(`/api/brands/${b.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error || "删除失败");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">品牌管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">仅管理员可维护。每张工单必须归属一个品牌。</p>
      </div>

      <div className="flex gap-2">
        <input
          className="w-64 rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="新品牌名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button
          onClick={add}
          disabled={busy}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "添加中…" : "添加品牌"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">品牌名称</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">创建时间</th>
              <th className="px-4 py-3 font-medium">最近修改</th>
              <th className="px-4 py-3 font-medium">状态历史</th>
              <th className="px-4 py-3 font-medium" style={{ width: 180 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{b.name}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${b.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {b.isActive ? "启用" : "停用"}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(b.createdAt)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{b.updatedAt ? formatDateTime(b.updatedAt) : "历史时间未记录"}</td>
                <td className="px-4 py-3">
                  <details>
                    <summary className="cursor-pointer text-xs text-primary hover:underline">查看（{b.history.length}）</summary>
                    <div className="mt-2 max-h-64 overflow-auto rounded border bg-background p-3">
                      <ApprovalTimeline items={b.history} />
                    </div>
                  </details>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => toggle(b)} className="text-xs text-primary hover:underline">
                      {b.isActive ? "停用" : "启用"}
                    </button>
                    <button onClick={() => remove(b)} className="text-xs text-red-600 hover:underline">
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {brands.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">暂无品牌</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
