(() => {
  'use strict';
  // Helper to fetch JSON files with retry and timeout support.
  // This version improves resilience to network issues by retrying failed requests
  // a limited number of times and aborting long-running requests. If all attempts
  // fail, it will call setStatus() with an error message and rethrow the error.

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

    // Region filter (REG). This corresponds to the RGN codes (e.g. SKR, RYK)
    // derived from the Initial sheet mapping of territories/districts to regions.
    regionFilter: '',

    // Additional filters for district and score range. These are optional
    // inputs that refine the sessions list based on geography or
    // performance. When null/empty they do not constrain results.
    districtFilter: '',
    scoreMin: null,
    scoreMax: null,

    // Media tab controls
    mediaType: 'all',
    mediaSearch: '',
    mediaSort: 'newest',
    mediaLimit: 24,
    _mediaBound: false,
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
  async function fetchJson(path, why = path, retries = 3, timeout = 8000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const u = url(path);
        const r = await fetch(u, { cache: 'no-store', signal: controller.signal });
        clearTimeout(timer);
        if (!r.ok) {
          throw new Error(`${why} failed (${r.status})`);
        }
        return await r.json();
      } catch (e) {
        clearTimeout(timer);
        if (attempt === retries) {
          console.error(e);
          setStatus(`Error loading ${why}: ${e.message}`, 'bad');
          throw e;
        }
        // Exponential backoff: wait longer on subsequent attempts
        await new Promise(res => setTimeout(res, 500 * attempt));
      }
    }
    // Should never reach here
    throw new Error(`Failed to fetch ${why}`);
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

    // Capture district, region, and score range inputs. If the user leaves
    // fields blank the values remain empty/null, indicating no filter.
    const districtEl = $$('#districtFilter');
    state.districtFilter = districtEl ? String(districtEl.value || '').trim() : '';

    // Region filter: match sessions by region code (e.g. SKR, RYK). If the input is blank
    // the filter is not applied. The input element is optional because not all
    // dashboards will define a region filter. See index.html for the #regionFilter input.
    const regionEl = $$('#regionFilter');
    state.regionFilter = regionEl ? String(regionEl.value || '').trim() : '';
    const minEl = $$('#scoreMin');
    const maxEl = $$('#scoreMax');
    const minVal = minEl && minEl.value !== '' ? parseFloat(minEl.value) : null;
    const maxVal = maxEl && maxEl.value !== '' ? parseFloat(maxEl.value) : null;
    state.scoreMin = Number.isFinite(minVal) ? minVal : null;
    state.scoreMax = Number.isFinite(maxVal) ? maxVal : null;

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

    // Reset district and score filters
    const districtEl = $$('#districtFilter');
    const minEl = $$('#scoreMin');
    const maxEl = $$('#scoreMax');
    if (districtEl) districtEl.value = '';
    if (minEl) minEl.value = '';
    if (maxEl) maxEl.value = '';
    state.districtFilter = '';
    state.scoreMin = null;
    state.scoreMax = null;

    // Clear region filter
    const regionEl = $$('#regionFilter');
    if (regionEl) regionEl.value = '';
    state.regionFilter = '';

    applyDateInputs();
  }

  function filterSessions() {
    const a = state.dateFrom;
    const b = state.dateTo;
    state.filteredSessions = state.sessions.filter(s => {
      const d = parseDateSafe(s.date);
      // If the date cannot be parsed (e.g., missing or not in YYYY-MM-DD format),
      // treat the session as always within range. This allows sessions with
      // malformed dates to appear in the dashboard rather than being silently
      // excluded. Only enforce the date filter when a valid Date is available.
      if (d) {
        if (d < a || d > b) return false;
      }
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

      // Region filter
      if (state.regionFilter) {
        const reg = String(s.region || '').toLowerCase();
        if (!reg.includes(state.regionFilter.toLowerCase())) return false;
      }

      // District filter
      if (state.districtFilter) {
        const district = String(s.district || '').toLowerCase();
        if (!district.includes(state.districtFilter.toLowerCase())) return false;
      }

      // Score range filter
      if (Number.isFinite(state.scoreMin) || Number.isFinite(state.scoreMax)) {
        const sc = Number(s.score);
        if (!Number.isFinite(sc)) return false;
        if (Number.isFinite(state.scoreMin) && sc < state.scoreMin) return false;
        if (Number.isFinite(state.scoreMax) && sc > state.scoreMax) return false;
      }
      return true;
    });
  }

  // ---------- Render ----------
  function renderSummary() {
    const fs = Array.isArray(state.filteredSessions) ? state.filteredSessions : [];

    // Update the last updated timestamp. Determine the most recent session
    // date from the filtered set and display it under the KPI tiles. When
    // there are no sessions loaded, clear the timestamp.
    (function updateLastUpdated(){
      const lastEl = $$('#lastUpdated');
      if (!lastEl) return;
      let latest = null;
      for (const s of fs) {
        const d = parseDateSafe(s.date);
        if (d && (!latest || d > latest)) latest = d;
      }
      if (latest) {
        // Use ISO format (YYYY-MM-DD) for clarity; could be replaced with
        // locale-specific formatting if needed.
        const iso = formatDateInput(latest);
        lastEl.textContent = `Data as of ${iso}`;
      } else {
        lastEl.textContent = '';
      }
    })();
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

    // ---------- Attendance donut chart ----------
    // Draw a doughnut chart representing the distribution of farmers across
    // sessions. We only display the chart if the canvas element is present
    // and Chart.js has been loaded. To avoid overcrowding the chart with
    // dozens of tiny slices, we show the top 8 sessions by farmer count
    // individually and aggregate the remainder into an "Other" slice.
    const attCanvas = $$('#attendanceDonut');
    if (attCanvas && typeof Chart !== 'undefined' && Array.isArray(fs)) {
      // Destroy any existing attendance chart to avoid duplicating charts on
      // re-render (e.g. after changing filters).
      if (window.attendanceChart && typeof window.attendanceChart.destroy === 'function') {
        window.attendanceChart.destroy();
      }
      // Collect farmers per session and sort descending.
      const sessionsByFarmers = fs
        .map(s => {
          const count = Number(s.metrics?.farmers || 0);
          // Compose a human-friendly label for the donut legend. Prefer the
          // district name; fall back to village/spot or a generic label if
          // unavailable. Include the session id for uniqueness.
          let loc = (s.district || '').trim();
          if (!loc) loc = (s.village || s.spot || '').trim();
          if (!loc) loc = 'Session';
          const label = `${loc} (S${s.id})`;
          return { id: s.id, label, farmers: count };
        })
        .filter(x => x.farmers > 0)
        .sort((a, b) => b.farmers - a.farmers);
      // Choose up to eight individual slices. Aggregate the rest.
      const maxSlices = 8;
      const labels = [];
      const data = [];
      const colors = [
        '#4c6fff','#22c55e','#f59e0b','#8e44ad','#f97316','#3b82f6','#eab308','#10b981','#a855f7','#ef4444'
      ];
      let otherTotal = 0;
      sessionsByFarmers.forEach((item, idx) => {
        if (idx < maxSlices) {
          labels.push(item.label);
          data.push(item.farmers);
        } else {
          otherTotal += item.farmers;
        }
      });
      if (otherTotal > 0) {
        labels.push('Other');
        data.push(otherTotal);
      }
      // Assign colors to slices; repeat palette if necessary.
      const bgColors = data.map((_, i) => colors[i % colors.length]);
      const ctx = attCanvas.getContext('2d');
      window.attendanceChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{ data: data, backgroundColor: bgColors, borderColor: '#ffffff10', borderWidth: 1 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                usePointStyle: true,
                padding: 12,
                boxWidth: 10
              }
            },
            tooltip: {
              callbacks: {
                label: function(ctx) {
                  const lab = ctx.label || '';
                  const val = ctx.dataset.data[ctx.dataIndex];
                  const total = ctx.dataset.data.reduce((acc, v) => acc + v, 0);
                  const pct = total ? ((val / total) * 100).toFixed(1) : 0;
                  return `${lab}: ${val} farmers (${pct}%)`;
                }
              }
            }
          },
          cutout: '50%'
        }
      });
    }

    // ---------- Decision breakdown pie chart ----------
    const decisionCanvas = $$('#decisionPie');
    if (decisionCanvas && typeof Chart !== 'undefined' && Array.isArray(fs)) {
      if (window.decisionChart && typeof window.decisionChart.destroy === 'function') {
        window.decisionChart.destroy();
      }
      let sumDef = 0, sumMaybe = 0, sumNot = 0;
      for (const s of fs) {
        // Farmers present for weighting; prefer sheet index when available.
        const si = idx?.get(s.sheetRef);
        const farmers = Number(si?.farmers_present ?? s?.metrics?.farmers ?? 0);
        const m = s.metrics || {};
        const def = num(m.definitePct);
        const mb = num(m.maybePct);
        const ni = num(m.notInterestedPct);
        if (Number.isFinite(farmers) && farmers > 0) {
          if (Number.isFinite(def)) sumDef += farmers * def / 100;
          if (Number.isFinite(mb)) sumMaybe += farmers * mb / 100;
          if (Number.isFinite(ni)) sumNot += farmers * ni / 100;
        }
      }
      const labels = ['Definite','Maybe','Not interested'];
      const data = [sumDef, sumMaybe, sumNot];
      const bgColors = ['#89d329','#d9a420','#dc2626'];
      const ctxPie = decisionCanvas.getContext('2d');
      window.decisionChart = new Chart(ctxPie, {
        type: 'pie',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: bgColors }] },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'right',
              labels: { usePointStyle: true, padding: 12, boxWidth: 10 }
            },
            tooltip: {
              callbacks: {
                label: function(ctx) {
                  const lab = ctx.label || '';
                  const val = ctx.dataset.data[ctx.dataIndex];
                  const total = ctx.dataset.data.reduce((acc, v) => acc + v, 0);
                  const pct = total ? ((val / total) * 100).toFixed(1) : 0;
                  return `${lab}: ${Math.round(val)} farmers (${pct}%)`;
                }
              }
            }
          }
        }
      });
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

      // Compute aggregated rows per district and derive recommended actions. The
      // recommendations are based on weighted definite intent (de) thresholds.
      let agg = [...byD.values()].map(o => {
        const aw = avg(o.awSum, o.awDen);
        const de = avg(o.deSum, o.deDen);
        const sc = avg(o.scSum, o.scDen);
        return { ...o, aw, de, sc };
      });
      // Sort by lowest definite intent then lowest score
      agg.sort((a,b) => {
        const ad = Number.isFinite(a.de) ? a.de : 1e9;
        const bd = Number.isFinite(b.de) ? b.de : 1e9;
        if (ad !== bd) return ad - bd;
        const as = Number.isFinite(a.sc) ? a.sc : 1e9;
        const bs = Number.isFinite(b.sc) ? b.sc : 1e9;
        return as - bs;
      });
      // Limit to top 8 districts
      const rows = agg.slice(0, 8);

      // Determine and display summary takeaways from the top two districts
      const takeawayEl = $$('#summaryTakeaways');
      if (takeawayEl) {
        if (rows.length) {
          const topNames = rows.slice(0, 2).map(r => r.district).filter(Boolean);
          takeawayEl.textContent = topNames.length ? `Focus next on ${topNames.join(' and ')}` : '';
        } else {
          takeawayEl.textContent = '';
        }
      }

      // Render table rows with recommended actions and row styling
      pdBody.innerHTML = rows.map(r => {
        let action = '—';
        let cls = '';
        const deVal = Number(r.de);
        const scVal = Number(r.sc);
        if (Number.isFinite(deVal)) {
          if (deVal < 80) {
            action = 'Arrange field demo';
            cls = 'priority-high';
          } else if (deVal < 90) {
            action = 'Dealer visit';
            cls = 'priority-medium';
          } else {
            action = 'Follow‑up call';
            cls = 'priority-low';
          }
        }
        return `<tr${cls ? ` class="${cls}"` : ''}>
          <td>${esc(r.district)}</td>
          <td>${fmtInt(r.sessions)}</td>
          <td>${r.farmers ? fmtInt(r.farmers) : '—'}</td>
          <td>${r.acres ? fmt1(r.acres) : '—'}</td>
          <td>${pct(r.aw)}</td>
          <td>${pct(r.de)}</td>
          <td>${Number.isFinite(r.sc) ? fmt1(r.sc) : '—'}</td>
          <td>${esc(action)}</td>
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

    // Render the top drivers and barriers as horizontal bar charts instead of plain lists.
    // Each bar's length reflects the share of farmers citing that reason. When no data is
    // available, a muted placeholder is shown instead. The charts are drawn into
    // #driversChart and #barriersChart containers.
    const renderBarChart = (mp, containerId) => {
      const container = document.querySelector(containerId);
      if (!container) return;
      const total = totalFarmers || 0;
      // Sort entries descending by count and take up to 6 entries.
      const arr = [...mp.entries()].sort((a, b) => (Number(b[1] || 0) - Number(a[1] || 0))).slice(0, 6);
      if (!arr.length) {
        container.innerHTML = '<div class="muted">No entries captured.</div>';
        return;
      }
      container.innerHTML = arr.map(([k, v]) => {
        const n = Number(v) || 0;
        // Compute share of total farmers; clamp between 0 and 100.
        const pct = (total > 0) ? Math.min(Math.max(n / total * 100, 0), 100) : 0;
        // Construct a bar row using existing barRow/barTrack/barFill styles. Use
        // the CSS variable --brand (blue) for drivers and --danger (red) for barriers.
        const colorVar = (containerId === '#driversChart') ? 'var(--brand)' : 'var(--danger)';
        return `<div class="barRow">
          <div class="barLabel">${esc(k)}</div>
          <div class="barTrack"><div class="barFill" style="width:${pct.toFixed(1)}%; background:${colorVar};"></div></div>
          <div class="barVal">${fmtInt(n)}${total > 0 ? ` (${fmt1(pct)}%)` : ''}</div>
        </div>`;
      }).join('');
    };

    renderBarChart(drivers, '#driversChart');
    renderBarChart(barriers, '#barriersChart');

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

    // Bind media toolbar events once
    if (!state._mediaBound) {
      state._mediaBound = true;

      const seg = $$('.mediaSeg');
      seg?.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-media-type]');
        if (!btn) return;
        const t = btn.getAttribute('data-media-type') || 'all';
        state.mediaType = t;
        // Update active styling
        $$$('button[data-media-type]', seg).forEach(b => b.classList.toggle('segBtn--active', b === btn));
        state.mediaLimit = 24;
        renderMedia();
      });

      const search = $$('#mediaSearch');
      if (search) {
        search.addEventListener('input', () => {
          state.mediaSearch = String(search.value || '').trim().toLowerCase();
          state.mediaLimit = 24;
          renderMedia();
        });
      }

      const sort = $$('#mediaSort');
      if (sort) {
        sort.addEventListener('change', () => {
          state.mediaSort = String(sort.value || 'newest');
          renderMedia();
        });
      }

      const more = $$('#mediaLoadMore');
      if (more) {
        more.addEventListener('click', () => {
          state.mediaLimit = Number(state.mediaLimit || 24) + 24;
          renderMedia();
        });
      }
    }

    const playIcon = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 7v10l9-5-9-5Z" fill="currentColor"/></svg>';
    const photoIcon = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z" stroke="currentColor" stroke-width="2"/><path d="M8 11l2.5 3 2-2 3.5 5H6l2-6Z" fill="currentColor" opacity=".35"/></svg>';

    const q = String(state.mediaSearch || '').trim().toLowerCase();
    const type = String(state.mediaType || 'all');
    const sortMode = String(state.mediaSort || 'newest');

    let list = Array.isArray(state.filteredSessions) ? [...state.filteredSessions] : [];

    // Filter to sessions that actually have media
    list = list.filter(s => !!firstMediaVideo(s) || !!firstMediaImage(s));

    // Type filter
    if (type === 'videos') list = list.filter(s => !!firstMediaVideo(s));
    if (type === 'images') list = list.filter(s => !!firstMediaImage(s));

    // Text filter
    if (q) {
      list = list.filter(s => {
        const sheet = String(s.sheetRef || '');
        const district = String(s.district || '');
        const village = String(s.village || s.spot || '');
        return `${sheet} ${district} ${village}`.toLowerCase().includes(q);
      });
    }

    // Sort by date (fallback to original order)
    list.sort((a, b) => {
      const da = parseDateSafe(a.date)?.getTime() || 0;
      const db = parseDateSafe(b.date)?.getTime() || 0;
      return sortMode === 'oldest' ? (da - db) : (db - da);
    });

    const total = list.length;
    const limit = Math.max(0, Number(state.mediaLimit || 24));
    const shown = list.slice(0, limit);

    const cards = shown.map(s => {
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
      let badge;
      if (vidPath) {
        // Show auto-playing muted preview
        thumb = `<video autoplay loop muted playsinline src="${esc(videoSrc)}"></video>`;
        badge = `<div class="mediaBadge" title="Video">${playIcon}<span>Video</span></div>`;
      } else {
        thumb = `<img data-media-thumb="1" alt="${esc(title)}" />`;
        badge = `<div class="mediaBadge" title="Image">${photoIcon}<span>Image</span></div>`;
      }
      return `<div class="mediaCard" data-session-id="${sid}">
        <div class="mediaThumb">
          ${badge}
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

    // Update count + load more button
    const countEl = $$('#mediaCount');
    if (countEl) countEl.textContent = total ? `Showing ${Math.min(limit, total)} of ${total}` : 'No media for current filters';
    const moreBtn = $$('#mediaLoadMore');
    if (moreBtn) moreBtn.style.display = (limit < total) ? '' : 'none';

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
    // Navigate back to the base page when a drawer is closed. When the user clicks
    // outside the session preview (or hits Esc), return to the default summary
    // tab by stripping any hash from the URL. Preserve existing query string
    // parameters (e.g. campaign, date filters). Use location.pathname+search to
    // avoid repeatedly appending hashes during navigation. If an exception
    // occurs, silently ignore.
    try {
      const base = location.pathname + location.search;
      // If already on index.html this will simply remove the hash and reload
      // the summary tab. If executed from another tab (e.g. sessions hash)
      // the anchor will be cleared.
      if (location.hash) {
        location.href = base;
      }
    } catch (_e) {
      /* noop */
    }
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
    // When the lightbox is closed, return to the base page so the user is not
    // left on an orphaned hash state. This mirrors the behaviour implemented in
    // closeDrawer(). Preserving pathname and query parameters ensures date
    // filters and campaign selection remain intact.
    try {
      const base = location.pathname + location.search;
      if (location.hash) {
        location.href = base;
      }
    } catch (_e) {
      /* ignore navigation errors */
    }
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

      // Create an empty heatmap layer. The data points are populated in updateMapData().
      try {
        state.heatLayer = window.L.heatLayer([], { radius: 25, blur: 15, maxZoom: 18 });
      } catch (_e) {
        // If the heatmap plugin is not loaded, leave the layer undefined.
        state.heatLayer = null;
      }

      updateMapData();
      setMapStatus('Ready', true);
      setTimeout(() => map.invalidateSize(), 250);

      // Close any open Leaflet popups when clicking on the map background. This
      // prevents popup windows from remaining open when users click outside
      // markers. Without this, popups would remain visible and obstruct the
      // interface. Use a try/catch in case Leaflet has no popups open.
      map.on('click', () => {
        try {
          map.closePopup();
        } catch (_e) {
          /* no-op */
        }
      });
    } catch (e) {
      setMapStatus('Failed', false);
      $$('#mapFallback')?.classList.remove('hidden');
    }
  }

  function updateMapData() {
    if (!state.map || !state.markerLayer || !window.L) return;

    state.markerLayer.clearLayers();
    state.markersBySessionId.clear();

    // Build a quick lookup of sheet metadata to obtain farmers and acreage.
    const idx = state.sheetsIndex?.sheets ? new Map(state.sheetsIndex.sheets.map(x => [x.sheet, x])) : null;

    const pts = [];
    const heatPoints = [];
    for (const s of state.filteredSessions) {
      const lat = Number(s.geo?.lat);
      const lng = Number(s.geo?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      pts.push([lat, lng]);
      // Compute heatmap intensity based on acres engaged. Use sheet index if available,
      // falling back to session metrics. Default to 1 when no acreage is recorded.
      let weight = 1;
      const si = idx?.get(s.sheetRef);
      const acres = Number(si?.acres ?? s?.metrics?.wheatAcres ?? 0);
      if (Number.isFinite(acres) && acres > 0) weight = acres;
      heatPoints.push([lat, lng, weight]);

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

    // Update the heatmap layer with the new intensity points. Only do this if
    // the heatLayer exists (it may be undefined if the plugin failed to load).
    if (state.heatLayer && Array.isArray(heatPoints)) {
      try {
        state.heatLayer.setLatLngs(heatPoints);
      } catch (_e) {
        /* Ignore errors from the heatmap plugin */
      }
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
    // Bind feedback form actions. The user can provide a phone number (for WhatsApp)
    // and/or an email address. A message is always required. When the WhatsApp
    // button is clicked and a phone number is provided, the browser opens a
    // wa.me link with the encoded message. When the Email button is clicked
    // and an email address is provided, the browser opens a mailto link with
    // subject and body prefilled. A small status label displays validation
    // feedback to the user.
    const phoneInput = $$('#fbPhone');
    const emailInput = $$('#fbEmail');
    const msgInput = $$('#fbMessage');
    const waBtn = $$('#fbSendWhatsApp');
    const mailBtn = $$('#fbSendEmail');
    const statusLabel = $$('#fbFeedbackMsg');

    function displayStatus(t, ok = true) {
      if (!statusLabel) return;
      statusLabel.textContent = t;
      statusLabel.style.color = ok ? '' : 'var(--danger)';
    }
    waBtn?.addEventListener('click', () => {
      const phoneRaw = phoneInput?.value?.trim() || '';
      const msg = msgInput?.value?.trim() || '';
      // Remove non-digit characters; WhatsApp expects international numbers
      const phone = phoneRaw.replace(/[^0-9]/g, '');
      if (!phone) {
        displayStatus('Please enter a valid phone number.', false);
        return;
      }
      const encoded = encodeURIComponent(msg);
      const waUrl = `https://wa.me/${phone}?text=${encoded}`;
      // Open in a new tab to avoid leaving the dashboard entirely
      window.open(waUrl, '_blank');
      displayStatus('Opening WhatsApp…');
    });
    mailBtn?.addEventListener('click', () => {
      const email = emailInput?.value?.trim() || '';
      const msg = msgInput?.value?.trim() || '';
      if (!email) {
        displayStatus('Please enter a valid email address.', false);
        return;
      }
      const subject = encodeURIComponent('Feedback on Harvest Horizons Dashboard');
      const body = encodeURIComponent(msg);
      const mailto = `mailto:${email}?subject=${subject}&body=${body}`;
      // Navigate away; mailto links open in the default mail client
      window.location.href = mailto;
      displayStatus('Opening email draft…');
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
    // Assign derived region codes to each session. We map districts/territories
    // to region codes (RGN) based on the Initial sheet. If no match is found
    // the region remains blank. Matching ignores case and spaces for flexibility.
    (function assignRegions() {
      const regionMap = {
        // Sukkur region (SKR)
        'dadu': 'SKR',
        'daharki': 'SKR',
        'dharki': 'SKR',
        'ghotki': 'SKR',
        'jafferabad': 'SKR',
        'jaferabad': 'SKR',
        'jafarabad': 'SKR',
        'jaferabad': 'SKR',
        'mehrabpur': 'SKR',
        'ranipur': 'SKR',
        'sukkur': 'SKR',
        'ubaro': 'SKR',
        'ubauro': 'SKR',
        // Rahim Yar Khan region (RYK)
        'rahim yarkhan': 'RYK',
        'rahim yar khan': 'RYK',
        'rajan pur': 'RYK',
        'rajanpur': 'RYK',
        // Dera Ghazi Khan region (DGK)
        'bhakkar': 'DGK',
        'karor lal esan': 'DGK',
        'kot adu': 'DGK',
        'mianwali': 'DGK',
        'muzaffar garh': 'DGK',
        'muzaffargarh': 'DGK',
        // Faisalabad region (FSD)
        'chakwal': 'FSD',
        'sargodha': 'FSD',
        'toba tek singh': 'FSD',
        // Gujranwala region (GUJ)
        'phalia': 'GUJ'
      };
      for (const s of sessions) {
        const district = String(s.district || '').toLowerCase().replace(/\s+/g, '');
        let matchedRegion = '';
        // Attempt direct match on district (no spaces)
        for (const [key, reg] of Object.entries(regionMap)) {
          const normKey = key.toLowerCase().replace(/\s+/g, '');
          if (district === normKey) { matchedRegion = reg; break; }
        }
        // Assign region code
        s.region = matchedRegion;
      }
    })();

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

    // Apply automatically when region filter changes. This allows users to
    // filter sessions by region code (REG) such as SKR, RYK, DGK. See
    // index.html for the #regionFilter input.
    $$('#regionFilter')?.addEventListener('input', applyDateInputs);

    // Apply automatically when district or score filters change
    $$('#districtFilter')?.addEventListener('input', applyDateInputs);
    $$('#scoreMin')?.addEventListener('input', applyDateInputs);
    $$('#scoreMax')?.addEventListener('input', applyDateInputs);

    // Export button for priority table
    $$('#priorityExportBtn')?.addEventListener('click', exportPriorityCsv);
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

  // Export the priority districts table as CSV. Collects the district rows
  // currently rendered in the table, including the recommended action,
  // and triggers a download via a Blob. The filename incorporates the
  // campaign identifier for clarity.
  function exportPriorityCsv() {
    const table = document.getElementById('priorityDistrictsTable');
    if (!table) return;
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const header = ['District','Sessions','Farmers','Acres','Awareness','Definite','Avg score','Action'];
    const csvRows = [header.join(',')];
    rows.forEach(tr => {
      const cells = Array.from(tr.children).map(td => td.textContent.trim().replace(/\n/g,' ').replace(/,/g,' '));
      csvRows.push(cells.join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type:'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${state.campaignId || 'campaign'}_priority.csv`;
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

      // Bind heatmap toggle button. When clicked, add or remove the heat
      // layer from the map and update the button text accordingly. The map
      // and heatLayer are created lazily in ensureMapReady(), so guard
      // against them being undefined.
      const heatBtn = document.getElementById('toggleHeat');
      if (heatBtn) {
        heatBtn.addEventListener('click', () => {
          if (!state.map || !state.heatLayer) return;
          if (state.map.hasLayer(state.heatLayer)) {
            state.map.removeLayer(state.heatLayer);
            heatBtn.textContent = 'Show Heatmap';
          } else {
            state.heatLayer.addTo(state.map);
            heatBtn.textContent = 'Hide Heatmap';
          }
        });
      }

      // Set map status
      setMapStatus('Ready when opened', true);
    } catch (e) {
      console.error(e);
      setStatus(e.message || 'Failed to load.', 'bad');
    }
  }

  boot();
})();
