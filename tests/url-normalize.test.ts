import assert from "node:assert/strict";
import test from "node:test";
import { normalizeProfileUrl } from "../lib/url-normalize";

test("normalizeProfileUrl trims protocol, www, query, hash, and trailing slash", () => {
  assert.equal(
    normalizeProfileUrl(" https://www.Xiaohongshu.com/user/profile/123/?foo=1#section "),
    "xiaohongshu.com/user/profile/123",
  );
});

test("normalizeProfileUrl keeps path case while lowercasing hostname", () => {
  assert.equal(
    normalizeProfileUrl("http://Douyin.com/Creator/AbC///"),
    "douyin.com/Creator/AbC",
  );
});

test("normalizeProfileUrl returns empty string for blank input", () => {
  assert.equal(normalizeProfileUrl("   "), "");
});
