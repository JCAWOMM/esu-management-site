const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const BIZ = {
  name: 'ESU Management LLC',
  phone: process.env.BUSINESS_PHONE || '',
  email: process.env.BUSINESS_EMAIL || '',
  address: process.env.BUSINESS_ADDRESS || 'Brooklyn, NY',
  hours: process.env.BUSINESS_HOURS || '',
};
const tel = p => p.replace(/[^\d+]/g, '');

function layout({ title, body, user, csrf, active = '', description = '', bodyClass = '' }) {
  const portalNav = user
    ? `${user.role === 'admin' ? `<a href="/admin" class="${active === 'admin' ? 'on' : ''}">Admin</a>` : `<a href="/portal" class="${active === 'portal' ? 'on' : ''}">My requests</a>`}
       <form method="post" action="/logout" class="inline"><input type="hidden" name="_csrf" value="${esc(csrf)}"><button class="linkbtn">Sign out</button></form>`
    : `<a href="/login" class="btn btn-sm btn-outline">Client login</a>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title ? `${title} | ${BIZ.name}` : `${BIZ.name} | Janitorial, Maintenance & Restoration in NYC, Atlanta & Orangeburg`)}</title>
<meta name="description" content="${esc(description || 'Commercial janitorial, building maintenance, carpet cleaning and floor restoration for property managers in Brooklyn and all five NYC boroughs, Atlanta, GA and Orangeburg, SC.')}">
<link rel="icon" href="/img/logo.png">
<link rel="stylesheet" href="/styles.css">
</head>
<body class="${bodyClass}">
<header class="site-header">
  <div class="wrap header-row">
    <a href="/" class="brand"><img src="/img/logo.png" alt="" width="40" height="40"><span>ESU Management<small>Building &amp; Environmental Services</small></span></a>
    <input type="checkbox" id="navtoggle" class="navtoggle" aria-label="Menu">
    <label for="navtoggle" class="burger" aria-hidden="true"><span></span></label>
    <nav class="nav">
      <a href="/#services">Services</a>
      <a href="/#who">Who we serve</a>
      <a href="/#process">Process</a>
      <a href="/#coverage">Coverage</a>
      <a href="/#faq">FAQ</a>
      <a href="/#quote" class="btn btn-sm">Request a quote</a>
      ${portalNav}
    </nav>
  </div>
</header>
<main>${body}</main>
<footer class="site-footer">
  <div class="wrap footer-grid">
    <div>
      <a href="/" class="brand brand-light"><img src="/img/logo.png" alt="" width="36" height="36"><span>ESU Management LLC</span></a>
      <p>Janitorial • Maintenance • Restoration<br>Serving all five NYC boroughs,<br>Atlanta, GA and Orangeburg, SC.</p>
    </div>
    <div>
      <h4>Contact</h4>
      <p>${BIZ.phone ? `<a href="tel:${tel(BIZ.phone)}">${esc(BIZ.phone)}</a><br>` : ''}${BIZ.email ? `<a href="mailto:${esc(BIZ.email)}">${esc(BIZ.email)}</a><br>` : ''}${esc(BIZ.address)}${BIZ.hours ? `<br>${esc(BIZ.hours)}` : ''}</p>
    </div>
    <div>
      <h4>Clients</h4>
      <p><a href="/login">Client portal login</a><br><a href="/#quote">Request a quote</a><br><a href="/#faq">FAQ</a></p>
    </div>
  </div>
  <div class="wrap copyright">© ${new Date().getFullYear()} ESU Management LLC. All rights reserved.</div>
</footer>
</body>
</html>`;
}

function flash(msg, kind = 'ok') {
  return msg ? `<div class="flash flash-${kind}" role="status">${esc(msg)}</div>` : '';
}

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  return d.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

module.exports = { layout, esc, flash, fmtDate, BIZ, tel };
