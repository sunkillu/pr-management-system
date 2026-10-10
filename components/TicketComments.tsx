"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { inputCls, btnPrimary } from "./ui";
import { formatDateTime } from "@/lib/labels";

type User = { id: string; name: string };
type Comment = {
  id: string;
  content: string;
  mentionedIds: string[];
  createdAt: string;
  author: { id: string; name: string };
};

export default function TicketComments({
  ticketId,
  initial,
  users,
  canWrite,
  currentUserId,
}: {
  ticketId: string;
  initial: Comment[];
  users: User[];
  canWrite: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [comments, setComments] = useState(initial);
  const [content, setContent] = useState("");
  const [mentioned, setMentioned] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setComments(initial), [initial]);

  async function submit() {
    setError("");
    if (!content.trim()) return setError("评论内容不能为空");
    setBusy(true);
    const res = await fetch(`/api/tickets/${ticketId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim(), mentionedIds: mentioned }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "发表失败");
    setComments([data, ...comments]);
    setContent("");
    setMentioned([]);
    router.refresh();
  }

  const mentionedNames = (ids: string[]) =>
    ids.map((id) => users.find((u) => u.id === id)?.name ?? "").filter(Boolean);

  return (
    <div>
      {canWrite && (
        <div className="mb-4 rounded-lg border border-gray-200 p-3">
          <textarea
            className={inputCls}
            rows={2}
            placeholder="发表评论，可 @ 相关人员…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">@ 提醒：</span>
            <div className="flex max-w-full flex-wrap gap-2">
              {users
                .filter((u) => u.id !== currentUserId)
                .map((u) => (
                  <label key={u.id} className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={mentioned.includes(u.id)}
                      onChange={() =>
                        setMentioned(
                          mentioned.includes(u.id)
                            ? mentioned.filter((x) => x !== u.id)
                            : [...mentioned, u.id]
                        )
                      }
                    />
                    {u.name}
                  </label>
                ))}
            </div>
            <button className={btnPrimary + " ml-auto"} disabled={busy} onClick={submit}>
              {busy ? "发表中…" : "发表"}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}
      <div className="space-y-3">
        {comments.map((c) => (
          <div key={c.id} className="rounded-lg bg-[#f5f5f7] p-3">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="font-medium text-gray-800">{c.author.name}</span>
              <span>{formatDateTime(c.createdAt)}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{c.content}</p>
            {c.mentionedIds.length > 0 && (
              <p className="mt-1 text-xs text-[#0071e3]">@ {mentionedNames(c.mentionedIds).join("、")}</p>
            )}
          </div>
        ))}
        {comments.length === 0 && <p className="text-sm text-gray-400">暂无评论</p>}
      </div>
    </div>
  );
}
