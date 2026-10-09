import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "OPERATOR" | "FINANCE" | "VIEWER" | "PR_MANAGER";
    } & DefaultSession["user"];
  }
  interface User {
    role: "ADMIN" | "OPERATOR" | "FINANCE" | "VIEWER" | "PR_MANAGER";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: "ADMIN" | "OPERATOR" | "FINANCE" | "VIEWER" | "PR_MANAGER";
  }
}
