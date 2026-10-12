"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls, btnPrimary, btnSecondary, Field } from "./ui";
import { formatDateTime, MATERIAL_TYPE_OPTIONS, materialTypeLabels } from "@/lib/labels";

type Material = {
  id: string;
  type: string;
  url: string;
  note: string | null;
  tagIds: string[];
  createdAt: string;
  uploadedBy: { name: string } | null;
};

type TagOption = { id: string; name: string };

export default function TicketMaterials({
  ticketId,
  initial,
  canManage,
  materialTags,
  tagMap,
}: {
  ticketId: string;
  initial: Material[];
  canManage: boolean;
  materialTags: TagOption[];
  tagMap: Record<string, string>;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("NOTE_LINK");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [filterTag, setFilterTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleTag(id: string) {
    setTagIds((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }

  const visibleItems = filterTag ? items.filter((m) => m.tagIds.includes(filterTag)) : items;

  async function submit() {
    setError("");
    if (!url.trim()) {
      setError("请填写素材链接");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, url: url.trim(), note: note.trim() || null, tagIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "提交失败");
        return;
      }
      setItems((list) => [
        ...list,
        {
          id: data.id,
          type: data.type,
          url: data.url,
          note: data.note,
          tagIds: data.tagIds ?? [],
          createdAt: data.createdAt,
          uploadedBy: data.uploadedBy,
        },
      ]);
      setOpen(false);
      setType("NOTE_LINK"); setUrl(""); setNote(""); setTagIds([]);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-gray-600">
        <span>
          已回收 <span className="font-semibold text-gray-900">{items.length}</span> 条素材
        </span>
        {items.length === 0 && (
          <span className="text-xs text-amber-600">标记完成前至少回收 1 条素材</span>
        )}
        {materialTags.length > 0 && (
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="ml-auto rounded border border-gray-300 px-2 py-1 text-xs"
          >
            <option value="">按标签筛选</option>
            {materialTags.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-2">
        {visibleItems.map((m) => (
          <div key={m.id} className="rounded-[10px] border border-[#e5e5e5] p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 ring-1 ring-inset ring-black/[0.04]">
                {materialTypeLabels[m.type] ?? m.type}
              </span>
              <span className="text-xs text-gray-500">
                {m.uploadedBy?.name ?? ""} · {formatDateTime(m.createdAt)}
              </span>
            </div>
            <div className="mt-1.5">
              <a href={m.url} target="_blank" className="break-all text-[#0071e3] hover:underline">
                {m.url}
              </a>
            </div>
            {m.tagIds.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {m.tagIds.map((id) => (
                  <span key={id} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 ring-1 ring-emerald-200">
                    {tagMap[id] ?? "未知标签"}
                  </span>
                ))}
              </div>
            )}
            {m.note && <p className="mt-1 whitespace-pre-wrap text-xs text-gray-600">{m.note}</p>}
          </div>
        ))}
        {visibleItems.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-400">
            {filterTag ? "该标签下暂无素材" : "暂无回收素材"}
          </p>
        )}
      </div>

      {canManage && (
        <div className="mt-3">
          {!open ? (
            <button className={btnPrimary} onClick={() => setOpen(true)}>
              回收素材
            </button>
          ) : (
            <div className="rounded-[10px] border border-[#e5e5e5] p-3">
              <Field label="素材类型" required>
                <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
                  {MATERIAL_TYPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="素材链接" required>
                <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://" />
              </Field>
              <Field label="备注">
                <textarea className={inputCls} rows={2} value={note}
                  onChange={(e) => setNote(e.target.value)} placeholder="如：小红书首篇笔记，已发布" />
              </Field>
              {materialTags.length > 0 && (
                <Field label="打标签" hint="可多选">
                  <div className="flex flex-wrap gap-2">
                    {materialTags.map((t) => (
                      <label
                        key={t.id}
                        className={`cursor-pointer rounded-full px-3 py-1 text-xs ring-1 ${
                          tagIds.includes(t.id)
                            ? "bg-emerald-600 text-white ring-emerald-600"
                            : "bg-white text-gray-700 ring-gray-300 hover:ring-emerald-400"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={tagIds.includes(t.id)}
                          onChange={() => toggleTag(t.id)}
                        />
                        {t.name}
                      </label>
                    ))}
                  </div>
                </Field>
              )}
              {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <button className={btnSecondary} onClick={() => setOpen(false)}>取消</button>
                <button className={btnPrimary} disabled={saving} onClick={submit}>
                  {saving ? "保存中…" : "保存素材"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
