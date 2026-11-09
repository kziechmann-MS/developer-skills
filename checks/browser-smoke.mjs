import { createServer } from 'node:http';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const candidates = process.env.CHROME_PATH ? [process.env.CHROME_PATH] : [
  join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
let chrome;
for (const candidate of candidates) {
  try { await access(candidate); chrome = candidate; break; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
if (!chrome) throw new Error('Chrome not found. Set CHROME_PATH to an installed executable; no browser is installed by this check.');

const definitions = [
  ['/', './browser.html', 'text/html'],
  ['/browser-cases.mjs', './browser-cases.mjs', 'text/javascript'],
  ['/event-board.mjs', '../api-to-ui-feature-integration/examples/event-board.mjs', 'text/javascript'],
  ['/event-planner.mjs', '../generative-ui-development/examples/event-planner.mjs', 'text/javascript'],
];
const routes = new Map(await Promise.all(definitions.map(async ([route, path, type]) =>
  [route, { body: await readFile(new URL(path, import.meta.url)), type }])));
const server = createServer((request, response) => {
  const route = routes.get(request.url);
  if (!route || request.method !== 'GET') {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': `${route.type}; charset=utf-8`,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'",
    'Cache-Control': 'no-store',
  });
  response.end(route.body);
});

let profile;
let child;
let timer;
try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  profile = await mkdtemp(join(tmpdir(), 'developer-skills-browser-'));
  const url = `http://127.0.0.1:${server.address().port}/`;
  child = spawn(chrome, [
    '--headless=new', '--disable-gpu', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--disable-extensions',
    '--metrics-recording-only', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${profile}`, '--dump-dom', '--virtual-time-budget=2000', url,
  ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let html = '';
  let stderr = '';
  child.stdout.on('data', data => {
    html += data;
    if (html.length > 2_000_000) child.kill();
  });
  child.stderr.on('data', data => { stderr = (stderr + data).slice(-8000); });
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
    timer = setTimeout(() => {
      child.kill();
      reject(new Error('Browser check timed out after 15 seconds.'));
    }, 15_000);
  });
  if (code !== 0) throw new Error(`Chrome exited with ${code}: ${stderr}`);
  const match = html.match(/<pre id="result">([\s\S]*?)<\/pre>/);
  if (!match || match[1] === 'pending') throw new Error('Browser did not finish the fixture module.');
  const decoded = match[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const result = JSON.parse(decoded);
  if (result.status !== 'passed' || !Array.isArray(result.checks) || result.checks.length !== 14) {
    throw new Error(`Browser fixture failed or omitted checks: ${JSON.stringify(result)}`);
  }
  console.log(JSON.stringify({ browser: 'Chrome headless', ...result }, null, 2));
} finally {
  clearTimeout(timer);
  if (child && child.exitCode === null && child.signalCode === null) {
    const closed = new Promise(resolve => child.once('close', resolve));
    child.kill();
    await closed;
  }
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
