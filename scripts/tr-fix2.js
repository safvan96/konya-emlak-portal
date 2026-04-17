const fs = require('fs');
const path = require('path');

const REPLACEMENTS = [
  [/"Tum Sehirler"/g, '"Tüm Şehirler"'],
  [/"Tum Kategoriler"/g, '"Tüm Kategoriler"'],
  [/"Tum Tipler"/g, '"Tüm Tipler"'],
  [/"Tum Durumlar"/g, '"Tüm Durumlar"'],
  [/>Tum Sehirler</g, '>Tüm Şehirler<'],
  [/>Tum Kategoriler</g, '>Tüm Kategoriler<'],
  [/>Tum Tipler</g, '>Tüm Tipler<'],
  [/>Tum Durumlar</g, '>Tüm Durumlar<'],
  [/Tum sehirler/g, 'Tüm şehirler'],
  [/Tum kategoriler/g, 'Tüm kategoriler'],
  [/ ilan secildi/g, ' ilan seçildi'],
  [/ secildi/g, ' seçildi'],
  [/secin\.\.\./g, 'seçin...'],
  [/Musteriye Ata/g, 'Müşteriye Ata'],
  [/Ilan Ata/g, 'İlan Ata'],
  [/ tekrar filtrelemek/g, ' tekrar filtrelemek'],
  [/tekrar filtrelemek istiyor musunuz\?/g, 'tekrar filtrelemek istiyor musunuz?'],
  [/ilani tekrar/g, 'ilanı tekrar'],
  [/>Musteri</g, '>Müşteri<'],
  [/Musteri Yonetimi/g, 'Müşteri Yönetimi'],
  [/Musteri guncellendi/g, 'Müşteri güncellendi'],
  [/Musteri olusturuldu/g, 'Müşteri oluşturuldu'],
  [/Musteri silindi/g, 'Müşteri silindi'],
  [/"Musteri\b/g, '"Müşteri'],
  [/\bMusteri\b/g, 'Müşteri'],
  [/\bGoruntuleme\b/g, 'Görüntüleme'],
  [/\bKarsilastir\b/g, 'Karşılaştır'],
  [/\bKarsilastirma\b/g, 'Karşılaştırma'],
  [/\bYukleniyor\b/g, 'Yükleniyor'],
  [/\bAciklama\b/g, 'Açıklama'],
  [/\bAyrintilar\b/g, 'Ayrıntılar'],
  [/\bBasarili\b/g, 'Başarılı'],
  [/\bBasarisiz\b/g, 'Başarısız'],
  [/\bOlusturuldu\b/g, 'Oluşturuldu'],
  [/\bGuncellendi\b/g, 'Güncellendi'],
  [/\bIptal\b/g, 'İptal'],
  [/\bOnayla\b/g, 'Onayla'],
  [/\bReddet\b/g, 'Reddet'],
  [/\bSil\b/g, 'Sil'],
  [/\bKaydedildi\b/g, 'Kaydedildi'],
  [/\bSecildi\b/g, 'Seçildi'],
  [/\bSecin\b/g, 'Seçin'],
  [/\bKapat\b/g, 'Kapat'],
  [/\bAc\b/g, 'Aç'],
  [/\bKapali\b/g, 'Kapalı'],
  [/\bAcik\b/g, 'Açık'],
  [/\bDurum\b/g, 'Durum'],
  [/\bSatilan\b/g, 'Satılan'],
  [/\bSatildi\b/g, 'Satıldı'],
  [/\bKiralandi\b/g, 'Kiralandı'],
  [/\bIlan silindi\b/g, 'İlan silindi'],
  [/\bIlan onaylandi\b/g, 'İlan onaylandı'],
];

// Çok agresif; sadece string literal ve JSX içinde olmalı — onu riske atmayalım
// Sadece dosyada görülebilir yerlere uygulayan daha dikkatli yaklaşım kullanalım
// Bu script sadece UI literal metinler için tasarlandı

const SAFE_REPLACEMENTS = [
  // JSX content
  [/>Tum Sehirler</g, '>Tüm Şehirler<'],
  [/>Tum Kategoriler</g, '>Tüm Kategoriler<'],
  [/>Tum Tipler</g, '>Tüm Tipler<'],
  [/>Tum Durumlar</g, '>Tüm Durumlar<'],
  // Options label
  [/"Tum Sehirler"/g, '"Tüm Şehirler"'],
  [/"Tum Kategoriler"/g, '"Tüm Kategoriler"'],
  [/"Tum Tipler"/g, '"Tüm Tipler"'],
  [/"Tum Durumlar"/g, '"Tüm Durumlar"'],
  // Common
  [/secildi\b/g, 'seçildi'],
  [/secin\.\.\./g, 'seçin...'],
];

const files = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.isFile() && (p.endsWith('.tsx') || p.endsWith('.ts'))) files.push(p);
  }
}
walk(path.join(__dirname, '..', 'src'));

let changed = 0;
for (const f of files) {
  let c = fs.readFileSync(f, 'utf8');
  const orig = c;
  for (const [from, to] of SAFE_REPLACEMENTS) c = c.replace(from, to);
  if (c !== orig) {
    fs.writeFileSync(f, c, 'utf8');
    console.log('✓', path.relative(path.join(__dirname, '..'), f));
    changed++;
  }
}
console.log(`\n${changed} dosya`);
