# Resume development

## Current state

Relay is a working Windows-first local coordinator built with Node.js and browser-native JavaScript, without npm dependencies. Start with `npm start` or `Start Relay.cmd`, then open http://127.0.0.1:4310. Requires Node.js >=22.13; tested on 24.13.

Implemented: project registration, dependency scheduling, overlapping-folder locks, concurrency limits, approval/rejection, cancellation, run timeouts, audit history, live output, simulation, and Codex/Claude CLI launch adapters. Dispatch starts paused after every restart.

Validation completed: `npm run check`, nine `npm test` cases, nine live HTTP checks (`node scripts/check-http.mjs` while the server is running), and a three-task simulation through the browser. No paid provider runs have been launched. `preview.png` shows the dashboard.

## User direction

The goal is to coordinate agents and subagents across Codex, Claude Code, Roo Code, and online platforms, across multiple projects, with visualization, monitoring, and policies. The user chose a local app on this Windows machine.

The user proposed extremely lightweight before-action database events. Current implementation uses adapter-side SQLite telemetry with no additional model calls: writes batch every 250 ms or 100 events, lifecycle records flush immediately, global retention is 10,000 events, and output detail is capped at 4,000 characters. This is process-output monitoring, not universal pre-action interception. Prefer native hooks over asking models to narrate actions.

## Next work

1. Verify real Codex and Claude runs against a small dedicated test project and the user's existing logins; accurately report provider failures and permissions.
2. Add provider-supported tool lifecycle hooks and normalize compact events with run/action/parent identifiers. Distinguish monitoring from synchronous policy decisions.
3. Add actual subagent relationships and a dependency graph with edges.
4. Select a supported integration for the user's Roo Code version and identify the online platforms to connect. These are visibly unconnected today.
5. Improve event delivery to send deltas rather than full snapshots; add task-history cleanup, stronger crash recovery, and automatic browser session-token refresh after server restarts.

## Known boundaries

Provider CLI installation is detected, but authentication and real paid execution are unverified. Local provider settings/hooks can apply. No universal tool-level sandbox, spend limit, native subagent visualization, automatic worktrees, or autonomous decomposition is implemented. Retries create a new task; existing downstream dependencies still point to the original task. See README.md for further details.

State lives in ignored `data/`; logs and local provider credentials are not committed. A fresh clone starts empty. Shut down/restart the local server normally; a computer shutdown stops it. This chat cannot continue executing on a powered-off computer.
