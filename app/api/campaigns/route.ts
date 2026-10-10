import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

function parsePayload(body: Record<string, unknown>) {
  const contentIds = Array.isArray(body.contentIds) ? (body.contentIds as string[]) : [];
  return {
    name: String(body.name ?? "").trim(),
    description: (body.description as string) || null,
    startDate: body.startDate ? new Date(body.startDate as string) : null,
    endDate: body.endDate ? new Date(body.endDate as string) : null,
    status: (body.status as "PREPARING" | "ONGOING" | "ENDED") ?? "PREPARING",
    progressNotes: (body.progressNotes as string) || null,
    ownerId: (body.ownerId as string) || null,
    contentIds,
  };
}

// 新建：运营 / 管理员
export async function POST(req: NextRequest) {
  const auth = await requireRoles(["ADMIN", "PR"]);
  if (!auth.ok) return auth.res;
  const p = parsePayload(await req.json());
  if (!p.name) return NextResponse.json({ error: "项目名称不能为空" }, { status: 400 });
  const campaign = await prisma.campaign.create({
    data: {
      name: p.name,
      description: p.description,
      startDate: p.startDate,
      endDate: p.endDate,
      status: p.status,
      progressNotes: p.progressNotes,
      ownerId: p.ownerId,
      contents: { connect: p.contentIds.map((id) => ({ id })) },
    },
  });
  return NextResponse.json(campaign, { status: 201 });
}
