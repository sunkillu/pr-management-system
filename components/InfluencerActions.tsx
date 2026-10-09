"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary, btnSecondary, btnDanger } from "./ui";
import ConfirmDialog from "./ConfirmDialog";

// 达人登记操作：审批（通过/驳回，或签）、重新提交、催办。全部走二次确认。
export default function InfluencerActions({
  id,
  status,
  canApprove,
  canResubmit,
  canRemind,
  name,
}: {
  id: string;
  status: string;
  canApprove: boolean;
  canResubmit: boolean;
  canRemind: boolean;
  name: string;
}) {
  const router = useRouter();
  const [dlg, setDlg] = useState<null | "approve" | "reject" | "resubmit" | "remind">(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function call(url: string, body?: object) {
    setBusy(true);
    setMsg("");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setDlg(null);
    if (!res.ok) {
      setMsg(data.error || "操作失败");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "PENDING" && canApprove && (
        <>
          <button className={btnPrimary} onClick={() => setDlg("approve")}>通过</button>
          <button className={btnDanger} onClick={() => setDlg("reject")}>驳回</button>
        </>
      )}
      {status === "REJECTED" && canResubmit && (
        <button className={btnPrimary} onClick={() => setDlg("resubmit")}>修改后重新提交</button>
      )}
      {status === "PENDING" && canRemind && (
        <button className={btnSecondary} onClick={() => setDlg("remind")}>提醒审批人</button>
      )}
      {msg && <span className="text-sm text-red-600">{msg}</span>}

      {dlg === "approve" && (
        <ConfirmDialog
          title="确认通过"
          message={`确认通过达人「${name}」的登记？通过后可用于合作。`}
          confirmText="通过"
          busy={busy}
          onClose={() => setDlg(null)}
          onConfirm={() => call(`/api/influencers/${id}/approve`, { action: "APPROVE" })}
        />
      )}
      {dlg === "reject" && (
        <ConfirmDialog
          title="驳回登记"
          needReason
          reasonLabel="驳回理由"
          confirmText="驳回"
          danger
          busy={busy}
          onClose={() => setDlg(null)}
          onConfirm={(reason) => call(`/api/influencers/${id}/approve`, { action: "REJECT", comment: reason })}
        />
      )}
      {dlg === "resubmit" && (
        <ConfirmDialog
          title="重新提交"
          message="将重新提交该登记并通知审批人（可在详情页先编辑信息）。"
          needReason
          reasonLabel="修改说明"
          reasonOptional
          confirmText="重新提交"
          busy={busy}
          onClose={() => setDlg(null)}
          onConfirm={(reason) => call(`/api/influencers/${id}/resubmit`, { note: reason })}
        />
      )}
      {dlg === "remind" && (
        <ConfirmDialog
          title="提醒审批人"
          message="将通过飞书通知提醒待审批的审批人尽快处理。"
          confirmText="发送提醒"
          busy={busy}
          onClose={() => setDlg(null)}
          onConfirm={() => call(`/api/influencers/${id}/remind`)}
        />
      )}
    </div>
  );
}
