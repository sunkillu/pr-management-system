"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary, btnSecondary, btnDanger, inputCls } from "@/components/ui";
import ConfirmDialog from "./ConfirmDialog";

type Props = {
  sample: { id: string; productName: string; status: string; infoConfirmed?: boolean; createdById?: string };
  role: string;
  userId?: string;
};

export default function SampleActions({ sample, role, userId }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<null | "ship" | "sign" | "cancel" | "writeoff">(null);
  const [confirmAct, setConfirmAct] = useState<null | "confirm-info" | "accept">(null);
  const [shipReview, setShipReview] = useState(false);
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
  // 仅提交人或管理员可确认信息并推送仓库
  const canConfirmInfo =
    sample.status === "PENDING" &&
    !sample.infoConfirmed &&
    (role === "ADMIN" || (userId && sample.createdById === userId));

  return (
    <div className="flex flex-wrap gap-2">
      {canConfirmInfo && (
        <button className={btnPrimary} onClick={() => setConfirmAct("confirm-info")} disabled={busy}>
          确认信息并推送仓库
        </button>
      )}
      {sample.status === "PENDING" && sample.infoConfirmed && (
        <span className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-200">
          已推送仓库
        </span>
      )}
      {sample.status === "PENDING" && canWarehouse && sample.infoConfirmed && (
        <button className={btnPrimary} onClick={() => setConfirmAct("accept")} disabled={busy}>
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
                <p className="text-xs text-gray-500">寄件：{sample.productName}</p>
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
                  if (modal === "ship") {
                    if (!courier.trim() || !trackingNo.trim()) { setError("快递公司和快递单号必填"); return; }
                    setShipReview(true);
                  }
                  else if (modal === "sign") call("sign", { note });
                  else if (modal === "writeoff") call("writeoff", { note });
                  else if (modal === "cancel") call("cancel", { reason });
                }}
              >
                {busy ? "提交中…" : modal === "ship" ? "核对信息" : "确认"}
              </button>
            </div>
          </div>
        </div>
      )}

      {shipReview && (
        <ConfirmDialog
          title="核对寄出信息"
          message={`寄件：${sample.productName}\n快递公司：${courier.trim()}\n快递单号：${trackingNo.trim()}\n\n核对无误后将标记为已寄出，并自动完成工单寄品节点。`}
          confirmText="确认寄出"
          busy={busy}
          onClose={() => setShipReview(false)}
          onConfirm={async () => { setShipReview(false); await call("ship", { courier: courier.trim(), trackingNo: trackingNo.trim() }); }}
        />
      )}

      {confirmAct && (
        <ConfirmDialog
          title={confirmAct === "accept" ? "接单备货" : "确认信息并推送仓库"}
          message={
            confirmAct === "accept"
              ? `寄件：${sample.productName}\n确认接单并开始备货吗？`
              : `寄件：${sample.productName}\n请核对收件信息无误，确认后将推送给仓库接单。`
          }
          confirmText={confirmAct === "accept" ? "确认接单" : "确认推送"}
          busy={busy}
          onClose={() => setConfirmAct(null)}
          onConfirm={async () => { const a = confirmAct; setConfirmAct(null); await call(a, {}); }}
        />
      )}
    </div>
  );
}
