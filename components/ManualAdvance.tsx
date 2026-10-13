"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export type ManualAction = {
  /** 动作唯一标识，如 publish / confirm-review */
  key: string;
  /** 按钮文案，如"标记已发布" */
  label: string;
  /** 实际执行推进的接口，默认 POST */
  endpoint: string;
  method?: "POST" | "PATCH" | "PUT";
  /** 弹窗内说明文字 */
  description?: string;
  /** 是否必填备注 */
  requireNote?: boolean;
  /** 按钮样式 */
  variant?: "default" | "secondary" | "outline" | "destructive" | "ghost";
};

type Props = {
  ticketId: string;
  /** 可执行的手动推进动作列表 */
  actions: ManualAction[];
  /** 当前操作人姓名（显示用；实际操作人/时间由服务端写评论时记录） */
  operatorName?: string;
  /** 推进成功后的回调（如刷新详情页） */
  onDone?: (actionKey: string) => void;
  className?: string;
};

const fmtNow = () =>
  new Date().toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

/**
 * 手动推进流程按钮组件（shadcn 风格，颜色走 CSS 变量）。
 * 点击动作 → 二次确认弹窗（可填备注）→ 调业务接口 → 成功后写一条
 * TicketComment 记录操作人、时间与动作（服务端以登录用户为作者），
 * 再回调 onDone 让页面刷新。
 *
 * 用法示例：
 *   <ManualAdvance
 *     ticketId={ticket.id}
 *     operatorName={session.user.name}
 *     onDone={() => router.refresh()}
 *     actions={[
 *       { key: "publish", label: "标记已发布", endpoint: `/api/tickets/${ticket.id}/publish` },
 *       { key: "confirm-review", label: "确认返稿", endpoint: `/api/tickets/${ticket.id}/confirm-review`, requireNote: true },
 *     ]}
 *   />
 */
export default function ManualAdvance({
  ticketId,
  actions,
  operatorName,
  onDone,
  className,
}: Props) {
  const [active, setActive] = useState<ManualAction | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (actions.length === 0) return null;

  const open = (a: ManualAction) => {
    setActive(a);
    setNote("");
    setError(null);
  };

  const confirm = async () => {
    if (!active) return;
    if (active.requireNote && !note.trim()) {
      setError("请填写备注");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(active.endpoint, {
        method: active.method ?? "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "操作失败");

      // 记录操作人 + 时间 + 动作（写入工单评论，服务端以当前登录用户为作者）
      const who = operatorName ? `【${operatorName}】` : "";
      await fetch(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `【手动推进】${who}于 ${fmtNow()} 执行了「${active.label}」${
            note.trim() ? `，备注：${note.trim()}` : ""
          }`,
        }),
      }).catch(() => {
        /* 评论写入失败不阻塞主流程 */
      });

      setActive(null);
      onDone?.(active.key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className={`flex flex-wrap gap-2 ${className ?? ""}`}>
        {actions.map((a) => (
          <Button
            key={a.key}
            variant={a.variant ?? "outline"}
            size="sm"
            onClick={() => open(a)}
          >
            {a.label}
          </Button>
        ))}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>手动推进：{active?.label}</DialogTitle>
            <DialogDescription>
              {active?.description ?? "确认执行该推进操作吗？执行后将记录操作人和时间。"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <label className="text-sm font-medium">
              备注{active?.requireNote && <span className="text-destructive">（必填）</span>}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="填写推进说明（将随操作记录写入工单评论）"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)} disabled={submitting}>
              取消
            </Button>
            <Button onClick={confirm} disabled={submitting}>
              {submitting ? "执行中…" : "确认推进"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
