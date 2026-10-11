"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls, labelCls, btnPrimary, btnSecondary, Field } from "./ui";
import { PLATFORM_TAG_OPTIONS, INFLUENCER_TYPE_OPTIONS, roleLabels } from "@/lib/labels";
import Modal from "./Modal";

type Approver = { id: string; name: string; email: string; role: string };
type Attachment = { fileUrl: string; fileName: string };

const isImage = (name: string) => /\.(jpe?g|png|webp|gif)$/i.test(name);

// initial：从合作需求一键加入时预填 { influencerType, platforms }
// autoOpen：带预填参数打开页面时自动弹出表单
export default function InfluencerForm({
  initial,
  autoOpen,
}: {
  initial?: { influencerType?: string; platforms?: string[] };
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!!autoOpen);
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [name, setName] = useState("");
  const [influencerType, setInfluencerType] = useState(initial?.influencerType ?? "");
  const [platforms, setPlatforms] = useState<string[]>(initial?.platforms ?? []);
  const [contactInfo, setContactInfo] = useState("");
  const [homepageId, setHomepageId] = useState("");
  const [bio, setBio] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function uploadFiles(files: File[]) {
    setUploading(true);
    setError("");
    try {
      const results: PromiseSettledResult<Attachment>[] = [];
      for (let start = 0; start < files.length; start += 3) {
        const batch = files.slice(start, start + 3);
        results.push(
          ...(await Promise.allSettled(
            batch.map(async (file) => {
              const form = new FormData();
              form.append("file", file);
              const res = await fetch("/api/uploads", { method: "POST", body: form });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data.error || `${file.name} 上传失败`);
              if (typeof data.fileUrl !== "string" || typeof data.fileName !== "string") {
                throw new Error(`${file.name} 上传响应无效`);
              }
              return { fileUrl: data.fileUrl, fileName: data.fileName } satisfies Attachment;
            }),
          )),
        );
      }
      const uploaded = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      if (uploaded.length > 0) {
        setAttachments((current) => [...current, ...uploaded]);
      }
      const failures = results.flatMap((result) =>
        result.status === "rejected"
          ? [result.reason instanceof Error ? result.reason.message : "附件上传失败"]
          : [],
      );
      if (failures.length > 0) {
        setError(failures.join("；"));
      }
    } finally {
      setUploading(false);
    }
  }

  function addTag() {
    const t = tagInput.trim();
    if (!t) return;
    if (!tags.includes(t)) setTags([...tags, t].slice(0, 20));
    setTagInput("");
  }

  useEffect(() => {
    if (open && !autoOpen) {
      fetch("/api/approvers?roles=PR_MANAGER")
        .then((r) => r.json())
        .then((d) => {
          if (!Array.isArray(d)) throw new Error("审批人列表加载失败");
          setApprovers(d);
        })
        .catch(() => setError("审批人列表加载失败，请关闭后重试"));
    }
  }, [open, autoOpen]);

  const toggle = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  async function submit() {
    setError("");
    if (!name.trim()) return setError("达人姓名不能为空");
    if (attachments.length === 0) return setError("请至少上传一张参考图或附件");
    if (uploading) return setError("请等待附件上传完成");
    if (!autoOpen && selected.length === 0) return setError("请选择至少一位审批人");
    setSaving(true);
    try {
      const res = await fetch("/api/influencers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          influencerType: influencerType || null,
          platforms,
          contactInfo: contactInfo.trim() || null,
          homepageId: homepageId.trim() || null,
          bio: bio.trim() || null,
          tags,
          attachments,
          direct: autoOpen,
          approverIds: autoOpen ? [] : selected,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "提交失败");
        return;
      }
      setOpen(false);
      if (autoOpen) router.push("/partners?tab=influencer");
      else router.refresh();
    } catch {
      setError("提交失败，请检查网络后重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button className={btnPrimary} onClick={() => setOpen(true)}>
        {autoOpen ? "免审加入达人库" : "提报达人"}
      </button>
      {open && (
        <Modal title={autoOpen ? "免审加入达人库" : "提报达人登记"} onClose={() => setOpen(false)}>
          <Field label="达人姓名" required>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="如：美妆老王" />
          </Field>
          <Field label="达人类型">
            <select className={inputCls} value={influencerType} onChange={(e) => setInfluencerType(e.target.value)}>
              <option value="">请选择</option>
              {INFLUENCER_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field label="平台标签（可多选）">
            <div className="flex flex-wrap gap-3">
              {PLATFORM_TAG_OPTIONS.map((p) => (
                <label key={p.value} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={platforms.includes(p.value)}
                    onChange={() => setPlatforms(toggle(platforms, p.value))}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </Field>
          <Field label="联系方式">
            <input className={inputCls} value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} />
          </Field>
          <Field label="达人主页ID" hint="如小红书号/抖音号，发起工单时自动带入">
            <input className={inputCls} value={homepageId} onChange={(e) => setHomepageId(e.target.value)} />
          </Field>
          <Field label="简介">
            <textarea className={inputCls} rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
          </Field>
          <Field label="达人标签" hint="如：美妆垂类、母婴、高转化，可自定义添加">
            <div className="flex gap-2">
              <input
                className={inputCls}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="输入标签后回车或点添加"
              />
              <button type="button" className={btnSecondary} onClick={addTag}>添加</button>
            </div>
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span key={t} className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700 ring-1 ring-blue-200">
                    {t}
                    <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))}
                      className="text-blue-400 hover:text-blue-700" title="移除">×</button>
                  </span>
                ))}
              </div>
            )}
          </Field>
          <Field label="附件（参考图）" required hint="至少上传一张达人主页截图或过往作品">
            <input
              type="file"
              accept="image/*,.pdf"
              multiple
              disabled={uploading}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (attachments.length + files.length > 20) {
                  setError("参考图和附件最多上传 20 个");
                } else {
                  void uploadFiles(files);
                }
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
                        className="flex h-full w-full items-center justify-center bg-[#f5f5f7] px-1 text-center text-[10px] text-[#0071e3]">
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
          {!autoOpen && <Field label="审批人（多选，任一通过即通过）" required>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-gray-200 p-2">
              {approvers.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(a.id)}
                    onChange={() => setSelected(toggle(selected, a.id))}
                  />
                  {a.name}
                  <span className="text-xs text-gray-500">（{roleLabels[a.role] ?? a.role}）</span>
                </label>
              ))}
              {approvers.length === 0 && <p className="text-xs text-gray-400">暂无可选审批人</p>}
            </div>
          </Field>}
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnSecondary} onClick={() => setOpen(false)}>取消</button>
            <button className={btnPrimary} disabled={saving} onClick={submit}>
              {saving ? "提交中…" : autoOpen ? "直接加入" : "提交登记"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
