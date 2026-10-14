import assert from "node:assert/strict";
import test from "node:test";
import { recommendAssignees, type PrHistory, type RecommendLine, type RecommendPr } from "../lib/purchase-recommend";

const prs: RecommendPr[] = [
  { id: "pr-a", name: "PR A" },
  { id: "pr-b", name: "PR B" },
  { id: "pr-c", name: "PR C" },
];

test("recent cooperation history wins when available", () => {
  const lines: RecommendLine[] = [{ id: "line-1", quantity: 3, influencerId: "inf-1" }];
  const history: PrHistory = {
    "inf-1": [{ prId: "pr-b", lastAt: new Date("2026-10-01T00:00:00.000Z") }],
  };

  assert.deepEqual(recommendAssignees(lines, prs, history), [
    {
      lineId: "line-1",
      prId: "pr-b",
      reason: "HISTORY",
      lastCooperationAt: new Date("2026-10-01T00:00:00.000Z"),
    },
  ]);
});

test("when multiple historical PRs exist, the most recent one is chosen", () => {
  const lines: RecommendLine[] = [{ id: "line-1", quantity: 1, influencerId: "inf-1" }];
  const history: PrHistory = {
    "inf-1": [
      { prId: "pr-a", lastAt: new Date("2026-09-01T00:00:00.000Z") },
      { prId: "pr-c", lastAt: new Date("2026-10-09T00:00:00.000Z") },
      { prId: "pr-b", lastAt: new Date("2026-10-01T00:00:00.000Z") },
    ],
  };

  assert.equal(recommendAssignees(lines, prs, history)[0].prId, "pr-c");
});

test("lines without history fall back to balanced random selection", () => {
  const lines: RecommendLine[] = [
    { id: "line-1", quantity: 1, influencerId: null },
    { id: "line-2", quantity: 1, influencerId: null },
  ];
  const result = recommendAssignees(lines, prs.slice(0, 2), {}, () => 0.75);

  assert.deepEqual(result, [
    { lineId: "line-1", prId: "pr-b", reason: "BALANCED_RANDOM", lastCooperationAt: null },
    { lineId: "line-2", prId: "pr-a", reason: "BALANCED_RANDOM", lastCooperationAt: null },
  ]);
});

test("balanced random processes larger quantities first to keep loads even", () => {
  const lines: RecommendLine[] = [
    { id: "small", quantity: 1, influencerId: null },
    { id: "large", quantity: 10, influencerId: null },
    { id: "medium", quantity: 5, influencerId: null },
  ];
  const result = recommendAssignees(lines, prs.slice(0, 2), {}, () => 0);

  assert.deepEqual(result, [
    { lineId: "small", prId: "pr-b", reason: "BALANCED_RANDOM", lastCooperationAt: null },
    { lineId: "large", prId: "pr-a", reason: "BALANCED_RANDOM", lastCooperationAt: null },
    { lineId: "medium", prId: "pr-b", reason: "BALANCED_RANDOM", lastCooperationAt: null },
  ]);
});

test("history assignments contribute load before balanced random runs", () => {
  const lines: RecommendLine[] = [
    { id: "history", quantity: 9, influencerId: "inf-1" },
    { id: "balanced", quantity: 2, influencerId: null },
  ];
  const history: PrHistory = {
    "inf-1": [{ prId: "pr-a", lastAt: new Date("2026-10-08T00:00:00.000Z") }],
  };

  const result = recommendAssignees(lines, prs.slice(0, 2), history, () => 0);
  assert.equal(result[0].prId, "pr-a");
  assert.equal(result[1].prId, "pr-b");
});

test("injected rng makes balanced picks reproducible", () => {
  const lines: RecommendLine[] = [
    { id: "line-1", quantity: 2, influencerId: null },
    { id: "line-2", quantity: 2, influencerId: null },
    { id: "line-3", quantity: 2, influencerId: null },
  ];
  const picks = [0.9, 0.1, 0.9];
  let index = 0;
  const rng = () => picks[index++] ?? 0;

  const result = recommendAssignees(lines, prs.slice(0, 2), {}, rng);
  assert.deepEqual(result.map((item) => item.prId), ["pr-b", "pr-a", "pr-b"]);
});

test("empty PR list throws an explicit error", () => {
  assert.throws(
    () => recommendAssignees([{ id: "line-1", quantity: 1, influencerId: null }], [], {}),
    /没有可分配的 PR/,
  );
});
