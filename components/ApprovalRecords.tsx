import { approverStatusLabels, formatDateTime } from "@/lib/labels";
import StatusBadge from "./StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ApproverRecord = {
  id: string;
  approver: { name: string };
  status: string;
  createdAt: string | Date;
  decidedAt: string | Date | null;
  comment: string | null;
};

// 正式审批记录：每位审批人的决定、决定时间、审批意见（或签多人各一条）
export default function ApprovalRecords({ records }: { records: ApproverRecord[] }) {
  const decided = records.filter((r) => r.decidedAt);
  if (records.length === 0) return null;
  return (
    <div className="mt-4">
      <h4 className="mb-2 text-sm font-semibold text-foreground">审批记录</h4>
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>审批人</TableHead>
              <TableHead>指派时间</TableHead>
              <TableHead>决定</TableHead>
              <TableHead>决定时间</TableHead>
              <TableHead>审批意见</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.approver.name}</TableCell>
                <TableCell>{formatDateTime(r.createdAt)}</TableCell>
                <TableCell>
                  <StatusBadge status={r.status} label={approverStatusLabels[r.status] ?? r.status} />
                </TableCell>
                <TableCell>
                  {r.decidedAt ? new Date(r.decidedAt).toLocaleString("zh-CN") : "-"}
                </TableCell>
                <TableCell>{r.comment || "-"}</TableCell>
              </TableRow>
            ))}
            {decided.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-4 text-center text-xs text-muted-foreground">
                  审批人尚未作出决定
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
