const fs = require('fs');
const path = require('path');

const patterns = [
  /\bYonetim\b/, /\bGiris\b/, /\bCikis\b/, /\bSifre\b/, /\bIptal\b/,
  /\bGunluk\b/, /\bOlustur\b/, /\bDuzenle\b/, /\bGuncel/, /\bSecim\b/,
  /\bMustakil\b/, /\bKullanici\b/, /\bSahibinden'/, /\bOnayla\b/,
  /\bReddet\b/, /\bIptal et\b/, /\bIslem\b/, /\bTamam\b/, /\bSec\b/,
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

let total = 0;
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  const lines = c.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const p of patterns) {
      if (p.test(lines[i])) {
        const rel = path.relative(path.join(__dirname, '..'), f).replace(/\\/g, '/');
        console.log(`${rel}:${i+1}: ${lines[i].trim().substring(0, 120)}`);
        total++;
        break;
      }
    }
  }
}
console.log(`\n${total} satır bulundu`);
