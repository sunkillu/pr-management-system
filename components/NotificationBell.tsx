"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { relatedUrl } from "@/lib/notification-url";
import { formatDateTime } from "@/lib/labels";

type Notice = {
  id: string;
  title: string | null;
  content: string;
  kind: string;
  relatedType: string | null;
  relatedId: string | null;
  isRead: boolean;
  createdAt: string;
};

const kindLabels: Record<string, string> = {
  APPROVAL_PENDING: "待审批",
  APPROVED: "已通过",
  REJECTED: "已驳回",
  REMIND: "催办",
  SYSTEM: "系统",
};

/** 顶部铃铛：未读数 badge + 下拉通知列表 */
export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Notice[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setList((data.notifications ?? []).slice(0, 10));
    } catch {
      /* 忽略 */
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => {
      clearInterval(t);
      document.removeEventListener("click", onClick);
    };
  }, []);

  const unread = list.filter((n) => !n.isRead).length;

  const markRead = async (ids: string[]) => {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).catch(() => {});
  };

  const openItem = async (n: Notice, anchor = false) => {
    if (!n.isRead) {
      await markRead([n.id]);
      setList((l) => l.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    }
    setOpen(false);
    const url = relatedUrl(n);
    if (url) router.push(anchor ? `${url}#approval-section` : url);
  };

  const markAll = async () => {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
    setList((l) => l.map((x) => ({ ...x, isRead: true })));
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) refresh();
        }}
        className="relative rounded p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="通知"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-lg bg-card shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="text-sm font-semibold">通知</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs text-primary hover:underline">
                全部标已读
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {list.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">暂无通知</div>
            )}
            {list.map((n) => (
              <div
                key={n.id}
                onClick={() => openItem(n)}
                className={`block w-full cursor-pointer border-b px-4 py-2.5 text-left last:border-0 hover:bg-accent ${
                  n.isRead ? "opacity-60" : "bg-primary/10/40"
                }`}
              >
                <div className="flex items-center gap-2">
                  {!n.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-primary/100" />}
                  <span className="text-sm font-medium text-gray-900">
                    {n.title ?? "通知"}
                  </span>
                  <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {kindLabels[n.kind] ?? n.kind}
                  </span>
                </div>
                <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.content}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {formatDateTime(n.createdAt)}
                  </span>
                  {n.kind === "APPROVAL_PENDING" && relatedUrl(n) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openItem(n, true);
                      }}
                      className="rounded bg-primary px-2 py-0.5 text-[11px] text-white hover:bg-primary/90"
                    >
                      去审批
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
