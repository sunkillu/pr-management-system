import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { nextPurchaseNumber } from "../lib/purchase-number";

test("purchase number allocation locks the UTC date and increments its sequence", async () => {
  const calls: string[] = [];
  const tx = {
    $executeRaw: async (query: TemplateStringsArray, ...values: unknown[]) => {
      calls.push(`${query.join("?")}:${values.join(",")}`);
      return 1;
    },
    $queryRaw: async (query: TemplateStringsArray, ...values: unknown[]) => {
      calls.push(`${query.join("?")}:${values.join(",")}`);
      return [{ sequence: 7 }];
    },
  } as unknown as Prisma.TransactionClient;

  assert.equal(await nextPurchaseNumber(tx, new Date("2026-10-14T23:59:59.000Z")), "CG-20261014-0007");
  assert.equal(calls.length, 2);
  assert.match(calls[0], /pg_advisory_xact_lock/);
  assert.match(calls[0], /purchase-request:20261014/);
  assert.match(calls[1], /FROM "PurchaseRequest"/);
  assert.match(calls[1], /CG-20261014-%/);
});

test("purchase number prefix rolls over at UTC midnight", async () => {
  const tx = {
    $executeRaw: async () => 1,
    $queryRaw: async () => [{ sequence: 1 }],
  } as unknown as Prisma.TransactionClient;

  assert.equal(await nextPurchaseNumber(tx, new Date("2026-10-14T23:59:59.999Z")), "CG-20261014-0001");
  assert.equal(await nextPurchaseNumber(tx, new Date("2026-10-15T00:00:00.000Z")), "CG-20261015-0001");
});
