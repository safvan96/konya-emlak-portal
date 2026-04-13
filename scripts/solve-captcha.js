const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222' });
  const [page] = await browser.pages();

  console.log('URL:', page.url().substring(0, 70));

  // Elementleri bul
  const buttons = await page.evaluate(() => {
    const els = document.querySelectorAll('button, input[type=submit], iframe, [role=button]');
    return Array.from(els).map(e => ({
      tag: e.tagName,
      text: (e.textContent || '').trim().substring(0, 50),
      id: e.id,
      src: e.tagName === 'IFRAME' ? e.getAttribute('src') || '' : '',
    }));
  });
  console.log('Elementler:', JSON.stringify(buttons, null, 2));

  // Frame'leri listele
  const frames = page.frames();
  console.log('Frame sayisi:', frames.length);
  for (const f of frames) {
    console.log('  Frame:', f.url().substring(0, 80));
  }

  // iframe bul ve tıkla
  const iframes = await page.$$('iframe');
  if (iframes.length > 0) {
    console.log('\nIframe bulundu, basili tutma deneniyor...');
    const box = await iframes[0].boundingBox();
    if (box) {
      // İnsan gibi mouse hareketi
      await page.mouse.move(box.x + 25, box.y + 25, { steps: 15 });
      await new Promise(r => setTimeout(r, 500));
      await page.mouse.down();
      console.log('Mouse basili...');
      await new Promise(r => setTimeout(r, 4000));
      await page.mouse.up();
      console.log('Mouse birakildi, bekleniyor...');
      await new Promise(r => setTimeout(r, 8000));

      const url = page.url();
      const body = await page.evaluate(() => document.body.innerText.substring(0, 150));
      console.log('\nSonuc URL:', url.substring(0, 60));
      console.log('Body:', body.substring(0, 100));

      const ok = !url.includes('olagan') && !body.includes('kontrol') && !body.includes('butona');
      console.log(ok ? '\nCAPTCHA GECILDI!' : '\nCAPTCHA GECILEMEDI');
    }
  } else {
    // Buton dene
    const btn = await page.$('button');
    if (btn) {
      console.log('Buton bulundu, basili tutuluyor...');
      const box = await btn.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width/2, box.y + box.height/2, { steps: 15 });
        await page.mouse.down();
        await new Promise(r => setTimeout(r, 4000));
        await page.mouse.up();
        await new Promise(r => setTimeout(r, 8000));
        const url = page.url();
        console.log('Sonuc:', url.substring(0, 60));
      }
    } else {
      console.log('Ne iframe ne buton bulundu');
    }
  }

  browser.disconnect();
})().catch(e => console.error(e.message));
