"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import { inputCls, btnPrimary, btnSecondary, Field } from "./ui";
import { sampleStatusLabels } from "@/lib/labels";
import { LOGISTICS_STATUSES, ABNORMAL_FLAGS } from "@/lib/logistics";

// 仓库维护寄件信息：快递公司 / 快递单号 / 寄出日期 / 发货时间 / 物流状态 / 异常标记 / 寄件人 / 状态
export default function SampleShipForm({
  sample,
}: {
  sample: {
    id: string;
    courier?: string | null;
    trackingNo?: string | null;
    shippedDate?: string | null;
    shippedAt?: string | null;
    logisticsStatus?: string | null;
    abnormalFlag?: string | null;
    shippedBy?: string | null;
    status: string;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [courier, setCourier] = useState(sample.courier ?? "");
  const [trackingNo, setTrackingNo] = useState(sample.trackingNo ?? "");
  const [shippedDate, setShippedDate] = useState(sample.shippedDate ?? "");
  const [shippedAt, setShippedAt] = useState(sample.shippedAt ?? "");
  const [logisticsStatus, setLogisticsStatus] = useState(sample.logisticsStatus ?? "");
  const [abnormalFlag, setAbnormalFlag] = useState(sample.abnormalFlag ?? "");
  const [shippedBy, setShippedBy] = useState(sample.shippedBy ?? "");
  const [status, setStatus] = useState(sample.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/samples/${sample.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courier,
        trackingNo,
        shippedDate,
        shippedAt: shippedAt || null,
        logisticsStatus: logisticsStatus || null,
        abnormalFlag: abnormalFlag || null,
        shippedBy,
        status,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "保存失败");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        className="rounded border border-primary px-2.5 py-1 text-xs text-primary hover:bg-primary/10"
        onClick={() => setOpen(true)}
      >
        维护寄件信息
      </button>
      {open && (
        <Modal title="维护寄件信息" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            <Field label="快递公司">
              <input className={inputCls} value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="如：顺丰" />
            </Field>
            <Field label="快递单号">
              <input className={inputCls} value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} />
            </Field>
            <Field label="寄出日期">
              <input type="date" className={inputCls} value={shippedDate} onChange={(e) => setShippedDate(e.target.value)} />
            </Field>
            <Field label="发货时间">
              <input
                type="datetime-local"
                className={inputCls}
                value={shippedAt}
                onChange={(e) => setShippedAt(e.target.value)}
                title="精确发货时间，供 T+1 物流检测使用"
              />
            </Field>
            <Field label="物流状态">
              <select className={inputCls} value={logisticsStatus} onChange={(e) => setLogisticsStatus(e.target.value)}>
                <option value="">—</option>
                {LOGISTICS_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="异常标记">
              <select className={inputCls} value={abnormalFlag} onChange={(e) => setAbnormalFlag(e.target.value)}>
                <option value="">—</option>
                {ABNORMAL_FLAGS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </Field>
            <Field label="寄件人">
              <input className={inputCls} value={shippedBy} onChange={(e) => setShippedBy(e.target.value)} placeholder="寄件人姓名" />
            </Field>
            <Field label="状态">
              <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
                {Object.entries(sampleStatusLabels).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button className={btnPrimary} disabled={busy} onClick={save}>保存</button>
              <button className={btnSecondary} onClick={() => setOpen(false)}>取消</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
