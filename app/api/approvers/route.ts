import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

// 可选审批人列表（用于提报时多选）。
// ?roles=ADMIN 可限定角色，如合作需求只允许管理员审批。
export async function GET(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR", "OPERATOR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const rolesParam = new URL(req.url).searchParams.get("roles");
  const roles = rolesParam
    ? rolesParam.split(",").map((r) => r.trim().toUpperCase()).filter(Boolean)
    : ["PR_MANAGER", "ADMIN"];
  const users = await prisma.user.findMany({
    where: { role: { in: roles as never[] } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { role: "asc" },
  });
  return NextResponse.json(users);
}
