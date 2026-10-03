/* Corrib Educate — Bookings (prototype). Vanilla JS, state persisted in localStorage. */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KEY = 'ce-system-v3';

/* ---------- state ---------- */
const fresh = () => ({ groups: structuredClone(SEED_GROUPS), emails: structuredClone(SEED_EMAILS), families: structuredClone(SEED_FAMILIES),
  settings: { ...SETTINGS_DEFAULT }, venues: structuredClone(SEED_VENUES), centreAddr: { ...CENTRE_ADDR }, nextId: 100, nextRef: 34, nextFam: 1000, nextVenue: 100 });
let S = (() => { try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch (e) {} return fresh(); })();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const ui = { role: 'sharon', region: 'dublin', status: 'all', month: 'all', q: '', calMonth: '2026-03', mail: 'e1', pick: null,
  drawer: null, dtab: 'details', trackerRegion: 'all', ftab: 'groups', fcentre: 'all', ptab: 'families',
  wiz: null, docGroup: null, confirming: null };

/* ---------- dates & money ---------- */
const D = iso => new Date(iso + 'T00:00:00Z');
const toISO = d => d.toISOString().slice(0, 10);
const addDays = (iso, n) => { const d = D(iso); d.setUTCDate(d.getUTCDate() + n); return toISO(d); };
const daysBetween = (a, b) => Math.round((D(b) - D(a)) / 864e5);
const fmt = iso => iso ? D(iso).toLocaleDateString('en-IE', { day: '2-digit', month: 'short', timeZone: 'UTC' }) : '—';
const fmtFull = iso => iso ? D(iso).toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';
const monthKey = iso => iso.slice(0, 7);
const monthName = key => D(key + '-01').toLocaleDateString('en-IE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const monthShort = key => D(key + '-01').toLocaleDateString('en-IE', { month: 'short', timeZone: 'UTC' });
const daysInMonth = key => new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7), 0)).getUTCDate();
const shiftMonth = (key, n) => { const d = D(key + '-01'); d.setUTCMonth(d.getUTCMonth() + n); return toISO(d).slice(0, 7); };
const eachNight = (a, b, fn) => { for (let d = a; d < b; d = addDays(d, 1)) fn(d); };
const nights = g => Math.max(0, daysBetween(g.arrival, g.departure));
const money = n => (n < 0 ? '−' : '') + '€' + Math.round(Math.abs(n)).toLocaleString('en-IE');
const inDays = iso => daysBetween(DEMO_TODAY, iso);
const dueText = n => n < 0 ? `${-n} day${n === -1 ? '' : 's'} overdue` : n === 0 ? 'today' : `in ${n} day${n === 1 ? '' : 's'}`;

/* ---------- domain helpers ---------- */
const regionOf = centre => REGIONS.find(r => r.centres.includes(centre));
const people = g => (+g.students || 0) + (+g.adults || 0);
const statusLabel = id => STATUSES.find(s => s.id === id)?.label || id;
// Beds are held by confirmed groups and by enquiries inside their confirm-by window. The waiting list holds nothing.
const held = g => g.status === 'confirmed' || g.status === 'enquiry';
const byId = id => S.groups.find(g => g.id === id);
const famById = id => S.families.find(f => f.id === id);
const lum = hex => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
const CLIENT_COLORS = ['#6366F1', '#059669', '#DB2777', '#0284C7', '#7C3AED', '#D97706', '#0F766E', '#C2410C', '#4F46E5', '#15803D', '#BE185D', '#0369A1'];
function clientColor(g) {
  const key = g.agent || g.school || String(g.id), hash = [...key].reduce((n, c) => ((n * 31) + c.charCodeAt(0)) >>> 0, 0);
  return CLIENT_COLORS[hash % CLIENT_COLORS.length];
}
const confirmed = () => S.groups.filter(g => g.status === 'confirmed');

function occupancy(centre, night, excludeId) {
  return S.groups.reduce((t, g) => t + (g.centre === centre && held(g) && g.id !== excludeId && g.arrival <= night && night < g.departure ? people(g) : 0), 0);
}
function peak(centre, from, to, excludeId) { let m = 0; eachNight(from, to, n => { m = Math.max(m, occupancy(centre, n, excludeId)); }); return m; }
function availability(region, from, to, need, excludeId) {
  return region.centres.map(c => { const p = peak(c, from, to, excludeId), cap = CENTRES[c].cap; return { centre: c, peak: p, cap, free: cap - p, ok: cap - p >= need }; });
}
const fits = g => peak(g.centre, g.arrival, g.departure, g.id) + people(g) <= CENTRES[g.centre].cap;
function conflicts() {
  const out = [];
  Object.keys(CENTRES).forEach(c => {
    const days = {}; S.groups.filter(g => g.centre === c && held(g)).forEach(g => eachNight(g.arrival, g.departure, n => { days[n] = 1; }));
    const bad = Object.keys(days).sort().filter(n => occupancy(c, n) > CENTRES[c].cap);
    if (bad.length) out.push({ centre: c, from: bad[0], to: bad[bad.length - 1], max: Math.max(...bad.map(n => occupancy(c, n))) });
  });
  return out;
}
const unprocessed = () => S.emails.filter(e => !e.processed);
const overlap = (a, b) => a.arrival < b.departure && b.arrival < a.departure;
function queuePos(g) {
  const q = S.groups.filter(x => x.status === 'waiting' && x.centre === g.centre && overlap(x, g)).sort((a, b) => a.enquiry.localeCompare(b.enquiry) || a.id - b.id);
  return q.findIndex(x => x.id === g.id) + 1;
}
const taskCount = g => TASKS.filter(([k]) => g.tasks?.[k]).length;
const placed = g => (g.alloc || []).reduce((t, a) => t + (+a.n || 0), 0);
function log(g, text) { (g.history ||= []).push({ t: DEMO_TODAY, text }); }

/* ---------- finance model ---------- */
function parseExtras(text) {
  if (!text) return [];
  return text.split(/\.\s+(?=[A-Z])|\s\/\s/).map(s => s.trim().replace(/\.$/, '')).filter(s => /€/.test(s)).map(s => {
    const m = /(\d+)\s*x\s*[^@€]*@\s*€\s*([\d.,]+)/i.exec(s);
    const a = /€\s*([\d,]+(?:\.\d+)?)/.exec(s);
    const amt = m ? +m[1] * parseFloat(m[2].replace(/,/g, '')) : parseFloat(a[1].replace(/,/g, ''));
    return { desc: s, amount: Math.round(amt * 100) / 100 };
  });
}
function finance(g) {
  const f = g.fin, n = nights(g), st = S.settings;
  const base = { desc: `Accommodation & programme — ${g.students || 0} students × ${n} nights × ${money(st.rate)}`, amount: (+g.students || 0) * n * st.rate, auto: true };
  const extras = f.extras ?? parseExtras(g.invoice);
  const income = [base, ...extras];
  const incTotal = income.reduce((t, l) => t + (+l.amount || 0), 0);
  const pl = placed(g), famEst = pl < people(g);
  const famCost = (famEst ? people(g) : pl) * n * st.familyRate;
  const other = (f.costs || []).reduce((t, l) => t + (+l.amount || 0), 0);
  const cost = famCost + other, profit = incTotal - cost;
  const due = addDays(g.arrival, -st.invoiceLeadDays);
  const depositPaid = f.deposit === 'paid' ? st.deposit : 0;
  return { n, income, incTotal, famCost, famEst, other, cost, profit, margin: incTotal ? profit / incTotal : 0, due, depositPaid, balance: incTotal - depositPaid };
}
const DEP = { none: '—', 'to-send': 'To send', sent: 'Sent', paid: 'Received' };
const INV = { none: 'Not started', draft: 'Draft', sent: 'Sent', paid: 'Paid' };
const famStatus = g => g.fin.familiesPaid ? 'Paid' : g.fin.familyListSent ? 'Ready to pay' : placed(g) ? 'List in progress' : 'No list yet';

/* ---------- status flow ---------- */
function askToConfirm(id) {
  const g = byId(id); if (!g) return; ui.confirming = id;
  $('#modal').innerHTML = `<div class="modal-bar"><div><b>Confirm group</b><div class="small muted">This action moves the group into confirmed work.</div></div><button class="btn" data-action="close-modal">Cancel</button></div>
    <div class="confirm-wrap"><div class="confirm-dialog"><span class="confirm-icon">✓</span><h2>Are you sure this group is confirmed?</h2><p>Once confirmed, <b>${esc(g.school)}</b> will move to Confirmed groups and Fernanda will receive a deposit task.</p>
      <div class="confirm-summary"><span><small>Centre</small><b>${esc(g.centre)}</b></span><span><small>Dates</small><b>${fmt(g.arrival)} – ${fmt(g.departure)}</b></span><span><small>Group</small><b>${g.students} students + ${g.adults} leaders</b></span></div>
      <label class="f">Confirmation date<input class="in" type="date" id="confirm-date" value="${DEMO_TODAY}"></label>
      <label class="f">Paste the agent's confirmation email <span class="muted">(optional)</span><textarea class="in" id="confirm-proof" rows="7" placeholder="Paste the email that confirms the booking, or leave this blank to continue without it."></textarea></label>
      <div class="confirm-note">The email is saved in the group activity as confirmation evidence. You can continue without it if the confirmation came by phone.</div>
      <div class="actions confirm-actions"><button class="btn" data-action="close-modal">Not yet</button><button class="btn primary lg" data-action="confirm-status" data-id="${g.id}">Confirm group & notify Fernanda</button></div>
    </div></div>`;
  $('#modal').classList.add('on');
}

function setStatus(id, status) {
  const g = byId(id); if (!g || g.status === status) return;
  const snap = structuredClone(g), nextRef = S.nextRef, from = g.status, centre = g.centre;
  if (status === 'confirmed' && from !== 'confirmed') delete snap.confirmation;
  g.status = status;
  log(g, `Status changed: ${statusLabel(from)} → ${statusLabel(status)}`);
  if (status === 'enquiry') {
    g.holdUntil = addDays(DEMO_TODAY, S.settings.holdDays);
    log(g, `Beds held at ${g.centre} — confirm by ${fmtFull(g.holdUntil)}`);
  }
  if (status === 'waiting') g.holdUntil = '';
  if (status === 'confirmed') {
    g.holdUntil = '';
    if (!g.ceRef) g.ceRef = `CE/${CENTRES[g.centre].code}26/${S.nextRef++}`;
    if (!g.fin.deposit || g.fin.deposit === 'none') g.fin.deposit = 'to-send';
    log(g, `Written to Confirmed groups as ${g.ceRef}`); log(g, `Fernanda notified — deposit request queued (${money(S.settings.deposit)})`);
  }
  save(); render(); if (ui.drawer === id) renderDrawer();
  const name = esc(g.school), undo = { id, snap, nextRef };
  if (status === 'confirmed') toast(`<span>✓ <b>${name}</b> confirmed as <b>${esc(g.ceRef)}</b>. Fernanda has been notified and has a ${money(S.settings.deposit)} deposit to send.</span><a href="#/tracker">Open confirmed group</a><button data-action="undo-status">Undo</button>`, 8000, undo);
  else if (status === 'cancelled') { toast(`<span><b>${name}</b> released — ${people(g)} beds freed at ${esc(centre)}</span><button data-action="undo-status">Undo</button>`, 7000, undo); setTimeout(() => offerPromotion(centre), 600); }
  else if (status === 'enquiry') toast(`<span><b>${name}</b> held at ${esc(g.centre)} until ${fmt(g.holdUntil)}</span>`, 4000);
  else toast(`<span><b>${name}</b> set to ${statusLabel(status)}</span>`, 3000);
}
let lastUndo = null;
function undoStatus() {
  if (!lastUndo) return; const g = byId(lastUndo.id);
  Object.assign(g, lastUndo.snap); S.nextRef = lastUndo.nextRef; lastUndo = null;
  save(); render(); if (ui.drawer === g.id) renderDrawer(); toast('<span>Undone</span>', 2000);
}
function promotable() {
  return S.groups.filter(g => g.status === 'waiting' && fits(g)).sort((a, b) => a.enquiry.localeCompare(b.enquiry) || a.id - b.id);
}
function offerPromotion(centre) {
  const g = promotable().find(x => x.centre === centre); if (!g) return;
  toast(`<span>Space opened at <b>${esc(centre)}</b> — <b>${esc(g.school)}</b> (${people(g)}) is first on the waiting list</span><button data-action="promote" data-id="${g.id}">Hold it now</button>`, 9000);
}

/* ---------- email parsing ---------- */
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
function knownAgents() {
  const set = new Set();
  S.groups.forEach(g => { if (g.agent) set.add(g.agent); });
  return [...set].sort();
}
function detectAgent(text) {
  const low = text.toLowerCase();
  const agents = knownAgents();
  for (const a of agents) { if (low.includes(a.toLowerCase())) return a; }
  const emailDomain = (text.match(/@([a-z0-9.-]+)/i) || [])[1] || '';
  for (const g of S.groups) { if (g.email && g.email.includes(emailDomain) && emailDomain.length > 3) return g.agent; }
  return null;
}
function parseEmail(body) {
  const hits = [], p = { students: null, adults: null, arrival: null, departure: null, region: null, centre: null, agent: null, contact: null, email: null, school: null, activities: null };
  let m;
  if ((m = /(\d+)\s*(?:students|pupils|children|kids)/i.exec(body))) { p.students = +m[1]; hits.push([m.index, m.index + m[0].length]); }
  if ((m = /(\d+)\s*(?:adults|leaders|teachers)/i.exec(body))) { p.adults = +m[1]; hits.push([m.index, m.index + m[0].length]); }
  if ((m = /(\d{1,2})(?:st|nd|rd|th)?\s*(?:-|–|to)\s*(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})(?:\s+(\d{4}))?/.exec(body)) && MONTHS[m[3].slice(0, 3).toLowerCase()]) {
    const mo = String(MONTHS[m[3].slice(0, 3).toLowerCase()]).padStart(2, '0'), y = m[4] || '2026';
    p.arrival = `${y}-${mo}-${m[1].padStart(2, '0')}`; p.departure = `${y}-${mo}-${m[2].padStart(2, '0')}`; hits.push([m.index, m.index + m[0].length]);
  }
  if ((m = /\b(Dublin|Galway|Cork|Monaghan)\b/i.exec(body))) { p.region = m[1].toLowerCase(); hits.push([m.index, m.index + m[0].length]); }
  p.centre = Object.keys(CENTRES).find(c => new RegExp(`\\b${c}\\b`, 'i').test(body)) || null;
  p.agent = detectAgent(body);
  if ((m = /(?:^|\n)\s*(?:From|De|Sent by|Kind regards|Best regards|Cordialement)[,:\s]*([A-ZÀ-Ü][a-zà-ü]+(?: [A-ZÀ-Ü][a-zà-ü]+)?)/m.exec(body))) p.contact = m[1].trim();
  if ((m = /[\w.-]+@[\w.-]+\.[a-z]{2,}/i.exec(body))) p.email = m[0];
  if ((m = /(?:Collège|College|Lycée|Lycee|school|école|escuela)\s+([^\n,;:]{3,40})/i.exec(body))) { p.school = m[0].trim(); hits.push([m.index, m.index + m[0].length]); }
  if ((m = /(?:would like|activities?(?: requested)?|visits?(?: requested)?|interested in)\s*:?[\s]*(?:to\s+)?([^\n.]{4,140})/i.exec(body))) { p.activities = m[1].trim(); hits.push([m.index, m.index + m[0].length]); }
  return { p, hits };
}
function highlight(body, hits) {
  let out = '', i = 0;
  [...hits].sort((a, b) => a[0] - b[0]).forEach(([s, e]) => { out += esc(body.slice(i, s)) + '<mark>' + esc(body.slice(s, e)) + '</mark>'; i = e; });
  return out + esc(body.slice(i));
}
const blankFin = () => ({ deposit: 'none', invoice: 'none', extras: undefined, costs: [], familyListSent: '', familiesPaid: false });
const blankGroup = o => ({ id: S.nextId++, agent: '', contact: '', email: '', school: 'New group', ref: '', ceRef: null, centre: 'Bray', arrival: '2026-04-06', departure: '2026-04-10',
  status: 'enquiry', enquiry: DEMO_TODAY, students: 30, adults: 3, breakdown: '', age: '', notes: '', invoice: '', coach: '', holdUntil: '',
  activities: '', tasks: Object.fromEntries([...TASKS, ...AFTER_TASKS].map(([k]) => [k, false])), programme: {}, leaders: '', alloc: [], fin: blankFin(), history: [], ...o });

function addFromEmail(id) {
  const e = S.emails.find(x => x.id === id), { p } = parseEmail(e.body);
  const region = REGIONS.find(r => r.id === p.region) || REGIONS[0];
  const centre = ui.pick && region.centres.includes(ui.pick) ? ui.pick : region.centres[0];
  const need = (p.students || 0) + (p.adults || 0), ok = peak(centre, p.arrival, p.departure) + need <= CENTRES[centre].cap;
  const g = blankGroup({ agent: e.agent, contact: e.from, email: e.email, school: `New group via ${e.agent}`, centre, arrival: p.arrival, departure: p.departure,
    students: p.students, adults: p.adults || 0, status: ok ? 'enquiry' : 'waiting', holdUntil: ok ? addDays(DEMO_TODAY, S.settings.holdDays) : '' });
  log(g, `Request received by email from ${e.from} (${e.agent})`);
  log(g, ok ? `Added to ${region.name} pipeline — ${need} beds held at ${centre} until ${fmtFull(g.holdUntil)}` : `No room at ${centre} — placed on the waiting list`);
  S.groups.push(g); e.processed = true; e.groupId = g.id; ui.region = region.id; ui.pick = null;
  save(); render(); openGroup(g.id);
  toast(ok ? `<span>✓ Request from <b>${esc(e.agent)}</b> added — beds held at ${esc(centre)} until ${fmt(g.holdUntil)}</span><a href="#/pipeline">View pipeline</a>`
    : `<span><b>${esc(e.agent)}</b> added to the waiting list at ${esc(centre)} — no beds held</span><a href="#/pipeline">View pipeline</a>`, 6500);
}
function newBlank() {
  const g = blankGroup({ centre: REGIONS.find(r => r.id === ui.region).centres[0], holdUntil: addDays(DEMO_TODAY, S.settings.holdDays) });
  log(g, 'Created manually'); S.groups.push(g); save(); render(); openGroup(g.id);
}

/* ---------- ui bits ---------- */
const ICON = {
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>', cal: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>',
  book: '<path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M8 4v16"/>', euro: '<path d="M18 6.5A7 7 0 1 0 18 17.5M4 10h10M4 14h10"/>',
  house: '<path d="M3 12l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  down: '<path d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14"/>', left: '<path d="M15 6l-6 6 6 6"/>', right: '<path d="M9 6l6 6-6 6"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  print: '<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>', swap: '<path d="M7 7h13l-4-4M17 17H4l4 4"/>',
};
const icon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`;
const chip = (s, label) => `<span class="chip ${s}">${label || statusLabel(s)}</span>`;
const statusSelect = g => `<select class="sel ${g.status}" data-change="status" data-id="${g.id}" aria-label="Status">${STATUSES.map(s => `<option value="${s.id}" ${s.id === g.status ? 'selected' : ''}>${s.label}</option>`).join('')}</select>`;
const finSelect = (g, key, map, cls) => `<select class="sel ${cls(g.fin[key])}" data-change="fin" data-k="${key}" data-id="${g.id}" aria-label="${key}">${Object.entries(map).map(([v, l]) => `<option value="${v}" ${v === g.fin[key] ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
const depCls = v => ({ paid: 'confirmed', sent: 'enquiry', 'to-send': 'waiting', none: 'neutral' }[v]);
const invCls = v => ({ paid: 'confirmed', sent: 'enquiry', draft: 'waiting', none: 'neutral' }[v]);
const breakdownText = g => [`${g.students ?? '?'}+${g.adults ?? 0}`, g.breakdown, g.age ? `${g.age} yr olds` : ''].filter(Boolean).join('. ');
const bar = (v, max, color) => `<div class="meter"><i style="width:${Math.min(100, max ? v / max * 100 : 0)}%;${color ? `background:${color}` : ''}"></i></div>`;

function toast(html, ms = 4000, undo) {
  if (undo) lastUndo = undo;
  const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = html; $('#toasts').append(el); setTimeout(() => el.remove(), ms);
}

/* ---------- sidebar & roles ---------- */
const NAV = {
  sharon: [['dashboard', 'Today', 'home'], ['inbox', 'New inquiry', 'plus'], ['pipeline', 'Pipeline', 'list'], ['calendar', 'Centre calendar', 'cal'], ['tracker', 'Confirmed groups', 'book'], ['documents', 'Documents', 'folder'], ['families', 'Families & venues', 'house']],
  fernanda: [['finance', 'Finance', 'euro'], ['tracker', 'Confirmed groups', 'book'], ['documents', 'Documents', 'folder'], ['families', 'Families & venues', 'house'], ['calendar', 'Centre calendar', 'cal']],
};
const route = () => (location.hash.replace('#/', '') || (ui.role === 'sharon' ? 'dashboard' : 'finance')).split('/')[0];
function renderSide() {
  const r = route(), n = unprocessed().length, who = ui.role === 'sharon' ? ['S', 'Sharon', 'Group bookings'] : ['F', 'Fernanda', 'Finance'];
  const badge = id => id === 'finance' ? (financeTodos() ? `<em class="count">${financeTodos()}</em>` : '') : '';
  $('#side').innerHTML = `
    <div class="brand"><img src="assets/corrib-educate-logo.png" alt="Corrib Educate"></div>
    <div class="who"><div class="avatar">${who[0]}</div><div>${who[1]}<small>${who[2]}</small></div></div>
    <div class="label">${ui.role === 'sharon' ? 'Bookings' : 'Finance'}</div>
    ${NAV[ui.role].map(([id, label, ic]) => `<a class="nav ${r === id ? 'on' : ''}" href="#/${id}">${icon(ic)}<span>${label}</span>${badge(id)}</a>`).join('')}
    <div class="spacer"></div>
    <button class="nav switch" data-action="switch-role" title="Demo: see the system as the other person">${icon('swap')}<span>View as ${ui.role === 'sharon' ? 'Fernanda' : 'Sharon'}</span></button>
    <button class="nav dim" data-action="reset" title="Restore the original demo data">${icon('left')}<span>Reset demo data</span></button>`;
}
function financeTodos() {
  return confirmed().filter(g => g.fin.deposit === 'to-send').length + confirmed().filter(g => ['none', 'draft'].includes(g.fin.invoice) && inDays(finance(g).due) <= 14).length
    + confirmed().filter(g => g.fin.familyListSent && !g.fin.familiesPaid).length;
}

/* ---------- views: Sharon ---------- */
function viewDashboard() {
  const conf = confirmed();
  const today = D(DEMO_TODAY), day = today.getUTCDay() || 7;
  const weekStart = addDays(DEMO_TODAY, 1 - day), weekEnd = addDays(weekStart, 6);
  const arrivals = conf.filter(g => g.arrival >= weekStart && g.arrival <= weekEnd).sort((a, b) => a.arrival.localeCompare(b.arrival));
  const holds = S.groups.filter(g => g.status === 'enquiry' && g.holdUntil).sort((a, b) => a.holdUntil.localeCompare(b.holdUntil));
  const decisions = holds.filter(g => g.holdUntil <= weekEnd);
  const nextArrivals = conf.filter(g => g.arrival > weekEnd).sort((a, b) => a.arrival.localeCompare(b.arrival)).slice(0, 3);
  const prepSoon = conf.filter(g => inDays(g.arrival) >= 0 && inDays(g.arrival) <= 21 && taskCount(g) < TASKS.length).sort((a, b) => a.arrival.localeCompare(b.arrival));

  const arrivalRows = arrivals.map(g => `<button class="weekly-row" data-action="open-prep" data-id="${g.id}">
    <span class="date-tile"><b>${D(g.arrival).getUTCDate()}</b><small>${monthShort(monthKey(g.arrival))}</small></span>
    <span class="grow"><strong>${esc(g.school)}</strong><small>${esc(g.centre)} · ${people(g)} people · ${esc(g.agent)}</small></span>
    <span class="chip ${taskCount(g) === TASKS.length ? 'confirmed' : 'waiting'}">${taskCount(g)}/${TASKS.length} ready</span></button>`).join('');
  const decisionRows = decisions.map(g => { const d = inDays(g.holdUntil); return `<button class="weekly-row" data-action="open" data-id="${g.id}">
    <span class="date-tile ${d < 0 ? 'late' : ''}"><b>${D(g.holdUntil).getUTCDate()}</b><small>${monthShort(monthKey(g.holdUntil))}</small></span>
    <span class="grow"><strong>${esc(g.school)}</strong><small>${esc(g.agent)} · ${people(g)} beds held at ${esc(g.centre)}</small></span>
    <span class="chip ${d < 0 ? 'warn' : 'waiting'}">${d < 0 ? 'Overdue' : d === 0 ? 'Today' : `In ${d} days`}</span></button>`; }).join('');

  return `
  <div class="page-head dashboard-head"><div><div class="eyebrow">Week of ${fmt(weekStart)}</div><h1>Good morning, Sharon</h1><p>Your most important work for this week, all in one place.</p></div>
    <div class="actions"><a class="btn lg primary" href="#/inbox">${icon('plus')} Add a new inquiry</a></div></div>
  <div class="week-summary">
    <div class="summary-card arrivals"><span class="summary-icon">${icon('cal')}</span><div><b>${arrivals.length}</b><span>School${arrivals.length === 1 ? '' : 's'} arriving this week</span></div></div>
    <div class="summary-card decisions"><span class="summary-icon">${icon('book')}</span><div><b>${decisions.length}</b><span>${decisions.length === 1 ? 'Request needs' : 'Requests need'} confirmation</span></div></div>
  </div>
  <div class="weekly-grid">
    <section class="card weekly-card"><div class="card-h"><div><h2>Schools arriving this week</h2><p>${fmt(weekStart)} – ${fmt(weekEnd)}</p></div><span class="count-soft">${arrivals.length}</span></div>
      <div class="weekly-list">${arrivalRows || `<div class="calm-empty"><span>✓</span><div><b>No arrivals this week</b><small>You have no school arrivals to prepare for this week.</small></div></div>`}</div></section>
    <section class="card weekly-card"><div class="card-h"><div><h2>Requests to confirm</h2><p>Confirm-by dates due this week</p></div><span class="count-soft warm">${decisions.length}</span></div>
      <div class="weekly-list">${decisionRows || `<div class="calm-empty"><span>✓</span><div><b>Nothing needs confirmation</b><small>There are no confirm-by dates due this week.</small></div></div>`}</div></section>
  </div>
  <section class="card later-card"><div class="card-h"><div><h2>Coming up next</h2><p>A quick look ahead—no action needed today.</p></div><a href="#/calendar">Open calendar →</a></div>
    <div class="later-list">${nextArrivals.map(g => `<button class="later-item" data-action="open-prep" data-id="${g.id}"><span class="dot" style="background:${CENTRES[g.centre].color}"></span><span class="grow"><b>${esc(g.school)}</b><small>${fmt(g.arrival)} · ${esc(g.centre)} · ${people(g)} people</small></span>${prepSoon.includes(g) ? '<span class="chip neutral">Prepare soon</span>' : ''}</button>`).join('') || '<div class="empty">No later arrivals scheduled.</div>'}</div></section>`;
}

/* ---------- New request wizard ---------- */
const DEMO_INQUIRY_EMAIL = `From: Amélie Bernard <amelie@verdieopenclass.com>
To: Sharon <bookings@corribeducate.com>
Subject: New Dublin group — April 2026

Hello Sharon,

We have a new request for Collège Jean Moulin: 42 students and 4 adults, travelling 13-17 April 2026. The group would prefer Bray and host-family accommodation.

They would like Irish dancing, a Dublin city tour, and the EPIC Museum.

The students are aged 14–15. Could you please check availability and hold the space if possible?

Best regards,
Amélie Bernard
Verdie Open Class`;
const WIZ_STEPS = ['Paste email', 'Confirm details', 'Check availability', 'Done'];
function wizReset() { ui.wiz = { step: 0, raw: DEMO_INQUIRY_EMAIL, parsed: null, agent: '', contact: '', email: '', school: '', students: '', adults: '', arrival: '', departure: '', region: 'dublin', preferredCentre: '', activities: '', pick: null, result: null }; }
function wizParse() {
  const w = ui.wiz, { p, hits } = parseEmail(w.raw);
  w.parsed = p; w.hits = hits;
  if (p.agent) w.agent = p.agent;
  if (p.contact) w.contact = p.contact;
  if (p.email) w.email = p.email;
  if (p.school) w.school = p.school;
  if (p.students) w.students = String(p.students);
  if (p.adults != null) w.adults = String(p.adults);
  if (p.arrival) w.arrival = p.arrival;
  if (p.departure) w.departure = p.departure;
  if (p.region) w.region = p.region;
  if (p.centre) { w.preferredCentre = p.centre; w.pick = p.centre; w.region = regionOf(p.centre).id; }
  if (p.activities) w.activities = p.activities;
}
function wizSubmit() {
  const w = ui.wiz;
  const region = w.preferredCentre ? regionOf(w.preferredCentre) : REGIONS.find(r => r.id === w.region) || REGIONS[0];
  const centre = w.pick || region.centres[0];
  const need = (+w.students || 0) + (+w.adults || 0);
  const ok = peak(centre, w.arrival, w.departure) + need <= CENTRES[centre].cap;
  const g = blankGroup({ agent: w.agent, contact: w.contact, email: w.email, school: w.school || `New group via ${w.agent}`,
    centre, arrival: w.arrival, departure: w.departure, students: +w.students || 0, adults: +w.adults || 0,
    activities: w.activities || '', status: ok ? 'enquiry' : 'waiting', holdUntil: ok ? addDays(DEMO_TODAY, S.settings.holdDays) : '' });
  log(g, `Request added by Sharon from pasted email`);
  log(g, ok ? `${need} beds held at ${centre} until ${fmtFull(g.holdUntil)}` : `No room at ${centre} — placed on the waiting list`);
  S.groups.push(g); ui.region = region.id; w.step = 3; w.result = { id: g.id, status: g.status, centre: g.centre, holdUntil: g.holdUntil };
  save(); render();
}

function viewNewRequest() {
  if (!ui.wiz) wizReset();
  const w = ui.wiz, step = w.step;
  const progress = WIZ_STEPS.map((label, i) => { const finished = step === 3 && i === 3; return `<div class="wiz-step ${i < step || finished ? 'done' : ''} ${i === step && !finished ? 'active' : ''}">${i < step || finished ? '✓' : i + 1}</div><span class="wiz-label ${i === step ? 'active complete' : ''}">${label}</span>${i < WIZ_STEPS.length - 1 ? `<div class="wiz-line ${i < step ? 'done' : ''}"></div>` : ''}`; }).join('');
  const agents = knownAgents();
  const agentMatch = w.agent && agents.find(a => a.toLowerCase() === w.agent.toLowerCase());

  let body = '';
  if (step === 0) {
    body = `<div class="card" style="max-width:720px">
      <div class="card-h"><div><h2>Paste the agent's email</h2><p class="small muted" style="margin:4px 0 0">A complete demo email is ready below—just click Extract details.</p></div><span class="chip enquiry">Demo example</span></div>
      <div class="card-b">
        <p class="muted" style="margin:0 0 16px">In real use, Sharon copies an email from Outlook and pastes it here. The system reads the student and adult numbers, dates, school, agent, and preferred region.</p>
        <textarea class="in" id="wiz-paste" rows="10" placeholder="Paste the email text here…" style="font-size:14px;line-height:1.6;min-height:200px">${esc(w.raw)}</textarea>
        <div style="display:flex;gap:12px;margin-top:18px;align-items:center">
          <button class="btn lg primary" data-action="wiz-extract" ${!w.raw ? 'disabled' : ''}>${icon('right')} Extract details</button>
          <span class="muted">or</span>
          <button class="btn lg" data-action="wiz-manual">Enter manually</button>
        </div>
      </div></div>`;
  } else if (step === 1) {
    const agentInitial = (w.agent || w.contact || 'A').trim().charAt(0).toUpperCase();
    body = `<div class="card wizard-card">
      <div class="card-h wizard-title"><div><h2>Check the booking details</h2><p>Make sure the school, group size and dates are correct.</p></div></div>
      <div class="card-b">
        ${agentMatch ? `<div class="agent-match"><span class="agent-mini">${esc(agentInitial)}</span><div><b>${esc(agentMatch)}</b><small>Existing agent — this request will be linked automatically</small></div></div>` : ''}
        ${w.raw ? `<details class="source-email"><summary>View the original email</summary><div>${highlight(w.raw, w.hits || [])}</div></details>` : ''}
        <fieldset class="wizard-section"><legend>Booking</legend><div class="form wizard-form">
          <label class="f full">School / group name <input class="in" id="wiz-school" value="${esc(w.school)}" placeholder="e.g. Collège Jean Moulin"></label>
          <label class="f">Students <input class="in" id="wiz-students" type="number" min="1" value="${esc(w.students)}" placeholder="30"></label>
          <label class="f">Adults / leaders <input class="in" id="wiz-adults" type="number" min="0" value="${esc(w.adults)}" placeholder="3"></label>
          <label class="f">Arrival <input class="in" id="wiz-arrival" type="date" value="${esc(w.arrival)}"></label>
          <label class="f">Departure <input class="in" id="wiz-departure" type="date" value="${esc(w.departure)}"></label>
          <label class="f">Preferred region<select class="in" id="wiz-region">${REGIONS.map(r => `<option value="${r.id}" ${w.region === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}</select></label>
          <label class="f">Preferred centre <span class="muted">(optional)</span><select class="in" id="wiz-preferred-centre"><option value="">Any centre in the region</option>${REGIONS.map(r => `<optgroup label="${r.name}">${r.centres.map(c => `<option value="${c}" ${w.preferredCentre === c ? 'selected' : ''}>${c}</option>`).join('')}</optgroup>`).join('')}</select></label>
          <label class="f full">Requested activities or special requests<textarea class="in" id="wiz-activities" rows="3" placeholder="e.g. Irish dancing, EPIC Museum, football, packed lunches…">${esc(w.activities)}</textarea><span class="small muted">These are extracted when the email mentions them, and Sharon can correct or add anything.</span></label>
        </div></fieldset>
        <fieldset class="wizard-section"><legend>Agent contact</legend><div class="form wizard-form">
          <label class="f">Agent name <input class="in" id="wiz-agent" value="${esc(w.agent)}" list="agents-list" placeholder="e.g. VTO, Envol, Verdié…"></label>
          <label class="f">Contact person <input class="in" id="wiz-contact" value="${esc(w.contact)}" placeholder="e.g. Geraldine"></label>
          <label class="f full">Agent email <input class="in" id="wiz-email" value="${esc(w.email)}" placeholder="e.g. agent@voyages.com"></label>
        </div></fieldset>
        <datalist id="agents-list">${agents.map(a => `<option value="${esc(a)}">`).join('')}</datalist>
        <div class="wizard-actions">
          <button class="btn" data-action="wiz-back">${icon('left')} Back</button>
          <button class="btn lg primary" data-action="wiz-to-avail" ${!(w.students && w.arrival && w.departure) ? 'disabled' : ''}>${icon('right')} Check availability</button>
        </div>
      </div></div>`;
  } else if (step === 2) {
    const region = w.preferredCentre ? regionOf(w.preferredCentre) : REGIONS.find(r => r.id === w.region) || REGIONS[0];
    const need = (+w.students || 0) + (+w.adults || 0);
    const av = availability(region, w.arrival, w.departure, need);
    if (!w.pick || !region.centres.includes(w.pick)) w.pick = (av.find(a => a.ok) || av[0]).centre;
    const pickOk = av.find(a => a.centre === w.pick)?.ok;
    body = `<div class="card" style="max-width:720px">
      <div class="card-h"><h2>Where can they stay?</h2><span class="muted">${need} beds needed · ${fmt(w.arrival)} – ${fmt(w.departure)}</span></div>
      <div class="card-b">
        <div class="opts">${av.map(a => `<button class="opt ${w.pick === a.centre ? 'on' : ''} ${a.ok ? '' : 'no'}" data-action="wiz-pick" data-centre="${a.centre}">
            <span class="dot" style="background:${CENTRES[a.centre].color}"></span><span class="name">${a.centre}</span>
            <span class="meter"><i style="width:${Math.min(100, a.peak / a.cap * 100)}%;background:${a.ok ? CENTRES[a.centre].color : 'var(--warn)'}"></i></span>
            <span class="free">${a.ok ? `<b style="color:var(--primary)">${a.free} beds free</b>` : `<b style="color:var(--warn)">Full — short by ${need - a.free}</b>`}<span class="muted"> · ${a.peak}/${a.cap} held</span></span></button>`).join('')}</div>
        <div style="display:flex;gap:12px;margin-top:22px;align-items:center;flex-wrap:wrap">
          <button class="btn" data-action="wiz-back">${icon('left')} Back</button>
          <button class="btn lg primary" data-action="wiz-submit">${icon('plus')} ${pickOk ? `Hold ${need} beds at ${esc(w.pick)}` : `Join waiting list at ${esc(w.pick)}`}</button>
          <span class="small muted">${pickOk ? `Held for ${S.settings.holdDays} days — agent must confirm by then.` : 'No beds held. First on the list if someone drops.'}</span>
        </div>
      </div></div>`;
  } else if (step === 3) {
    const result = w.result, g = result && byId(result.id), held = result?.status === 'enquiry';
    body = `<div class="done-page"><span class="done-check">✓</span><div class="done-kicker">All four steps complete</div><h2>Inquiry added successfully</h2><h3>${esc(g?.school || w.school)}</h3>
      <p>${held ? `Beds are provisionally held at <b>${esc(result.centre)}</b> until <b>${fmtFull(result.holdUntil)}</b>. This is still an inquiry—not a confirmed booking.` : `<b>${esc(result?.centre)}</b> was full, so the group is on that centre's waiting list. No beds are currently held.`}</p>
      <div class="done-summary"><span><small>Status</small>${chip(held ? 'enquiry' : 'neutral', held ? 'Enquiry · beds held' : 'Waiting list')}</span><span><small>Dates</small><b>${fmt(w.arrival)} – ${fmt(w.departure)}</b></span><span><small>Group</small><b>${w.students} students + ${w.adults || 0} leaders</b></span>${w.activities ? `<span class="wide"><small>Requested activities</small><b>${esc(w.activities)}</b></span>` : ''}</div>
      <div class="done-next"><b>What happens next?</b><span>Sharon follows up with the agent. Only after written or phone confirmation should she change the status to Confirmed.</span></div>
      <div class="actions done-actions"><button class="btn" data-action="wiz-another">${icon('plus')} Add another inquiry</button><button class="btn" data-action="wiz-open" data-id="${g?.id}">Review full details</button><button class="btn primary lg" data-action="wiz-view-pipeline" data-status="${result?.status}">Finish process ${icon('right')}</button></div>
    </div>`;
  }

  return `
  <div class="page-head"><div><h1>${step === 3 ? 'Inquiry complete' : 'New inquiry'}</h1><p>${step === 3 ? 'The inquiry is saved and ready for Sharon to follow up.' : 'Paste an agent email and the system extracts the details. Check it once, then add it to the pipeline.'}</p></div>
    ${step === 3 ? '' : `<div class="actions"><button class="btn" data-action="wiz-cancel">${icon('x')} Cancel</button></div>`}</div>
  <div class="wiz-progress">${progress}</div>
  ${body}`;
}

function viewInbox() { return viewNewRequest(); }

function regionTabs(action) {
  return `<div class="tabs">${REGIONS.map(r => `<button class="tab ${ui.region === r.id ? 'on' : ''}" data-action="${action}" data-region="${r.id}">${r.name}<span class="c">${S.groups.filter(g => regionOf(g.centre).id === r.id && g.status !== 'cancelled').length}</span></button>`).join('')}</div>`;
}
function deadlineCell(g) {
  if (g.status === 'enquiry' && g.holdUntil) { const d = inDays(g.holdUntil); return `<span class="chip ${d < 0 ? 'warn' : d <= 7 ? 'waiting' : 'neutral'}">Confirm by ${fmt(g.holdUntil)} · ${d < 0 ? 'passed' : dueText(d)}</span>`; }
  if (g.status === 'waiting') return `<span class="chip neutral">Waiting list #${queuePos(g)}${fits(g) ? ' · room now' : ''}</span>`;
  return '';
}
function viewPipeline() {
  const q = ui.q.trim().toLowerCase();
  const rows = S.groups.filter(g => regionOf(g.centre).id === ui.region && (ui.status === 'all' || g.status === ui.status) && (ui.month === 'all' || monthKey(g.arrival) === ui.month)
    && (!q || [g.agent, g.contact, g.school, g.ref, g.centre, g.notes].join(' ').toLowerCase().includes(q))).sort((a, b) => a.arrival.localeCompare(b.arrival));
  const months = [...new Set(S.groups.filter(g => regionOf(g.centre).id === ui.region).map(g => monthKey(g.arrival)))].sort();
  const sum = rows.filter(g => g.status !== 'cancelled').reduce((t, g) => t + people(g), 0);
  return `
  <div class="page-head"><div><h1>Pipeline</h1><p>The same columns you know from Excel — but status changes write straight into the Booking Tracker.</p></div>
    <div class="actions"><button class="btn primary" data-action="new">${icon('plus')} New request</button></div></div>
  ${regionTabs('region')}
  <div class="toolbar">
    <input class="search" id="q" data-input="q" placeholder="Search agent, school, centre…" value="${esc(ui.q)}" aria-label="Search">
    ${['all', ...STATUSES.map(s => s.id)].map(s => `<button class="pill ${ui.status === s ? 'on' : ''}" data-action="status-filter" data-s="${s}">${s === 'all' ? 'All statuses' : statusLabel(s)}</button>`).join('')}
    <span style="width:8px"></span>
    ${['all', ...months].map(m => `<button class="pill ${ui.month === m ? 'on' : ''}" data-action="month-filter" data-m="${m}">${m === 'all' ? 'All months' : monthShort(m) + ' ' + m.slice(2, 4)}</button>`).join('')}
    <span class="small muted" style="margin-left:auto">${rows.length} groups · ${sum.toLocaleString()} people</span>
  </div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Status</th><th>Agent</th><th>Contact</th><th>Reference</th><th>Enquired</th><th>Centre</th><th>Arrival</th><th>Departure</th><th>Students + adults</th><th>Relevant information</th></tr></thead>
  <tbody>${rows.map(g => `<tr class="${g.status === 'cancelled' ? 'is-cancelled' : ''}" data-action="open" data-id="${g.id}">
    <td data-stop>${statusSelect(g)}</td><td class="agent">${esc(g.agent)}</td><td>${esc(g.contact)}</td><td>${esc(g.school)}</td><td class="nowrap">${fmt(g.enquiry)}</td>
    <td><span class="dot" style="display:inline-block;background:${CENTRES[g.centre].color};margin-right:6px"></span>${esc(g.centre)}</td>
    <td class="nowrap">${fmt(g.arrival)}</td><td class="nowrap">${fmt(g.departure)}</td><td class="nowrap">${g.students ?? '?'} + ${g.adults ?? 0}</td><td class="notes">${esc(g.activities || g.notes)}</td></tr>`).join('')
    || '<tr><td colspan="10" class="empty">No groups match these filters.</td></tr>'}</tbody></table></div>`;
}

function viewCalendar() {
  const region = REGIONS.find(r => r.id === ui.region), key = ui.calMonth, n = daysInMonth(key), first = key + '-01', last = `${key}-${String(n).padStart(2, '0')}`;
  const days = Array.from({ length: n }, (_, i) => `${key}-${String(i + 1).padStart(2, '0')}`);
  let row = 2, cells = `<div class="lbl hd" style="grid-row:1;grid-column:1"><b>${esc(region.name)}</b><span class="small muted">beds held / capacity</span></div>`;
  days.forEach((d, i) => { const wd = D(d).getUTCDay(); cells += `<div class="hd ${wd === 0 || wd === 6 ? 'we' : ''}" style="grid-row:1;grid-column:${i + 2}"><b>${i + 1}</b>${'SMTWTFS'[wd]}</div>`; });
  region.centres.forEach(c => {
    const gs = S.groups.filter(g => g.centre === c && g.status !== 'cancelled' && g.departure >= first && g.arrival <= last).sort((a, b) => a.arrival.localeCompare(b.arrival));
    const lanes = [], placedBars = gs.map(g => {
      const s = g.arrival < first ? first : g.arrival, e = g.departure > last ? last : g.departure, si = days.indexOf(s), ei = days.indexOf(e);
      let l = lanes.findIndex(end => end < s); if (l < 0) { l = lanes.length; lanes.push(''); } lanes[l] = e; return { g, si, ei, l };
    });
    const L = Math.max(1, lanes.length);
    cells += `<div class="lbl" style="grid-row:${row}/span ${L + 1};grid-column:1"><span class="cn"><i class="dot" style="background:${CENTRES[c].color}"></i>${c}</span><span class="cap">${CENTRES[c].cap} beds</span></div>`;
    days.forEach((d, i) => { const wd = D(d).getUTCDay(), o = occupancy(c, d), cap = CENTRES[c].cap;
      cells += `<div class="bg ${wd === 0 || wd === 6 ? 'we' : ''}" style="grid-row:${row}/span ${L + 1};grid-column:${i + 2}"></div><div class="occ ${o > cap ? 'over' : o >= cap * .85 ? 'hi' : ''}" title="${c} · ${fmt(d)} · ${o} of ${cap} beds held" style="grid-row:${row + L};grid-column:${i + 2}">${o || ''}</div>`; });
    placedBars.forEach(({ g, si, ei, l }) => {
      const col = clientColor(g), txt = lum(col) > .62 ? '#1E293B' : '#fff';
      cells += `<button class="bar ${g.status}" data-action="open" data-id="${g.id}" title="${esc(g.school)} — ${esc(g.agent)} · ${people(g)} people · ${fmt(g.arrival)}–${fmt(g.departure)} · ${statusLabel(g.status)}" style="grid-row:${row + l};grid-column:${si + 2}/${ei + 3};background:${col};color:${txt}"><span class="bar-status ${g.status}" aria-hidden="true"></span>${esc(g.agent)} · ${g.students ?? '?'}+${g.adults ?? 0}</button>`; });
    row += L + 1;
  });
  return `
  <div class="page-head"><div><h1>Centre calendar</h1><p>Each client has its own colour. The small marker at the beginning shows whether the booking is confirmed, an inquiry, or waiting.</p></div>
    <div class="month-nav"><button class="icon-btn" data-action="cal-prev" aria-label="Previous month">${icon('left')}</button><span class="m">${monthName(key)}</span><button class="icon-btn" data-action="cal-next" aria-label="Next month">${icon('right')}</button></div></div>
  ${regionTabs('region')}
  <div class="cal-wrap"><div class="cal" style="grid-template-columns:170px repeat(${n},40px)">${cells}</div></div>
  <div class="legend"><span><i class="client-swatch"></i>Client / agent colour</span><span><i class="status-swatch confirmed"></i>Confirmed marker</span><span><i class="status-swatch enquiry"></i>Inquiry marker</span><span><i class="status-swatch waiting"></i>Waiting marker</span><span><i style="background:#fdf1cf"></i>Nearly full</span><span><i style="background:var(--warn)"></i>Over capacity</span></div>`;
}

function viewTracker() {
  const q = ui.q.trim().toLowerCase(), all = confirmed();
  const rows = all.filter(g => (ui.month === 'all' || monthKey(g.arrival) === ui.month) && (ui.trackerRegion === 'all' || regionOf(g.centre).id === ui.trackerRegion)
    && (!q || [g.agent, g.contact, g.school, g.ref, g.ceRef, g.centre].join(' ').toLowerCase().includes(q))).sort((a, b) => a.arrival.localeCompare(b.arrival));
  const months = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`);
  const tick = (v, label) => v ? `<span class="chip done">${label}</span>` : '';
  const progress = g => Math.round(taskCount(g) / TASKS.length * 100);
  return `
  <div class="page-head"><div><h1>Confirmed groups</h1><p>Every confirmed booking appears here automatically. Sharon follows preparation; Fernanda sees the same group for deposits, invoices, and family payments.</p></div><div class="actions"><a class="btn lg primary" href="#/documents">${icon('folder')} Create documents</a><button class="btn lg" data-action="export">${icon('down')} Export to Excel</button></div></div>
  <div class="view-explainer"><b>What happens after confirmation:</b><span>1. Group receives a Corrib reference</span><span>2. Preparation starts</span><span>3. Fernanda receives the deposit task</span></div>
  <div class="tabs">${months.map(m => { const c = all.filter(g => monthKey(g.arrival) === m).length; return `<button class="tab ${ui.month === m ? 'on' : ''}" data-action="month-filter" data-m="${m}" ${c ? '' : 'style="opacity:.5"'}>${monthShort(m)}${c ? `<span class="c">${c}</span>` : ''}</button>`; }).join('')}<button class="tab ${ui.month === 'all' ? 'on' : ''}" data-action="month-filter" data-m="all">All year<span class="c">${all.length}</span></button></div>
  <div class="toolbar"><input class="search" id="q" data-input="q" placeholder="Search tracker…" value="${esc(ui.q)}" aria-label="Search">
    ${['all', ...REGIONS.map(r => r.id)].map(r => `<button class="pill ${ui.trackerRegion === r ? 'on' : ''}" data-action="tracker-region" data-region="${r}">${r === 'all' ? 'All regions' : REGIONS.find(x => x.id === r).name}</button>`).join('')}
    <span class="small muted" style="margin-left:auto">${rows.length} groups · ${rows.reduce((t, g) => t + (+g.students || 0), 0).toLocaleString()} students</span></div>
  <div class="tracker-cards">${rows.map(g => `<button class="tracker-card" data-action="open-prep" data-id="${g.id}">
    <div class="tracker-top"><span><b>${esc(g.school)}</b><small>${esc(g.agent)} · ${esc(g.ceRef || 'Reference pending')}</small></span><span class="date-badge">${fmt(g.arrival)}</span></div>
    <div class="tracker-meta"><span>${esc(g.centre)}</span><span>${people(g)} people</span><span>${nights(g)} nights</span></div>
    <div class="tracker-progress"><span><b>Preparation</b><small>${taskCount(g)} of ${TASKS.length} complete</small></span><div class="meter"><i style="width:${progress(g)}%;background:${progress(g) === 100 ? 'var(--confirmed)' : 'var(--primary)'}"></i></div></div>
    <div class="tracker-status"><span class="mini-status ${g.tasks.program ? 'done' : ''}">Programme ${g.tasks.program ? '✓' : '—'}</span><span class="mini-status ${g.tasks.familyList ? 'done' : ''}">Family list ${g.tasks.familyList ? '✓' : '—'}</span><span class="mini-status ${depCls(g.fin.deposit)}">Deposit: ${DEP[g.fin.deposit]}</span><span class="mini-status ${invCls(g.fin.invoice)}">Invoice: ${INV[g.fin.invoice]}</span></div>
    <span class="open-label">Open group →</span></button>`).join('') || '<div class="empty card">No confirmed groups match these filters.</div>'}</div>
  <details class="spreadsheet-details"><summary>View the full spreadsheet columns</summary><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Group Reference</th><th>Corrib Educate Reference</th><th>Agent</th><th>Contact</th><th>Email for Agent</th><th>Centre</th><th>Arrival Date</th><th>Departure Date</th><th>Agent Invoice Information</th><th>Program</th><th>Breakdown</th><th>Leaders Contact Details</th><th>Coach Hire Info</th><th>Visits booked by Corrib</th><th class="blue">Final Email to agent</th><th class="blue">Family List</th><th class="blue">Matching list</th><th class="blue">Deposit</th><th class="blue">Invoice</th><th class="blue">Feedback</th></tr></thead>
  <tbody>${rows.map(g => `<tr data-action="open" data-id="${g.id}"><td class="nowrap"><b>${esc(g.ref || g.school)}</b></td><td class="nowrap">${esc(g.ceRef || '—')}</td><td class="agent">${esc(g.agent)}</td><td>${esc(g.contact)}</td><td>${esc(g.email) || '<span class="muted">—</span>'}</td><td>${esc(g.centre)}</td><td class="nowrap">${fmtFull(g.arrival)}</td><td class="nowrap">${fmtFull(g.departure)}</td><td class="wide">${esc(g.invoice)}</td><td>${tick(g.tasks.program, 'Done')}</td><td class="wide">${esc(breakdownText(g))}</td><td class="wide">${esc(g.leaders)}</td><td class="wide">${esc(g.coach)}</td><td class="wide">${esc(corribVisits(g).join('; '))}</td>
    <td>${tick(g.tasks.finalEmail, 'Sent')}</td><td>${tick(g.tasks.familyList, 'Done & sent to LO')}</td><td>${tick(g.tasks.matching, 'Allergies sent')}</td><td>${g.fin.deposit !== 'none' ? `<span class="chip ${depCls(g.fin.deposit)}">${DEP[g.fin.deposit]}</span>` : ''}</td><td>${g.fin.invoice !== 'none' ? `<span class="chip ${invCls(g.fin.invoice)}">${INV[g.fin.invoice]}</span>` : ''}</td><td>${tick(g.tasks.feedback, 'Received')}</td></tr>`).join('') || '<tr><td colspan="20" class="empty">No confirmed groups for this selection yet.</td></tr>'}</tbody></table></div>
  </details>`;
}

function viewDocuments() {
  const groups = confirmed().sort((a, b) => a.arrival.localeCompare(b.arrival));
  if (!ui.docGroup || !byId(ui.docGroup) || byId(ui.docGroup).status !== 'confirmed') ui.docGroup = groups.find(g => g.id === 18)?.id || groups[0]?.id;
  const g = byId(ui.docGroup), programmeItems = g ? daysOf(g).reduce((t, d) => t + (g.programme[d] || []).length, 0) : 0;
  const voucherCount = g ? voucherItems(g).length : 0, familyCount = g ? (g.alloc || []).length : 0;
  return `
  <div class="page-head"><div><h1>Documents</h1><p>Create the same Corrib Educate voucher, programme, and family-list formats every time. Choose a confirmed group once; its reference, dates, centre, and numbers fill automatically.</p></div></div>
  <div class="doc-group-picker"><span class="step-number">1</span><label><b>Choose a confirmed group</b><small>Only confirmed groups appear here</small><select class="in" data-change="doc-group">${groups.map(x => `<option value="${x.id}" ${x.id === ui.docGroup ? 'selected' : ''}>${esc(x.school)} · ${fmt(x.arrival)} · ${esc(x.centre)}</option>`).join('')}</select></label></div>
  ${g ? `<div class="selected-group"><span><b>${esc(g.school)}</b><small>${esc(g.ceRef || g.ref)} · ${esc(g.agent)}</small></span><span>${esc(g.centre)} · ${fmt(g.arrival)} – ${fmt(g.departure)}</span><span>${g.students} students · ${g.adults} leaders</span></div>
  <div class="document-cards">
    <section class="document-card"><div class="doc-icon voucher">V</div><div class="doc-copy"><h2>Voucher</h2><p>Choose a venue and date. Address, contact, coordinates, group reference, and breakdown fill automatically.</p></div><ol><li class="done">Group assigned</li><li class="${voucherCount ? 'done' : ''}">Choose visit and venue</li><li class="${voucherCount ? 'done' : ''}">Preview and issue</li></ol><div class="doc-actions"><button class="btn primary" data-action="voucher-builder" data-id="${g.id}">${icon('plus')} Create voucher</button>${voucherCount ? `<button class="btn" data-action="vouchers" data-id="${g.id}">Preview ${voucherCount}</button>` : ''}</div></section>
    <section class="document-card"><div class="doc-icon programme">P</div><div class="doc-copy"><h2>Programme</h2><p>Build Day 1, Day 2, and so on. Reference, centre, dates, students, and leaders stay in the fixed template.</p></div><ol><li class="done">Group details filled</li><li class="${programmeItems ? 'done' : ''}">Add daily activities</li><li class="${programmeItems ? 'done' : ''}">Preview and print</li></ol><div class="doc-actions"><button class="btn primary" data-action="doc-programme" data-id="${g.id}">${icon('plus')} Build programme</button>${programmeItems ? `<button class="btn" data-action="programme" data-id="${g.id}">Preview</button>` : ''}</div></section>
    <section class="document-card"><div class="doc-icon families">F</div><div class="doc-copy"><h2>Family list</h2><p>Assign girls, boys, and leaders to a family. Address and phone fill automatically; add names, notes, and allergies.</p></div><ol><li class="done">Group breakdown filled</li><li class="${familyCount ? 'done' : ''}">Assign host families</li><li class="${familyCount ? 'done' : ''}">Preview and send</li></ol><div class="doc-actions"><button class="btn primary" data-action="doc-families" data-id="${g.id}">${icon('plus')} Build family list</button>${familyCount ? `<button class="btn" data-action="family-list" data-id="${g.id}">Preview</button>` : ''}</div></section>
  </div>` : '<div class="empty card">Confirm a group before creating documents.</div>'}`;
}

function viewFamilies() {
  const tab = ui.ptab, q = ui.q.trim().toLowerCase();
  const head = `<div class="page-head"><div><h1>Host families & venues</h1><p>One list for everyone. Sharon places families and builds vouchers from here, and Fernanda pays from the same records — so names, phones and bank details are never typed twice. <span class="chip neutral">Demo: fictional families</span></p></div>
    <div class="actions"><button class="btn lg primary" data-action="${tab === 'venues' ? 'add-venue' : 'add-family'}">${icon('plus')} ${tab === 'venues' ? 'Add venue' : 'Add family'}</button></div></div>
    <div class="tabs"><button class="tab ${tab === 'families' ? 'on' : ''}" data-action="ptab" data-t="families">Host families<span class="c">${S.families.length}</span></button><button class="tab ${tab === 'venues' ? 'on' : ''}" data-action="ptab" data-t="venues">Venues & centres<span class="c">${S.venues.length}</span></button></div>`;
  if (tab === 'venues') {
    return head + `<div class="tbl-wrap" style="max-height:none"><table class="tbl"><thead><tr><th>Venue (appears on vouchers)</th><th>Address</th><th>Contact</th><th>Co-ordinates</th></tr></thead><tbody>
      ${S.venues.map(v => `<tr style="cursor:default">${['name', 'address', 'contact', 'coords'].map(k => `<td><input class="in cell" data-change="venue" data-k="${k}" data-id="${v.id}" value="${esc(v[k])}" placeholder="${k === 'name' ? '' : 'to complete'}"></td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <h2 style="margin:26px 0 10px">Centre addresses <span class="small muted" style="font-weight:400">· shown on the programme</span></h2>
      <div class="tbl-wrap" style="max-height:none"><table class="tbl"><thead><tr><th>Centre</th><th>Accommodation / address</th></tr></thead><tbody>
      ${Object.keys(CENTRES).map(c => `<tr style="cursor:default"><td><span class="dot" style="display:inline-block;background:${CENTRES[c].color};margin-right:8px"></span>${c}</td><td><input class="in cell" style="min-width:420px" data-change="caddr" data-c="${c}" value="${esc(S.centreAddr[c] || '')}" placeholder="to complete"></td></tr>`).join('')}</tbody></table></div>`;
  }
  const rows = S.families.filter(f => (ui.fcentre === 'all' || f.centre === ui.fcentre) && (!q || [f.name, f.phone, f.centre, f.address].join(' ').toLowerCase().includes(q)));
  const using = f => confirmed().filter(g => (g.alloc || []).some(a => a.fid === f.id));
  return head + `<div class="toolbar"><input class="search" id="q" data-input="q" placeholder="Search family, address or phone…" value="${esc(ui.q)}" aria-label="Search">
    ${['all', ...Object.keys(CENTRES)].map(c => `<button class="pill ${ui.fcentre === c ? 'on' : ''}" data-action="fam-centre" data-c="${c}">${c === 'all' ? 'All centres' : c}</button>`).join('')}
    <span class="small muted" style="margin-left:auto">${rows.length} families · ${rows.reduce((t, f) => t + f.cap, 0)} beds</span></div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Family name</th><th>Centre</th><th>Address</th><th>Phone</th><th>Payment details</th><th>Beds</th><th>Pets</th><th>Hosting in 2026</th></tr></thead>
  <tbody>${rows.map(f => `<tr style="cursor:default"><td><input class="in cell" data-change="fam" data-k="name" data-id="${f.id}" value="${esc(f.name)}"></td>
    <td><select class="in cell" data-change="fam" data-k="centre" data-id="${f.id}">${Object.keys(CENTRES).map(c => `<option ${c === f.centre ? 'selected' : ''}>${c}</option>`).join('')}</select></td>
    <td><input class="in cell" style="min-width:200px" data-change="fam" data-k="address" data-id="${f.id}" value="${esc(f.address)}"></td>
    <td><input class="in cell" data-change="fam" data-k="phone" data-id="${f.id}" value="${esc(f.phone)}"></td><td><input class="in cell" data-change="fam" data-k="pay" data-id="${f.id}" value="${esc(f.pay)}"></td>
    <td><input class="in cell" type="number" min="1" max="8" style="width:64px;min-width:0" data-change="fam" data-k="cap" data-id="${f.id}" value="${f.cap}"></td>
    <td><input type="checkbox" style="width:18px;height:18px;accent-color:var(--primary)" data-change="fam" data-k="pets" data-id="${f.id}" ${f.pets ? 'checked' : ''} aria-label="Has pets"></td>
    <td class="muted">${using(f).map(g => `<a href="#" data-action="open" data-id="${g.id}" style="color:var(--primary)">${esc(g.agent)} ${fmt(g.arrival)}</a>`).join(', ') || '—'}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">No families match.</td></tr>'}</tbody></table></div>`;
}

/* ---------- views: Fernanda ---------- */
function viewFinance() {
  const conf = confirmed().sort((a, b) => a.arrival.localeCompare(b.arrival));
  const toSend = conf.filter(g => g.fin.deposit === 'to-send');
  const invDue = conf.filter(g => ['none', 'draft'].includes(g.fin.invoice) && inDays(finance(g).due) <= 14);
  const ready = conf.filter(g => g.fin.familyListSent && !g.fin.familiesPaid);
  const income = conf.reduce((t, g) => t + finance(g).incTotal, 0), profit = conf.reduce((t, g) => t + finance(g).profit, 0);
  const st = S.settings;
  const tabs = [['groups', 'Groups'], ['families', 'Family payments'], ['pnl', 'Profit & loss']];
  return `
  <div class="page-head"><div><h1>Good morning, Fernanda</h1><p>Everything Sharon confirms lands here: deposits to send, invoices to build from the Tracker, and families to pay.</p></div>
    <div class="actions"><a class="btn lg" href="#/tracker">${icon('book')} Booking Tracker</a></div></div>
  <div class="grid g4">
    <div class="card kpi ${toSend.length ? 'hl' : ''}"><div class="n">${toSend.length}</div><div class="l">Deposits to send (${money(st.deposit)} each)</div></div>
    <div class="card kpi"><div class="n">${invDue.length}</div><div class="l">Invoices due within ${st.invoiceLeadDays} days</div></div>
    <div class="card kpi"><div class="n">${ready.length}</div><div class="l">Family lists ready to pay</div></div>
    <div class="card kpi"><div class="n" style="font-size:28px">${money(income)}</div><div class="l">Invoiced value booked · est. profit ${money(profit)}</div></div>
  </div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><div class="card-h"><h2>To do</h2></div><div class="list">
      ${toSend.map(g => `<div class="row"><span class="dot" style="background:var(--accent)"></span><div class="grow"><div class="t">Send deposit — ${esc(g.school)}</div><div class="small muted">${esc(g.ceRef)} · ${esc(g.agent)} · ${money(st.deposit)} to secure the place</div></div><button class="btn" data-action="deposit-sent" data-id="${g.id}">Mark sent</button></div>`).join('')}
      ${invDue.sort((a, b) => finance(a).due.localeCompare(finance(b).due)).slice(0, 5).map(g => { const d = inDays(finance(g).due); return `<button class="row" data-action="open-fin" data-id="${g.id}"><span class="dot" style="background:${d < 0 ? 'var(--warn)' : 'var(--waiting)'}"></span><div class="grow"><div class="t">Invoice — ${esc(g.school)}</div><div class="small muted">${esc(g.ceRef)} · due ${fmt(finance(g).due)} (${dueText(d)}) · arrives ${fmt(g.arrival)}</div></div>${chip(d < 0 ? 'warn' : 'waiting', d < 0 ? 'Overdue' : 'Build invoice')}</button>`; }).join('')}
      ${invDue.length > 5 ? `<div class="row"><span class="small muted">+ ${invDue.length - 5} more invoices due soon — see the Groups tab below</span></div>` : ''}
      ${ready.map(g => `<button class="row" data-action="open-fin" data-id="${g.id}"><span class="dot" style="background:var(--primary)"></span><div class="grow"><div class="t">Pay host families — ${esc(g.school)}</div><div class="small muted">Family list received ${fmt(g.fin.familyListSent)} · ${money(finance(g).famCost)}</div></div>${chip('confirmed', 'Ready')}</button>`).join('')}
      ${toSend.length + invDue.length + ready.length ? '' : '<div class="empty">Nothing waiting on you 🎉</div>'}</div></div>
    <div class="card"><div class="card-h"><h2>Rates <span class="small muted" style="font-weight:400">· placeholders, set the real ones</span></h2></div><div class="card-b"><div class="form">
      <label class="f">Deposit (€)<input class="in" type="number" data-change="setting" data-k="deposit" value="${st.deposit}"></label>
      <label class="f">Invoice due (days before arrival)<input class="in" type="number" data-change="setting" data-k="invoiceLeadDays" value="${st.invoiceLeadDays}"></label>
      <label class="f">Agent price per student per night (€)<input class="in" type="number" data-change="setting" data-k="rate" value="${st.rate}"></label>
      <label class="f">Host family pay per student per night (€)<input class="in" type="number" data-change="setting" data-k="familyRate" value="${st.familyRate}"></label></div></div></div>
  </div>
  <div class="tabs" style="margin-top:22px">${tabs.map(([id, l]) => `<button class="tab ${ui.ftab === id ? 'on' : ''}" data-action="ftab" data-t="${id}">${l}</button>`).join('')}</div>
  ${ui.ftab === 'groups' ? finGroups(conf) : ui.ftab === 'families' ? finFamilies(conf) : finPnl(conf)}`;
}
function finGroups(conf) {
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Group</th><th>CE reference</th><th>Arrival</th><th>Deposit</th><th>Invoice due</th><th>Invoice</th><th>Invoice total</th><th>Families placed</th><th>Est. profit</th></tr></thead><tbody>
  ${conf.map(g => { const f = finance(g), d = inDays(f.due), late = ['none', 'draft'].includes(g.fin.invoice) && d <= 14;
    return `<tr data-action="open-fin" data-id="${g.id}"><td><b>${esc(g.school)}</b><div class="small muted">${esc(g.agent)} · ${esc(g.centre)}</div></td><td class="nowrap">${esc(g.ceRef)}</td><td class="nowrap">${fmt(g.arrival)}</td>
    <td data-stop>${finSelect(g, 'deposit', { 'to-send': 'To send', sent: 'Sent', paid: 'Received' }, depCls)}</td>
    <td class="nowrap">${fmt(f.due)} ${late ? chip(d < 0 ? 'warn' : 'waiting', d < 0 ? 'overdue' : dueText(d)) : ''}</td>
    <td data-stop>${finSelect(g, 'invoice', INV, invCls)}</td><td class="nowrap">${money(f.incTotal)}</td><td class="nowrap">${placed(g)} / ${people(g)}</td>
    <td class="nowrap" style="color:${f.profit < 0 ? 'var(--warn)' : 'var(--primary)'};font-weight:600">${money(f.profit)}</td></tr>`; }).join('')}</tbody></table></div>`;
}
function finFamilies(conf) {
  const gs = conf.filter(g => g.alloc.length).sort((a, b) => (a.fin.familiesPaid - b.fin.familiesPaid) || a.arrival.localeCompare(b.arrival));
  const without = conf.length - gs.length;
  return `<div class="grid">${gs.map(g => { const f = finance(g), n = f.n, st = S.settings; return `<div class="card"><div class="card-h"><div><h2>${esc(g.school)}</h2><div class="small muted">${esc(g.ceRef)} · ${esc(g.centre)} · ${fmt(g.arrival)} – ${fmt(g.departure)} · ${n} nights</div></div>
      <div style="display:flex;gap:10px;align-items:center">${chip(g.fin.familiesPaid ? 'confirmed' : g.fin.familyListSent ? 'waiting' : 'neutral', famStatus(g))}${g.fin.familyListSent && !g.fin.familiesPaid ? `<button class="btn primary" data-action="pay-families" data-id="${g.id}">Mark all paid</button>` : ''}</div></div>
      <div class="card-b"><table class="tbl" style="font-size:13px"><thead><tr><th>Family</th><th>Phone</th><th>Payment details</th><th>Students</th><th>Amount</th></tr></thead><tbody>
      ${g.alloc.map(a => { const fm = famById(a.fid); return fm ? `<tr style="cursor:default"><td>${esc(fm.name)}</td><td>${esc(fm.phone)}</td><td>${esc(fm.pay)}</td><td>${a.n}</td><td>${money(a.n * n * st.familyRate)}</td></tr>` : ''; }).join('')}
      <tr style="cursor:default"><td colspan="3"><b>Total</b>${placed(g) < people(g) ? ` <span class="muted">· ${people(g) - placed(g)} people not placed yet</span>` : ''}</td><td><b>${placed(g)}</b></td><td><b>${money(placed(g) * n * st.familyRate)}</b></td></tr></tbody></table></div></div>`; }).join('')}
    <div class="muted small">${without} confirmed groups don't have a family list yet — Sharon builds it in each group's “Prep & families” tab.</div></div>`;
}
function finPnl(conf) {
  const rows = conf.map(g => ({ g, f: finance(g) })), tot = rows.reduce((t, { f }) => ({ i: t.i + f.incTotal, c: t.c + f.cost }), { i: 0, c: 0 });
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Group</th><th>Arrival</th><th>Income</th><th>Costs</th><th>Profit</th><th>Margin</th></tr></thead><tbody>
  ${rows.map(({ g, f }) => `<tr data-action="open-fin" data-id="${g.id}"><td><b>${esc(g.school)}</b><div class="small muted">${esc(g.ceRef)} · ${esc(g.agent)}</div></td><td class="nowrap">${fmt(g.arrival)}</td><td>${money(f.incTotal)}</td><td>${money(f.cost)}${f.famEst ? '*' : ''}</td><td style="font-weight:600;color:${f.profit < 0 ? 'var(--warn)' : 'var(--primary)'}">${money(f.profit)}</td><td>${Math.round(f.margin * 100)}%</td></tr>`).join('')}
  <tr style="cursor:default"><td><b>Total</b></td><td></td><td><b>${money(tot.i)}</b></td><td><b>${money(tot.c)}</b></td><td><b>${money(tot.i - tot.c)}</b></td><td><b>${tot.i ? Math.round((tot.i - tot.c) / tot.i * 100) : 0}%</b></td></tr></tbody></table></div>
  <p class="small muted">* Host-family cost is estimated until the family list is complete. Income = package + extras from Sharon's invoice notes. Rates are placeholders.</p>`;
}

/* ---------- drawer ---------- */
function openGroup(id, tab) { ui.drawer = id; if (tab) ui.dtab = tab; else if (!byId(id) || byId(id).status !== 'confirmed') ui.dtab = 'details'; renderDrawer(); $('#drawer').classList.add('on'); $('#scrim').classList.add('on'); $('#drawer').setAttribute('aria-hidden', 'false'); }
function openPrepAt(id, section) { openGroup(id, 'prep'); const body = $('#drawer .dr-b'), target = $(`#drawer [data-section="${section}"]`); if (body && target) body.scrollTop = Math.max(0, target.offsetTop - 18); }
function closeDrawer() { ui.drawer = null; $('#drawer').classList.remove('on'); $('#scrim').classList.remove('on'); $('#drawer').setAttribute('aria-hidden', 'true'); }
const fld = (g, k, label, type = 'text', cls = '') => `<label class="f ${cls}">${label}<input class="in" type="${type}" data-change="field" data-f="${k}" data-id="${g.id}" value="${esc(g[k] ?? '')}"></label>`;
const area = (g, k, label) => `<label class="f full">${label}<textarea class="in" data-change="field" data-f="${k}" data-id="${g.id}">${esc(g[k] ?? '')}</textarea></label>`;

function drawerDetails(g) {
  const need = people(g), cap = CENTRES[g.centre].cap, after = peak(g.centre, g.arrival, g.departure, g.id) + need;
  let banner = '';
  if (g.status === 'waiting') banner = fits(g) ? `<div class="alert ok">✓ Room has opened up at ${esc(g.centre)} for these dates. <button class="btn" style="margin-left:auto" data-action="promote" data-id="${g.id}">Hold the beds</button></div>` : `<div class="alert">On the waiting list${queuePos(g) ? ` (#${queuePos(g)} for ${esc(g.centre)})` : ''} — no beds held. Still no room: ${after} vs ${cap} beds.</div>`;
  else if (g.status !== 'cancelled') banner = after > cap ? `<div class="alert">⚠ Over capacity at ${esc(g.centre)}: ${after} beds on the busiest night vs ${cap}. Move this group or free up a booking.</div>` : `<div class="alert ok">✓ Fits at ${esc(g.centre)} — ${after} of ${cap} beds on the busiest night, including this group.</div>`;
  const hist = [...(g.history || []), { t: g.enquiry, text: 'Enquiry received', first: true }].sort((a, b) => b.t.localeCompare(a.t) || (b.first ? -1 : 1));
  return `${banner}
  ${g.status === 'enquiry' || g.status === 'waiting' ? `<div class="sec"><h3>Confirmation timing</h3>${g.status === 'enquiry' ? `<div class="form">${fld(g, 'holdUntil', 'Agent must confirm by', 'date')}<div class="small muted" style="align-self:end">Beds are released if the agent has not confirmed by this date.</div></div>` : '<div class="small muted">This group is on the waiting list, so no beds are held and there is no confirmation deadline.</div>'}</div>` : ''}
  <div class="sec"><h3>Group</h3><div class="form">
    ${fld(g, 'school', 'School / group name', 'text', 'full')}${fld(g, 'ref', 'Agent’s group reference')}${fld(g, 'ceRef', 'Corrib Educate reference')}${fld(g, 'agent', 'Agent')}${fld(g, 'contact', 'Agent contact')}${fld(g, 'email', 'Agent email', 'email', 'full')}
    <label class="f">Centre<select class="in" data-change="field" data-f="centre" data-id="${g.id}">${REGIONS.map(r => `<optgroup label="${r.name}">${r.centres.map(c => `<option ${c === g.centre ? 'selected' : ''}>${c}</option>`).join('')}</optgroup>`).join('')}</select></label>
    ${fld(g, 'age', 'Age range')}${fld(g, 'arrival', 'Arrival', 'date')}${fld(g, 'departure', 'Departure', 'date')}${fld(g, 'students', 'Students', 'number')}${fld(g, 'adults', 'Adults / leaders', 'number')}</div></div>
  <div class="sec"><h3>Requests & notes</h3><div class="form">${area(g, 'activities', 'Requested activities / visits')}${fld(g, 'breakdown', 'Breakdown (e.g. 9B, 21G, 1M, 2F)', 'text', 'full')}${area(g, 'notes', 'Relevant information')}</div></div>
  <div class="sec"><h3>For the Booking Tracker</h3><div class="form">${area(g, 'invoice', 'Agent invoice information (Fernanda builds the invoice from this)')}${area(g, 'coach', 'Coach hire info')}
    ${fld(g, 'leaders', 'Leaders contact details (teachers only)', 'text', 'full')}</div>
    ${g.status !== 'confirmed' ? '<p class="small muted" style="margin:10px 0 0">This group appears in the Tracker once it is confirmed.</p>' : ''}</div>
  ${g.confirmation ? `<div class="sec confirmation-proof"><h3>Confirmation evidence</h3><div class="small muted">Confirmed ${fmtFull(g.confirmation.date)}${g.confirmation.proof ? ' · agent email saved' : ' · no email pasted'}</div>${g.confirmation.proof ? `<details><summary>View confirmation email</summary><div>${esc(g.confirmation.proof)}</div></details>` : ''}</div>` : ''}
  <div class="sec"><h3>Activity</h3><ul class="timeline">${hist.map(h => `<li><i></i><div>${esc(h.text)}<time>${fmtFull(h.t)}</time></div></li>`).join('')}</ul></div>`;
}
const daysOf = g => { const out = []; for (let d = g.arrival; d <= g.departure && out.length < 40; d = addDays(d, 1)) out.push(d); return out; };
const weekday = iso => D(iso).toLocaleDateString('en-IE', { weekday: 'long', timeZone: 'UTC' });
const parseBreakdown = t => { const m = k => { const r = new RegExp('(\\d+)\\s*' + k + '(?![a-z])', 'i').exec(t || ''); return r ? +r[1] : 0; }; return { girls: m('G'), boys: m('B'), leaders: m('M') + m('F') }; };
const corribItems = g => daysOf(g).flatMap(d => (g.programme[d] || []).filter(i => i.by === 'corrib').map(i => ({ ...i, date: d })));
const corribVisits = g => corribItems(g).map(i => i.text + (i.time ? ' ' + i.time : ''));
const voucherItems = g => corribItems(g).filter(i => i.venue);

function programmeHtml(g) {
  const sel = (it, d, i, k, opts) => `<select class="in sm" data-change="pitem" data-k="${k}" data-date="${d}" data-i="${i}" data-id="${g.id}">${opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(it[k] || '') ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  return daysOf(g).map((d, di) => `<div class="day"><div class="dh"><b>Day ${di + 1}</b><span class="muted">${weekday(d)} ${fmt(d)}</span></div>
    ${(g.programme[d] || []).map((it, i) => `<div class="pitem"><div class="prow"><input class="in tm" type="time" data-change="pitem" data-k="time" data-date="${d}" data-i="${i}" data-id="${g.id}" value="${esc(it.time)}" aria-label="Time"><input class="in" data-change="pitem" data-k="text" data-date="${d}" data-i="${i}" data-id="${g.id}" value="${esc(it.text)}" aria-label="Activity"><button class="x" data-action="del-item" data-date="${d}" data-i="${i}" data-id="${g.id}" aria-label="Remove">${icon('x')}</button></div>
      <div class="prow2">${sel(it, d, i, 'by', [['', 'Itinerary'], ['agent', 'Booked by agent'], ['corrib', 'Booked by Corrib']])}${sel(it, d, i, 'venue', [['', 'No venue'], ...S.venues.map(v => [v.id, v.name])])}${it.by === 'corrib' && it.venue ? '<span class="chip done">Voucher</span>' : ''}</div></div>`).join('')}
    <button class="btn ghost small-btn" data-action="add-item" data-date="${d}" data-id="${g.id}">${icon('plus')} Add</button></div>`).join('');
}
function drawerPrep(g) {
  const need = parseBreakdown(g.breakdown), tot = people(g), pl = placed(g), vch = voucherItems(g).length;
  const kinds = [['girls', 'Girls', need.girls], ['boys', 'Boys', need.boys], ['leaders', 'Leaders', need.leaders || (+g.adults || 0)]];
  const warn = a => { const f = famById(a.fid); if (!f) return ''; const mine = g.alloc.filter(x => x.fid === a.fid).reduce((t, x) => t + x.n, 0);
    const others = confirmed().filter(x => x.id !== g.id && overlap(x, g)).reduce((t, x) => t + (x.alloc.find(y => y.fid === a.fid)?.n || 0), 0);
    return others && others + mine > f.cap ? `Already hosting ${others} for another group on these dates` : mine > f.cap ? `Only ${f.cap} beds — ${mine} placed` : ''; };
  const block = ([kind, label, n]) => {
    const rows = g.alloc.map((a, i) => ({ a, i })).filter(x => x.a.kind === kind), pk = rows.reduce((t, x) => t + x.a.n, 0), used = g.alloc.map(a => a.fid);
    const avail = S.families.filter(f => f.centre === g.centre && !used.includes(f.id));
    return `<div class="kind"><div class="kh"><b>${label}</b><span class="chip ${n && pk >= n ? 'done' : 'neutral'}">${pk}${n ? ` of ${n}` : ''} placed</span></div>
      ${rows.map(({ a, i }) => { const f = famById(a.fid); if (!f) return ''; const w = warn(a);
        return `<div class="arow"><div class="grow"><b>${esc(f.name)}${f.pets ? ' *' : ''}</b><div class="small muted">${esc(f.address)} · ${esc(f.phone)}</div>${w ? `<div class="small" style="color:var(--warn)">⚠ ${w}</div>` : ''}
          <textarea class="in" rows="2" data-change="alloc" data-k="notes" data-i="${i}" data-id="${g.id}" placeholder="${kind === 'leaders' ? 'Names' : 'Names and allergies, e.g. Lena - no pork, Manon'}">${esc(a.notes || '')}</textarea></div>
          <input class="in" type="number" min="1" style="width:62px" data-change="alloc" data-k="n" data-i="${i}" data-id="${g.id}" value="${a.n}" aria-label="Number placed"><button class="x" data-action="del-alloc" data-i="${i}" data-id="${g.id}" aria-label="Remove">${icon('x')}</button></div>`; }).join('')}
      <div class="addrow"><select class="in" id="newFam_${kind}"><option value="">Add a family at ${esc(g.centre)}…</option>${avail.map(f => `<option value="${f.id}">${esc(f.name)}${f.pets ? ' *' : ''} · ${f.cap} beds</option>`).join('')}</select><button class="btn" data-action="add-alloc" data-kind="${kind}" data-id="${g.id}">${icon('plus')} Add</button></div></div>`;
  };
  const task = ([k, l]) => `<label class="check"><input type="checkbox" data-change="task" data-k="${k}" data-id="${g.id}" ${g.tasks[k] ? 'checked' : ''}><span>${l}</span></label>`;
  return `
  <div class="sec"><h3>${icon('folder').replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px;margin-right:6px"')}Group folder</h3>
    <div class="folder">Agents / ${esc(g.agent)} / ${esc(g.school)} — ${fmt(g.arrival)} to ${fmt(g.departure)}</div><div class="small muted" style="margin-top:6px">The agent's original email and everything they send lives here. Created automatically on confirmation.</div></div>
  <div class="sec"><h3>Before they arrive <span class="chip ${taskCount(g) === TASKS.length ? 'done' : 'neutral'}" style="margin-left:8px">${taskCount(g)}/${TASKS.length}</span></h3>${TASKS.map(task).join('')}
    <div class="small muted" style="margin:8px 0 6px">After the stay</div>${AFTER_TASKS.map(task).join('')}
    <div class="small muted" style="margin-top:8px">These are the same ticks as the Tracker columns — nothing is booked until the group confirms.</div></div>
  <div class="sec" data-section="programme"><h3><span class="section-step">1</span> Programme</h3><p class="muted small" style="margin:0 0 6px">Build it day by day. Mark what the agent booked and what Corrib books — anything Corrib books with a venue gets a voucher automatically.</p>
    ${programmeHtml(g)}<div class="actions" style="margin-top:12px"><button class="btn" data-action="tpl" data-id="${g.id}">Add arrival & departure steps</button><button class="btn primary" data-action="programme" data-id="${g.id}">${icon('print')} Print programme</button></div></div>
  <div class="sec" data-section="vouchers"><h3><span class="section-step">2</span> Vouchers <span class="chip ${vch ? 'done' : 'neutral'}" style="margin-left:8px">${vch}</span></h3><p class="muted small" style="margin:0 0 10px">${vch ? 'One voucher per visit that Corrib books. Group reference, date, venue details and numbers are filled in for you.' : 'Choose Create voucher for the guided version, or mark a programme item as “Booked by Corrib” and pick a venue.'}</p>
    <div class="actions"><button class="btn primary" data-action="voucher-builder" data-id="${g.id}">${icon('plus')} Create voucher</button><button class="btn" data-action="vouchers" data-id="${g.id}" ${vch ? '' : 'disabled'}>${icon('print')} Preview vouchers</button></div></div>
  <div class="sec" data-section="families"><h3><span class="section-step">3</span> Host families <span class="chip ${pl >= tot ? 'done' : 'waiting'}" style="margin-left:8px">${pl} of ${tot} placed</span></h3>${bar(pl, tot, pl >= tot ? 'var(--primary)' : 'var(--accent)')}
    <p class="muted small" style="margin:10px 0 0">Pick a family and their address and phone fill in. Type names and allergies — they are highlighted on the printed list. * = has pets.</p>
    ${kinds.map(block).join('')}
    <div class="actions" style="margin-top:14px"><button class="btn" data-action="family-list" data-id="${g.id}" ${pl ? '' : 'disabled'}>${icon('print')} Print / save PDF for local organiser</button>
      <button class="btn" data-action="lo-sent" data-id="${g.id}" ${pl && !g.tasks.familyList ? '' : 'disabled'}>${g.tasks.familyList ? '✓ Sent to local organiser' : 'Mark sent to local organiser'}</button>
      <button class="btn primary" data-action="send-list" data-id="${g.id}" ${pl && !g.fin.familyListSent ? '' : 'disabled'}>${g.fin.familyListSent ? `✓ Sent to Fernanda ${fmt(g.fin.familyListSent)}` : 'Send to Fernanda for payment'}</button></div>
    <div class="small muted" style="margin-top:6px">Send to Fernanda after the stay, once the local organiser confirms everything was fine.</div></div>`;
}

function drawerFinance(g) {
  const f = finance(g), st = S.settings, lines = g.fin.extras ?? parseExtras(g.invoice);
  const lineRows = (arr, kind) => arr.map((l, i) => `<div class="lrow"><input class="in" data-change="finline" data-kind="${kind}" data-i="${i}" data-k="desc" data-id="${g.id}" value="${esc(l.desc)}"><input class="in" type="number" step="0.01" style="width:96px" data-change="finline" data-kind="${kind}" data-i="${i}" data-k="amount" data-id="${g.id}" value="${l.amount}"><button class="x" data-action="del-line" data-kind="${kind}" data-i="${i}" data-id="${g.id}" aria-label="Remove">${icon('x')}</button></div>`).join('');
  return `
  <div class="sec"><h3>Deposit</h3><div class="form"><label class="f">Status${finSelect(g, 'deposit', { 'to-send': 'To send', sent: 'Sent', paid: 'Received' }, depCls)}</label><div class="f">Amount<div class="in" style="display:flex;align-items:center">${money(st.deposit)}</div></div></div>
    <div class="small muted" style="margin-top:8px">Requested automatically when Sharon confirmed the group (${esc(g.ceRef || '—')}).</div></div>
  <div class="sec"><h3>Invoice <span class="small muted" style="font-weight:400">· due ${fmtFull(f.due)} (${dueText(inDays(f.due))})</span></h3>
    <div class="lrow"><div class="grow small">${esc(f.income[0].desc)}</div><b>${money(f.income[0].amount)}</b></div>
    ${lineRows(lines, 'extras')}
    <div class="addrow"><button class="btn" data-action="add-line" data-kind="extras" data-id="${g.id}">${icon('plus')} Add line</button>${g.fin.extras ? `<button class="btn ghost" data-action="reset-extras" data-id="${g.id}">Re-read Sharon's notes</button>` : ''}</div>
    <div class="totals"><div><span>Total</span><b>${money(f.incTotal)}</b></div><div><span>Deposit received</span><b>− ${money(f.depositPaid)}</b></div><div class="big"><span>Balance to invoice</span><b>${money(f.balance)}</b></div></div>
    <div class="form" style="margin-top:12px"><label class="f">Invoice status${finSelect(g, 'invoice', INV, invCls)}</label></div>
    <div class="small muted" style="margin-top:8px">Extras are read from Sharon's “Agent invoice information”. Edit or add lines as needed.</div></div>
  <div class="sec"><h3>Costs & profit</h3>
    <div class="lrow"><div class="grow small">Host families — ${f.famEst ? `estimate (${people(g)} people × ${f.n} nights × ${money(st.familyRate)})` : `${placed(g)} students × ${f.n} nights × ${money(st.familyRate)}`}</div><b>${money(f.famCost)}</b></div>
    ${lineRows(g.fin.costs || [], 'costs')}<div class="addrow"><button class="btn" data-action="add-line" data-kind="costs" data-id="${g.id}">${icon('plus')} Add cost</button></div>
    <div class="totals"><div><span>Income</span><b>${money(f.incTotal)}</b></div><div><span>Costs</span><b>− ${money(f.cost)}</b></div><div class="big"><span>Profit · ${Math.round(f.margin * 100)}%</span><b style="color:${f.profit < 0 ? 'var(--warn)' : 'var(--primary)'}">${money(f.profit)}</b></div></div></div>
  <div class="sec"><h3>Host families</h3><div class="row" style="padding:0;border:0"><div class="grow">${chip(g.fin.familiesPaid ? 'confirmed' : g.fin.familyListSent ? 'waiting' : 'neutral', famStatus(g))} <span class="small muted">${placed(g)} of ${people(g)} placed${g.fin.familyListSent ? ` · list received ${fmt(g.fin.familyListSent)}` : ''}</span></div>
    ${g.fin.familyListSent && !g.fin.familiesPaid ? `<button class="btn primary" data-action="pay-families" data-id="${g.id}">Mark all paid</button>` : ''}</div></div>`;
}
function renderDrawer() {
  const g = byId(ui.drawer); if (!g) return;
  const conf = g.status === 'confirmed', tab = conf ? ui.dtab : 'details';
  const body = tab === 'prep' ? drawerPrep(g) : tab === 'finance' ? drawerFinance(g) : drawerDetails(g);
  const sc = $('#drawer .dr-b')?.scrollTop || 0;
  $('#drawer').innerHTML = `
  <div class="dr-h"><div class="top"><div><h2>${esc(g.school)}</h2><div class="muted">${esc(g.agent)}${g.contact ? ' · ' + esc(g.contact) : ''}${g.ceRef ? ` · <b>${esc(g.ceRef)}</b>` : ''}</div></div><button class="icon-btn" data-action="close-drawer" aria-label="Close">${icon('x')}</button></div>
    <div style="margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">${statusSelect(g)}${g.status === 'enquiry' && g.holdUntil ? chip(inDays(g.holdUntil) <= 7 ? 'waiting' : 'neutral', `Confirm by ${fmt(g.holdUntil)}`) : ''}<span class="small muted">${fmt(g.arrival)} – ${fmt(g.departure)} · ${people(g)} people · ${esc(g.centre)}</span></div>
    ${conf ? `<div style="margin-top:10px;display:flex;gap:10px;align-items:center"><span class="small" style="font-weight:600;min-width:60px">Prep ${taskCount(g)}/${TASKS.length}</span><div class="meter" style="height:6px"><i style="width:${TASKS.length ? taskCount(g) / TASKS.length * 100 : 0}%;background:${taskCount(g) === TASKS.length ? 'var(--primary)' : 'var(--accent)'}"></i></div></div>` : ''}
    <div class="tabs" style="margin:12px 0 -15px;border:0">${[['details', 'Details'], ['prep', 'Prep & families'], ['finance', 'Finance']].map(([id, l]) => conf || id === 'details' ? `<button class="tab ${tab === id ? 'on' : ''}" data-action="dtab" data-t="${id}">${l}</button>` : '').join('')}</div></div>
  <div class="dr-b">${body}</div>`;
  const b = $('#drawer .dr-b'); if (b) b.scrollTop = sc;
}

/* ---------- printable documents (modelled on Sharon's Word documents) ---------- */
const COMPANY = { lines: ['Unit 21,', 'N17 Business Park,', 'Tuam,', 'Co. Galway.'], tel: '+353 83 030 1891', email: 'info@corribeducate.com' };
const ORD = n => `${n}<sup>${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}</sup>`;
const monthLong = iso => D(iso).toLocaleDateString('en-IE', { month: 'long', timeZone: 'UTC' });
const longDate = (iso, time) => `${weekday(iso)} ${ORD(D(iso).getUTCDate())} of ${monthLong(iso)}${time ? ` at ${esc(time)}H` : ''}`;
const dateRange = g => `${ORD(D(g.arrival).getUTCDate())} ${monthLong(g.arrival)} – ${ORD(D(g.departure).getUTCDate())} ${monthLong(g.departure)} ${D(g.departure).getUTCFullYear()}`;
const ALLERGY = /\b(no (?:pork|cheese|beans|gluten|nuts|fish|meat|eggs|milk|dairy)|(?:severely )?allergic to [^,;]+|vegetarian|vegan|coeliac|gluten[- ]free|lactose[- ]intolerant|halal|scared of dogs|afraid of dogs|asthma|diabetic)/gi;
const hl = t => esc(t).replace(ALLERGY, '<mark>$1</mark>');
const logoHead = () => `<div class="lh"><img src="assets/corrib-educate-logo.png" alt="Corrib Educate"></div>`;
function openModal(html, hint) { $('#modal').innerHTML = `<div class="modal-bar"><div class="muted small">${hint}</div><div class="actions"><button class="btn primary" data-action="print">${icon('print')} Print / save as PDF</button><button class="btn" data-action="close-modal">Close</button></div></div><div class="sheets">${html}</div>`; $('#modal').classList.add('on'); }

const venueInfo = v => `<div class="auto-fields"><div><small>Visit</small><b>${esc(v?.name || '—')}</b></div><div><small>Address</small><b>${esc(v?.address || 'To complete in Families & venues')}</b></div><div><small>Contact</small><b>${esc(v?.contact || 'To complete')}</b></div><div><small>Coordinates</small><b>${esc(v?.coords || 'To complete')}</b></div></div>`;
function openVoucherBuilder(id) {
  const g = byId(id), v = S.venues[0]; if (!g || !v) return;
  $('#modal').innerHTML = `<div class="modal-bar"><div><b>Create a voucher</b><div class="small muted">The layout follows the Corrib Educate voucher template.</div></div><button class="btn" data-action="close-modal">Close</button></div>
    <div class="builder-wrap"><div class="builder-card"><div class="builder-step"><span>1</span><div><b>Confirmed group</b><small>Reference and breakdown are filled automatically</small></div></div>
      <div class="confirm-summary"><span><small>Group</small><b>${esc(g.school)}</b></span><span><small>Reference</small><b>${esc(g.ref || g.ceRef || '—')}</b></span><span><small>Breakdown</small><b>${g.students} students + ${g.adults} leaders</b></span></div>
      <div class="builder-step"><span>2</span><div><b>Choose the visit</b><small>The venue record fills the document details</small></div></div>
      <div class="form"><label class="f full">Venue<select class="in" id="voucher-venue" data-change="voucher-venue">${S.venues.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label><label class="f">Date of visit<input class="in" type="date" id="voucher-date" min="${g.arrival}" max="${g.departure}" value="${g.arrival}"></label><label class="f">Time<input class="in" type="time" id="voucher-time" value="11:30"></label></div>
      <div id="voucher-auto">${venueInfo(v)}</div>
      <div class="builder-step"><span>3</span><div><b>Issue the voucher</b><small>Review the pre-filled document, then print or save as PDF</small></div></div>
      <div class="actions" style="justify-content:flex-end"><button class="btn primary lg" data-action="create-voucher" data-id="${g.id}">${icon('print')} Create & preview voucher</button></div>
    </div></div>`;
  $('#modal').classList.add('on');
}

function openVouchers(id) {
  const g = byId(id), ref = esc(g.ref || g.ceRef || '');
  const html = voucherItems(g).map(it => { const v = S.venues.find(x => x.id === +it.venue) || {};
    return `<section class="sheet plain doc">${logoHead()}<div class="addr">${COMPANY.lines.map(esc).join('<br>')}<br>Tel: ${COMPANY.tel}<br>Email: <u>${COMPANY.email}</u></div>
    <h2 class="vtitle">VOUCHER</h2>
    <div class="vf">Group Ref: ${ref}</div><div class="vf">Date of Visit: ${longDate(it.date, it.time)}</div><div class="vf">Visit: ${esc(v.name || it.text)}</div>
    ${v.address ? `<div class="vf">Address: ${esc(v.address)}</div>` : ''}${v.contact ? `<div class="vf">Contact: ${esc(v.contact)}</div>` : ''}${v.coords ? `<div class="vf">Co-ordinates: ${esc(v.coords)}</div>` : ''}
    <table class="vtab"><thead><tr><th>Breakdown</th><th>Number</th></tr></thead><tbody><tr><td>Student</td><td>${g.students || 0}</td></tr><tr><td>Adult</td><td>${g.adults || 0}</td></tr><tr class="tot"><td>TOTAL</td><td>${people(g)}</td></tr></tbody></table></section>`; }).join('');
  openModal(html, 'Preview — one voucher per visit booked by Corrib');
}
function openProgramme(id) {
  const g = byId(id), addr = S.centreAddr[g.centre];
  const days = daysOf(g).map((d, i) => `<div class="pday"><div class="pr"><b class="c1">DAY ${i + 1}</b><b>DATE: ${weekday(d)} ${d.slice(8)}/${d.slice(5, 7)}/${d.slice(0, 4)}</b></div>
    ${(g.programme[d] || []).map(it => `<div class="pr"><span class="c1">${it.time ? esc(it.time) + 'H' : ''}</span><span>${esc(it.text)}${it.by === 'agent' ? ' (Booked by Agent)' : ''}</span></div>`).join('') || '<div class="pr"><span class="c1"></span><span class="muted">—</span></div>'}</div>`).join('');
  openModal(`<section class="sheet plain doc prog"><div class="lh left"><img src="assets/corrib-educate-logo.png" alt="Corrib Educate"></div><h2 class="ptitle">CORRIB EDUCATE PROGRAMME</h2>
    <div class="pl"><b>REFERENCE:</b> ${esc(g.ref || g.ceRef || '')}</div><div class="pl"><b>CENTRE</b>: ${esc(g.centre)}${addr ? ' - ' + esc(addr) : ''}</div><div class="pl"><b>DATES</b>: ${dateRange(g)}</div><div class="pl">${g.students} Students &amp; ${g.adults} Leaders</div>${days}</section>`, 'Preview — programme');
}
function openFamilyList(id) {
  const g = byId(id); let n = 0;
  const rows = kind => g.alloc.filter(a => a.kind === kind).map(a => { const f = famById(a.fid); return f ? `<tr><td>${++n}.</td><td>${esc(f.name)}${f.pets ? ' *' : ''}</td><td>${esc(f.address)}</td><td>${esc(f.phone)}</td><td class="c">${a.n}</td><td>${hl(a.notes || '')}</td></tr>` : ''; }).join('');
  const table = (kind, last) => `<table class="fl"><thead><tr><th></th><th>Family Name</th><th>Address</th><th>Phone Number</th><th>${kind === 'leaders' ? 'Adults' : 'Students'}</th><th>${kind === 'leaders' ? 'Names and allergies of participants' : 'Notes/ preferences/ allergies of participants'}</th></tr></thead><tbody>${rows(kind)}</tbody></table>`;
  const has = k => g.alloc.some(a => a.kind === k);
  openModal(`<section class="sheet plain doc fam">${logoHead()}
    <div class="pl">Reference: ${esc(g.ref || g.ceRef || '')}</div><div class="pl">Centre: ${esc(g.centre)}</div><div class="pl">Dates: ${dateRange(g)}</div><div class="pl">${g.students} students &amp; ${g.adults} leaders</div>
    <div class="red">Please note phone numbers are for teachers use only and only when the group is in Ireland</div>
    ${has('girls') ? `<div class="gh">Girls</div>${table('girls')}` : ''}${has('boys') ? `<div class="gh">Boys</div>${table('boys')}` : ''}${has('leaders') ? `<div class="gh">Leaders</div>${table('leaders')}` : ''}
    <div class="small">*has pets</div></section>`, 'Preview — family list (highlighting marks allergies and preferences)');
}

/* ---------- csv ---------- */
function exportCsv() {
  const cols = ['Group Reference', 'Corrib Educate Reference', 'Agent', 'Contact', 'Email for Agent', 'Centre', 'Arrival Date', 'Departure Date', 'Agent Invoice Information', 'Program', 'Breakdown', 'Leaders Contact Details', 'Coach Hire Info', 'Visits booked by Corrib', 'Final Email to agent', 'Family List', 'Matching list', 'Deposit', 'Invoice', 'Feedback'];
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`, yes = (v, t) => v ? t : '';
  const rows = confirmed().filter(g => ui.month === 'all' || monthKey(g.arrival) === ui.month).sort((a, b) => a.arrival.localeCompare(b.arrival))
    .map(g => [g.ref || g.school, g.ceRef, g.agent, g.contact, g.email, g.centre, g.arrival, g.departure, g.invoice, yes(g.tasks.program, 'Done'), breakdownText(g), g.leaders, g.coach, corribVisits(g).join('; '),
      yes(g.tasks.finalEmail, 'Sent'), yes(g.tasks.familyList, 'Done & sent to LO'), yes(g.tasks.matching, 'Allergies sent'), DEP[g.fin.deposit] === '—' ? '' : DEP[g.fin.deposit], INV[g.fin.invoice] === 'Not started' ? '' : INV[g.fin.invoice], yes(g.tasks.feedback, 'Received')].map(q).join(','));
  const blob = new Blob(['﻿' + [cols.map(q).join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `Tracker-2026-${ui.month}.csv` }); a.click(); URL.revokeObjectURL(a.href);
  toast(`<span>Exported ${rows.length} groups — opens straight in Excel</span>`, 3500);
}

/* ---------- render + events ---------- */
function render() {
  const views = { dashboard: viewDashboard, inbox: viewInbox, pipeline: viewPipeline, calendar: viewCalendar, tracker: viewTracker, documents: viewDocuments, families: viewFamilies, finance: viewFinance };
  const rt = route(); if (rt === 'finance') ui.role = 'fernanda'; else if (['dashboard', 'inbox', 'pipeline'].includes(rt)) ui.role = 'sharon';
  const r = rt, focusQ = document.activeElement?.id === 'q' ? document.activeElement.selectionStart : null, keep = $('.tbl-wrap')?.scrollTop, keepY = window.scrollY;
  renderSide(); $('#main').innerHTML = (views[r] || (ui.role === 'sharon' ? viewDashboard : viewFinance))();
  if (focusQ !== null) { const el = $('#q'); el.focus(); el.setSelectionRange(focusQ, focusQ); }
  if (keep) { const t = $('.tbl-wrap'); if (t) t.scrollTop = keep; }
  window.scrollTo(0, keepY);
}
window.addEventListener('hashchange', () => { closeDrawer(); render(); window.scrollTo(0, 0); });
const refresh = () => { save(); render(); if (ui.drawer) renderDrawer(); };

document.addEventListener('click', ev => {
  if (ev.target.closest('[data-stop]')) return;
  const el = ev.target.closest('[data-action]'); if (!el) return;
  const a = el.dataset.action, d = el.dataset, g = d.id ? byId(+d.id) : null;
  if (el.tagName === 'A' && a === 'open') ev.preventDefault();
  const go = h => { location.hash = h; };
  switch (a) {
    case 'open': openGroup(+d.id); break;
    case 'open-prep': openGroup(+d.id, 'prep'); break;
    case 'open-fin': openGroup(+d.id, 'finance'); break;
    case 'doc-programme': openPrepAt(+d.id, 'programme'); break;
    case 'doc-families': openPrepAt(+d.id, 'families'); break;
    case 'dtab': ui.dtab = d.t; renderDrawer(); break;
    case 'close-drawer': closeDrawer(); break;
    case 'region': ui.region = d.region; render(); break;
    case 'status-filter': ui.status = d.s; render(); break;
    case 'month-filter': ui.month = d.m; render(); break;
    case 'tracker-region': ui.trackerRegion = d.region; render(); break;
    case 'fam-centre': ui.fcentre = d.c; render(); break;
    case 'ftab': ui.ftab = d.t; render(); break;
    case 'cal-prev': ui.calMonth = shiftMonth(ui.calMonth, -1); render(); break;
    case 'cal-next': ui.calMonth = shiftMonth(ui.calMonth, 1); render(); break;
    case 'mail': ui.mail = d.id; ui.pick = null; render(); break;
    case 'pick': ui.pick = d.centre; render(); break;
    case 'add-email': addFromEmail(d.id); break;
    case 'new': wizReset(); go('#/inbox'); break;
    case 'wiz-extract': { ui.wiz.raw = $('#wiz-paste')?.value || ''; wizParse(); ui.wiz.step = 1; render(); break; }
    case 'wiz-manual': { ui.wiz.step = 1; render(); break; }
    case 'wiz-back': { ui.wiz.step = Math.max(0, ui.wiz.step - 1); render(); break; }
    case 'wiz-to-avail': {
      const w = ui.wiz; w.agent = $('#wiz-agent')?.value || w.agent; w.contact = $('#wiz-contact')?.value || w.contact;
      w.email = $('#wiz-email')?.value || w.email; w.school = $('#wiz-school')?.value || w.school;
      w.students = $('#wiz-students')?.value || w.students; w.adults = $('#wiz-adults')?.value || w.adults;
      w.arrival = $('#wiz-arrival')?.value || w.arrival; w.departure = $('#wiz-departure')?.value || w.departure;
      w.region = $('#wiz-region')?.value || w.region; w.preferredCentre = $('#wiz-preferred-centre')?.value || '';
      w.activities = $('#wiz-activities')?.value || w.activities;
      if (w.preferredCentre) { w.region = regionOf(w.preferredCentre).id; w.pick = w.preferredCentre; }
      w.step = 2; render(); break; }
    case 'wiz-pick': { ui.wiz.pick = d.centre; render(); break; }
    case 'wiz-submit': { wizSubmit(); break; }
    case 'wiz-another': { wizReset(); render(); break; }
    case 'wiz-open': { const id = +d.id; ui.wiz = null; openGroup(id); break; }
    case 'wiz-view-pipeline': { ui.status = d.status || 'enquiry'; ui.wiz = null; go('#/pipeline'); break; }
    case 'wiz-cancel': { ui.wiz = null; go('#/dashboard'); break; }
    case 'promote': setStatus(+d.id, 'enquiry'); el.closest('.toast')?.remove(); break;
    case 'export': exportCsv(); break;
    case 'undo-status': undoStatus(); el.closest('.toast')?.remove(); break;
    case 'goto-mail': ui.mail = d.id; ui.pick = null; go('#/inbox'); break;
    case 'goto-cal': ui.calMonth = d.month; ui.region = d.region; go('#/calendar'); break;
    case 'switch-role': ui.role = ui.role === 'sharon' ? 'fernanda' : 'sharon'; closeDrawer(); if (location.hash === (ui.role === 'sharon' ? '#/dashboard' : '#/finance')) render(); else go(ui.role === 'sharon' ? '#/dashboard' : '#/finance'); break;
    case 'add-family': S.families.unshift({ id: S.nextFam++, name: 'New family', centre: ui.fcentre === 'all' ? 'Bray' : ui.fcentre, cap: 3, pets: false, address: '', phone: '', pay: '' }); ui.q = ''; refresh(); break;
    case 'ptab': ui.ptab = d.t; ui.q = ''; render(); break;
    case 'add-venue': S.venues.push({ id: S.nextVenue++, name: 'New venue', address: '', contact: '', coords: '' }); refresh(); break;
    case 'add-item': (g.programme[d.date] ||= []).push({ time: '', text: '', by: '', venue: 0 }); refresh(); break;
    case 'del-item': g.programme[d.date].splice(+d.i, 1); refresh(); break;
    case 'tpl': { const ds = daysOf(g), first = ds[0], last = ds[ds.length - 1];
      (g.programme[first] ||= []).unshift({ time: '', text: 'Group arrives at Dublin Airport', by: '', venue: 0 }, { time: '', text: `Group arrives at Centre in ${g.centre}`, by: '', venue: 0 });
      (g.programme[last] ||= []).push({ time: '', text: 'Transfer to Dublin Airport', by: '', venue: 0 }, { time: '', text: 'Flight departs', by: '', venue: 0 }); refresh(); break; }
    case 'add-alloc': { const v = +$('#newFam_' + d.kind).value; if (v) { const f = famById(v); g.alloc.push({ fid: v, kind: d.kind, n: Math.min(f.cap, Math.max(1, people(g) - placed(g))), notes: '' }); refresh(); } break; }
    case 'del-alloc': g.alloc.splice(+d.i, 1); refresh(); break;
    case 'programme': openProgramme(g.id); break;
    case 'lo-sent': g.tasks.familyList = true; log(g, 'Family list sent to the local organiser'); refresh(); toast(`<span>✓ Family list for <b>${esc(g.school)}</b> marked as sent to the local organiser — ticked in the Tracker</span>`, 4000); break;
    case 'send-list': g.fin.familyListSent = DEMO_TODAY; log(g, 'Family list sent to Fernanda for payment'); refresh(); toast(`<span>✓ Family list for <b>${esc(g.school)}</b> sent to Fernanda — ${placed(g)} students across ${g.alloc.length} families</span>`, 5000); break;
    case 'pay-families': g.fin.familiesPaid = true; log(g, 'Host families paid'); refresh(); toast(`<span>✓ Host families paid for <b>${esc(g.school)}</b></span>`, 3500); break;
    case 'deposit-sent': g.fin.deposit = 'sent'; log(g, 'Deposit request sent to agent'); refresh(); toast(`<span>Deposit request sent for <b>${esc(g.school)}</b></span>`, 3000); break;
    case 'vouchers': openVouchers(g.id); break;
    case 'voucher-builder': openVoucherBuilder(g.id); break;
    case 'create-voucher': { const venue = S.venues.find(v => v.id === +$('#voucher-venue')?.value), date = $('#voucher-date')?.value || g.arrival, time = $('#voucher-time')?.value || '';
      if (venue) { (g.programme[date] ||= []).push({ time, text: venue.name, by: 'corrib', venue: venue.id }); g.tasks.visits = true; g.tasks.vouchers = true; log(g, `Voucher created for ${venue.name} on ${fmtFull(date)}`); save(); openVouchers(g.id); } break; }
    case 'family-list': openFamilyList(g.id); break;
    case 'print': window.print(); break;
    case 'close-modal': ui.confirming = null; $('#modal').classList.remove('on'); render(); if (ui.drawer) renderDrawer(); break;
    case 'confirm-status': { const date = $('#confirm-date')?.value || DEMO_TODAY, proof = $('#confirm-proof')?.value.trim() || '';
      g.confirmation = { date, proof }; log(g, proof ? 'Agent confirmation email saved' : 'Confirmation recorded without pasted email'); ui.confirming = null; $('#modal').classList.remove('on'); setStatus(g.id, 'confirmed'); break; }
    case 'add-line': { if (d.kind === 'extras') g.fin.extras = [...(g.fin.extras ?? parseExtras(g.invoice)), { desc: 'New line', amount: 0 }]; else g.fin.costs.push({ desc: 'New cost', amount: 0 }); refresh(); break; }
    case 'del-line': { if (d.kind === 'extras') { g.fin.extras = (g.fin.extras ?? parseExtras(g.invoice)).filter((_, i) => i !== +d.i); } else g.fin.costs.splice(+d.i, 1); refresh(); break; }
    case 'reset-extras': g.fin.extras = undefined; refresh(); break;
    case 'reset': if (confirm('Restore the original demo data? Your changes will be lost.')) { S = fresh(); save(); closeDrawer(); ui.role = 'sharon'; location.hash = '#/dashboard'; render(); } break;
  }
});
document.addEventListener('change', ev => {
  const el = ev.target.closest('[data-change]'); if (!el) return;
  const k = el.dataset.change, d = el.dataset;
  if (k === 'setting') { S.settings[d.k] = +el.value || 0; refresh(); return; }
  if (k === 'fam') { const f = famById(+d.id); f[d.k] = d.k === 'cap' ? Math.max(1, +el.value || 1) : d.k === 'pets' ? el.checked : el.value; refresh(); return; }
  if (k === 'venue') { S.venues.find(v => v.id === +d.id)[d.k] = el.value; refresh(); return; }
  if (k === 'doc-group') { ui.docGroup = +el.value; render(); return; }
  if (k === 'voucher-venue') { const v = S.venues.find(x => x.id === +el.value); const box = $('#voucher-auto'); if (box) box.innerHTML = venueInfo(v); return; }
  if (k === 'caddr') { S.centreAddr[d.c] = el.value; refresh(); return; }
  const g = byId(+d.id); if (!g) return;
  if (k === 'pipeline-centre') { const old = g.centre; g.centre = el.value; g.alloc = [];
    if (g.status === 'waiting' && fits(g)) { g.status = 'enquiry'; g.holdUntil = addDays(DEMO_TODAY, S.settings.holdDays); log(g, `Moved from ${old} waiting list to a provisional hold at ${g.centre}`); toast(`<span>✓ ${esc(g.centre)} has room — the group is now an enquiry with beds held until ${fmt(g.holdUntil)}</span>`, 4500); }
    else if (g.status === 'enquiry' && !fits(g)) { g.status = 'waiting'; g.holdUntil = ''; log(g, `Moved from ${old} to the ${g.centre} waiting list — no beds held`); toast(`<span>${esc(g.centre)} is full for these dates — moved to its waiting list. No beds are held.</span>`, 4500); }
    else { log(g, `Centre changed: ${old} → ${g.centre}`); toast(`<span>Centre changed to <b>${esc(g.centre)}</b>. The calendar updated automatically.</span>`, 3500); }
    refresh(); return; }
  if (k === 'status') { if (el.value === 'confirmed' && g.status !== 'confirmed') askToConfirm(g.id); else setStatus(g.id, el.value); return; }
  if (k === 'fin') { g.fin[d.k] = el.value; log(g, `${d.k === 'deposit' ? 'Deposit' : 'Invoice'}: ${(d.k === 'deposit' ? DEP : INV)[el.value]}`); refresh(); return; }
  if (k === 'task') { g.tasks[d.k] = el.checked; refresh(); return; }
  if (k === 'alloc') { g.alloc[+d.i][d.k] = d.k === 'n' ? Math.max(1, +el.value || 1) : el.value; refresh(); return; }
  if (k === 'pitem') { const it = g.programme[d.date][+d.i]; it[d.k] = d.k === 'venue' ? +el.value || 0 : el.value; refresh(); return; }
  if (k === 'finline') { const arr = d.kind === 'extras' ? (g.fin.extras ??= parseExtras(g.invoice)) : g.fin.costs; arr[+d.i][d.k] = d.k === 'amount' ? +el.value || 0 : el.value; refresh(); return; }
  const f = d.f; let v = el.value;
  if (f === 'students' || f === 'adults') v = v === '' ? 0 : +v;
  if (f === 'centre') log(g, `Centre changed: ${g.centre} → ${v}`);
  if (f === 'centre') g.alloc = [];
  g[f] = v;
  if ((f === 'arrival' || f === 'departure') && g.departure && g.arrival > g.departure) toast('<span>Departure is before arrival — please check the dates</span>', 3500);
  refresh();
});
document.addEventListener('input', ev => {
  const el = ev.target.closest('[data-input="q"]'); if (el) { ui.q = el.value; render(); }
  if (ev.target.id === 'wiz-paste' && ui.wiz) { ui.wiz.raw = ev.target.value; const btn = ev.target.parentElement?.querySelector('[data-action="wiz-extract"]'); if (btn) btn.disabled = !ev.target.value.trim(); }
});
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') { closeDrawer(); ui.confirming = null; $('#modal').classList.remove('on'); render(); }
  if (ev.key === 'Enter' && ev.target.dataset?.enter === 'add-visit') { ev.preventDefault(); ev.target.nextElementSibling.click(); }
});

render();
