"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { cardCls, inputCls, labelCls, btnPrimary, btnSecondary, thCls, tdCls, Field } from "./ui";

type PrizeItem = { name: string; quantity: number };
type Lottery = {
  id: string; title: string; description: string | null;
  prizeItems: PrizeItem[]; startAt: string | null; endAt: string | null;
  status: "DRAFT" | "ACTIVE" | "ENDED";
  createdBy: { name: string | null };
  _count: { entries: number; winners: number };
};

const STATUS_LABEL: Record<string, string> = { DRAFT: "草稿", ACTIVE: "进行中", ENDED: "已结束" };
const STATUS_CLS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  ACTIVE: "bg-green-100 text-green-700",
  ENDED: "bg-blue-100 text-blue-700",
};

export default function LotteryClient({ canManage }: { canManage: boolean }) {
  const [list, setList] = useState<Lottery[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [prizes, setPrizes] = useState<PrizeItem[]>([{ name: "", quantity: 1 }]);
  const [error, setError] = useState("");

  const load = async () => {
    const r = await fetch("/api/lottery");
    if (r.ok) setList(await r.json());
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    setError("");
    const clean = prizes.map((p) => ({ name: p.name.trim(), quantity: Number(p.quantity) }));
    const r = await fetch("/api/lottery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, prizeItems: clean }),
    });
    if (!r.ok) { setError((await r.json()).error ?? "创建失败"); return; }
    setShowForm(false); setTitle(""); setDescription("");
    setPrizes([{ name: "", quantity: 1 }]); load();
  };

  return (
    <div>
      {canManage && (
        <div className="mb-4">
          <button className={btnPrimary} onClick={() => setShowForm(!showForm)}>新建抽奖活动</button>
        </div>
      )}
      {showForm && (
        <div className={`${cardCls} p-6 mb-4`}>
          <h3 className="font-semibold mb-4">新建抽奖活动</h3>
          <Field label="活动名称" required>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：618 达人回馈抽奖" />
          </Field>
          <Field label="活动说明">
            <textarea className={inputCls} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="活动规则、参与方式等" />
          </Field>
          <label className={labelCls}>奖品（必填，至少一项）</label>
          {prizes.map((p, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input className={inputCls} placeholder="奖品名称" value={p.name} onChange={(e) => {
                const n = [...prizes]; n[i] = { ...n[i], name: e.target.value }; setPrizes(n);
              }} />
              <input className={inputCls} style={{ width: 110 }} type="number" min={1} placeholder="数量" value={p.quantity} onChange={(e) => {
                const n = [...prizes]; n[i] = { ...n[i], quantity: Number(e.target.value) }; setPrizes(n);
              }} />
              <button className={btnSecondary} onClick={() => setPrizes(prizes.filter((_, j) => j !== i))}>删</button>
            </div>
          ))}
          <button className={btnSecondary} onClick={() => setPrizes([...prizes, { name: "", quantity: 1 }])}>+ 加奖品</button>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <button className={btnSecondary} onClick={() => setShowForm(false)}>取消</button>
            <button className={btnPrimary} onClick={submit}>创建（草稿）</button>
          </div>
        </div>
      )}
      <div className={`${cardCls} p-2`}>
        <table className="w-full">
          <thead><tr>
            <th className={thCls}>活动</th><th className={thCls}>状态</th>
            <th className={thCls}>奖品</th><th className={thCls}>参与/中奖</th><th className={thCls}>创建人</th>
          </tr></thead>
          <tbody>
            {list.map((l) => (
              <tr key={l.id}>
                <td className={tdCls}><Link className="text-[#0071e3] hover:underline font-medium" href={`/lottery/${l.id}`}>{l.title}</Link></td>
                <td className={tdCls}><span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CLS[l.status]}`}>{STATUS_LABEL[l.status]}</span></td>
                <td className={tdCls}>{l.prizeItems.map((p) => `${p.name}×${p.quantity}`).join("、")}</td>
                <td className={tdCls}>{l._count.entries} / {l._count.winners}</td>
                <td className={tdCls}>{l.createdBy?.name ?? "-"}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td className={tdCls} colSpan={5}>暂无抽奖活动</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
