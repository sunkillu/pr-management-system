import { prisma } from "./prisma";
import type { NotifyKind, NotifyType } from "@prisma/client";

// 站内通知（用户要求：飞书推送暂不启用，通知只走网页内 toast + 铃铛）。
// notifyUser / notifyApprovers 只写 NotificationLog，不调飞书 API。
// 后续如需启用飞书推送，将 FEISHU_ENABLED 设为 true 并配置凭证即可，无需改调用方。

const APP_ID = process.env.FEISHU_APP_ID ?? "";
const APP_SECRET = process.env.FEISHU_APP_SECRET ?? "";
const mockMode = !APP_ID || !APP_SECRET;

/** 飞书真实推送总开关（用户明确暂不启用） */
const FEISHU_ENABLED = false;

let tenantToken: { token: string; expireAt: number } | null = null;

async function getTenantToken(): Promise<string> {
  if (tenantToken && Date.now() < tenantToken.expireAt) return tenantToken.token;
  const res = await fetch(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
    }
  );
  const data = await res.json();
  if (data.code !== 0) throw new Error(`飞书 tenant token 获取失败: ${data.msg}`);
  tenantToken = {
    token: data.tenant_access_token,
    expireAt: Date.now() + (data.expire - 60) * 1000,
  };
  return tenantToken.token;
}

async function sendFeishuText(feishuUserId: string, text: string): Promise<void> {
  const token = await getTenantToken();
  const res = await fetch(
    "https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=user_id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        receive_id: feishuUserId,
        msg_type: "text",
        content: JSON.stringify({ text }),
      }),
    }
  );
  const data = await res.json();
  if (data.code !== 0) throw new Error(`飞书消息发送失败: ${data.msg}`);
}

export type RelatedRef = { type: string; id: string; title?: string; kind?: NotifyKind };

/**
 * 通知单个用户。真实发送与 mock 都会写一条 NotificationLog。
 */
export async function notifyUser(
  userId: string,
  text: string,
  related?: RelatedRef
): Promise<NotifyType> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  let type: NotifyType = "MOCK";
  let note: string | null = null;

  if (!user) {
    note = "用户不存在，仅记录";
  } else if (!FEISHU_ENABLED) {
    note = "站内通知：飞书推送暂未启用，仅网页内展示";
  } else if (mockMode) {
    note = "mock 模式：未配置飞书应用凭证，未真实发送";
  } else if (!user.feishuUserId) {
    note = "用户未绑定飞书 user_id，未真实发送";
  } else {
    try {
      await sendFeishuText(user.feishuUserId, text);
      type = "FEISHU";
    } catch (e) {
      note = `真实发送失败，已降级记录：${e instanceof Error ? e.message : String(e)}`;
    }
  }

  await prisma.notificationLog.create({
    data: {
      type,
      kind: related?.kind ?? "SYSTEM",
      title: related?.title ?? null,
      receiverId: userId,
      content: text,
      relatedType: related?.type ?? null,
      relatedId: related?.id ?? null,
      note,
    },
  });
  return type;
}

/**
 * 批量通知审批人。
 */
export async function notifyApprovers(
  approverIds: string[],
  text: string,
  related?: RelatedRef
): Promise<void> {
  for (const id of approverIds) {
    await notifyUser(id, text, related);
  }
}

/** 是否处于飞书 mock 模式（供设置/调试页展示） */
export function isFeishuMockMode(): boolean {
  return mockMode;
}
