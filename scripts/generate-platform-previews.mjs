import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));

(async () => {
  const root = path.resolve(scriptDirectory, '..');
  const temporaryRoot = path.join(root, '.tmp');
  await fs.mkdir(temporaryRoot, { recursive: true });
  const temporary = await fs.mkdtemp(path.join(temporaryRoot, 'platform-previews-'));
  const output = path.join(root, 'public', 'product-previews');
  let browser;
  try {
    const bundle = path.join(temporary, 'scenes.cjs');
    await build({ entryPoints: [path.join(scriptDirectory, 'assets', 'platform-scenes.tsx')], outfile: bundle, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react-dom', 'react/jsx-runtime'] });
    const { default: sceneModule } = await import(pathToFileURL(bundle).href);
    const { PlatformScene } = sceneModule;
    const css = await fs.readFile(path.join(scriptDirectory, 'assets', 'platform-scenes.css'), 'utf8');
    await fs.mkdir(output, { recursive: true });
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
    for (const kind of ['meeting', 'event', 'networking', 'organizer']) {
      const markup = renderToStaticMarkup(React.createElement(PlatformScene, { kind }));
      await page.setContent(`<!doctype html><html lang="pt-BR"><head><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Zalando+Sans+Expanded:wght@500;700;800&display=swap" rel="stylesheet"><style>${css}</style></head><body>${markup}</body></html>`);
      await page.evaluate(() => document.fonts.ready);
      const screenshot = await page.locator('.demo-screen').screenshot();
      await sharp(screenshot).webp({ quality: 88 }).toFile(path.join(output, `${kind}.webp`));
      console.log(`${kind}.webp generated`);
    }
  } finally {
    if (browser) await browser.close();
    if (path.dirname(path.resolve(temporary)) !== temporaryRoot || !path.basename(temporary).startsWith('platform-previews-')) throw new Error('Unexpected temporary build path');
    await fs.rm(temporary, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
