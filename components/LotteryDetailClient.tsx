"use client";
import { useCallback, useEffect, useState } from "react";
import { cardCls, inputCls, btnPrimary, btnSecondary, btnDanger, thCls, tdCls, Field, Section } from "./ui";

type PrizeItem = { name: string; quantity: number };
type Lottery = {
  id: string; title: string; description: string | null;
  prizeItems: PrizeItem[]; status: "DRAFT" | "ACTIVE" | "ENDED";
  createdBy: { name: string | null };
  winners: { id: string; prizeName: string; drawnAt: string; entry: { name: string; contact: string | null }; drawnBy: { name: string | null } }[];
  _count: { entries: number };
};
type Entry = { id: string; name: string; contact: string | null; influencer: { id: string; name: string } | null };

const STATUS_LABEL: Record<string, string> = { DRAFT: "草稿", ACTIVE: "进行中", ENDED: "已结束" };

export default function LotteryDetailClient({ lotteryId, canManage }: { lotteryId: string; canManage: boolean }) {
  const [lottery, setLottery] = useState<Lottery | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/lottery/${lotteryId}`);
    if (r.ok) setLottery(await r.json());
    const e = await fetch(`/api/lottery/${lotteryId}/entries`);
    if (e.ok) setEntries(await e.json());
  }, [lotteryId]);
  useEffect(() => { load(); }, [load]);

  const join = async () => {
    setMsg(""); setBusy(true);
    const r = await fetch(`/api/lottery/${lotteryId}/entries`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, contact }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { setMsg(d.error ?? "登记失败"); return; }
    setName(""); setContact(""); setMsg("登记成功"); load();
  };

  const setStatus = async (status: string, confirmMsg: string) => {
    if (!window.confirm(confirmMsg)) return;
    const r = await fetch(`/api/lottery/${lotteryId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!r.ok) { alert((await r.json()).error ?? "操作失败"); return; }
    load();
  };

  const draw = async () => {
    if (!window.confirm(`确认为 ${entries.length} 位参与者开奖？开奖后活动自动结束，不可重复。`)) return;
    setBusy(true);
    const r = await fetch(`/api/lottery/${lotteryId}/draw`, { method: "POST" });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { alert(d.error ?? "开奖失败"); return; }
    alert(`开奖完成，共 ${d.total} 位中奖`);
    load();
  };

  if (!lottery) return <div className={`${cardCls} p-8 text-center text-gray-500`}>加载中…</div>;

  return (
    <div className="space-y-4">
      <div className={`${cardCls} p-6`}>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold">{lottery.title}</h2>
            <p className="text-sm text-gray-500 mt-1">状态：{STATUS_LABEL[lottery.status]} · 创建人：{lottery.createdBy?.name ?? "-"}</p>
            {lottery.description && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{lottery.description}</p>}
            <p className="text-sm mt-2">奖品：{lottery.prizeItems.map((p) => `${p.name}×${p.quantity}`).join("、")}</p>
          </div>
          {canManage && (
            <div className="flex gap-2">
              {lottery.status === "DRAFT" && <button className={btnPrimary} onClick={() => setStatus("ACTIVE", "开始活动？开始后可接受参与登记。")}>开始活动</button>}
              {lottery.status === "ACTIVE" && (
                <>
                  <button className={btnDanger} disabled={busy} onClick={draw}>开奖</button>
                  <button className={btnSecondary} onClick={() => setStatus("ENDED", "直接结束活动？结束后不可再参与/开奖。")}>结束</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <Section title={`参与登记（${lottery._count.entries} 人）`}>
        {lottery.status === "ACTIVE" ? (
          <div className="flex gap-2 flex-wrap items-end">
            <Field label="姓名"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="参与者姓名" /></Field>
            <Field label="联系方式"><input className={inputCls} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="手机/微信（选填）" /></Field>
            <button className={btnPrimary} disabled={busy || !name.trim()} onClick={join}>登记参与</button>
            {msg && <span className="text-sm text-gray-600">{msg}</span>}
          </div>
        ) : (
          <p className="text-sm text-gray-500">{lottery.status === "DRAFT" ? "活动尚未开始，暂不可参与。" : "活动已结束。"}</p>
        )}
        {entries.length > 0 && (
          <table className="w-full mt-3">
            <thead><tr><th className={thCls}>姓名</th><th className={thCls}>联系方式</th><th className={thCls}>关联达人</th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}><td className={tdCls}>{e.name}</td><td className={tdCls}>{e.contact ?? "-"}</td><td className={tdCls}>{e.influencer?.name ?? "-"}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`中奖名单（${lottery.winners.length} 人）`}>
        {lottery.winners.length === 0 ? (
          <p className="text-sm text-gray-500">尚未开奖</p>
        ) : (
          <table className="w-full">
            <thead><tr><th className={thCls}>奖品</th><th className={thCls}>中奖者</th><th className={thCls}>联系方式</th><th className={thCls}>开奖人</th><th className={thCls}>开奖时间</th></tr></thead>
            <tbody>
              {lottery.winners.map((w) => (
                <tr key={w.id}>
                  <td className={tdCls}>🏆 {w.prizeName}</td>
                  <td className={tdCls}>{w.entry.name}</td>
                  <td className={tdCls}>{w.entry.contact ?? "-"}</td>
                  <td className={tdCls}>{w.drawnBy?.name ?? "-"}</td>
                  <td className={tdCls}>{new Date(w.drawnAt).toLocaleString("zh-CN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}
