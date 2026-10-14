import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { btnPrimary } from "@/components/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import StatusBadge from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import {
  influencerStatusLabels,
  influencerTypeLabels,
  INFLUENCER_TYPE_OPTIONS,
  platformTagLabels,
  PLATFORM_TAG_OPTIONS,

  formatFee,
} from "@/lib/labels";
import Link from "next/link";
import InfluencerForm from "@/components/InfluencerForm";
import InfluencerHoverCard from "@/components/InfluencerHoverCard";
import { influencerOwnerFilter } from "@/lib/influencer-access";
import Pagination from "@/components/Pagination";
import { getPagination } from "@/lib/pagination";
import RecordTimestamps from "@/components/RecordTimestamps";

export type InfluencerSearchParams = {
  q?: string;
  platform?: string;
  status?: string;
  type?: string;
  coop?: string;
  tag?: string | string[];
  brand?: string;
  page?: string;
  prefill?: string;
  ptype?: string;
  pplatforms?: string;
};

// 达人列表（查询+筛选+表格），用于 /partners 的"达人" tab
export default async function InfluencerList({
  searchParams,
}: {
  searchParams: InfluencerSearchParams;
}) {
  const session = await getServerSession(authOptions);
  const me = session?.user as unknown as { id: string; role: string };
  const role = me.role;
  const canWrite = ["ADMIN", "PR", "PR_MANAGER"].includes(role);

  const where: Record<string, unknown> = {};
  // 数据权限：PR 只能看自己登记的；ADMIN / FINANCE / PR_MANAGER 可看全部
  Object.assign(where, influencerOwnerFilter(role, me.id));
  if (searchParams.q) where.name = { contains: searchParams.q, mode: "insensitive" };
  if (searchParams.platform) where.platforms = { has: searchParams.platform };
  if (searchParams.status) where.status = searchParams.status;
  if (searchParams.type) where.influencerType = searchParams.type;
  if (searchParams.coop === "none") where.coopCount = 0;
  if (searchParams.coop === "active") where.coopCount = { gt: 0 };
  if (searchParams.brand) where.brands = { has: searchParams.brand };
  // 标签多选筛选：命中任一标签即可（旧 Influencer.tags 名称匹配 OR 带归属的 Tagging 匹配）
  const selectedTags = Array.isArray(searchParams.tag)
    ? searchParams.tag.filter(Boolean)
    : searchParams.tag
      ? [searchParams.tag]
      : [];
  if (selectedTags.length > 0) {
    const matched = await prisma.tag.findMany({
      where: { name: { in: selectedTags }, category: { key: "INFLUENCER" } },
      select: { id: true },
    });
    const tagOr: Record<string, unknown>[] = [{ tags: { hasSome: selectedTags } }];
    if (matched.length > 0) {
      const rows = await prisma.tagging.findMany({
        where: { entityType: "INFLUENCER", tagId: { in: matched.map((t) => t.id) } },
        select: { entityId: true },
      });
      const taggedEntityIds = Array.from(new Set(rows.map((r) => r.entityId)));
      if (taggedEntityIds.length > 0) tagOr.push({ id: { in: taggedEntityIds } });
    }
    // 与现有平铺条件（数据权限等）为 AND 关系；where 此前未设置过 AND
    where.AND = [{ OR: tagOr }];
  }

  const pagination = getPagination(searchParams.page);
  const [list, total, allTags, myTaggings, brands] = await Promise.all([
    prisma.influencer.findMany({
      where,
      include: {
        registeredBy: { select: { name: true } },
        cooperationRecords: { orderBy: { coopDate: "desc" }, take: 1, select: { fee: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.influencer.count({ where }),
    // 标签筛选：从管理的达人标签取（替代原来从库内动态生成）
    prisma.tag.findMany({
      where: { category: { key: "INFLUENCER" } },
      orderBy: [{ sort: "asc" }, { name: "asc" }],
    }),
    // 当前用户打过（带归属）的达人标签，用于下拉"我的优先"
    prisma.tagging.findMany({
      where: { createdById: me.id, entityType: "INFLUENCER" },
      select: { tag: { select: { id: true, name: true } } },
    }),
    prisma.brand.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  // 平均评价：按当前页批量查（分页下比 include 全量 reviews 更省）
  const ratings = list.length > 0
    ? await prisma.cooperationReview.groupBy({
        by: ["influencerId"],
        where: { influencerId: { in: list.map((i) => i.id) } },
        _avg: { rating: true },
      })
    : [];
  const ratingByInfluencer = new Map(ratings.map((r) => [r.influencerId, r._avg.rating]));
  // 筛选下拉：我的标签排前面（标"我的"），再排全部标签（去重）
  const myTagNames = Array.from(new Set(myTaggings.map((m) => m.tag.name))).sort((a, b) =>
    a.localeCompare(b, "zh-CN")
  );
  const myTagNameSet = new Set(myTagNames);
  const otherTagNames = allTags.map((t) => t.name).filter((n) => !myTagNameSet.has(n));

  // 从合作需求一键加入时的预填参数（ptype/pplatforms，与筛选参数区分）
  const prefill = searchParams.prefill === "1";
  const prefillType = searchParams.ptype ?? "";
  const prefillPlatforms = (searchParams.pplatforms ?? "").split(",").filter(Boolean);

  return (
    <div>
      {canWrite && (
        <div className="mb-4 flex justify-end">
          <InfluencerForm
            initial={{ influencerType: prefillType, platforms: prefillPlatforms }}
            autoOpen={prefill}
            influencerTags={allTags.map((t) => ({ id: t.id, name: t.name }))}
          />
        </div>
      )}

      <form method="GET" className="mb-4 flex flex-wrap gap-2">
        <input type="hidden" name="tab" value="influencer" />
        <input
          name="q"
          placeholder="按姓名搜索"
          defaultValue={searchParams.q ?? ""}
          className="rounded border border-input px-3 py-2 text-sm"
        />
        <select name="type" defaultValue={searchParams.type ?? ""} className="rounded border border-input px-3 py-2 text-sm">
          <option value="">全部类型</option>
          {INFLUENCER_TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select name="platform" defaultValue={searchParams.platform ?? ""} className="rounded border border-input px-3 py-2 text-sm">
          <option value="">全部平台</option>
          {PLATFORM_TAG_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
        <select name="brand" defaultValue={searchParams.brand ?? ""} className="rounded border border-input px-3 py-2 text-sm">
          <option value="">全部品牌</option>
          {brands.map((b) => (
            <option key={b.id} value={b.name}>{b.name}</option>
          ))}
        </select>
        <details className="relative">
          <summary className="cursor-pointer list-none rounded border border-input px-3 py-2 text-sm text-foreground [&::-webkit-details-marker]:hidden">
            {selectedTags.length > 0 ? `标签（${selectedTags.length}）` : "全部标签"}
          </summary>
          <div className="absolute z-10 mt-1 max-h-56 w-48 overflow-auto rounded-lg border border-border bg-card p-2 shadow-lg">
            {myTagNames.length === 0 && otherTagNames.length === 0 && (
              <p className="px-2 py-1 text-xs text-muted-foreground">暂无标签</p>
            )}
            {myTagNames.map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                <input
                  type="checkbox"
                  name="tag"
                  value={t}
                  defaultChecked={selectedTags.includes(t)}
                  className="h-4 w-4 accent-primary"
                />
                {t}
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-blue-600 ring-1 ring-blue-200">我的</span>
              </label>
            ))}
            {otherTagNames.map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                <input
                  type="checkbox"
                  name="tag"
                  value={t}
                  defaultChecked={selectedTags.includes(t)}
                  className="h-4 w-4 accent-primary"
                />
                {t}
              </label>
            ))}
          </div>
        </details>
        <select name="coop" defaultValue={searchParams.coop ?? ""} className="rounded border border-input px-3 py-2 text-sm">
          <option value="">全部合作状态</option>
          <option value="none">未合作</option>
          <option value="active">合作中</option>
        </select>
        <select name="status" defaultValue={searchParams.status ?? ""} className="rounded border border-input px-3 py-2 text-sm">
          <option value="">全部审核状态</option>
          {Object.entries(influencerStatusLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button className={btnPrimary}>筛选</button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead>
              <TableHead>达人类型</TableHead>
              <TableHead>平台</TableHead>
              <TableHead>标签</TableHead>
              <TableHead>合作状态</TableHead>
              <TableHead>合作次数</TableHead>
              <TableHead>最近合作金额</TableHead>
              <TableHead>累计费用</TableHead>
              <TableHead>平均评价</TableHead>
              <TableHead>审核状态</TableHead>
              <TableHead>登记人</TableHead>
              <TableHead>记录时间</TableHead>
              {canWrite && <TableHead>操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  <InfluencerHoverCard id={r.id} name={r.name} />
                </TableCell>
                <TableCell>{r.influencerType ? influencerTypeLabels[r.influencerType] ?? r.influencerType : "-"}</TableCell>
                <TableCell>
                  {r.platforms.length > 0
                    ? r.platforms.map((p) => platformTagLabels[p] ?? p).join("、")
                    : "-"}
                </TableCell>
                <TableCell>
                  {r.tags.length > 0 ? (
                    <span className="flex flex-wrap gap-1">
                      {r.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/10">
                          {t}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  {r.coopCount === 0 ? (
                    <StatusBadge status="TODO" label="未合作" />
                  ) : (
                    <StatusBadge status="IN_PROGRESS" label="合作中" />
                  )}
                </TableCell>
                <TableCell>{r.coopCount}</TableCell>
                <TableCell>
                  {r.cooperationRecords.length > 0 ? formatFee(r.cooperationRecords[0].fee) : "-"}
                </TableCell>
                <TableCell>{formatFee(r.totalFee)}</TableCell>
                <TableCell>
                  {ratingByInfluencer.get(r.id) != null ? (
                    <span className="text-yellow-600">
                      ★ {ratingByInfluencer.get(r.id)!.toFixed(1)}
                    </span>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.status} label={influencerStatusLabels[r.status]} />
                </TableCell>
                <TableCell>{r.registeredBy?.name ?? "-"}</TableCell>
                <TableCell><RecordTimestamps createdAt={r.createdAt} updatedAt={r.updatedAt} compact /></TableCell>
                {canWrite && (
                  <TableCell className="whitespace-nowrap">
                    {r.status === "APPROVED" ? (
                      <Link
                        href={`/tickets/new?influencerId=${r.id}`}
                        className="rounded-md border border-primary px-2.5 py-1 text-xs text-primary hover:bg-primary/10"
                      >
                        发起工单
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {list.length === 0 && (
              <TableRow><TableCell colSpan={canWrite ? 13 : 12} className="py-8 text-center text-sm text-muted-foreground">暂无数据</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination pathname="/partners" page={pagination.page} total={total} query={{ ...searchParams, tab: "influencer" }} />
    </div>
  );
}
