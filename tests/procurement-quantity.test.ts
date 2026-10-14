import assert from "node:assert/strict";
import test from "node:test";
import { parsePositiveIntegerQuantity } from "../lib/procurement-quantity";

test("parses positive integer quantities", () => {
  assert.equal(parsePositiveIntegerQuantity("20"), 20);
  assert.equal(parsePositiveIntegerQuantity(" 20 "), 20);
  assert.equal(parsePositiveIntegerQuantity("0020"), 20);
});

test("rejects empty, non-integer, non-positive, and unsafe quantities", () => {
  for (const value of ["", "0", "-1", "1.5", "2e3", "abc", "9007199254740992"]) {
    assert.equal(parsePositiveIntegerQuantity(value), null, `expected ${value} to be rejected`);
  }
});
