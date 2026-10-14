import { NextRequest, NextResponse } from "next/server";
import { requireRoles } from "@/lib/api-auth";
import { getOccupancyStatus } from "@/lib/occupancy";

// GET /api/occupancy?influencerId=xxx — 查询达人资源占用状态（提报页/审核页警示用）
// 返回脱敏：报价仅 ADMIN/PR_MANAGER 可见，其余角色 quoteAmount 为 null
export async function GET(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR", "OPERATOR", "FINANCE", "VIEWER", "PR_MANAGER", "WAREHOUSE"]);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const influencerId = searchParams.get("influencerId");
  if (!influencerId) return NextResponse.json({ error: "缺少 influencerId" }, { status: 400 });

  const info = await getOccupancyStatus(influencerId);

  // 报价脱敏：仅 ADMIN / PR_MANAGER 可见
  const canSeeQuote = auth.role === "ADMIN" || auth.role === "PR_MANAGER";
  if (!canSeeQuote) {
    return NextResponse.json({ ...info, quoteAmount: null });
  }
  return NextResponse.json(info);
}
