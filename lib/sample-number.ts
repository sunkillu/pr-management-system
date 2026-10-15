import type { Prisma } from "@prisma/client";

// 寄品单号：SP-YYYYMMDDHHmmSS-随机3位， practically unique，可在事务内调用
export async function nextSampleNumber(
  _tx: Prisma.TransactionClient
): Promise<string> {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = Math.floor(100 + Math.random() * 900);
  return `SP-${stamp}-${rand}`;
}
