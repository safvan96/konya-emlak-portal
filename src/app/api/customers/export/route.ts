import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customers = await prisma.user.findMany({
    where: { role: "CUSTOMER" },
    include: {
      _count: { select: { assignments: true, favorites: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const header = "Ad,Soyad,Email,Durum,Atanmis Ilan,Favori,Kayit Tarihi";
  const rows = customers.map((c) => {
    const date = new Date(c.createdAt).toLocaleDateString("tr-TR");
    return `"${c.name}","${c.surname}","${c.email}","${c.isActive ? "Aktif" : "Pasif"}","${c._count.assignments}","${c._count.favorites}","${date}"`;
  });

  const csv = "\uFEFF" + [header, ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="musteriler_${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
