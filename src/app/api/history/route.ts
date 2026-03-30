import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Musterinin ilan goruntuleme gecmisi
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const logs = await prisma.userLog.findMany({
    where: {
      userId: session.user.id,
      action: "VIEW_LISTING",
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      details: true,
      createdAt: true,
    },
  });

  return NextResponse.json(logs);
}
