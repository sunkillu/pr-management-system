"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { btnPrimary } from "@/components/ui";
import { sampleStatusLabels, badgeClass } from "@/lib/labels";

type ShipItem = { style: string; degree?: string; note?: string };
type Sample = { id: string; sampleNo: string; productName: string; status: string; trackingNo: string | null };

type Props = {
  ticketId: string;
  ticketTitle: string;
  ticketStatus: string;
  shipItems: ShipItem[];
  samples: Sample[];
  influencerId: string | null;
  influencerName: string;
  canCreate: boolean;
};

// 工单寄品：从寄品明细一键生成寄件请求；已生成的显示状态
// 仅工单审批通过后（IN_PROGRESS 及之后）可发起寄件
const SAMPLE_CREATABLE = ["IN_PROGRESS", "MATERIAL_REVIEW", "COMPLETED", "SETTLING", "FOLLOW_UP", "SETTLED"];
export default function TicketSampleLink({ ticketId, ticketTitle, ticketStatus, shipItems, samples, influencerId, influencerName, canCreate }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
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
          influencerId,
          receiverName: influencerName || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "创建失败");
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
              <span className="font-mono text-xs text-muted-foreground">{s.sampleNo}</span>
              <Link href={`/samples?highlight=${s.id}`} className="text-primary hover:underline">
                {s.productName}
              </Link>
              <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(s.status)}`}>
                {sampleStatusLabels[s.status] ?? s.status}
              </span>
              {s.trackingNo && <span className="font-mono text-xs text-muted-foreground">{s.trackingNo}</span>}
            </div>
          ))}
        </div>
      ) : canCreate && shipItems.length > 0 && SAMPLE_CREATABLE.includes(ticketStatus) ? (
        <button className={btnPrimary} onClick={create} disabled={busy}>
          {busy ? "创建中…" : "一键创建寄品单"}
        </button>
      ) : null}

      {canCreate && shipItems.length > 0 && SAMPLE_CREATABLE.includes(ticketStatus) && samples.length === 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          创建后可在寄品管理补充收件电话和地址，再确认并推送仓库。
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
