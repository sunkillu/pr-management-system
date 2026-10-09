"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import { Field, inputCls, btnPrimary, btnSecondary } from "./ui";
import { invoiceTypeLabels } from "@/lib/labels";

type PaymentOpt = { id: string; title: string };

function toDateInput(d: string): string {
  if (!d) return "";
  return d.slice(0, 10);
}

export default function InvoiceForm({
  payments,
  onClose,
}: {
  payments: PaymentOpt[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [invoiceNo, setInvoiceNo] = useState("");
  const [issuer, setIssuer] = useState("");
  const [amount, setAmount] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [type, setType] = useState("E_INVOICE");
  const [paymentRequestId, setPaymentRequestId] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!invoiceNo.trim()) return setError("发票号码不能为空");
    if (!issuer.trim()) return setError("开票方不能为空");
    if (!amount || Number(amount) <= 0) return setError("金额必须大于 0");
    if (!issueDate) return setError("请选择开票日期");
    if (file) {
      const okTypes = ["application/pdf", "image/jpeg", "image/png"];
      if (!okTypes.includes(file.type)) return setError("仅支持 PDF / JPG / PNG 文件");
      if (file.size > 10 * 1024 * 1024) return setError("文件不能超过 10MB");
    }
    setBusy(true);
    try {
      // 1) 先上传文件（选填）
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        const up = await fetch("/api/invoices/upload", { method: "POST", body: fd });
        if (!up.ok) {
          const d = await up.json().catch(() => ({}));
          setError(d.error || "文件上传失败");
          return;
        }
        const ud = await up.json();
        fileUrl = ud.fileUrl;
        fileName = ud.fileName;
      }
      // 2) 创建发票记录
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNo: invoiceNo.trim(),
          issuer: issuer.trim(),
          amount,
          issueDate,
          type,
          paymentRequestId: paymentRequestId || null,
          note: note.trim() || null,
          fileUrl,
          fileName,
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
    <Modal title="上传发票" onClose={onClose}>
      <form onSubmit={onSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="发票号码" required>
            <input className={inputCls} value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
          </Field>
          <Field label="开票方" required>
            <input className={inputCls} value={issuer} onChange={(e) => setIssuer(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="金额（元）" required>
            <input type="number" min={0.01} step="0.01" className={inputCls} value={amount}
              onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="开票日期" required>
            <input type="date" className={inputCls} value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)} />
          </Field>
          <Field label="发票类型" required>
            <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
              {Object.entries(invoiceTypeLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="关联打款单" hint="选填：可将发票关联到某笔打款申请">
          <select className={inputCls} value={paymentRequestId}
            onChange={(e) => setPaymentRequestId(e.target.value)}>
            <option value="">不关联</option>
            {payments.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </Field>
        <Field label="发票文件" hint="选填：仅支持 PDF / JPG / PNG，最大 10MB">
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className={inputCls}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file && <p className="mt-1 text-xs text-gray-500">已选择：{file.name}</p>}
        </Field>
        <Field label="备注">
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={onClose}>取消</button>
          <button type="submit" className={btnPrimary} disabled={busy}>{busy ? "上传中…" : "保存"}</button>
        </div>
      </form>
    </Modal>
  );
}

// 为编辑模式复用的简化类型
export function invoiceToDateInput(d: unknown): string {
  return toDateInput(String(d ?? ""));
}
