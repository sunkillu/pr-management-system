"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { btnPrimary, btnSecondary, inputCls } from "@/components/ui";
import { sampleStatusLabels, badgeClass } from "@/lib/labels";

type ShipItem = { style: string; degree?: string; note?: string };
type Sample = { id: string; productName: string; status: string; trackingNo: string | null };

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
export default function TicketSampleLink({ ticketId, ticketTitle, ticketStatus, shipItems, samples, influencerName, canCreate }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [receiverName, setReceiverName] = useState(influencerName);
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverAddress, setReceiverAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    if (!receiverName.trim() || !receiverAddress.trim()) {
      setError("收件人姓名和地址必填");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId,
          productName: `工单「${ticketTitle}」寄品`,
          quantity: shipItems.length,
          items: shipItems,
          receiverName: receiverName.trim(),
          receiverPhone: receiverPhone.trim() || null,
          receiverAddress: receiverAddress.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "创建失败");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2">
      {samples.length > 0 ? (
        <div className="space-y-1.5">
          {samples.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-sm">
              <Link href={`/samples?highlight=${s.id}`} className="text-[#0071e3] hover:underline">
                {s.productName}
              </Link>
              <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(s.status)}`}>
                {sampleStatusLabels[s.status] ?? s.status}
              </span>
              {s.trackingNo && <span className="font-mono text-xs text-gray-500">{s.trackingNo}</span>}
            </div>
          ))}
        </div>
      ) : canCreate && shipItems.length > 0 && SAMPLE_CREATABLE.includes(ticketStatus) ? (
        <button className={btnPrimary} onClick={() => setOpen(true)}>
          生成寄件请求
        </button>
      ) : null}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-base font-semibold">生成寄件请求</h3>
            <p className="mb-3 text-sm text-gray-500">
              将带入 {shipItems.length} 款寄品明细：{shipItems.map((s) => s.style).join("、")}
            </p>
            <div className="space-y-3">
              <input className={inputCls} placeholder="收件人姓名（必填）" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
              <input className={inputCls} placeholder="收件电话" value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} />
              <textarea className={inputCls} rows={2} placeholder="收件地址（必填）" value={receiverAddress} onChange={(e) => setReceiverAddress(e.target.value)} />
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button className={btnSecondary} onClick={() => setOpen(false)} disabled={busy}>关闭</button>
              <button className={btnPrimary} onClick={create} disabled={busy}>
                {busy ? "提交中…" : "提交给仓库"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
