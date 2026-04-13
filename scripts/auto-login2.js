const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
  const [page] = await browser.pages();

  // Zaten login sayfasındayız, email/şifre yazılmış
  // Enter'a bas
  console.log('URL:', page.url().substring(0, 60));

  // Şifre alanına focus
  const passInput = await page.$('input[type="password"]');
  if (passInput) {
    await passInput.click();
    await new Promise(r => setTimeout(r, 500));
  }

  // Enter
  await page.keyboard.press('Enter');
  console.log('Enter basildi, bekleniyor...');

  await new Promise(r => setTimeout(r, 10000));

  const newUrl = page.url();
  const body = await page.evaluate(() => document.body.innerText.substring(0, 200));
  console.log('URL:', newUrl.substring(0, 70));
  console.log('Body:', body.substring(0, 150));

  if (!newUrl.includes('login') && !newUrl.includes('giris')) {
    console.log('\nLOGIN BASARILI!');

    // Sahibinden ilanlarına git
    await page.goto('https://www.sahibinden.com/satilik-daire/konya/sahibinden', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 5000));

    const count = await page.evaluate(() => document.querySelectorAll('a.classifiedTitle').length);
    console.log('Ilan sayisi:', count);
  } else {
    console.log('\nLogin basarisiz veya captcha var');
  }

  browser.disconnect();
})().catch(e => console.error(e.message));
