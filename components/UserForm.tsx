"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import { Field, inputCls, btnPrimary, btnSecondary } from "./ui";
import { roleLabels } from "@/lib/labels";

export type UserInput = {
  id?: string;
  name: string;
  email: string;
  password: string;
  role: string;
};

export default function UserForm({
  initial,
  onClose,
}: {
  initial?: Partial<UserInput> & { id?: string };
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<UserInput>({
    name: initial?.name ?? "",
    email: initial?.email ?? "",
    password: "",
    role: initial?.role ?? "VIEWER",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) return setError("姓名不能为空");
    if (!form.email.trim()) return setError("邮箱不能为空");
    if (!initial?.id && form.password.length < 6) return setError("密码至少 6 位");
    if (initial?.id && form.password && form.password.length < 6) return setError("密码至少 6 位");
    setBusy(true);
    try {
      const url = initial?.id ? `/api/users/${initial.id}` : "/api/users";
      const payload: Record<string, string> = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
      };
      if (form.password) payload.password = form.password;
      const res = await fetch(url, {
        method: initial?.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    <Modal title={initial?.id ? "编辑用户" : "新增用户"} onClose={onClose}>
      <form onSubmit={onSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="姓名" required>
            <input className={inputCls} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="邮箱" required>
            <input type="email" className={inputCls} value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              disabled={!!initial?.id} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={initial?.id ? "密码（留空则不修改）" : "密码"}
            required={!initial?.id}
          >
            <input type="password" className={inputCls} value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="至少 6 位" />
          </Field>
          <Field label="角色" required>
            <select className={inputCls} value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {Object.entries(roleLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
        </div>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={btnSecondary} onClick={onClose}>取消</button>
          <button type="submit" className={btnPrimary} disabled={busy}>{busy ? "保存中…" : "保存"}</button>
        </div>
      </form>
    </Modal>
  );
}
