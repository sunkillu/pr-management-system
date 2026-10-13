import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// 演示数据：账号与示例内容均为占位（岗位甲/乙/丙…），上线前替换为真实人员与数据
async function main() {
  console.log("开始写入演示数据…");

  // ---------- 用户（岗位占位） ----------
  const password = async (p: string) => bcrypt.hash(p, 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    // 演示账号：重跑 seed 时把密码恢复为文档中的初始密码，避免"密码不正确"还要手动重置
    update: { passwordHash: await password("admin123") },
    create: {
      email: "admin@example.com",
      name: "岗位甲（管理员）",
      passwordHash: await password("admin123"),
      role: "ADMIN",
    },
  });
  const prStaff = await prisma.user.upsert({
    where: { email: "prstaff@example.com" },
    update: { passwordHash: await password("pr123") },
    create: {
      email: "prstaff@example.com",
      name: "岗位乙（PR）",
      passwordHash: await password("pr123"),
      role: "PR",
    },
  });
  const operator = await prisma.user.upsert({
    where: { email: "operator@example.com" },
    update: { passwordHash: await password("operator123") },
    create: {
      email: "operator@example.com",
      name: "岗位丙（运营）",
      passwordHash: await password("operator123"),
      role: "OPERATOR",
    },
  });
  const finance = await prisma.user.upsert({
    where: { email: "caiwu@example.com" },
    update: { passwordHash: await password("caiwu123") },
    create: {
      email: "caiwu@example.com",
      name: "岗位丁（财务）",
      passwordHash: await password("caiwu123"),
      role: "FINANCE",
    },
  });
  await prisma.user.upsert({
    where: { email: "pr@example.com" },
    update: { passwordHash: await password("pr123") },
    create: {
      email: "pr@example.com",
      name: "岗位戊（PR负责人）",
      passwordHash: await password("pr123"),
      role: "PR_MANAGER",
    },
  });
  await prisma.user.upsert({
    where: { email: "viewer@example.com" },
    update: { passwordHash: await password("viewer123") },
    create: {
      email: "viewer@example.com",
      name: "岗位己（只读）",
      passwordHash: await password("viewer123"),
      role: "VIEWER",
    },
  });
  await prisma.user.upsert({
    where: { email: "warehouse@example.com" },
    update: { passwordHash: await password("warehouse123") },
    create: {
      email: "warehouse@example.com",
      name: "岗位庚（仓库）",
      passwordHash: await password("warehouse123"),
      role: "WAREHOUSE",
    },
  });
  console.log("用户 OK");

  // ---------- 媒体资源（占位） ----------
  const outletData = [
    { name: "达人甲", type: "KOL" as const, platform: "DOUYIN" as const, followers: 2580000, contactName: "联系人甲", contactInfo: "138-0000-0001", priceQuote: "15000", rating: 4.5, notes: "占位数据", status: "ACTIVE" as const },
    { name: "达人乙", type: "KOC" as const, platform: "XIAOHONGSHU" as const, followers: 320000, contactName: "联系人乙", contactInfo: "138-0000-0002", priceQuote: "3000", rating: 4.2, notes: "占位数据", status: "ACTIVE" as const },
    { name: "达人丙", type: "KOL" as const, platform: "BILIBILI" as const, followers: 1150000, contactName: "联系人丙", contactInfo: "138-0000-0003", priceQuote: "20000", rating: 4.7, notes: "占位数据", status: "ACTIVE" as const },
    { name: "达人丁", type: "KOL" as const, platform: "DOUYIN" as const, followers: 890000, contactName: "联系人丁", contactInfo: "138-0000-0004", priceQuote: "12000", rating: 4.0, notes: "占位数据", status: "ACTIVE" as const },
    { name: "媒体甲", type: "MEDIA" as const, platform: "WECHAT" as const, followers: 500000, contactName: "联系人戊", contactInfo: "138-0000-0005", priceQuote: "8000", rating: 4.3, notes: "占位数据", status: "ACTIVE" as const },
    { name: "媒体乙", type: "MEDIA" as const, platform: "WEIBO" as const, followers: 1200000, contactName: "联系人己", contactInfo: "138-0000-0006", priceQuote: "6000", rating: 4.1, notes: "", status: "ACTIVE" as const },
    { name: "机构甲", type: "MCN" as const, platform: "DOUYIN" as const, followers: 0, contactName: "联系人庚", contactInfo: "138-0000-0007", priceQuote: null, rating: 4.4, notes: "占位数据", status: "ACTIVE" as const },
    { name: "达人戊", type: "KOC" as const, platform: "XIAOHONGSHU" as const, followers: 45000, contactName: "联系人辛", contactInfo: "138-0000-0008", priceQuote: "800", rating: 3.8, notes: "占位数据", status: "INACTIVE" as const },
  ];
  const outlets: Record<string, { id: string }> = {};
  for (const o of outletData) {
    const created = await prisma.mediaOutlet.create({ data: o });
    outlets[created.name] = created;
  }
  console.log("媒体资源 OK");

  // ---------- 内容（占位） ----------
  const c1 = await prisma.content.create({
    data: { title: "示例种草文《占位标题1》", type: "CAO_TEXT", body: "占位正文", version: 3, status: "PUBLISHED", outletId: outlets["达人乙"].id },
  });
  const c2 = await prisma.content.create({
    data: { title: "示例新闻稿《占位标题2》", type: "PRESS", body: "占位正文", version: 2, status: "APPROVED", outletId: outlets["媒体甲"].id },
  });
  const c3 = await prisma.content.create({
    data: { title: "示例短视频脚本《占位标题3》", type: "VIDEO_SCRIPT", body: "占位正文", version: 1, status: "PENDING", outletId: outlets["达人甲"].id },
  });
  const c4 = await prisma.content.create({
    data: { title: "示例海报文案《占位标题4》", type: "POSTER", body: "占位正文", version: 1, status: "DRAFT" },
  });
  const c5 = await prisma.content.create({
    data: { title: "示例直播预告《占位标题5》", type: "CAO_TEXT", body: "占位正文", version: 2, status: "REJECTED", rejectReason: "占位驳回理由", outletId: outlets["达人丁"].id },
  });
  const c6 = await prisma.content.create({
    data: { title: "示例评测brief《占位标题6》", type: "VIDEO_SCRIPT", body: "占位正文", version: 1, status: "PUBLISHED", outletId: outlets["达人丙"].id },
  });
  // 审批记录
  await prisma.approvalRecord.createMany({
    data: [
      { stage: "CONTENT", action: "APPROVE", comment: "可以发布", approverId: admin.id, contentId: c1.id },
      { stage: "CONTENT", action: "APPROVE", comment: "无修改意见", approverId: admin.id, contentId: c2.id },
      { stage: "CONTENT", action: "REJECT", comment: "占位驳回理由", approverId: admin.id, contentId: c5.id },
      { stage: "CONTENT", action: "APPROVE", comment: "OK", approverId: admin.id, contentId: c6.id },
    ],
  });
  console.log("内容 OK");

  // ---------- 项目（占位） ----------
  const camp1 = await prisma.campaign.create({
    data: {
      name: "示例项目甲",
      description: "占位项目",
      startDate: new Date("2026-10-20"),
      endDate: new Date("2026-11-11"),
      status: "ONGOING",
      progressNotes: "占位进度",
      ownerId: prStaff.id,
      contents: { connect: [{ id: c1.id }, { id: c2.id }, { id: c3.id }] },
    },
  });
  const camp2 = await prisma.campaign.create({
    data: {
      name: "示例项目乙",
      description: "占位项目",
      startDate: new Date("2026-05-20"),
      endDate: new Date("2026-06-18"),
      status: "ENDED",
      progressNotes: "已结束",
      ownerId: prStaff.id,
      contents: { connect: [{ id: c4.id }, { id: c6.id }] },
    },
  });
  console.log("项目 OK");

  // ---------- 效果报表（占位） ----------
  await prisma.report.createMany({
    data: [
      { campaignId: camp1.id, contentId: c1.id, impressions: 1200000, reads: 380000, likes: 45000, comments: 8200, conversions: 12500, gmv: "3860000", recordDate: new Date("2026-11-12"), notes: "占位数据" },
      { campaignId: camp1.id, contentId: c2.id, impressions: 500000, reads: 120000, likes: 8000, comments: 1500, conversions: 3200, gmv: "960000", recordDate: new Date("2026-11-12") },
      { campaignId: camp2.id, contentId: c6.id, impressions: 800000, reads: 210000, likes: 30000, comments: 5200, conversions: 6800, gmv: "1750000", recordDate: new Date("2026-06-19"), notes: "占位数据" },
    ],
  });
  console.log("效果报表 OK");

  // ---------- 打款申请（占位，覆盖各状态） ----------
  const p1 = await prisma.paymentRequest.create({
    data: { title: "示例打款甲", amount: "15000", payeeName: "联系人甲", payeeAccount: "6222 **** **** 0001", reason: "占位事由", status: "PENDING_BIZ", outletId: outlets["达人甲"].id, campaignId: camp1.id, contentId: c3.id, requesterId: prStaff.id },
  });
  const p2 = await prisma.paymentRequest.create({
    data: { title: "示例打款乙", amount: "3000", payeeName: "联系人乙", payeeAccount: "支付宝 13800000002", reason: "占位事由", status: "PENDING_FIN", outletId: outlets["达人乙"].id, campaignId: camp1.id, requesterId: prStaff.id },
  });
  const p3 = await prisma.paymentRequest.create({
    data: { title: "示例打款丙", amount: "8000", payeeName: "媒体甲", payeeAccount: "对公 1100 **** 0005", reason: "占位事由", status: "PAID", outletId: outlets["媒体甲"].id, campaignId: camp1.id, contentId: c2.id, requesterId: prStaff.id },
  });
  const p4 = await prisma.paymentRequest.create({
    data: { title: "示例打款丁", amount: "20000", payeeName: "联系人丙", payeeAccount: "6222 **** **** 0003", reason: "占位事由", status: "REJECTED", rejectReason: "占位驳回理由", outletId: outlets["达人丙"].id, campaignId: camp2.id, requesterId: prStaff.id },
  });
  const p5 = await prisma.paymentRequest.create({
    data: { title: "示例打款戊", amount: "50000", payeeName: "机构甲", payeeAccount: "对公 2200 **** 0007", reason: "占位事由", status: "APPROVED", outletId: outlets["机构甲"].id, campaignId: camp1.id, requesterId: prStaff.id },
  });
  await prisma.approvalRecord.createMany({
    data: [
      { stage: "BIZ", action: "APPROVE", comment: "业务确认", approverId: admin.id, paymentRequestId: p2.id },
      { stage: "BIZ", action: "APPROVE", comment: "同意", approverId: admin.id, paymentRequestId: p3.id },
      { stage: "FIN", action: "APPROVE", comment: "财务已审", approverId: finance.id, paymentRequestId: p3.id },
      { stage: "BIZ", action: "REJECT", comment: "占位驳回理由", approverId: admin.id, paymentRequestId: p4.id },
      { stage: "BIZ", action: "APPROVE", comment: "同意", approverId: admin.id, paymentRequestId: p5.id },
      { stage: "FIN", action: "APPROVE", comment: "款项充足", approverId: finance.id, paymentRequestId: p5.id },
    ],
  });
  console.log("打款申请 OK");

  // ---------- 发票（占位） ----------
  await prisma.invoice.createMany({
    data: [
      { invoiceNo: "NO.20261108001", issuer: "占位开票方甲", amount: "8000", issueDate: new Date("2026-11-10"), type: "SPECIAL_VAT", status: "VERIFIED", note: "", paymentRequestId: p3.id, uploadedById: prStaff.id },
      { invoiceNo: "NO.20261108002", issuer: "占位开票方乙", amount: "50000", issueDate: new Date("2026-11-09"), type: "E_INVOICE", status: "PENDING", note: "", paymentRequestId: p5.id, uploadedById: prStaff.id },
      { invoiceNo: "NO.20261108003", issuer: "占位开票方丙", amount: "3000", issueDate: new Date("2026-11-08"), type: "NORMAL_VAT", status: "INVALID", note: "占位备注", paymentRequestId: p2.id, uploadedById: prStaff.id },
    ],
  });
  console.log("发票 OK");

  // 标签种类与示例标签（幂等）
  const materialCat = await prisma.tagCategory.upsert({
    where: { key: "MATERIAL" },
    update: { name: "素材标签" },
    create: { name: "素材标签", key: "MATERIAL", sort: 1 },
  });
  const influencerCat = await prisma.tagCategory.upsert({
    where: { key: "INFLUENCER" },
    update: { name: "达人标签" },
    create: { name: "达人标签", key: "INFLUENCER", sort: 2 },
  });
  const ticketCat = await prisma.tagCategory.upsert({
    where: { key: "TICKET" },
    update: { name: "工单标签" },
    create: { name: "工单标签", key: "TICKET", sort: 3 },
  });
  const materialTagNames = ["种草", "测评", "开箱", "好物推荐"];
  for (let i = 0; i < materialTagNames.length; i++) {
    const name = materialTagNames[i];
    await prisma.tag.upsert({
      where: { categoryId_name: { categoryId: materialCat.id, name } },
      update: {},
      create: { name, categoryId: materialCat.id, sort: i },
    });
  }
  const influencerTagNames = ["美妆垂类", "母婴", "高转化", "新锐"];
  for (let i = 0; i < influencerTagNames.length; i++) {
    const name = influencerTagNames[i];
    await prisma.tag.upsert({
      where: { categoryId_name: { categoryId: influencerCat.id, name } },
      update: {},
      create: { name, categoryId: influencerCat.id, sort: i },
    });
  }
  const ticketTagNames = ["重点合作", "大促", "新品", "常规"];
  for (let i = 0; i < ticketTagNames.length; i++) {
    const name = ticketTagNames[i];
    await prisma.tag.upsert({
      where: { categoryId_name: { categoryId: ticketCat.id, name } },
      update: {},
      create: { name, categoryId: ticketCat.id, sort: i },
    });
  }
  console.log("标签 OK");

  console.log("演示数据写入完成！");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
