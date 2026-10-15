import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { DocType, LogAction } from "@prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

type WriteLogBase = {
  docType: DocType;
  docId: string;
  action: LogAction;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
};

export type WriteLogInput = WriteLogBase &
  ({ actorId: string; actorLabel?: string | null } | { actorId?: null; actorLabel: string });

/**
 * 写审批操作日志。可传入事务 client，保证与状态变更同事务。
 */
export function writeLog(db: Db, input: WriteLogInput) {
  return db.approvalLog.create({
    data: {
      docType: input.docType,
      docId: input.docId,
      action: input.action,
      ...(input.actorId ? { actorId: input.actorId } : {}),
      actorLabel: input.actorLabel ?? null,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      note: input.note?.trim() || null,
    },
  });
}
