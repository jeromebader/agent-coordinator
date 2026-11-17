# Relay — local agent coordinator

A Windows-first local control plane for project tasks, dependency scheduling, agent run monitoring, approvals, and dispatch policies. Built with Node.js and browser-native JavaScript; no npm dependencies or build step.

## Start

Requires Node.js 22.13 or newer (tested on 24.13).

```powershell
npm start
```

Open http://127.0.0.1:4310. Or double-click `Start Relay.cmd`.

1. Try **Simulation**, then **Resume dispatch**. Three simulated tasks run in order without model calls or project edits.
2. Add a project using an existing absolute folder path.
3. Create a task with instructions, an agent, access mode, and optional prerequisites.
4. Review real tasks in **Approvals**. Approved tasks run once dependencies have completed and a worker and folder lock are available.

Dispatch starts paused after every restart. Pausing holds queued work; use **Cancel run** to stop a running process. A retry creates a new task, preserving history; existing downstream dependencies still reference the original task, so create a new downstream task when replacing a failed prerequisite.

## Implemented

- Local project registry; dependency-aware queue; configurable concurrency (1–8).
- Folder locks for identical or overlapping directories, including resolved symlink targets.
- Codex CLI adapter with read-only or workspace-write sandbox, JSON output, and noninteractive approval denial.
- Claude Code print-mode adapter with Read/Glob/Grep and optionally Edit/Write. Shell tools are excluded; MCP servers are disabled for these runs. Local provider settings/hooks can still apply.
- Approval/rejection, cancellation, time limits, run inspection, JSON downloads, and audit history.
- SQLite WAL event store: output writes batch every 250 ms or 100 events; lifecycle events flush immediately. Global retention is 10,000 events, each detail capped at 4,000 characters. The UI keeps up to 100 output chunks per task.
- Final provider result handoff only (up to 8,000 characters per result, 16,000 total dependency context). Raw logs are not automatically fed to the model.
- Browser updates via Server-Sent Events. No model calls are made for monitoring.

## Integration and policy boundaries

CLI detection does not verify provider login. Log in to each provider separately using its normal CLI workflow. This app does not store provider credentials. Real runs can incur provider usage costs.

Roo Code and online platforms are visibly marked **Not connected**. Native subagent trees, individual pre-tool action hooks, cost accounting, hard spend limits, automatic worktree creation, and autonomous task decomposition are not implemented. The schema reserves `parent_id` for future tool/subagent events. Process output is observational telemetry, not guaranteed pre-action reporting.

Dispatch policies are enforced by the coordinator. The provider's own permissions enforce agent tools; there is no universal filesystem/network boundary supplied by this app. Only sessions launched here are monitored. Process-tree cancellation uses Windows `taskkill /T /F`; failure is reported in logs and the worker stays occupied until process termination is observed.

The server binds to `127.0.0.1`, validates Host and Origin, and requires a per-server session token on mutations. It is a single-user local app, not a multi-user authenticated service. Do not expose it on a public interface. Run logs can contain source code or sensitive output; downloads include the task instructions and retained logs.

## Storage and recovery

`data/state.json` holds projects, tasks, final results, policies, and up to 1,000 audit records. `data/events.sqlite` stores bounded output and lifecycle events. Metadata/task history is not automatically pruned. SQLite reuses freed pages; the database file does not immediately shrink when rows expire. Output chunks are truncated at the retention cap; exported runs contain only retained logs, not complete transcripts.

State is replaced through a temporary file at lifecycle transitions; raw output is stored separately in SQLite. There is no transaction spanning both files. Interrupted runs are marked failed after restart and dispatch remains paused. Inspect any surviving provider processes before resuming after a crash. Run only one coordinator against a data directory.

Override `PORT` or `COORDINATOR_DATA` with environment variables when needed.

## Validation

```powershell
npm run check
npm test
```

Tests use simulated workers and mocked CLI processes. They cover dependency ordering, approval gates, folder locking, concurrency, cancellation, failed dependencies, restart behavior, provider failures, and retention. They do not spend provider credits.

## Provider references

- [Codex noninteractive runs](https://developers.openai.com/codex/noninteractive)
- [Claude Code programmatic runs](https://code.claude.com/docs/en/headless)

Adapter arguments were also checked against the locally installed CLI help.
