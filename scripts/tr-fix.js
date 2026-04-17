// Türkçe karakter düzeltme script'i
// Admin ve müşteri sayfalarındaki bozuk Türkçe karakterleri düzeltir
const fs = require('fs');
const path = require('path');

// Tüm JSX/TSX'teki string literal içindeki bozuk karakter düzeltmeleri
// Kod identifier'larına dokunmaz (sadece görünür metinleri düzeltir)
const REPLACEMENTS = [
  [/>Yukleniyor\.\.\.</g, ">Yükleniyor...<"],
  [/>Musteri Yonetimi</g, ">Müşteri Yönetimi<"],
  [/>Musteri guncellendi</g, ">Müşteri güncellendi<"],
  [/>Musteri olusturuldu</g, ">Müşteri oluşturuldu<"],
  [/>Musteri bulunamadi</g, ">Müşteri bulunamadı<"],
  [/>Atanmis Ilan</g, ">Atanmış İlan<"],
  [/>Iptal</g, ">İptal<"],
  [/>Yeni Musteri</g, ">Yeni Müşteri<"],
  [/>Ilan onaylandi</g, ">İlan onaylandı<"],
  [/>Ilan reddedildi</g, ">İlan reddedildi<"],
  [/>Ilan silindi</g, ">İlan silindi<"],
  [/>Ilan Inceleme</g, ">İlan İnceleme<"],
  [/>Ilan Raporu</g, ">İlan Raporu<"],
  [/>Musteri Raporu</g, ">Müşteri Raporu<"],
  [/>Yeni Ilan</g, ">Yeni İlan<"],
  [/>Yeni Musteri</g, ">Yeni Müşteri<"],
  [/>Aktif Ilan</g, ">Aktif İlan<"],
  [/>Ilce Haritasi</g, ">İlçe Haritası<"],
  [/>Ilce Ortalama/g, ">İlçe Ortalama"],
  [/>Sehir Bazli/g, ">Şehir Bazlı"],
  [/>Sehir Fiyat Karsilastirmasi/g, ">Şehir Fiyat Karşılaştırması"],
  [/>Sehir</g, ">Şehir<"],
  [/>Ilce</g, ">İlçe<"],
  [/>Ilan</g, ">İlan<"],
  [/>Musteri</g, ">Müşteri<"],
  [/>Goruntuleme</g, ">Görüntüleme<"],
  [/>Guncelleme</g, ">Güncelleme<"],
  [/>Duzenle</g, ">Düzenle<"],
  [/"Satilik"/g, '"Satılık"'],
  [/"Kiralik"/g, '"Kiralık"'],
  [/"Hepsi"/g, '"Hepsi"'],
  [/>Satilik</g, ">Satılık<"],
  [/>Kiralik</g, ">Kiralık<"],
  [/>Tumunu</g, ">Tümünü<"],
  [/>Tumu</g, ">Tümü<"],
  [/Musteri secin\.\.\./g, "Müşteri seçin..."],
  [/Ilan Ata"/g, 'İlan Ata"'],
  [/>Goruntuleme Gecmisi</g, ">Görüntüleme Geçmişi<"],
  [/"Ilan goruntulendi: "/g, '"İlan görüntülendi: "'],
  [/\? "Satilik" : "Kiralik"/g, '? "Satılık" : "Kiralık"'],
  [/\? "Satilik" : preferences/g, '? "Satılık" : preferences'],
  [/\? "Kiralik" : "Hepsi"/g, '? "Kiralık" : "Hepsi"'],
  [/"Giris"/g, '"Giriş"'],
  [/"Cikis"/g, '"Çıkış"'],
  [/"Ilan Goruntuleme"/g, '"İlan Görüntüleme"'],
  [/\/\/ Ilce bazli gruplama/g, "// İlçe bazlı gruplama"],
  [/\/\/ Sehirler/g, "// Şehirler"],
  [/\/\/ Sehir Bazli/g, "// Şehir Bazlı"],
  [/\/\/ Sehir Fiyat/g, "// Şehir Fiyat"],
  [/\/\/ Ilce Fiyat/g, "// İlçe Fiyat"],
];

function walk(dir, callback) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, callback);
    else if (entry.isFile() && (p.endsWith('.tsx') || p.endsWith('.ts'))) callback(p);
  }
}

let totalChanged = 0;
let fileCount = 0;
walk(path.join(__dirname, '..', 'src'), (file) => {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;
  for (const [from, to] of REPLACEMENTS) {
    content = content.replace(from, to);
  }
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    const rel = path.relative(path.join(__dirname, '..'), file);
    console.log(`✓ ${rel}`);
    fileCount++;
    // Değişen replace sayısı
    const diff = (original.match(/./g)?.length || 0) - (content.match(/./g)?.length || 0);
    totalChanged++;
  }
});

console.log(`\n${fileCount} dosya güncellendi`);
