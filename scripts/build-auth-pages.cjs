const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

// Exact static entry points also work on GitHub Pages without SPA rewrites.
const routes = ['auth/callback', 'auth/error', 'auth/verified', 'reset-password', 'settings/accounts'];
const build = join(__dirname, '..', 'build');
const manifest = JSON.parse(readFileSync(join(build, 'asset-manifest.json'), 'utf8'));
const script = manifest.files['main.js'];
const base = script.slice(0, script.indexOf('static/'));
const href = base === './' || base === '' ? '/' : base;
const html = readFileSync(join(build, 'index.html'), 'utf8').replace('<head>', `<head><meta name="robots" content="noindex, nofollow"><base href="${href.replace(/"/g, '&quot;')}">`);
for (const route of routes) {
  const target = join(build, route);
  mkdirSync(target, { recursive: true });
  writeFileSync(join(target, 'index.html'), html);
}
console.log(`Prepared ${routes.length} static auth entry points.`);
