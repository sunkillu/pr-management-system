import { redirect } from "next/navigation";

// 达人库已并入 /partners（合作资源），保留参数兼容旧链接与一键加入预填
export default function InfluencersPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const sp = new URLSearchParams({ tab: "influencer" });
  for (const [k, v] of Object.entries(searchParams)) {
    if (v !== undefined) sp.set(k, v);
  }
  redirect(`/partners?${sp.toString()}`);
}
