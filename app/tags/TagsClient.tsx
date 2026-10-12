"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls, btnPrimary, btnSecondary, btnDanger } from "@/components/ui";

type Tag = { id: string; name: string; sort: number };
type Category = { id: string; name: string; key: string; sort: number; tags: Tag[] };

export default function TagsClient({ initial }: { initial: Category[] }) {
  const router = useRouter();
  const [cats, setCats] = useState(initial);
  const [activeId, setActiveId] = useState(initial[0]?.id ?? "");
  const [newCatName, setNewCatName] = useState("");
  const [newCatKey, setNewCatKey] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");

  const active = cats.find((c) => c.id === activeId);

  async function call(url: string, method: string, body?: unknown) {
    setError("");
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "操作失败");
      return null;
    }
    return data;
  }

  async function addCategory() {
    const data = await call("/api/tags/categories", "POST", { name: newCatName, key: newCatKey });
    if (!data) return;
    setCats([...cats, { ...data, tags: [] }]);
    setActiveId(data.id);
    setNewCatName(""); setNewCatKey("");
    router.refresh();
  }

  async function renameCategory() {
    if (!active) return;
    const name = prompt("种类新名称", active.name);
    if (!name || name === active.name) return;
    const data = await call(`/api/tags/categories/${active.id}`, "PATCH", { name });
    if (!data) return;
    setCats(cats.map((c) => (c.id === active.id ? { ...c, name: data.name } : c)));
  }

  async function deleteCategory() {
    if (!active) return;
    if (!confirm(`删除种类「${active.name}」会同时删除其下 ${active.tags.length} 个标签，确定？`)) return;
    const data = await call(`/api/tags/categories/${active.id}`, "DELETE");
    if (!data) return;
    const rest = cats.filter((c) => c.id !== active.id);
    setCats(rest);
    setActiveId(rest[0]?.id ?? "");
    router.refresh();
  }

  async function addTag() {
    if (!active) return;
    const data = await call("/api/tags", "POST", { name: newTagName, categoryId: active.id });
    if (!data) return;
    setCats(cats.map((c) => (c.id === active.id ? { ...c, tags: [...c.tags, data] } : c)));
    setNewTagName("");
    router.refresh();
  }

  async function saveTagName(tag: Tag) {
    const data = await call(`/api/tags/${tag.id}`, "PATCH", { name: editName });
    if (!data) return;
    setCats(cats.map((c) =>
      c.id === activeId ? { ...c, tags: c.tags.map((t) => (t.id === tag.id ? data : t)) } : c
    ));
    setEditingTag(null);
    router.refresh();
  }

  async function deleteTag(tag: Tag) {
    if (!confirm(`删除标签「${tag.name}」？已打的历史标签不受影响。`)) return;
    const data = await call(`/api/tags/${tag.id}`, "DELETE");
    if (!data) return;
    setCats(cats.map((c) =>
      c.id === activeId ? { ...c, tags: c.tags.filter((t) => t.id !== tag.id) } : c
    ));
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      {/* 种类列表 */}
      <div className="rounded-2xl bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold">标签种类</h3>
        <div className="space-y-1">
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                c.id === activeId ? "bg-[#0071e3] text-white" : "hover:bg-[#f5f5f7]"
              }`}
            >
              <div className="font-medium">{c.name}</div>
              <div className={`text-xs ${c.id === activeId ? "text-blue-100" : "text-gray-400"}`}>
                {c.key} · {c.tags.length} 个标签
              </div>
            </button>
          ))}
        </div>
        <div className="mt-4 border-t border-[#e5e5e5] pt-3">
          <input className={inputCls} value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
            placeholder="种类名称，如：内容标签" />
          <input className={`${inputCls} mt-2`} value={newCatKey} onChange={(e) => setNewCatKey(e.target.value.toUpperCase())}
            placeholder="key，如：CONTENT（大写字母）" />
          <button className={`${btnPrimary} mt-2 w-full`} onClick={addCategory}>新增种类</button>
        </div>
      </div>

      {/* 标签管理 */}
      <div className="rounded-2xl bg-white p-4 lg:col-span-3">
        {!active ? (
          <p className="py-8 text-center text-sm text-gray-400">暂无标签种类，请先新增</p>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{active.name}（{active.key}）</h3>
              <div className="flex gap-2">
                <button className={btnSecondary} onClick={renameCategory}>改名</button>
                <button className={btnDanger} onClick={deleteCategory}>删除种类</button>
              </div>
            </div>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
            <div className="mb-4 flex gap-2">
              <input className={inputCls} value={newTagName} onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addTag(); }}
                placeholder="新标签名，回车添加" />
              <button className={btnPrimary} onClick={addTag}>添加标签</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {active.tags.map((t) => (
                <span key={t.id}
                  className="flex items-center gap-1 rounded-full bg-[#f5f5f7] px-3 py-1.5 text-sm ring-1 ring-[#e5e5e5]">
                  {editingTag === t.id ? (
                    <>
                      <input
                        className="w-24 rounded border border-gray-300 px-1 py-0.5 text-sm"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveTagName(t); }}
                        autoFocus
                      />
                      <button className="text-[#0071e3]" onClick={() => saveTagName(t)}>✓</button>
                      <button className="text-gray-400" onClick={() => setEditingTag(null)}>✕</button>
                    </>
                  ) : (
                    <>
                      {t.name}
                      <button className="text-gray-400 hover:text-[#0071e3]"
                        onClick={() => { setEditingTag(t.id); setEditName(t.name); }} title="改名">✎</button>
                      <button className="text-gray-400 hover:text-red-600"
                        onClick={() => deleteTag(t)} title="删除">×</button>
                    </>
                  )}
                </span>
              ))}
              {active.tags.length === 0 && (
                <p className="text-sm text-gray-400">暂无标签</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
