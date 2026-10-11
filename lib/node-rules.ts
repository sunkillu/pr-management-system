// 进度节点类型判定（模糊匹配节点名，避免模板改名就崩）
// 模板：寄品 → 执行（拍摄/直播） → 内容发布 → 数据回收
export type NodeKind = "SHIP" | "EXEC" | "CONTENT" | "DATA" | "OTHER";

export function classifyNode(name: string): NodeKind {
  const n = name ?? "";
  if (n.includes("寄品")) return "SHIP";
  if (n.includes("数据回收")) return "DATA";
  if (n.includes("内容")) return "CONTENT";
  if (n.includes("执行")) return "EXEC";
  return "OTHER";
}

// 各类型节点的完成规则说明（前端展示用）
export const NODE_RULE_HINT: Record<NodeKind, string> = {
  SHIP: "待仓库发货自动完成",
  EXEC: "手动完成，需填写执行信息",
  CONTENT: "手动完成，需填写内容信息",
  DATA: "上传回收素材后可手动确认",
  OTHER: "",
};
