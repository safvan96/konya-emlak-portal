const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
  const [page] = await browser.pages();

  await page.goto('https://secure.sahibinden.com/giris', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 3000));

  console.log('URL:', page.url().substring(0, 70));
  console.log('Title:', (await page.title()).substring(0, 50));

  // Tüm form elemanlarını listele
  const formInfo = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
      type: i.type, name: i.name, id: i.id, placeholder: i.placeholder, value: i.value
    }));
    const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
      type: b.type, text: b.textContent.trim().substring(0, 30), id: b.id, cls: b.className.substring(0, 50)
    }));
    const forms = Array.from(document.querySelectorAll('form')).map(f => ({
      action: f.action.substring(0, 50), method: f.method, id: f.id
    }));
    return { inputs, buttons, forms };
  });

  console.log('\nInputlar:', JSON.stringify(formInfo.inputs, null, 2));
  console.log('\nButonlar:', JSON.stringify(formInfo.buttons, null, 2));
  console.log('\nFormlar:', JSON.stringify(formInfo.forms, null, 2));

  // Body text
  const body = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('\nBody:', body.substring(0, 300));

  browser.disconnect();
})().catch(e => console.error(e.message));
