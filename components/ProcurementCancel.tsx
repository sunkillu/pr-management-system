"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnSecondary } from "./ui";
import ConfirmDialog from "./ConfirmDialog";

export default function ProcurementCancel({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(r: string) {
    setBusy(true);
    const res = await fetch(`/api/procurement/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancelReason: r }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      alert(data.error || "取消失败");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button className={btnSecondary} onClick={() => setOpen(true)}>取消需求</button>
      {open && (
        <ConfirmDialog
          title="取消采买需求"
          message="取消后进行中的任务将一并取消，请确认。"
          needReason
          reasonLabel="取消原因"
          reasonPlaceholder="请填写取消原因"
          confirmText="确认取消"
          danger
          busy={busy}
          onClose={() => setOpen(false)}
          onConfirm={submit}
        />
      )}
    </>
  );
}
