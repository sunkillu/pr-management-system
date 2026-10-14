import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { nextTicketNumber } from "../lib/ticket-number";

test("ticket number allocation locks the UTC date and increments its sequence", async () => {
  const calls: string[] = [];
  const tx = {
    $queryRaw: async (query: TemplateStringsArray, ...values: unknown[]) => {
      calls.push(`${query.join("?")}:${values.join(",")}`);
      return [];
    },
    cooperationTicket: {
      count: async (args: { where: { ticketNo: { startsWith: string } } }) => {
        assert.equal(args.where.ticketNo.startsWith, "20261014");
        return 8;
      },
    },
  } as unknown as Prisma.TransactionClient;

  assert.equal(await nextTicketNumber(tx, new Date("2026-10-14T23:59:59.000Z")), "202610140009");
  assert.equal(calls.length, 1);
  assert.match(calls[0], /pg_advisory_xact_lock/);
  assert.match(calls[0], /cooperation-ticket:20261014/);
});

test("ticket number prefix rolls over at UTC midnight", async () => {
  const tx = {
    $queryRaw: async () => [],
    cooperationTicket: { count: async () => 0 },
  } as unknown as Prisma.TransactionClient;

  assert.equal(await nextTicketNumber(tx, new Date("2026-10-14T23:59:59.999Z")), "202610140001");
  assert.equal(await nextTicketNumber(tx, new Date("2026-10-15T00:00:00.000Z")), "202610150001");
});
