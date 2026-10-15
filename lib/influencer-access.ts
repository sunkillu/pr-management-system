export type InfluencerAttachment = {
  fileUrl: string;
  fileName: string;
};

export function influencerOwnerFilter(
  role: string,
  userId: string,
): { registeredById?: string } {
  return role === "PR" ? { registeredById: userId } : {};
}

export function canViewInfluencer(
  role: string,
  userId: string,
  registeredById: string,
): boolean {
  return role !== "PR" || registeredById === userId;
}

export function parseInfluencerAttachments(
  value: unknown,
):
  | { ok: true; attachments: InfluencerAttachment[] }
  | { ok: false; error: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: "至少上传一张参考图或附件" };
  }
  if (value.length > 20) {
    return { ok: false, error: "附件不能超过 20 个" };
  }

  const attachments: InfluencerAttachment[] = [];
  for (const item of value) {
    if (
      !item ||
      typeof item !== "object" ||
      !("fileUrl" in item) ||
      !("fileName" in item) ||
      typeof item.fileUrl !== "string" ||
      typeof item.fileName !== "string" ||
      !item.fileName.trim() ||
      !/^\/uploads\/attachments\/[^/\\?#]+\.(?:jpe?g|png|webp|pdf)$/i.test(item.fileUrl)
    ) {
      return { ok: false, error: "附件信息无效，请重新上传" };
    }
    attachments.push({ fileUrl: item.fileUrl, fileName: item.fileName.trim() });
  }
  return { ok: true, attachments };
}
