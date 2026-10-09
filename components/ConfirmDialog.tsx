"use client";
import { useState } from "react";
import Modal from "./Modal";
import { Field, inputCls, btnPrimary, btnSecondary, btnDanger } from "./ui";

// 通用二次确认弹窗：所有审批操作（提交/通过/驳回/作废/重提等）防误触
export default function ConfirmDialog({
  title,
  message,
  needReason = false,
  reasonLabel = "理由",
  reasonPlaceholder = "",
  reasonOptional = false,
  confirmText = "确认",
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}: {
  title: string;
  message?: string;
  needReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonOptional?: boolean;
  confirmText?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (needReason && !reasonOptional && !reason.trim()) {
      setError(`${reasonLabel}不能为空`);
      return;
    }
    onConfirm(reason.trim());
  };

  return (
    <Modal title={title} onClose={onClose}>
      {message && <p className="mb-3 text-sm text-gray-600">{message}</p>}
      {needReason && (
        <Field label={reasonLabel} required={!reasonOptional}>
          <textarea
            className={inputCls}
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonPlaceholder}
          />
        </Field>
      )}
      <div className="flex justify-end gap-2">
        <button className={btnSecondary} onClick={onClose} disabled={busy}>
          取消
        </button>
        <button
          className={danger ? btnDanger : btnPrimary}
          disabled={busy}
          onClick={submit}
        >
          {busy ? "处理中…" : confirmText}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Modal>
  );
}
