import assert from "node:assert/strict";
import test from "node:test";
import { getPagination, PAGE_SIZE } from "../lib/pagination";

test("pagination defaults to the first fixed-size page", () => {
  assert.deepEqual(getPagination(), { page: 1, skip: 0, take: PAGE_SIZE });
});

test("pagination parses valid positive page numbers", () => {
  assert.deepEqual(getPagination("3"), { page: 3, skip: PAGE_SIZE * 2, take: PAGE_SIZE });
});

test("pagination rejects invalid and unsafe page values", () => {
  for (const value of ["0", "-3", "NaN", "1.5", "9007199254740992"]) {
    assert.deepEqual(getPagination(value), { page: 1, skip: 0, take: PAGE_SIZE });
  }
});

test("pagination bounds very large page values", () => {
  const result = getPagination("100001");
  assert.equal(result.page, 100_000);
  assert.equal(result.skip, PAGE_SIZE * 99_999);
});
