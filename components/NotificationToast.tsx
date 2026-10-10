"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Notice = {
  id: string;
  title: string | null;
  content: string;
  kind: string;
  relatedType: string | null;
  relatedId: string | null;
  createdAt: string;
};

const POLL_MS = 30_000;
const AUTO_DISMISS_MS = 8_000;

function relatedUrl(n: Notice): string | null {
  if (!n.relatedType || !n.relatedId) return null;
  const map: Record<string, string> = {
    INFLUENCER: "/influencers",
    COOP_REQUEST: "/coop-requests",
    PAYMENT: "/payments",
    CONTENT: "/contents",
  };
  const base = map[n.relatedType];
  return base ? `${base}/${n.relatedId}` : null;
}

async function markRead(ids: string[]) {
  try {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
  } catch {
    /* 忽略 */
  }
}

/**
 * 右下角 toast 弹窗：轮询未读通知，新到的滑出提示。
 * 挂载到全局 layout，所有登录页面生效。
 */
export default function NotificationToast() {
  const router = useRouter();
  const [queue, setQueue] = useState<Notice[]>([]);
  const seenRef = useRef<Set<string> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let stopped = false;

    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/notifications?unread=1", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        const list: Notice[] = data.notifications ?? [];
        if (seenRef.current === null) {
          // 首次轮询只建立基线，不弹窗
          seenRef.current = new Set(list.map((n) => n.id));
          return;
        }
        const fresh = list.filter((n) => !seenRef.current!.has(n.id));
        if (fresh.length > 0 && !stopped) {
          fresh.forEach((n) => seenRef.current!.add(n.id));
          setQueue((q) => [...q, ...fresh]);
        }
      } catch {
        /* 忽略 */
      }
    };

    poll();
    timerRef.current = setInterval(poll, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // 队首自动消失
  useEffect(() => {
    if (queue.length === 0) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [queue]);

  const current = queue[0];
  if (!current) return null;

  const url = relatedUrl(current);
  const approveUrl = url && current.kind === "APPROVAL_PENDING" ? `${url}#approval-section` : null;
  const dismiss = () => setQueue((q) => q.slice(1));
  const view = async () => {
    await markRead([current.id]);
    dismiss();
    if (url) router.push(url);
  };
  const goApprove = async () => {
    await markRead([current.id]);
    dismiss();
    if (approveUrl) router.push(approveUrl);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 w-80 animate-[slideIn_0.25s_ease-out] rounded-2xl bg-white p-4 shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-gray-900">
          {current.title ?? "新通知"}
        </div>
        <button
          onClick={dismiss}
          className="text-gray-400 hover:text-gray-600"
          aria-label="关闭"
        >
          ✕
        </button>
      </div>
      <div className="mt-1 line-clamp-3 text-sm text-gray-600">{current.content}</div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={dismiss}
          className="rounded px-3 py-1 text-sm text-gray-500 hover:bg-gray-100"
        >
          稍后
        </button>
        {url && (
          <button
            onClick={view}
            className="rounded bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
          >
            查看
          </button>
        )}
        {approveUrl && (
          <button
            onClick={goApprove}
            className="rounded bg-[#0071e3] px-3 py-1 text-sm text-white hover:bg-[#0077ed]"
          >
            去审批
          </button>
        )}
      </div>
      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
