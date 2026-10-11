import Link from "next/link";
import { PAGE_SIZE, type PageQuery } from "@/lib/pagination";

export default function Pagination({
  pathname,
  page,
  total,
  query,
}: {
  pathname: string;
  page: number;
  total: number;
  query: PageQuery;
}) {
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const hrefForPage = (targetPage: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (key === "page" || value === undefined) continue;
      if (Array.isArray(value)) value.forEach((item) => params.append(key, item));
      else params.set(key, value);
    }
    if (targetPage > 1) params.set("page", String(targetPage));
    const suffix = params.toString();
    return suffix ? `${pathname}?${suffix}` : pathname;
  };

  return (
    <nav aria-label="分页" className="mt-4 flex items-center justify-between text-sm text-gray-600">
      <span>共 {total.toLocaleString()} 条，第 {currentPage} / {pageCount} 页</span>
      <div className="flex gap-2">
        {currentPage > 1 ? (
          <Link href={hrefForPage(currentPage - 1)} className="rounded border px-3 py-1.5 hover:bg-gray-50">上一页</Link>
        ) : (
          <span className="rounded border px-3 py-1.5 text-gray-400">上一页</span>
        )}
        {currentPage < pageCount ? (
          <Link href={hrefForPage(currentPage + 1)} className="rounded border px-3 py-1.5 hover:bg-gray-50">下一页</Link>
        ) : (
          <span className="rounded border px-3 py-1.5 text-gray-400">下一页</span>
        )}
      </div>
    </nav>
  );
}
