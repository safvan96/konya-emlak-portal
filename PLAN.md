# Konya Emlak Portal - Geliştirme Planı

## Faz 0: Proje Altyapısı ⬜
- [ ] Next.js 14 projesi oluştur (App Router)
- [ ] Tailwind CSS + shadcn/ui kurulumu
- [ ] PostgreSQL + Prisma kurulumu
- [ ] Docker Compose (PostgreSQL + App)
- [ ] Environment variables (.env.example)
- [ ] ESLint + Prettier konfigürasyonu

## Faz 1: Veritabanı ve Auth ⬜
- [ ] Prisma schema tasarımı (users, listings, categories, assignments, user_logs, favorites)
- [ ] Migration oluştur ve çalıştır
- [ ] Seed data (admin kullanıcı, kategoriler)
- [ ] NextAuth.js kurulumu (Credentials provider)
- [ ] Role-based auth middleware (ADMIN / CUSTOMER)
- [ ] Login sayfası
- [ ] Session yönetimi

## Faz 2: Scraping Engine ⬜
- [ ] Puppeteer kurulumu ve base scraper class
- [ ] Sahibinden.com Konya satılık ilan listesi scraper
- [ ] Sahibinden.com Konya kiralık ilan listesi scraper
- [ ] İlan detay sayfası scraper (açıklama, fotoğraflar, fiyat, konum)
- [ ] Emlakçı filtresi (blacklist kelimeleri + regex pattern)
  - "emlak danışmanı", "gayrimenkul danışmanı", "remax", "century 21" vb.
  - Telefon numarası pattern analizi (aynı numara çok ilanlarda = emlakçı)
  - Kullanıcı profili analizi (çok ilan = muhtemelen emlakçı)
- [ ] Duplicate detection (sahibindenId bazlı)
- [ ] Rate limiting + random delay (2-5sn)
- [ ] User-Agent rotation
- [ ] Retry logic (3 deneme, exponential backoff)
- [ ] Scraping sonuç raporu (toplam/kabul/red/hata)
- [ ] node-cron ile zamanlayıcı (günde 2 kez)
- [ ] Manuel tetikleme API endpoint'i

## Faz 3: Admin Paneli ⬜
### Dashboard
- [ ] Özet istatistikler (toplam ilan, aktif müşteri, bugünkü atamalar)
- [ ] Son scraping raporu
- [ ] Son müşteri aktiviteleri

### İlan Yönetimi
- [ ] Tüm ilanları listele (filtreleme + arama + pagination)
- [ ] İlan detay sayfası
- [ ] İlan kategorisi değiştir
- [ ] İlanı aktif/pasif yap
- [ ] İlanı sil
- [ ] Reddedilen ilanları (emlakçı) görüntüle (doğrulama için)

### Müşteri Yönetimi
- [ ] Müşteri listesi (ad, soyad, email, atanmış ilan sayısı)
- [ ] Yeni müşteri oluştur (ad, soyad, email, şifre)
- [ ] Müşteri düzenle / sil
- [ ] Müşteriye ilan ata (ad-soyad gir → ilan seç → ata)
- [ ] Müşteriden ilan kaldır
- [ ] Müşterinin atanmış ilanlarını görüntüle

### Log Yönetimi
- [ ] Müşteri giriş/çıkış logları
- [ ] İlan görüntüleme logları
- [ ] Filtreleme (tarih, müşteri, aksiyon tipi)
- [ ] Log export (CSV)

### Scraper Yönetimi
- [ ] Manuel scraping tetikleme butonu
- [ ] Scraping geçmişi ve raporları
- [ ] Blacklist kelime yönetimi (ekle/sil/düzenle)
- [ ] Scraping ayarları (frekans, delay)

## Faz 4: Müşteri Paneli ⬜
- [ ] Giriş sayfası (email + şifre)
- [ ] Ana sayfa - atanmış ilanlar listesi
- [ ] İlan kartları (resim, fiyat, konum, kategori)
- [ ] İlan detay sayfası (tüm bilgiler + fotoğraf galerisi)
- [ ] Favorilere ekle/çıkar
- [ ] Favoriler sayfası
- [ ] Profil sayfası (şifre değiştir)
- [ ] Kategori bazlı filtreleme
- [ ] Fiyat aralığı filtresi
- [ ] Konum filtresi (ilçe bazlı)

## Faz 5: UI/UX ve Responsive ⬜
- [ ] Landing page tasarımı
- [ ] Mobile-first responsive düzen
- [ ] Dark/Light mode
- [ ] Loading states ve skeleton screens
- [ ] Toast notifications
- [ ] Empty states
- [ ] Error pages (404, 500)
- [ ] Türkçe UI metinleri

## Faz 6: Güvenlik ve Performans ⬜
- [ ] Input validation (zod)
- [ ] Rate limiting (API)
- [ ] CSRF koruması
- [ ] XSS koruması
- [ ] SQL injection koruması (Prisma zaten sağlar)
- [ ] Image optimization (Next.js Image)
- [ ] API response caching
- [ ] Database indexing

## Faz 7: Deployment ⬜
- [ ] Dockerfile optimize et
- [ ] Docker Compose (production)
- [ ] Nginx reverse proxy config
- [ ] SSL sertifikası (Let's Encrypt)
- [ ] Environment variables (production)
- [ ] Database backup stratejisi
- [ ] PM2 veya systemd service
- [ ] CI/CD pipeline (GitHub Actions)

## Faz 8: Mobil Uygulama (Sonraki Etap) ⬜
- [ ] React Native veya Flutter ile mobil uygulama
- [ ] API hazır (Next.js API routes zaten mevcut)
- [ ] Push notifications
- [ ] Offline cache

---

## Öncelik Sırası
1. **Faz 0 + 1**: Altyapı hazır olmalı → temel
2. **Faz 2**: Scraping çalışmalı → veri kaynağı
3. **Faz 3**: Admin paneli → kontrol
4. **Faz 4**: Müşteri paneli → değer
5. **Faz 5 + 6**: Polish → kalite
6. **Faz 7**: Deploy → canlıya al
7. **Faz 8**: Mobil → genişle

## Kritik Kararlar
- **Scraping frekansı**: Günde 2 kez (sabah 08:00, akşam 20:00) - sahibinden'i sıkmamak için
- **Veri saklama**: İlan resimleri kendi sunucumuza indirilecek (sahibinden linkleri değişebilir)
- **Filtreleme**: Agresif filtreleme > bazı gerçek sahip ilanlarını kaçırmak tercih edilir, emlakçı ilanı göstermektense
- **Atama modeli**: 1 ilan birden fazla müşteriye atanabilir (farklı müşteriler aynı ilanla ilgilenebilir)
