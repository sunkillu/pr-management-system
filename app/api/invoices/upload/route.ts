import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { requireRoles } from "@/lib/api-auth";

export const runtime = "nodejs";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

// 发票文件上传：运营 / 管理员。文件保存在 public/uploads/invoices，可被 Next.js 静态 serving。
export async function POST(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "OPERATOR"]);
  if (!auth.ok) return auth.res;

  const form = await req.formData();
  const file = form.get("file") as unknown as File | null;
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "请选择文件" }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json({ error: "仅支持 PDF / JPG / PNG 文件" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "文件不能超过 10MB" }, { status: 400 });
  }

  const safeBase =
    file.name
      .replace(/\.[^.]+$/, "") // 去掉原扩展名，避免 "xxx.pdf.pdf"
      .replace(/[^\w.\-\u4e00-\u9fff]/g, "_")
      .slice(-60) || "file";
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeBase}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "invoices");
  await mkdir(dir, { recursive: true });
  const bytes = await file.arrayBuffer();
  await writeFile(path.join(dir, filename), Buffer.from(bytes));

  return NextResponse.json({ fileUrl: `/uploads/invoices/${filename}`, fileName: file.name });
}
