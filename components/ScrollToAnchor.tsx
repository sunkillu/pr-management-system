"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** 页面加载或路由变化时，若 URL 带 #锚点则滚动定位到对应元素 */
export default function ScrollToAnchor() {
  const pathname = usePathname();

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    // 等待内容渲染完成后再滚动
    const t = setTimeout(() => {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
    return () => clearTimeout(t);
  }, [pathname]);

  return null;
}
