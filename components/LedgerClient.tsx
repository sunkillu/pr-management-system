"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { btnPrimary, btnSecondary, btnDanger, inputCls, cardCls, Field } from "./ui";
import { platformTagLabels } from "@/lib/labels";
import ConfirmDialog from "./ConfirmDialog";

type Entry = {
  id: string;
  homeUrl: string;
  platform: string | null;
  nickname: string | null;
  accountId: string | null;
  status: "DRAFT" | "CONFIRMED";
  platforms: string[];
  photoUrl: string | null;
  budget: string | number | null;
  schedule: string | null;
  quote: string | number | null;
  sampleInfo: { diopter?: string; styles?: string; note?: string } | null;
  influencer: { id: string; name: string; homepageId: string | null } | null;
  owner: { id: string; name: string };
  updatedAt: string;
};

const emptySample = { diopter: "", styles: "", note: "" };

export default function LedgerClient() {
  const [list, setList] = useState<Entry[]>([]);
  const [homeUrl, setHomeUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [form, setForm] = useState({ nickname: "", platforms: [] as string[], photoUrl: "", budget: "", schedule: "", quote: "", sample: emptySample });
  const [confirming, setConfirming] = useState<Entry | null>(null);
  const [confirmResult, setConfirmResult] = useState<{ isNew: boolean; influencerId: string; history: unknown } | null>(null);
  const [error, setError] = useState("");

  const load = async () => {
    const r = await fetch("/api/ledger");
    if (r.ok) setList((await r.json()).list);
  };
  useEffect(() => { load(); }, []);

  const addEntry = async () => {
    if (!homeUrl.trim()) { setError("请填写主页链接"); return; }
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/ledger", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeUrl: homeUrl.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "添加失败");
      setHomeUrl("");
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const openEdit = (e: Entry) => {
    setEditing(e);
    setForm({
      nickname: e.nickname || "",
      platforms: e.platforms || [],
      photoUrl: e.photoUrl || "",
      budget: e.budget != null ? String(e.budget) : "",
      schedule: e.schedule || "",
      quote: e.quote != null ? String(e.quote) : "",
      sample: { diopter: e.sampleInfo?.diopter || "", styles: e.sampleInfo?.styles || "", note: e.sampleInfo?.note || "" },
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/ledger/${editing.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: form.nickname,
          platforms: form.platforms,
          photoUrl: form.photoUrl,
          budget: form.budget,
          schedule: form.schedule,
          quote: form.quote,
          sampleInfo: form.sample.diopter || form.sample.styles || form.sample.note ? form.sample : null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "保存失败");
      setEditing(null);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const doConfirm = async () => {
    if (!confirming) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/ledger/${confirming.id}/confirm`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "入库失败");
      setConfirmResult({ isNew: d.isNew, influencerId: d.influencerId, history: d.history });
      setConfirming(null);
      await load();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!window.confirm("确定删除这条草稿吗？")) return;
    await fetch(`/api/ledger/${id}`, { method: "DELETE" });
    await load();
  };

  const togglePlatform = (p: string) =>
    setForm((f) => ({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter((x) => x !== p) : [...f.platforms, p] }));

  const drafts = list.filter((e) => e.status === "DRAFT");
  const confirmed = list.filter((e) => e.status === "CONFIRMED");

  return (
    <div>
      {/* 添加主页链接 */}
      <div className={cardCls + " mb-5"}>
        <div className="text-sm font-semibold mb-2">添加主页链接 → 自动抓取</div>
        <div className="flex gap-2">
          <input className={inputCls} placeholder="粘贴小红书/抖音主页链接" value={homeUrl} onChange={(e) => setHomeUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addEntry()} />
          <button className={btnPrimary} disabled={busy} onClick={addEntry}>{busy ? "抓取中…" : "抓取入库"}</button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <p className="mt-2 text-xs text-gray-400">当前为 mock 抓取：从链接解析平台与账号ID，昵称标注"待补充"。预留真实抓取接口。</p>
      </div>

      {/* 草稿列表 */}
      <div className="text-sm font-semibold mb-2">草稿（{drafts.length}）</div>
      <div className="space-y-3 mb-6">
        {drafts.map((e) => (
          <div key={e.id} className={cardCls}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{e.nickname || "待补充"}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {e.platform ? platformTagLabels[e.platform] || e.platform : "未知平台"} · 账号ID：{e.accountId || "—"}
                </div>
                <div className="text-xs text-gray-400 mt-0.5 break-all">{e.homeUrl}</div>
                {(e.quote != null || e.budget != null || e.schedule) && (
                  <div className="text-xs text-gray-500 mt-1">
                    {[e.quote != null ? `报价¥${e.quote}` : null, e.budget != null ? `预算¥${e.budget}` : null, e.schedule ? `档期${e.schedule}` : null].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button className={btnSecondary} onClick={() => openEdit(e)}>补充资料</button>
                <button className={btnPrimary} onClick={() => setConfirming(e)}>确认入库</button>
                <button className={btnDanger} onClick={() => remove(e.id)}>删除</button>
              </div>
            </div>
          </div>
        ))}
        {drafts.length === 0 && <p className="text-sm text-gray-400">暂无草稿，粘贴主页链接开始。</p>}
      </div>

      {/* 已入库 */}
      {confirmed.length > 0 && (
        <>
          <div className="text-sm font-semibold mb-2">已入库（{confirmed.length}）</div>
          <div className="space-y-3">
            {confirmed.map((e) => (
              <div key={e.id} className={cardCls + " opacity-80"}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold">{e.influencer?.name || e.nickname}</span>
                    <span className="ml-2 text-xs text-green-600">✓ 已入库</span>
                  </div>
                  {e.influencer && (
                    <Link className="text-sm text-[#0071e3] hover:underline" href={`/influencers/${e.influencer.id}`}>查看达人详情 →</Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 补充资料弹窗 */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-semibold mb-4">补充资料</div>
            <div className="space-y-3">
              <Field label="昵称"><input className={inputCls} value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} /></Field>
              <Field label="平台（双选）">
                <div className="flex gap-2">
                  {["XIAOHONGSHU", "DOUYIN"].map((p) => (
                    <label key={p} className={`px-3 py-1.5 rounded-full border text-sm cursor-pointer ${form.platforms.includes(p) ? "border-[#0071e3] text-[#0071e3] bg-blue-50" : "border-gray-200 text-gray-500"}`}>
                      <input type="checkbox" className="hidden" checked={form.platforms.includes(p)} onChange={() => togglePlatform(p)} />
                      {platformTagLabels[p]}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="照片链接"><input className={inputCls} value={form.photoUrl} onChange={(e) => setForm({ ...form, photoUrl: e.target.value })} placeholder="http…" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="报价（元）"><input className={inputCls} type="number" value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} /></Field>
                <Field label="预算（元）"><input className={inputCls} type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></Field>
              </div>
              <Field label="档期"><input className={inputCls} value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} placeholder="如：下周可约" /></Field>
              <div className="border-t pt-3">
                <div className="text-sm font-medium mb-2">寄品位（预留）</div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="度数"><input className={inputCls} value={form.sample.diopter} onChange={(e) => setForm({ ...form, sample: { ...form.sample, diopter: e.target.value } })} /></Field>
                  <Field label="需寄款式"><input className={inputCls} value={form.sample.styles} onChange={(e) => setForm({ ...form, sample: { ...form.sample, styles: e.target.value } })} /></Field>
                </div>
                <Field label="寄品信息"><input className={inputCls} value={form.sample.note} onChange={(e) => setForm({ ...form, sample: { ...form.sample, note: e.target.value } })} /></Field>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className={btnSecondary} onClick={() => setEditing(null)}>取消</button>
              <button className={btnPrimary} disabled={busy} onClick={saveEdit}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 确认入库二次确认 */}
      {confirming && !confirmResult && (
        <ConfirmDialog
          title="确认入库"
          message={`将「${confirming.nickname || "待补充"}」（账号ID：${confirming.accountId || "—"}）确认入库。\n系统将按账号ID比对总库：命中为老达人（关联现有），未命中创建新达人。`}
          confirmText="确认入库"
          onConfirm={doConfirm}
          onClose={() => setConfirming(null)}
          busy={busy}
        />
      )}

      {/* 入库结果：老/新达人 */}
      {confirmResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmResult(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-semibold mb-2">{confirmResult.isNew ? "新达人已入库" : "识别为老达人，已关联"}</div>
            {!confirmResult.isNew && (
              <p className="text-sm text-gray-500 mb-3">该账号ID已在总库中，本次关联到现有达人，未重复创建。可一键查看过往合作记录。</p>
            )}
            <div className="flex justify-end gap-2">
              <button className={btnSecondary} onClick={() => setConfirmResult(null)}>关闭</button>
              <Link className={btnPrimary} href={`/influencers/${confirmResult.influencerId}`}>查看达人详情</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
