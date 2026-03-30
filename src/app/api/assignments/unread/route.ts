import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Musterinin son goruntuleme tarihinden sonra atanmis ilan sayisi
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Son VIEW_LISTING logunu bul
  const lastView = await prisma.userLog.findFirst({
    where: { userId: session.user.id, action: "VIEW_LISTING" },
    orderBy: { createdAt: "desc" },
  });

  const since = lastView?.createdAt || new Date(0);

  const count = await prisma.assignment.count({
    where: {
      userId: session.user.id,
      assignedAt: { gt: since },
    },
  });

  return NextResponse.json({ unread: count });
}
