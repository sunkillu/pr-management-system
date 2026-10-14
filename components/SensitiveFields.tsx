"use client";
import { useEffect, useRef } from "react";
import { InfoRow } from "@/components/ui";

export type SensitiveFieldItem = {
  key: string;
  label: string;
  value: string | null;
};

/**
 * A级敏感字段展示（shadcn 风格）。
 * 有权限时展示字段值并向 /api/sensitive-log 写一条访问日志（只传字段名，不传值）；
 * 无权限时渲染"无权查看"。
 */
export default function SensitiveFields({
  fields,
  canView,
  targetType,
  targetId,
  source,
}: {
  fields: SensitiveFieldItem[];
  canView: boolean;
  targetType: string;
  targetId: string;
  source: string;
}) {
  const logged = useRef(false);
  useEffect(() => {
    if (!canView || logged.current) return;
    logged.current = true;
    fetch("/api/sensitive-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType,
        targetId,
        fields: fields.map((f) => f.key),
        source,
      }),
    }).catch(() => {});
  }, [canView, targetType, targetId, source, fields]);

  return (
    <dl>
      {fields.map((f) => (
        <InfoRow key={f.key} label={f.label}>
          {canView ? (
            f.value ?? "-"
          ) : (
            <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              无权查看
            </span>
          )}
        </InfoRow>
      ))}
    </dl>
  );
}
