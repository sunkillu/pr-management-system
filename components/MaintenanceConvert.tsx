"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary } from "./ui";
import ConfirmDialog from "./ConfirmDialog";

// 维护工单转为合作工单按钮：仅 ADMIN / PR_MANAGER / 归属 PR 可见（后端同样校验）
export default function MaintenanceConvert({
  ticketId,
  ticketTitle,
  role,
  userId,
  creatorId,
  assigneeId,
}: {
  ticketId: string;
  ticketTitle: string;
  role: string;
  userId: string;
  creatorId: string;
  assigneeId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const isOwner = assigneeId ? assigneeId === userId : creatorId === userId;
  const canConvert = ["ADMIN", "PR_MANAGER"].includes(role) || (role === "PR" && isOwner);
  if (!canConvert) return null;

  return (
    <div className="mt-3">
      <button className={btnPrimary} onClick={() => setShowConfirm(true)}>
        转为合作工单
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {showConfirm && (
        <ConfirmDialog
          title="转为合作工单"
          message={`确认将维护工单「${ticketTitle}」转为合作工单吗？转化后状态回到草稿，需补充合作信息（合作类目/档期/预算）后提交审批，走完整合作流程。`}
          confirmText="确认转化"
          busy={busy}
          onClose={() => setShowConfirm(false)}
          onConfirm={async () => {
            setBusy(true);
            setError("");
            try {
              const res = await fetch(`/api/tickets/${ticketId}/convert-to-cooperation`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                setError(data.error || "转化失败");
                return;
              }
              setShowConfirm(false);
              router.refresh();
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}
