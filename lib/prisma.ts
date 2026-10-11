import { PrismaClient } from "@prisma/client";

// 开发环境热重载时复用同一个 PrismaClient，避免连接数爆炸
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function withPoolDefaults(databaseUrl: string): string {
  const separator = databaseUrl.indexOf("?");
  const baseUrl = separator === -1 ? databaseUrl : databaseUrl.slice(0, separator);
  const params = new URLSearchParams(separator === -1 ? "" : databaseUrl.slice(separator + 1));
  if (!params.has("connection_limit")) params.set("connection_limit", "10");
  if (!params.has("pool_timeout")) params.set("pool_timeout", "10");
  return `${baseUrl}?${params.toString()}`;
}

const databaseUrl = process.env.DATABASE_URL;
const prismaOptions = databaseUrl
  ? { datasources: { db: { url: withPoolDefaults(databaseUrl) } } }
  : undefined;

export const prisma = globalForPrisma.prisma ?? new PrismaClient(prismaOptions);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
