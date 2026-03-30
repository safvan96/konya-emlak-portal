# Konya Emlak Portal - CLAUDE.md

## Proje Özeti
Sahibinden.com'daki Konya şehri emlak ilanlarını otomatik tarayan, emlakçı/danışman ilanlarını filtreleyen ve sadece gerçek sahiplerinden satılan ilanları yöneten bir web platformu.

## İş Mantığı (Kritik)
- Sahibinden.com Konya emlak ilanları periyodik olarak taranır (scraping)
- Her ilanın **açıklama kısmı** analiz edilir
- **Filtreleme kuralı**: Açıklamada "emlak danışmanı", "gayrimenkul danışmanı", "remax", "century 21", "coldwell banker", "keller williams", "emlak ofisi", "gayrimenkul ofisi", "portföy no", "danışmanınız" gibi ifadeler varsa → İLAN REDDEDİLİR
- Sadece gerçek mal sahiplerinin ilanları sisteme alınır
- Yönetici, filtrelenmiş ilanları müşterilere **manuel olarak atar**
- Müşteri sadece kendisine atanan ilanları görür

## Kullanıcı Rolleri
1. **Yönetici (Admin)**
   - Tüm ilanları görür ve yönetir
   - Müşteri oluşturur/düzenler/siler
   - Müşterilere ilan atar (ad-soyad girerek, istediği kadar)
   - Müşteri giriş loglarını görür
   - Scraping işlemini manuel tetikleyebilir
   - İlan kategorilerini yönetir

2. **Müşteri (Customer)**
   - Giriş yapar (email + şifre)
   - Sadece kendisine atanmış ilanları görür
   - İlan detaylarını inceleyebilir
   - Favori ilanlarını işaretleyebilir

## Teknik Yığın (Tech Stack)
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes + Prisma ORM
- **Veritabanı**: PostgreSQL
- **Auth**: NextAuth.js (Credentials provider, role-based)
- **Scraping**: Puppeteer + node-cron (zamanlayıcı)
- **Deployment**: Docker-ready, VPS deploy

## Veritabanı Şeması (Özet)
- `users` → id, email, password, name, surname, role (ADMIN|CUSTOMER), createdAt
- `listings` → id, sahibindenId, title, description, price, location, category, imageUrls, sourceUrl, isFromOwner, status, scrapedAt, createdAt
- `categories` → id, name, slug (daire, müstakil, arsa, villa, vb.)
- `assignments` → id, userId, listingId, assignedAt, assignedBy
- `user_logs` → id, userId, action, details, ipAddress, createdAt
- `favorites` → id, userId, listingId, createdAt

## Scraping Kuralları
- Hedef: sahibinden.com/satilik + sahibinden.com/kiralik → Konya filtresi
- Her ilan için detay sayfasına girilir
- Açıklama metni NLP/regex ile analiz edilir
- Emlakçı tespiti yapılır → isFromOwner flag'i set edilir
- Duplicate kontrolü: sahibindenId ile
- Rate limiting: istekler arası 2-5sn random delay
- User-Agent rotation

## Filtreleme Blacklist Kelimeleri
```
emlak danışmanı, gayrimenkul danışmanı, remax, re/max, century 21,
coldwell banker, keller williams, emlak ofisi, gayrimenkul ofisi,
portföy no, portföy numarası, danışmanınız, emlak müşaviri,
gayrimenkul yatırım, turyap, emlak konut, broker, franchise,
ofisimiz, şubemiz, mağazamız, profesyonel ekibimiz
```

## Proje Yapısı
```
konya-emlak-portal/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Login
│   │   ├── (admin)/            # Admin panel (13 sayfa)
│   │   │   ├── dashboard/
│   │   │   ├── listings/ + [id]/ + map/
│   │   │   ├── customers/ + [id]/
│   │   │   ├── assignments/
│   │   │   ├── logs/
│   │   │   ├── analytics/
│   │   │   ├── reports/
│   │   │   ├── scraper/
│   │   │   ├── cities/
│   │   │   └── settings/
│   │   ├── (customer)/         # Müşteri panel (7 sayfa)
│   │   │   ├── my-listings/ + [id]/
│   │   │   ├── favorites/
│   │   │   ├── compare/
│   │   │   ├── notifications/
│   │   │   ├── preferences/
│   │   │   └── profile/
│   │   ├── api/                # 28+ API endpoint
│   │   │   ├── auth/, listings/, customers/, assignments/
│   │   │   ├── favorites/, notes/, preferences/, notifications/
│   │   │   ├── scraper/, blacklist/, cities/
│   │   │   ├── analytics/, reports/, dashboard/, health/
│   │   │   ├── logs/, sessions/, images/
│   │   │   └── mobile/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── admin/              # Admin-specific components
│   │   ├── customer/           # Customer-specific components
│   │   └── shared/             # Shared components
│   ├── lib/
│   │   ├── prisma.ts           # Prisma client
│   │   ├── auth.ts             # Auth config
│   │   ├── scraper/            # Scraping engine (çoklu mod)
│   │   │   ├── sahibinden.ts   # Sahibinden scraper + smartScrape()
│   │   │   ├── emlakjet-scraper.ts # Emlakjet scraper (VPS'den direkt çalışır)
│   │   │   ├── http-scraper.ts # HTTP tabanlı scraper (ScraperAPI/Zenrows)
│   │   │   ├── search-scraper.ts # DuckDuckGo arama motoru scraper
│   │   │   ├── filter.ts       # Emlakçı filtresi (34 blacklist kelime)
│   │   │   └── scheduler.ts    # Cron jobs (08:00, 20:00)
│   │   └── utils.ts
│   ├── types/
│   └── middleware.ts           # Auth + role middleware
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── public/
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── CLAUDE.md
└── PLAN.md
```

## Geliştirme Kuralları
- Tüm API route'ları auth middleware'den geçmeli
- Admin route'ları role check yapmalı
- Her kullanıcı aksiyonu `user_logs` tablosuna yazılmalı
- Scraper hata toleranslı olmalı (retry logic)
- Türkçe karakter desteği tam olmalı
- Mobile-first responsive tasarım
- Tüm metinler Türkçe

## Multi-City Mimari (Kritik)
- Sistem şehir-agnostik tasarlanmalı, Konya hardcode edilmemeli
- `cities` tablosu: id, name, slug, sahibindenCityId, isActive
- Her scraping işlemi city bazlı çalışır
- İlanlar city foreign key ile ilişkilendirilir
- Admin panelinde şehir yönetimi olmalı (ekle/aktif-pasif)
- Müşteriler şehir bazlı filtreleme yapabilmeli
- URL yapısı: /listings/konya, /listings/ankara vb.
- İlk aşamada sadece Konya aktif, ama altyapı tüm şehirlere hazır

## Scraper Modları (smartScrape - otomatik seçim)
1. **Emlakjet** (varsayılan) - API key gerektirmez, VPS'den direkt çalışır
2. **ScraperAPI/Zenrows** - SCRAPER_API_KEY env ile sahibinden.com'dan çeker
3. **Puppeteer** - PROXY_URL veya SAHIBINDEN_EMAIL ile sahibinden.com
- Sahibinden.com datacenter IP'lerini engelliyor, bu yüzden Emlakjet varsayılan
- Emlakjet'de sahibindenId alanı "EJ" prefix'li (EJ19165132 gibi)

## Önemli Notlar
- Emlakjet + sahibinden.com scraping; rate limiting çok önemli
- Müşteri sadece KENDİ ilanlarını görür, başka müşterinin ilanlarını ASLA
- Admin her şeyi görür ve yönetir
- Log sistemi detaylı olmalı (giriş, çıkış, ilan görüntüleme, vs.)
