import assert from "node:assert/strict";
import test from "node:test";
import {
  canViewInfluencer,
  influencerOwnerFilter,
  parseInfluencerAttachments,
} from "../lib/influencer-access";

test("PR visibility is limited to records registered by that user", () => {
  assert.deepEqual(influencerOwnerFilter("PR", "pr-1"), { registeredById: "pr-1" });
  assert.deepEqual(influencerOwnerFilter("ADMIN", "admin-1"), {});
  assert.equal(canViewInfluencer("PR", "pr-1", "pr-1"), true);
  assert.equal(canViewInfluencer("PR", "pr-1", "pr-2"), false);
  assert.equal(canViewInfluencer("FINANCE", "finance-1", "pr-2"), true);
});

test("influencer registration requires valid stored attachments", () => {
  assert.deepEqual(parseInfluencerAttachments([]), {
    ok: false,
    error: "至少上传一张参考图或附件",
  });
  assert.deepEqual(
    parseInfluencerAttachments([
      { fileUrl: "/uploads/attachments/ref-image.png", fileName: "  主页截图.png  " },
    ]),
    {
      ok: true,
      attachments: [
        { fileUrl: "/uploads/attachments/ref-image.png", fileName: "主页截图.png" },
      ],
    },
  );
  assert.equal(
    parseInfluencerAttachments([{ fileUrl: "https://example.com/image.png", fileName: "image.png" }]).ok,
    false,
  );
  assert.equal(
    parseInfluencerAttachments([
      { fileUrl: "/uploads/attachments/brief.docx", fileName: "brief.docx" },
    ]).ok,
    false,
  );
  assert.equal(
    parseInfluencerAttachments(
      Array.from({ length: 21 }, (_, i) => ({
        fileUrl: `/uploads/attachments/${i}.png`,
        fileName: `${i}.png`,
      })),
    ).ok,
    false,
  );
});
