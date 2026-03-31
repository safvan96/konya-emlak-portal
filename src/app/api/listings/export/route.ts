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
  const isFromOwner = searchParams.get("isFromOwner");
  const status = searchParams.get("status");
  const listingType = searchParams.get("listingType");

  const where: Record<string, unknown> = {};
  if (isFromOwner) where.isFromOwner = isFromOwner === "true";
  if (status) where.status = status;
  if (listingType) where.listingType = listingType;

  const listings = await prisma.listing.findMany({
    where,
    include: { city: true, category: true, _count: { select: { assignments: true } } },
    orderBy: { createdAt: "desc" },
    take: 10000,
  });

  const header = "Başlık,Fiyat,Telefon,İlan Sahibi,Şehir,İlçe,Kategori,Tip,Kaynak,Durum,Oda,m²,Atama,Tarih,Emlakjet URL,Sahibinden URL";
  const rows = listings.map((l) => {
    const title = l.title.replace(/"/g, '""');
    const price = l.price ? String(l.price) : "";
    const type = l.listingType === "SALE" ? "Satılık" : "Kiralık";
    const source = l.isFromOwner ? "Sahibinden" : "Emlakçı";
    const date = new Date(l.createdAt).toLocaleDateString("tr-TR");
    return `"${title}","${price}","${l.sellerPhone || ""}","${l.sellerName || ""}","${l.city.name}","${l.district || ""}","${l.category?.name || ""}","${type}","${source}","${l.status}","${l.roomCount || ""}","${l.squareMeters || ""}","${l._count.assignments}","${date}","${l.sourceUrl}","${l.sahibindenUrl || ""}"`;
  });

  const csv = "\uFEFF" + [header, ...rows].join("\n"); // BOM for Turkish chars in Excel

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ilanlar_${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
