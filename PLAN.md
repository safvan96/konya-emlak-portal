# Konya Emlak Portal - Geliştirme Planı

## Faz 0: Proje Altyapısı ✅
- [x] Next.js 14 projesi oluştur (App Router)
- [x] Tailwind CSS + shadcn/ui kurulumu
- [x] PostgreSQL + Prisma kurulumu
- [x] Docker Compose (PostgreSQL + App)
- [x] Environment variables (.env.example)
- [x] Klavye kısayolları (admin + müşteri)

## Faz 1: Veritabanı ve Auth ✅
- [x] Prisma schema tasarımı (users, listings, categories, assignments, user_logs, favorites)
- [x] Migration oluştur ve çalıştır (prisma db push)
- [x] Seed data (admin kullanıcı, kategoriler, blacklist kelimeleri)
- [x] NextAuth.js kurulumu (Credentials provider)
- [x] Role-based auth middleware (ADMIN / CUSTOMER)
- [x] Login sayfası
- [x] Session yönetimi

## Faz 2: Scraping Engine ✅
- [x] Puppeteer kurulumu ve scraper
- [x] Sahibinden.com satılık ilan listesi scraper
- [x] Sahibinden.com kiralık ilan listesi scraper
- [x] İlan detay sayfası scraper (açıklama, fotoğraflar, fiyat, konum)
- [x] Emlakçı filtresi (blacklist kelimeleri + regex pattern)
  - [x] Blacklist kelime eşleşme
  - [x] Telefon numarası pattern analizi
  - [x] Satıcı ismi analizi
- [x] Duplicate detection (sahibindenId bazlı)
- [x] Rate limiting + random delay (2-5sn)
- [x] User-Agent rotation
- [x] Retry logic
- [x] Scraping sonuç raporu (ScraperRun tablosu)
- [x] node-cron ile zamanlayıcı (günde 2 kez - 08:00 ve 20:00)
- [x] Manuel tetikleme API endpoint'i

## Faz 3: Admin Paneli ✅
### Dashboard
- [x] Özet istatistikler (toplam ilan, aktif müşteri, bugünkü atamalar)
- [x] Son scraping raporu
- [x] Son kullanıcı aktiviteleri

### İlan Yönetimi
- [x] Tüm ilanları listele (filtreleme + arama + pagination)
- [x] İlan detay sayfası (fotoğraf galerisi, açıklama, detaylar, atamalar)
- [x] İlan kategorisi değiştir
- [x] İlanı aktif/pasif yap
- [x] İlanı sil
- [x] Reddedilen ilanları (emlakçı) görüntüle (red sebebi gösterilir)

### Müşteri Yönetimi
- [x] Müşteri listesi (ad, soyad, email, atanmış ilan sayısı)
- [x] Yeni müşteri oluştur (ad, soyad, email, şifre)
- [x] Müşteri düzenle / sil
- [x] Müşteriye ilan ata (toplu atama)
- [x] Müşteriden ilan kaldır
- [x] Müşterinin atanmış ilanlarını görüntüle

### Log Yönetimi
- [x] Müşteri giriş/çıkış logları
- [x] İlan görüntüleme logları
- [x] Filtreleme (aksiyon tipi)
- [x] Log export (CSV)

### Scraper Yönetimi
- [x] Manuel scraping tetikleme butonu
- [x] Scraping geçmişi ve raporları
- [x] Blacklist kelime yönetimi (ekle/sil)
- [x] Şehir yönetimi (ekle/aktif-pasif)

## Faz 4: Müşteri Paneli ✅
- [x] Giriş sayfası (email + şifre)
- [x] Ana sayfa - atanmış ilanlar listesi
- [x] İlan kartları (resim, fiyat, konum, kategori)
- [x] İlan detay sayfası (tüm bilgiler + fotoğraf galerisi)
- [x] Favorilere ekle/çıkar
- [x] Favoriler sayfası
- [x] Profil sayfası (şifre değiştir)
- [x] Kategori bazlı filtreleme
- [x] Fiyat aralığı filtresi
- [x] İlçe bazlı filtre

## Faz 5: UI/UX ve Responsive ✅
- [x] Landing page tasarımı
- [x] Mobile-first responsive düzen (admin sidebar hamburger menu)
- [x] Dark/Light mode toggle
- [x] Loading states ve skeleton screens (tüm sayfalar)
- [x] Toast notifications
- [x] Resim fallback (kırık resim placeholder)
- [x] Empty states
- [x] Error pages (404, 500)
- [x] Türkçe UI metinleri

## Faz 6: Güvenlik ve Performans ✅
- [x] Input validation (zod)
- [x] Rate limiting (login brute force koruması)
- [x] CSRF koruması (NextAuth built-in)
- [x] XSS koruması (React built-in)
- [x] SQL injection koruması (Prisma)
- [x] Resim proxy API (Sahibinden cache)
- [x] IP loglama (middleware + auto-detect)
- [x] Database composite indexing
- [x] Health check endpoint

## Faz 7: Deployment ✅
- [x] Dockerfile
- [x] Docker Compose (production)
- [x] Nginx reverse proxy config
- [ ] SSL sertifikası (Let's Encrypt) - domain bağlandığında
- [x] Environment variables (production)
- [x] Database backup stratejisi (scripts/backup.sh)
- [x] PM2 config (ecosystem.config.js)
- [x] CI/CD pipeline (GitHub Actions)
- [x] Multi-stage Docker build (standalone output)
- [x] README.md dokümantasyonu
- [x] .env.production.example

## Faz 8: Mobil Uygulama (Sonraki Etap) ⬜
- [ ] React Native veya Flutter ile mobil uygulama
- [x] API hazır (26 endpoint)
- [x] PWA offline cache (Service Worker)
- [ ] Push notifications (native)

## Ekstra Ozellikler (Plan Disinda Eklenen) ✅
- [x] Ilan karsilastirma (yan yana tablo)
- [x] Musteri ilan notlari
- [x] Fiyat degisim takibi + alarm
- [x] Otomatik atama sistemi (tercih bazli)
- [x] Musteri tercihleri sayfasi
- [x] Admin istatistikler sayfasi (analytics)
- [x] Admin sistem ayarlari sayfasi
- [x] Admin musteri detay sayfasi
- [x] Bildirim sistemi (admin->musteri)
- [x] WhatsApp paylasim + link kopyalama
- [x] CSV import/export (ilanlar, musteriler, loglar)
- [x] Klavye kisayollari
- [x] Oturum yonetimi (zorla deaktif)
- [x] 44 test (Vitest)
- [x] PWA + Service Worker
- [x] SEO meta tags

---

## Proje Metrikleri
- **110+ dosya**, 19,700+ satir kod
- **26 API endpoint**, 20 sayfa, 44 test
- **11 veritabani modeli**, 4 scraper modu
- **17 commit**
- **177 gerçek ilan** DB'de (137 Emlakjet, 40 demo/test)

## Durum
1. **Faz 0-7**: ✅ Tamamlandi (SSL haric)
2. **Faz 8**: Mobil uygulama → sonraki etap
3. **Ekstra**: ✅ 16 plan disi ozellik eklendi
4. **Scraper**: ✅ Emlakjet scraper çalışıyor - 137 gerçek ilan çekildi

## Kritik Kararlar
- **Scraping frekansı**: Günde 2 kez (sabah 08:00, akşam 20:00) - sahibinden'i sıkmamak için
- **Veri saklama**: İlan resimleri kendi sunucumuza indirilecek (sahibinden linkleri değişebilir)
- **Filtreleme**: Agresif filtreleme > bazı gerçek sahip ilanlarını kaçırmak tercih edilir, emlakçı ilanı göstermektense
- **Atama modeli**: 1 ilan birden fazla müşteriye atanabilir (farklı müşteriler aynı ilanla ilgilenebilir)
