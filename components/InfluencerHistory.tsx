"use client";
import { useEffect, useState } from "react";

type HistoryTicket = {
  id: string;
  ticketNo: string;
  title: string;
  type: string;
  style: string[];
  platform: string[];
  quoteAmount: string | null;
  publishDate: string | null;
  publishLink: string | null;
  status: string;
  assignee: { name: string } | null;
  createdAt: string;
};

type HistoryData = {
  canViewA: boolean;
  tickets: HistoryTicket[];
  records: { id: string; type: string; fee: string | null; coopDate: string; note: string | null }[];
  shipments: { id: string; productName: string; quantity: number; status: string; createdAt: string }[];
  reviews: { id: string; createdAt: string }[];
};

const mask = <span className="text-muted-foreground">***</span>;

function fmtDate(d: string | null) {
  if (!d) return "-";
  return d.slice(0, 10);
}

export function InfluencerHistory({ influencerId }: { influencerId: string }) {
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!influencerId) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/influencers/${influencerId}/history`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [influencerId]);

  if (!influencerId || loading) return null;
  if (!data) return null;
  const empty =
    data.tickets.length === 0 && data.records.length === 0 && data.shipments.length === 0;
  if (empty) return null;

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <h4 className="text-sm font-semibold">历史合作记录</h4>
        {!data.canViewA && (
          <span className="rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground">
            脱敏版
          </span>
        )}
      </div>
      <div className="space-y-3">
        {data.tickets.map((t) => (
          <div key={t.id} className="rounded-md border bg-background p-3 text-sm">
            <div className="font-medium">{t.title}</div>
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>工单编号：{t.ticketNo}</span>
              <span>合作类型：{t.type}</span>
              <span>款式：{t.style.join("、") || "-"}</span>
              <span>平台：{t.platform.join("、") || "-"}</span>
              <span>归属PR：{t.assignee?.name ?? "-"}</span>
              <span>合作报价：{data.canViewA ? (t.quoteAmount ? `¥${t.quoteAmount}` : "-") : mask}</span>
              <span>发布日期：{fmtDate(t.publishDate)}</span>
              <span className="col-span-2">
                发布链接：{t.publishLink ? (
                  <a href={t.publishLink} target="_blank" rel="noreferrer" className="text-primary underline">
                    {t.publishLink.length > 40 ? t.publishLink.slice(0, 40) + "…" : t.publishLink}
                  </a>
                ) : "-"}
              </span>
            </div>
          </div>
        ))}
        {data.records.map((r) => (
          <div key={r.id} className="rounded-md border bg-background p-3 text-sm">
            <div className="font-medium">历史合作 · {r.type}</div>
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>合作日期：{fmtDate(r.coopDate)}</span>
              <span>合作费用：{data.canViewA ? (r.fee ? `¥${r.fee}` : "-") : mask}</span>
              {r.note && <span className="col-span-2">备注：{r.note}</span>}
            </div>
          </div>
        ))}
        {data.shipments.length > 0 && (
          <div className="rounded-md border bg-background p-3 text-sm">
            <div className="font-medium">历史寄品（{data.shipments.length}）</div>
            <div className="mt-1 space-y-1 text-xs text-muted-foreground">
              {data.shipments.slice(0, 5).map((s) => (
                <div key={s.id}>
                  {s.productName} × {s.quantity}（{s.status}，{fmtDate(s.createdAt)}）
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
