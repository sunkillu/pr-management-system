// 工单详情页「子工单」区块：子工单列表 + 新建子工单（标题自动按规范生成）
"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { inputCls, btnPrimary, btnSecondary, Field } from "./ui";
import Modal from "./Modal";
import {
  buildChildTitle,
  CHILD_SUB_TYPES,
  childSubTypeLabels,
  ChildTicketSubType,
  ChildTitleInput,
} from "@/lib/ticket-title";
import { PLATFORM_TAG_OPTIONS, ticketStatusLabels, badgeClass } from "@/lib/labels";

export type ChildTicketItem = {
  id: string;
  ticketNo: string;
  title: string;
  subType: string | null;
  status: string;
  influencer: { name: string } | null;
  assignee: { id: string; name: string } | null;
  createdAt: string;
};

export type ChildContext = {
  influencerId: string | null;
  influencerName: string;
  styles: string[];
  platforms: string[];
  confirmedDate: string | null; // YYYY-MM-DD
  publishDate: string | null; // YYYY-MM-DD
};

export default function TicketChildren({
  ticketId,
  isParent,
  parentTicket,
  initial,
  users,
  canCreate,
  context,
}: {
  ticketId: string;
  isParent: boolean;
  parentTicket: { id: string; ticketNo: string; title: string } | null;
  initial: ChildTicketItem[];
  users: { id: string; name: string }[];
  canCreate: boolean;
  context: ChildContext;
}) {
  const router = useRouter();
  const [children, setChildren] = useState<ChildTicketItem[]>(initial);
  const [open, setOpen] = useState(false);
  const [subType, setSubType] = useState<ChildTicketSubType>("SAMPLE");
  const [assigneeId, setAssigneeId] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(context.platforms);
  const [confirmedDate, setConfirmedDate] = useState(context.confirmedDate ?? "");
  const [publishDate, setPublishDate] = useState(context.publishDate ?? "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 当前选择的子工单标题预览（与服务端同规范）
  const titleInput: ChildTitleInput = {
    influencerName: context.influencerName,
    styles: context.styles,
    platforms,
    confirmedDate: confirmedDate || null,
    publishDate: publishDate || null,
  };
  const previewTitle = buildChildTitle(subType, titleInput);

  // 当前为子工单：展示父工单入口
  if (!isParent) {
    return parentTicket ? (
      <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3 text-sm">
        <span className="text-muted-foreground">这是子工单，所属父工单：</span>
        <Link href={`/tickets/${parentTicket.id}`} className="font-medium text-primary hover:underline">
          {parentTicket.title}
          <span className="ml-2 font-mono text-xs text-muted-foreground">{parentTicket.ticketNo}</span>
        </Link>
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">-</p>
    );
  }

  async function refresh() {
    const res = await fetch(`/api/tickets/${ticketId}/children`);
    const data = await res.json().catch(() => []);
    if (res.ok && Array.isArray(data)) {
      setChildren(
        data.map((c: Record<string, unknown>) => ({
          id: c.id as string,
          ticketNo: c.ticketNo as string,
          title: c.title as string,
          subType: (c.subType as string) ?? null,
          status: c.status as string,
          influencer: c.influencer as { name: string } | null,
          assignee: c.assignee as { id: string; name: string } | null,
          createdAt: c.createdAt as string,
        })),
      );
    }
  }

  async function createChild() {
    setError("");
    if (!context.influencerId) return setError("父工单未关联达人，无法创建子工单");
    if (!assigneeId) return setError("请选择子工单归属人");
    if (platforms.length === 0) return setError("请选择合作平台（可多选）");
    setSaving(true);
    const res = await fetch(`/api/tickets/${ticketId}/children`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subType,
        influencerId: context.influencerId,
        assigneeId,
        platform: platforms,
        style: context.styles,
        confirmedDate: confirmedDate || null,
        publishDate: publishDate || null,
        note: note.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error || "创建失败");
    setOpen(false);
    setAssigneeId("");
    setNote("");
    await refresh();
    router.refresh();
  }

  return (
    <div>
      {children.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无子工单</p>
      ) : (
        <div className="space-y-2">
          {children.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-4 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {c.subType && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {childSubTypeLabels[c.subType as ChildTicketSubType] ?? c.subType}
                    </span>
                  )}
                  <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(c.status)}`}>
                    {ticketStatusLabels[c.status] ?? c.status}
                  </span>
                  <Link href={`/tickets/${c.id}`} className="truncate text-sm font-medium hover:underline">
                    {c.title}
                  </Link>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="font-mono">{c.ticketNo}</span>
                  {c.assignee && <span className="ml-2">归属：{c.assignee.name}</span>}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      {canCreate && (
        <div className="mt-3">
          <button type="button" className={btnSecondary} onClick={() => setOpen(true)}>
            + 新建子工单
          </button>
        </div>
      )}
      {open && (
        <Modal title="新建子工单" onClose={() => setOpen(false)}>
          <Field label="子工单类型" required hint="标题将按对应规范自动生成">
            <div className="flex flex-wrap gap-2">
              {CHILD_SUB_TYPES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setSubType(v)}
                  className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                    subType === v
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-foreground ring-1 ring-border hover:ring-primary"
                  }`}
                >
                  {childSubTypeLabels[v]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="标题（自动生成）">
            <input className={inputCls} value={previewTitle} readOnly title="按标题规范自动生成" />
          </Field>
          <Field label="达人">
            <input className={inputCls} value={context.influencerName} readOnly disabled />
          </Field>
          <Field label="归属人" required hint="子工单的执行负责人">
            <select className={inputCls} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">请选择</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="合作平台（可多选）" required>
            <div className="flex flex-wrap gap-3">
              {PLATFORM_TAG_OPTIONS.map((p) => (
                <label key={p.value} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={platforms.includes(p.value)}
                    onChange={() =>
                      setPlatforms(
                        platforms.includes(p.value)
                          ? platforms.filter((x) => x !== p.value)
                          : [...platforms, p.value],
                      )
                    }
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="确认档期" hint="返稿/发布标题用，不填则沿用父工单">
              <input type="date" className={inputCls} value={confirmedDate} onChange={(e) => setConfirmedDate(e.target.value)} />
            </Field>
            <Field label="发布日期" hint="数据回收标题用，不填则沿用父工单">
              <input type="date" className={inputCls} value={publishDate} onChange={(e) => setPublishDate(e.target.value)} />
            </Field>
          </div>
          <Field label="备注">
            <textarea className={inputCls} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setOpen(false)}>
              取消
            </button>
            <button type="button" className={btnPrimary} disabled={saving} onClick={createChild}>
              {saving ? "创建中…" : "创建子工单"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
