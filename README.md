# PR媒体管理系统（电商公司）

电商公司公关 / 媒体管理系统的 v1 MVP：媒体资源库、内容审批、项目排期、打款审批（两阶段）、发票管理、效果报表、用户权限。

技术栈：Next.js 14（App Router）+ TypeScript + Tailwind CSS / Prisma + PostgreSQL /
NextAuth.js（邮箱 + 密码，bcrypt 加密，JWT 会话）/ Docker Compose 部署。

> ⚠️ **安全提示：首次登录后请立即修改默认账号密码！**
> 默认账号见下方「默认账号」一节，均为演示用途。

---

## 目录

- [功能模块](#功能模块)
- [角色与权限](#角色与权限)
- [打款两阶段审批流程](#打款两阶段审批流程)
- [发票管理说明](#发票管理说明)
- [阶段一：本地运行](#阶段一本地运行)（先在本机跑通 → 再在你自己电脑上跑）
- [阶段二：阿里云部署](#阶段二阿里云部署)（功能确认 OK 后再做）
- [默认账号](#默认账号)
- [常见问题](#常见问题)

---

## 功能模块

| 模块 | 路径 | 说明 |
|---|---|---|
| 首页仪表盘 | `/` | 核心数据卡片、待办审批队列、模块快捷入口 |
| 媒体资源库 | `/outlets` | 达人 / KOC / 媒体 / 机构 / MCN，支持按名称、类型、平台、状态搜索筛选 |
| 内容管理 | `/contents` | 种草文、新闻稿等；版本自动 +1；审批流：草稿 → 待审批 → 已通过 → 已发布（可驳回） |
| 项目排期 | `/campaigns` | 大促 / 新品项目，起止日期、负责人、关联内容多选、进度备注 |
| 打款审批 | `/payments` | 两阶段审批（见下），详情页含审批时间线与关联发票 |
| 发票管理 | `/invoices` | 发票上传（PDF/JPG/PNG ≤10MB）、关联打款单、财务核验 |
| 效果报表 | `/reports` | 按项目汇总曝光 / 阅读 / 点赞 / 评论 / 转化 / GMV / 已打款金额，支持 CSV 导出 |
| 用户管理 | `/users` | 仅管理员：新增 / 编辑 / 删除账号、分配角色 |

## 角色与权限

| 能力 | 管理员 ADMIN | 运营 OPERATOR | 财务 FINANCE | 只读 VIEWER | PR负责人 PR_MANAGER |
|---|---|---|---|---|---|
| 媒体 / 内容 / 项目 / 报表增删改 | ✅ | ✅ | ❌（只读+导出） | ❌（只读+导出） | ❌（只读） |
| 内容提交审批 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 内容审批通过 / 驳回 | ✅ | ❌ | ❌ | ❌ | ❌ |
| 提交打款申请 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 打款一审（业务审批） | ✅ | ❌ | ❌ | ❌ | ❌ |
| 打款二审（财务审批）/ 标记已打款 | ✅（兜底） | ❌ | ✅ | ❌ | ❌ |
| 发票上传 / 关联打款单 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 发票核验通过 / 标记异常 | ✅（兜底） | ❌ | ✅ | ❌ | ❌ |
| 达人登记提报 / 合作需求提交 | ✅ | ✅ | ❌ | ❌ | ✅ |
| 达人登记 / 合作需求审批（或签） | ✅ | ❌ | ❌ | ❌ | ✅（被选中时） |
| 化妆师库 / 合作记录 / 寄品管理 | ✅ | ✅ | ❌（只读） | ❌（只读） | ✅ |
| 打款凭证上传 | ✅ | ✅ | ✅ | ❌ | ❌ |
| 用户管理 | ✅ | ❌ | ❌ | ❌ | ❌ |

> 说明：财务角色对业务模块为只读；管理员拥有全部权限（含财务二审与打款标记，作为财务不在岗时的兜底）。
> PR负责人拥有合作板块的审批与管理权限；内容 / 打款审批权限保持原有四角色不变。

## 打款两阶段审批流程

```
运营提交
  → 待业务审批（PENDING_BIZ）
  → 管理员通过 → 待财务审批（PENDING_FIN） ─┐
  → 管理员驳回 → 已驳回（REJECTED，需理由）  │
                                             ├→ 财务通过 → 待打款（APPROVED）
  → 财务驳回 → 已驳回（REJECTED，需理由） ──┘       → 财务标记 → 已打款（PAID）
```

- 运营只能提交；驳回后申请人可修改并重新提交（回到待业务审批，重新走完整审批链，次数不限，历史可查）。
- 审批记录表记录每一阶段的审批人、动作（通过/驳回）、意见、时间。
- **发票为选填**：提交、两阶段审批、标记已打款都不需要发票，无发票不阻塞流程。

## 审批增强：二次确认 / 历史记录 / 作废 / 关联

- **二次确认**：所有审批操作（提交、重新提交、通过、驳回、标记已打款/已发布、作废）前端均有确认弹窗防误触；驳回、作废弹窗内必须填写理由。
- **操作历史**：所有单据状态变更写入 `ApprovalLog`（谁、什么时候、做了什么、变更前后状态、理由），详情页「操作历史」时间线倒序展示。
- **作废**：内容单、打款单可作废（状态 `VOIDED`）。
  - 提交人可作废自己处于待审批状态的单（内容：待审批；打款：待业务审批/待财务审批）；
  - 管理员可作废任何非终态单（内容已发布、打款单已打款不可作废）；
  - 作废需填理由并留痕；作废后单据不可再流转，只能查看。
- **重新提交**：被驳回的单，提交人修改后可重新提交（需二次确认+修改说明），回到待审批并重新走完整审批链；仅提交人本人或管理员可操作他人被驳回的单。
- **关联单据**：内容单 ↔ 打款单、打款单 ↔ 打款单可相互关联（`ApprovalLink`，无方向、自动去重），详情页「关联单据」可查看跳转、新增/解除关联，关联操作写入双方历史记录。

## 发票管理说明

- 发票字段：发票号码、开票方、金额、开票日期、类型（增值税专票 / 普票 / 电子发票 / 收据）、发票文件、关联打款单（选填）、备注。
- 状态流：待核验 → 已核验 / 异常（异常需备注原因）。
- 文件保存在 `public/uploads/invoices`，由 Next.js 静态 serving（访问路径 `/uploads/invoices/xxx`）。
- Docker 部署时通过 volume `./uploads:/app/public/uploads` 持久化。
- ⚠️ 生产环境建议迁移到阿里云 OSS：届时只需替换 `app/api/invoices/upload/route.ts`
  中的落盘逻辑为 OSS 上传，并把 `fileUrl` 存为 OSS 地址即可，数据库结构无需改动。

## 合作管理（达人库 / 化妆师库 / 合作记录 / 寄品 / 合作需求）

### 达人库（`/influencers`）
- 提报登记：运营 / 管理员 / PR负责人提报，**提交时多选审批人**（PR负责人或管理员）。
- 审批规则：**或签**——任一审批人通过即通过；驳回需填理由。
- 平台标签：小红书 / 抖音，可多选（`PLATFORM_TAG_OPTIONS` 可扩展）。
- 通过后才能用于合作记录与寄品关联；合作次数与累计费用由合作记录自动累计。
- 驳回后登记人可修改并重新提交（可沿用上次审批人），重新走审批。

### 化妆师库（`/makeup-artists`）
- 长期合作的化妆师必须入库，**长期合作=true 时入库日期必填**。
- 合作次数与累计费用由合作记录自动累计。

### 合作记录（`/cooperations`）
- 类型：达人挂车 / 达播 / 化妆师合作。保存后同事务自动：对应达人/化妆师合作次数 +1、累计费用 += 本次费用。
- 达人合作要求达人已通过审核。

### 寄品管理（`/samples`）
- 字段：关联达人（达人库）、产品名称、数量、快递单号、寄出日期、状态（已寄出/已签收/已归还/已核销）。

### 合作需求（`/coop-requests`）
- 提出合作需求：标题、需求类型、详细描述、附件上传（`public/uploads/attachments`）。
- 提交时多选审批人（PR负责人/管理员），提交后**飞书通知**审批人们；或签审批；驳回可重提。

### 打款凭证
- 打款单详情页「打款凭证」区：运营 / 管理员 / 财务可上传多附件（`public/uploads/vouchers`），所有登录用户可查看。

### 飞书通知与催办
- 触发点：有新待审批（达人登记 / 合作需求 / 打款申请）→ 通知审批人们；审批通过/驳回 → 通知提交人。
- 催办：达人登记 / 合作需求 / 打款单详情页「提醒审批人」按钮 → 飞书通知待审批人，不做频率限制。
- 所有通知（真实或 mock）写入 `NotificationLog`，详情页可查看通知记录。
- **Mock 策略**：未配置 `FEISHU_APP_ID` / `FEISHU_APP_SECRET` 时为 mock 模式，只写通知记录不真实发送；
  用户未绑定飞书 `user_id`（用户管理中填写）时同样记 mock。接口已留好（`lib/feishu-notify.ts`），填入凭证即可真实发送。
- `.env.example` 新增：`FEISHU_APP_ID`、`FEISHU_APP_SECRET`。

---

## 阶段一：本地运行

### 方式 A：在你自己的电脑上运行（macOS / Windows，新手向）

> 前置要求：Node.js 20（去 https://nodejs.org 下载 LTS 版本，一路下一步安装）、
> PostgreSQL 15（去 https://www.postgresql.org/download/ 下载安装，记住你设置的
> postgres 密码）、Git。

**第 1 步：下载代码**

```bash
git clone <仓库地址> pr-system
cd pr-system
```

**第 2 步：安装依赖**

```bash
npm install
```

> 如安装时卡在 Prisma 引擎下载（网络问题），见[常见问题](#常见问题)。

**第 3 步：创建数据库**

打开 PostgreSQL 自带的 pgAdmin（或命令行 `psql`），执行：

```sql
CREATE USER pruser WITH PASSWORD 'prpass123';
CREATE DATABASE prdb OWNER pruser;
```

**第 4 步：配置环境变量**

```bash
# macOS / Linux
cp .env.example .env
# Windows（PowerShell）
copy .env.example .env
```

用记事本打开 `.env`，确认这几项：

```
DATABASE_URL="postgresql://pruser:prpass123@localhost:5432/prdb?schema=public"
NEXTAUTH_SECRET="随便填一串长的随机字符"
NEXTAUTH_URL="http://localhost:3000"
```

> Windows 用户注意：如果你给 pruser 设置了别的密码，记得同步改 `DATABASE_URL`
> 里的密码。

**第 5 步：初始化数据库表 + 写入演示数据**

```bash
npx prisma migrate dev
npx prisma db seed
```

看到 `演示数据写入完成！` 即成功。

**第 6 步：启动**

```bash
npm run dev
```

浏览器打开 http://localhost:3000，用默认账号登录（见[默认账号](#默认账号)）。

**常用命令**

| 命令 | 作用 |
|---|---|
| `npm run dev` | 启动开发模式 |
| `npx prisma studio` | 打开数据库可视化管理界面 |
| `npx prisma migrate dev` | 修改 `schema.prisma` 后生成并应用迁移 |
| `npx prisma db seed` | 重新写入演示数据 |

### 方式 B：本仓库已在 Linux 服务器上验证通过的步骤（供参考）

```bash
sudo apt-get install -y postgresql
sudo -u postgres psql -c "CREATE USER pruser WITH PASSWORD 'prpass123';"
sudo -u postgres psql -c "CREATE DATABASE prdb OWNER pruser;"
cp .env.example .env   # 按需修改
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run dev
```

---

## 阶段二：阿里云部署（功能确认 OK 后再执行）

> 目标机器：阿里云轻量应用服务器（4 核 8G），系统建议 Ubuntu 22.04。

**第 1 步：安装 Docker**

```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker
```

**第 2 步：上传代码并配置**

把代码上传到服务器（`git clone` 或 scp），进入目录后：

```bash
cp .env.example .env
```

编辑 `.env`，**必须修改**的三项：

```
DB_PASSWORD="设置一个强密码"
NEXTAUTH_SECRET="用 openssl rand -base64 32 生成的随机字符串"
NEXTAUTH_URL="http://你的服务器公网IP:3000"   # 或你的域名
```

**第 3 步：构建并启动**

```bash
docker compose up -d --build
```

**第 4 步：初始化数据库（首次部署执行一次）**

```bash
docker compose exec app npx prisma migrate deploy
docker compose exec app npx prisma db seed   # 写入默认账号与演示数据；生产环境可跳过 seed
```

**第 5 步：验证**

浏览器打开 `http://服务器公网IP:3000`，用默认账号登录，**立即修改密码**。

**反向代理（可选）**：如需域名 + HTTPS，可在服务器上再装 Nginx 反代到
`127.0.0.1:3000`，并用 certbot 申请证书。内网使用则直接用 IP + 端口即可。

**备份建议**：定期备份 postgres 数据卷（`docker volume` 的 `pgdata`）和
`./uploads` 目录（发票文件）。

---

## 默认账号

| 邮箱 | 密码 | 角色 |
|---|---|---|
| admin@example.com | admin123 | 管理员 |
| operator@example.com | operator123 | 运营 |
| caiwu@example.com | caiwu123 | 财务 |
| viewer@example.com | viewer123 | 只读 |
| pr@example.com | pr123 | PR负责人 |

> ⚠️ **首次登录后请立即修改密码！** 目前修改密码请找管理员在「用户管理」中重置；
> 建议上线前为每位同事创建独立账号并删除/停用演示账号。

## 常见问题

**Q：`npm install` 卡在 Prisma 引擎下载失败（ECONNRESET）怎么办？**
A：这是 Prisma 从 `binaries.prisma.sh` 下载引擎二进制时的网络问题。可手动下载：
1. 确认版本与平台：`node -e "console.log(require('./node_modules/@prisma/engines-version/package.json').version)"`，
   平台一般为 `debian-openssl-3.0.x`（`node -e "console.log(require('@prisma/get-platform').getNodeAPIName('debian-openssl-3.0.x','fs'))"`）。
2. 从镜像站下载（注意跟随跳转 `-L`）：
   `https://registry.npmmirror.com/-/binary/prisma/all_commits/<commit-sha>/<平台>/libquery_engine.so.node.gz`
   和 `schema-engine.gz`（commit-sha 取版本号中 `-` 之后的部分）。
3. 解压后分别改名为 `libquery_engine-<平台>.so.node` 和 `schema-engine-<平台>`，
   放到 `node_modules/@prisma/engines/` 下（后者 `chmod +x`），再跑 `npx prisma generate`。

**Q：Windows 上 `prisma migrate dev` 报错？**
A：确认 PostgreSQL 服务已启动、`DATABASE_URL` 中的用户名密码正确、数据库 `prdb` 已创建。

**Q：发票文件上传后打不开？**
A：确认 `public/uploads/invoices` 目录存在且有写入权限；Docker 部署时确认
`./uploads` volume 已挂载。

**Q：如何给同事开账号？**
A：用管理员账号登录 → 用户管理 → 新增用户，设置邮箱、初始密码与角色。
