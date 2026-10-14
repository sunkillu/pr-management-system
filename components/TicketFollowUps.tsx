"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls, btnPrimary, btnSecondary, Field } from "./ui";
import { formatDateTime } from "@/lib/labels";

type FollowUp = {
  id: string;
  followNo: number;
  noteUrl: string | null;
  views: number | null;
  impressions: number | null;
  likes: number | null;
  favorites: number | null;
  comments: number | null;
  shares: number | null;
  note: string | null;
  createdAt: string;
  createdBy: { name: string } | null;
};

export default function TicketFollowUps({
  ticketId,
  initial,
  dueDate,
  canManage,
}: {
  ticketId: string;
  initial: FollowUp[];
  dueDate: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const [noteUrl, setNoteUrl] = useState("");
  const [views, setViews] = useState("");
  const [impressions, setImpressions] = useState("");
  const [likes, setLikes] = useState("");
  const [favorites, setFavorites] = useState("");
  const [comments, setComments] = useState("");
  const [shares, setShares] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const done = items.length;
  const due = dueDate ? new Date(dueDate) : null;
  const now = new Date();
  const daysLeft = due ? Math.ceil((due.getTime() - now.getTime()) / 86400000) : null;
  const overdue = due !== null && daysLeft !== null && daysLeft < 0 && done < 3;

  async function submit() {
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/followups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noteUrl: noteUrl.trim() || null,
          views: views || null,
          impressions: impressions || null,
          likes: likes || null,
          favorites: favorites || null,
          comments: comments || null,
          shares: shares || null,
          note: note.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "提交失败");
        return;
      }
      setItems((list) => [
        ...list,
        {
          id: data.record.id,
          followNo: data.record.followNo,
          noteUrl: data.record.noteUrl,
          views: data.record.views,
          impressions: data.record.impressions,
          likes: data.record.likes,
          favorites: data.record.favorites,
          comments: data.record.comments,
          shares: data.record.shares,
          note: data.record.note,
          createdAt: data.record.createdAt,
          createdBy: null,
        },
      ]);
      setOpen(false);
      setNoteUrl(""); setViews(""); setImpressions(""); setLikes(""); setFavorites(""); setComments(""); setShares(""); setNote("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {/* 进度 + 倒计时 */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex gap-1.5">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                n <= done ? "bg-primary text-white" : "bg-border text-muted-foreground"
              }`}
            >
              {n}
            </span>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">{done}/3 次跟进</span>
        {due && done < 3 && (
          <span className={`text-xs font-medium ${overdue ? "text-red-600" : "text-muted-foreground"}`}>
            {overdue ? `已逾期 ${-daysLeft!} 天` : `剩余 ${daysLeft} 天`}
          </span>
        )}
        {done >= 3 && <span className="text-xs font-medium text-green-600">跟进完成，已归档</span>}
      </div>
      {overdue && (
        <p className="mb-3 rounded-[10px] border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          跟进已逾期，请尽快补做跟进记录。
        </p>
      )}

      {/* 记录列表 */}
      <div className="space-y-2">
        {items.map((f) => (
          <div key={f.id} className="rounded-[10px] border border-border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">第 {f.followNo} 次跟进</span>
              <span className="text-xs text-muted-foreground">
                {f.createdBy?.name ?? ""} · {formatDateTime(f.createdAt)}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {f.views !== null && <span>播放/阅读：{f.views}</span>}
              {f.impressions !== null && <span>曝光：{f.impressions}</span>}
              {f.likes !== null && <span>点赞：{f.likes}</span>}
              {f.favorites !== null && <span>收藏：{f.favorites}</span>}
              {f.comments !== null && <span>评论：{f.comments}</span>}
              {f.shares !== null && <span>转发：{f.shares}</span>}
              {f.noteUrl && (
                <a href={f.noteUrl} target="_blank" className="text-primary hover:underline">
                  笔记链接 ↗
                </a>
              )}
            </div>
            {f.note && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{f.note}</p>}
          </div>
        ))}
        {items.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">暂无跟进记录</p>
        )}
      </div>

      {canManage && done < 3 && (
        <div className="mt-3">
          {!open ? (
            <button className={btnPrimary} onClick={() => setOpen(true)}>
              新增第 {done + 1} 次跟进
            </button>
          ) : (
            <div className="rounded-[10px] border border-border p-3">
              <Field label="笔记链接">
                <input className={inputCls} value={noteUrl} onChange={(e) => setNoteUrl(e.target.value)}
                  placeholder="https://" />
              </Field>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <Field label="播放/阅读量">
                  <input type="number" min={0} className={inputCls} value={views}
                    onChange={(e) => setViews(e.target.value)} />
                </Field>
                <Field label="曝光量">
                  <input type="number" min={0} className={inputCls} value={impressions}
                    onChange={(e) => setImpressions(e.target.value)} />
                </Field>
                <Field label="点赞数">
                  <input type="number" min={0} className={inputCls} value={likes}
                    onChange={(e) => setLikes(e.target.value)} />
                </Field>
                <Field label="收藏数">
                  <input type="number" min={0} className={inputCls} value={favorites}
                    onChange={(e) => setFavorites(e.target.value)} />
                </Field>
                <Field label="评论数">
                  <input type="number" min={0} className={inputCls} value={comments}
                    onChange={(e) => setComments(e.target.value)} />
                </Field>
                <Field label="转发数">
                  <input type="number" min={0} className={inputCls} value={shares}
                    onChange={(e) => setShares(e.target.value)} />
                </Field>
              </div>
              <Field label="备注">
                <textarea className={inputCls} rows={2} value={note}
                  onChange={(e) => setNote(e.target.value)} />
              </Field>
              {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <button className={btnSecondary} onClick={() => setOpen(false)}>取消</button>
                <button className={btnPrimary} disabled={saving} onClick={submit}>
                  {saving ? "保存中…" : "保存跟进"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
