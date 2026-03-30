import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createLog } from "@/lib/log";

// Admin toplu bildirim: secili musterilere mesaj gonder (log olarak kaydet)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userIds, message } = await req.json();

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0 || !message) {
    return NextResponse.json({ error: "userIds ve message gerekli" }, { status: 400 });
  }

  // Her musteriye bildirim logu olustur
  let sent = 0;
  for (const userId of userIds) {
    try {
      await prisma.userLog.create({
        data: {
          userId,
          action: "ADMIN_NOTIFICATION",
          details: message,
        },
      });
      sent++;
    } catch {
      // Kullanici bulunamadi - atla
    }
  }

  await createLog(session.user.id, "SEND_NOTIFICATION", `${sent} musteriye bildirim gonderildi: ${message.slice(0, 100)}`);

  return NextResponse.json({ sent, total: userIds.length });
}

// Musterinin okunmamis bildirimleri
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await prisma.userLog.findMany({
    where: {
      userId: session.user.id,
      action: "ADMIN_NOTIFICATION",
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      details: true,
      createdAt: true,
    },
  });

  return NextResponse.json(notifications);
}
