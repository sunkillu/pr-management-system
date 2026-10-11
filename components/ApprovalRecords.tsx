import { approverStatusLabels, badgeClass } from "@/lib/labels";
import { tdCls, thCls } from "./ui";

export type ApproverRecord = {
  id: string;
  approver: { name: string };
  status: string;
  decidedAt: string | Date | null;
  comment: string | null;
};

// 正式审批记录：每位审批人的决定、决定时间、审批意见（或签多人各一条）
export default function ApprovalRecords({ records }: { records: ApproverRecord[] }) {
  const decided = records.filter((r) => r.decidedAt);
  if (records.length === 0) return null;
  return (
    <div className="mt-4">
      <h4 className="mb-2 text-sm font-semibold text-gray-800">审批记录</h4>
      <div className="overflow-x-auto rounded-2xl bg-white">
        <table className="w-full">
          <thead>
            <tr>
              <th className={thCls}>审批人</th>
              <th className={thCls}>决定</th>
              <th className={thCls}>决定时间</th>
              <th className={thCls}>审批意见</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className={tdCls + " font-medium"}>{r.approver.name}</td>
                <td className={tdCls}>
                  <span className={`rounded px-2 py-0.5 text-xs ${badgeClass(r.status)}`}>
                    {approverStatusLabels[r.status] ?? r.status}
                  </span>
                </td>
                <td className={tdCls}>
                  {r.decidedAt ? new Date(r.decidedAt).toLocaleString("zh-CN") : "-"}
                </td>
                <td className={tdCls}>{r.comment || "-"}</td>
              </tr>
            ))}
            {decided.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-xs text-gray-400">
                  审批人尚未作出决定
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
