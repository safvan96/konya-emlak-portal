const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
  const [page] = await browser.pages();

  console.log('URL:', page.url().substring(0, 70));

  // PerimeterX iframe bul
  const iframes = await page.$$('iframe');
  console.log('iframe sayisi:', iframes.length);

  for (const iframe of iframes) {
    const src = await iframe.evaluate(el => el.src || '');
    if (src.includes('px-cloud')) {
      console.log('PX iframe bulundu');
      const box = await iframe.boundingBox();
      if (box) {
        console.log('Box:', JSON.stringify(box));
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        // İnsan gibi mouse hareketi + basılı tutma
        await page.mouse.move(cx - 50, cy - 30, { steps: 5 });
        await new Promise(r => setTimeout(r, 200));
        await page.mouse.move(cx, cy, { steps: 15 });
        await new Promise(r => setTimeout(r, 300));
        await page.mouse.down();
        console.log('Basili tutuluyor (5sn)...');
        await new Promise(r => setTimeout(r, 5000));
        await page.mouse.up();
        console.log('Birakildi, bekleniyor...');
        await new Promise(r => setTimeout(r, 8000));
        break;
      }
    }
  }

  const url = page.url();
  const body = await page.evaluate(() => document.body.innerText.substring(0, 200));
  const ok = !body.includes('kontrol') && !body.includes('butona') && !url.includes('olagan');
  console.log('\nURL:', url.substring(0, 60));
  console.log('Body:', body.substring(0, 100));
  console.log(ok ? 'CAPTCHA GECILDI!' : 'CAPTCHA GECILEMEDI - RDP ile elle geçmeniz gerekiyor');

  browser.disconnect();
})().catch(e => console.error(e.message));
