// Mevcut Chrome'da PerimeterX captcha'yı geçmeye çalış
// Farklı yaklaşım: sayfayı yenileyip, mouse ile doğal hareket + tıklama

const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
  const [page] = await browser.pages();

  console.log('Mevcut URL:', page.url().substring(0, 60));

  // Önce about:blank'e git, sonra farklı bir sahibinden URL'si dene
  await page.goto('about:blank');
  await new Promise(r => setTimeout(r, 2000));

  // Google'dan sahibinden'e git - doğal referrer ile
  await page.goto('https://www.google.com/search?q=sahibinden+konya+satilik+daire', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));

  console.log('Google arama sayfasi:', page.url().substring(0, 50));

  // Google'da scroll yap
  await page.mouse.move(400, 300, { steps: 10 });
  await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
  await new Promise(r => setTimeout(r, 2000));

  // Sahibinden linkini bul ve tıkla
  const sbLink = await page.evaluate(() => {
    const links = document.querySelectorAll('a');
    for (const a of links) {
      if (a.href && a.href.includes('sahibinden.com') && a.href.includes('konya')) {
        return a.href;
      }
    }
    return null;
  });

  if (sbLink) {
    console.log('Sahibinden linki bulundu:', sbLink.substring(0, 60));
    await page.goto(sbLink, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  } else {
    console.log('Google sonuçlarında sahibinden linki bulunamadı, direkt gidiliyor...');
    await page.goto('https://www.sahibinden.com', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  }

  await new Promise(r => setTimeout(r, 5000));

  const url = page.url();
  const body = await page.evaluate(() => document.body.innerText.substring(0, 200));
  const hasCaptcha = body.includes('kontrol') || body.includes('butona');
  const count = await page.evaluate(() => document.querySelectorAll('a.classifiedTitle').length);

  console.log('\nSonuc URL:', url.substring(0, 60));
  console.log('Captcha:', hasCaptcha);
  console.log('Ilan:', count);

  if (!hasCaptcha && count > 0) {
    console.log('\nBASARILI! Ilanlar gorunuyor.');
  } else if (hasCaptcha) {
    console.log('\nPerimeterX captcha hala aktif - IP bazli engel');
    console.log('RDP ile manuel gecis gerekli');
  } else {
    console.log('\nBody:', body.substring(0, 150));
  }

  browser.disconnect();
})().catch(e => console.error(e.message));
