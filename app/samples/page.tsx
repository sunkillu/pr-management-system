import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/ui";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { sampleStatusLabels, badgeClass } from "@/lib/labels";
import { logisticsStatusLabels, abnormalFlagLabels, logisticsBadgeClass, abnormalBadgeClass } from "@/lib/logistics";
import SampleForm from "@/components/SampleForm";
import SampleShipForm from "@/components/SampleShipForm";
import SampleActions from "@/components/SampleActions";
import AutoRefresh from "@/components/AutoRefresh";
import Pagination from "@/components/Pagination";
import { getPagination } from "@/lib/pagination";

const selectCls =
  "flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export default async function SamplesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; page?: string; brandId?: string };
}) {
  const session = await getServerSession(authOptions);
  const me = session?.user as unknown as { id: string; role: string };
  const role = me.role;
  const canWrite = ["ADMIN", "PR", "PR_MANAGER"].includes(role);
  const canDelete = ["ADMIN", "PR_MANAGER"].includes(role);
  // 仓库维护寄件信息；ADMIN / PR_MANAGER 兜底
  const canShip = ["ADMIN", "PR_MANAGER", "WAREHOUSE"].includes(role);

  const where: Prisma.SampleShipmentWhereInput = {
      ...(searchParams.q
        ? {
            OR: [
              { sampleNo: { contains: searchParams.q, mode: "insensitive" } },
              { productName: { contains: searchParams.q, mode: "insensitive" } },
              { trackingNo: { contains: searchParams.q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(searchParams.status ? { status: searchParams.status as never } : {}),
      ...(searchParams.brandId ? { brandId: searchParams.brandId } : {}),
  };
  const pagination = getPagination(searchParams.page);
  const [list, total, brands] = await Promise.all([
    prisma.sampleShipment.findMany({
      where,
      include: {
        influencer: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
    }),
    prisma.sampleShipment.count({ where }),
    prisma.brand.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const influencers = await prisma.influencer.findMany({
    where: { status: "APPROVED" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <AutoRefresh intervalMs={30000} />
      <PageHeader
        title="寄品管理"
        desc="寄件请求：PR提交 → 仓库接单备货 → 寄出 → 确认签收 → 核销"
        action={canWrite ? <SampleForm influencers={influencers} /> : undefined}
      />

      <form method="GET" className="mb-4 flex flex-wrap gap-2">
        <Input
          name="q"
          placeholder="按寄品单号/产品/快递单号搜索"
          defaultValue={searchParams.q ?? ""}
          className="w-56"
        />
        <select name="status" defaultValue={searchParams.status ?? ""} className={selectCls}>
          <option value="">全部状态</option>
          {Object.entries(sampleStatusLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select name="brandId" defaultValue={searchParams.brandId ?? ""} className={selectCls}>
          <option value="">全部品牌</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <Button type="submit">筛选</Button>
      </form>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>寄品单号</TableHead>
              <TableHead>产品名称</TableHead>
              <TableHead>达人</TableHead>
              <TableHead>收件人</TableHead>
              <TableHead>数量</TableHead>
              <TableHead>快递公司</TableHead>
              <TableHead>快递单号</TableHead>
              <TableHead>物流状态</TableHead>
              <TableHead>异常标记</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>记录人</TableHead>
              <TableHead>流转操作</TableHead>
              {(canWrite || canShip) && <TableHead>维护</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.sampleNo}</TableCell>
                <TableCell className="font-medium">{r.productName}</TableCell>
                <TableCell>{r.influencer?.name ?? "-"}</TableCell>
                <TableCell>{r.receiverName ?? "-"}</TableCell>
                <TableCell>{r.quantity}</TableCell>
                <TableCell>{r.courier ?? "-"}</TableCell>
                <TableCell>{r.trackingNo ?? "-"}</TableCell>
                <TableCell>
                  {r.logisticsStatus ? (
                    <Badge className={logisticsBadgeClass(r.logisticsStatus)}>
                      {logisticsStatusLabels[r.logisticsStatus] ?? r.logisticsStatus}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {r.abnormalFlag ? (
                    <Badge className={abnormalBadgeClass()}>
                      {abnormalFlagLabels[r.abnormalFlag] ?? r.abnormalFlag}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge className={badgeClass(r.status)}>
                    {sampleStatusLabels[r.status]}
                  </Badge>
                </TableCell>
                <TableCell>{r.createdBy?.name ?? "-"}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <SampleActions
                    sample={{ id: r.id, productName: r.productName, status: r.status, infoConfirmed: r.infoConfirmed, createdById: r.createdBy.id }}
                    role={role}
                    userId={me.id}
                  />
                </TableCell>
                {(canWrite || canShip) && (
                  <TableCell className="whitespace-nowrap">
                    <div className="flex flex-wrap gap-2">
                      {canWrite && (
                        <SampleForm
                          influencers={influencers}
                          editTarget={{
                            id: r.id,
                            influencerId: r.influencerId ?? "",
                            productName: r.productName,
                            quantity: r.quantity,
                            receiverName: r.receiverName ?? "",
                            receiverPhone: r.receiverPhone ?? "",
                            receiverAddress: r.receiverAddress ?? "",
                            courier: r.courier ?? "",
                            trackingNo: r.trackingNo ?? "",
                            shippedDate: r.shippedDate ? r.shippedDate.toISOString().slice(0, 10) : "",
                            shippedBy: r.shippedBy ?? "",
                            status: r.status,
                            brandId: r.brandId ?? "",
                          }}
                          canDelete={canDelete}
                        />
                      )}
                      {canShip && (
                        <SampleShipForm
                          sample={{
                            id: r.id,
                            courier: r.courier,
                            trackingNo: r.trackingNo,
                            shippedDate: r.shippedDate ? r.shippedDate.toISOString().slice(0, 10) : null,
                            shippedAt: r.shippedAt
                              ? new Date(r.shippedAt.getTime() - r.shippedAt.getTimezoneOffset() * 60000)
                                  .toISOString()
                                  .slice(0, 16)
                              : null,
                            logisticsStatus: r.logisticsStatus,
                            abnormalFlag: r.abnormalFlag,
                            shippedBy: r.shippedBy,
                            status: r.status,
                          }}
                        />
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {list.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={(canWrite || canShip) ? 13 : 12}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  暂无数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      <Pagination pathname="/samples" page={pagination.page} total={total} query={searchParams} />
    </div>
  );
}
