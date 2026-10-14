"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ConfirmDialog";
import { btnSecondary } from "@/components/ui";

export default function MaintenanceActions({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirmConvert() {
    setBusy(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/convert-to-cooperation`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "转换失败");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={btnSecondary} onClick={() => setOpen(true)}>
        转为合作工单
      </button>
      {open && (
        <ConfirmDialog
          title="转为合作工单"
          message="转换后该工单会变为合作工单草稿，需要补全品牌、类目、预算等合作信息后再提交审批。确认继续吗？"
          confirmText="确认转换"
          busy={busy}
          onClose={() => !busy && setOpen(false)}
          onConfirm={confirmConvert}
        />
      )}
    </>
  );
}
