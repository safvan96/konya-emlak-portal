import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Rapor CSV export
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "customers";

  if (type === "customers") {
    // Musteri aktivite raporu
    const customers = await prisma.user.findMany({
      where: { role: "CUSTOMER" },
      select: {
        name: true, surname: true, email: true, isActive: true, createdAt: true,
        _count: { select: { assignments: true, favorites: true, logs: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Her musteri icin son login
    const header = "Ad,Soyad,Email,Durum,Atama,Favori,Log,Kayit Tarihi";
    const rows = customers.map((c) => {
      const date = new Date(c.createdAt).toLocaleDateString("tr-TR");
      return `"${c.name}","${c.surname}","${c.email}","${c.isActive ? "Aktif" : "Pasif"}","${c._count.assignments}","${c._count.favorites}","${c._count.logs}","${date}"`;
    });

    const csv = "\uFEFF" + [header, ...rows].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="musteri_rapor_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  if (type === "listings") {
    // Ilan ozet raporu - sehir/kategori bazli
    const listings = await prisma.listing.groupBy({
      by: ["cityId", "categoryId", "listingType", "status"],
      _count: true,
      _avg: { price: true },
    });

    const cities = await prisma.city.findMany({ select: { id: true, name: true } });
    const categories = await prisma.category.findMany({ select: { id: true, name: true } });
    const cityMap = Object.fromEntries(cities.map((c) => [c.id, c.name]));
    const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

    const header = "Sehir,Kategori,Tip,Durum,Adet,Ort Fiyat";
    const rows = listings.map((l) => {
      const city = cityMap[l.cityId] || "?";
      const cat = l.categoryId ? catMap[l.categoryId] || "?" : "Kategorisiz";
      const type = l.listingType === "SALE" ? "Satılık" : "Kiralık";
      const avg = Math.round(l._avg.price || 0);
      return `"${city}","${cat}","${type}","${l.status}","${l._count}","${avg}"`;
    });

    const csv = "\uFEFF" + [header, ...rows].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ilan_rapor_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  return NextResponse.json({ error: "Gecersiz tip" }, { status: 400 });
}
