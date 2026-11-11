(async () => {
const { chromium } = require('playwright');
const fs = require('node:fs');
const svg = fs.readFileSync('public/icons/icon-v3.svg', 'utf8');
const full = svg.replace('rx="112"', 'rx="0"'); // iOS rounds corners itself
const badge = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"><path d="M20 37l10 10 22-24" fill="none" stroke="#000" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const b = await chromium.launch();
const p = await b.newPage();
for (const [file, size, src, transparent] of [['icon-v3-192.png', 192, full], ['icon-v3-512.png', 512, full], ['apple-touch-icon-v3.png', 180, full], ['badge-72.png', 72, badge, true]]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<style>html,body{margin:0;background:transparent}</style>${src.replace('<svg ', `<svg width="${size}" height="${size}" `)}`);
  await p.screenshot({ path: 'public/icons/' + file, omitBackground: !!transparent });
}
await b.close();
})();
