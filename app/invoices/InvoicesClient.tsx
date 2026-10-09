"use client";
import { useState } from "react";
import InvoiceForm from "@/components/InvoiceForm";
import InvoiceActions from "@/components/InvoiceActions";
import DeleteButton from "@/components/DeleteButton";
import { btnPrimary } from "@/components/ui";

type PaymentOpt = { id: string; title: string };

// 页头上传按钮，或行内操作（核验 / 删除）
export default function InvoicesClient({
  payments,
  row,
  role,
  canDelete,
}: {
  payments?: PaymentOpt[];
  row?: { id: string; status: string };
  role?: string;
  canDelete?: boolean;
}) {
  const [show, setShow] = useState(false);

  if (!row) {
    return (
      <>
        <button className={btnPrimary} onClick={() => setShow(true)}>
          上传发票
        </button>
        {show && <InvoiceForm payments={payments ?? []} onClose={() => setShow(false)} />}
      </>
    );
  }

  return (
    <span className="inline-flex items-center gap-3">
      <InvoiceActions id={row.id} status={row.status} role={role ?? "VIEWER"} />
      {canDelete && <DeleteButton url={`/api/invoices/${row.id}`} />}
    </span>
  );
}
