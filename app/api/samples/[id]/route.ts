import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/api-auth";

const WRITE = ["ADMIN", "OPERATOR", "PR_MANAGER"] as const;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles([...WRITE]);
  if (!auth.ok) return auth.res;
  const body = await req.json();
  const existing = await prisma.sampleShipment.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "寄品记录不存在" }, { status: 404 });
  const updated = await prisma.sampleShipment.update({
    where: { id: params.id },
    data: {
      influencerId: body.influencerId !== undefined ? body.influencerId || null : undefined,
      productName: body.productName?.trim() || undefined,
      quantity: body.quantity !== undefined ? Number(body.quantity) || 1 : undefined,
      trackingNo: body.trackingNo !== undefined ? body.trackingNo || null : undefined,
      shippedDate:
        body.shippedDate !== undefined
          ? body.shippedDate
            ? new Date(body.shippedDate)
            : null
          : undefined,
      status: body.status ?? undefined,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(["ADMIN", "PR_MANAGER"]);
  if (!auth.ok) return auth.res;
  const existing = await prisma.sampleShipment.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "寄品记录不存在" }, { status: 404 });
  await prisma.sampleShipment.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
