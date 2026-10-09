"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import { Field, inputCls, btnPrimary, btnSecondary } from "./ui";

export type PaymentInput = {
  id?: string;
  title: string;
  amount: string;
  payeeName: string;
  payeeAccount: string;
  reason: string;
  outletId: string;
  campaignId: string;
  contentId: string;
  ticketId?: string | null;
};

export type TicketPrefill = {
  ticketId: string;
  ticketTitle: string;
  amount: string;
  payeeName: string;
  reason: string;
};

type Opt = { id: string; name?: string; title?: string };

export default function PaymentForm({
  initial,
  outlets,
  campaigns,
  contents,
  ticketPrefill,
  onClose,
}: {
  initial?: Partial<PaymentInput> & { id?: string };
  outlets: Opt[];
  campaigns: Opt[];
  contents: Opt[];
  ticketPrefill?: TicketPrefill;
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<PaymentInput>({
    title: initial?.title ?? ticketPrefill?.ticketTitle ?? "",
    amount: initial?.amount ?? ticketPrefill?.amount ?? "",
    payeeName: initial?.payeeName ?? ticketPrefill?.payeeName ?? "",
    payeeAccount: initial?.payeeAccount ?? "",
    reason: initial?.reason ?? ticketPrefill?.reason ?? "",
    outletId: initial?.outletId ?? "",
    campaignId: initial?.campaignId ?? "",
    contentId: initial?.contentId ?? "",
    ticketId: ticketPrefill?.ticketId ?? null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) return setError("标题不能为空");
    if (!form.amount || Number(form.amount) <= 0) return setError("金额必须大于 0");
    if (!form.payeeName.trim()) return setError("收款方不能为空");
    setBusy(true);
    try {
      const url = initial?.id ? `/api/payments/${initial.id}` : "/api/payments";
      const res = await fetch(url, {
        method: initial?.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          amount: form.amount,
          payeeName: form.payeeName.trim(),
          payeeAccount: form.payeeAccount.trim() || null,
          reason: form.reason.trim() || null,
          outletId: form.outletId || null,
          campaignId: form.campaignId || null,
          contentId: form.contentId || null,
          ticketId: form.ticketId || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "保存失败");
        return;
      }
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={initial?.id ? "编辑打款申请" : "新建打款申请"} onClose={onClose}>
      <form onSubmit={onSubmit}>
        <Field label="标题" required hint="如：双11达人合作尾款-美妆老王">
          <input className={inputCls} value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="金额（元）" required>
            <input type="number" min={0.01} step="0.01" className={inputCls} value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <Field label="收款方" required>
            <input className={inputCls} value={form.payeeName}
              onChange={(e) => setForm({ ...form, payeeName: e.target.value })} />
          </Field>
        </div>
        <Field label="收款账号">
          <input className={inputCls} value={form.payeeAccount}
            onChange={(e) => setForm({ ...form, payeeAccount: e.target.value })}
            placeholder="银行卡号 / 支付宝账号等" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="关联资源">
            <select className={inputCls} value={form.outletId}
              onChange={(e) => setForm({ ...form, outletId: e.target.value })}>
              <option value="">不关联</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </Field>
          <Field label="关联项目">
            <select className={inputCls} value={form.campaignId}
              onChange={(e) => setForm({ ...form, campaignId: e.target.value })}>
              <option value="">不关联</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="关联内容">
            <select className={inputCls} value={form.contentId}
              onChange={(e) => setForm({ ...form, contentId: e.target.value })}>
              <option value="">不关联</option>
              {contents.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="申请事由">
          <textarea className={inputCls} rows={3} value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </Field>
        <p className="mb-3 rounded bg-blue-50 p-2 text-xs text-blue-800">
          发票为选填：提交、审批、打款均不需要发票；如有发票可在「发票管理」中上传并关联。
        </p>
        {ticketPrefill && (
          <p className="mb-3 rounded bg-purple-50 p-2 text-xs text-purple-800">
            关联合作工单：{ticketPrefill.ticketTitle}（提交后工单进入「结算中」）
          </p>
        )}
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={onClose}>取消</button>
          <button type="submit" className={btnPrimary} disabled={busy}>
            {busy ? "提交中…" : initial?.id ? "保存" : "提交申请"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
