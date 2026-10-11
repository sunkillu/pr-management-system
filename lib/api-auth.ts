import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";

export type RoleName = "ADMIN" | "OPERATOR" | "FINANCE" | "VIEWER" | "PR_MANAGER" | "PR" | "WAREHOUSE";

type OkResult = { ok: true; role: RoleName; userId: string; userName: string };
type ErrResult = { ok: false; res: NextResponse };

/**
 * API 路由鉴权守卫。
 * 用法：
 *   const auth = await requireRoles(["ADMIN", "PR"]);
 *   if (!auth.ok) return auth.res;
 */
export async function requireRoles(allowed: RoleName[]): Promise<OkResult | ErrResult> {
  const session = await getServerSession(authOptions);
  const u = session?.user as unknown as
    | { id: string; role: RoleName; name?: string }
    | undefined;
  if (!u?.id || !u?.role) {
    return { ok: false, res: NextResponse.json({ error: "未登录" }, { status: 401 }) };
  }
  if (!allowed.includes(u.role)) {
    return { ok: false, res: NextResponse.json({ error: "无权限" }, { status: 403 }) };
  }
  return { ok: true, role: u.role, userId: u.id, userName: u.name ?? "" };
}
