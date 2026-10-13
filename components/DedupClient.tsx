"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type InfluencerData = {
  id: string;
  name: string;
  influencerType: string | null;
  platforms: string[];
  contactInfo: string | null;
  homepageId: string | null;
  bio: string | null;
  tags: string[];
  brands: string[];
  registeredBy: string;
};

type DedupLog = {
  id: string;
  submittedAt: string;
  submittedBy: string;
  new: InfluencerData;
  existing: InfluencerData;
};

const FIELDS: { key: keyof InfluencerData; label: string }[] = [
  { key: "name", label: "达人姓名" },
  { key: "influencerType", label: "达人类型" },
  { key: "platforms", label: "平台标签" },
  { key: "homepageId", label: "主页ID" },
  { key: "contactInfo", label: "联系方式" },
  { key: "bio", label: "简介" },
  { key: "tags", label: "标签" },
  { key: "brands", label: "合作品牌" },
  { key: "registeredBy", label: "登记人" },
];

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "-";
  if (Array.isArray(v)) return v.length ? v.join("、") : "-";
  return String(v);
}

export default function DedupClient({ initialLogs }: { initialLogs: DedupLog[] }) {
  const router = useRouter();
  const [logs, setLogs] = useState(initialLogs);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handle(logId: string, action: "MERGE" | "KEEP" | "REJECT") {
    if (action === "REJECT" && !reason[logId]?.trim()) {
      setError("拒绝必须填写理由");
      return;
    }
    if (!confirm(`确认${action === "MERGE" ? "合并" : action === "KEEP" ? "保留原有" : "拒绝"}？`)) return;
    setError("");
    setBusy(logId);
    const res = await fetch("/api/influencers/dedup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logId, action, reason: reason[logId]?.trim() || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(data.error || "处理失败");
      return;
    }
    setLogs((ls) => ls.filter((l) => l.id !== logId));
    router.refresh();
  }

  if (logs.length === 0) {
    return <p className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">暂无待处理的重复提交</p>;
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      {logs.map((log) => (
        <div key={log.id} className="rounded-lg border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm">
              <span className="font-medium">{log.submittedBy}</span>
              <span className="text-muted-foreground"> 于 {log.submittedAt.slice(0, 16).replace("T", " ")} 提交</span>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700">待去重确认</span>
          </div>

          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border text-sm">
            <div className="bg-muted px-3 py-2 font-medium text-muted-foreground">字段</div>
            <div className="bg-muted px-3 py-2 font-medium">库存已有达人</div>
            <div className="bg-muted px-3 py-2 font-medium">新提交达人</div>
            {FIELDS.map((f) => {
              const ev = fmt(log.existing[f.key]);
              const nv = fmt(log.new[f.key]);
              const diff = ev !== nv;
              return (
                <div key={f.key} className="contents">
                  <div className="border-t border-border bg-muted/50 px-3 py-2 text-muted-foreground">{f.label}</div>
                  <div className="border-t border-border px-3 py-2">{ev}</div>
                  <div className={`border-t border-border px-3 py-2 ${diff ? "bg-amber-50 font-medium" : ""}`}>{nv}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs text-muted-foreground">处理理由（拒绝时必填）</label>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="如：与已有达人实为同一人 / 信息有误等"
              value={reason[log.id] ?? ""}
              onChange={(e) => setReason((r) => ({ ...r, [log.id]: e.target.value }))}
            />
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              disabled={busy === log.id}
              onClick={() => handle(log.id, "REJECT")}
              className="rounded-md border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              拒绝
            </button>
            <button
              disabled={busy === log.id}
              onClick={() => handle(log.id, "KEEP")}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              保留原有
            </button>
            <button
              disabled={busy === log.id}
              onClick={() => handle(log.id, "MERGE")}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy === log.id ? "处理中…" : "合并更新"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
