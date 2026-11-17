const { esc, BIZ, tel, flash } = require('./layout');
const { BOROUGHS } = require('../rules');

const SERVICES = [
  ['janitorial', 'Commercial Janitorial', 'Daily or weekly cleaning, trash removal, restrooms, kitchens and high-touch points.'],
  ['common-areas', 'Residential & Common Areas', 'Lobbies, hallways, stairwells, elevators and garbage areas kept presentable for tenants.'],
  ['maintenance', 'General Maintenance', 'Light repairs, porter support, restocking and day-to-day building upkeep.'],
  ['carpet', 'Carpet Cleaning', 'Deep extraction, spot treatment, odor control and high-traffic refresh.'],
  ['floor', 'Tile & Floor Restoration', 'Deep scrub, strip and wax, buffing, VCT and hard floor restoration.'],
  ['special', 'Special & Emergency Services', 'Targeted disinfection, post-construction cleanup, move-in and move-out.'],
];
const WHO = [
  ['Property management', 'One vendor and one portal for every building in your portfolio.'],
  ['Multi-unit residential', 'Common areas, garbage rooms and turnover cleans that tenants notice.'],
  ['Offices', 'After-hours cleaning so your team walks into a clean space every morning.'],
  ['Retail', 'Storefronts, floors and restrooms ready before doors open.'],
  ['Warehouses', 'Break rooms, restrooms, offices and floor care for working facilities.'],
  ['Medical & professional suites', 'Detailed cleaning and disinfection for waiting rooms and exam areas.'],
  ['Schools & childcare', 'Scheduled cleaning around class hours with attention to touchpoints.'],
  ['Events & venues', 'Pre-event prep and post-event cleanup on your timeline.'],
];
const FAQ = [
  ['Do you offer after-hours cleaning?', 'Yes. We schedule day, evening and after-hours service to keep disruption to your building low.'],
  ['Can ESU service multiple buildings under one account?', 'Yes. Each building gets its own task plan and checklist, and your team manages every location from one client portal login.'],
  ['Who can submit service requests for our buildings?', 'Only people you authorize. We set up named portal users for your company and link each one to the buildings they manage, so every request shows exactly who sent it.'],
  ['Why do carpet and floor jobs need approval?', 'Carpet cleaning, floor restoration and other detailed work are billed separately. Those requests wait for sign-off from an approver on your team (or confirmation from ESU) before we schedule them. Routine janitorial and maintenance requests go straight to our crew.'],
  ['Can we request emergency service?', 'Yes. Choose Emergency priority in the portal for same-day response, or call us directly for immediate dispatch.'],
  ['How do we track a request?', 'Every request gets a ticket number. You can see its status, who submitted and approved it, and any notes or photos in the portal.'],
];

function home({ sent, error, form = {} } = {}) {
  const sel = (v, opt) => (v === opt ? ' selected' : '');
  return `
<section class="hero">
  <div class="wrap hero-grid">
    <div>
      <p class="eyebrow">New York City · Atlanta, GA · Orangeburg, SC</p>
      <h1>Cleaning, maintenance &amp; restoration for commercial and residential buildings</h1>
      <p class="lead">Janitorial, building upkeep, carpet and floor restoration for property managers who need the same standard at every site, every visit.</p>
      <div class="cta-row">
        <a href="#quote" class="btn btn-lg">Request a quote</a>
        <a href="/login" class="btn btn-lg btn-ghost">Client portal: submit a request</a>
      </div>
      ${BIZ.phone ? `<p class="hero-call">Need someone now? Call <a href="tel:${tel(BIZ.phone)}">${esc(BIZ.phone)}</a></p>` : ''}
    </div>
    <ul class="hero-points">
      <li><strong>Site-specific standards</strong><span>A checklist for every building, not a generic script.</span></li>
      <li><strong>Flexible schedules</strong><span>Day, night and after-hours crews.</span></li>
      <li><strong>Proof of service</strong><span>Notes and photo documentation on request.</span></li>
    </ul>
  </div>
</section>

<section id="services" class="section">
  <div class="wrap">
    <h2>Services built for real buildings</h2>
    <p class="section-lead">From daily janitorial to specialty restoration, one team handles it all.</p>
    <div class="cards cards-3">
      ${SERVICES.map(([img, t, d]) => `<article class="card service"><img src="/img/${img}.png" alt="" width="56" height="56" loading="lazy"><h3>${t}</h3><p>${d}</p></article>`).join('')}
    </div>
  </div>
</section>

<section id="who" class="section alt">
  <div class="wrap">
    <h2>Who we serve</h2>
    <p class="section-lead">Property managers and facilities teams that need consistent execution and fast response.</p>
    <div class="cards cards-4">
      ${WHO.map(([t, d]) => `<article class="card small"><h3>${t}</h3><p>${d}</p></article>`).join('')}
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap why-grid">
    <div>
      <h2>Why ESU Management</h2>
      <ul class="checks">
        <li>Local crews in New York, Atlanta and Orangeburg for faster response</li>
        <li>Location-based task plans and checklists</li>
        <li>Reliable crews across multiple sites</li>
        <li>Quality control and accountability on every visit</li>
        <li>Clear communication on every service call</li>
      </ul>
    </div>
    <div class="panel">
      <h3>Proof of service</h3>
      <p><strong>Request portal by location.</strong> Your team submits service calls per building, and each one is tracked with a ticket number.</p>
      <p><strong>Notes and photos.</strong> Crews can document completed work so you can confirm it without a site visit.</p>
      <p><strong>Specialty work on demand.</strong> Carpet, floor and special services are available when you need them, with your approval before anything is scheduled.</p>
    </div>
  </div>
</section>

<section id="process" class="section alt">
  <div class="wrap">
    <h2>Our process</h2>
    <ol class="steps">
      <li><span>1</span><h3>Walkthrough &amp; scope</h3><p>We confirm building needs, schedule, access and any special requirements.</p></li>
      <li><span>2</span><h3>Site plan &amp; checklist</h3><p>Location-specific tasks, frequencies and expectations, agreed in writing.</p></li>
      <li><span>3</span><h3>Service &amp; reporting</h3><p>Consistent execution, optional photo logs and clear resolution of service calls.</p></li>
    </ol>
    <p class="center"><a href="#quote" class="btn">Schedule a walkthrough</a></p>
  </div>
</section>

<section id="coverage" class="section">
  <div class="wrap coverage">
    <div>
      <h2>Coverage area</h2>
      <p class="section-lead">Full-service coverage across New York City, Atlanta, Georgia and Orangeburg, South Carolina.</p>
      <p>Brooklyn is our home base with the fastest response. Multi-location accounts across states are supported under one portal login.</p>
    </div>
    <ul class="boroughs">
      <li class="primary">Brooklyn <small>Primary focus, fastest response</small></li>
      <li>Manhattan <small>Full-service coverage</small></li>
      <li>Queens <small>Full-service coverage</small></li>
      <li>Bronx <small>Full-service coverage</small></li>
      <li>Staten Island <small>Full-service coverage</small></li>
      <li>Atlanta, GA <small>Full-service coverage</small></li>
      <li>Orangeburg, SC <small>Full-service coverage</small></li>
    </ul>
  </div>
</section>

<section id="portal" class="section dark">
  <div class="wrap portal-grid">
    <div>
      <p class="eyebrow">Clients only</p>
      <h2>Client portal: service requests</h2>
      <p>Authorized ESU clients log in to submit and track service calls for each of their buildings.</p>
      <ol class="mini-steps">
        <li>Choose your building</li>
        <li>Pick the request type and priority</li>
        <li>Add a description, access notes and photos</li>
        <li>Get a ticket number and track status</li>
      </ol>
      <a href="/login" class="btn btn-lg">Log in to the client portal</a>
      <p class="muted-light">Need portal access for someone on your team? Ask your account manager or your company's portal approver.</p>
    </div>
    <div class="panel panel-dark">
      <h3>How requests are handled</h3>
      <p><strong>Routine work goes straight through.</strong> Janitorial, general maintenance, trash removal and restocking requests go directly to our dispatch queue.</p>
      <p><strong>Specialty work needs approval.</strong> Carpet cleaning, floor restoration, disinfection, post-construction and other detailed work is held until an authorized approver at your company signs off.</p>
      <p><strong>Every request is accountable.</strong> Each ticket records who submitted it, for which building, and who approved it.</p>
    </div>
  </div>
</section>

<section id="faq" class="section">
  <div class="wrap narrow">
    <h2>Frequently asked questions</h2>
    ${FAQ.map(([q, a]) => `<details class="faq"><summary>${q}</summary><p>${a}</p></details>`).join('')}
  </div>
</section>

<section id="quote" class="section alt">
  <div class="wrap quote-grid">
    <div>
      <h2>Ready for consistent service across all your locations?</h2>
      <p class="section-lead">Tell us about your building and we'll set up a walkthrough. New clients use this form. Existing clients, please use the <a href="/login">client portal</a>.</p>
      ${BIZ.phone ? `<p>Call <a href="tel:${tel(BIZ.phone)}">${esc(BIZ.phone)}</a></p>` : ''}
      ${BIZ.email ? `<p>Email <a href="mailto:${esc(BIZ.email)}">${esc(BIZ.email)}</a></p>` : ''}
    </div>
    <form method="post" action="/quote#quote" class="form card">
      ${sent ? flash('Thanks! Your request was received. We will contact you within one business day.') : ''}
      ${error ? flash(error, 'err') : ''}
      <div class="row2">
        <label>Your name *<input name="name" required maxlength="120" value="${esc(form.name)}" autocomplete="name"></label>
        <label>Company / building<input name="company" maxlength="160" value="${esc(form.company)}" autocomplete="organization"></label>
      </div>
      <div class="row2">
        <label>Email *<input type="email" name="email" required maxlength="160" value="${esc(form.email)}" autocomplete="email"></label>
        <label>Phone<input type="tel" name="phone" maxlength="40" value="${esc(form.phone)}" autocomplete="tel"></label>
      </div>
      <label>Area
        <select name="borough"><option value="">Select…</option>${BOROUGHS.map(b => `<option${sel(form.borough, b)}>${b}</option>`).join('')}</select>
      </label>
      <fieldset class="chips"><legend>Services you need</legend>
        ${SERVICES.map(([, t]) => `<label class="chip"><input type="checkbox" name="services" value="${t}"${[].concat(form.services || []).includes(t) ? ' checked' : ''}> ${t}</label>`).join('')}
      </fieldset>
      <label>Tell us about the property<textarea name="message" rows="4" maxlength="3000" placeholder="Building type, size, how often you need service…">${esc(form.message)}</textarea></label>
      <label class="hp" aria-hidden="true">Leave blank<input name="website" tabindex="-1" autocomplete="off"></label>
      <button class="btn btn-lg">Request a quote</button>
    </form>
  </div>
</section>`;
}

module.exports = { home };
