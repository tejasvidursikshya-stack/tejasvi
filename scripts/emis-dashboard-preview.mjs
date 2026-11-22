// Builds build/emis-dashboard-preview.html: the EMIS role dashboards with
// generated sample data, in one self-contained file. No database is used.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = resolve(process.argv[2] || join(root, 'build', 'emis-dashboard-preview.html'));
const entry = join(root, 'modules/emis/preview/dashboard-preview.jsx');
const result = await build({
  root,
  configFile: false,
  plugins: [react()],
  logLevel: 'error',
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: { write: false, emptyOutDir: false, lib: { entry, formats: ['iife'], name: 'TejasviEmisDashboardPreview' }, rolldownOptions: { output: { codeSplitting: false } } },
});
const code = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output).find((e) => e.type === 'chunk').code;
const font = (w) => `@font-face{font-family:Manrope;font-weight:${w};font-style:normal;font-display:swap;src:url(data:font/ttf;base64,${readFileSync(join(root, 'public/assets', `manrope-${w}.ttf`)).toString('base64')}) format("truetype")}`;
const css = [400, 600, 700].map(font).join('') + readFileSync(join(root, 'modules/emis/src/role-home.css'), 'utf8')
  + '*{box-sizing:border-box}body{margin:0;background:#F5F8FB;font-family:Manrope,system-ui,sans-serif}'
  + '.pv-bar{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;padding:12px 24px;background:#fff;border-bottom:1px solid #DCE4EE;color:#0B2440}'
  + '.pv-bar label{display:flex;gap:8px;align-items:center;font-weight:600}.pv-bar select{height:40px;border-radius:10px;border:1px solid #B9C7D6;padding:0 10px;font:600 14px Manrope,sans-serif}'
  + '.pv-main{max-width:1240px;margin:0 auto;padding:24px}.pv-note{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#0B2440;color:#fff;padding:12px 18px;border-radius:12px;font-weight:600;z-index:9}';
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src data:; script-src 'unsafe-inline'; style-src 'unsafe-inline'"><title>EMIS dashboards · preview</title><style>${css}</style></head><body><div id="root"></div><script>${code.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log('EMIS dashboard preview: ' + out);
