"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type Tag = { id: string; name: string; sort: number };
type Category = { id: string; name: string; key: string; sort: number; tags: Tag[] };

export default function TagsClient({ initial }: { initial: Category[] }) {
  const router = useRouter();
  const [cats, setCats] = useState(initial);
  const [activeId, setActiveId] = useState(initial[0]?.id ?? "");
  const [newCatName, setNewCatName] = useState("");
  const [newCatKey, setNewCatKey] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");

  const active = cats.find((c) => c.id === activeId);

  async function call(url: string, method: string, body?: unknown) {
    setError("");
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "操作失败");
      return null;
    }
    return data;
  }

  async function addCategory() {
    const data = await call("/api/tags/categories", "POST", { name: newCatName, key: newCatKey });
    if (!data) return;
    setCats([...cats, { ...data, tags: [] }]);
    setActiveId(data.id);
    setNewCatName(""); setNewCatKey("");
    router.refresh();
  }

  async function renameCategory() {
    if (!active) return;
    const name = prompt("种类新名称", active.name);
    if (!name || name === active.name) return;
    const data = await call(`/api/tags/categories/${active.id}`, "PATCH", { name });
    if (!data) return;
    setCats(cats.map((c) => (c.id === active.id ? { ...c, name: data.name } : c)));
  }

  async function deleteCategory() {
    if (!active) return;
    if (!confirm(`删除种类「${active.name}」会同时删除其下 ${active.tags.length} 个标签，确定？`)) return;
    const data = await call(`/api/tags/categories/${active.id}`, "DELETE");
    if (!data) return;
    const rest = cats.filter((c) => c.id !== active.id);
    setCats(rest);
    setActiveId(rest[0]?.id ?? "");
    router.refresh();
  }

  async function addTag() {
    if (!active) return;
    const data = await call("/api/tags", "POST", { name: newTagName, categoryId: active.id });
    if (!data) return;
    setCats(cats.map((c) => (c.id === active.id ? { ...c, tags: [...c.tags, data] } : c)));
    setNewTagName("");
    router.refresh();
  }

  async function saveTagName(tag: Tag) {
    const data = await call(`/api/tags/${tag.id}`, "PATCH", { name: editName });
    if (!data) return;
    setCats(cats.map((c) =>
      c.id === activeId ? { ...c, tags: c.tags.map((t) => (t.id === tag.id ? data : t)) } : c
    ));
    setEditingTag(null);
    router.refresh();
  }

  async function deleteTag(tag: Tag) {
    if (!confirm(`删除标签「${tag.name}」？已打的历史标签不受影响。`)) return;
    const data = await call(`/api/tags/${tag.id}`, "DELETE");
    if (!data) return;
    setCats(cats.map((c) =>
      c.id === activeId ? { ...c, tags: c.tags.filter((t) => t.id !== tag.id) } : c
    ));
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
      {/* 种类列表 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">标签种类</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {cats.map((c) => (
            <Button
              key={c.id}
              variant={c.id === activeId ? "default" : "ghost"}
              onClick={() => setActiveId(c.id)}
              className="h-auto w-full flex-col items-start gap-0.5 px-3 py-2"
            >
              <span className="font-medium">{c.name}</span>
              <span className={`text-xs ${c.id === activeId ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {c.key} · {c.tags.length} 个标签
              </span>
            </Button>
          ))}
          <Separator className="my-3" />
          <div className="space-y-2">
            <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
              placeholder="种类名称，如：内容标签" />
            <Input value={newCatKey} onChange={(e) => setNewCatKey(e.target.value.toUpperCase())}
              placeholder="key，如：CONTENT（大写字母）" />
            <Button className="w-full" onClick={addCategory}>新增种类</Button>
          </div>
        </CardContent>
      </Card>

      {/* 标签管理 */}
      <Card className="lg:col-span-3">
        <CardContent className="pt-6">
          {!active ? (
            <p className="py-8 text-center text-sm text-muted-foreground">暂无标签种类，请先新增</p>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{active.name}（{active.key}）</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={renameCategory}>改名</Button>
                  <Button variant="destructive" size="sm" onClick={deleteCategory}>删除种类</Button>
                </div>
              </div>
              {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
              <div className="mb-4 flex gap-2">
                <Input value={newTagName} onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addTag(); }}
                  placeholder="新标签名，回车添加" />
                <Button onClick={addTag}>添加标签</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {active.tags.map((t) => (
                  <Badge key={t.id} variant="secondary" className="gap-1 px-3 py-1.5 text-sm font-normal">
                    {editingTag === t.id ? (
                      <>
                        <Input
                          className="h-6 w-24 px-1 py-0.5 text-sm"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveTagName(t); }}
                          autoFocus
                        />
                        <button className="text-primary" onClick={() => saveTagName(t)} title="保存">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button className="text-muted-foreground" onClick={() => setEditingTag(null)} title="取消">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        {t.name}
                        <button className="text-muted-foreground hover:text-primary"
                          onClick={() => { setEditingTag(t.id); setEditName(t.name); }} title="改名">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button className="text-muted-foreground hover:text-destructive"
                          onClick={() => deleteTag(t)} title="删除">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </Badge>
                ))}
                {active.tags.length === 0 && (
                  <p className="text-sm text-muted-foreground">暂无标签</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
