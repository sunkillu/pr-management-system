"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import { inputCls, btnPrimary, btnSecondary, btnPrimarySm, btnDangerSm, Field } from "./ui";
import { contentTypeLabels, contentStatusLabels, badgeClass } from "@/lib/labels";
import ContentComments from "./ContentComments";

export type ContentCommentItem = {
  id: string;
  comment: string;
  author?: string | null;
  handled: boolean;
  handledBy?: { name: string } | null;
  handledAt?: string | null;
  createdBy?: { name: string } | null;
  createdAt: string;
};

export type TicketContent = {
  id: string;
  title: string;
  type: string;
  status: string;
  link?: string | null;
  body?: string | null;
  platform?: string | null;
  style?: string | null;
  cost?: number | string | null;
  rejectReason?: string | null;
  version: number;
  createdAt: string;
  createdBy?: { id: string; name: string } | null;
  comments?: ContentCommentItem[];
};

const TYPE_OPTIONS = Object.entries(contentTypeLabels);

// 工单内内容维护：列表 + 新建 + 状态流转（草稿→待审批→已通过→已发布）
// 审核人：ADMIN / PR_MANAGER；编辑/提交/发布：ADMIN / PR / PR_MANAGER
export default function TicketContents({
  ticketId,
  contents,
  role,
  userId,
  canManage,
}: {
  ticketId: string;
  contents: TicketContent[];
  role: string;
  userId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<null | TicketContent>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<null | {
    title: string;
    message?: string;
    needReason?: boolean;
    reasonLabel?: string;
    reasonPlaceholder?: string;
    reasonOptional?: boolean;
    confirmText?: string;
    danger?: boolean;
    run: (reason: string) => void;
  }>(null);

  const isApprover = role === "ADMIN" || role === "PR_MANAGER";
  const refresh = () => router.refresh();

  async function call(url: string, method: string, body?: object) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "操作失败");
        return false;
      }
      return true;
    } finally {
      setBusy(false);
    }
  }

  const doAction = (id: string, action: string, extra?: object) =>
    call(`/api/tickets/${ticketId}/contents/${id}`, "PATCH", { action, ...extra }).then((ok) => {
      if (ok) {
        setConfirm(null);
        refresh();
      }
    });

  const open = (d: NonNullable<typeof confirm>) => {
    setError("");
    setConfirm(d);
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">内容在工单内维护：新建 → 提交审批 → 通过 → 发布</p>
        {canManage && (
          <button className={btnPrimarySm} onClick={() => setShowNew(true)}>
            新建内容
          </button>
        )}
      </div>

      {contents.length === 0 ? (
        <p className="rounded-lg border border-dashed border-input p-6 text-center text-sm text-muted-foreground">
          暂无内容，点击右上角新建
        </p>
      ) : (
        <div className="space-y-2">
          {contents.map((c) => (
            <div key={c.id} className="rounded-xl bg-muted p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-gray-900">{c.title}</span>
                    <span className="text-xs text-muted-foreground">{contentTypeLabels[c.type] ?? c.type}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-black/[0.04] ${badgeClass(c.status)}`}>
                      {contentStatusLabels[c.status] ?? c.status}
                    </span>
                    {c.platform && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-blue-700 ring-1 ring-blue-200">
                        {c.platform === "XIAOHONGSHU" ? "小红书" : c.platform === "DOUYIN" ? "抖音" : c.platform}
                      </span>
                    )}
                    {c.style && <span className="text-xs text-muted-foreground">款式：{c.style}</span>}
                    {c.cost != null && c.cost !== "" && (
                      <span className="text-xs text-muted-foreground">花费：¥{Number(c.cost).toFixed(2)}</span>
                    )}
                  </div>
                  {c.link && (
                    <a href={c.link} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-primary hover:underline">
                      {c.link}
                    </a>
                  )}
                  {c.body && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.body}</p>}
                  {c.status === "REJECTED" && c.rejectReason && (
                    <p className="mt-1 text-xs text-red-600">驳回理由：{c.rejectReason}</p>
                  )}
                </div>
              </div>
              {canManage && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {(c.status === "DRAFT" || c.status === "REJECTED") && (
                  <>
                    <button className="text-xs text-primary hover:underline" onClick={() => setEditing(c)}>
                      编辑
                    </button>
                    <button
                      className={btnPrimarySm}
                      disabled={busy}
                      onClick={() =>
                        open({
                          title: c.status === "REJECTED" ? "重新提交审批" : "提交审批",
                          message: "确认提交该内容进入审批流程吗？",
                          needReason: c.status === "REJECTED",
                          reasonLabel: "修改说明",
                          reasonPlaceholder: "说明本次修改了哪些内容（选填）",
                          reasonOptional: true,
                          confirmText: "确认提交",
                          run: (reason) => doAction(c.id, "SUBMIT", { note: reason }),
                        })
                      }
                    >
                      {c.status === "REJECTED" ? "重新提交" : "提交审批"}
                    </button>
                  </>
                )}
                {isApprover && c.status === "PENDING" && (
                  <>
                    <button
                      className={btnPrimarySm}
                      disabled={busy}
                      onClick={() =>
                        open({
                          title: "通过审批",
                          message: "确认通过该内容的审批吗？",
                          needReason: true,
                          reasonLabel: "审批意见",
                          reasonPlaceholder: "通过可留空",
                          reasonOptional: true,
                          confirmText: "确认通过",
                          run: (reason) => doAction(c.id, "APPROVE", { comment: reason }),
                        })
                      }
                    >
                      通过
                    </button>
                    <button
                      className={btnDangerSm}
                      disabled={busy}
                      onClick={() =>
                        open({
                          title: "驳回内容",
                          needReason: true,
                          reasonLabel: "驳回理由",
                          reasonPlaceholder: "请说明需要修改的地方",
                          confirmText: "确认驳回",
                          danger: true,
                          run: (reason) => doAction(c.id, "REJECT", { comment: reason }),
                        })
                      }
                    >
                      驳回
                    </button>
                  </>
                )}
                  {c.status === "APPROVED" && (
                    <button
                      className={btnPrimarySm}
                      disabled={busy}
                      onClick={() =>
                        open({
                          title: "标记已发布",
                          message: "确认该内容已发布吗？",
                          confirmText: "确认发布",
                          run: () => doAction(c.id, "PUBLISH"),
                        })
                      }
                    >
                      标记已发布
                    </button>
                  )}
                </div>
              )}
              {/* 已发布内容的外部评论及处理 */}
              {c.status === "PUBLISHED" && (
                <ContentComments
                  ticketId={ticketId}
                  contentId={c.id}
                  initial={c.comments ?? []}
                  canManage={canManage}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {(showNew || editing) && (
        <ContentEditModal
          initial={editing}
          onClose={() => {
            setShowNew(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowNew(false);
            setEditing(null);
            refresh();
          }}
          ticketId={ticketId}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          needReason={confirm.needReason}
          reasonLabel={confirm.reasonLabel}
          reasonPlaceholder={confirm.reasonPlaceholder}
          reasonOptional={confirm.reasonOptional}
          confirmText={confirm.confirmText}
          danger={confirm.danger}
          busy={busy}
          onConfirm={confirm.run}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

function ContentEditModal({
  initial,
  ticketId,
  onClose,
  onSaved,
}: {
  initial?: TicketContent | null;
  ticketId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [type, setType] = useState(initial?.type ?? "CAO_TEXT");
  const [link, setLink] = useState(initial?.link ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [platform, setPlatform] = useState(initial?.platform ?? "");
  const [style, setStyle] = useState(initial?.style ?? "");
  const [cost, setCost] = useState(
    initial?.cost != null ? String(initial.cost) : ""
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!title.trim()) {
      setError("标题不能为空");
      return;
    }
    const costNum = cost.trim() === "" ? null : Number(cost.trim());
    if (costNum !== null && (isNaN(costNum) || costNum < 0)) {
      setError("花费必须是数字");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = {
        title: title.trim(),
        type,
        link: link.trim() || null,
        body: body.trim() || null,
        platform: platform || null,
        style: style.trim() || null,
        cost: costNum,
      };
      const url = initial
        ? `/api/tickets/${ticketId}/contents/${initial.id}`
        : `/api/tickets/${ticketId}/contents`;
      const res = await fetch(url, {
        method: initial ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(initial ? { action: "EDIT", ...payload } : payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "保存失败");
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={initial ? "编辑内容" : "新建内容"} onClose={onClose}>
      <Field label="标题" required>
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：小红书种草文-春季新品" />
      </Field>
      <Field label="类型">
        <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
          {TYPE_OPTIONS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </Field>
      <Field label="内容链接" hint="笔记/视频发布后的链接">
        <input className={inputCls} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="平台" hint="用于平台汇总">
          <select className={inputCls} value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="">未指定</option>
            <option value="XIAOHONGSHU">小红书</option>
            <option value="DOUYIN">抖音</option>
          </select>
        </Field>
        <Field label="款式">
          <input className={inputCls} value={style} onChange={(e) => setStyle(e.target.value)} placeholder="如：春季新品" />
        </Field>
        <Field label="花费(元)" hint="用于汇总单">
          <input className={inputCls} value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" inputMode="decimal" />
        </Field>
      </div>
      <Field label="备注" hint="内容说明、素材要求等">
        <textarea className={inputCls} rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <button className={btnSecondary} onClick={onClose}>取消</button>
        <button className={btnPrimary} disabled={busy} onClick={save}>
          {busy ? "保存中…" : "保存"}
        </button>
      </div>
    </Modal>
  );
}
