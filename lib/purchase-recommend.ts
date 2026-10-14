export type RecommendLine = { id: string; quantity: number; influencerId: string | null };
export type RecommendPr = { id: string; name: string };
export type PrHistory = Record<string, { prId: string; lastAt: Date }[]>;
export type Recommendation = {
  lineId: string;
  prId: string;
  reason: "HISTORY" | "BALANCED_RANDOM";
  lastCooperationAt: Date | null;
};

export function recommendAssignees(
  lines: RecommendLine[],
  prs: RecommendPr[],
  history: PrHistory,
  rng: () => number = Math.random,
): Recommendation[] {
  if (prs.length === 0) {
    throw new Error("没有可分配的 PR");
  }

  const prIds = new Set(prs.map((pr) => pr.id));
  const loadByPr = new Map(prs.map((pr) => [pr.id, 0]));
  const historyAssignments: Recommendation[] = [];
  const balancedPool: Array<RecommendLine & { index: number }> = [];

  lines.forEach((line, index) => {
    const matchedHistory = line.influencerId
      ? (history[line.influencerId] ?? []).filter((item) => prIds.has(item.prId))
      : [];
    if (matchedHistory.length > 0) {
      const best = [...matchedHistory].sort((a, b) => {
        const diff = b.lastAt.getTime() - a.lastAt.getTime();
        return diff !== 0 ? diff : a.prId.localeCompare(b.prId);
      })[0];
      historyAssignments.push({
        lineId: line.id,
        prId: best.prId,
        reason: "HISTORY",
        lastCooperationAt: best.lastAt,
      });
      loadByPr.set(best.prId, (loadByPr.get(best.prId) ?? 0) + line.quantity);
      return;
    }
    balancedPool.push({ ...line, index });
  });

  const balancedAssignments = [...balancedPool]
    .sort((a, b) => (b.quantity - a.quantity) || (a.index - b.index))
    .map<Recommendation>((line) => {
      const minLoad = Math.min(...prs.map((pr) => loadByPr.get(pr.id) ?? 0));
      const candidates = prs.filter((pr) => (loadByPr.get(pr.id) ?? 0) === minLoad);
      const pick = candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))];
      loadByPr.set(pick.id, (loadByPr.get(pick.id) ?? 0) + line.quantity);
      return {
        lineId: line.id,
        prId: pick.id,
        reason: "BALANCED_RANDOM",
        lastCooperationAt: null,
      };
    });

  const byLineId = new Map<string, Recommendation>();
  for (const item of [...historyAssignments, ...balancedAssignments]) {
    byLineId.set(item.lineId, item);
  }
  return lines.map((line) => {
    const recommendation = byLineId.get(line.id);
    if (!recommendation) {
      throw new Error(`缺少行 ${line.id} 的推荐结果`);
    }
    return recommendation;
  });
}
