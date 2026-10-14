// 达人库数据权限：PR 只能看自己登记的；ADMIN / FINANCE / PR_MANAGER 可看全部
export function influencerOwnerFilter(role: string, userId: string): Record<string, unknown> {
  if (role === "PR") return { registeredById: userId };
  return {};
}

export function canViewInfluencer(role: string, userId: string, registeredById: string): boolean {
  return role !== "PR" || userId === registeredById;
}

export type InfluencerAttachment = {
  fileUrl: string;
  fileName: string;
};

type AttachmentResult =
  | { ok: true; attachments: InfluencerAttachment[] }
  | { ok: false; error: string };

export function parseInfluencerAttachments(value: unknown): AttachmentResult {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: "至少上传一张参考图或附件" };
  }
  if (value.length > 20) {
    return { ok: false, error: "附件最多 20 个" };
  }

  const attachments: InfluencerAttachment[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || !("fileUrl" in item) || !("fileName" in item)) {
      return { ok: false, error: "附件信息无效" };
    }
    const { fileUrl, fileName } = item;
    if (
      typeof fileUrl !== "string" ||
      !/^\/uploads\/attachments\/[^/]+$/.test(fileUrl) ||
      typeof fileName !== "string" ||
      !fileName.trim()
    ) {
      return { ok: false, error: "附件信息无效" };
    }
    if (!/\.(png|jpe?g|webp)$/i.test(fileUrl)) {
      return { ok: false, error: "参考附件仅支持 PNG、JPG 或 WEBP 图片" };
    }
    attachments.push({ fileUrl, fileName: fileName.trim() });
  }

  return { ok: true, attachments };
}
