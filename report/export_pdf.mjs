import { chromium } from '../Frontend-React/node_modules/@playwright/test/index.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(join(root, 'ML_MINI_PROJECT_REPORT.html')).href, { waitUntil: 'load' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, image => image.decode()));
    const broken = Array.from(document.images).filter(image => !image.naturalWidth);
    if (broken.length) throw new Error('Some report images did not load.');
  });
  await page.emulateMedia({ media: 'print' });
  const output = join(root, 'ML_MINI_PROJECT_REPORT.pdf');
  await page.pdf({
    path: output, format: 'A4', printBackground: true,
    margin: { top: '18mm', right: '18mm', bottom: '20mm', left: '18mm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="width:100%;font:8px Arial;color:#777;padding:0 18mm;display:flex;justify-content:space-between"><span>Frame | Machine Learning Mini Project Report</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
    tagged: true, outline: true,
  });
  console.log(`Created PDF: ${output}`);
} finally {
  await browser.close();
}
