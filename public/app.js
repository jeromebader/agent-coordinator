let state, token, view = 'overview', project = 'all', inspected = null;
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const names = { demo: 'Simulation', codex: 'Codex', claude: 'Claude Code' };
const statuses = { awaiting_approval: 'Needs approval', queued: 'Queued', running: 'Running', stopping: 'Stopping', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled', rejected: 'Rejected' };
const badge = s => `<span class="badge ${s}"><i></i>${statuses[s]}</span>`;
const time = v => v ? new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
const pname = id => state.projects.find(p => p.id === id)?.name || 'Unknown';
const tasks = () => state.tasks.filter(t => project === 'all' || t.projectId === project);
const button = (action, text, primary = false) => `<button data-action="${action}" class="${primary ? 'primary' : ''}">${text}</button>`;
function heading(kicker, title, subtitle, actions = '') { return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${subtitle}</p></div><div class="actions">${actions}</div></div>`; }
function empty(title, text, action = '') { return `<div class="empty"><div class="empty-icon">⌘</div><h3>${title}</h3><p>${text}</p>${action}</div>`; }
function filter() { return `<select id="project-filter" aria-label="Filter by project"><option value="all">All projects</option>${state.projects.map(p => `<option value="${p.id}" ${project === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`; }
function waiting(t) {
  if (t.status !== 'queued') return '';
  if (state.policies.paused) return 'Dispatch paused';
  if (t.dependencies.some(id => state.tasks.find(x => x.id === id)?.status !== 'completed')) return 'Waiting for dependencies';
  return 'Waiting for capacity / folder lock';
}
function rows(list) {
  if (!list.length) return empty('A clear runway', 'Create a task or explore a simulated workflow.', button('new-task', '+ Create task', true));
  return `<div class="table-scroll"><table><thead><tr><th>TASK / PROJECT</th><th>AGENT</th><th>STATUS</th><th>ACCESS</th><th>CREATED</th><th></th></tr></thead><tbody>${[...list].reverse().map(t => `<tr data-task="${t.id}" tabindex="0"><td><strong>${esc(t.title)}</strong><small>${esc(pname(t.projectId))}</small></td><td><span class="agent-icon ${t.adapter}">${t.adapter === 'claude' ? '✳' : '◈'}</span>${names[t.adapter]}</td><td>${badge(t.status)}${waiting(t) ? `<small>${waiting(t)}</small>` : ''}</td><td>${t.adapter === 'demo' ? 'Simulated' : t.mode === 'write' ? 'Edit files' : 'Read only'}</td><td>${time(t.createdAt)}</td><td>↗</td></tr>`).join('')}</tbody></table></div>`;
}
function graph(list) {
  if (!list.length) return empty('Your next workflow starts here', 'Connect planning, implementation, and review with dependencies.', button('demo', '◈ Try a simulation'));
  return `<div class="workflow">${list.map(t => `<div class="flow-item"><div class="flow-track"><i class="${t.status}"></i></div><button class="flow-card" data-task="${t.id}"><div class="flow-top"><span>${names[t.adapter]}</span>${badge(t.status)}</div><h3>${esc(t.title)}</h3><p>${esc(pname(t.projectId))}</p><div class="flow-bottom"><span>${t.dependencies.length ? '↳ ' + t.dependencies.length + ' prerequisite(s)' : '○ Entry task'}</span><span>↗</span></div>${t.dependencies.length ? `<small>After: ${t.dependencies.map(id => esc(state.tasks.find(x => x.id === id)?.title)).join(', ')}</small>` : ''}</button></div>`).join('')}</div>`;
}
function activity(list) { return list.length ? `<div class="activity-list">${list.map(a => `<div class="activity-item"><i></i><div><p>${esc(a.message)}</p><small>${new Date(a.time).toLocaleString()}</small></div></div>`).join('')}</div>` : empty('All quiet here', 'Decisions and run outcomes will appear here.'); }
function overview() {
  const list = tasks();
  const stats = [['Active runs', list.filter(t => ['running', 'stopping'].includes(t.status)).length, `${state.policies.maxConcurrent} worker slots · folder locks enabled`], ['Projects', state.projects.length, 'Independent workspaces, one view'], ['Awaiting approval', list.filter(t => t.status === 'awaiting_approval').length, 'Human oversight before dispatch'], ['Completed runs', list.filter(t => t.status === 'completed').length, 'Includes labeled simulations']];
  return heading('MISSION CONTROL', 'Every agent. In sync.', 'Orchestrate the work. Keep the big picture.', button('demo', '◈ Try simulation') + button('new-task', '+ Create task', true)) +
  `<div class="dispatch-banner ${state.policies.paused ? 'paused' : ''}"><div><i class="status-dot"></i><b>${state.policies.paused ? 'Dispatch is paused' : 'Your control plane is ready'}</b><span>${state.policies.paused ? 'Resume when you’re ready to start queued work.' : 'Live events · Dependency-aware scheduling · Local storage'}</span></div>${button('toggle-dispatch', state.policies.paused ? 'Resume dispatch →' : 'Pause dispatch')}</div>
  <div class="stats">${stats.map(([label, count, note]) => `<article><span>${label}<i>↗</i></span><strong>${count}</strong><p>${note}</p></article>`).join('')}</div>
  <section class="panel"><div class="panel-heading"><div><h2>Orchestration map <span class="tag">LIVE</span></h2><p>Each card shows its prerequisites; independent tasks can run in parallel.</p></div>${filter()}</div>${graph(list.slice(-6))}</section>
  <div class="bottom-grid"><section class="panel"><div class="panel-heading"><h2>Recent runs</h2><button class="text-button" data-view="runs">View all →</button></div>${rows(list.slice(-5))}</section><section class="panel"><div class="panel-heading"><h2>Activity feed</h2><i class="status-dot"></i></div>${activity(state.audit.slice(0, 5))}</section></div>`;
}
function projects() { return heading('WORKSPACE', 'Your projects', 'Give each agent the right context and a local project folder.', button('new-project', '+ Add project', true)) + (state.projects.length ? `<div class="card-grid">${state.projects.map(p => `<section class="panel project-card"><div class="provider-icon">▱</div><h2>${esc(p.name)}</h2><p class="path">${esc(p.directory)}</p><p>${state.tasks.filter(t => t.projectId === p.id).length} tasks</p><button data-project="${p.id}">Open project →</button></section>`).join('')}</div>` : `<section class="panel">${empty('Bring your first project', 'Register an existing local folder. Your source code stays in place.', button('new-project', '+ Add project', true))}</section>`); }
function integrations() {
  const providers = [...state.adapters.map(a => ({ ...a, description: a.id === 'codex' ? 'Runs the Codex CLI with a read-only or workspace-write sandbox. Captures streamed output and cancels process trees.' : 'Runs Claude Code in print mode with Read/Glob/Grep tools; optionally Edit/Write. Shell tools are excluded. Local settings and hooks may still apply.' })), { id: 'roo', name: 'Roo Code', description: 'An adapter is still needed for your Roo Code version and its supported integration interface.' }, { id: 'cloud', name: 'Online platforms', description: 'Each platform needs an authenticated API or event bridge. No online accounts are connected yet.' }];
  return heading('CONTROL PLANE', 'Your agent ecosystem', 'Different tools. Shared visibility. Explicit capabilities.') + `<div class="card-grid">${providers.map(a => `<section class="panel integration-card"><span class="provider-icon ${a.id}">${a.id === 'claude' ? '✳' : a.id === 'roo' ? 'R' : '◈'}</span><div class="integration-title"><h2>${a.name}</h2><span class="badge ${a.available ? 'completed' : 'queued'}"><i></i>${a.available ? 'CLI detected' : 'Not connected'}</span></div><p>${a.description}</p><div class="capabilities">${(a.available ? ['Launch runs', 'Live output', 'Cancel'] : ['Planned integration']).map(c => `<span>${c}</span>`).join('')}</div><small>${a.available ? 'CLI detection does not verify authentication. Uses your existing local login; no paid runs have been verified.' : 'No actions are launched or monitored through this integration.'}</small></section>`).join('')}</div><div class="note"><b>Lightweight by design</b><p>SQLite stores up to 10,000 events, with output capped at 4,000 characters per chunk and writes batched every 250 ms. Monitoring adds no model calls. Tool-level interception and native subagent visualization are not connected yet.</p></div>`;
}
function policies() { const p = state.policies; return heading('CONTROL PLANE', 'Set the boundaries', 'Enforceable dispatch controls for work launched here.') + `<form id="policy-form" class="panel"><div class="policy-row"><div><h3>Approval before dispatch</h3><p>New real-agent runs wait for your review. Existing approval requests remain pending when disabled.</p></div><input aria-label="Approval before dispatch" type="checkbox" name="requireApproval" ${p.requireApproval ? 'checked' : ''}></div><div class="policy-row"><div><h3>Maximum concurrent runs</h3><p>Across all projects. Overlapping folders are always serialized.</p></div><input aria-label="Maximum concurrent runs" type="number" name="maxConcurrent" min="1" max="8" value="${p.maxConcurrent}" required></div><div class="policy-row"><div><h3>Run time limit (minutes)</h3><p>Stop the process tree when time expires. Applies to new runs.</p></div><input aria-label="Run time limit" type="number" name="timeoutMinutes" min="1" max="180" value="${p.timeoutMinutes}" required></div><div class="policy-row"><div><h3>Pause dispatch</h3><p>Running tasks continue. Dispatch always pauses after a restart.</p></div><input aria-label="Pause dispatch" type="checkbox" name="paused" ${p.paused ? 'checked' : ''}></div><div class="policy-footer"><span>Changes are recorded in the audit log.</span><button class="primary">Save policies</button></div></form><div class="note"><b>Dispatch controls and agent permissions are separate</b><p>These settings do not intercept individual tool calls, enforce spend limits, or control sessions launched elsewhere. Agent-native permissions and local configuration still apply.</p></div>`; }
function approvals() { const list = state.tasks.filter(t => t.status === 'awaiting_approval'); return heading('HUMAN IN THE LOOP', 'Approval inbox', 'Inspect instructions, project, and requested access before execution.') + (list.length ? list.map(t => `<section class="panel approval-card"><div class="eyebrow">${names[t.adapter]} · ${esc(pname(t.projectId))}</div><h2>${esc(t.title)}</h2><p class="path">${esc(state.projects.find(p => p.id === t.projectId)?.directory)}</p><pre>${esc(t.prompt)}</pre><div class="approval-footer"><span>Access: <b>${t.mode === 'write' ? 'Edit files' : 'Read only'}</b></span><div class="actions"><button data-task="${t.id}">Inspect</button><button data-op="reject" data-id="${t.id}">Reject</button><button class="primary" data-op="approve" data-id="${t.id}">Approve run →</button></div></div></section>`).join('') : `<section class="panel">${empty('You’re all caught up', 'Tasks requiring your approval will appear here.')}</section>`); }
function render() {
  const pages = { overview, projects, integrations, policies, approvals, runs: () => heading('WORKSPACE', 'Runs & orchestration', 'Inspect dependencies, monitor output, and manage execution.', button('new-task', '+ Create task', true)) + `<section class="panel"><div class="panel-heading"><h2>Task dependencies</h2>${filter()}</div>${graph(tasks())}</section><section class="panel">${rows(tasks())}</section>`, audit: () => heading('CONTROL PLANE', 'Audit log', 'Dispatch decisions, policy changes, and outcomes.') + `<section class="panel">${activity(state.audit)}</section>` };
  if (!(view === 'policies' && $('#policy-form'))) $('#main').innerHTML = pages[view]();
  $('#breadcrumb').textContent = { overview: 'Overview', projects: 'Projects', runs: 'Runs & orchestration', approvals: 'Approvals', policies: 'Policies', integrations: 'Integrations', audit: 'Audit log' }[view];
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $('#project-count').textContent = state.projects.length; $('#approval-count').textContent = state.tasks.filter(t => t.status === 'awaiting_approval').length;
  if (inspected && $('#dialog').open) detail(inspected, true);
}
function navigate(next) { view = next; $('#main').innerHTML = ''; render(); }
function toast(text) { $('#toast').textContent = text; $('#toast').classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('show'), 4500); }
async function post(route, input = {}) {
  const res = await fetch('/api/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Coordinator-Token': token }, body: JSON.stringify(input) });
  const data = await res.json(); if (!res.ok) throw Error(data.error); state = data.state; render(); return data.result;
}
function modal(html) { $('#dialog-content').innerHTML = `<button class="close" data-action="close" aria-label="Close dialog">×</button>${html}`; if (!$('#dialog').open) $('#dialog').showModal(); }
function newProject() { inspected = null; modal(`<div class="eyebrow">WORKSPACE</div><h2>Add a project</h2><p>Connect an existing directory on this machine.</p><form id="project-form"><label>Project name<input name="name" maxlength="80" placeholder="My next project" required></label><label>Absolute folder path<input name="directory" placeholder="C:\\Users\\Windows\\Desktop\\my-project" required></label><div class="form-actions"><button type="button" data-action="close">Cancel</button><button class="primary">Add project</button></div></form>`); }
function newTask() {
  if (!state.projects.length) { toast('Add a project first, or try the simulation.'); newProject(); return; }
  inspected = null; modal(`<div class="eyebrow">NEW RUN</div><h2>Give an agent a task</h2><form id="task-form"><label>Title<input name="title" maxlength="120" placeholder="Review the authentication flow" required></label><div class="form-grid"><label>Project<select name="projectId" id="task-project">${state.projects.map(p => `<option value="${p.id}" ${p.id === project ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label><label>Agent<select name="adapter"><option value="demo">Simulation (no model calls)</option>${state.adapters.filter(a => a.available).map(a => `<option value="${a.id}">${a.name}</option>`).join('')}</select></label></div><label>Instructions<textarea name="prompt" rows="4" maxlength="20000" placeholder="Describe the outcome and how to verify it…" required></textarea></label><label>Access<select name="mode"><option value="read">Read only</option><option value="write">Edit project files</option></select></label><fieldset><legend>Run after (optional)</legend><div id="dependencies"></div></fieldset><p class="fine-print">Real runs use your existing provider login and may incur charges. ${state.policies.requireApproval ? 'Approval is required before dispatch.' : 'Approval is off. A real run may start immediately when dispatch is active.'}</p><div class="form-actions"><button type="button" data-action="close">Cancel</button><button class="primary">Create task →</button></div></form>`); dependencies();
}
function dependencies() { const list = state.tasks.filter(t => t.projectId === $('#task-project').value); $('#dependencies').innerHTML = list.length ? list.map(t => `<label class="check-label"><input type="checkbox" name="dependencies" value="${t.id}"><span>${esc(t.title)} <small>${statuses[t.status]}</small></span></label>`).join('') : '<span class="muted">No previous tasks in this project.</span>'; }
function detail(id, update = false) {
  inspected = id; const t = state.tasks.find(t => t.id === id); if (!t) return;
  const previous = $('#run-log'), scroll = previous?.scrollTop || 0, bottom = !previous || previous.scrollHeight - previous.scrollTop - previous.clientHeight < 50;
  const ops = t.status === 'awaiting_approval' ? ['reject', 'approve'] : ['running', 'queued'].includes(t.status) ? ['cancel'] : ['completed', 'failed', 'rejected', 'cancelled'].includes(t.status) ? ['retry'] : [];
  modal(`<div class="eyebrow">${names[t.adapter]} · ${esc(pname(t.projectId))}</div><h2>${esc(t.title)}</h2><div class="detail-meta">${badge(t.status)}<span>${t.adapter === 'demo' ? 'Simulation only' : t.mode === 'write' ? 'Edit files' : 'Read only'}</span><span>${time(t.startedAt)} → ${time(t.endedAt)}</span></div><p class="path">${esc(state.projects.find(p => p.id === t.projectId)?.directory)}</p><h3>Instructions</h3><pre class="instructions">${esc(t.prompt)}</pre>${t.dependencies.length ? `<p>After: ${t.dependencies.map(d => esc(state.tasks.find(x => x.id === d)?.title)).join(', ')}</p>` : ''}${t.error ? `<div class="error-box">${esc(t.error)}</div>` : ''}<p>${waiting(t)}</p><div class="log-heading"><h3>Live output <span class="tag">LATEST ${t.logs.length} CHUNKS</span></h3>${button('download', 'Download run')}</div><div id="run-log" class="terminal">${t.logs.length ? t.logs.map(l => `<div class="log-line ${l.stream}"><time>${time(l.time)}</time><pre>${esc(l.text)}</pre></div>`).join('') : '<span>Waiting for output…</span>'}</div><div class="form-actions">${ops.map(op => `<button data-op="${op}" data-id="${id}" class="${op === 'approve' ? 'primary' : ''}">${op === 'retry' ? 'Create retry' : op[0].toUpperCase() + op.slice(1) + ' run'}</button>`).join('')}</div>`);
  if (update) $('#run-log').scrollTop = bottom ? $('#run-log').scrollHeight : scroll;
}
document.addEventListener('click', async e => {
  const b = e.target.closest('button,[data-task]'); if (!b) return;
  try {
    if (b.dataset.view) navigate(b.dataset.view);
    else if (b.dataset.project) { project = b.dataset.project; navigate('runs'); }
    else if (b.dataset.task) detail(b.dataset.task);
    else if (b.dataset.op) { await post(`tasks/${b.dataset.id}/actions`, { action: b.dataset.op }); toast('Task updated'); }
    else if (b.dataset.action === 'close') { inspected = null; $('#dialog').close(); }
    else if (b.dataset.action === 'new-project') newProject();
    else if (b.dataset.action === 'new-task') newTask();
    else if (b.dataset.action === 'toggle-dispatch') await post('policies', { ...state.policies, paused: !state.policies.paused });
    else if (b.dataset.action === 'demo') { const p = await post('demo'); project = p.id; navigate('overview'); toast(state.policies.paused ? 'Simulation queued. Resume dispatch to begin.' : 'Simulation started'); }
    else if (b.dataset.action === 'download') {
      const t = state.tasks.find(t => t.id === inspected), url = URL.createObjectURL(new Blob([JSON.stringify(t, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = `run-${t.id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  } catch (err) { toast(err.message); }
});
document.addEventListener('change', e => { if (e.target.id === 'project-filter') { project = e.target.value; render(); } if (e.target.id === 'task-project') dependencies(); });
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('tr[data-task]')) detail(e.target.dataset.task); });
document.addEventListener('submit', async e => {
  e.preventDefault(); const f = new FormData(e.target), b = e.target.querySelector('.primary'); b.disabled = true;
  try {
    if (e.target.id === 'project-form') { await post('projects', Object.fromEntries(f)); $('#dialog').close(); toast('Project added'); }
    else if (e.target.id === 'task-form') { await post('tasks', { ...Object.fromEntries(f), dependencies: f.getAll('dependencies') }); $('#dialog').close(); toast('Task created'); }
    else if (e.target.id === 'policy-form') { await post('policies', { requireApproval: f.has('requireApproval'), paused: f.has('paused'), maxConcurrent: Number(f.get('maxConcurrent')), timeoutMinutes: Number(f.get('timeoutMinutes')) }); toast('Policies saved'); }
  } catch (err) { toast(err.message); } finally { b.disabled = false; }
});
$('#dialog').addEventListener('close', () => { inspected = null; });
try {
  const res = await fetch('/api/state'); if (!res.ok) throw Error('Cannot connect to the local coordinator'); state = await res.json(); token = state.token; render();
  const stream = new EventSource('/api/events?token=' + encodeURIComponent(token));
  stream.onmessage = e => { state = JSON.parse(e.data); $('#connection').innerHTML = '<i class="status-dot"></i> Live connection'; render(); };
  stream.onerror = () => { $('#connection').textContent = 'Reconnecting… Reload if the server restarted.'; };
} catch (err) { $('#main').innerHTML = empty('Connection unavailable', esc(err.message)); }
