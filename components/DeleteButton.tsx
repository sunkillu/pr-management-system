"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteButton({ url, label = "删除" }: { url: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (!confirm("确定删除吗？此操作不可恢复。")) return;
    setBusy(true);
    try {
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "删除失败");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="text-sm text-red-600 hover:underline disabled:opacity-50"
    >
      {busy ? "删除中…" : label}
    </button>
  );
}
