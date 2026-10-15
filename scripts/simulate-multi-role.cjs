const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { email: { in: ["admin@example.com", "operator@example.com", "caiwu@example.com", "prstaff@example.com", "pr@example.com", "warehouse@example.com", "viewer@example.com"] } },
  });
  const byEmail = Object.fromEntries(users.map((u) => [u.email, u]));
  const admin = byEmail["admin@example.com"];
  const operator = byEmail["operator@example.com"];
  const finance = byEmail["caiwu@example.com"];
  const pr = byEmail["prstaff@example.com"];
  const manager = byEmail["pr@example.com"];
  const warehouse = byEmail["warehouse@example.com"];
  const viewer = byEmail["viewer@example.com"];
  if (![admin, operator, finance, pr, manager, warehouse, viewer].every(Boolean)) throw new Error("测试角色账号不完整");

  const brands = await prisma.brand.findMany({ where: { name: { in: ["BOM POP", "坚果力"] } } });
  const brandByName = Object.fromEntries(brands.map((b) => [b.name, b]));
  const influencers = await prisma.influencer.findMany({ where: { id: { in: ["demo_inf_bompop_01", "demo_inf_bompop_02", "demo_inf_jianguoli_01", "demo_inf_jianguoli_02"] } } });
  if (brands.length < 2 || influencers.length < 4) throw new Error("测试品牌或达人数据不完整");

  const tagRows = await prisma.tag.findMany({ where: { name: { in: ["可复用", "已审核", "高互动", "待跟进"] } } });
  const reusableTag = tagRows.find((t) => t.name === "可复用");
  const approvedTag = tagRows.find((t) => t.name === "已审核");

  const nodes = ["脚本设计", "执行", "内容发布", "数据回收"];
  const statusPlan = [
    ["DRAFT", 3], ["PENDING_APPROVAL", 4], ["APPROVED", 3], ["IN_PROGRESS", 4],
    ["AWAITING_DRAFT", 3], ["DRAFT_RETURNED", 2], ["PUBLISHED", 3], ["FOLLOW_UP", 1], ["SETTLED", 2],
  ];
  const statuses = statusPlan.flatMap(([status, count]) => Array.from({ length: count }, () => status));
  const today = new Date("2026-10-15T08:00:00.000Z");
  const created = [];

  const transitions = {
    DRAFT: [[null, "DRAFT", "CREATE", admin, "管理员创建测试工单"]],
    PENDING_APPROVAL: [[null, "DRAFT", "CREATE", operator, "运营提交草稿"], ["DRAFT", "PENDING_APPROVAL", "SUBMIT", operator, "运营提交审批"]],
    APPROVED: [[null, "DRAFT", "CREATE", operator, "运营创建"], ["DRAFT", "PENDING_APPROVAL", "SUBMIT", operator, "提交审批"], ["PENDING_APPROVAL", "APPROVED", "APPROVE", manager, "PR负责人审批通过"]],
    IN_PROGRESS: [[null, "DRAFT", "CREATE", operator, "运营创建"], ["DRAFT", "PENDING_APPROVAL", "SUBMIT", operator, "提交审批"], ["PENDING_APPROVAL", "APPROVED", "APPROVE", manager, "PR负责人审批通过"], ["APPROVED", "IN_PROGRESS", "EDIT", pr, "PR接单执行"]],
    AWAITING_DRAFT: [[null, "DRAFT", "CREATE", operator, "运营创建"], ["DRAFT", "PENDING_APPROVAL", "SUBMIT", operator, "提交审批"], ["PENDING_APPROVAL", "APPROVED", "APPROVE", manager, "PR负责人审批通过"], ["APPROVED", "IN_PROGRESS", "EDIT", pr, "PR开始执行"], ["IN_PROGRESS", "AWAITING_DRAFT", "EDIT", pr, "等待达人返稿"]],
    DRAFT_RETURNED: [[null, "DRAFT", "CREATE", operator, "运营创建"], ["DRAFT", "PENDING_APPROVAL", "SUBMIT", operator, "提交审批"], ["PENDING_APPROVAL", "APPROVED", "APPROVE", manager, "PR负责人审批通过"], ["APPROVED", "IN_PROGRESS", "EDIT", pr, "PR开始执行"], ["IN_PROGRESS", "AWAITING_DRAFT", "EDIT", pr, "等待达人返稿"], ["AWAITING_DRAFT", "DRAFT_RETURNED", "EDIT", pr, "达人已返稿"]],
    PUBLISHED: [[null, "DRAFT", "CREATE", operator, "运营创建"], ["DRAFT", "PENDING_APPROVAL", "SUBMIT", operator, "提交审批"], ["PENDING_APPROVAL", "APPROVED", "APPROVE", manager, "PR负责人审批通过"], ["APPROVED", "IN_PROGRESS", "EDIT", pr, "PR开始执行"], ["IN_PROGRESS", "AWAITING_DRAFT", "EDIT", pr, "等待返稿"], ["AWAITING_DRAFT", "DRAFT_RETURNED", "EDIT", pr, "返稿完成"], ["DRAFT_RETURNED", "PUBLISHED", "PUBLISH", pr, "PR填写发布链接"]],
    FOLLOW_UP: [[null, "DRAFT", "CREATE", operator, "运营创建"], ["DRAFT", "PENDING_APPROVAL", "SUBMIT", operator, "提交审批"], ["PENDING_APPROVAL", "APPROVED", "APPROVE", manager, "审批通过"], ["APPROVED", "IN_PROGRESS", "EDIT", pr, "开始执行"], ["IN_PROGRESS", "PUBLISHED", "PUBLISH", pr, "内容发布"], ["PUBLISHED", "FOLLOW_UP", "EDIT", finance, "进入发布后跟进"]],
    SETTLED: [[null, "DRAFT", "CREATE", operator, "运营创建"], ["DRAFT", "PENDING_APPROVAL", "SUBMIT", operator, "提交审批"], ["PENDING_APPROVAL", "APPROVED", "APPROVE", manager, "审批通过"], ["APPROVED", "IN_PROGRESS", "EDIT", pr, "开始执行"], ["IN_PROGRESS", "PUBLISHED", "PUBLISH", pr, "内容发布"], ["PUBLISHED", "FOLLOW_UP", "EDIT", finance, "进入跟进"], ["FOLLOW_UP", "SETTLED", "APPROVE", finance, "完成跟进并结算"]],
  };

  for (let i = 0; i < statuses.length; i += 1) {
    const status = statuses[i];
    const brand = brands[i % brands.length];
    const influencer = influencers[i % influencers.length];
    const assignee = i % 3 === 0 ? manager : pr;
    const ticketNo = `SIM-20261015-${String(i + 1).padStart(3, "0")}`;
    const ticket = await prisma.cooperationTicket.create({
      data: {
        ticketNo,
        title: `多角色链路测试-${String(i + 1).padStart(2, "0")}（${status}）`,
        type: i % 4 === 0 ? "INFLUENCER_LIVE" : "INFLUENCER_POST",
        brandId: brand.id,
        ticketKind: "COOPERATION",
        budgetFee: 500 + i * 50,
        actualFee: status === "SETTLED" ? 500 + i * 50 : null,
        platform: i % 2 === 0 ? ["XIAOHONGSHU"] : ["DOUYIN"],
        homepageLinks: influencer.xhsUrl || influencer.douyinUrl ? { XIAOHONGSHU: influencer.xhsUrl, DOUYIN: influencer.douyinUrl } : undefined,
        style: [brand.name === "BOM POP" ? "BOM POP Air Black" : "坚果力自然棕补充款"],
        contentDirection: "测试图文/短视频合作链路",
        coopCategory: [i % 3 === 0 ? "图文种草" : "短视频"],
        estimatedSchedule: "2026-10-20~2026-10-31",
        confirmedDate: status !== "DRAFT" && status !== "PENDING_APPROVAL" ? new Date("2026-10-24T00:00:00.000Z") : null,
        estimatedPublishMonth: "2026-10",
        quoteAmount: 500 + i * 50,
        publishDate: ["PUBLISHED", "FOLLOW_UP", "SETTLED"].includes(status) ? new Date("2026-10-12T00:00:00.000Z") : null,
        publishLink: ["PUBLISHED", "FOLLOW_UP", "SETTLED"].includes(status) ? `https://example.com/sim/${i + 1}` : null,
        followUpDueDate: ["PUBLISHED", "FOLLOW_UP", "SETTLED"].includes(status) ? new Date("2026-10-27T00:00:00.000Z") : null,
        status,
        influencerId: influencer.id,
        assigneeId: status === "DRAFT" ? null : assignee.id,
        acceptedAt: status === "DRAFT" ? null : today,
        creatorId: i % 2 === 0 ? operator.id : admin.id,
        note: `测试角色：运营、PR负责人、PR、财务、仓库；当前节点：${status}`,
      },
    });
    created.push(ticket);

    for (const [fromStatus, toStatus, action, actor, note] of transitions[status]) {
      await prisma.approvalLog.create({ data: { docType: "TICKET", docId: ticket.id, action, fromStatus, toStatus, note, actorId: actor.id } });
    }
    if (["PENDING_APPROVAL", "APPROVED", "IN_PROGRESS", "AWAITING_DRAFT", "DRAFT_RETURNED", "PUBLISHED", "FOLLOW_UP", "SETTLED"].includes(status)) {
      await prisma.requestApprover.create({ data: { requestType: "TICKET", requestId: ticket.id, approverId: manager.id, status: status === "PENDING_APPROVAL" ? "PENDING" : "APPROVED", decidedAt: status === "PENDING_APPROVAL" ? null : today, comment: status === "PENDING_APPROVAL" ? "等待 PR负责人审批" : "测试审批通过" } });
    }
    if (status !== "DRAFT") {
      await prisma.ticketAssigneeLog.create({ data: { ticketId: ticket.id, toUserId: assignee.id, changedById: manager.id, action: "ASSIGN", reason: "多角色链路测试分配" } });
    }
    for (let n = 0; n < nodes.length; n += 1) {
      const completed = ["PUBLISHED", "FOLLOW_UP", "SETTLED"].includes(status) || (status === "DRAFT_RETURNED" && n < 3) || (status === "AWAITING_DRAFT" && n < 2) || (status === "IN_PROGRESS" && n === 0);
      await prisma.ticketNode.create({ data: { ticketId: ticket.id, name: nodes[n], sort: n, expectedAt: new Date(`2026-10-${String(18 + n).padStart(2, "0")}T00:00:00.000Z`), completedAt: completed ? today : null, completedById: completed ? (n === 3 ? warehouse.id : pr.id) : null } });
    }
    if (["AWAITING_DRAFT", "DRAFT_RETURNED", "PUBLISHED", "FOLLOW_UP", "SETTLED"].includes(status)) {
      await prisma.scheduleChangeLog.create({ data: { ticketId: ticket.id, oldDate: null, newDate: new Date("2026-10-24T00:00:00.000Z"), changedById: pr.id, reason: "测试填写确认档期" } });
      await prisma.materialRecord.create({ data: { ticketId: ticket.id, brandId: brand.id, type: "NOTE_LINK", url: `https://example.com/material/sim-${i + 1}`, note: "测试回收素材", uploadedById: pr.id, tagIds: [reusableTag?.id, approvedTag?.id].filter(Boolean), influencerName: influencer.name, style: [brand.name === "BOM POP" ? "BOM POP Air Black" : "坚果力自然棕补充款"], platform: i % 2 === 0 ? ["XIAOHONGSHU"] : ["DOUYIN"], isPublished: ["PUBLISHED", "FOLLOW_UP", "SETTLED"].includes(status), publishDate: ["PUBLISHED", "FOLLOW_UP", "SETTLED"].includes(status) ? new Date("2026-10-12T00:00:00.000Z") : null } });
    }
    if (["PUBLISHED", "FOLLOW_UP", "SETTLED"].includes(status)) {
      const count = status === "SETTLED" ? 3 : status === "FOLLOW_UP" ? 2 : 1;
      for (let f = 1; f <= count; f += 1) await prisma.followUpRecord.create({ data: { ticketId: ticket.id, followNo: f, noteUrl: `https://example.com/followup/sim-${i + 1}-${f}`, views: 1000 * f, likes: 80 * f, comments: 10 * f, note: `第${f}次跟进测试记录`, createdById: f === 1 ? pr.id : finance.id } });
    }
    if (["IN_PROGRESS", "AWAITING_DRAFT", "DRAFT_RETURNED", "PUBLISHED", "FOLLOW_UP", "SETTLED"].includes(status)) {
      await prisma.ticketSubtask.create({ data: { ticketId: ticket.id, title: "核对达人交付物", status: status === "SETTLED" ? "DONE" : "DOING", assigneeId: pr.id, dueDate: new Date("2026-10-25T00:00:00.000Z"), sortOrder: 0 } });
      await prisma.ticketSubtask.create({ data: { ticketId: ticket.id, title: "同步数据回收", status: ["PUBLISHED", "FOLLOW_UP", "SETTLED"].includes(status) ? "DONE" : "TODO", assigneeId: warehouse.id, dueDate: new Date("2026-10-30T00:00:00.000Z"), sortOrder: 1 } });
    }
  }

  const parent = await prisma.cooperationTicket.create({ data: { ticketNo: "SIM-20261015-P001", title: "采买父工单链路测试", type: "INFLUENCER_POST", ticketKind: "PROCUREMENT", procurementType: "WEEKLY_STYLE", brandId: brandByName["BOM POP"].id, budgetFee: 3000, platform: ["XIAOHONGSHU", "DOUYIN"], style: ["BOM POP Air Black", "BOM POP Crystal Brown"], coopCategory: ["短视频"], estimatedSchedule: "2026-10-20~2026-10-31", status: "PROCUREMENT_GENERATED", creatorId: operator.id, note: "采买父工单，子工单完成后关闭" } });
  await prisma.approvalLog.create({ data: { docType: "TICKET", docId: parent.id, action: "CREATE", toStatus: "PROCUREMENT_GENERATED", note: "运营创建采买父工单", actorId: operator.id } });
  for (let i = 0; i < 2; i += 1) {
    const childStatus = i === 0 ? "IN_PROGRESS" : "SETTLED";
    const child = await prisma.cooperationTicket.create({ data: { ticketNo: `SIM-20261015-P00${i + 2}`, title: `采买子工单链路测试-${i + 1}`, type: "INFLUENCER_POST", ticketKind: "COOPERATION", parentId: parent.id, subType: i === 0 ? "SAMPLE" : "DATA", brandId: brandByName["BOM POP"].id, budgetFee: 1500, actualFee: childStatus === "SETTLED" ? 1500 : null, platform: [i === 0 ? "XIAOHONGSHU" : "DOUYIN"], style: [i === 0 ? "BOM POP Air Black" : "BOM POP Crystal Brown"], coopCategory: ["短视频"], estimatedSchedule: "2026-10-20~2026-10-31", confirmedDate: new Date("2026-10-24T00:00:00.000Z"), status: childStatus, influencerId: influencers[i].id, assigneeId: pr.id, creatorId: operator.id, publishDate: childStatus === "SETTLED" ? new Date("2026-10-12T00:00:00.000Z") : null, publishLink: childStatus === "SETTLED" ? `https://example.com/child/${i + 1}` : null } });
    await prisma.approvalLog.create({ data: { docType: "TICKET", docId: child.id, action: "LINK", toStatus: childStatus, note: "从采买父工单生成子工单", actorId: operator.id } });
    await prisma.ticketAssigneeLog.create({ data: { ticketId: child.id, toUserId: pr.id, changedById: manager.id, action: "ASSIGN", reason: "PR负责人分配子工单" } });
    for (let n = 0; n < nodes.length; n += 1) await prisma.ticketNode.create({ data: { ticketId: child.id, name: nodes[n], sort: n, completedAt: childStatus === "SETTLED" || n === 0 ? today : null, completedById: childStatus === "SETTLED" || n === 0 ? pr.id : null } });
  }
  await prisma.approvalLog.create({ data: { docType: "TICKET", docId: parent.id, action: "EDIT", fromStatus: "PROCUREMENT_GENERATED", toStatus: "PROCUREMENT_GENERATED", note: "父工单保留子工单完成情况，等待全部子工单完成后关闭", actorId: manager.id } });

  console.log(JSON.stringify({ createdTickets: created.length + 3, regularTickets: created.length, procurementParent: parent.ticketNo, statuses: statusPlan }, null, 2));
}

main().catch((err) => { console.error(err); process.exitCode = 1; }).finally(() => prisma.$disconnect());
