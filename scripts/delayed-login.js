// Strateji: Chrome kendi başına Turnstile'ı çözsün, biz sadece form dolduralım
// CDP protokolü ile doğrudan komut göndereceğiz

const puppeteer = require('puppeteer');

(async () => {
  console.log('30 saniye bekleniyor - Chrome\'un Turnstile widget\'ini yuklemesi icin...');
  console.log('(Bu sure icinde Chrome ekraninda Turnstile checkbox gorunmeli)');
  await new Promise(r => setTimeout(r, 30000));

  console.log('Chrome\'a baglaniliyor...');
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
  const [page] = await browser.pages();

  const url = page.url();
  console.log('URL:', url.substring(0, 60));

  // Token kontrol
  const token = await page.evaluate(() => document.querySelector('#cloudflareTurnStileToken')?.value || '');
  console.log('Turnstile token:', token ? 'VAR (' + token.length + ' char)' : 'YOK');

  if (!token) {
    console.log('Turnstile token yok - widget yuklenemedi');
    console.log('RDP ile login sayfasindaki Turnstile checkbox\'i tiklayin');
    browser.disconnect();
    return;
  }

  // Token var - login yap
  await page.focus('#username');
  await page.keyboard.type('musaucucu@gmail.com', { delay: 80 });
  await new Promise(r => setTimeout(r, 500));
  await page.focus('#password');
  await page.keyboard.type('Insanol1996.', { delay: 80 });
  await new Promise(r => setTimeout(r, 500));
  await page.keyboard.press('Enter');
  console.log('Login gonderildi...');
  await new Promise(r => setTimeout(r, 10000));

  const newUrl = page.url();
  console.log('Sonuc:', newUrl.substring(0, 60));
  if (!newUrl.includes('login')) console.log('LOGIN BASARILI!');

  browser.disconnect();
})().catch(e => console.error(e.message));
