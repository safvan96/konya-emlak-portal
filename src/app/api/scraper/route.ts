import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scrapeSahibinden } from "@/lib/scraper/sahibinden";
import { createLog } from "@/lib/log";
import { scraperTriggerSchema, validateBody } from "@/lib/validations";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runs = await prisma.scraperRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 20,
  });

  return NextResponse.json(runs);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const validation = validateBody(scraperTriggerSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const { citySlug, listingType, maxPages } = validation.data;

  await createLog(
    session.user.id,
    "SCRAPER_TRIGGERED",
    `${citySlug} - ${listingType} - ${maxPages} sayfa`
  );

  // Async olarak başlat - response'u hemen dön
  scrapeSahibinden(citySlug, listingType, maxPages).catch((err) => {
    console.error("Scraper hata:", err);
  });

  return NextResponse.json({ message: "Scraping başlatıldı", citySlug, listingType });
}
