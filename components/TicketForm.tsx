"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls, btnPrimary, btnSecondary, Field } from "./ui";
import { roleLabels, coopTypeLabels } from "@/lib/labels";
import Modal from "./Modal";

type Approver = { id: string; name: string; email: string; role: string };
type Partner = { id: string; name: string };
type Attachment = { fileUrl: string; fileName: string };

const isImage = (name: string) => /\.(jpe?g|png|webp|gif)$/i.test(name);

export default function TicketForm({
  influencers,
  makeupArtists,
}: {
  influencers: Partner[];
  makeupArtists: Partner[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("INFLUENCER_POST");
  const [partnerId, setPartnerId] = useState("");
  const [budgetFee, setBudgetFee] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function uploadFile(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) {
      setError(data.error || "插图上传失败");
      return;
    }
    setAttachments((a) => [...a, { fileUrl: data.fileUrl, fileName: data.fileName }]);
  }

  useEffect(() => {
    if (open) {
      fetch("/api/approvers?roles=PR_MANAGER,ADMIN")
        .then((r) => r.json())
        .then((d) => setApprovers(Array.isArray(d) ? d : []))
        .catch(() => setApprovers([]));
    }
  }, [open ]);

  const partners = type === "MAKEUP" ? makeupArtists : influencers;

  async function submit(submitForApproval: boolean) {
    setError("");
    if (!title.trim()) return setError("标题不能为空");
    if (!partnerId) return setError("请选择合作对象");
    if (!budgetFee || Number(budgetFee) <= 0) return setError("预算费用必须大于 0");
    if (submitForApproval && selected.length === 0) return setError("提交审批必须选择至少一位审批人");
    setSaving(true);
    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        type,
        influencerId: type === "MAKEUP" ? null : partnerId,
        makeupArtistId: type === "MAKEUP" ? partnerId : null,
        budgetFee,
        startDate: startDate || null,
        endDate: endDate || null,
        note: note.trim() || null,
        approverIds: selected,
        submit: submitForApproval,
        attachments,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error || "提交失败");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button className={btnPrimary} onClick={() => setOpen(true)}>
        发起合作工单
      </button>
      {open && (
        <Modal title="发起合作工单" onClose={() => setOpen(false)}>
          <Field label="标题" required hint="如：双11美妆老王达播合作">
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="合作类型" required>
            <select className={inputCls} value={type} onChange={(e) => { setType(e.target.value); setPartnerId(""); }}>
              {Object.entries(coopTypeLabels).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </Field>
          <Field label={type === "MAKEUP" ? "合作化妆师" : "合作达人"} required
            hint={type === "MAKEUP" ? "" : "仅可选择已通过审核的达人"}>
            <select className={inputCls} value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
              <option value="">请选择</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="预算费用（元）" required>
              <input type="number" min={0.01} step="0.01" className={inputCls}
                value={budgetFee} onChange={(e) => setBudgetFee(e.target.value)} />
            </Field>
            <Field label="档期开始">
              <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="档期结束">
              <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
          <Field label="备注">
            <textarea className={inputCls} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <Field label="插图 / 附件" hint="可上传产品图、参考图等，图片会显示缩略图">
            <input
              type="file"
              accept="image/*,.pdf"
              multiple
              disabled={uploading}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                files.forEach((f) => uploadFile(f));
                e.target.value = "";
              }}
              className="text-sm"
            />
            {uploading && <p className="mt-1 text-xs text-gray-500">上传中…</p>}
            {attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {attachments.map((a, i) => (
                  <div key={i} className="relative h-20 w-20 overflow-hidden rounded border border-gray-200">
                    {isImage(a.fileName) ? (
                      <a href={a.fileUrl} target="_blank" title={a.fileName}>
                        <img src={a.fileUrl} alt={a.fileName} className="h-full w-full object-cover" />
                      </a>
                    ) : (
                      <a href={a.fileUrl} target="_blank" title={a.fileName}
                        className="flex h-full w-full items-center justify-center bg-gray-50 px-1 text-center text-[10px] text-blue-600">
                        {a.fileName}
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}
                      className="absolute right-0 top-0 rounded-bl bg-black/60 px-1 text-xs text-white"
                      title="移除"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Field>
          <Field label="审批人（可多选，或签）" hint="提交审批时必填">
            <div className="max-h-36 space-y-1 overflow-y-auto rounded border border-gray-200 p-2">
              {approvers.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(a.id)}
                    onChange={() =>
                      setSelected(selected.includes(a.id) ? selected.filter((x) => x !== a.id) : [...selected, a.id])
                    }
                  />
                  {a.name} <span className="text-xs text-gray-500">({roleLabels[a.role as never] ?? a.role})</span>
                </label>
              ))}
              {approvers.length === 0 && <p className="text-xs text-gray-400">暂无可选审批人</p>}
            </div>
          </Field>
          <p className="mb-3 rounded bg-blue-50 p-2 text-xs text-blue-800">
            提交审批后将按合作类型自动生成进度节点（寄品→执行→发布→数据回收）。
          </p>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setOpen(false)}>取消</button>
            <button type="button" className={btnSecondary} disabled={saving} onClick={() => submit(false)}>
              {saving ? "保存中…" : "存为草稿"}
            </button>
            <button type="button" className={btnPrimary} disabled={saving} onClick={() => submit(true)}>
              {saving ? "提交中…" : "提交审批"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
