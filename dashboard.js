(() => {
  'use strict';

  // ---------- DOM helpers ----------
  const $$ = (sel, root = document) => root.querySelector(sel);
  const $$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => {
    const d = document.createElement('div');
    d.textContent = String(s ?? '');
    return d.innerHTML;
  };

  // ---------- URL helpers ----------
  const BASE = new URL('.', window.location.href);
  const url = (p) => new URL(p, BASE).toString();

  function qs() {
    return new URLSearchParams(window.location.search);
  }

  function activeTabFromHash() {
    const h = (window.location.hash || '#summary').replace('#', '').trim();
    if (!h) return 'summary';
    // Support deep-links like #session-<id>
    if (h.startsWith('session-')) return 'sessions';
    if (['summary','map','sessions','media','feedback'].includes(h)) return h;
    return 'summary';
  }

  // ---------- Data / state ----------
  const state = {
    campaigns: [],
    campaignId: null,
    campaign: null,

    sessions: [],
    sessionsById: new Map(),
    sheetsIndex: null,

    filteredSessions: [],
    dateMin: null,
    dateMax: null,
    dateFrom: null,
    dateTo: null,

    map: null,
    markerLayer: null,
    markersBySessionId: new Map(),
    // Filters for host (farmer) name and city
    nameFilter: '',
    cityFilter: '',
  };

  // ---------- Parsing / formatting ----------
  function parseDateSafe(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    const s = String(v).trim();
    // Prefer YYYY-MM-DD
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    // Fallback Date.parse
    const t = Date.parse(s);
    if (Number.isFinite(t)) return new Date(t);
    return null;
  }

  function formatDateInput(d) {
    const dt = parseDateSafe(d);
    if (!dt || Number.isNaN(dt.getTime())) return '';
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function fmtInt(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '—';
    return x.toLocaleString();
  }

  function fmt1(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '—';
    return x.toFixed(1);
  }

  function num(v) {
    return (typeof v === 'number' && Number.isFinite(v)) ? v : NaN;
  }

  // ---------- Media path resolution ----------
  const existsCache = new Map(); // url -> boolean

  function normalizeMediaPath(p) {
    const raw = String(p ?? '').trim();
    if (!raw) return '';
    if (/^(https?:|data:|blob:)/i.test(raw)) return raw;

    let x = raw.replace(/^\.?\//, '').replace(/^\//, '');

    // Already rooted correctly
    if (x.startsWith('assets/')) return x;

    // Common patterns from sessions.json
    if (x.startsWith('gallery/')) return 'assets/' + x;

    // Sometimes data stores just the filename
    if (!x.includes('/')) return 'assets/gallery/' + x;

    // Default: relative as-is
    return x;
  }

  function candidatePaths(p) {
    const norm = normalizeMediaPath(p);
    if (!norm) return [];
    if (/^(https?:|data:|blob:)/i.test(norm)) return [norm];

    const candidates = [];
    const add = (v) => {
      if (v && !candidates.includes(v)) candidates.push(v);
    };

    // Always start with the normalized path.
    add(norm);

    // If request is wrong folder (root) try under assets/gallery
    if (!norm.startsWith('assets/gallery/') && !norm.includes('/gallery/')) {
      const fname = norm.split('/').pop();
      add('assets/gallery/' + fname);
    }

    // Extension swaps
    const imgExts = ['.jpeg', '.jpg', '.png', '.webp'];
    const isImg = /\.(jpeg|jpg|png|webp)$/i.test(norm);
    const isVid = /\.(mp4|webm)$/i.test(norm);

    function addVariantBases(base) {
      // Support common variant naming:
      //   17a.jpg  <-> 17_a.jpg <-> 17-a.jpg
      //   17_a.jpg <-> 17a.jpg
      // (applies for a-f, but will also include single-letter suffixes generally)
      const m1 = base.match(/^(.*?)([a-z])$/i);
      const m2 = base.match(/^(.*?)[_-]([a-z])$/i);
      if (m1) {
        const root = m1[1];
        const suf = m1[2];
        add(base);
        add(root + '_' + suf);
        add(root + '-' + suf);
        // also try without suffix (helps when data references 17a but file is 17)
        add(root);
        return;
      }
      if (m2) {
        const root = m2[1];
        const suf = m2[2];
        add(base);
        add(root + suf);
        add(root);
        return;
      }
      add(base);
      // Also try the simplest "a" variant both joined and separated
      add(base + 'a');
      add(base + '_a');
      add(base + '-a');
    }

    if (isImg) {
      const base = norm.replace(/\.(jpeg|jpg|png|webp)$/i, '');
      const bases = [];
      const addBase = (b) => { if (b && !bases.includes(b)) bases.push(b); };

      // Collect base variants first, then add extensions.
      const before = candidates.length;
      addVariantBases(base);
      for (let i = before; i < candidates.length; i++) {
        const c = candidates[i];
        if (!/\.(jpeg|jpg|png|webp|mp4|webm)$/i.test(c)) addBase(c);
      }

      // Ensure original base is also present.
      addBase(base);

      for (const b of bases) {
        for (const e of imgExts) add(b + e);
      }
    }

    if (isVid) {
      const base = norm.replace(/\.(mp4|webm)$/i, '');
      const bases = [];
      const addBase = (b) => { if (b && !bases.includes(b)) bases.push(b); };

      const before = candidates.length;
      addVariantBases(base);
      for (let i = before; i < candidates.length; i++) {
        const c = candidates[i];
        if (!/\.(jpeg|jpg|png|webp|mp4|webm)$/i.test(c)) addBase(c);
      }
      addBase(base);

      for (const b of bases) {
        add(b + '.mp4');
        add(b + '.webm');
      }
    }

    // Only keep candidates that look like concrete asset files (avoid hammering the network
    // with extension-less paths).
    return candidates.filter(c =>
      /^(https?:|data:|blob:)/i.test(c)
      || /\.(?:jpeg|jpg|png|webp|mp4|webm)$/i.test(c)
    );
  }

  async function assetExists(relOrAbs) {
    const u = /^(https?:|data:|blob:)/i.test(relOrAbs) ? relOrAbs : url(relOrAbs);
    if (existsCache.has(u)) return existsCache.get(u);

    // HEAD often works on GitHub Pages; if blocked, fallback to Range GET.
    try {
      const r = await fetch(u, { method: 'HEAD', cache: 'no-store' });
      const ok = r.ok;
      existsCache.set(u, ok);
      return ok;
    } catch (_e) {
      try {
        const r = await fetch(u, {
          method: 'GET',
          headers: { Range: 'bytes=0-0' },
          cache: 'no-store'
        });
        const ok = r.ok;
        existsCache.set(u, ok);
        return ok;
      } catch (_e2) {
        existsCache.set(u, false);
        return false;
      }
    }
  }

  async function resolveFirstExisting(p) {
    const cands = candidatePaths(p);
    for (const c of cands) {
      if (await assetExists(c)) return c;
    }
    return '';
  }

  function attachSmartImage(imgEl, path) {
    let cancelled = false;
    const placeholder = 'assets/placeholder.svg';

    (async () => {
      const chosen = await resolveFirstExisting(path);
      if (cancelled) return;
      imgEl.src = chosen ? url(chosen) : url(placeholder);
    })();

    imgEl.onerror = () => {
      imgEl.onerror = null;
      imgEl.src = url(placeholder);
    };

    return () => { cancelled = true; };
  }

  function attachSmartVideo(videoEl, path) {
    const placeholder = 'assets/placeholder-video.mp4';
    let tried = false;

    // lazy load on click
    videoEl.preload = 'metadata';
    videoEl.controls = true;

    videoEl.addEventListener('click', async () => {
      if (tried) return;
      tried = true;
      const chosen = await resolveFirstExisting(path);
      videoEl.src = chosen ? url(chosen) : url(placeholder);
      videoEl.play().catch(() => { /* ignore */ });
    });

    videoEl.onerror = () => {
      videoEl.onerror = null;
      videoEl.src = url(placeholder);
    };
  }

  // ---------- Tab controller ----------
  function setActiveTab(tab) {
    const tabs = $$$('.tabBtn[data-tab]');
    // IMPORTANT: only hide/show *panels*, not the tab buttons.
    // (tab buttons also carry data-tab and must remain visible)
    const panels = $$$('.tabPanel[data-tab]');

    tabs.forEach(a => {
      const is = a.dataset.tab === tab;
      a.classList.toggle('tabBtn--active', is);
      a.setAttribute('aria-selected', is ? 'true' : 'false');
    });

    panels.forEach(p => {
      const is = p.getAttribute('data-tab') === tab;
      p.classList.toggle('hidden', !is);
    });

    document.dispatchEvent(new CustomEvent('tabchange', { detail: { tab } }));
  }

  function syncTabFromHash() {
    setActiveTab(activeTabFromHash());
  }

  // ---------- Loading ----------
  async function fetchJson(path, why) {
    const u = url(path);
    const r = await fetch(u, { cache: 'no-store' });
    if (!r.ok) {
      throw new Error(`${why} failed (${r.status}): ${u}`);
    }
    return await r.json();
  }

  async function loadCampaignRegistry() {
    try {
      const reg = await fetchJson('data/campaigns.json', 'campaign registry');
      state.campaigns = Array.isArray(reg.campaigns) ? reg.campaigns : [];
      return;
    } catch (e) {
      // Fallback to root campaigns.json (some repos place it there)
      try {
        const reg = await fetchJson('campaigns.json', 'campaign registry (root)');
        state.campaigns = Array.isArray(reg.campaigns) ? reg.campaigns : [];
        return;
      } catch (e2) {
        throw e;
      }
    }
  }

  function setStatus(msg, kind = '') {
    const el = $$('#statusBox');
    if (!el) return;
    el.textContent = msg;
    el.className = 'status' + (kind ? ' status--' + kind : '');
  }

  function setMapStatus(msg, ok = false) {
    const el = $$('#mapStatus');
    if (!el) return;
    el.textContent = msg;
    el.className = 'badge' + (ok ? ' badge--ok' : '');
  }

  // ---------- Leaflet loader (avoid race conditions + blocked CDNs) ----------
  let leafletPromise = null;

  function ensureLeafletCss() {
    if (document.querySelector('link[data-leaflet-css="1"], link#leafletCss')) return;
    const hrefs = [
      'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
      'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css'
    ];
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.dataset.leafletCss = '1';
    link.href = hrefs[0];
    document.head.appendChild(link);

    // Best-effort fallbacks if a CDN is blocked.
    let i = 0;
    link.onerror = () => {
      i += 1;
      if (i < hrefs.length) link.href = hrefs[i];
    };
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-leaflet-src="${src}"]`);
      if (existing) {
        // If it is already loaded, resolve. If not, wait for load/error.
        if (existing.dataset.loaded === '1') return resolve(true);
        existing.addEventListener('load', () => resolve(true), { once: true });
        existing.addEventListener('error', () => reject(new Error('Leaflet script failed: ' + src)), { once: true });
        return;
      }

      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.dataset.leafletSrc = src;
      s.addEventListener('load', () => { s.dataset.loaded = '1'; resolve(true); }, { once: true });
      s.addEventListener('error', () => reject(new Error('Leaflet script failed: ' + src)), { once: true });
      document.head.appendChild(s);
    });
  }

  async function ensureLeafletReady({ timeoutMs = 8000 } = {}) {
    if (window.L && window.L.map) return true;
    if (leafletPromise) return leafletPromise;

    leafletPromise = (async () => {
      ensureLeafletCss();

      const srcs = [
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
        'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'
      ];

      const start = Date.now();
      for (const src of srcs) {
        try {
          await loadScriptOnce(src);

          // Wait a tick for globals to attach.
          await new Promise(r => setTimeout(r, 0));
          if (window.L && window.L.map) return true;
        } catch (_e) {
          // try next
        }

        if (Date.now() - start > timeoutMs) break;
      }
      return !!(window.L && window.L.map);
    })();

    return leafletPromise;
  }

  function setRangeHint() {
    const el = $$('#rangeHint');
    if (!el || !state.dateMin || !state.dateMax) return;
    el.textContent = `Campaign duration: ${formatDateInput(state.dateMin)} to ${formatDateInput(state.dateMax)}`;
  }

  function applyDateInputs() {
    const fromEl = $$('#dateFrom');
    const toEl = $$('#dateTo');

    const from = parseDateSafe(fromEl?.value);
    const to = parseDateSafe(toEl?.value);

    if (!from || !to) {
      state.dateFrom = state.dateMin;
      state.dateTo = state.dateMax;
    } else {
      state.dateFrom = from;
      state.dateTo = to;
      if (state.dateFrom > state.dateTo) {
        const tmp = state.dateFrom;
        state.dateFrom = state.dateTo;
        state.dateTo = tmp;
      }
    }

    // Capture additional filters for farmer (host) name and city
    const nameEl = $$('#nameFilter');
    const cityEl = $$('#cityFilter');
    state.nameFilter = nameEl ? String(nameEl.value || '').trim() : '';
    state.cityFilter = cityEl ? String(cityEl.value || '').trim() : '';

    filterSessions();
    renderAll();
  }

  function resetDateInputs() {
    const fromEl = $$('#dateFrom');
    const toEl = $$('#dateTo');

    if (fromEl && state.dateMin) fromEl.value = formatDateInput(state.dateMin);
    if (toEl && state.dateMax) toEl.value = formatDateInput(state.dateMax);

    // Clear any text filters
    const nameEl = $$('#nameFilter');
    const cityEl = $$('#cityFilter');
    if (nameEl) nameEl.value = '';
    if (cityEl) cityEl.value = '';
    state.nameFilter = '';
    state.cityFilter = '';

    applyDateInputs();
  }

  function filterSessions() {
    const a = state.dateFrom;
    const b = state.dateTo;
    state.filteredSessions = state.sessions.filter(s => {
      const d = parseDateSafe(s.date);
      if (!d) return false;
      // Date range filter
      if (d < a || d > b) return false;
      // Host (farmer) name filter: match host.name substring if provided
      if (state.nameFilter) {
        const name = String(s.host?.name || '').toLowerCase();
        if (!name.includes(state.nameFilter.toLowerCase())) return false;
      }
      // City filter
      if (state.cityFilter) {
        const city = String(s.city || '').toLowerCase();
        if (!city.includes(state.cityFilter.toLowerCase())) return false;
      }
      return true;
    });
  }

  // ---------- Render ----------
  function renderSummary() {
    const fs = Array.isArray(state.filteredSessions) ? state.filteredSessions : [];
    const idx = state.sheetsIndex?.sheets ? new Map(state.sheetsIndex.sheets.map(x => [x.sheet, x])) : null;

    // ---------- Totals ----------
    let totalFarmers = 0;
    let totalAcres = 0;
    let totalEstAcres = 0;

    // ---------- Weighted averages (per-metric denominators so missing values do NOT behave like zeros) ----------
    let sumAw = 0, denAw = 0;
    let sumUl = 0, denUl = 0;
    let sumDe = 0, denDe = 0;
    let sumMb = 0, denMb = 0;
    let sumNi = 0, denNi = 0;
    let sumUn = 0, denUn = 0; // understanding is 0–3

    let sumScore = 0, denScore = 0;

    const drivers = new Map();
    const barriers = new Map();

    let imgRefs = 0;
    let vidRefs = 0;

    for (const s of fs) {
      const si = idx?.get(s.sheetRef);

      const farmers = Number(si?.farmers_present ?? s?.metrics?.farmers ?? 0);
      const acres = Number(si?.acres ?? s?.metrics?.wheatAcres ?? 0);

      if (Number.isFinite(farmers) && farmers > 0) totalFarmers += farmers;
      if (Number.isFinite(acres) && acres > 0) totalAcres += acres;

      const wt = (Number.isFinite(farmers) && farmers > 0) ? farmers : 1;
      const m = s.metrics || {};

      const aw = num(m.awarenessPct);
      const ul = num(m.usedLastYearPct);
      const de = num(m.definitePct);
      const mb = num(m.maybePct);
      const ni = num(m.notInterestedPct);
      const un = num(m.avgUnderstanding);

      if (Number.isFinite(aw)) { sumAw += aw * wt; denAw += wt; }
      if (Number.isFinite(ul)) { sumUl += ul * wt; denUl += wt; }
      if (Number.isFinite(de)) { sumDe += de * wt; denDe += wt; }
      if (Number.isFinite(mb)) { sumMb += mb * wt; denMb += wt; }
      if (Number.isFinite(ni)) { sumNi += ni * wt; denNi += wt; }
      if (Number.isFinite(un)) { sumUn += un * wt; denUn += wt; }

      const sc = num(s.score);
      if (Number.isFinite(sc)) { sumScore += sc * wt; denScore += wt; }

      const est = num(m.estimatedBuctrilAcres);
      if (Number.isFinite(est) && est > 0) totalEstAcres += est;

      // reasons (counts)
      const ru = s.reasonsUse && typeof s.reasonsUse === 'object' ? s.reasonsUse : null;
      if (ru) {
        for (const [k, v] of Object.entries(ru)) {
          const n = num(v);
          if (!Number.isFinite(n) || n <= 0) continue;
          drivers.set(k, (drivers.get(k) || 0) + n);
        }
      }

      const rn = s.reasonsNotUse && typeof s.reasonsNotUse === 'object' ? s.reasonsNotUse : null;
      if (rn) {
        for (const [k, v] of Object.entries(rn)) {
          const n = num(v);
          if (!Number.isFinite(n) || n <= 0) continue;
          barriers.set(k, (barriers.get(k) || 0) + n);
        }
      }

      // media reference counts
      const imgs = (s.media && Array.isArray(s.media.images)) ? s.media.images : [];
      const vids = (s.media && Array.isArray(s.media.videos)) ? s.media.videos : [];
      imgRefs += imgs.length;
      vidRefs += vids.length;
    }

    const avg = (sum, den) => (den > 0 ? (sum / den) : NaN);
    const pct = (v) => Number.isFinite(v) ? (fmt1(v) + '%') : '—';

    const awarenessAvg = avg(sumAw, denAw);
    const usedLastYearAvg = avg(sumUl, denUl);
    const definiteAvg = avg(sumDe, denDe);
    const maybeAvg = avg(sumMb, denMb);
    const notInterestedAvg = avg(sumNi, denNi);
    const understandingAvg = avg(sumUn, denUn); // 0–3
    const scoreAvg = avg(sumScore, denScore);

    // ---------- KPI tiles ----------
    const elKpiSessions = $$('#kpiSessions'); if (elKpiSessions) elKpiSessions.textContent = fmtInt(fs.length);
    const elKpiFarmers = $$('#kpiFarmers'); if (elKpiFarmers) elKpiFarmers.textContent = totalFarmers ? fmtInt(totalFarmers) : '—';
    const elKpiAcres = $$('#kpiAcres'); if (elKpiAcres) elKpiAcres.textContent = totalAcres ? fmt1(totalAcres) : '—';
    const elKpiEst = $$('#kpiEstAcres'); if (elKpiEst) elKpiEst.textContent = totalEstAcres ? fmt1(totalEstAcres) : '—';
    const elKpiAw = $$('#kpiAwareness'); if (elKpiAw) elKpiAw.textContent = pct(awarenessAvg);
    const elKpiDef = $$('#kpiDefinite'); if (elKpiDef) elKpiDef.textContent = pct(definiteAvg);
    const elKpiUsed = $$('#kpiUsedLastYear'); if (elKpiUsed) elKpiUsed.textContent = pct(usedLastYearAvg);
    const elKpiScore = $$('#kpiScore'); if (elKpiScore) elKpiScore.textContent = Number.isFinite(scoreAvg) ? fmt1(scoreAvg) : '—';

    // ---------- Funnel (donut charts) ----------
    const funnelEl = $$('#funnel');
    if (funnelEl) {
      const items = [
        { label: 'Awareness', pct: awarenessAvg },
        { label: 'Used last year', pct: usedLastYearAvg },
        { label: 'Definite intent', pct: definiteAvg },
        { label: 'Maybe', pct: maybeAvg },
        { label: 'Not interested', pct: notInterestedAvg },
        { label: 'Understanding', pct: (Number.isFinite(understandingAvg) ? (understandingAvg / 3 * 100) : NaN) },
      ];
      // Define custom colors for each donut based on semantic meaning
      const colors = {
        'Awareness': 'var(--brand)',
        'Used last year': 'var(--brand2)',
        'Definite intent': '#8e44ad',
        'Maybe': '#f59e0b',
        'Not interested': 'var(--danger)',
        'Understanding': '#eab308'
      };
      let html = '<div class="donutGrid">';
      for (const it of items) {
        const raw = Number(it.pct);
        const pctVal = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
        const color = colors[it.label] || 'var(--brand)';
        // Display value: percentages for most, understanding displays raw value / 3
        let display;
        if (it.label === 'Understanding') {
          display = Number.isFinite(understandingAvg) ? (fmt1(understandingAvg) + ' / 3') : '—';
        } else {
          display = Number.isFinite(raw) ? (fmt1(pctVal) + '%') : '—';
        }
        html += `<div class="donutCard">
          <div class="donutTitle">${esc(it.label)}</div>
          <div class="donutWrap">
            <div class="donut" style="--percent:${pctVal}; --color:${color};">
              <span class="donutValue">${esc(display)}</span>
            </div>
          </div>
          <div class="donutMeta"></div>
        </div>`;
      }
      html += '</div>';
      funnelEl.innerHTML = html;
    }

    // ---------- Top sessions table (by score) ----------
    const topBody = $$('#topSessionsTable tbody');
    if (topBody) {
      const top = [...fs].sort((a,b) => Number(b.score||0) - Number(a.score||0)).slice(0, 8);
      topBody.innerHTML = top.map(s => {
        const sid = esc(s.id);
        const date = esc(s.date || '');
        const sheet = esc(s.sheetRef || '');
        const district = esc(s.district || '');
        const village = esc(s.village || s.spot || '');
        const score = Number.isFinite(Number(s.score)) ? fmt1(s.score) : '—';
        const si = idx?.get(s.sheetRef);
        const f = si ? fmtInt(si.farmers_present) : (Number.isFinite(Number(s?.metrics?.farmers)) ? fmtInt(s.metrics.farmers) : '—');
        const a = si ? fmt1(si.acres) : (Number.isFinite(Number(s?.metrics?.wheatAcres)) ? fmt1(s.metrics.wheatAcres) : '—');
        const href = `details.html?campaign=${encodeURIComponent(state.campaignId)}&session=${encodeURIComponent(String(s.id))}`;
        return `<tr data-session-id="${sid}">
          <td>${date}</td>
          <td><span class="badge">${sheet}</span></td>
          <td>${district}</td>
          <td>${village}</td>
          <td>${f}</td>
          <td>${a}</td>
          <td>${score}</td>
          <td><a class="btn btnSmall" href="${href}">Open</a></td>
        </tr>`;
      }).join('');
    }

    // ---------- Priority districts ----------
    const pdBody = $$('#priorityDistrictsTable tbody');
    if (pdBody) {
      const byD = new Map();

      for (const s of fs) {
        const d = (s.district || '—').trim() || '—';
        const si = idx?.get(s.sheetRef);
        const farmers = Number(si?.farmers_present ?? s?.metrics?.farmers ?? 0);
        const acres = Number(si?.acres ?? s?.metrics?.wheatAcres ?? 0);
        const wt = (Number.isFinite(farmers) && farmers > 0) ? farmers : 1;

        const m = s.metrics || {};
        const aw = num(m.awarenessPct);
        const de = num(m.definitePct);
        const sc = num(s.score);

        const o = byD.get(d) || { district: d, sessions: 0, farmers: 0, acres: 0, awSum: 0, awDen: 0, deSum: 0, deDen: 0, scSum: 0, scDen: 0 };
        o.sessions += 1;
        if (Number.isFinite(farmers) && farmers > 0) o.farmers += farmers;
        if (Number.isFinite(acres) && acres > 0) o.acres += acres;

        if (Number.isFinite(aw)) { o.awSum += aw * wt; o.awDen += wt; }
        if (Number.isFinite(de)) { o.deSum += de * wt; o.deDen += wt; }
        if (Number.isFinite(sc)) { o.scSum += sc * wt; o.scDen += wt; }

        byD.set(d, o);
      }

      const rows = [...byD.values()].map(o => {
        const aw = avg(o.awSum, o.awDen);
        const de = avg(o.deSum, o.deDen);
        const sc = avg(o.scSum, o.scDen);
        return { ...o, aw, de, sc };
      }).sort((a,b) => {
        const ad = Number.isFinite(a.de) ? a.de : 1e9;
        const bd = Number.isFinite(b.de) ? b.de : 1e9;
        if (ad !== bd) return ad - bd;
        const as = Number.isFinite(a.sc) ? a.sc : 1e9;
        const bs = Number.isFinite(b.sc) ? b.sc : 1e9;
        return as - bs;
      }).slice(0, 8);

      pdBody.innerHTML = rows.map(r => {
        return `<tr>
          <td>${esc(r.district)}</td>
          <td>${fmtInt(r.sessions)}</td>
          <td>${r.farmers ? fmtInt(r.farmers) : '—'}</td>
          <td>${r.acres ? fmt1(r.acres) : '—'}</td>
          <td>${pct(r.aw)}</td>
          <td>${pct(r.de)}</td>
          <td>${Number.isFinite(r.sc) ? fmt1(r.sc) : '—'}</td>
        </tr>`;
      }).join('');
    }

    // ---------- Drivers & barriers ----------
    const listHtml = (mp) => {
      const total = totalFarmers || 0;
      const arr = [...mp.entries()].sort((a,b) => (b[1]||0) - (a[1]||0)).slice(0, 6);
      if (!arr.length) return '<li class="muted">No entries captured.</li>';
      return arr.map(([k, v]) => {
        const n = Number(v) || 0;
        const share = (total > 0) ? ` • ${fmt1(n / total * 100)}%` : '';
        return `<li><b>${esc(k)}</b>: ${fmtInt(n)}${esc(share)}</li>`;
      }).join('');
    };

    const drvEl = $$('#driversList');
    if (drvEl) drvEl.innerHTML = listHtml(drivers);

    const barEl = $$('#barriersList');
    if (barEl) barEl.innerHTML = listHtml(barriers);

    // ---------- Data readiness / status ----------
    setStatus(
      `Loaded ${fmtInt(fs.length)} sessions and ${fmtInt(state.sheetsIndex?.sheets?.length || 0)} sheet summaries.\n` +
      `Reach: ${totalFarmers ? fmtInt(totalFarmers) : '—'} farmers • ${totalAcres ? fmt1(totalAcres) : '—'} acres • Est. Buctril acres: ${totalEstAcres ? fmt1(totalEstAcres) : '—'}.\n` +
      `Referenced media: ${fmtInt(imgRefs)} images • ${fmtInt(vidRefs)} videos.\n` +
      `Conversion coverage: ${denAw ? fmtInt(denAw) : '—'} farmer-weighted records (of ${totalFarmers ? fmtInt(totalFarmers) : '—'} farmers).`,
      'ok'
    );
  }

  function renderSessionsTable() {
    const tbody = $$('#sessionsTable tbody');
    if (!tbody) return;

    const idx = state.sheetsIndex?.sheets ? new Map(state.sheetsIndex.sheets.map(x => [x.sheet, x])) : null;

    const rows = state.filteredSessions.map(s => {
      const sid = esc(s.id);
      const date = esc(s.date || '');
      const sheet = esc(s.sheetRef || '');
      const district = esc(s.district || '');
      const village = esc(s.village || s.spot || '');
      const score = Number.isFinite(Number(s.score)) ? fmt1(s.score) : '—';
      const si = idx?.get(s.sheetRef);
      const f = si ? fmtInt(si.farmers_present) : '—';
      const a = si ? fmt1(si.acres) : '—';

      const hrefSheet = `sheets.html?campaign=${encodeURIComponent(state.campaignId)}&sheet=${encodeURIComponent(s.sheetRef)}`;
      const hrefDetails = `details.html?campaign=${encodeURIComponent(state.campaignId)}&session=${encodeURIComponent(String(s.id))}`;

      return `<tr data-session-id="${sid}">
        <td>${date}</td>
        <td><span class="badge">${sheet}</span></td>
        <td>${district}</td>
        <td>${village}</td>
        <td>${f}</td>
        <td>${a}</td>
        <td>${score}</td>
        <td style="white-space:nowrap">
          <a class="btn btnSmall" href="${hrefSheet}">Sheet</a>
          <a class="btn btnSmall btnGhost" href="${hrefDetails}">Details</a>
          <button class="btn btnSmall btnGhost" data-action="preview">Preview</button>
        </td>
      </tr>`;
    });

    tbody.innerHTML = rows.join('');

    // Row click: preview
    tbody.onclick = (ev) => {
      const tr = ev.target.closest('tr[data-session-id]');
      if (!tr) return;

      // If clicking a link, allow navigation
      if (ev.target.closest('a')) return;

      // Only preview on button or row click
      const sid = Number(tr.dataset.sessionId);
      openDrawer(sid);
    };

    // Button preview
    tbody.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-action="preview"]');
      if (!btn) return;
      const tr = ev.target.closest('tr[data-session-id]');
      if (!tr) return;
      ev.preventDefault();
      ev.stopPropagation();
      openDrawer(Number(tr.dataset.sessionId));
    });
  }

  function firstMediaImage(s) {
    const imgs = (s.media && Array.isArray(s.media.images)) ? s.media.images : [];
    if (imgs.length) return imgs[0];
    return '';
  }

  // Return the first video reference for a session if available.
  function firstMediaVideo(s) {
    const vids = (s.media && Array.isArray(s.media.videos)) ? s.media.videos : [];
    if (vids.length) return vids[0];
    return '';
  }

  function allMediaItems(s) {
    const imgs = (s.media && Array.isArray(s.media.images)) ? s.media.images : [];
    const vids = (s.media && Array.isArray(s.media.videos)) ? s.media.videos : [];
    return [
      ...imgs.map(p => ({ type: 'image', path: p })),
      ...vids.map(p => ({ type: 'video', path: p })),
    ];
  }

  function renderMedia() {
    const grid = $$('#mediaGrid');
    if (!grid) return;

    const cards = state.filteredSessions.map(s => {
      const sid = esc(s.id);
      const sheet = esc(s.sheetRef || '');
      const district = esc(s.district || '');
      const village = esc(s.village || s.spot || '');
      // Determine thumbnail: prefer first video if available; otherwise first image
      const vidPath = firstMediaVideo(s);
      const videoSrc = vidPath ? normalizeMediaPath(vidPath) : '';
      const img = firstMediaImage(s);
      const title = `${sheet} • ${district} • ${village}`;
      const hrefDetails = `details.html?campaign=${encodeURIComponent(state.campaignId)}&session=${encodeURIComponent(String(s.id))}`;
      // Build thumb markup
      let thumb;
      if (vidPath) {
        // Show auto-playing muted preview
        thumb = `<video autoplay loop muted playsinline src="${esc(videoSrc)}"></video>`;
      } else {
        thumb = `<img data-media-thumb="1" alt="${esc(title)}" />`;
      }
      return `<div class="mediaCard" data-session-id="${sid}">
        <div class="mediaThumb">
          ${thumb}
        </div>
        <div class="mediaMeta">
          <div class="mediaTitle">${esc(title)}</div>
          <div class="mediaActions">
            <a class="btn btnSmall" href="sheets.html?campaign=${encodeURIComponent(state.campaignId)}&sheet=${encodeURIComponent(s.sheetRef)}">Sheet</a>
            <a class="btn btnSmall btnGhost" href="${hrefDetails}">Details</a>
            <button class="btn btnSmall btnGhost" data-action="open">Open</button>
          </div>
        </div>
        <div class="hidden" data-thumb-path="${esc(img)}"></div>
      </div>`;
    });

    grid.innerHTML = cards.join('');

    // attach thumbs
    $$$('[data-media-thumb="1"]', grid).forEach(img => {
      const card = img.closest('.mediaCard');
      const p = card?.querySelector('[data-thumb-path]')?.getAttribute('data-thumb-path') || '';
      attachSmartImage(img, p || 'assets/placeholder.svg');
    });

    grid.onclick = (ev) => {
      const card = ev.target.closest('.mediaCard[data-session-id]');
      if (!card) return;
      const sid = Number(card.dataset.sessionId);
      if (ev.target.closest('a')) return;

      // Open lightbox with all items
      openLightbox(sid);
    };
  }

  function renderAll() {
    renderSummary();
    renderSessionsTable();
    renderMedia();
    updateMapData(); // markers reflect filter
  }

  // ---------- Drawer ----------
  function closeDrawer() {
    const ov = $$('#drawerOverlay');
    const dr = $$('#sessionDrawer');
    if (ov) ov.classList.add('hidden');
    if (dr) dr.classList.add('hidden');
    if (ov) ov.setAttribute('aria-hidden', 'true');
    if (dr) dr.setAttribute('aria-hidden', 'true');
  }

  async function openDrawer(sessionId) {
    const s = state.sessionsById.get(Number(sessionId));
    if (!s) return;

    const ov = $$('#drawerOverlay');
    const dr = $$('#sessionDrawer');
    if (ov) ov.classList.remove('hidden');
    if (dr) dr.classList.remove('hidden');
    if (ov) ov.setAttribute('aria-hidden', 'false');
    if (dr) dr.setAttribute('aria-hidden', 'false');

    $$('#drawerTitle').textContent = `Session ${s.id} • ${s.sheetRef || ''}`;
    $$('#drawerSub').textContent = `${s.date || ''} • ${s.district || ''} • ${s.village || s.spot || ''}`;

    // KPIs from sheets index if possible
    const si = state.sheetsIndex?.sheets?.find(x => x.sheet === s.sheetRef);
    $$('#dFarmers').textContent = si ? fmtInt(si.farmers_present) : '—';
    $$('#dAcres').textContent = si ? fmt1(si.acres) : '—';
    $$('#dScore').textContent = Number.isFinite(Number(s.score)) ? fmt1(s.score) : '—';

    const meta = [
      s.city ? `City: ${esc(s.city)}` : '',
      s.district ? `District: ${esc(s.district)}` : '',
      s.spot ? `Spot: ${esc(s.spot)}` : '',
      s.dealer?.name ? `Dealer: ${esc(s.dealer.name)}` : '',
      s.salesRep?.name ? `Sales: ${esc(s.salesRep.name)}` : '',
      s.host?.name ? `Host: ${esc(s.host.name)}` : '',
    ].filter(Boolean).join(' • ');
    $$('#dMeta').innerHTML = meta || '<span class="muted">—</span>';

    // Outcomes (session-level conversion / understanding)
    const outEl = $$('#dOutcomes');
    const actEl = $$('#dActions');

    const m = s.metrics || {};
    const aw = num(m.awarenessPct);
    const ul = num(m.usedLastYearPct);
    const de = num(m.definitePct);
    const mb = num(m.maybePct);
    const ni = num(m.notInterestedPct);
    const un = num(m.avgUnderstanding);

    const fmtPct = (v) => Number.isFinite(v) ? (fmt1(v) + '%') : '—';
    const fmtUnd = (v) => Number.isFinite(v) ? (fmt1(v) + ' / 3') : '—';

    if (outEl) {
      const topUse = (s.topReasonUse || '').trim();
      const topNot = (s.topReasonNotUse || '').trim();
      outEl.innerHTML = `
        <div class="muted">Awareness: <b>${esc(fmtPct(aw))}</b> • Definite: <b>${esc(fmtPct(de))}</b> • Used last year: <b>${esc(fmtPct(ul))}</b></div>
        <div class="muted">Maybe: <b>${esc(fmtPct(mb))}</b> • Not interested: <b>${esc(fmtPct(ni))}</b> • Understanding: <b>${esc(fmtUnd(un))}</b></div>
        <div class="smallMuted">${topUse ? ('Top driver: ' + esc(topUse)) : ''}${topUse && topNot ? ' • ' : ''}${topNot ? ('Top barrier: ' + esc(topNot)) : ''}</div>
      `.trim();
    }

    // Recommended actions (lightweight heuristic rules)
    const acts = [];
    const farmersNow = Number(si?.farmers_present ?? m.farmers ?? 0);
    const uPct = Number.isFinite(un) ? (un / 3 * 100) : NaN;

    if (Number.isFinite(aw) && aw < 60) acts.push('Increase awareness: start with weed-pressure framing + product positioning; add a pre-activation dealer touchpoint and 1–2 local influencer farmers.');
    if (Number.isFinite(de) && de < 70) acts.push('Improve conversion: strengthen objection-handling talk track; include cost-per-acre ROI and a demo-plot story (before/after weeds).');
    if (Number.isFinite(uPct) && uPct < 75) acts.push('Improve message clarity: simplify the 4 key messages, use visuals, repeat key points, and do a quick comprehension check mid-session.');
    if (Number.isFinite(farmersNow) && farmersNow > 0 && farmersNow < 20) acts.push('Improve turnout: revise venue/time, confirm mobilization plan, and coordinate with nearest dealer for invites and reminders.');

    const rn = s.reasonsNotUse && typeof s.reasonsNotUse === 'object' ? s.reasonsNotUse : {};
    const price = Number(rn['Price Too High'] || 0);
    const avail = Number(rn['Not Available'] || 0);
    const burn = Number(rn['Fear of Burn'] || 0);
    if (Number.isFinite(price) && price > 0) acts.push('Address price objections: lead with value narrative (weed control reliability, yield protection), and convert price to per-acre cost.');
    if (Number.isFinite(avail) && avail > 0) acts.push('Fix availability risk: confirm stock at nearest dealer and share a clear purchase path at the end of the session.');
    if (Number.isFinite(burn) && burn > 0) acts.push('Reduce burn concerns: emphasize correct dose + timing and show safe-use guidance with examples.');

    if (actEl) {
      actEl.innerHTML = acts.length ? acts.map(x => `<li>${esc(x)}</li>`).join('') : '<li class="muted">No critical flags for this session based on thresholds.</li>';
    }

    // Links
    const sheetUrl = `sheets.html?campaign=${encodeURIComponent(state.campaignId)}&sheet=${encodeURIComponent(s.sheetRef)}`;
    const detailsUrl = `details.html?campaign=${encodeURIComponent(state.campaignId)}&session=${encodeURIComponent(String(s.id))}`;
    $$('#dOpenSheet').setAttribute('href', sheetUrl);
    $$('#dOpenDetails').setAttribute('href', detailsUrl);

    // Google Maps
    const lat = Number(s.geo?.lat);
    const lng = Number(s.geo?.lng);
    const g = (Number.isFinite(lat) && Number.isFinite(lng)) ? `https://www.google.com/maps?q=${lat},${lng}` : '#';
    $$('#dOpenMaps').setAttribute('href', g);

    // Sheet summary fetch
    const sumEl = $$('#dSheetSummary');
    if (sumEl) sumEl.textContent = 'Loading…';
    try {
      const sheet = await fetchJson(`data/${state.campaignId}/sheets/${s.sheetRef}.json`, 'sheet');
      const fb = sheet.feedback || {};
      const farmers = Array.isArray(sheet.farmers) ? sheet.farmers : [];
      const top = [...farmers].sort((a,b) => Number(b.acres||0)-Number(a.acres||0)).slice(0,5);

      const topHtml = top.length
        ? `<ul>${top.map(x => `<li>${esc(x.name || '')} — ${esc(String(x.acres ?? ''))} acres</li>`).join('')}</ul>`
        : '<div class="muted">No farmer rows found in sheet.</div>';

      const hostComment = fb.host_comment ? `<div><b>Host comment:</b> ${esc(fb.host_comment)}</div>` : '';
      const mgr = fb.manager_note ? `<div><b>Manager note:</b> ${esc(fb.manager_note)}</div>` : '';
      const sales = fb.sales_feedback ? `<div><b>Sales feedback:</b> ${esc(fb.sales_feedback)}</div>` : '';

      sumEl.innerHTML = `
        <div class="muted">Sheet: <b>${esc(sheet.meta?.sheet || s.sheetRef)}</b> • Date: <b>${esc(sheet.meta?.date || s.date || '')}</b></div>
        ${hostComment}
        ${mgr}
        ${sales}
        <div class="divider"></div>
        <div><b>Top farmers (by acres)</b></div>
        ${topHtml}
      `;
    } catch (e) {
      if (sumEl) sumEl.innerHTML = `<div class="muted">Could not load sheet summary.</div><div class="smallMuted">${esc(e.message)}</div>`;
    }

    // Media
    const mediaEl = $$('#dMedia');
    if (mediaEl) {
      mediaEl.innerHTML = '';
      const items = allMediaItems(s).slice(0, 8);
      for (const it of items) {
        if (it.type === 'image') {
          const img = document.createElement('img');
          img.className = 'thumb';
          img.alt = s.sheetRef || 'image';
          img.loading = 'lazy';
          mediaEl.appendChild(img);
          attachSmartImage(img, it.path);
          img.onclick = () => openLightbox(Number(s.id));
        } else {
          const wrap = document.createElement('div');
          wrap.className = 'thumbVideo';
          const v = document.createElement('video');
          v.className = 'thumb';
          v.muted = true;
          v.playsInline = true;
          v.setAttribute('playsinline','');
          wrap.appendChild(v);
          mediaEl.appendChild(wrap);
          attachSmartVideo(v, it.path);
          wrap.onclick = () => openLightbox(Number(s.id));
        }
      }
      if (!items.length) {
        mediaEl.innerHTML = '<div class="muted">No media listed for this session.</div>';
      }
    }
  }

  function bindDrawer() {
    const closeBtn = $$('#drawerClose');
    const ov = $$('#drawerOverlay');
    closeBtn?.addEventListener('click', closeDrawer);
    ov?.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        closeDrawer();
        closeLightbox();
      }
    });
  }

  // ---------- Lightbox ----------
  function closeLightbox() {
    const lb = $$('#lightbox');
    if (lb) lb.classList.remove('open');
    const body = $$('#lbBody');
    if (body) body.innerHTML = '';
  }

  function bindLightbox() {
    $$('#lbClose')?.addEventListener('click', closeLightbox);
    $$('#lightbox')?.addEventListener('click', (ev) => {
      if (ev.target && ev.target.id === 'lightbox') closeLightbox();
    });
  }

  async function openLightbox(sessionId) {
    const s = state.sessionsById.get(Number(sessionId));
    if (!s) return;
    const lb = $$('#lightbox');
    const body = $$('#lbBody');
    if (!lb || !body) return;

    $$('#lbTitle').textContent = `Session ${s.id} • ${s.sheetRef || ''}`;

    lb.classList.add('open');
    body.innerHTML = '';

    const items = allMediaItems(s);
    if (!items.length) {
      body.innerHTML = '<div class="muted">No media listed for this session.</div>';
      return;
    }

    // Show first item large; rest as thumbnails
    const main = items[0];
    if (main.type === 'image') {
      const img = document.createElement('img');
      img.className = 'lightboxMedia';
      img.alt = 'image';
      body.appendChild(img);
      attachSmartImage(img, main.path);
    } else {
      const v = document.createElement('video');
      v.className = 'lightboxMedia';
      v.controls = true;
      v.playsInline = true;
      v.setAttribute('playsinline','');
      body.appendChild(v);
      const chosen = await resolveFirstExisting(main.path);
      v.src = chosen ? url(chosen) : url('assets/placeholder-video.mp4');
    }

    if (items.length > 1) {
      const row = document.createElement('div');
      row.className = 'mediaRow';
      for (const it of items.slice(1, 12)) {
        if (it.type === 'image') {
          const t = document.createElement('img');
          t.className = 'thumb';
          t.alt = 'thumb';
          t.loading = 'lazy';
          row.appendChild(t);
          attachSmartImage(t, it.path);
          t.onclick = () => {
            body.innerHTML = '';
            lb.classList.add('open');
            openLightbox(sessionId); // simplest refresh
          };
        } else {
          const tv = document.createElement('video');
          tv.className = 'thumb';
          tv.muted = true;
          tv.playsInline = true;
          tv.setAttribute('playsinline','');
          row.appendChild(tv);
          attachSmartVideo(tv, it.path);
          tv.onclick = () => {
            body.innerHTML = '';
            lb.classList.add('open');
            openLightbox(sessionId);
          };
        }
      }
      body.appendChild(row);
    }
  }

  // ---------- Map ----------
  async function ensureMapReady() {
    const el = $$('#leafletMap');
    if (!el) return;

    // Lazily load Leaflet when the Map tab is opened.
    setMapStatus('Loading map…', false);
    const ok = await ensureLeafletReady({ timeoutMs: 9000 });
    if (!ok) {
      setMapStatus('Map library blocked', false);
      $$('#mapFallback')?.classList.remove('hidden');
      return;
    }

    if (state.map) {
      state.map.invalidateSize();
      updateMapData();
      return;
    }

    try {
      const map = window.L.map(el, { zoomControl: true });
      state.map = map;
      state.markerLayer = window.L.layerGroup().addTo(map);

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      updateMapData();
      setMapStatus('Ready', true);
      setTimeout(() => map.invalidateSize(), 250);
    } catch (e) {
      setMapStatus('Failed', false);
      $$('#mapFallback')?.classList.remove('hidden');
    }
  }

  function updateMapData() {
    if (!state.map || !state.markerLayer || !window.L) return;

    state.markerLayer.clearLayers();
    state.markersBySessionId.clear();

    const pts = [];
    for (const s of state.filteredSessions) {
      const lat = Number(s.geo?.lat);
      const lng = Number(s.geo?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      pts.push([lat, lng]);

      const sheetUrl = `sheets.html?campaign=${encodeURIComponent(state.campaignId)}&sheet=${encodeURIComponent(s.sheetRef)}`;
      const detailsUrl = `details.html?campaign=${encodeURIComponent(state.campaignId)}&session=${encodeURIComponent(String(s.id))}`;
      const g = `https://www.google.com/maps?q=${lat},${lng}`;

      const popup = `
        <div style="min-width:220px">
          <div><b>Session ${esc(s.id)}</b> • <span class="badge">${esc(s.sheetRef || '')}</span></div>
          <div class="smallMuted">${esc(s.date || '')} • ${esc(s.district || '')}</div>
          <div class="smallMuted">${esc(s.village || s.spot || '')}</div>
          <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap">
            <a class="btn btnSmall" href="${sheetUrl}">Open sheet</a>
            <a class="btn btnSmall btnGhost" href="${detailsUrl}">Details</a>
            <a class="btn btnSmall btnGhost" href="${g}" target="_blank" rel="noopener">Maps</a>
          </div>
          <div style="margin-top:8px">
            <button class="btn btnSmall btnGhost" data-preview="${esc(s.id)}">Preview</button>
          </div>
        </div>`;

      const marker = window.L.circleMarker([lat, lng], {
        radius: 7,
        weight: 2,
        color: '#4c6fff',
        fillColor: '#4c6fff',
        fillOpacity: 0.35
      });
      marker.bindPopup(popup);
      marker.addTo(state.markerLayer);
      state.markersBySessionId.set(Number(s.id), marker);
    }

    if (pts.length) {
      const bounds = window.L.latLngBounds(pts);
      state.map.fitBounds(bounds.pad(0.15));
    }

    // One-time delegated click handler inside Leaflet popup for Preview button
    state.map.off('popupopen');
    state.map.on('popupopen', (e) => {
      const node = e.popup.getElement();
      if (!node) return;
      const btn = node.querySelector('button[data-preview]');
      if (!btn) return;
      btn.addEventListener('click', () => {
        const sid = Number(btn.getAttribute('data-preview'));
        openDrawer(sid);
      });
    });
  }

  // ---------- Feedback ----------
  function bindFeedback() {
    const key = 'harvest_horizons_feedback';
    const txt = $$('#fbText');
    const msg = $$('#fbMsg');

    try {
      const v = localStorage.getItem(key);
      if (txt && v) txt.value = v;
    } catch (_e) { /* ignore */ }

    $$('#fbSave')?.addEventListener('click', () => {
      try {
        localStorage.setItem(key, txt?.value || '');
        if (msg) msg.textContent = 'Saved.';
      } catch (_e) {
        if (msg) msg.textContent = 'Could not save in this browser.';
      }
    });

    $$('#fbClear')?.addEventListener('click', () => {
      if (txt) txt.value = '';
      try { localStorage.removeItem(key); } catch (_e) {}
      if (msg) msg.textContent = 'Cleared.';
    });
  }

  // ---------- Campaign selection ----------
  function renderCampaignSelect() {
    const sel = $$('#campaignSelect');
    if (!sel) return;

    sel.innerHTML = state.campaigns.map(c => {
      const id = esc(c.id);
      const name = esc(c.name || c.id);
      return `<option value="${id}">${name}</option>`;
    }).join('');

    sel.value = state.campaignId || (state.campaigns[0]?.id ?? '');
    sel.onchange = () => {
      const id = sel.value;
      window.location.href = `index.html?campaign=${encodeURIComponent(id)}#summary`;
    };
  }

  async function loadCampaign(id) {
    state.campaignId = id;
    state.campaign = state.campaigns.find(c => c.id === id) || state.campaigns[0] || null;
    if (!state.campaign) throw new Error('No campaigns configured.');

    setStatus('Loading sessions…');

    const sessionsPath = state.campaign.sessionsUrl || `data/${id}/sessions.json`;
    const mediaPath = state.campaign.mediaUrl || `data/${id}/media.json`;
    const sheetsIndexPath = state.campaign.sheetsIndexUrl || `data/${id}/sheets_index.json`;

    // Sessions
    const sj = await fetchJson(sessionsPath, 'sessions');
    const sessions = Array.isArray(sj.sessions) ? sj.sessions : Array.isArray(sj) ? sj : [];
    state.sessions = sessions;
    state.sessionsById = new Map(sessions.map(s => [Number(s.id), s]));

    // Optional sheets index
    try {
      state.sheetsIndex = await fetchJson(sheetsIndexPath, 'sheets index');
    } catch (_e) {
      state.sheetsIndex = null;
    }

    // Optional media config
    try {
      state.mediaCfg = await fetchJson(mediaPath, 'media config');
    } catch (_e) {
      state.mediaCfg = null;
    }

    // Campaign date range
    // Prefer explicit campaign start/end if provided; otherwise derive from sessions.
    const dates = sessions.map(s => parseDateSafe(s.date)).filter(Boolean);
    if (!dates.length) throw new Error('No session dates found.');
    dates.sort((a,b) => a - b);

    const cfgStart = parseDateSafe(state.campaign.startDate);
    const cfgEnd = parseDateSafe(state.campaign.endDate);

    state.dateMin = cfgStart || dates[0];
    state.dateMax = cfgEnd || dates[dates.length - 1];

    // If config dates are outside actual data, clamp range to data to avoid empty view by default.
    if (state.dateMin < dates[0]) state.dateMin = dates[0];
    if (state.dateMax > dates[dates.length - 1]) state.dateMax = dates[dates.length - 1];

    state.dateFrom = state.dateMin;
    state.dateTo = state.dateMax;

    // Setup date inputs min/max and defaults
    const fromEl = $$('#dateFrom');
    const toEl = $$('#dateTo');
    if (fromEl && toEl) {
      fromEl.min = formatDateInput(state.dateMin);
      fromEl.max = formatDateInput(state.dateMax);
      toEl.min = formatDateInput(state.dateMin);
      toEl.max = formatDateInput(state.dateMax);
      fromEl.value = formatDateInput(state.dateMin);
      toEl.value = formatDateInput(state.dateMax);
    }
    setRangeHint();

    filterSessions();
    renderAll();
    setStatus('Loaded.', 'ok');
  }

  // ---------- Events ----------
  function bindTopControls() {
    $$('#applyBtn')?.addEventListener('click', applyDateInputs);
    $$('#resetBtn')?.addEventListener('click', resetDateInputs);
    $$('#exportBtn')?.addEventListener('click', exportCsv);

    // Apply on Enter in date inputs
    $$('#dateFrom')?.addEventListener('change', applyDateInputs);
    $$('#dateTo')?.addEventListener('change', applyDateInputs);

    // Apply automatically when name or city filters change
    $$('#nameFilter')?.addEventListener('input', applyDateInputs);
    $$('#cityFilter')?.addEventListener('input', applyDateInputs);
  }

  function exportCsv() {
    const rows = [];
    rows.push(['id','sheetRef','date','district','village','score'].join(','));
    for (const s of state.filteredSessions) {
      const row = [
        s.id,
        s.sheetRef,
        s.date,
        (s.district || '').replaceAll(',', ' '),
        (s.village || s.spot || '').replaceAll(',', ' '),
        s.score ?? ''
      ];
      rows.push(row.map(x => String(x ?? '').replaceAll('\n',' ').replaceAll('\r',' ')).join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${state.campaignId || 'campaign'}_sessions.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function bindTabEvents() {
    window.addEventListener('hashchange', syncTabFromHash);
    document.addEventListener('tabchange', (e) => {
      const tab = e.detail?.tab;
      if (tab === 'map') {
        // Give Leaflet time to render after display
        setTimeout(ensureMapReady, 50);
        setTimeout(() => state.map?.invalidateSize(), 200);
      }
    });
  }

  // ---------- Boot ----------
  async function boot() {
    try {
      bindDrawer();
      bindLightbox();
      bindFeedback();
      bindTopControls();
      bindTabEvents();

      await loadCampaignRegistry();

      const req = qs();
      const id = req.get('campaign') || state.campaigns[0]?.id;
      renderCampaignSelect();

      await loadCampaign(id);

      // Initial tab
      syncTabFromHash();

      // If landing directly on #map, init map
      if (activeTabFromHash() === 'map') {
        setTimeout(ensureMapReady, 50);
      }

      // Close drawer if overlay state inconsistent
      closeDrawer();

      // Wire drawer overlay state
      $$('#drawerOverlay')?.classList.add('hidden');
      $$('#sessionDrawer')?.classList.add('hidden');

      // Close buttons for lightbox
      $$('#lbClose')?.addEventListener('click', closeLightbox);

      // Set map status
      setMapStatus('Ready when opened', true);
    } catch (e) {
      console.error(e);
      setStatus(e.message || 'Failed to load.', 'bad');
    }
  }

  boot();
})();
