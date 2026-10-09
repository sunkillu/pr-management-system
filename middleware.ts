import { withAuth } from "next-auth/middleware";

// 未登录用户跳转到 /login（而不是 next-auth 默认的 /api/auth/signin）。
// /api/* 接口在各自 handler 内做 requireRoles 鉴权（返回 JSON 401/403，而非跳转）。
export default withAuth({
  pages: { signIn: "/login" },
});
export const config = {
  matcher: [
    "/",
    "/outlets/:path*",
    "/contents/:path*",
    "/campaigns/:path*",
    "/payments/:path*",
    "/invoices/:path*",
    "/reports/:path*",
    "/users/:path*",
  ],
};
