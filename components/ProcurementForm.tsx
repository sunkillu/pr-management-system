"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls, btnPrimary, btnSecondary, Field } from "./ui";
import Modal from "./Modal";

export default function ProcurementForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"WEEKLY_STYLE" | "LINK_SPECIFIC">("WEEKLY_STYLE");
  const [title, setTitle] = useState("");
  const [styles, setStyles] = useState("");
  const [quantity, setQuantity] = useState("");
  const [materialType, setMaterialType] = useState("");
  const [reason, setReason] = useState("");
  const [links, setLinks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    if (!title.trim()) return setError("标题不能为空");
    const payload: Record<string, unknown> = { title: title.trim(), type };
    if (type === "WEEKLY_STYLE") {
      const arr = styles.split(/[，,\n]/).map((s) => s.trim()).filter(Boolean);
      if (arr.length === 0) return setError("请填写款式（多个用逗号分隔）");
      const q = parseInt(quantity, 10);
      if (!Number.isInteger(q) || q <= 0) return setError("请填写需求数量");
      payload.styles = arr;
      payload.quantity = q;
    } else {
      if (!materialType.trim()) return setError("请填写素材类型");
      payload.materialType = materialType.trim();
      payload.reason = reason.trim() || null;
      payload.publishLinks = links.split(/[\n，,]/).map((s) => s.trim()).filter(Boolean);
    }
    setSaving(true);
    const res = await fetch("/api/procurement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error || "提交失败");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button className={btnPrimary} onClick={() => setOpen(true)}>+ 提采买需求</button>
      {open && (
        <Modal title="提采买需求" onClose={() => setOpen(false)}>
          <Field label="采买类型" required>
            <div className="flex gap-2">
              {(["WEEKLY_STYLE", "LINK_SPECIFIC"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-full px-4 py-2 text-sm font-medium border ${type === t ? "bg-[#0071e3] text-white border-[#0071e3]" : "bg-white text-gray-600 border-gray-300"}`}
                >
                  {t === "WEEKLY_STYLE" ? "周维度款式采买" : "指定达人链接采买"}
                </button>
              ))}
            </div>
          </Field>
          <Field label="标题" required>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：第42周小红书款式采买" />
          </Field>
          {type === "WEEKLY_STYLE" ? (
            <>
              <Field label="款式（多选，逗号分隔）" required>
                <input className={inputCls} value={styles} onChange={(e) => setStyles(e.target.value)} placeholder="如：复古连衣裙，针织开衫" />
              </Field>
              <Field label="需求数量" required>
                <input className={inputCls} type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="如：20" />
              </Field>
            </>
          ) : (
            <>
              <Field label="素材类型" required>
                <input className={inputCls} value={materialType} onChange={(e) => setMaterialType(e.target.value)} placeholder="如：图文种草 / 短视频" />
              </Field>
              <Field label="需求理由">
                <textarea className={inputCls} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="为什么需要这条链接的素材" />
              </Field>
              <Field label="发布链接（每行一条）">
                <textarea className={inputCls} rows={3} value={links} onChange={(e) => setLinks(e.target.value)} placeholder="https://..." />
              </Field>
            </>
          )}
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setOpen(false)} disabled={saving}>取消</button>
            <button className={btnPrimary} onClick={submit} disabled={saving}>{saving ? "提交中…" : "提交"}</button>
          </div>
        </Modal>
      )}
    </>
  );
}
