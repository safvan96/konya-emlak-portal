import { NextRequest, NextResponse } from "next/server";

// Sahibinden resimlerini proxy'leyerek CORS ve hotlink sorunlarını çözer
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url || !url.includes("sahibinden.com")) {
    return NextResponse.json({ error: "Geçersiz URL" }, { status: 400 });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.sahibinden.com/",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Resim yüklenemedi" }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
    });
  } catch {
    return NextResponse.json({ error: "Resim proxy hatası" }, { status: 500 });
  }
}
