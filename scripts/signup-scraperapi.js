const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']});
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

  console.log('ScraperAPI signup...');
  await page.goto('https://dashboard.scraperapi.com/signup', {waitUntil: 'networkidle2', timeout: 30000});
  await new Promise(r => setTimeout(r, 5000));

  await page.type('input[name="email"]', 'musaucucu@gmail.com', {delay: 80});
  await new Promise(r => setTimeout(r, 1000));
  await page.type('input[name="password"]', 'Insanol1996.', {delay: 80});
  await new Promise(r => setTimeout(r, 1000));
  await page.click('#terms');
  await new Promise(r => setTimeout(r, 5000));

  // Turnstile token
  const token = await page.evaluate(() => {
    const el = document.querySelector('[name="turnstile-token"]');
    return el ? el.value : '';
  });
  console.log('Token:', token ? token.substring(0, 30) + '...' : 'YOK');

  // Submit
  try {
    await page.click('button[type="submit"]');
  } catch(e) {
    // Alternatif - tüm butonları dene
    const btns = await page.$$('button');
    for (const btn of btns) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.includes('Sign')) {
        await btn.click();
        break;
      }
    }
  }

  await new Promise(r => setTimeout(r, 10000));

  console.log('URL:', page.url());
  console.log('Title:', await page.title());

  const bodyText = await page.evaluate(() => document.body.innerText);

  // API key ara
  const keyMatch = bodyText.match(/[a-f0-9]{32}/);
  if (keyMatch) {
    console.log('\n=== API KEY BULUNDU ===');
    console.log(keyMatch[0]);
  } else {
    // Dashboard'a yönlendirildiyse key'i orda ara
    if (page.url().includes('dashboard')) {
      console.log('Dashboard açıldı!');
      await page.goto('https://dashboard.scraperapi.com/dashboard', {waitUntil: 'networkidle2', timeout: 15000});
      await new Promise(r => setTimeout(r, 3000));
      const dashText = await page.evaluate(() => document.body.innerText);
      const dashKey = dashText.match(/[a-f0-9]{32}/);
      if (dashKey) {
        console.log('\n=== API KEY ===');
        console.log(dashKey[0]);
      } else {
        console.log('Key bulunamadı. Body:', dashText.substring(0, 500));
      }
    } else {
      console.log('Signup başarısız olabilir. Body:', bodyText.substring(0, 500));
    }
  }

  await browser.close();
})();
