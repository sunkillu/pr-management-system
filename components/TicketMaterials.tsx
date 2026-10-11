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
  createdAt: string;
  uploadedBy: { name: string } | null;
};

export default function TicketMaterials({
  ticketId,
  initial,
  canManage,
}: {
  ticketId: string;
  initial: Material[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("NOTE_LINK");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
        body: JSON.stringify({ type, url: url.trim(), note: note.trim() || null }),
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
          createdAt: data.createdAt,
          uploadedBy: data.uploadedBy,
        },
      ]);
      setOpen(false);
      setType("NOTE_LINK"); setUrl(""); setNote("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm text-gray-600">
        <span>
          已回收 <span className="font-semibold text-gray-900">{items.length}</span> 条素材
        </span>
        {items.length === 0 && (
          <span className="text-xs text-amber-600">标记完成前至少回收 1 条素材</span>
        )}
      </div>

      <div className="space-y-2">
        {items.map((m) => (
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
            {m.note && <p className="mt-1 whitespace-pre-wrap text-xs text-gray-600">{m.note}</p>}
          </div>
        ))}
        {items.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-400">暂无回收素材</p>
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
