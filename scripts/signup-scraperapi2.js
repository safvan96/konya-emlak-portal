const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']});
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

  // Önce login dene - belki hesap zaten var
  console.log('ScraperAPI login deneniyor...');
  await page.goto('https://dashboard.scraperapi.com/login', {waitUntil: 'networkidle2', timeout: 30000});
  await new Promise(r => setTimeout(r, 3000));

  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(i => ({type: i.type, name: i.name, placeholder: i.placeholder}));
  });
  console.log('Login inputs:', inputs.filter(i => i.type !== 'hidden').map(i => i.name || i.type));

  // Email + password ile login dene
  await page.type('input[name="email"], input[type="email"]', 'musaucucu@gmail.com', {delay: 50});
  await new Promise(r => setTimeout(r, 500));
  await page.type('input[name="password"], input[type="password"]', 'Insanol1996.', {delay: 50});
  await new Promise(r => setTimeout(r, 3000));

  // Turnstile bekle
  for (let i = 0; i < 5; i++) {
    const token = await page.evaluate(() => {
      const el = document.querySelector('[name="turnstile-token"]');
      return el ? el.value : '';
    });
    if (token) { console.log('Turnstile OK'); break; }
    await new Promise(r => setTimeout(r, 2000));
  }

  // Submit
  await page.click('button[type="submit"]').catch(() => {});
  await new Promise(r => setTimeout(r, 10000));

  const url = page.url();
  console.log('URL:', url);

  if (url.includes('dashboard')) {
    console.log('Login başarılı! API key aranıyor...');
    // Dashboard'da key ara
    const text = await page.evaluate(() => document.body.innerText);
    const keyMatch = text.match(/[a-f0-9]{32}/);
    if (keyMatch) {
      console.log('\n=== SCRAPER API KEY ===');
      console.log(keyMatch[0]);
      console.log('========================\n');
    } else {
      // API sayfasına git
      await page.goto('https://dashboard.scraperapi.com/dashboard', {waitUntil: 'networkidle2', timeout: 15000});
      await new Promise(r => setTimeout(r, 3000));
      const dashText = await page.evaluate(() => document.body.innerText);
      const dashKey = dashText.match(/[a-f0-9]{32}/);
      if (dashKey) {
        console.log('\n=== SCRAPER API KEY ===');
        console.log(dashKey[0]);
        console.log('========================\n');
      } else {
        console.log('Dashboard text:', dashText.substring(0, 800));
      }
    }
  } else {
    console.log('Login başarısız.');
    const text = await page.evaluate(() => document.body.innerText.substring(0, 300));
    console.log('Page:', text);
  }

  await browser.close();
})();
