import assert from 'node:assert/strict';
const base = process.env.RELAY_URL || 'http://127.0.0.1:4310';
const state = await fetch(base + '/api/state'); assert.equal(state.status, 200);
const data = await state.json(); assert.equal(typeof data.token, 'string');
const checks = [
  ['mutation without token', '/api/projects', { method: 'POST', body: '{}' }, 403],
  ['cross-origin read', '/api/state', { headers: { Origin: 'https://example.invalid' } }, 403],
  ['cross-origin mutation', '/api/projects', { method: 'POST', headers: { Origin: 'https://example.invalid', 'X-Coordinator-Token': data.token }, body: '{}' }, 403],
  ['invalid authenticated task', '/api/tasks', { method: 'POST', headers: { 'X-Coordinator-Token': data.token }, body: '{}' }, 400],
  ['events without token', '/api/events', {}, 403],
  ['unknown file', '/state.json', {}, 404],
  ['dashboard', '/', {}, 200],
  ['stylesheet', '/style.css', {}, 200],
  ['JavaScript', '/app.js', {}, 200]
];
for (const [label, route, options, expected] of checks) { const r = await fetch(base + route, { ...options, signal: AbortSignal.timeout(5000) }); assert.equal(r.status, expected, label); await r.text(); console.log(`PASS ${label}`); }
