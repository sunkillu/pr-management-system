import { PageHeader } from "@/components/ui";
import InfluencerList from "@/components/InfluencerList";
import MakeupArtistList from "@/components/MakeupArtistList";
import Link from "next/link";

const TABS = [
  { key: "influencer", label: "达人" },
  { key: "makeup", label: "化妆师" },
] as const;

// 合作资源：达人 / 化妆师两 tab 合一
export default function PartnersPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const tab = searchParams.tab === "makeup" ? "makeup" : "influencer";

  return (
    <div>
      <PageHeader
        title="合作资源"
        desc="达人、化妆师统一管理；合作次数与累计费用由合作记录自动累计"
      />

      <div className="mb-5 flex gap-1 border-b border-[#e5e5e5]">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/partners?tab=${t.key}`}
            className={`tab-link -mb-px px-4 py-2.5 text-sm font-medium ${
              tab === t.key
                ? "border-b-2 border-[#0071e3] text-[#0071e3]"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "influencer" && <InfluencerList searchParams={searchParams} />}
      {tab === "makeup" && <MakeupArtistList searchParams={searchParams} />}
    </div>
  );
}
