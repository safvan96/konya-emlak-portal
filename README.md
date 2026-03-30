# Emlak Portal

Sahibinden.com'dan emlak ilanlarini otomatik tarayan, emlakci/danisma ilanlarini filtreleyen ve sadece gercek sahiplerinden satilan ilanlari yoneten web platformu.

## Ozellikler

- Sahibinden.com otomatik ilan tarama (Puppeteer)
- Emlakci/danisma ilanlari akilli filtreleme (blacklist + regex + pattern)
- Admin paneli (ilan, musteri, atama, log, scraper, sehir yonetimi)
- Musteri paneli (atanmis ilanlar, favoriler, profil)
- Coklu sehir destegi
- Dark/Light tema
- Mobil uyumlu tasarim
- CSV export (ilanlar + loglar)
- Rate limiting + zod validation
- Docker + Nginx + PM2 deploy destegi

## Teknolojiler

- **Frontend:** Next.js 14 (App Router), Tailwind CSS
- **Backend:** Next.js API Routes, Prisma ORM
- **Veritabani:** PostgreSQL
- **Auth:** NextAuth.js (JWT, Credentials)
- **Scraping:** Puppeteer, node-cron
- **Deployment:** Docker, Nginx, PM2

## Kurulum

### Gereksinimler
- Node.js 20+
- PostgreSQL 16+

### Adimlar

```bash
# Repo'yu klonla
git clone https://github.com/safvan96/konya-emlak-portal.git
cd konya-emlak-portal

# Bagimliliklari yukle
npm install

# Ortam degiskenlerini ayarla
cp .env.example .env
# .env dosyasini duzenle

# Veritabanini olustur
npx prisma db push

# Seed data yukle (admin kullanici + kategoriler)
npx tsx prisma/seed.ts

# Gelistirme sunucusu
npm run dev
```

### Docker ile

```bash
cp .env.production.example .env
# .env dosyasini duzenle

docker-compose up -d
```

## Varsayilan Kullanicilar

| Rol | Email | Sifre |
|-----|-------|-------|
| Admin | admin@emlakportal.com | admin123 |
| Musteri | musteri@emlakportal.com | musteri123 |

## API Endpointleri

| Yol | Metod | Aciklama |
|-----|-------|----------|
| /api/auth/[...nextauth] | POST | Auth |
| /api/listings | GET/PATCH/DELETE | Ilan CRUD |
| /api/listings/[id] | GET | Ilan detay |
| /api/listings/export | GET | CSV export |
| /api/customers | GET/POST/PATCH/DELETE | Musteri CRUD |
| /api/assignments | GET/POST/DELETE | Atama yonetimi |
| /api/favorites | GET/POST/DELETE | Favoriler |
| /api/cities | GET/POST/PATCH | Sehir yonetimi |
| /api/scraper | GET/POST | Scraper kontrolu |
| /api/blacklist | GET/POST/DELETE | Filtre kelimeleri |
| /api/logs | GET | Kullanici loglari |
| /api/logs/export | GET | Log CSV export |
| /api/dashboard | GET | Dashboard istatistikleri |
| /api/profile/password | POST | Sifre degistir |
| /api/images | GET | Resim proxy |
| /api/health | GET | Sistem durumu |

## Proje Yapisi

```
src/
├── app/           # Next.js sayfalar + API route'lar
├── components/    # UI bilesenleri
├── lib/           # Yardimci moduller (auth, prisma, scraper, validations)
├── types/         # TypeScript tip tanimlari
└── middleware.ts   # Auth + role middleware
```

## Lisans

MIT
