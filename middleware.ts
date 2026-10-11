import { withAuth } from "next-auth/middleware";

// 未登录用户跳转到 /login；API 在各自 handler 内返回 JSON 401/403。
export default withAuth({
  pages: { signIn: "/login" },
});
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|login|uploads).*)",
  ],
};
