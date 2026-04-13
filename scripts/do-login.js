const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
  const [page] = await browser.pages();

  console.log('Login sayfasında...');

  // Önce çerez kabul et
  const cookieBtn = await page.$('#onetrust-accept-btn-handler');
  if (cookieBtn) {
    await cookieBtn.click();
    console.log('Cerezler kabul edildi');
    await new Promise(r => setTimeout(r, 1000));
  }

  // Username alanına yaz
  await page.click('#username', { clickCount: 3 });
  await new Promise(r => setTimeout(r, 300));
  await page.keyboard.type('musaucucu@gmail.com', { delay: 100 });
  console.log('Email yazildi');

  await new Promise(r => setTimeout(r, 800));

  // Password alanına yaz
  await page.click('#password');
  await new Promise(r => setTimeout(r, 300));
  await page.keyboard.type('Insanol1996.', { delay: 100 });
  console.log('Sifre yazildi');

  await new Promise(r => setTimeout(r, 800));

  // Remember me
  const remember = await page.$('#rememberMe');
  if (remember) {
    await remember.click();
    console.log('Beni hatirla isaretlendi');
  }

  await new Promise(r => setTimeout(r, 1000));

  // Login butonu
  const loginBtn = await page.$('#userLoginSubmitButton');
  if (loginBtn) {
    await loginBtn.click();
    console.log('Login butonuna tiklandi, bekleniyor...');
  }

  await new Promise(r => setTimeout(r, 10000));

  const newUrl = page.url();
  console.log('Sonuc URL:', newUrl.substring(0, 70));

  const body = await page.evaluate(() => document.body.innerText.substring(0, 200));

  if (!newUrl.includes('login') && !newUrl.includes('giris')) {
    console.log('LOGIN BASARILI!');

    // Sahibinden ilanlarına git
    await page.goto('https://www.sahibinden.com/satilik-daire/konya/sahibinden', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 5000));

    const count = await page.evaluate(() => document.querySelectorAll('a.classifiedTitle').length);
    const captcha = (await page.evaluate(() => document.body.innerText.substring(0, 100))).includes('kontrol');
    console.log('Ilan:', count, '| Captcha:', captcha);
  } else {
    console.log('Login basarisiz');
    console.log('Body:', body.substring(0, 150));
  }

  browser.disconnect();
})().catch(e => console.error(e.message));
