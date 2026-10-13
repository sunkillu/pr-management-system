"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { platformLabels, formatDate } from "@/lib/labels";
import { metricFieldsFor, metricFieldLabels } from "@/lib/data-collection";
import { inputCls, btnPrimarySm, btnSecondarySm, thCls, tdCls } from "./ui";

export type DataTask = {
  id: string;
  ticketId: string;
  platform: string;
  publishLink: string | null;
  metrics: Record<string, number> | null;
  status: "PENDING" | "COLLECTED" | "MISSING";
  dueAt: string | null;
  createdAt: string;
  ticket: { id: string; ticketNo: string; title: string; publishDate: string | null };
};

const statusLabels: Record<DataTask["status"], string> = {
  PENDING: "待回收",
  COLLECTED: "已回收",
  MISSING: "数据待补",
};

const statusPill: Record<DataTask["status"], string> = {
  PENDING: "bg-amber-100 text-amber-700",
  COLLECTED: "bg-green-100 text-green-700",
  MISSING: "bg-red-100 text-red-700",
};

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "全部" },
  { value: "PENDING", label: "待回收" },
  { value: "MISSING", label: "数据待补" },
  { value: "COLLECTED", label: "已回收" },
];

function MetricsEditor({ task, onSaved }: { task: DataTask; onSaved: (t: DataTask) => void }) {
  const fields = metricFieldsFor(task.platform);
  const [publishLink, setPublishLink] = useState(task.publishLink ?? "");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f, task.metrics?.[f] != null ? String(task.metrics[f]) : ""]))
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save(markMissing: boolean) {
    setErr("");
    setBusy(true);
    try {
      const metrics: Record<string, number> = {};
      for (const f of fields) {
        const raw = values[f].trim();
        if (raw === "") continue;
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 0) throw new Error(`「${metricFieldLabels[f]}」必须为非负整数`);
        metrics[f] = n;
      }
      const res = await fetch("/api/data-tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          publishLink: publishLink.trim() || null,
          metrics,
          ...(markMissing ? { status: "MISSING" } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      onSaved(data.task);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-input bg-muted/30 p-4">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <div className="md:col-span-2 lg:col-span-3">
          <label className="mb-1 block text-xs font-medium text-foreground">发布链接</label>
          <input
            className={inputCls}
            placeholder={task.platform === "XIAOHONGSHU" ? "小红书笔记链接" : "抖音视频链接"}
            value={publishLink}
            onChange={(e) => setPublishLink(e.target.value)}
          />
        </div>
        {fields.map((f) => (
          <div key={f}>
            <label className="mb-1 block text-xs font-medium text-foreground">
              {metricFieldLabels[f] ?? f}
            </label>
            <input
              className={inputCls}
              type="number"
              min={0}
              step={1}
              placeholder="0"
              value={values[f]}
              onChange={(e) => setValues((v) => ({ ...v, [f]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button className={btnPrimarySm} disabled={busy} onClick={() => save(false)}>
          {busy ? "保存中…" : "保存指标"}
        </button>
        {task.status !== "MISSING" && (
          <button className={btnSecondarySm} disabled={busy} onClick={() => save(true)}>
            标记数据待补
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        链接与全部指标填齐后保存，任务自动置为「已回收」；确实拿不到数据时可标记「数据待补」，记录会保留。
      </p>
    </div>
  );
}

export default function DataTaskList({
  initial,
  canEdit,
}: {
  initial: DataTask[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<DataTask[]>(initial);
  const [filter, setFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const visible = filter ? items.filter((t) => t.status === filter) : items;

  function onSaved(updated: DataTask) {
    setItems((list) => list.map((t) => (t.id === updated.id ? { ...updated, ticket: t.ticket } : t)));
    setExpandedId(null);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
            {f.value && (
              <span className="ml-1 opacity-70">({items.filter((t) => t.status === f.value).length})</span>
            )}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">暂无数据回收任务</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thCls}>工单</th>
                <th className={thCls}>平台</th>
                <th className={thCls}>发布链接</th>
                <th className={thCls}>回收截止</th>
                <th className={thCls}>状态</th>
                <th className={thCls}>操作</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => {
                const overdue = t.status === "PENDING" && t.dueAt && new Date(t.dueAt) < new Date();
                const expanded = expandedId === t.id;
                return (
                  <React.Fragment key={t.id}>
                    <tr className="hover:bg-muted/40">
                      <td className={tdCls}>
                        <div className="font-medium">{t.ticket.title}</div>
                        <div className="text-xs text-muted-foreground">{t.ticket.ticketNo}</div>
                      </td>
                      <td className={tdCls}>
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                          {platformLabels[t.platform] ?? t.platform}
                        </span>
                      </td>
                      <td className={tdCls}>
                        {t.publishLink ? (
                          <a
                            href={t.publishLink}
                            target="_blank"
                            rel="noreferrer"
                            className="max-w-[220px] truncate text-primary underline-offset-4 hover:underline"
                            title={t.publishLink}
                          >
                            查看链接
                          </a>
                        ) : (
                          <span className="text-muted-foreground">未填写</span>
                        )}
                      </td>
                      <td className={tdCls}>
                        {t.dueAt ? (
                          <span className={overdue ? "font-medium text-destructive" : ""}>
                            {formatDate(t.dueAt)}
                            {overdue && "（已超期）"}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className={tdCls}>
                        <span className={`rounded-full px-2 py-0.5 text-xs ${statusPill[t.status]}`}>
                          {statusLabels[t.status]}
                        </span>
                      </td>
                      <td className={tdCls}>
                        {canEdit && (
                          <button className={btnSecondarySm} onClick={() => setExpandedId(expanded ? null : t.id)}>
                            {expanded ? "收起" : "填写数据"}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={6} className="bg-background px-4 py-3">
                          <MetricsEditor task={t} onSaved={onSaved} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
