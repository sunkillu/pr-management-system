import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 可选审批人列表：PR负责人 + 管理员（用于达人登记 / 合作需求提交时多选）
export async function GET() {
  const auth = await requireRoles(["ADMIN", "OPERATOR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const users = await prisma.user.findMany({
    where: { role: { in: ["PR_MANAGER", "ADMIN"] } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { role: "asc" },
  });
  return NextResponse.json(users);
}
