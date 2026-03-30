import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Mobil profil - tek endpoint'te tum kullanici bilgileri
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, surname: true, email: true, role: true,
      _count: { select: { assignments: true, favorites: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Tercihler
  const preferences = await prisma.customerPreference.findUnique({
    where: { userId: session.user.id },
  });

  // Okunmamis bildirimler
  const lastView = await prisma.userLog.findFirst({
    where: { userId: session.user.id, action: "VIEW_LISTING" },
    orderBy: { createdAt: "desc" },
  });

  const unreadAssignments = await prisma.assignment.count({
    where: {
      userId: session.user.id,
      assignedAt: { gt: lastView?.createdAt || new Date(0) },
    },
  });

  const notifications = await prisma.userLog.count({
    where: { userId: session.user.id, action: "ADMIN_NOTIFICATION" },
  });

  return NextResponse.json({
    ...user,
    preferences,
    unreadAssignments,
    notifications,
  });
}
