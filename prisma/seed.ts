import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("开始写入演示数据…");

  // ---------- 用户 ----------
  const password = async (p: string) => bcrypt.hash(p, 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "管理员",
      passwordHash: await password("admin123"),
      role: "ADMIN",
    },
  });
  const operator = await prisma.user.upsert({
    where: { email: "operator@example.com" },
    update: {},
    create: {
      email: "operator@example.com",
      name: "王运营",
      passwordHash: await password("operator123"),
      role: "OPERATOR",
    },
  });
  const finance = await prisma.user.upsert({
    where: { email: "caiwu@example.com" },
    update: {},
    create: {
      email: "caiwu@example.com",
      name: "李财务",
      passwordHash: await password("caiwu123"),
      role: "FINANCE",
    },
  });
  await prisma.user.upsert({
    where: { email: "viewer@example.com" },
    update: {},
    create: {
      email: "viewer@example.com",
      name: "张只读",
      passwordHash: await password("viewer123"),
      role: "VIEWER",
    },
  });
  console.log("用户 OK");

  // ---------- 媒体资源 ----------
  const outletData = [
    { name: "美妆老王", type: "KOL" as const, platform: "DOUYIN" as const, followers: 2580000, contactName: "王芳", contactInfo: "138-0000-1234", priceQuote: "15000", rating: 4.5, notes: "美妆垂类，转化稳定", status: "ACTIVE" as const },
    { name: "种草少女小桃", type: "KOC" as const, platform: "XIAOHONGSHU" as const, followers: 320000, contactName: "桃子", contactInfo: "微信 xiaotao001", priceQuote: "3000", rating: 4.2, notes: "种草图文质量高", status: "ACTIVE" as const },
    { name: "数码评测阿K", type: "KOL" as const, platform: "BILIBILI" as const, followers: 1150000, contactName: "阿K", contactInfo: "B站私信 ak_lab", priceQuote: "20000", rating: 4.7, notes: "专业评测，长视频", status: "ACTIVE" as const },
    { name: "好物推荐官大刘", type: "KOL" as const, platform: "DOUYIN" as const, followers: 890000, contactName: "刘洋", contactInfo: "139-0000-5678", priceQuote: "12000", rating: 4.0, notes: "直播带货为主", status: "ACTIVE" as const },
    { name: "电商报", type: "MEDIA" as const, platform: "WECHAT" as const, followers: 500000, contactName: "张编辑", contactInfo: "zhang@dsb.example.com", priceQuote: "8000", rating: 4.3, notes: "行业媒体，发稿需提前3天", status: "ACTIVE" as const },
    { name: "新消费日报", type: "MEDIA" as const, platform: "WEIBO" as const, followers: 1200000, contactName: "李记者", contactInfo: "li@xxf.example.com", priceQuote: "6000", rating: 4.1, notes: "", status: "ACTIVE" as const },
    { name: "星耀MCN", type: "MCN" as const, platform: "DOUYIN" as const, followers: 0, contactName: "赵商务", contactInfo: "zhao@xingyao.example.com", priceQuote: null, rating: 4.4, notes: "批量达人合作", status: "ACTIVE" as const },
    { name: "尾部KOC矩阵", type: "KOC" as const, platform: "XIAOHONGSHU" as const, followers: 45000, contactName: "陈晨", contactInfo: "微信 chen001", priceQuote: "800", rating: 3.8, notes: "素人铺量", status: "INACTIVE" as const },
  ];
  const outlets: Record<string, { id: string }> = {};
  for (const o of outletData) {
    const created = await prisma.mediaOutlet.create({ data: o });
    outlets[created.name] = created;
  }
  console.log("媒体资源 OK");

  // ---------- 内容 ----------
  const c1 = await prisma.content.create({
    data: { title: "双11预热种草文《今年双11必囤的10件好物》", type: "CAO_TEXT", body: "正文示例：今年双11，这10件好物闭眼入……（此处为演示数据）", version: 3, status: "PUBLISHED", outletId: outlets["种草少女小桃"].id },
  });
  const c2 = await prisma.content.create({
    data: { title: "新品发布新闻稿《XX品牌发布春季新品系列》", type: "PRESS", body: "新闻稿示例：XX品牌今日发布春季新品系列……", version: 2, status: "APPROVED", outletId: outlets["电商报"].id },
  });
  const c3 = await prisma.content.create({
    data: { title: "短视频脚本《30秒讲清楚我们的爆款逻辑》", type: "VIDEO_SCRIPT", body: "脚本示例：0-5s 钩子，5-20s 卖点，20-30s 转化引导……", version: 1, status: "PENDING", outletId: outlets["美妆老王"].id },
  });
  const c4 = await prisma.content.create({
    data: { title: "618大促主视觉海报文案", type: "POSTER", body: "主标题：年中狂欢；副标题：全场5折起……", version: 1, status: "DRAFT" },
  });
  const c5 = await prisma.content.create({
    data: { title: "直播预告推文", type: "CAO_TEXT", body: "预告示例：今晚8点直播间见……", version: 2, status: "REJECTED", rejectReason: "利益点不突出，需重写开头", outletId: outlets["好物推荐官大刘"].id },
  });
  const c6 = await prisma.content.create({
    data: { title: "B站评测合作 brief", type: "VIDEO_SCRIPT", body: "brief 示例：产品卖点、口播要求、发布时间……", version: 1, status: "PUBLISHED", outletId: outlets["数码评测阿K"].id },
  });
  // 审批记录
  await prisma.approvalRecord.createMany({
    data: [
      { stage: "CONTENT", action: "APPROVE", comment: "可以发布", approverId: admin.id, contentId: c1.id },
      { stage: "CONTENT", action: "APPROVE", comment: "无修改意见", approverId: admin.id, contentId: c2.id },
      { stage: "CONTENT", action: "REJECT", comment: "利益点不突出，需重写开头", approverId: admin.id, contentId: c5.id },
      { stage: "CONTENT", action: "APPROVE", comment: "OK", approverId: admin.id, contentId: c6.id },
    ],
  });
  console.log("内容 OK");

  // ---------- 项目 ----------
  const camp1 = await prisma.campaign.create({
    data: {
      name: "双11大促",
      description: "全年最大促销节点传播",
      startDate: new Date("2026-10-20"),
      endDate: new Date("2026-11-11"),
      status: "ONGOING",
      progressNotes: "预热期内容已发布80%",
      ownerId: operator.id,
      contents: { connect: [{ id: c1.id }, { id: c2.id }, { id: c3.id }] },
    },
  });
  const camp2 = await prisma.campaign.create({
    data: {
      name: "618年中庆",
      description: "年中促销传播",
      startDate: new Date("2026-05-20"),
      endDate: new Date("2026-06-18"),
      status: "ENDED",
      progressNotes: "已复盘",
      ownerId: operator.id,
      contents: { connect: [{ id: c4.id }, { id: c6.id }] },
    },
  });
  await prisma.campaign.create({
    data: {
      name: "春季新品首发",
      description: "春季新品上市传播",
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-03-31"),
      status: "ENDED",
      progressNotes: "已结束",
      ownerId: operator.id,
    },
  });
  console.log("项目 OK");

  // ---------- 效果报表 ----------
  await prisma.report.createMany({
    data: [
      { campaignId: camp1.id, contentId: c1.id, impressions: 1200000, reads: 380000, likes: 45000, comments: 8200, conversions: 12500, gmv: "3860000", recordDate: new Date("2026-11-12"), notes: "双11预热期汇总" },
      { campaignId: camp1.id, contentId: c2.id, impressions: 500000, reads: 120000, likes: 8000, comments: 1500, conversions: 3200, gmv: "960000", recordDate: new Date("2026-11-12") },
      { campaignId: camp2.id, contentId: c6.id, impressions: 800000, reads: 210000, likes: 30000, comments: 5200, conversions: 6800, gmv: "1750000", recordDate: new Date("2026-06-19"), notes: "618复盘" },
    ],
  });
  console.log("效果报表 OK");

  // ---------- 打款申请（覆盖各状态） ----------
  const p1 = await prisma.paymentRequest.create({
    data: { title: "双11达人合作尾款-美妆老王", amount: "15000", payeeName: "王芳", payeeAccount: "6222 **** **** 1234", reason: "双11种草视频合作尾款", status: "PENDING_BIZ", outletId: outlets["美妆老王"].id, campaignId: camp1.id, contentId: c3.id, requesterId: operator.id },
  });
  const p2 = await prisma.paymentRequest.create({
    data: { title: "小红书KOC铺量费用-小桃", amount: "3000", payeeName: "桃子", payeeAccount: "支付宝 xiaotao001", reason: "10篇种草图文", status: "PENDING_FIN", outletId: outlets["种草少女小桃"].id, campaignId: camp1.id, requesterId: operator.id },
  });
  const p3 = await prisma.paymentRequest.create({
    data: { title: "电商报发稿费", amount: "8000", payeeName: "电商报", payeeAccount: "对公 1100 **** 8899", reason: "新品新闻稿发布", status: "PAID", outletId: outlets["电商报"].id, campaignId: camp1.id, contentId: c2.id, requesterId: operator.id },
  });
  const p4 = await prisma.paymentRequest.create({
    data: { title: "B站评测合作费-阿K", amount: "20000", payeeName: "阿K", payeeAccount: "6222 **** **** 5678", reason: "618评测视频", status: "REJECTED", rejectReason: "报价超出预算，需重新议价", outletId: outlets["数码评测阿K"].id, campaignId: camp2.id, requesterId: operator.id },
  });
  const p5 = await prisma.paymentRequest.create({
    data: { title: "星耀MCN批量合作预付款", amount: "50000", payeeName: "星耀MCN", payeeAccount: "对公 2200 **** 1122", reason: "双11达人矩阵预付款", status: "APPROVED", outletId: outlets["星耀MCN"].id, campaignId: camp1.id, requesterId: operator.id },
  });
  await prisma.approvalRecord.createMany({
    data: [
      { stage: "BIZ", action: "APPROVE", comment: "业务确认", approverId: admin.id, paymentRequestId: p2.id },
      { stage: "BIZ", action: "APPROVE", comment: "同意", approverId: admin.id, paymentRequestId: p3.id },
      { stage: "FIN", action: "APPROVE", comment: "财务已审", approverId: finance.id, paymentRequestId: p3.id },
      { stage: "BIZ", action: "REJECT", comment: "报价超出预算，需重新议价", approverId: admin.id, paymentRequestId: p4.id },
      { stage: "BIZ", action: "APPROVE", comment: "同意", approverId: admin.id, paymentRequestId: p5.id },
      { stage: "FIN", action: "APPROVE", comment: "款项充足", approverId: finance.id, paymentRequestId: p5.id },
    ],
  });
  console.log("打款申请 OK");

  // ---------- 发票（选填示例） ----------
  await prisma.invoice.createMany({
    data: [
      { invoiceNo: "NO.20261108001", issuer: "电商报社", amount: "8000", issueDate: new Date("2026-11-10"), type: "SPECIAL_VAT", status: "VERIFIED", note: "", paymentRequestId: p3.id, uploadedById: operator.id },
      { invoiceNo: "NO.20261108002", issuer: "星耀MCN", amount: "50000", issueDate: new Date("2026-11-09"), type: "E_INVOICE", status: "PENDING", note: "", paymentRequestId: p5.id, uploadedById: operator.id },
      { invoiceNo: "NO.20261108003", issuer: "小桃文化", amount: "3000", issueDate: new Date("2026-11-08"), type: "NORMAL_VAT", status: "INVALID", note: "发票号码与开票方不符，已退回重开", paymentRequestId: p2.id, uploadedById: operator.id },
    ],
  });
  console.log("发票 OK");

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
