const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
  const [page] = await browser.pages();

  console.log('Login sayfasinda...');

  // Cerezleri JS ile kabul et
  await page.evaluate(() => {
    const btn = document.querySelector('#onetrust-accept-btn-handler');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  console.log('Cerezler kabul edildi');

  // Form alanlarını JS ile doldur
  await page.evaluate(() => {
    const u = document.querySelector('#username');
    const p = document.querySelector('#password');
    const r = document.querySelector('#rememberMe');
    if (u) { u.value = ''; u.focus(); }
  });
  await new Promise(r => setTimeout(r, 500));

  // Email yaz (keyboard ile - daha doğal)
  await page.focus('#username');
  await page.keyboard.type('musaucucu@gmail.com', { delay: 90 });
  console.log('Email yazildi');
  await new Promise(r => setTimeout(r, 800));

  // Sifre yaz
  await page.focus('#password');
  await page.keyboard.type('Insanol1996.', { delay: 90 });
  console.log('Sifre yazildi');
  await new Promise(r => setTimeout(r, 1000));

  // Login butonuna JS ile tıkla
  await page.evaluate(() => {
    const btn = document.querySelector('#userLoginSubmitButton');
    if (btn) btn.click();
  });
  console.log('Login butonuna tiklandi...');

  await new Promise(r => setTimeout(r, 10000));

  const url = page.url();
  const body = await page.evaluate(() => document.body.innerText.substring(0, 200));
  console.log('URL:', url.substring(0, 70));

  if (!url.includes('login') && !url.includes('giris')) {
    console.log('LOGIN BASARILI!');
  } else {
    console.log('Body:', body.substring(0, 150));
    // Turnstile token kontrolü
    const token = await page.evaluate(() => {
      const el = document.querySelector('#cloudflareTurnStileToken');
      return el ? el.value : 'yok';
    });
    console.log('Turnstile token:', token ? 'VAR' : 'YOK');
  }

  browser.disconnect();
})().catch(e => console.error(e.message));
