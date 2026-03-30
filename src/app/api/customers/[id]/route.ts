import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customer = await prisma.user.findUnique({
    where: { id: params.id, role: "CUSTOMER" },
    select: {
      id: true,
      email: true,
      name: true,
      surname: true,
      isActive: true,
      createdAt: true,
      _count: { select: { assignments: true, favorites: true, logs: true } },
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Musteri bulunamadi" }, { status: 404 });
  }

  // Son aktiviteler
  const recentLogs = await prisma.userLog.findMany({
    where: { userId: params.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Atanmis ilanlar
  const assignments = await prisma.assignment.findMany({
    where: { userId: params.id },
    include: {
      listing: {
        select: { id: true, title: true, price: true, status: true, city: { select: { name: true } } },
      },
    },
    orderBy: { assignedAt: "desc" },
    take: 50,
  });

  // Favoriler
  const favorites = await prisma.favorite.findMany({
    where: { userId: params.id },
    include: {
      listing: {
        select: { id: true, title: true, price: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Tercihler
  const preferences = await prisma.customerPreference.findUnique({
    where: { userId: params.id },
  });

  return NextResponse.json({
    customer,
    recentLogs,
    assignments,
    favorites,
    preferences,
  });
}
