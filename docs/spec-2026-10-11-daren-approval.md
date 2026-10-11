# 需求规格：达人登记/达人库权限/工单流转变更（2026-10-11）

来源：zhang 主聊消息 2026-10-11 13:35（8 条新要求）
原文：「提报达人登记，pr需要提交附件（参考图），登记需要到pr负责人那边审批结束才能入库，pr进达人库不需要审核，给达人加标签，pr只能看到自己添加的达人但是所有pr库里面的达人管理员和财务以及pr负责人都可以看到，合作工单只有谁提交谁和链路关联的人可以推动状态，其他pr不能推状态，合作工单审批完成直接开始合作工单中款式可以多选且是必填合作类目多选必填」

## 当前实现状态（2026-10-11 复核）

- 达人已有 `attachments`、`tags` 字段。新建、编辑、重提均要求至少一个有效附件；达人列表、详情页和详情 API 限制 PR 仅查看本人登记的数据。
- 普通达人登记进入 `PENDING`，初始审批人只能是 PR负责人，管理员保留兜底审批；合作需求的一键加入路径直接以 `APPROVED` 建档，不创建待审批人记录。
- 业务页面（登录页、API、静态资源和上传文件除外）由 NextAuth middleware 统一要求登录。
- 工单的 `style`、`coopCategory` 已是 `String[]`；达人标签已有自定义输入和筛选。
- 工单审批与状态推进实现以当前 `app/api/tickets` 为准；本规格中原先关于手动开始、权限限制等基线记录不再视为当前状态。
- 下方 R1–R8 记录需求来源；实现进度以代码复核为准，需求未确认的标签/款式/类目选项仍需业务方提供。

## R1 达人登记：附件（参考图）必填

- `Influencer` 新增 `attachments Json?`（沿用 `[{fileUrl, fileName}]` 格式，`/api/uploads` 已支持图片）
- 表单加上传控件；提交校验至少 1 个附件 → `POST` 校验 `attachments.length > 0`
- 建议默认：**所有提交人都要**（含管理员/PR负责人），与参考 CooperationRequest.attachments 一致

## R2 达人登记审批：PR 负责人审批通过才能入库

- 审批人选择固定为 PR 负责人（多选、或签），不再能选管理员作为初始审批人
- 建议默认：**ADMIN 保留兜底审批权**（与工单审批规则一致），初始审批人只能选 PR 负责人

## R3 PR 直接加入达人库：免审

- 新增"直接加入达人库"入口（表单复用 InfluencerForm，增加 `direct=1` 模式）：`status=APPROVED`，不选审批人、不走 RequestApprover
- 一键加入达人库（AddToInfluencerButton 跳转的 partners 预填表单）走此免审路径
- 需确认：**直接加的权限范围**——建议 PR/管理员/PR负责人均可直加，PR 直加后只能看到自己的（见 R5）

## R4 达人标签

- `Influencer` 新增 `tags String[] @default([])`；前端加多选标签 + 列表筛选
- 需确认：**标签是预设选项还是自由填写**——建议预设选项（前端常量，如风格/领域类），zhang 给第一版清单

## R5 达人库数据权限

- `GET /api/influencers`：`role === "PR"` 时加 `registeredById = userId` 过滤
- ADMIN / PR_MANAGER / FINANCE 全量可见（zhang 原话）
- 需确认：**OPERATOR 和 VIEWER 看全量还是受限**——建议全量（只看不添）

## R6 工单状态推动权限：提交人 + 链路关联人

- 当前 `start`/`complete`：创建人或 ADMIN；其他 PR 其实也能点（requireRoles 宽松）
- 变更：所有状态推动动作（提交审核、审批、开始执行、标记完成、作废、重提）校验 `creatorId === userId` 或 `RequestApprover(TICKET)` 中有关联，或 ADMIN；**非关联 PR 一律 403**，前端按钮按权限隐藏
- 需确认：**FINANCE / PR_MANAGER 非链路人员能否代推**——建议只有 ADMIN 兜底

## R7 审批通过直接开始

- `approve` 通过时 `toStatus` 由 APPROVED 改为 **IN_PROGRESS**（砍掉中间态；`/api/tickets/[id]/start` 作废，前端去掉"开始执行"按钮）
- 需确认：**原"开始执行必填推进说明"如何处理**——建议：审批通过意见自动写入推进记录首条（`writeLog` ACTION=start note=审批意见），无需二次弹窗

## R8 款式/合作类目：多选必填

- `CooperationTicket.style` / `coopCategory` 由 `String?` 改为 `String[] @default([])`
- 迁移：`ALTER COLUMN … TYPE text[] USING CASE WHEN col IS NULL THEN '{}' ELSE ARRAY[col] END`
- 需确认：**选项清单**——zhang 给第一版款式/合作类目选项（前端常量）

## 仍待业务方确认

- 达人标签、工单款式和合作类目的首批选项清单；当前标签为自由填写，工单选项以现有 `lib/labels.ts` 为准。
- R5 中运营/只读角色的达人数据范围，以及 R6、R7 中工单状态推动权限和审批通过后的首条推进记录行为，应以实际产品决策为准。不要将本文件中“建议默认”当作已确认需求。
