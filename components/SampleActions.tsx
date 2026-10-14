"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SampleActions({
  sample,
  role,
  userId,
}: {
  sample: { id: string; productName: string; status: string; infoConfirmed: boolean; createdById: string };
  role: string;
  userId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const canWarehouse = ["ADMIN", "PR_MANAGER", "WAREHOUSE"].includes(role);
  const canWrite = ["ADMIN", "PR", "PR_MANAGER"].includes(role) && (role !== "PR" || sample.createdById === userId);

  async function act(path: string, message: string, body?: Record<string, unknown>) {
    if (!confirm(message)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/samples/${sample.id}/${path}`, { method: "POST", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) alert(data.error || "操作失败");
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canWarehouse && sample.status === "PENDING" && (
        <button disabled={busy} className="text-xs text-primary hover:underline" onClick={() => act("accept", "确认接单并进入备货？")}>接单</button>
      )}
      {canWrite && sample.status === "PENDING" && (
        <button disabled={busy} className="text-xs text-primary hover:underline" onClick={() => act("confirm-info", sample.infoConfirmed ? "确认已修改寄品信息，并重新推送仓库？" : "确认寄品信息无误并推送仓库？", { resend: sample.infoConfirmed })}>{sample.infoConfirmed ? "重新推送仓库" : "推送仓库"}</button>
      )}
      {canWarehouse && sample.status === "PREPARING" && (
        <button disabled={busy} className="text-xs text-primary hover:underline" onClick={() => {
          const courier = window.prompt("请输入快递公司");
          if (!courier?.trim()) return;
          const trackingNo = window.prompt("请输入快递单号");
          if (!trackingNo?.trim()) return;
          void act("ship", `确认使用 ${courier.trim()}、单号 ${trackingNo.trim()} 寄出？`, { courier: courier.trim(), trackingNo: trackingNo.trim() });
        }}>寄件</button>
      )}
      {canWarehouse && sample.status === "SHIPPED" && (
        <button disabled={busy} className="text-xs text-primary hover:underline" onClick={() => act("sign", "确认达人已签收？")}>确认签收</button>
      )}
      {canWrite && ["PENDING", "PREPARING"].includes(sample.status) && (
        <button disabled={busy} className="text-xs text-red-600 hover:underline" onClick={() => act("cancel", "确认取消该寄品请求？")}>取消</button>
      )}
    </div>
  );
}
