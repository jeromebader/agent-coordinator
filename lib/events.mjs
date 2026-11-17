import { DatabaseSync } from 'node:sqlite';

// Transport-side telemetry: no model calls and no model-authored narration.
export class EventStore {
  constructor(file) {
    this.db = new DatabaseSync(file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY, run_id TEXT, parent_id TEXT, kind TEXT NOT NULL,
        time TEXT NOT NULL, detail TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS events_run ON events(run_id,id);`);
    this.insert = this.db.prepare('INSERT INTO events(run_id,parent_id,kind,time,detail) VALUES (?,?,?,?,?)');
    this.pending = [];
    this.timer = setInterval(() => this.flush(), 250); this.timer.unref();
  }
  add(runId, kind, detail, parentId = null) {
    this.pending.push([runId || null, parentId, kind, new Date().toISOString(), String(detail).slice(0, 4000)]);
    if (this.pending.length >= 100) this.flush();
  }
  flush() {
    if (!this.pending.length) return;
    this.db.exec('BEGIN');
    try {
      for (const row of this.pending) this.insert.run(...row);
      this.db.exec('DELETE FROM events WHERE id <= (SELECT max(id)-10000 FROM events)');
      this.db.exec('COMMIT'); this.pending.length = 0;
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  logs(runId) {
    return this.db.prepare("SELECT time,kind AS stream,detail AS text FROM events WHERE run_id=? AND kind IN ('stdout','stderr') ORDER BY id DESC LIMIT 100").all(runId).reverse();
  }
  close() { clearInterval(this.timer); this.flush(); this.db.close(); }
}
