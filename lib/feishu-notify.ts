import { prisma } from "./prisma";
import type { NotifyType } from "@prisma/client";

// 飞书通知（stub 策略，参考 media-asset-console）：
// - 未配置 FEISHU_APP_ID / FEISHU_APP_SECRET → mock 模式，只写 NotificationLog，不真实发送
// - 已配置但用户未绑定 feishuUserId → mock 记录并注明原因
// - 已配置且已绑定 → 走飞书 open API 真实发送，失败则降级记 mock
// zhang 后面自己接真实凭证时，只需填环境变量，无需改代码。

const APP_ID = process.env.FEISHU_APP_ID ?? "";
const APP_SECRET = process.env.FEISHU_APP_SECRET ?? "";
const mockMode = !APP_ID || !APP_SECRET;

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

export type RelatedRef = { type: string; id: string; title?: string };

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
