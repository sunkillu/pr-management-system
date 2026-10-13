"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const textareaCls =
  "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

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
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {message && (
            <DialogDescription className="whitespace-pre-wrap">{message}</DialogDescription>
          )}
        </DialogHeader>
        {needReason && (
          <div className="grid gap-2">
            <label className="text-sm font-medium leading-none">
              {reasonLabel}
              {!reasonOptional && <span className="text-destructive"> *</span>}
            </label>
            <textarea
              className={textareaCls}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            取消
          </Button>
          <Button variant={danger ? "destructive" : "default"} disabled={busy} onClick={submit}>
            {busy ? "处理中…" : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
