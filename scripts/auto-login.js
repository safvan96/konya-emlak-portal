// Sahibinden otomatik login
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
  const [page] = await browser.pages();

  console.log('Login sayfasina gidiliyor...');
  await page.goto('https://secure.sahibinden.com/giris', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 3000));

  const url = page.url();
  console.log('URL:', url.substring(0, 60));

  // Captcha kontrolü
  const body = await page.evaluate(() => document.body.innerText.substring(0, 200));
  if (body.includes('kontrol') || body.includes('butona')) {
    console.log('CAPTCHA aktif - login yapilamaz');
    browser.disconnect();
    return;
  }

  // Email alanını bul ve yaz
  const emailInput = await page.$('input[name="username"], input[type="email"], #username');
  if (emailInput) {
    await emailInput.click({ clickCount: 3 }); // Mevcut metni seç
    await new Promise(r => setTimeout(r, 300));
    await page.keyboard.type('musaucucu@gmail.com', { delay: 80 + Math.random() * 40 });
    console.log('Email yazildi');
  } else {
    console.log('Email alani bulunamadi');
    // Sayfadaki input'ları listele
    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).map(i => ({
        type: i.type, name: i.name, id: i.id, placeholder: i.placeholder
      }));
    });
    console.log('Inputlar:', JSON.stringify(inputs));
    browser.disconnect();
    return;
  }

  await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));

  // Şifre alanını bul ve yaz
  const passInput = await page.$('input[name="password"], input[type="password"], #password');
  if (passInput) {
    await passInput.click();
    await new Promise(r => setTimeout(r, 300));
    await page.keyboard.type('Insanol1996.', { delay: 80 + Math.random() * 40 });
    console.log('Sifre yazildi');
  }

  await new Promise(r => setTimeout(r, 1000));

  // Submit butonu
  const submitBtn = await page.$('button[type="submit"], #loginSubmit, .login-button');
  if (submitBtn) {
    await submitBtn.click();
    console.log('Login butonu tiklandi, bekleniyor...');
  } else {
    await page.keyboard.press('Enter');
    console.log('Enter basildi');
  }

  await new Promise(r => setTimeout(r, 8000));

  const newUrl = page.url();
  console.log('Login sonrasi URL:', newUrl.substring(0, 60));

  if (!newUrl.includes('login') && !newUrl.includes('giris')) {
    console.log('LOGIN BASARILI!');
  } else {
    console.log('Login basarisiz olabilir');
    const newBody = await page.evaluate(() => document.body.innerText.substring(0, 200));
    console.log('Body:', newBody.substring(0, 150));
  }

  browser.disconnect();
})().catch(e => console.error(e.message));
