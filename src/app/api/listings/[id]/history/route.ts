import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const history = await prisma.priceHistory.findMany({
    where: { listingId: params.id },
    orderBy: { changedAt: "desc" },
    take: 20,
  });

  return NextResponse.json(history);
}
