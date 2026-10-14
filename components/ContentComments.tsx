"use client";
import { useState } from "react";
import { formatDateTime } from "@/lib/labels";
import { useRouter } from "next/navigation";
import { inputCls, btnPrimarySm, btnSecondary, Field } from "./ui";
import type { ContentCommentItem } from "./TicketContents";

// 已发布内容的外部评论及处理跟进：添加评论、标记已处理
export default function ContentComments({
  ticketId,
  contentId,
  initial,
  canManage,
}: {
  ticketId: string;
  contentId: string;
  initial: ContentCommentItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [list, setList] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [comment, setComment] = useState("");
  const [author, setAuthor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function addComment() {
    if (!comment.trim()) return setError("评论内容不能为空");
    setBusy(true);
    setError("");
    const res = await fetch(`/api/tickets/${ticketId}/contents/${contentId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: comment.trim(), author: author.trim() || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "添加失败");
    setList([data, ...list]);
    setComment("");
    setAuthor("");
    setShowForm(false);
    router.refresh();
  }

  async function toggleHandled(item: ContentCommentItem) {
    setBusy(true);
    const res = await fetch(
      `/api/tickets/${ticketId}/contents/${contentId}/comments/${item.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handled: !item.handled }),
      }
    );
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "操作失败");
    setList(list.map((x) => (x.id === item.id ? data : x)));
    router.refresh();
  }

  async function remove(item: ContentCommentItem) {
    if (!confirm("确认删除这条评论吗？")) return;
    const res = await fetch(
      `/api/tickets/${ticketId}/contents/${contentId}/comments/${item.id}`,
      { method: "DELETE" }
    );
    if (!res.ok) return;
    setList(list.filter((x) => x.id !== item.id));
    router.refresh();
  }

  const unhandled = list.filter((x) => !x.handled).length;

  return (
    <div className="mt-2 border-t border-border pt-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">
          发布后评论（{list.length}，待处理 {unhandled}）
        </span>
        {canManage && !showForm && (
          <button className="text-xs text-primary hover:underline" onClick={() => setShowForm(true)}>
            + 记录评论
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-2 space-y-2 rounded-lg bg-card p-2">
          <Field label="评论内容">
            <textarea className={inputCls} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="记录外部平台评论…" />
          </Field>
          <Field label="评论人（选填）">
            <input className={inputCls} value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="评论者昵称" />
          </Field>
          <div className="flex gap-2">
            <button className={btnPrimarySm} disabled={busy} onClick={addComment}>保存</button>
            <button className={btnSecondary} onClick={() => setShowForm(false)}>取消</button>
          </div>
        </div>
      )}

      {list.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {list.map((x) => (
            <div key={x.id} className="rounded-lg bg-card p-2 text-xs">
              <div className="flex items-start justify-between gap-2">
                <p className="whitespace-pre-wrap text-foreground">{x.comment}</p>
                <span className={`shrink-0 rounded px-1.5 py-0.5 ${x.handled ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                  {x.handled ? "已处理" : "待处理"}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                {x.author && <span>评论人：{x.author}</span>}
                {x.createdBy && <span>记录：{x.createdBy.name}</span>}
                {x.handled && x.handledBy && (
                  <span>处理：{x.handledBy.name}{x.handledAt ? ` · ${formatDateTime(x.handledAt)}` : ""}</span>
                )}
                {canManage && (
                  <span className="flex gap-2">
                    <button
                      className="text-primary hover:underline"
                      disabled={busy}
                      onClick={() => toggleHandled(x)}
                    >
                      {x.handled ? "取消已处理" : "标记已处理"}
                    </button>
                    <button className="text-red-500 hover:underline" onClick={() => remove(x)}>
                      删除
                    </button>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
