"use client";
import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/labels";
import { btnSecondary } from "./ui";

type Voucher = { id: string; fileUrl: string; fileName: string; createdAt: string; uploadedBy: { name: string } };

// 打款凭证上传与列表
export function PaymentVoucherSection({ paymentId, canUpload }: { paymentId: string; canUpload: boolean }) {
  const [list, setList] = useState<Voucher[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    fetch(`/api/payments/${paymentId}/vouchers`)
      .then((r) => r.json())
      .then((d) => setList(Array.isArray(d) ? d : []))
      .catch(() => {});
  };
  useEffect(load, [paymentId]);

  async function upload(file: File) {
    setError("");
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/payments/${paymentId}/vouchers`, { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) {
      setError(data.error || "上传失败");
      return;
    }
    load();
  }

  return (
    <div>
      {canUpload && (
        <div className="mb-3">
          <label className={btnSecondary + " cursor-pointer"}>
            {uploading ? "上传中…" : "上传凭证"}
            <input
              type="file"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
          </label>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      )}
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无凭证</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {list.map((v) => (
            <li key={v.id} className="rounded border border-border p-2">
              <a href={v.fileUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                {v.fileName}
              </a>
              <div className="text-xs text-muted-foreground">
                {v.uploadedBy?.name} · {formatDateTime(v.createdAt)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 催办按钮：提醒当前待审批环节的审批人
export function PaymentRemindButton({ paymentId }: { paymentId: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function remind() {
    if (!confirm("确认通过飞书通知提醒审批人尽快处理吗？")) return;
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/payments/${paymentId}/remind`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? `已提醒 ${data.count} 位审批人` : data.error || "提醒失败");
  }

  return (
    <span>
      <button className={btnSecondary} disabled={busy} onClick={remind}>
        {busy ? "发送中…" : "提醒审批人"}
      </button>
      {msg && <span className="ml-2 text-xs text-muted-foreground">{msg}</span>}
    </span>
  );
}
