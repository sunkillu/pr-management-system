import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { requireRoles } from "@/lib/api-auth";

export const runtime = "nodejs";

const MAX_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "video/mp4": "mp4",
};

// 通用附件上传（合作需求等）：运营 / 管理员 / PR负责人
// 文件保存在 public/uploads/attachments，可被 Next.js 静态 serving。
export async function POST(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "OPERATOR", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;

  const form = await req.formData();
  const file = form.get("file") as unknown as File | null;
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "请选择文件" }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json({ error: "不支持的文件类型" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "文件不能超过 20MB" }, { status: 400 });
  }

  const safeBase =
    file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[^\w.\-\u4e00-\u9fff]/g, "_")
      .slice(-60) || "file";
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeBase}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "attachments");
  await mkdir(dir, { recursive: true });
  const bytes = await file.arrayBuffer();
  await writeFile(path.join(dir, filename), Buffer.from(bytes));

  return NextResponse.json({ fileUrl: `/uploads/attachments/${filename}`, fileName: file.name });
}
