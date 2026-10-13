#!/usr/bin/env node
// v2 父子工单模型历史数据迁移脚本
// 约定：现有旧工单全部视为父工单（parentId = null, subType = null）。
// 本脚本只做"标记"：显式把旧工单的 parentId/subType 置为 null，不修改任何业务数据。
// 幂等：可重复运行，多次运行结果一致（已标记的工单会被跳过）。
//
// 运行：node scripts/migrate-to-parent-child.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.cooperationTicket.count();

  // 1. 标记：把所有"尚未标记"的旧工单显式置为父工单（parentId=null, subType=null）
  //    where 条件保证幂等——已标记的行不会被再次命中。
  const marked = await prisma.cooperationTicket.updateMany({
    where: { parentId: null, subType: null },
    data: { parentId: null, subType: null },
  });

  // 2. 统计：校验数据一致性（只读，不改数据）
  const parentCount = await prisma.cooperationTicket.count({ where: { parentId: null } });
  const childCount = await prisma.cooperationTicket.count({ where: { NOT: { parentId: null } } });
  const typedCount = await prisma.cooperationTicket.count({ where: { NOT: { subType: null } } });
  // 异常：有子类型却没有父工单（正常不应出现）
  const orphanTyped = await prisma.cooperationTicket.count({
    where: { parentId: null, NOT: { subType: null } },
  });

  console.log("=== v2 父子工单模型：历史数据标记完成 ===");
  console.log(`工单总数：${total}`);
  console.log(`本次标记为父工单：${marked.count}`);
  console.log(`父工单（parentId=null）：${parentCount}`);
  console.log(`子工单（parentId 非空）：${childCount}`);
  console.log(`带子类型（subType 非空）：${typedCount}`);
  if (orphanTyped > 0) {
    console.warn(`⚠ 异常：${orphanTyped} 条工单无父工单却带子类型，请人工核查`);
    process.exitCode = 1;
  } else {
    console.log("数据一致：无异常（可重复运行）");
  }
}

main()
  .catch((e) => {
    console.error("迁移失败：", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
