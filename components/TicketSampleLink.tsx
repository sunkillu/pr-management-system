"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { btnPrimary, btnSecondary, inputCls } from "@/components/ui";
import ConfirmDialog from "./ConfirmDialog";
import { sampleStatusLabels, badgeClass } from "@/lib/labels";
import { shipItemSummary, type ShipItem } from "@/lib/ship-items";

type Sample = {
  id: string;
  sampleNo: string;
  productName: string;
  quantity: number;
  status: string;
  trackingNo: string | null;
  receiverName: string | null;
  receiverPhone: string | null;
  receiverAddress: string | null;
  infoConfirmed: boolean;
  createdAt: Date | string;
  shippedAt: Date | string | null;
  signedAt: Date | string | null;
};

type Props = {
  ticketId: string;
  ticketTitle: string;
  ticketStatus: string;
  shipItems: ShipItem[];
  samples: Sample[];
  influencerName: string;
  canCreate: boolean;
};

// 工单寄品：从寄品明细一键生成寄件请求；已生成的显示状态
// 仅工单审批通过后（IN_PROGRESS 及之后）可发起寄件
const SAMPLE_CREATABLE = ["IN_PROGRESS", "MATERIAL_REVIEW", "COMPLETED", "SETTLING", "FOLLOW_UP", "SETTLED"];
// 这三个历史工单状态属于同一寄品周期：有寄品记录时必须提醒先核对。
const SAMPLE_CYCLE_TICKET_STATUSES = ["PENDING_SAMPLE", "SAMPLED", "PENDING_MANUSCRIPT"];
export default function TicketSampleLink({ ticketId, ticketTitle, ticketStatus, shipItems, samples, influencerName, canCreate }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showPushConfirm, setShowPushConfirm] = useState(false);
  const activeSample = samples.find((s) => s.status === "PENDING") ?? null;
  const [receiverName, setReceiverName] = useState(activeSample?.receiverName ?? influencerName);
  const [receiverPhone, setReceiverPhone] = useState(activeSample?.receiverPhone ?? "");
  const [receiverAddress, setReceiverAddress] = useState(activeSample?.receiverAddress ?? "");
  const [productName, setProductName] = useState(activeSample?.productName ?? `工单「${ticketTitle}」寄品`);
  const [quantity, setQuantity] = useState(activeSample?.quantity ?? shipItems.length);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const targetId = activeSample?.id;
      const res = await fetch(targetId ? `/api/samples/${targetId}` : "/api/samples", {
        method: targetId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId,
          productName: productName.trim(),
          quantity: Number(quantity) > 0 ? Number(quantity) : shipItems.length,
          items: shipItems,
          receiverName: receiverName.trim(),
          receiverPhone: receiverPhone.trim(),
          receiverAddress: receiverAddress.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "创建失败");
      const sampleId = targetId ?? data.id;
      const pushRes = await fetch(`/api/samples/${sampleId}/confirm-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resend: Boolean(targetId && activeSample?.infoConfirmed) }),
      });
      const pushData = await pushRes.json().catch(() => ({}));
      if (!pushRes.ok) throw new Error(pushData.error || "推送仓库失败");
      setOpen(false);
      setShowPushConfirm(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  };

  // 推送前校验 + 二次确认
  const requestPush = () => {
    if (!productName.trim() || Number(quantity) <= 0 || !receiverName.trim() || !receiverPhone.trim() || !receiverAddress.trim()) {
      setError("寄品名称、数量、收件人、收件电话和收件地址均必填");
      return;
    }
    setShowPushConfirm(true);
  };

  const formatDateTime = (value: Date | string | null) => value
    ? new Date(value).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    : "-";
  const showCyclePrompt = samples.length > 0 && SAMPLE_CYCLE_TICKET_STATUSES.includes(ticketStatus);

  return (
    <div className="mt-2">
      {samples.length > 0 && (
        <div className={`mb-3 rounded-md border p-3 text-sm ${showCyclePrompt ? "border-amber-300 bg-amber-50 text-amber-900" : "border-border bg-muted/30 text-foreground"}`}>
          <div className="font-medium">本工单周期已寄品记录（{samples.length} 条）</div>
          {showCyclePrompt && <p className="mt-1 text-xs text-amber-800">当前处于寄品周期，请先核对以下全部记录，避免同一工单重复寄品。</p>}
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-amber-200 text-left">
                  <th className="px-2 py-1 font-medium">寄品单号</th>
                  <th className="px-2 py-1 font-medium">产品</th>
                  <th className="px-2 py-1 font-medium">数量</th>
                  <th className="px-2 py-1 font-medium">状态</th>
                  <th className="px-2 py-1 font-medium">快递单号</th>
                  <th className="px-2 py-1 font-medium">创建时间</th>
                  <th className="px-2 py-1 font-medium">寄出/签收</th>
                </tr>
              </thead>
              <tbody>
                {samples.map((s) => (
                  <tr key={s.id} className="border-b border-amber-100 last:border-0">
                    <td className="whitespace-nowrap px-2 py-1.5">
                      <Link href={`/samples?highlight=${s.id}`} className="text-primary hover:underline">{s.sampleNo}</Link>
                    </td>
                    <td className="px-2 py-1.5">{s.productName}</td>
                    <td className="px-2 py-1.5">{s.quantity}</td>
                    <td className="whitespace-nowrap px-2 py-1.5">
                      <span className={`rounded px-2 py-0.5 ${badgeClass(s.status)}`}>{sampleStatusLabels[s.status] ?? s.status}</span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 font-mono">{s.trackingNo || "-"}</td>
                    <td className="whitespace-nowrap px-2 py-1.5">{formatDateTime(s.createdAt)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5">{s.signedAt ? `签收 ${formatDateTime(s.signedAt)}` : s.shippedAt ? `寄出 ${formatDateTime(s.shippedAt)}` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {canCreate && (shipItems.length > 0 || activeSample) && (SAMPLE_CREATABLE.includes(ticketStatus) || ticketStatus === "APPROVED") && (
        <button className={btnPrimary} onClick={() => setOpen(true)}>
          {activeSample ? "填写寄品信息" : samples.length > 0 ? "再次寄件" : "创建寄品单"}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-lg bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-base font-semibold">填写寄品信息</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              将带入 {shipItems.length} 款寄品明细：
            </p>
            <ul className="mb-3 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {shipItems.map((s, i) => (
                <li key={i}>{shipItemSummary(s)}</li>
              ))}
            </ul>
            <div className="space-y-3">
              <input className={inputCls} placeholder="寄品名称（必填）" value={productName} onChange={(e) => setProductName(e.target.value)} />
              <input className={inputCls} type="number" min="1" placeholder="数量（必填）" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
              <input className={inputCls} placeholder="收件人姓名（必填）" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
              <input className={inputCls} placeholder="收件电话（必填）" value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} />
              <textarea className={inputCls} rows={2} placeholder="收件地址（必填）" value={receiverAddress} onChange={(e) => setReceiverAddress(e.target.value)} />
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button className={btnSecondary} onClick={() => setOpen(false)} disabled={busy}>关闭</button>
              <button className={btnPrimary} onClick={requestPush} disabled={busy}>
                {busy ? "提交中…" : "推送"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPushConfirm && (
        <ConfirmDialog
          title="推送给仓库"
          message={`请核对寄品明细与收件信息无误，确认后推送给仓库。\n\n收件人：${receiverName.trim()}\n收件电话：${receiverPhone.trim() || "-"}\n收件地址：${receiverAddress.trim()}\n寄品：${shipItems.map((s) => shipItemSummary(s)).join("；")}`}
          confirmText="确认推送"
          busy={busy}
          onClose={() => setShowPushConfirm(false)}
          onConfirm={async () => { await create(); }}
        />
      )}
    </div>
  );
}
