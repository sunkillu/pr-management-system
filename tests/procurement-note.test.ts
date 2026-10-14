import assert from "node:assert/strict";
import test from "node:test";
import { parseProcurementNote } from "../lib/procurement-note";

test("parses structured procurement details and preserves multiline remarks", () => {
  assert.deepEqual(
    parseProcurementNote(
      "【采买信息】\n需求理由：新品推广\n发布链接：\n1. https://example.com/a\n2. https://example.com/b\n备注：优先本周\n补充说明",
    ),
    {
      quantity: null,
      reason: "新品推广",
      publishLinks: ["https://example.com/a", "https://example.com/b"],
      note: "优先本周\n补充说明",
    },
  );
});

test("parses weekly-style quantities and handles missing notes", () => {
  assert.deepEqual(parseProcurementNote("【采买信息】\n采买数量：20"), {
    quantity: "20",
    reason: null,
    publishLinks: [],
    note: null,
  });
});
