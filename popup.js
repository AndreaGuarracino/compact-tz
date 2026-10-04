const $ = (s) => document.querySelector(s);
const store = chrome.storage.sync;
const ZONES = Intl.supportedValuesOf('timeZone');
const ABBR = { UTC: 'UTC', GMT: 'Europe/London', BST: 'Europe/London', WET: 'Europe/Lisbon', CET: 'Europe/Rome', CEST: 'Europe/Rome', EET: 'Europe/Athens', EEST: 'Europe/Athens', MSK: 'Europe/Moscow',
  ET: 'America/New_York', EST: 'America/New_York', EDT: 'America/New_York', CT: 'America/Chicago', CST: 'America/Chicago', CDT: 'America/Chicago', MT: 'America/Denver', MST: 'America/Phoenix', MDT: 'America/Denver',
  PT: 'America/Los_Angeles', PST: 'America/Los_Angeles', PDT: 'America/Los_Angeles', AKST: 'America/Anchorage', HST: 'Pacific/Honolulu', BRT: 'America/Sao_Paulo', GST: 'Asia/Dubai', IST: 'Asia/Kolkata', SGT: 'Asia/Singapore',
  HKT: 'Asia/Hong_Kong', JST: 'Asia/Tokyo', KST: 'Asia/Seoul', AEST: 'Australia/Sydney', AEDT: 'Australia/Sydney', NZST: 'Pacific/Auckland', NZDT: 'Pacific/Auckland', SAST: 'Africa/Johannesburg' };
const ABBR_FIX = { 'Asia/Tokyo': 'JST', 'Asia/Seoul': 'KST', 'Asia/Shanghai': 'CST', 'Asia/Hong_Kong': 'HKT', 'Europe/Moscow': 'MSK', 'America/Sao_Paulo': 'BRT' };
const LOCS = ['en-US', 'en-GB', 'en-IN', 'en-AU', 'en-SG', 'en-NZ', 'en-ZA'];
const STEP = 15 * 60e3;
const S = { places: [], fmt: '24', theme: 'system', fs: '20' };
let shift = 0, dayOff = 0, dragFrom = -1, hits = [], hitOn = 0, focusId = null, cat = null;

const log = (...a) => console.log('[ctz]', ...a);
const done = (what) => () => chrome.runtime.lastError ? console.error('[ctz] save failed', what, chrome.runtime.lastError.message) : log('saved', what);
const uid = () => Math.random().toString(36).slice(2, 10);
const saveAll = () => store.set({ order: S.places.map((p) => p.id), ...Object.fromEntries(S.places.map((p) => ['p:' + p.id, { tz: p.tz, label: p.label }])) }, done(S.places.length + ' places'));
const save = (k) => store.set({ [k]: S[k] }, done(k));
const norm = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const short = (tz) => tz.split('/').pop().replace(/_/g, ' ');

// Cached Intl formatters
const DTF = new Map();
function dtf(loc, tz, opt) {
  const k = loc + tz + JSON.stringify(opt);
  if (!DTF.has(k)) DTF.set(k, new Intl.DateTimeFormat(loc, { timeZone: tz, ...opt }));
  return DTF.get(k);
}
const part = (d, loc, tz, opt) => dtf(loc, tz, opt).formatToParts(d).find((p) => p.type === 'timeZoneName').value;
const canon = (tz) => dtf('en', tz, {}).resolvedOptions().timeZone;
const HOME = canon(Intl.DateTimeFormat().resolvedOptions().timeZone);
const ymd = (d, tz) => dtf('en-CA', tz, {}).format(d);
const fmtTime = (d, tz) => S.fmt === '12' ? dtf('en-US', tz, { hour: '2-digit', minute: '2-digit', hour12: true }).format(d) : dtf('en-GB', tz, { hour: '2-digit', minute: '2-digit' }).format(d);
const offset = (d, tz) => part(d, 'en-US', tz, { timeZoneName: 'shortOffset' }).replace('GMT', 'UTC');

// Abbreviation like CEST, else empty
function abbr(d, tz) {
  for (const l of LOCS) {
    const a = part(d, l, tz, { timeZoneName: 'short' });
    if (a === 'GMT' || a === 'UTC' || !/^(GMT|UTC)/.test(a)) return a;
  }
  return ABBR_FIX[canon(tz)] || (/^UTC(\+0)?$/.test(offset(d, tz)) ? 'GMT' : '');
}

// Selected instant from controls
function instant() {
  const base = shift || dayOff ? Math.round(Date.now() / STEP) * STEP : Date.now();
  return new Date(base + shift * STEP + dayOff * 864e5);
}

// Start renaming a place
function edit(el, p) {
  el.contentEditable = 'plaintext-only';
  el.focus();
  getSelection().selectAllChildren(el); getSelection().collapseToEnd();
  el.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); el.blur(); } if (e.key === 'Escape') { el.textContent = p.label; el.blur(); } };
  el.onblur = () => {
    const v = el.textContent.trim().replace(/\s+/g, ' ');
    if (v && v !== p.label) { p.label = v; saveAll(); }
    focusId = p.id; render();
  };
}

function move(i, j) {
  if (j < 0 || j >= S.places.length) return;
  S.places.splice(j, 0, S.places.splice(i, 1)[0]);
  focusId = S.places[j].id; saveAll(); render();
}

function remove(i) {
  const [p] = S.places.splice(i, 1);
  log('removed', p.tz, p.label);
  store.remove('p:' + p.id, done('remove ' + p.id)); saveAll(); render();
}

// Draw all place rows
function render() {
  const d = instant(), here = ymd(d);
  focusId ??= document.activeElement?.closest?.('#list li')?.dataset.id;
  $('#date').value = ymd(new Date(Date.now() + dayOff * 864e5));
  $('#list').replaceChildren(...S.places.map((p, i) => {
    const li = document.createElement('li');
    const diff = Math.round((new Date(ymd(d, p.tz)) - new Date(here)) / 864e5);
    const h = +dtf('en-GB', p.tz, { hour: 'numeric', hourCycle: 'h23' }).format(d);
    const home = canon(p.tz) === HOME;
    li.className = [h >= 9 && h < 18 ? 'work' : h >= 22 || h < 8 ? 'night' : '', home ? 'home' : ''].join(' ');
    li.tabIndex = 0;
    li.dataset.id = p.id;
    li.innerHTML = '<span class="main"><span class="label"></span></span><span class="abbr"></span><span class="utc"></span><span class="date"></span><span class="day"></span><span class="time"></span><button class="x" title="Remove">&#215;</button>';
    const [main, label, ab, utc, date, day, time, x] = li.querySelectorAll('*');
    label.textContent = p.label;
    main.title = `${p.label}\n${p.tz}${home ? ' (your time zone)' : ''}`;
    ab.textContent = abbr(d, p.tz);
    utc.textContent = offset(d, p.tz);
    date.textContent = dtf('en-GB', p.tz, { weekday: 'short', day: 'numeric', month: 'short' }).format(d);
    day.textContent = diff ? `${diff > 0 ? '+' : ''}${diff}d` : '';
    time.textContent = fmtTime(d, p.tz);
    main.ondblclick = () => edit(label, p);
    x.onclick = (e) => {
      e.stopPropagation();
      if (x.classList.contains('sure')) return remove(i);
      x.classList.add('sure'); x.textContent = 'Remove?';
      setTimeout(() => { x.classList.remove('sure'); x.innerHTML = '&#215;'; }, 3000);
    };
    li.onkeydown = (e) => {
      if (e.target !== li) return;
      if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); move(i, i - 1); }
      else if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); move(i, i + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); li.previousElementSibling?.focus(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); li.nextElementSibling?.focus(); }
      else if (e.key === 'Enter') edit(label, p);
      else if (e.key === 'Delete') x.click();
    };
    li.onmousedown = (e) => { li.draggable = !e.target.isContentEditable; };
    li.ondragstart = () => { dragFrom = i; li.classList.add('drag'); };
    li.ondragend = () => li.classList.remove('drag');
    li.ondragover = (e) => { e.preventDefault(); li.classList.add('over'); };
    li.ondragleave = () => li.classList.remove('over');
    li.ondrop = () => { li.classList.remove('over'); if (dragFrom >= 0 && dragFrom !== i) move(dragFrom, i); dragFrom = -1; };
    return li;
  }));
  if (focusId) { $(`#list li[data-id="${focusId}"]`)?.focus(); focusId = null; }
}

function add(tz, label) {
  const p = { id: uid(), tz, label };
  S.places.push(p);
  log('added', tz, label);
  saveAll();
  $('#q').value = ''; $('#hits').hidden = true; render();
}

// Load city catalog on first search
async function catalog() {
  if (cat) return cat;
  const { TZ, ADM, COUNTRIES, ROWS } = await import('./cities.js');
  const names = [...new Set(['it', navigator.language])].map((l) => new Intl.DisplayNames([l], { type: 'region' }));
  cat = {
    countries: COUNTRIES.map(([cc, en, tzs]) => ({ names: [en, ...names.map((n) => n.of(cc))], tzs: tzs.map((i) => TZ[i]) })),
    cities: ROWS.split('\n').map((l) => { const [n, a, c, t] = l.split('\t'); return { n, k: norm(n), sub: [ADM[a], COUNTRIES[c][1]].filter(Boolean).join(', '), tz: TZ[t] }; }),
  };
  log('catalog', cat.cities.length, 'cities', cat.countries.length, 'countries');
  return cat;
}

// Search abbreviations, zones, countries, cities
function search(q, { countries, cities }) {
  q = norm(q.trim());
  if (!q) return [];
  const out = [];
  for (const [k, tz] of Object.entries(ABBR)) if (k.toLowerCase().startsWith(q)) out.push({ tz, label: k, sub: tz });
  for (const tz of ZONES) if (tz.toLowerCase().replace(/_/g, ' ').includes(q)) out.push({ tz, label: short(tz), sub: tz });
  for (const c of countries) {
    const name = c.names.find((n) => norm(n).startsWith(q));
    if (name) for (const tz of c.tzs.slice(0, 6)) out.push({ tz, label: c.tzs.length > 1 ? `${name} (${short(tz)})` : name, sub: tz });
  }
  const pre = [], mid = [];
  for (const c of cities) {
    if (c.k.startsWith(q)) { pre.push({ tz: c.tz, label: c.n, sub: c.sub }); if (pre.length >= 30) break; }
    else if (mid.length < 20 && c.k.includes(q)) mid.push({ tz: c.tz, label: c.n, sub: c.sub });
  }
  return [...out.slice(0, 12), ...pre, ...mid].slice(0, 40);
}

function showHits() {
  const d = instant();
  $('#hits').replaceChildren(...hits.map((h, i) => {
    const li = document.createElement('li');
    li.className = i === hitOn ? 'on' : '';
    li.innerHTML = '<span><b></b> <small></small></span><small></small>';
    const [b, sub, time] = li.querySelectorAll('b, small');
    b.textContent = h.label; sub.textContent = h.sub; time.textContent = fmtTime(d, h.tz);
    li.onmousedown = (e) => { e.preventDefault(); add(h.tz, h.label); };
    return li;
  }));
  $('#hits').hidden = !hits.length;
  $('#hits').children[hitOn]?.scrollIntoView({ block: 'nearest' });
}

function applyTheme() {
  if (S.theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = S.theme;
  document.documentElement.style.setProperty('--fs', S.fs + 'px');
  try { localStorage.setItem('ctz:theme', S.theme); localStorage.setItem('ctz:fs', S.fs); } catch (e) { console.error('[ctz] theme cache failed', e); }
}

// Wire controls
$('#q').oninput = async (e) => {
  const q = e.target.value, c = await catalog();
  if (q !== $('#q').value) return;
  hits = search(q, c); hitOn = 0; showHits();
};
$('#q').onkeydown = (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); hitOn = (hitOn + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % (hits.length || 1); showHits(); }
  if (e.key === 'Enter' && hits[hitOn]) add(hits[hitOn].tz, hits[hitOn].label);
  if (e.key === 'Escape') $('#hits').hidden = true;
};
$('#q').onblur = () => ($('#hits').hidden = true);
$('#shift').oninput = (e) => { shift = +e.target.value; render(); };
$('#date').onchange = (e) => { dayOff = Math.round((new Date(e.target.value) - new Date(ymd(new Date()))) / 864e5) || 0; render(); };
$('#now').onclick = () => { shift = dayOff = 0; $('#shift').value = 0; render(); };
$('#sort').onclick = () => {
  const d = new Date(), off = (tz) => new Date(d.toLocaleString('en-US', { timeZone: tz })) - new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
  S.places.sort((a, b) => off(a.tz) - off(b.tz)); saveAll(); render();
};
$('#more').onclick = () => { $('#menu').hidden = !$('#menu').hidden; $('#doc').hidden = true; };
$('#docbtn').onclick = () => { $('#menu').hidden = true; $('#doc').hidden = false; };
$('#docclose').onclick = () => ($('#doc').hidden = true);
$('#fs').onchange = (e) => { S.fs = e.target.value; save('fs'); applyTheme(); };
$('#fmt').onchange = (e) => { S.fmt = e.target.value; save('fmt'); render(); };
$('#theme').onchange = (e) => { S.theme = e.target.value; save('theme'); applyTheme(); };

// Load state; first run reads places.json
function load() {
  store.get(null, async (got) => {
    if (chrome.runtime.lastError) console.error('[ctz] load failed', chrome.runtime.lastError.message);
    S.fmt = got.fmt || S.fmt; S.theme = got.theme || S.theme; S.fs = got.fs || S.fs;
    if (got.order) S.places = got.order.filter((id) => got['p:' + id]).map((id) => ({ id, tz: got['p:' + id].tz, label: got['p:' + id].label }));
    else {
      try { S.places = (await (await fetch('places.json')).json()).map((p) => ({ id: uid(), tz: p.tz, label: p.label })); saveAll(); log('restored', S.places.length, 'places from places.json'); }
      catch (e) { S.places = [{ id: uid(), tz: HOME, label: short(HOME) }]; log('no places.json, first run shows home only', e.message); }
    }
    $('#fmt').value = S.fmt; $('#theme').value = S.theme; $('#fs').value = S.fs;
    log('loaded', S.places.length, 'places, home', HOME);
    applyTheme(); render();
  });
}
store.onChanged.addListener(() => { if (!document.activeElement?.isContentEditable) load(); });
load();
setInterval(() => { if (!shift && !dayOff && !document.activeElement?.isContentEditable) render(); }, 30e3);
