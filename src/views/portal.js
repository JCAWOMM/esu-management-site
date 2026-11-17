const { esc, flash, fmtDate } = require('./layout');
const { CATEGORIES, CATEGORY, PRIORITIES, PRIORITY, STATUSES, WORK_STATUSES, ROLES } = require('../rules');

const csrfField = csrf => `<input type="hidden" name="_csrf" value="${esc(csrf)}">`;
const badge = status => `<span class="badge b-${status}">${esc(STATUSES[status] || status)}</span>`;
const prio = p => `<span class="prio p-${p}">${esc((PRIORITY[p] || {}).label || p)}</span>`;
const roleLabel = r => ({ requester: 'Requester', approver: 'Approver', admin: 'ESU staff' }[r] || r);

function loginPage({ error, next = '', email = '' }) {
  return `
<section class="section auth">
  <div class="wrap narrow-sm">
    <form method="post" action="/login" class="form card">
      <h1>Client portal login</h1>
      <p class="muted">For authorized ESU clients and staff.</p>
      ${flash(error, 'err')}
      <input type="hidden" name="next" value="${esc(next)}">
      <label>Email<input type="email" name="email" required autocomplete="username" value="${esc(email)}" autofocus></label>
      <label>Password<input type="password" name="password" required autocomplete="current-password"></label>
      <button class="btn btn-lg btn-block">Log in</button>
      <p class="muted small">Forgot your password or need access? Contact your company's portal approver or your ESU account manager. Accounts are created by ESU only, so we know every request comes from an authorized person.</p>
    </form>
  </div>
</section>`;
}

function accountPage({ user, csrf, error, ok, first }) {
  return `
<section class="section auth">
  <div class="wrap narrow-sm">
    <form method="post" action="/portal/account" class="form card">
      <h1>${first ? 'Set your password' : 'Change password'}</h1>
      ${first ? '<p class="muted">You signed in with a temporary password. Please choose your own before continuing.</p>' : ''}
      ${flash(error, 'err')}${flash(ok)}
      ${csrfField(csrf)}
      <p class="small"><strong>${esc(user.name)}</strong> · ${esc(user.email)} · ${roleLabel(user.role)}</p>
      <label>Current password<input type="password" name="current" required autocomplete="current-password"></label>
      <label>New password (at least 10 characters)<input type="password" name="password" required minlength="10" autocomplete="new-password"></label>
      <label>Confirm new password<input type="password" name="confirm" required minlength="10" autocomplete="new-password"></label>
      <button class="btn btn-block">Save password</button>
    </form>
  </div>
</section>`;
}

function requestTable(rows, { showClient = false, base = '/portal/requests' } = {}) {
  if (!rows.length) return '<p class="empty">No requests here yet.</p>';
  return `<div class="table-wrap"><table class="table">
<thead><tr><th>Ticket</th>${showClient ? '<th>Client</th>' : ''}<th>Building</th><th>Type</th><th>Priority</th><th>Submitted by</th><th>Status</th><th>Submitted</th></tr></thead>
<tbody>${rows.map(r => `<tr>
  <td class="nowrap"><a href="${base}/${r.id}">${esc(r.ticket)}</a></td>
  ${showClient ? `<td>${esc(r.client_name)}</td>` : ''}
  <td>${esc(r.location_name)}</td>
  <td>${esc((CATEGORY[r.category] || {}).label || r.category)}${r.requires_approval ? ' <span class="tag">approval</span>' : ''}</td>
  <td>${prio(r.priority)}</td>
  <td>${esc(r.submitter_name)} <span class="muted small">(${roleLabel(r.submitter_role)})</span></td>
  <td>${badge(r.status)}${r.scheduled_for ? `<div class="small muted">${esc(r.scheduled_for)}</div>` : ''}</td>
  <td class="nowrap">${fmtDate(r.created_at)}</td>
</tr>`).join('')}</tbody></table></div>`;
}

function clientDashboard({ user, client, locations, pendingForMe, rows, msg }) {
  return `
<section class="section portal">
  <div class="wrap">
    ${flash(msg)}
    <div class="page-head">
      <div>
        <h1>${esc(client.name)}</h1>
        <p class="muted">Signed in as ${esc(user.name)} · ${roleLabel(user.role)} · <a href="/portal/account">Change password</a></p>
      </div>
      <a href="/portal/new" class="btn btn-lg">New service request</a>
    </div>
    ${user.role === 'approver' ? `
    <h2>Waiting for your approval <span class="count">${pendingForMe.length}</span></h2>
    ${pendingForMe.length ? requestTable(pendingForMe) : '<p class="empty">Nothing waiting for approval.</p>'}` : ''}
    <h2>Requests for your buildings</h2>
    ${requestTable(rows)}
    <h2>Your authorized buildings</h2>
    <ul class="loc-list">${locations.map(l => `<li><strong>${esc(l.name)}</strong> <span class="muted">${esc(l.address)}</span></li>`).join('') || '<li class="muted">No buildings assigned yet. Contact ESU to be added.</li>'}</ul>
  </div>
</section>`;
}

function newRequestPage({ user, csrf, locations, error, form = {} }) {
  const sel = (a, b) => (String(a) === String(b) ? ' selected' : '');
  const general = CATEGORIES.filter(c => !c.approval), special = CATEGORIES.filter(c => c.approval);
  return `
<section class="section portal">
  <div class="wrap narrow">
    <p><a href="/portal">← Back to requests</a></p>
    <form method="post" action="/portal/new" enctype="multipart/form-data" class="form card">
      <h1>Submit a service request</h1>
      ${flash(error, 'err')}
      ${csrfField(csrf)}
      <div class="who">
        <strong>Submitted by:</strong> ${esc(user.name)}${user.title ? `, ${esc(user.title)}` : ''} · ${esc(user.email)}${user.phone ? ` · ${esc(user.phone)}` : ''} · <span class="tag">${roleLabel(user.role)}</span>
      </div>
      ${locations.length ? '' : '<div class="flash flash-err">You are not authorized for any buildings yet. Contact ESU or your company approver.</div>'}
      <label>Building / service location *
        <select name="location_id" required><option value="">Select a building…</option>
        ${locations.map(l => `<option value="${l.id}"${sel(form.location_id, l.id)}>${esc(l.name)}${l.address ? ` · ${esc(l.address)}` : ''}</option>`).join('')}
        </select>
      </label>
      <div class="row2">
        <label>Request type *
          <select name="category" id="category" required><option value="">Select…</option>
            <optgroup label="Goes straight to ESU dispatch">${general.map(c => `<option value="${c.key}"${sel(form.category, c.key)}>${c.label}</option>`).join('')}</optgroup>
            <optgroup label="Requires approval before scheduling">${special.map(c => `<option value="${c.key}"${sel(form.category, c.key)}>${c.label}</option>`).join('')}</optgroup>
          </select>
        </label>
        <label>Priority *
          <select name="priority" required>${PRIORITIES.map(p => `<option value="${p.key}"${sel(form.priority || 'routine', p.key)}>${p.label}</option>`).join('')}</select>
        </label>
      </div>
      <div id="approval-note" class="notice" hidden>
        ${user.role === 'approver'
          ? 'This is specialty work. Because you are an approver, submitting it also records your approval.'
          : 'This is specialty work. It will be held as <strong>Pending approval</strong> until an approver at your company (or ESU) signs off. It will not be scheduled before then.'}
      </div>
      <label>Describe the work needed *<textarea name="description" rows="5" required maxlength="4000" placeholder="What needs to be done, where in the building, and anything we should know.">${esc(form.description)}</textarea></label>
      <label>Access notes<textarea name="access_notes" rows="2" maxlength="1000" placeholder="Keys, codes, super's contact, best hours…">${esc(form.access_notes)}</textarea></label>
      <label>On-site contact (if different from you)<input name="onsite_contact" maxlength="200" value="${esc(form.onsite_contact)}" placeholder="Name and phone"></label>
      <label>Photos (optional, up to 5, 8 MB each)<input type="file" name="photos" accept="image/*" multiple></label>
      <button class="btn btn-lg btn-block"${locations.length ? '' : ' disabled'}>Submit request</button>
    </form>
  </div>
</section>
<script>
(function(){
  var special = ${JSON.stringify(special.map(c => c.key))};
  var sel = document.getElementById('category'), note = document.getElementById('approval-note');
  function upd(){ note.hidden = special.indexOf(sel.value) === -1; }
  sel.addEventListener('change', upd); upd();
})();
</script>`;
}

function requestDetail({ r, photos, events, user, csrf, canApprove, isAdmin, msg, base }) {
  const cat = CATEGORY[r.category] || { label: r.category };
  return `
<section class="section portal">
  <div class="wrap narrow">
    <p><a href="${isAdmin ? '/admin' : '/portal'}">← Back</a></p>
    ${flash(msg)}
    <div class="card">
      <div class="page-head">
        <div><h1>${esc(r.ticket)}</h1><p class="muted">${esc(r.client_name)} · ${esc(r.location_name)}${r.location_address ? ` · ${esc(r.location_address)}` : ''}</p></div>
        <div>${badge(r.status)}</div>
      </div>
      <dl class="facts">
        <dt>Request type</dt><dd>${esc(cat.label)}${r.requires_approval ? ' <span class="tag">requires approval</span>' : ''}</dd>
        <dt>Priority</dt><dd>${prio(r.priority)}</dd>
        <dt>Submitted by</dt><dd><strong>${esc(r.submitter_name)}</strong>${r.submitter_title ? `, ${esc(r.submitter_title)}` : ''} (${roleLabel(r.submitter_role)})<br><a href="mailto:${esc(r.submitter_email)}">${esc(r.submitter_email)}</a>${r.submitter_phone ? ` · ${esc(r.submitter_phone)}` : ''}</dd>
        <dt>Authorized for building</dt><dd>Yes, verified at submission</dd>
        <dt>Submitted</dt><dd>${fmtDate(r.created_at)}</dd>
        ${r.requires_approval ? `<dt>Approval</dt><dd>${r.approved_at ? `${r.status === 'declined' ? 'Declined' : 'Approved'} by <strong>${esc(r.approver_name)}</strong> on ${fmtDate(r.approved_at)}${r.decision_note ? `<br><em>${esc(r.decision_note)}</em>` : ''}` : 'Waiting for an approver'}</dd>` : ''}
        ${r.scheduled_for ? `<dt>Scheduled for</dt><dd>${esc(r.scheduled_for)}</dd>` : ''}
        ${r.onsite_contact ? `<dt>On-site contact</dt><dd>${esc(r.onsite_contact)}</dd>` : ''}
        ${isAdmin ? `<dt>Submitted from IP</dt><dd class="small muted">${esc(r.submitter_ip)}</dd>` : ''}
      </dl>
      <h3>Description</h3><p class="pre">${esc(r.description)}</p>
      ${r.access_notes ? `<h3>Access notes</h3><p class="pre">${esc(r.access_notes)}</p>` : ''}
      ${photos.length ? `<h3>Photos</h3><div class="photos">${photos.map(p => `<a href="/photos/${p.id}" target="_blank"><img src="/photos/${p.id}" alt="${esc(p.original_name)}" loading="lazy"></a>`).join('')}</div>` : ''}
    </div>

    ${canApprove && r.status === 'pending_approval' ? `
    <form method="post" action="${base}/${r.id}/decision" class="card form">
      <h2>Approve this specialty request?</h2>
      <p class="muted">Approving lets ESU schedule the work. This is recorded under your name.</p>
      ${csrfField(csrf)}
      <label>Note (optional)<input name="note" maxlength="500" placeholder="PO number, budget limit, preferred dates…"></label>
      <div class="cta-row"><button name="decision" value="approve" class="btn">Approve</button><button name="decision" value="decline" class="btn btn-danger">Decline</button></div>
    </form>` : ''}

    ${isAdmin && !['pending_approval', 'declined'].includes(r.status) ? `
    <form method="post" action="/admin/requests/${r.id}/status" class="card form">
      <h2>Update status</h2>
      ${csrfField(csrf)}
      <div class="row2">
        <label>Status<select name="status">${WORK_STATUSES.map(s => `<option value="${s}"${s === r.status ? ' selected' : ''}>${STATUSES[s]}</option>`).join('')}</select></label>
        <label>Scheduled for<input name="scheduled_for" maxlength="80" value="${esc(r.scheduled_for || '')}" placeholder="e.g. Tue Nov 25, 7 PM"></label>
      </div>
      <label>Note to client (optional)<input name="note" maxlength="1000"></label>
      <button class="btn">Save</button>
    </form>` : ''}
    ${isAdmin && r.status === 'pending_approval' ? '<p class="notice">This request cannot be scheduled until it is approved. As ESU staff you can approve it above, for example after the client confirms by phone.</p>' : ''}

    ${!isAdmin && ['open', 'pending_approval'].includes(r.status) && r.submitted_by === user.id ? `
    <form method="post" action="${base}/${r.id}/cancel" class="inline-form">${csrfField(csrf)}<button class="linkbtn danger">Cancel this request</button></form>` : ''}

    <div class="card">
      <h2>History</h2>
      <ul class="timeline">${events.map(e => `<li><span class="muted small">${fmtDate(e.created_at)}</span> <strong>${esc(e.actor_name)}</strong> ${esc(e.action)}${e.note ? `<div class="small">${esc(e.note)}</div>` : ''}</li>`).join('')}</ul>
    </div>
  </div>
</section>`;
}

module.exports = { loginPage, accountPage, clientDashboard, newRequestPage, requestDetail, requestTable, csrfField, badge, roleLabel };
