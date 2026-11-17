const { esc, flash, fmtDate } = require('./layout');
const { STATUSES, BOROUGHS } = require('../rules');
const { requestTable, csrfField, roleLabel } = require('./portal');

const tabs = active => `<nav class="tabs">
  <a href="/admin" class="${active === 'requests' ? 'on' : ''}">Service requests</a>
  <a href="/admin/clients" class="${active === 'clients' ? 'on' : ''}">Clients &amp; users</a>
  <a href="/admin/quotes" class="${active === 'quotes' ? 'on' : ''}">Quote requests</a>
  <a href="/admin/staff" class="${active === 'staff' ? 'on' : ''}">ESU staff</a>
  <a href="/admin/log" class="${active === 'log' ? 'on' : ''}">Security log</a>
  <a href="/portal/account">My password</a>
</nav>`;

function adminRequests({ rows, counts, clients, filter, msg }) {
  const opt = (v, cur, label) => `<option value="${esc(v)}"${String(v) === String(cur || '') ? ' selected' : ''}>${esc(label)}</option>`;
  return `
<section class="section portal"><div class="wrap">
  <h1>ESU admin</h1>${tabs('requests')}${flash(msg)}
  <div class="stats">
    ${['pending_approval', 'open', 'scheduled', 'in_progress', 'completed'].map(s => `<a href="/admin?status=${s}" class="stat"><b>${counts[s] || 0}</b><span>${STATUSES[s]}</span></a>`).join('')}
    <a href="/admin/quotes" class="stat"><b>${counts.quotes || 0}</b><span>New quote requests</span></a>
  </div>
  <form class="filters" method="get" action="/admin">
    <select name="status">${opt('', filter.status, 'All active')}${opt('all', filter.status, 'Everything')}${Object.entries(STATUSES).map(([k, v]) => opt(k, filter.status, v)).join('')}</select>
    <select name="client">${opt('', filter.client, 'All clients')}${clients.map(c => opt(c.id, filter.client, c.name)).join('')}</select>
    <button class="btn btn-sm">Filter</button>
  </form>
  ${requestTable(rows, { showClient: true, base: '/admin/requests' })}
</div></section>`;
}

function adminClients({ clients, csrf, msg, error }) {
  return `
<section class="section portal"><div class="wrap">
  <h1>ESU admin</h1>${tabs('clients')}${flash(msg)}${flash(error, 'err')}
  <div class="table-wrap"><table class="table">
    <thead><tr><th>Client</th><th>Buildings</th><th>Users</th><th>Open requests</th><th>Status</th></tr></thead>
    <tbody>${clients.map(c => `<tr><td><a href="/admin/clients/${c.id}">${esc(c.name)}</a></td><td>${c.locs}</td><td>${c.users}</td><td>${c.open}</td><td>${c.active ? 'Active' : '<span class="muted">Inactive</span>'}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No clients yet.</td></tr>'}</tbody>
  </table></div>
  <form method="post" action="/admin/clients" class="card form narrow-sm">
    <h2>Add a client company</h2>${csrfField(csrf)}
    <label>Company name<input name="name" required maxlength="160"></label>
    <button class="btn">Add client</button>
  </form>
</div></section>`;
}

function adminClient({ client, locations, users, userLocs, csrf, msg, error, tempPassword }) {
  const locCheckboxes = (checked = []) => locations.map(l => `<label class="chip"><input type="checkbox" name="locations" value="${l.id}"${checked.includes(l.id) ? ' checked' : ''}> ${esc(l.name)}</label>`).join('') || '<span class="muted small">Add a building first.</span>';
  return `
<section class="section portal"><div class="wrap">
  <p><a href="/admin/clients">← All clients</a></p>
  <h1>${esc(client.name)}</h1>${flash(msg)}${flash(error, 'err')}
  ${tempPassword ? `<div class="flash flash-ok">Temporary password for <strong>${esc(tempPassword.email)}</strong>: <code>${esc(tempPassword.password)}</code><br>Share it with them privately. It is shown only once, and they must change it at first login.</div>` : ''}

  <h2>Buildings</h2>
  <div class="table-wrap"><table class="table"><thead><tr><th>Building</th><th>Address</th><th>Area</th><th></th></tr></thead><tbody>
  ${locations.map(l => `<tr><td>${esc(l.name)}</td><td>${esc(l.address)}</td><td>${esc(l.borough)}</td><td>${l.active ? '' : '<span class="muted">inactive</span>'}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">No buildings yet.</td></tr>'}
  </tbody></table></div>
  <form method="post" action="/admin/clients/${client.id}/locations" class="card form">
    <h3>Add a building</h3>${csrfField(csrf)}
    <div class="row3">
      <label>Name<input name="name" required maxlength="160" placeholder="e.g. 450 Atlantic Ave"></label>
      <label>Address<input name="address" maxlength="240"></label>
      <label>Area<select name="borough">${BOROUGHS.map(b => `<option>${b}</option>`).join('')}</select></label>
    </div>
    <button class="btn btn-sm">Add building</button>
  </form>

  <h2>Authorized users</h2>
  <p class="muted">Only these people can submit requests for ${esc(client.name)}, and only for the buildings checked. <strong>Approvers</strong> can also approve carpet, floor and other specialty work.</p>
  ${users.map(u => `
  <form method="post" action="/admin/users/${u.id}" class="card form user-card${u.active ? '' : ' inactive'}">
    ${csrfField(csrf)}
    <div class="row3">
      <label>Name<input name="name" required value="${esc(u.name)}"></label>
      <label>Title<input name="title" value="${esc(u.title)}"></label>
      <label>Role<select name="role"><option value="requester"${u.role === 'requester' ? ' selected' : ''}>Requester</option><option value="approver"${u.role === 'approver' ? ' selected' : ''}>Approver</option></select></label>
    </div>
    <div class="row3">
      <label>Email<input type="email" name="email" required value="${esc(u.email)}"></label>
      <label>Phone<input name="phone" value="${esc(u.phone)}"></label>
      <label>Access<select name="active"><option value="1"${u.active ? ' selected' : ''}>Active</option><option value="0"${u.active ? '' : ' selected'}>Disabled</option></select></label>
    </div>
    <fieldset class="chips"><legend>Authorized buildings</legend>${locCheckboxes(userLocs[u.id] || [])}</fieldset>
    <div class="cta-row"><button class="btn btn-sm">Save</button><button class="btn btn-sm btn-outline" name="reset" value="1">Reset password</button>
    <span class="muted small">Last login: ${u.last_login_at ? fmtDate(u.last_login_at) : 'never'}</span></div>
  </form>`).join('') || '<p class="empty">No users yet.</p>'}

  <form method="post" action="/admin/clients/${client.id}/users" class="card form">
    <h3>Add an authorized user</h3>${csrfField(csrf)}
    <div class="row3">
      <label>Name<input name="name" required maxlength="120"></label>
      <label>Title<input name="title" maxlength="120" placeholder="Property manager"></label>
      <label>Role<select name="role"><option value="requester">Requester</option><option value="approver">Approver</option></select></label>
    </div>
    <div class="row2">
      <label>Email<input type="email" name="email" required maxlength="160"></label>
      <label>Phone<input name="phone" maxlength="40"></label>
    </div>
    <fieldset class="chips"><legend>Authorized buildings</legend>${locCheckboxes()}</fieldset>
    <button class="btn btn-sm">Add user and create temporary password</button>
  </form>

  <form method="post" action="/admin/clients/${client.id}/active" class="inline-form">${csrfField(csrf)}
    <input type="hidden" name="active" value="${client.active ? 0 : 1}">
    <button class="linkbtn ${client.active ? 'danger' : ''}">${client.active ? 'Deactivate this client (blocks all their logins)' : 'Reactivate this client'}</button>
  </form>
</div></section>`;
}

function adminStaff({ staff, csrf, msg, tempPassword }) {
  return `
<section class="section portal"><div class="wrap">
  <h1>ESU admin</h1>${tabs('staff')}${flash(msg)}
  ${tempPassword ? `<div class="flash flash-ok">Temporary password for <strong>${esc(tempPassword.email)}</strong>: <code>${esc(tempPassword.password)}</code> (shown once)</div>` : ''}
  <div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Email</th><th>Last login</th><th>Status</th></tr></thead><tbody>
  ${staff.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.last_login_at ? fmtDate(u.last_login_at) : 'never'}</td><td>${u.active ? 'Active' : 'Disabled'}</td></tr>`).join('')}
  </tbody></table></div>
  <form method="post" action="/admin/staff" class="card form narrow-sm">
    <h2>Add ESU staff login</h2>${csrfField(csrf)}
    <label>Name<input name="name" required></label>
    <label>Email<input type="email" name="email" required></label>
    <button class="btn">Add staff member</button>
  </form>
</div></section>`;
}

function adminQuotes({ quotes, csrf }) {
  return `
<section class="section portal"><div class="wrap">
  <h1>ESU admin</h1>${tabs('quotes')}
  ${quotes.map(q => `<div class="card quote ${q.status}">
    <div class="page-head"><div><strong>${esc(q.name)}</strong>${q.company ? ` · ${esc(q.company)}` : ''} <span class="muted small">${fmtDate(q.created_at)}</span></div>
    <form method="post" action="/admin/quotes/${q.id}" class="inline-form">${csrfField(csrf)}<input type="hidden" name="status" value="${q.status === 'new' ? 'contacted' : 'new'}"><button class="btn btn-sm ${q.status === 'new' ? '' : 'btn-outline'}">${q.status === 'new' ? 'Mark contacted' : 'Mark new'}</button></form></div>
    <p><a href="mailto:${esc(q.email)}">${esc(q.email)}</a>${q.phone ? ` · <a href="tel:${esc(q.phone)}">${esc(q.phone)}</a>` : ''}${q.borough ? ` · ${esc(q.borough)}` : ''}</p>
    ${q.services ? `<p class="small"><strong>Services:</strong> ${esc(q.services)}</p>` : ''}
    ${q.message ? `<p class="pre">${esc(q.message)}</p>` : ''}
  </div>`).join('') || '<p class="empty">No quote requests yet.</p>'}
</div></section>`;
}

function adminLog({ rows }) {
  return `
<section class="section portal"><div class="wrap">
  <h1>ESU admin</h1>${tabs('log')}
  <p class="muted">Logins, failed logins and blocked attempts (for example, someone trying to submit for a building they are not authorized for).</p>
  <div class="table-wrap"><table class="table"><thead><tr><th>When</th><th>Who</th><th>Event</th><th>Detail</th><th>IP</th></tr></thead><tbody>
  ${rows.map(r => `<tr class="${/blocked|failed/.test(r.action) ? 'warn' : ''}"><td class="nowrap">${fmtDate(r.created_at)}</td><td>${esc(r.email)}</td><td>${esc(r.action)}</td><td>${esc(r.detail)}</td><td class="small">${esc(r.ip)}</td></tr>`).join('')}
  </tbody></table></div>
</div></section>`;
}

module.exports = { adminRequests, adminClients, adminClient, adminStaff, adminQuotes, adminLog };
