"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { platformTagLabels, influencerTypeLabels } from "@/lib/labels";

type Preview = {
  id: string;
  name: string;
  homepageId: string | null;
  influencerType: string | null;
  platforms: string[];
  status: string;
  tags: string[];
  coopCount: number;
  totalFee: string;
  attachments: { fileUrl: string; fileName: string }[];
};

/**
 * 达人悬浮预览：鼠标悬停在达人名字上弹出小卡片（平台/类型/标签/报价/合作次数），
 * 点击名字或卡片跳转到达人详情页。
 *
 * 用法：<InfluencerHoverCard id={influencerId} name={name} />
 */
export default function InfluencerHoverCard({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(true);
    if (!data && !loading) {
      setLoading(true);
      fetch(`/api/influencers/${id}/preview`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setData(d))
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    }
  };

  const hide = () => {
    timer.current = setTimeout(() => setOpen(false), 150);
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <span ref={wrapRef} className="relative inline-block" onMouseEnter={show} onMouseLeave={hide}>
      <Link href={`/influencers/${id}`} className="font-medium text-[#0071e3] hover:underline">
        {name}
      </Link>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-2xl bg-white p-4 shadow-[0_8px_40px_rgba(0,0,0,0.15)] ring-1 ring-black/5">
          {loading && <p className="text-xs text-gray-400">加载中…</p>}
          {!loading && !data && <p className="text-xs text-gray-400">无权查看或已删除</p>}
          {!loading && data && (
            <Link href={`/influencers/${id}`} className="block">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0071e3]/10 text-sm font-bold text-[#0071e3]">
                  {data.name.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-gray-900">{data.name}</div>
                  <div className="truncate text-xs text-gray-500">
                    {[data.influencerType ? influencerTypeLabels[data.influencerType] ?? data.influencerType : null,
                      ...(data.platforms || []).map((p) => platformTagLabels[p] ?? p)]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                </div>
              </div>
              {data.homepageId && (
                <div className="mt-2 truncate font-mono text-xs text-gray-500">ID: {data.homepageId}</div>
              )}
              {data.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {data.tags.slice(0, 5).map((t) => (
                    <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {data.attachments.length > 0 && (
                <div className="mt-2 flex gap-2 overflow-x-auto">
                  {data.attachments.map((attachment) => (
                    <img
                      key={attachment.fileUrl}
                      src={attachment.fileUrl}
                      alt={attachment.fileName}
                      title={attachment.fileName}
                      className="h-12 w-12 shrink-0 rounded border border-gray-200 object-cover"
                    />
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center gap-4 border-t border-[#e5e5e5] pt-2 text-xs text-gray-600">
                <span>合作 <b className="text-gray-900">{data.coopCount}</b> 次</span>
                <span>累计 <b className="text-gray-900">¥{data.totalFee}</b></span>
              </div>
              <div className="mt-1 text-right text-[11px] text-[#0071e3]">点击查看详情 →</div>
            </Link>
          )}
        </div>
      )}
    </span>
  );
}
