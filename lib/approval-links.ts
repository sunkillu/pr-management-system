import { prisma } from "./prisma";
import type { DocType } from "@prisma/client";

export type ResolvedLink = {
  id: string;
  otherType: DocType;
  otherId: string;
  otherTitle: string;
  otherStatus: string;
  createdByName: string;
  createdAt: Date;
};

/**
 * 关联无方向：创建时按 (type, id) 字典序 canonical 化，
 * 保证 A-B 与 B-A 为同一条记录，避免重复。
 */
export function canonicalLink(aType: DocType, aId: string, bType: DocType, bId: string) {
  const a = `${aType}:${aId}`;
  const b = `${bType}:${bId}`;
  if (a === b) throw new Error("不能关联自己");
  return a < b
    ? { fromType: aType, fromId: aId, toType: bType, toId: bId }
    : { fromType: bType, fromId: bId, toType: aType, toId: aId };
}

async function docTitle(type: DocType, id: string): Promise<{ title: string; status: string } | null> {
  if (type === "CONTENT") {
    const c = await prisma.content.findUnique({ where: { id }, select: { title: true, status: true } });
    return c ? { title: c.title, status: c.status } : null;
  }
  const p = await prisma.paymentRequest.findUnique({ where: { id }, select: { title: true, status: true } });
  return p ? { title: p.title, status: p.status } : null;
}

/** 取某单据的全部关联，并解析对端标题/状态 */
export async function getLinksWithCounterparts(
  docType: DocType,
  docId: string
): Promise<ResolvedLink[]> {
  const links = await prisma.approvalLink.findMany({
    where: {
      OR: [
        { fromType: docType, fromId: docId },
        { toType: docType, toId: docId },
      ],
    },
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const out: ResolvedLink[] = [];
  for (const l of links) {
    const isFrom = l.fromType === docType && l.fromId === docId;
    const otherType = isFrom ? l.toType : l.fromType;
    const otherId = isFrom ? l.toId : l.fromId;
    const doc = await docTitle(otherType, otherId);
    out.push({
      id: l.id,
      otherType,
      otherId,
      otherTitle: doc?.title ?? "（单据已删除）",
      otherStatus: doc?.status ?? "-",
      createdByName: l.createdBy.name,
      createdAt: l.createdAt,
    });
  }
  return out;
}
