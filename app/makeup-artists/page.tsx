import { redirect } from "next/navigation";

// 化妆师库已并入 /partners（合作资源），保留参数兼容旧链接
export default function MakeupArtistsPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const sp = new URLSearchParams({ tab: "makeup" });
  for (const [k, v] of Object.entries(searchParams)) {
    if (v !== undefined) sp.set(k, v);
  }
  redirect(`/partners?${sp.toString()}`);
}
