"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import ConfirmDialog from "./ConfirmDialog";
import { btnPrimarySm, btnDangerSm } from "./ui";

// 内容状态流转按钮：提交审批 / 重新提交 / 通过 / 驳回 / 标记已发布 / 作废
// 所有操作均经二次确认弹窗；驳回/作废必填理由
export default function ContentActions({
  id,
  status,
  role,
  isOwner,
}: {
  id: string;
  status: string;
  role: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<null | {
    key: string;
    title: string;
    message?: string;
    needReason?: boolean;
    reasonLabel?: string;
    reasonPlaceholder?: string;
    reasonOptional?: boolean;
    confirmText?: string;
    danger?: boolean;
    run: (reason: string) => void;
  }>(null);

  const isAdmin = role === "ADMIN";
  const isEditor = role === "ADMIN" || role === "OPERATOR";

  const call = async (url: string, body?: object) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "操作失败");
        return;
      }
      setDialog(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const open = (d: NonNullable<typeof dialog>) => {
    setError("");
    setDialog(d);
  };

  const canVoid =
    status !== "VOIDED" &&
    status !== "PUBLISHED" &&
    (isAdmin || (isOwner && status === "PENDING"));

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {isEditor && (status === "DRAFT" || status === "REJECTED") && (
        <button
          disabled={busy}
          onClick={() =>
            status === "REJECTED"
              ? open({
                  key: "resubmit",
                  title: "重新提交审批",
                  message: "修改内容后重新提交，将回到待审批状态并重新走完整审批链。",
                  needReason: true,
                  reasonLabel: "修改说明",
                  reasonPlaceholder: "请说明本次修改了哪些内容（选填，会记入历史记录）",
                  reasonOptional: true,
                  confirmText: "确认重新提交",
                  run: (reason) => call(`/api/contents/${id}/submit`, { note: reason }),
                })
              : open({
                  key: "submit",
                  title: "提交审批",
                  message: "确认提交该内容进入审批流程吗？",
                  confirmText: "确认提交",
                  run: () => call(`/api/contents/${id}/submit`),
                })
          }
          className="rounded bg-[#0071e3] px-3 py-1 text-sm text-white hover:bg-[#0077ed] disabled:opacity-50"
        >
          {status === "REJECTED" ? "重新提交" : "提交审批"}
        </button>
      )}
      {isAdmin && status === "PENDING" && (
        <>
          <button
            disabled={busy}
            onClick={() =>
              open({
                key: "approve",
                title: "通过审批",
                message: "确认通过该内容的审批吗？",
                needReason: true,
                reasonLabel: "审批意见",
                reasonPlaceholder: "通过可留空",
                reasonOptional: true,
                confirmText: "确认通过",
                run: (reason) =>
                  call(`/api/contents/${id}/approve`, {
                    action: "APPROVE",
                    comment: reason || undefined,
                  }),
              })
            }
            className={btnPrimarySm}
          >
            通过
          </button>
          <button
            disabled={busy}
            onClick={() =>
              open({
                key: "reject",
                title: "驳回内容",
                needReason: true,
                reasonLabel: "驳回理由",
                reasonPlaceholder: "请说明需要修改的地方",
                confirmText: "确认驳回",
                danger: true,
                run: (reason) =>
                  call(`/api/contents/${id}/approve`, { action: "REJECT", comment: reason }),
              })
            }
            className={btnDangerSm}
          >
            驳回
          </button>
        </>
      )}
      {isEditor && status === "APPROVED" && (
        <button
          disabled={busy}
          onClick={() =>
            open({
              key: "publish",
              title: "标记已发布",
              message: "确认该内容已发布吗？",
              confirmText: "确认发布",
              run: () => call(`/api/contents/${id}/publish`),
            })
          }
          className={btnPrimarySm}
        >
          标记已发布
        </button>
      )}
      {canVoid && (
        <button
          disabled={busy}
          onClick={() =>
            open({
              key: "void",
              title: "作废内容",
              message: "作废后该内容不可再流转，只能查看。确认作废吗？",
              needReason: true,
              reasonLabel: "作废理由",
              reasonPlaceholder: "请说明作废原因",
              confirmText: "确认作废",
              danger: true,
              run: (reason) => call(`/api/contents/${id}/void`, { reason }),
            })
          }
          className={btnDangerSm}
        >
          作废
        </button>
      )}
      {error && <span className="text-sm text-red-600">{error}</span>}

      {dialog && (
        <ConfirmDialog
          title={dialog.title}
          message={dialog.message}
          needReason={dialog.needReason}
          reasonLabel={dialog.reasonLabel}
          reasonPlaceholder={dialog.reasonPlaceholder}
          reasonOptional={dialog.reasonOptional}
          confirmText={dialog.confirmText}
          danger={dialog.danger}
          busy={busy}
          onConfirm={dialog.run}
          onClose={() => setDialog(null)}
        />
      )}
    </span>
  );
}
