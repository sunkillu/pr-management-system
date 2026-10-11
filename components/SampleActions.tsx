"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary, btnSecondary, btnDanger, inputCls } from "@/components/ui";

type Props = {
  sample: { id: string; productName: string; status: string };
  role: string;
};

export default function SampleActions({ sample, role }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<null | "ship" | "sign" | "cancel" | "writeoff">(null);
  const [courier, setCourier] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const call = async (path: string, body: object) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/samples/${sample.id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "操作失败");
      setModal(null);
      setNote("");
      setReason("");
      setCourier("");
      setTrackingNo("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };

  const canWarehouse = ["ADMIN", "WAREHOUSE"].includes(role);
  const canSign = ["ADMIN", "PR", "PR_MANAGER"].includes(role);
  const canFinance = ["ADMIN", "FINANCE"].includes(role);
  const canCancel = ["ADMIN", "PR", "PR_MANAGER", "WAREHOUSE"].includes(role);
  const terminal = ["SIGNED", "WRITTEN_OFF", "CANCELLED", "RETURNED"].includes(sample.status);

  return (
    <div className="flex flex-wrap gap-2">
      {sample.status === "PENDING" && canWarehouse && (
        <button className={btnPrimary} onClick={() => call("accept", {})} disabled={busy}>
          接单备货
        </button>
      )}
      {sample.status === "PREPARING" && canWarehouse && (
        <button className={btnPrimary} onClick={() => setModal("ship")}>
          标记寄出
        </button>
      )}
      {sample.status === "SHIPPED" && canSign && (
        <button className={btnPrimary} onClick={() => setModal("sign")}>
          确认签收
        </button>
      )}
      {sample.status === "SIGNED" && canFinance && (
        <button className={btnSecondary} onClick={() => setModal("writeoff")}>
          核销
        </button>
      )}
      {!terminal && canCancel && (
        <button className={btnDanger} onClick={() => setModal("cancel")}>
          取消
        </button>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setModal(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-base font-semibold">
              {modal === "ship" && "标记寄出"}
              {modal === "sign" && "确认签收"}
              {modal === "cancel" && "取消寄件请求"}
              {modal === "writeoff" && "核销"}
            </h3>
            {modal === "ship" && (
              <div className="space-y-3">
                <input className={inputCls} placeholder="快递公司（必填）" value={courier} onChange={(e) => setCourier(e.target.value)} />
                <input className={inputCls} placeholder="快递单号（必填）" value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} />
              </div>
            )}
            {modal === "sign" && (
              <textarea className={inputCls} rows={3} placeholder="签收备注（选填）" value={note} onChange={(e) => setNote(e.target.value)} />
            )}
            {modal === "writeoff" && (
              <textarea className={inputCls} rows={3} placeholder="核销说明（选填）" value={note} onChange={(e) => setNote(e.target.value)} />
            )}
            {modal === "cancel" && (
              <textarea className={inputCls} rows={3} placeholder="取消理由（必填）" value={reason} onChange={(e) => setReason(e.target.value)} />
            )}
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button className={btnSecondary} onClick={() => setModal(null)} disabled={busy}>关闭</button>
              <button
                className={modal === "cancel" ? btnDanger : btnPrimary}
                disabled={busy}
                onClick={() => {
                  if (modal === "ship") call("ship", { courier, trackingNo });
                  else if (modal === "sign") call("sign", { note });
                  else if (modal === "writeoff") call("writeoff", { note });
                  else if (modal === "cancel") call("cancel", { reason });
                }}
              >
                {busy ? "提交中…" : "确认"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
