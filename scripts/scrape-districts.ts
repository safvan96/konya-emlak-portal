import { prisma } from "../src/lib/prisma";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9",
};

const KONYA_DISTRICTS = [
  "selcuklu", "meram", "karatay", "beysehir", "aksehir", "eregli",
  "seydisehir", "cihanbeyli", "cumra", "ilgin", "kulu", "bozkir",
  "hadim", "sarayonu", "derebucak", "emirgazi", "akoren", "halkapinar",
  "altinekin", "tuzlukcu", "yunak", "kadinhani", "doganhisar", "huyuk",
  "guneysinir", "taskent", "ahirli", "yalihuyuk", "derbent", "celtik",
];

const CATEGORIES = ["konut", "daire", "mustakil-ev", "arsa", "villa", "kooperatif", "ofis"];

function normalize(text: string): string {
  const map: Record<string, string> = {"ç":"c","ğ":"g","ı":"i","ö":"o","ş":"s","ü":"u","Ç":"c","Ğ":"g","İ":"i","Ö":"o","Ş":"s","Ü":"u"};
  return text.replace(/[^\x00-\x7F]/g, c => map[c] || "").toLowerCase();
}

const AGENT_WORDS = ["emlak","gayrimenkul","remax","century","coldwell","turyap","danışman","broker","ofisimiz","portföy","franchise"];

function isAgent(text: string): boolean {
  const n = normalize(text.replace(/Emlakjet\s*-\s*#\d+/gi, ""));
  return AGENT_WORDS.some(w => n.includes(normalize(w)));
}

function delay(ms = 2000): Promise<void> {
  return new Promise(r => setTimeout(r, ms + Math.random() * 2000));
}

function parseListPage(html: string): string[] {
  const urls: string[] = [];
  const re = /href="(\/ilan\/[^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!urls.includes(m[1])) urls.push(m[1]);
  }
  return urls;
}

function parseDetail(html: string) {
  const fields: Record<string, string> = {};
  const re = /"(\w+)"\s*:\s*"([^"]{1,1000})"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!fields[m[1]]) fields[m[1]] = m[2];
  }

  const titleMatch = html.match(/<title>([^<]+)/);
  let originalTitle = titleMatch ? titleMatch[1].replace(/\s*\|.*$/, "").replace(/\s*#\d+$/, "").replace(/^Emlakjet\s*-?\s*/i, "").trim() : "";

  let title = originalTitle.replace(/&amp;/g, "&").replace(/\s+[\d,.]+\s*TL\s*$/i, "");
  const cities = ["Konya"];
  for (const cn of cities) { const idx = title.indexOf(cn); if (idx > 0) { title = title.substring(idx); break; } }
  for (const cn of cities) title = title.replace(new RegExp(`^${cn}\\s+`), "");
  title = title.replace(/\s+Oda\s+/g, " ").replace(/Mahallesi/g, "Mah.").replace(/\s+/g, " ").trim();

  const desc = fields.description || "";
  const price = fields.price ? parseInt(fields.price.replace(/[^0-9]/g, "")) : null;
  const district = fields.district?.replace(/-/g, " ") || null;
  const neighborhood = fields.neighborhood?.replace(/-/g, " ") || null;
  const roomMatch = (title + " " + desc).match(/(\d\+[12])/);
  const sqmMatch = (title + " " + desc).match(/(\d+)\s*m²/i);

  const imageUrls: string[] = [];
  const imgRe = /https:\/\/imaj\.emlakjet\.com\/listing\/[^"'\s<>]+/g;
  while ((m = imgRe.exec(html)) !== null) { if (!imageUrls.includes(m[0])) imageUrls.push(m[0]); }

  const phoneMatch = html.match(/"telephone"\s*:\s*"(\d{10,11})"/);
  let phone = phoneMatch ? phoneMatch[1] : null;
  if (phone && phone.length === 10 && !phone.startsWith("0")) phone = "0" + phone;

  let sellerName = "Sahibinden";
  const nameMatch = desc.match(/^([^,]+?)(?:\s+\w+\s+Mah)/);
  if (nameMatch && nameMatch[1].length < 40) sellerName = nameMatch[1].trim();
  if (sellerName.toLowerCase() === "sahibinden") sellerName = "Sahibinden";

  return { title, originalTitle, desc, price, district, neighborhood,
    roomCount: roomMatch?.[1] || null, squareMeters: sqmMatch ? parseInt(sqmMatch[1]) : null,
    imageUrls: imageUrls.slice(0, 20), phone, sellerName };
}

async function main() {
  console.log("=== İlçe Bazlı Scraping - Tüm Konya ===\n");

  const city = await prisma.city.findUnique({ where: { slug: "konya" } });
  if (!city) process.exit(1);

  let totalNew = 0, totalDup = 0, totalRed = 0;

  for (const type of ["satilik", "kiralik"]) {
    for (const cat of CATEGORIES) {
      for (const dist of KONYA_DISTRICTS) {
        const url = `https://www.emlakjet.com/${type}-${cat}/konya-${dist}`;
        try {
          const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
          if (!resp.ok) continue;
          const html = await resp.text();
          const links = parseListPage(html);
          if (links.length === 0) continue;

          console.log(`${type}-${cat}/konya-${dist}: ${links.length} ilan`);

          for (const link of links) {
            const idMatch = link.match(/(\d+)(?:\/?$)/);
            if (!idMatch) continue;
            const ejId = `EJ${idMatch[1]}`;

            const existing = await prisma.listing.findUnique({ where: { sahibindenId: ejId } });
            if (existing) { totalDup++; continue; }

            await delay(1500);
            try {
              const detResp = await fetch(`https://www.emlakjet.com${link}`, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
              if (!detResp.ok) continue;
              const detHtml = await detResp.text();
              const d = parseDetail(detHtml);
              if (!d.title) continue;

              const listingType = type === "satilik" ? "SALE" as const : "RENT" as const;
              const owner = !isAgent(d.originalTitle + " " + d.desc + " " + d.sellerName);

              const catSlug = normalize(d.title).includes("arsa") ? "arsa" :
                normalize(d.title).includes("villa") ? "villa" :
                normalize(d.title).includes("mustakil") ? "mustakil-ev" :
                normalize(d.title).includes("ofis") ? "ofis" : "daire";
              const dbCat = await prisma.category.findUnique({ where: { slug: catSlug } });

              await prisma.listing.create({
                data: {
                  sahibindenId: ejId, title: d.title, description: d.desc.substring(0, 5000),
                  price: d.price, currency: "TL", listingType,
                  location: ["Konya", d.district, d.neighborhood].filter(Boolean).join(", "),
                  district: d.district, neighborhood: d.neighborhood,
                  roomCount: d.roomCount, squareMeters: d.squareMeters,
                  imageUrls: d.imageUrls, sourceUrl: `https://www.emlakjet.com${link}`,
                  sellerName: d.sellerName, sellerPhone: d.phone,
                  isFromOwner: owner, status: "ACTIVE",
                  cityId: city.id, categoryId: dbCat?.id || null,
                },
              });

              totalNew++;
              if (owner) console.log(`  ✓ ${d.title.substring(0, 50)} | ${d.price?.toLocaleString("tr-TR")} TL`);
              else totalRed++;
            } catch { /* skip */ }
          }
        } catch { /* skip */ }
      }
    }
  }

  console.log(`\n=== SONUÇ: ${totalNew} yeni | ${totalDup} dup | ${totalRed} emlakçı ===`);
  const total = await prisma.listing.count();
  console.log(`DB toplam: ${total}`);

  await prisma.$disconnect();
  process.exit(0);
}

main();
