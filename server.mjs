import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Coordinator } from './lib/coordinator.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4310);
let coordinator;
const token = randomBytes(32).toString('hex');
const clients = new Set();
const same = value => typeof value === 'string' && value.length === token.length && timingSafeEqual(Buffer.from(value), Buffer.from(token));
function json(res, status, data) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); }
async function body(req) {
  let text = ''; for await (const chunk of req) { text += chunk; if (text.length > 100000) throw new Error('Request too large.'); }
  return JSON.parse(text || '{}');
}
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'");
  if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) return json(res, 403, { error: 'Invalid host.' });
  if (req.headers.origin && ![`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(req.headers.origin)) return json(res, 403, { error: 'Cross-origin requests are not allowed.' });
  if (req.headers['sec-fetch-site'] === 'cross-site') return json(res, 403, { error: 'Cross-site requests are not allowed.' });
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, { ...coordinator.snapshot(), token });
    if (req.method === 'GET' && url.pathname === '/api/events') {
      if (!same(url.searchParams.get('token'))) return json(res, 403, { error: 'Invalid session.' });
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(`data: ${JSON.stringify(coordinator.snapshot())}\n\n`); clients.add(res);
      const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 20000);
      req.on('close', () => { clearInterval(heartbeat); clients.delete(res); }); return;
    }
    if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
      if (!same(req.headers['x-coordinator-token'])) return json(res, 403, { error: 'Invalid session. Reload the app.' });
      const input = await body(req); let result;
      if (url.pathname === '/api/projects') result = coordinator.project(input);
      else if (url.pathname === '/api/tasks') result = coordinator.task(input);
      else if (url.pathname === '/api/policies') result = coordinator.policies(input);
      else if (url.pathname === '/api/demo') result = coordinator.demo();
      else if (/^\/api\/tasks\/[^/]+\/actions$/.test(url.pathname)) result = coordinator.action(url.pathname.split('/')[3], input.action);
      else return json(res, 404, { error: 'Route not found.' });
      return json(res, 200, { result, state: coordinator.snapshot() });
    }
    const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
    const file = files[url.pathname];
    if (req.method === 'GET' && file) { res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-cache' }); return res.end(readFileSync(path.join(root, 'public', file[0]))); }
    json(res, 404, { error: 'Not found.' });
  } catch (e) { json(res, 400, { error: e.message }); }
});
// Bind before opening storage, so a second launch cannot reset the running queue.
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Open the existing Relay instance or choose another PORT and COORDINATOR_DATA.` : error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => {
  coordinator = new Coordinator({ directory: process.env.COORDINATOR_DATA || path.join(root, 'data') });
  coordinator.on('change', state => { for (const res of clients) res.write(`data: ${JSON.stringify(state)}\n\n`); });
  console.log(`Agent Coordinator is running at http://127.0.0.1:${port}\nData: ${coordinator.directory}\nDispatch starts paused. Open the dashboard to resume.`);
});
function shutdown() { coordinator?.close(); for (const c of clients) c.end(); server.close(); setTimeout(() => process.exit(), 5000).unref(); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
