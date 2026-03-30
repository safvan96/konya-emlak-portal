import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLog } from "@/lib/log";

// Admin: Musteri aktif oturumlarini gor (son login tarihlerine gore)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Her musterinin son login zamani
  const customers = await prisma.user.findMany({
    where: { role: "CUSTOMER", isActive: true },
    select: { id: true, name: true, surname: true, email: true },
  });

  const sessionsData = await Promise.all(
    customers.map(async (c) => {
      const lastLogin = await prisma.userLog.findFirst({
        where: { userId: c.id, action: "LOGIN" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, ipAddress: true },
      });
      return {
        ...c,
        lastLogin: lastLogin?.createdAt || null,
        lastIp: lastLogin?.ipAddress || null,
      };
    })
  );

  return NextResponse.json(
    sessionsData.filter((s) => s.lastLogin).sort((a, b) =>
      new Date(b.lastLogin!).getTime() - new Date(a.lastLogin!).getTime()
    )
  );
}

// Admin: Musteriyi deaktif et (fiilen oturumu sonlandirir - JWT yenilenmez)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId gerekli" }, { status: 400 });

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
  });

  await createLog(session.user.id, "FORCE_DEACTIVATE", `Musteri deaktif edildi: ${userId}`);

  return NextResponse.json({ success: true });
}
