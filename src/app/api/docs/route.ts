import { NextResponse } from "next/server";

// API dokumantasyonu - public endpoint
export async function GET() {
  return NextResponse.json({
    name: "EvSahip API",
    version: "1.0.0",
    endpoints: [
      { method: "GET", path: "/api/health", auth: false, description: "Sistem durumu" },
      { method: "POST", path: "/api/auth/[...nextauth]", auth: false, description: "Authentication" },

      { method: "GET", path: "/api/listings", auth: true, description: "Ilan listesi (filtre + pagination)" },
      { method: "PATCH", path: "/api/listings", auth: "admin", description: "Ilan guncelle" },
      { method: "DELETE", path: "/api/listings", auth: "admin", description: "Ilan sil" },
      { method: "GET", path: "/api/listings/:id", auth: true, description: "Ilan detay" },
      { method: "GET", path: "/api/listings/:id/history", auth: true, description: "Fiyat gecmisi" },
      { method: "GET", path: "/api/listings/export", auth: "admin", description: "Ilan CSV export" },
      { method: "POST", path: "/api/listings/bulk", auth: "admin", description: "Toplu ilan islemleri" },

      { method: "GET", path: "/api/customers", auth: "admin", description: "Musteri listesi" },
      { method: "POST", path: "/api/customers", auth: "admin", description: "Musteri olustur" },
      { method: "PATCH", path: "/api/customers", auth: "admin", description: "Musteri guncelle" },
      { method: "DELETE", path: "/api/customers", auth: "admin", description: "Musteri sil" },
      { method: "GET", path: "/api/customers/:id", auth: "admin", description: "Musteri detay" },
      { method: "GET", path: "/api/customers/export", auth: "admin", description: "Musteri CSV export" },
      { method: "POST", path: "/api/customers/import", auth: "admin", description: "Musteri CSV import" },

      { method: "GET", path: "/api/assignments", auth: true, description: "Atama listesi" },
      { method: "POST", path: "/api/assignments", auth: "admin", description: "Ilan ata" },
      { method: "DELETE", path: "/api/assignments", auth: "admin", description: "Atama kaldir" },
      { method: "GET", path: "/api/assignments/unread", auth: true, description: "Okunmamis ilan sayisi" },

      { method: "GET", path: "/api/favorites", auth: true, description: "Favoriler" },
      { method: "POST", path: "/api/favorites", auth: true, description: "Favoriye ekle" },
      { method: "DELETE", path: "/api/favorites", auth: true, description: "Favoriden cikar" },

      { method: "GET/POST", path: "/api/notes", auth: true, description: "Ilan notlari" },
      { method: "GET/POST", path: "/api/preferences", auth: true, description: "Musteri tercihleri" },
      { method: "GET/POST", path: "/api/notifications", auth: true, description: "Bildirimler" },

      { method: "GET/POST/PATCH", path: "/api/cities", auth: true, description: "Sehir yonetimi" },
      { method: "GET/POST", path: "/api/scraper", auth: "admin", description: "Scraper kontrolu" },
      { method: "GET/POST/DELETE", path: "/api/blacklist", auth: "admin", description: "Blacklist kelimeleri" },

      { method: "GET", path: "/api/analytics", auth: "admin", description: "Istatistikler" },
      { method: "GET", path: "/api/reports", auth: "admin", description: "Donemsel raporlar" },
      { method: "GET", path: "/api/reports/export", auth: "admin", description: "Rapor CSV export" },
      { method: "GET", path: "/api/dashboard", auth: "admin", description: "Dashboard verileri" },
      { method: "GET", path: "/api/logs", auth: "admin", description: "Kullanici loglari" },
      { method: "GET", path: "/api/logs/export", auth: "admin", description: "Log CSV export" },
      { method: "GET/POST", path: "/api/sessions", auth: "admin", description: "Oturum yonetimi" },

      { method: "POST", path: "/api/profile/password", auth: true, description: "Sifre degistir" },
      { method: "GET", path: "/api/images", auth: false, description: "Resim proxy" },
      { method: "GET", path: "/api/history", auth: true, description: "Goruntuleme gecmisi" },

      { method: "GET", path: "/api/mobile/listings", auth: true, description: "Mobil ilan listesi" },
      { method: "GET", path: "/api/mobile/profile", auth: true, description: "Mobil profil" },

      { method: "GET", path: "/api/docs", auth: false, description: "API dokumantasyonu" },
    ],
  });
}
