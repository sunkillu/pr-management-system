import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { formatDateTime } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import PurchaseRequestForm from "@/components/PurchaseRequestForm";
import PurchaseRequestStatusBadge from "@/components/PurchaseRequestStatusBadge";
import { PageHeader } from "@/components/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PURCHASE_REQUEST_STATUS_LABELS,
  buildPurchaseRequestWhere,
  isPurchasePageRole,
  sumQuantities,
} from "@/lib/purchase-shared";

export default async function PurchaseRequestsPage() {
  const session = await getServerSession(authOptions);
  const me = session?.user as { id?: string; role?: string } | undefined;
  if (!me?.id || !isPurchasePageRole(me.role)) redirect("/");

  const requests = await prisma.purchaseRequest.findMany({
    where: buildPurchaseRequestWhere(me.role, me.id),
    include: {
      creator: { select: { id: true, name: true } },
      lines: { select: { id: true, quantity: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="采买请求"
        desc="运营提交多行采买需求，管理员逐条审批后分配到 PR 并批量生成合作工单。"
        action={<PurchaseRequestForm />}
      />
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>单号</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>提交人</TableHead>
              <TableHead>行数 / 总数量</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead>最近修改时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  <Link href={`/purchase-requests/${item.id}`} className="text-primary hover:underline">
                    {item.requestNo}
                  </Link>
                </TableCell>
                <TableCell>
                  <PurchaseRequestStatusBadge
                    status={item.status}
                    label={PURCHASE_REQUEST_STATUS_LABELS[item.status] ?? item.status}
                  />
                </TableCell>
                <TableCell>{item.creator.name}</TableCell>
                <TableCell>{item.lines.length} 行 / {sumQuantities(item.lines)}</TableCell>
                <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                <TableCell>{formatDateTime(item.updatedAt)}</TableCell>
              </TableRow>
            ))}
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  暂无采买请求
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
