import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLog } from "@/lib/log";
import { assignListingsSchema, validateBody } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  // Müşteri sadece kendi atamalarını görebilir
  const targetUserId =
    session.user.role === "ADMIN" && userId ? userId : session.user.id;

  if (session.user.role === "CUSTOMER" && userId && userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assignments = await prisma.assignment.findMany({
    where: { userId: targetUserId },
    include: {
      listing: {
        include: { city: true, category: true },
      },
      user: {
        select: { id: true, name: true, surname: true, email: true },
      },
    },
    orderBy: { assignedAt: "desc" },
  });

  return NextResponse.json(assignments);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const validation = validateBody(assignListingsSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { userId, listingIds } = validation.data;

  // Müşteri var mı kontrol
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 });
  }

  // Toplu atama - skipDuplicates ile tek seferde
  const result = await prisma.assignment.createMany({
    data: listingIds.map((listingId) => ({
      userId,
      listingId,
      assignedBy: session.user.id,
    })),
    skipDuplicates: true,
  });

  await createLog(
    session.user.id,
    "ASSIGN_LISTINGS",
    `${result.count} ilan ${user.name} ${user.surname} müşterisine atandı`
  );

  return NextResponse.json({
    assigned: result.count,
    total: listingIds.length,
  });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "ID gerekli" }, { status: 400 });

  try {
    const assignment = await prisma.assignment.delete({ where: { id } });
    await createLog(session.user.id, "REMOVE_ASSIGNMENT", `Atama kaldırıldı: ${id}`);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Atama bulunamadı" }, { status: 404 });
  }
}
