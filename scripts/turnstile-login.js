// Turnstile widget'ını bekleyip login yap
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
  const [page] = await browser.pages();

  console.log('URL:', page.url().substring(0, 60));

  // Cerez kabul
  await page.evaluate(() => {
    const b = document.querySelector('#onetrust-accept-btn-handler');
    if(b) b.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  // Turnstile iframe bekle (30 sn)
  console.log('Turnstile widget bekleniyor...');
  let turnstileFound = false;
  for (let i = 0; i < 30; i++) {
    const frames = page.frames();
    for (const f of frames) {
      if (f.url().includes('turnstile') || f.url().includes('cloudflare')) {
        console.log('Turnstile iframe bulundu:', f.url().substring(0, 60));
        turnstileFound = true;
        break;
      }
    }
    if (turnstileFound) break;

    // Token kontrol
    const token = await page.evaluate(() => {
      const el = document.querySelector('#cloudflareTurnStileToken');
      return el?.value || '';
    });
    if (token) {
      console.log('Token zaten var!');
      turnstileFound = true;
      break;
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  if (!turnstileFound) {
    console.log('Turnstile bulunamadi, yine de login deneniyor...');
  }

  // Email + sifre yaz
  const usernameEl = await page.$('#username');
  if (!usernameEl) {
    console.log('Username alani yok!');
    browser.disconnect();
    return;
  }

  await usernameEl.click({ clickCount: 3 });
  await page.keyboard.type('musaucucu@gmail.com', { delay: 100 });
  console.log('Email yazildi');
  await new Promise(r => setTimeout(r, 800));

  await page.click('#password');
  await page.keyboard.type('Insanol1996.', { delay: 100 });
  console.log('Sifre yazildi');
  await new Promise(r => setTimeout(r, 1000));

  // Remember me
  const rememberEl = await page.$('#rememberMe');
  if (rememberEl) {
    const checked = await page.evaluate(() => document.querySelector('#rememberMe').checked);
    if (!checked) await rememberEl.click();
  }
  await new Promise(r => setTimeout(r, 500));

  // Token kontrol
  const tokenBefore = await page.evaluate(() => {
    return document.querySelector('#cloudflareTurnStileToken')?.value || '';
  });
  console.log('Token before submit:', tokenBefore ? 'VAR (' + tokenBefore.substring(0, 20) + '...)' : 'YOK');

  // Enter ile submit (buton yerine)
  await page.keyboard.press('Enter');
  console.log('Enter basildi...');

  // Sayfa değişimini bekle
  await new Promise(r => setTimeout(r, 10000));

  const newUrl = page.url();
  console.log('Sonuc URL:', newUrl.substring(0, 70));

  if (newUrl.includes('iki-asamali')) {
    console.log('2FA ISTIYOR - email kodu lazim');
  } else if (!newUrl.includes('login') && !newUrl.includes('giris')) {
    console.log('LOGIN BASARILI!');
  } else {
    console.log('Login basarisiz');
    const body = await page.evaluate(() => document.body.innerText.substring(0, 150));
    console.log('Body:', body.substring(0, 100));
  }

  browser.disconnect();
})().catch(e => console.error(e.message));
