# Emlak Portal

Sahibinden.com'dan emlak ilanlarini otomatik tarayan, emlakci/danisma ilanlarini filtreleyen ve sadece gercek sahiplerinden satilan ilanlari yoneten web platformu.

## Ozellikler

**Scraping & Filtreleme:**
- Emlakjet.com + Sahibinden.com otomatik ilan tarama (cron 08:00/20:00)
- Sadece "sahibinden" (gercek sahip) ilanlari cekilir - emlakci ilanlari kaynakta filtrelenir
- Her ilana telefon numarasi ve ilan sahibi adi otomatik eklenir
- Akilli emlakci filtreleme (blacklist, regex, Unicode normalize, baslik+aciklama tarama)
- Fiyat degisim takibi, benzer ilan duplicate tespiti
- 4 scraper modu: Emlakjet (varsayilan), ScraperAPI, HTTP, Puppeteer

**Admin Paneli (11 sayfa):**
- Dashboard (istatistikler, yeni ilan bildirimi, fiyat dusus alarmlari)
- Ilan yonetimi (toplu sec/sil/durum degistir/ata, debounce arama, CSV export)
- Ilan detay (foto galeri, fiyat gecmisi, hizli musteri atama, yazdir)
- Musteri yonetimi (CRUD, toplu aktif/pasif/sil, CSV import/export, bildirim gonder)
- Musteri detay (atamalar, loglar, favoriler, tercih bilgisi)
- Atama yonetimi (musteri sec, ilan ara, toplu ata)
- Istatistikler (fiyat avg/min/max, sehir/kategori/durum/tip dagilimi, scraper grafik)
- Scraper (manuel tetikleme, gecmis, hata gosterimi, blacklist kelime yonetimi)
- Log yonetimi (filtreleme, CSV export)
- Sehir yonetimi, Sistem ayarlari

**Musteri Paneli (7 sayfa):**
- Ilanlarim (arama, kategori/tip/ilce/fiyat filtre, siralama, karsilastirma secimi)
- Ilan detay (foto galeri, kisisel notlar, favori, WhatsApp paylasim, link kopyalama)
- Favoriler, Bildirimler, Tercihler (oto-atama), Karsilastirma, Profil

**Teknik:**
- Otomatik ilan atama (musteri tercihlerine gore)
- Dark/Light tema, PWA (offline destegi, service worker)
- Klavye kisayollari (G+D dashboard, G+L ilanlar vb.)
- Toast bildirimleri, skeleton loading, mobil responsive
- Musteri ilan detayda telefon ara + WhatsApp ile yaz butonlari
- Her ilanda Emlakjet (kaynak) + Sahibinden (arama) cift link
- Zod validation, rate limiting, IP loglama, 61 test
- PM2 production, gunluk backup (03:00), Nginx + GitHub Actions CI/CD

## Teknolojiler

- **Frontend:** Next.js 14 (App Router), React 18, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API Routes, Prisma ORM
- **Veritabani:** PostgreSQL (11 model)
- **Auth:** NextAuth.js (JWT, Credentials, role-based)
- **Scraping:** Emlakjet + Puppeteer + ScraperAPI, node-cron
- **Validation:** Zod
- **Test:** Vitest (61 test)
- **Deployment:** PM2, Nginx, Docker, GitHub Actions

## Kurulum

### Gereksinimler
- Node.js 20+
- PostgreSQL 16+

### Adimlar

```bash
git clone https://github.com/safvan96/konya-emlak-portal.git
cd konya-emlak-portal
npm install
cp .env.example .env  # duzenle
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

### Docker ile

```bash
cp .env.production.example .env  # duzenle
docker-compose up -d
```

### Test

```bash
npm test          # tek sefer
npm run test:watch  # izleme modu
```

## Varsayilan Kullanicilar

| Rol | Email | Sifre |
|-----|-------|-------|
| Admin | admin@emlakportal.com | admin123 (ilk kurulumda degistirin) |
| Musteri | musteri@test.com | test123 |

## API Endpointleri (26)

| Yol | Metod | Aciklama |
|-----|-------|----------|
| /api/auth/[...nextauth] | POST | Auth |
| /api/listings | GET/PATCH/DELETE | Ilan CRUD + toplu islem |
| /api/listings/[id] | GET | Ilan detay |
| /api/listings/[id]/history | GET | Fiyat gecmisi |
| /api/listings/export | GET | Ilan CSV export |
| /api/customers | GET/POST/PATCH/DELETE | Musteri CRUD |
| /api/customers/[id] | GET | Musteri detay |
| /api/customers/export | GET | Musteri CSV export |
| /api/customers/import | POST | Musteri CSV import |
| /api/assignments | GET/POST/DELETE | Atama yonetimi |
| /api/assignments/unread | GET | Yeni ilan sayisi |
| /api/favorites | GET/POST/DELETE | Favoriler |
| /api/notes | GET/POST | Ilan notlari |
| /api/preferences | GET/POST | Musteri tercihleri |
| /api/notifications | GET/POST | Bildirim sistemi |
| /api/cities | GET/POST/PATCH | Sehir yonetimi |
| /api/scraper | GET/POST | Scraper kontrolu |
| /api/blacklist | GET/POST/DELETE | Filtre kelimeleri |
| /api/analytics | GET | Istatistik verileri |
| /api/logs | GET | Kullanici loglari |
| /api/logs/export | GET | Log CSV export |
| /api/dashboard | GET | Dashboard istatistikleri |
| /api/sessions | GET/POST | Oturum yonetimi |
| /api/profile/password | POST | Sifre degistir |
| /api/images | GET | Resim proxy |
| /api/health | GET | Sistem durumu |

## Klavye Kisayollari

**Admin:** G+D Dashboard, G+L Ilanlar, G+M Musteriler, G+A Atamalar, G+S Scraper, G+I Istatistikler, G+T Ayarlar, G+C Sehirler, G+O Loglar

**Musteri:** G+L Ilanlarim, G+F Favoriler, G+P Profil, G+T Tercihler

## Proje Yapisi

```
src/
├── app/
│   ├── (admin)/       # 11 admin sayfasi
│   ├── (auth)/        # Login
│   ├── (customer)/    # 7 musteri sayfasi
│   └── api/           # 26 API endpoint
├── components/
│   ├── admin/         # Sidebar
│   ├── customer/      # Nav
│   ├── shared/        # Auth, theme, keyboard, SW
│   └── ui/            # Badge, Button, Card, Input, Select, Skeleton, Table, Toast, ImageFallback
├── lib/
│   ├── scraper/       # Emlakjet + Sahibinden scraper, filter, scheduler
│   ├── auth.ts        # NextAuth config
│   ├── auto-assign.ts # Otomatik atama
│   ├── log.ts         # Loglama
│   ├── prisma.ts      # DB client
│   ├── rate-limit.ts  # Rate limiter
│   ├── utils.ts       # Yardimci fonksiyonlar
│   └── validations.ts # Zod semalari
├── types/             # TypeScript tanimlari
└── middleware.ts       # Auth + role + IP middleware
tests/                  # 61 test (5 dosya)
```

## Lisans

MIT
