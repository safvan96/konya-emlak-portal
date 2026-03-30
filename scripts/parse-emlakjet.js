const fs = require('fs');
const html = fs.readFileSync(process.env.USERPROFILE + '/ej_detail.html', 'utf8');

// Tüm JSON key-value çiftlerini çıkar
const all = {};
const re = /"(\w+)"\s*:\s*"([^"]{1,500})"/g;
let m;
while ((m = re.exec(html)) !== null) {
  if (!all[m[1]]) all[m[1]] = m[2];
}

// İlgili alanları filtrele
const keywords = ['price','title','description','room','square','meter','age','floor',
  'district','neighbor','city','seller','owner','image','photo','address','name','type','category','status'];

const keys = Object.keys(all).filter(k =>
  keywords.some(w => k.toLowerCase().includes(w))
);

console.log("=== Emlakjet İlan Verileri ===");
keys.forEach(k => console.log(`${k}: ${all[k].substring(0, 150)}`));

// Liste sayfasındaki ilanları da parse et
const listHtml = fs.readFileSync(process.env.USERPROFILE + '/emlakjet.html', 'utf8');
const listings = [];
const hrefRe = /href="(\/ilan\/[^"]+)"/g;
while ((m = hrefRe.exec(listHtml)) !== null) {
  if (!listings.includes(m[1])) listings.push(m[1]);
}
console.log(`\n=== Liste Sayfası: ${listings.length} ilan ===`);
listings.slice(0, 5).forEach(l => console.log(`  ${l}`));
