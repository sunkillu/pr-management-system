"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 轻量轮询：页面可见时每 intervalMs 自动刷新服务端数据，多人协作状态实时跟上
export default function AutoRefresh({ intervalMs = 30000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
