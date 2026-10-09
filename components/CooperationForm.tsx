"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls, btnPrimary, btnSecondary, Field } from "./ui";
import { coopTypeLabels } from "@/lib/labels";
import Modal from "./Modal";

type Option = { id: string; name: string };

export default function CooperationForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [influencers, setInfluencers] = useState<Option[]>([]);
  const [artists, setArtists] = useState<Option[]>([]);
  const [type, setType] = useState("INFLUENCER_LIVE");
  const [targetId, setTargetId] = useState("");
  const [fee, setFee] = useState("");
  const [coopDate, setCoopDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      fetch("/api/influencers?status=APPROVED")
        .then((r) => r.json())
        .then((d) => setInfluencers(Array.isArray(d) ? d : []))
        .catch(() => {});
      fetch("/api/makeup-artists")
        .then((r) => r.json())
        .then((d) => setArtists(Array.isArray(d) ? d : []))
        .catch(() => {});
    }
  }, [open ]);

  async function submit() {
    setError("");
    if (!fee || Number(fee) <= 0) return setError("合作费用必须大于 0");
    if (!coopDate) return setError("合作日期不能为空");
    if (!targetId) return setError("请选择合作对象");
    setSaving(true);
    const res = await fetch("/api/cooperations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        fee,
        coopDate,
        note: note.trim() || null,
        influencerId: type === "MAKEUP" ? null : targetId,
        makeupArtistId: type === "MAKEUP" ? targetId : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error || "保存失败");
    setOpen(false);
    router.refresh();
  }

  const options = type === "MAKEUP" ? artists : influencers;

  return (
    <>
      <button className={btnPrimary} onClick={() => setOpen(true)}>新增合作记录</button>
      {open && (
        <Modal title="新增合作记录" onClose={() => setOpen(false)}>
          <Field label="合作类型" required>
            <select className={inputCls} value={type} onChange={(e) => { setType(e.target.value); setTargetId(""); }}>
              {Object.entries(coopTypeLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label={type === "MAKEUP" ? "化妆师" : "达人（仅已通过审核）"} required>
            <select className={inputCls} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
              <option value="">请选择</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </Field>
          <Field label="合作费用（元）" required>
            <input type="number" min="0" step="0.01" className={inputCls} value={fee} onChange={(e) => setFee(e.target.value)} />
          </Field>
          <Field label="合作日期" required>
            <input type="date" className={inputCls} value={coopDate} onChange={(e) => setCoopDate(e.target.value)} />
          </Field>
          <Field label="备注">
            <textarea className={inputCls} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setOpen(false)}>取消</button>
            <button className={btnPrimary} disabled={saving} onClick={submit}>
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
