import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { Coordinator, overlaps } from '../lib/coordinator.mjs';
import { EventStore } from '../lib/events.mjs';

function setup(t, options = {}) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'relay-test-'));
  const c = new Coordinator({ directory: path.join(dir, 'data'), adapters: [{ id: 'codex', name: 'Codex', executable: 'fake', available: true }], demoDelay: 5, ...options });
  const folder = path.join(dir, 'project'); mkdirSync(folder); const p = c.project({ name: 'Test project', directory: folder });
  t.after(() => { c.dispose(); rmSync(dir, { recursive: true, force: true }); });
  return { c, p, dir };
}
const create = (c, p, extra = {}) => c.task({ projectId: p.id, adapter: 'demo', title: 'Test task', prompt: 'Test instructions', ...extra });
const resume = c => c.policies({ ...c.state.policies, paused: false });
async function until(fn) { const deadline = Date.now() + 3000; while (!fn()) { if (Date.now() > deadline) throw Error('Timed out'); await new Promise(r => setTimeout(r, 10)); } }

test('dependency chain runs in order and telemetry survives restart', async t => {
  const { c, p } = setup(t); const a = create(c, p), b = create(c, p, { dependencies: [a.id] });
  assert.equal(a.status, 'queued'); resume(c); assert.equal(a.status, 'running'); assert.equal(b.status, 'queued');
  await until(() => b.status === 'completed'); assert.ok(a.endedAt <= b.startedAt);
  assert.equal(c.events.logs(a.id).length, 5);
  assert.equal(JSON.parse(readFileSync(c.file, 'utf8')).tasks[0].logs, undefined);
});
test('real tasks cannot launch before approval and require fresh approval on retry', async t => {
  let calls = 0;
  const { c, p } = setup(t, { runner: () => { calls++; throw Error('fixture unavailable'); } });
  const a = create(c, p, { adapter: 'codex' }); resume(c); assert.equal(calls, 0);
  c.action(a.id, 'approve'); assert.equal(calls, 1); assert.equal(a.status, 'failed');
  const retry = c.action(a.id, 'retry'); assert.equal(retry.status, 'awaiting_approval'); assert.equal(retry.approvedAt, null);
});
test('folder locks serialize overlapping folders but allow independent projects', async t => {
  const { c, p, dir } = setup(t); const child = path.join(p.directory, 'nested'); mkdirSync(child);
  const other = path.join(dir, 'other'); mkdirSync(other);
  const p2 = c.project({ name: 'Nested', directory: child }), p3 = c.project({ name: 'Other', directory: other });
  const a = create(c, p), b = create(c, p2), d = create(c, p3); resume(c);
  assert.equal(a.status, 'running'); assert.equal(b.status, 'queued'); assert.equal(d.status, 'running');
  await until(() => b.status === 'completed' && d.status === 'completed');
  assert.ok(a.endedAt <= b.startedAt); assert.equal(overlaps(p.directory, other), false);
});
test('failed dependency blocks downstream and cancelling never starts it', async t => {
  const { c, p } = setup(t); const a = create(c, p), b = create(c, p, { dependencies: [a.id] });
  c.action(a.id, 'cancel'); resume(c); assert.equal(b.status, 'queued');
  c.action(b.id, 'cancel'); assert.equal(b.status, 'cancelled'); assert.equal(c.active.size, 0);
});
test('cancelling a running simulation releases its worker and folder lock', async t => {
  const { c, p } = setup(t); const a = create(c, p), b = create(c, p); resume(c);
  c.action(a.id, 'cancel'); assert.equal(a.status, 'cancelled');
  await until(() => b.status === 'completed'); assert.equal(c.active.size, 0);
});
test('changing approval policy gates queued tasks and disabling it does not auto-approve', t => {
  const { c, p } = setup(t); c.policies({ ...c.state.policies, requireApproval: false });
  const a = create(c, p, { adapter: 'codex' }); assert.equal(a.status, 'queued');
  c.policies({ ...c.state.policies, requireApproval: true }); assert.equal(a.status, 'awaiting_approval');
  c.policies({ ...c.state.policies, requireApproval: false }); assert.equal(a.status, 'awaiting_approval');
  assert.throws(() => c.policies({ ...c.state.policies, maxConcurrent: 0 }), /Concurrency/);
  assert.throws(() => create(c, p, { dependencies: ['missing'] }), /Dependencies/);
});
test('provider failure in split JSON output fails a zero-exit run', async t => {
  let child;
  const { c, p } = setup(t, { runner: () => { child = new EventEmitter(); child.stdin = new PassThrough(); child.stdout = new PassThrough(); child.stderr = new PassThrough(); return child; } });
  const a = create(c, p, { adapter: 'codex' }); c.action(a.id, 'approve'); resume(c);
  child.stdout.write('{"type":"turn.fa'); child.stdout.write('iled","error":{"message":"No auth"}}\n'); child.emit('close', 0);
  assert.equal(a.status, 'failed'); assert.equal(a.error, 'No auth');
});
test('restart pauses dispatch and marks interrupted runs failed', t => {
  const { c, p } = setup(t); const a = create(c, p); a.status = 'running'; c.save();
  const second = new Coordinator({ directory: c.directory, adapters: [] });
  try { assert.equal(second.state.policies.paused, true); assert.equal(second.state.tasks[0].status, 'failed'); } finally { second.dispose(); }
});
test('event store bounds detail and retains only the latest 10000 events', t => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'relay-events-')); const events = new EventStore(path.join(dir, 'events.sqlite'));
  t.after(() => { events.close(); rmSync(dir, { recursive: true, force: true }); });
  for (let i = 0; i < 10020; i++) events.add('run', 'stdout', i === 10019 ? 'x'.repeat(5000) : String(i));
  events.flush(); assert.equal(events.db.prepare('SELECT count(*) AS n FROM events').get().n, 10000);
  assert.equal(events.logs('run').at(-1).text.length, 4000);
});
