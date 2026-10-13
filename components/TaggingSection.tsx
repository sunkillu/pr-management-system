"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type EntityType = "INFLUENCER" | "COOP_REQUEST" | "MATERIAL";

type TaggingItem = {
  id: string;
  tagId: string;
  createdAt: string;
  tag: { id: string; name: string; category: { name: string; key: string } };
  createdBy: { id: string; name: string };
};

type TagOption = { id: string; name: string };

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "刚刚";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min}分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day}天前`;
  return new Date(iso).toISOString().slice(0, 10);
}

// 通用打标签区：记录"谁给哪个实体打了什么标签"
export default function TaggingSection({
  entityType,
  entityId,
  categoryKey,
  meId,
  isAdmin,
  canTag,
  title = "标签",
}: {
  entityType: EntityType;
  entityId: string;
  categoryKey: string;
  meId: string;
  isAdmin: boolean;
  canTag: boolean;
  title?: string;
}) {
  const [list, setList] = useState<TaggingItem[]>([]);
  const [options, setOptions] = useState<TagOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/taggings?entityType=${entityType}&entityId=${entityId}`),
        fetch(`/api/tags?categoryKey=${encodeURIComponent(categoryKey)}`),
      ]);
      if (r1.ok) setList(await r1.json());
      if (r2.ok) setOptions((await r2.json()).map((t: TagOption) => ({ id: t.id, name: t.name })));
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, categoryKey]);

  useEffect(() => {
    load();
  }, [load]);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function addTags() {
    if (selected.length === 0) return;
    setSaving(true);
    setError("");
    try {
      for (const tagId of selected) {
        const res = await fetch("/api/taggings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagId, entityType, entityId }),
        });
        if (!res.ok && res.status !== 409) {
          const d = await res.json().catch(() => ({}));
          setError(d.error || "添加失败");
          break;
        }
      }
      setSelected([]);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/taggings/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "删除失败");
      return;
    }
    setList((l) => l.filter((x) => x.id !== id));
  }

  // 按打标签人分组
  const groups = useMemo(() => {
    const map = new Map<string, { name: string; items: TaggingItem[]; latest: string }>();
    for (const item of list) {
      const g = map.get(item.createdBy.id);
      if (g) {
        g.items.push(item);
        if (item.createdAt > g.latest) g.latest = item.createdAt;
      } else {
        map.set(item.createdBy.id, {
          name: item.createdBy.name,
          items: [item],
          latest: item.createdAt,
        });
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1].latest.localeCompare(a[1].latest));
  }, [list]);

  const myTagIds = new Set(list.filter((x) => x.createdBy.id === meId).map((x) => x.tagId));
  const available = options.filter((o) => !myTagIds.has(o.id));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        {list.length > 0 && <span className="text-xs text-muted-foreground">{list.length} 条</span>}
      </div>

      {canTag && (
        <div className="mb-4 rounded-[10px] bg-muted p-3">
          {available.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {options.length === 0 ? "暂无可用标签，请联系管理员维护" : "你已打过全部标签"}
            </p>
          ) : (
            <>
              <div className="mb-2 flex max-h-36 flex-wrap gap-1.5 overflow-auto">
                {available.map((o) => {
                  const on = selected.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => toggle(o.id)}
                      className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                        on
                          ? "bg-primary text-white"
                          : "bg-card text-foreground ring-1 ring-border hover:ring-primary"
                      }`}
                    >
                      {o.name}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={addTags}
                disabled={selected.length === 0 || saving}
                className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40 hover:bg-primary/90"
              >
                {saving ? "添加中…" : selected.length > 0 ? `添加标签（${selected.length}）` : "添加标签"}
              </button>
            </>
          )}
        </div>
      )}

      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      {loading ? (
        <p className="text-xs text-muted-foreground">加载中…</p>
      ) : groups.length === 0 ? (
        <p className="text-xs text-muted-foreground">暂无标签</p>
      ) : (
        <ul className="space-y-3">
          {groups.map(([uid, g]) => (
            <li key={uid} className="text-sm">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-medium text-gray-900">{g.name}</span>
                <span className="text-xs text-muted-foreground">{relTime(g.latest)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map((item) => {
                  const canDel = isAdmin || item.createdBy.id === meId;
                  return (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-blue-700 ring-1 ring-blue-200"
                    >
                      {item.tag.name}
                      {canDel && (
                        <button
                          type="button"
                          title="删除"
                          onClick={() => remove(item.id)}
                          className="text-blue-400 hover:text-red-600"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
