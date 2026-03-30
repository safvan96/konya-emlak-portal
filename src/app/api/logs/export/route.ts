import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const action = searchParams.get("action");

  const where: Record<string, unknown> = {};
  if (userId) where.userId = userId;
  if (action) where.action = action;

  const logs = await prisma.userLog.findMany({
    where,
    include: {
      user: { select: { name: true, surname: true, email: true, role: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const header = "Tarih,Kullanıcı,Email,Rol,Aksiyon,Detay,IP";
  const rows = logs.map((log) => {
    const date = new Date(log.createdAt).toLocaleString("tr-TR");
    const name = `${log.user.name} ${log.user.surname}`;
    const detail = (log.details || "").replace(/"/g, '""');
    return `"${date}","${name}","${log.user.email}","${log.user.role}","${log.action}","${detail}","${log.ipAddress || ""}"`;
  });

  const csv = [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="loglar_${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
