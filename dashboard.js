(() => {
  'use strict';

  // Build marker (for cache-busting verification)
  const WHEATCAMPAIGN_BUILD = "2026-01-06.1";
  console.info("[WheatCampaign] dashboard.js loaded", WHEATCAMPAIGN_BUILD);

  const REDUCE_MOTION = !!window.__REDUCE_MOTION__;
  function chartAnimation(){
    return REDUCE_MOTION ? false : { duration: 1500, easing: "easeOutBounce" };
  }

  // Surface runtime errors in the UI
  window.addEventListener("error", (e) => {
    try {
      const box = document.getElementById("statusBox");
      if (box) box.textContent = `Runtime error: ${e.message || e.error || "Unknown error"}`;
    } catch (_) {}
  });

  window.addEventListener("unhandledrejection", (e) => {
    try {
      const box = document.getElementById("statusBox");
      const reason = (e && e.reason) ? (e.reason.message || String(e.reason)) : "Unknown rejection";
      if (box) box.textContent = `Promise rejection: ${reason}`;
    } catch (_) {}
  });

  // ---------- DOM helpers ----------
  const $$ = (sel, root = document) => root.querySelector(sel);
  const $$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => {
    const d = document.createElement('div');
    d.textContent = String((s === null || s === undefined) ? '' : s);
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
    nameFilter: '',
    cityFilter: '',
    regionFilter: '',
    districtFilter: '',
    scoreMin: null,
    scoreMax: null,

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
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
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
  const existsCache = new Map();

  function coalesce() {
    for (let i = 0; i < arguments.length; i++) {
      const v = arguments[i];
      if (v !== null && v !== undefined) return v;
    }
    return undefined;
  }

  function normalizeMediaPath(p) {
    const raw = String((p === null || p === undefined) ? '' : p).trim();
    if (!raw) return '';
    if (/^(https?:|data:|blob:)/i.test(raw)) return raw;

    let x = raw.replace(/^\.?\//, '').replace(/^\//, '');

    if (x.startsWith('assets/')) return x;
    if (x.startsWith('gallery/')) return 'assets/' + x;
    if (!x.includes('/')) return 'assets/gallery/' + x;

    return x;
  }

  function candidatePaths(p) {
    const norm = normalizeMediaPath(p);
    if (!norm || /^(https?:|data:|blob:)/i.test(norm)) return norm ? [norm] : [];

    const cands = [];
    const add = (v) => {
      if (v && cands.indexOf(v) === -1) cands.push(v);
    };

    add(norm);

    if (!norm.includes('assets/gallery/')) {
      const fname = norm.split('/').pop();
      add('assets/gallery/' + fname);
    }

    const mExt = norm.match(/\.(jpeg|jpg|png|webp|mp4|webm)$/i);
    const ext = mExt ? mExt[1].toLowerCase() : '';
    const base = mExt ? norm.slice(0, -1 * (ext.length + 1)) : norm;

    if (ext === 'jpeg') add(base + '.jpg');
    if (ext === 'jpg') add(base + '.jpeg');
    if (ext === 'mp4') add(base + '.webm');
    if (ext === 'webm') add(base + '.mp4');

    if (ext) {
      add(base + 'a.' + ext);
      add(base + '_a.' + ext);
      add(base + '-a.' + ext);

      if (ext === 'jpeg') {
        add(base + 'a.jpg'); add(base + '_a.jpg'); add(base + '-a.jpg');
      }
      if (ext === 'jpg') {
        add(base + 'a.jpeg'); add(base + '_a.jpeg'); add(base + '-a.jpeg');
      }
      if (ext === 'mp4') {
        add(base + 'a.webm'); add(base + '_a.webm'); add(base + '-a.webm');
      }
      if (ext === 'webm') {
        add(base + 'a.mp4'); add(base + '_a.mp4'); add(base + '-a.mp4');
      }
    }

    return cands;
  }

  async function assetExists(relOrAbs) {
    const u = /^(https?:|data:|blob:)/i.test(relOrAbs) ? relOrAbs : url(relOrAbs);
    if (existsCache.has(u)) return existsCache.get(u);

    try {
      const r = await fetch(u, { method: 'HEAD', cache: 'force-cache' });
      const ok = !!r && r.ok;
      existsCache.set(u, ok);
      return ok;
    } catch (_e) {
      existsCache.set(u, false);
      return false;
    }
  }

  async function resolveFirstExisting(p) {
    const cands = candidatePaths(p);
    for (let i = 0; i < cands.length; i++) {
      const c = cands[i];
      const u = /^(https?:|data:|blob:)/i.test(c) ? c : url(c);
      if (existsCache.has(u) && existsCache.get(u)) return c;

      try {
        const r = await fetch(u, { method: 'HEAD', cache: 'force-cache' });
        const ok = !!r && r.ok;
        existsCache.set(u, ok);
        if (ok) return c;
      } catch (_e) {
        // ignore
      }
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

  const resolvedSrcCache = new Map();

  function attachSmartVideo(videoEl, path, opts) {
    opts = opts || {};
    const placeholder = 'assets/placeholder-video.mp4';

    const norm = normalizeMediaPath(path);
    const cacheKey = norm || String(path || '');
    const wantsMuted = !!opts.muted;
    const wantsLoop = !!opts.loop;

    videoEl.preload = opts.preload || 'metadata';
    videoEl.controls = !!opts.controls;
    videoEl.playsInline = true;
    videoEl.setAttribute('playsinline', '');

    if (wantsLoop) videoEl.loop = true;
    if (wantsMuted) {
      videoEl.muted = true;
      videoEl.setAttribute('muted', '');
    }

    (async () => {
      if (!norm) {
        videoEl.src = url(placeholder);
        try { videoEl.load(); } catch (_e) {}
        return;
      }

      const cached = resolvedSrcCache.get(cacheKey);
      if (cached) {
        videoEl.src = cached;
        try { videoEl.load(); } catch (_e) {}
        return;
      }

      const chosen = await resolveFirstExisting(norm);
      const finalSrc = chosen ? url(chosen) : url(placeholder);
      resolvedSrcCache.set(cacheKey, finalSrc);

      if (videoEl && videoEl.isConnected) {
        videoEl.src = finalSrc;
        try { videoEl.load(); } catch (_e) {}
      }
    })();

    if (opts.togglePlayOnClick) {
      videoEl.addEventListener('click', (e) => {
        if (opts.stopPropagation) e.stopPropagation();
        if (videoEl.paused) {
          const pp = videoEl.play();
          if (pp && pp.catch) pp.catch(() => { /* ignore */ });
        } else {
          videoEl.pause();
        }
      });
    }

    videoEl.addEventListener('error', () => {
      try {
        videoEl.src = url(placeholder);
      } catch (_e) { /* ignore */ }
    });
  }

  // ---------- Tab controller ----------
  function setActiveTab(tab) {
    const tabs = $$$('.tabBtn[data-tab]');
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
        await new Promise(res => setTimeout(res, 500 * attempt));
      }
    }
    throw new Error(`Failed to fetch ${why}`);
  }

  async function loadCampaignRegistry() {
    try {
      const reg = await fetchJson('data/campaigns.json', 'campaign registry');
      state.campaigns = Array.isArray(reg.campaigns) ? reg.campaigns : [];
      return;
    } catch (e) {
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

  // ---------- Map loader ----------
  async function ensureMapReady() {
    const el = $$('#leafletMap');
    if (!el) return;

    setMapStatus('Loading map…', false);
    
    try {
      // Use the global loader defined in index.html
      const ok = await window.loadLeaflet();
      if (!ok) throw new Error('Leaflet failed to load');
      
      if (state.map) {
        state.map.invalidateSize();
        updateMapData();
        setMapStatus('Ready', true);
        return;
      }

      const map = window.L.map(el, { 
        zoomControl: true,
        preferCanvas: true
      });
      state.map = map;
      state.markerLayer = window.L.layerGroup().addTo(map);

      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      // Initialize heat layer if available
      if (typeof window.L.heatLayer === 'function') {
        state.heatLayer = window.L.heatLayer([], { radius: 25, blur: 15, maxZoom: 18 });
      }

      updateMapData();
      setMapStatus('Ready', true);
      
      // Force resize for proper rendering
      setTimeout(() => {
        if (state.map && state.map.invalidateSize) {
          state.map.invalidateSize(true);
        }
      }, 100);
      
      map.on('click', () => {
        try {
          map.closePopup();
        } catch (_e) { /* no-op */ }
      });
      
    } catch (e) {
      console.error('Map initialization failed:', e);
      setMapStatus('Failed to load map', false);
      const mf = $$('#mapFallback');
      if (mf) {
        mf.classList.remove('hidden');
        mf.innerHTML = `
          <div style="padding: 20px; text-align: center;">
            <div style="color: var(--warn); margin-bottom: 10px; font-weight: bold;">⚠️ Map Unavailable</div>
            <div class="muted" style="margin-bottom: 15px;">The map library failed to load. This may be due to network restrictions.</div>
            <div style="display: flex; gap: 10px; justify-content: center;">
              <button class="btn btnSmall" onclick="location.reload()">Retry</button>
              <button class="btn btnGhost btnSmall" onclick="document.getElementById('mapFallback').classList.add('hidden');">Dismiss</button>
            </div>
          </div>`;
      }
    }
  }

  function setRangeHint() {
    const el = $$('#rangeHint');
    if (!el || !state.dateMin || !state.dateMax) return;
    el.textContent = `Campaign duration: ${formatDateInput(state.dateMin)} to ${formatDateInput(state.dateMax)}`;
  }

  function applyDateInputs() {
    const fromEl = $$('#dateFrom');
    const toEl = $$('#dateTo');

    const from = parseDateSafe(fromEl ? fromEl.value : '');
    const to = parseDateSafe(toEl ? toEl.value : '');

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

    const nameEl = $$('#nameFilter');
    const cityEl = $$('#cityFilter');
    state.nameFilter = nameEl ? String(nameEl.value || '').trim() : '';
    state.cityFilter = cityEl ? String(cityEl.value || '').trim() : '';

    const districtEl = $$('#districtFilter');
    state.districtFilter = districtEl ? String(districtEl.value || '').trim() : '';

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

    const nameEl = $$('#nameFilter');
    const cityEl = $$('#cityFilter');
    if (nameEl) nameEl.value = '';
    if (cityEl) cityEl.value = '';
    state.nameFilter = '';
    state.cityFilter = '';

    const districtEl = $$('#districtFilter');
    const minEl = $$('#scoreMin');
    const maxEl = $$('#scoreMax');
    if (districtEl) districtEl.value = '';
    if (minEl) minEl.value = '';
    if (maxEl) maxEl.value = '';
    state.districtFilter = '';
    state.scoreMin = null;
    state.scoreMax = null;

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
      if (d) {
        if (d < a || d > b) return false;
      }
      
      if (state.nameFilter) {
        const name = String((s.host && s.host.name) ? s.host.name : '').toLowerCase();
        if (!name.includes(state.nameFilter.toLowerCase())) return false;
      }
      
      if (state.cityFilter) {
        const city = String(s.city || '').toLowerCase();
        if (!city.includes(state.cityFilter.toLowerCase())) return false;
      }

      if (state.regionFilter) {
        const reg = String(s.region || '').toLowerCase();
        if (!reg.includes(state.regionFilter.toLowerCase())) return false;
      }

      if (state.districtFilter) {
        const district = String(s.district || '').toLowerCase();
        if (!district.includes(state.districtFilter.toLowerCase())) return false;
      }

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

    // Update last updated timestamp
    (function updateLastUpdated(){
      const lastEl = $$('#lastUpdated');
      if (!lastEl) return;
      let latest = null;
      for (const s of fs) {
        const d = parseDateSafe(s.date);
        if (d && (!latest || d > latest)) latest = d;
      }
      if (latest) {
        const iso = formatDateInput(latest);
        lastEl.textContent = `Data as of ${iso}`;
      } else {
        lastEl.textContent = '';
      }
    })();
    
    const idx = (state.sheetsIndex && state.sheetsIndex.sheets) ? new Map(state.sheetsIndex.sheets.map(x => [x.sheet, x])) : null;
    const legendColor = (getComputedStyle(document.documentElement).getPropertyValue('--text') || '#e9eef7').trim();

    // ---------- Totals ----------
    let totalFarmers = 0;
    let totalAcres = 0;
    let totalEstAcres = 0;

    // ---------- Weighted averages ----------
    let sumAw = 0, denAw = 0;
    let sumUl = 0, denUl = 0;
    let sumDe = 0, denDe = 0;
    let sumMb = 0, denMb = 0;
    let sumNi = 0, denNi = 0;
    let sumUn = 0, denUn = 0;

    let sumScore = 0, denScore = 0;

    const drivers = new Map();
    const barriers = new Map();

    let imgRefs = 0;
    let vidRefs = 0;

    for (const s of fs) {
      const si = idx ? idx.get(s.sheetRef) : null;

      const farmers = Number(coalesce(si && si.farmers_present, (s.metrics && s.metrics.farmers), 0));
      const acres = Number(coalesce(si && si.acres, (s.metrics && s.metrics.wheatAcres), 0));

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
    const understandingAvg = avg(sumUn, denUn);
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

    // Summary progress
    const progEl = $$('#summaryProgress');
    if (progEl) {
      const pctVal = Number.isFinite(awarenessAvg) ? Math.max(0, Math.min(100, Math.round(awarenessAvg))) : null;
      if (pctVal == null) {
        progEl.innerHTML = '';
      } else {
        progEl.innerHTML = `
          <div class="progressContainer">
            <div class="progressTrack"><div class="progressBar" style="width:${pctVal}%"></div></div>
            <div class="smallMuted progressNote">${pctVal}% of target farmers educated—INTERACT on track.</div>
          </div>`;
      }
    }

    // Push headline KPIs into hero
    try {
      if (window.WHEAT_HERO && typeof window.WHEAT_HERO.updateStats === 'function') {
        window.WHEAT_HERO.updateStats({
          sessions: fs.length,
          farmers: Number.isFinite(totalFarmers) ? totalFarmers : null,
          awareness: Number.isFinite(awarenessAvg) ? Math.round(awarenessAvg) : null,
          definite: Number.isFinite(definiteAvg) ? Math.round(definiteAvg) : null,
          score: Number.isFinite(scoreAvg) ? Number(scoreAvg.toFixed(1)) : null
        });
      }
    } catch (e) { /* ignore */ }

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
    const attCanvas = $$('#attendanceDonut');
    if (attCanvas && typeof Chart !== 'undefined' && Array.isArray(fs)) {
      if (window.attendanceChart && typeof window.attendanceChart.destroy === 'function') {
        window.attendanceChart.destroy();
      }
      
      const sessionsByFarmers = fs
        .map(s => {
          const count = Number((s.metrics && s.metrics.farmers) || 0);
          let loc = (s.district || '').trim();
          if (!loc) loc = (s.village || s.spot || '').trim();
          if (!loc) loc = 'Session';
          const label = `${loc} (S${s.id})`;
          return { id: s.id, label, farmers: count };
        })
        .filter(x => x.farmers > 0)
        .sort((a, b) => b.farmers - a.farmers);
      
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
          animation: chartAnimation(),
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
        const si = idx ? idx.get(s.sheetRef) : null;
        const farmers = Number(coalesce(si && si.farmers_present, (s.metrics && s.metrics.farmers), 0));
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
              labels: { color: legendColor, usePointStyle: true, padding: 12, boxWidth: 10 }
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

    // ---------- Additional breakdowns ----------
    const palette = ['#44b8ff','#6be675','#ffce56','#ff6384','#9966ff','#ff9f40','#4bc0c0','#c9cbcf','#36a2eb','#8dd1ff'];

    const farmersFor = (s) => {
      const si = idx ? idx.get(s.sheetRef) : null;
      const f = Number(coalesce(si && si.farmers_present, (s.metrics && s.metrics.farmers), s.farmers, 0));
      return (Number.isFinite(f) && f > 0) ? f : 0;
    };

    const normKey = (v, fallback = 'Unknown') => {
      const x = String((v === null || v === undefined) ? '' : v).trim();
      if (!x) return fallback;
      return x.toUpperCase();
    };

    const setPlaceholder = (canvas, msg, show) => {
      const wrap = canvas ? canvas.parentElement : null;
      if (!wrap) return;
      let ph = wrap.querySelector('.chartPlaceholder');
      if (!ph) {
        ph = document.createElement('div');
        ph.className = 'muted chartPlaceholder';
        ph.style.padding = '12px';
        ph.style.display = 'none';
        wrap.appendChild(ph);
      }
      if (show) {
        canvas.style.display = 'none';
        ph.textContent = msg || 'No data.';
        ph.style.display = 'block';
      } else {
        canvas.style.display = '';
        ph.style.display = 'none';
      }
    };

    const renderGroupDonut = (canvasSel, winKey, keyGetter, emptyMsg) => {
      const canvas = $$(canvasSel);
      if (!canvas || typeof Chart === 'undefined') return;

      const prior = window[winKey];
      if (prior && typeof prior.destroy === 'function') prior.destroy();

      const mp = new Map();
      let anyFarmers = false;

      for (const s of fs) {
        const key = normKey(keyGetter(s));
        const f = farmersFor(s);
        if (f > 0) anyFarmers = true;
        const rec = mp.get(key) || { farmers: 0, sessions: 0 };
        rec.farmers += f;
        rec.sessions += 1;
        mp.set(key, rec);
      }

      const arr = [...mp.entries()].map(([k, v]) => ({
        key: k,
        farmers: Number(v.farmers) || 0,
        sessions: Number(v.sessions) || 0
      }));

      const hasAny = arr.some(x => (x.sessions > 0));
      if (!hasAny) { setPlaceholder(canvas, emptyMsg || 'No data.', true); return; }
      setPlaceholder(canvas, '', false);

      const metric = anyFarmers ? 'farmers' : 'sessions';
      arr.sort((a, b) => (Number(b[metric]) - Number(a[metric])));

      const topN = 6;
      const labels = [];
      const data = [];
      const metaFarmers = [];
      const metaSessions = [];

      let otherMetric = 0;
      let otherFarmers = 0;
      let otherSessions = 0;

      arr.forEach((it, i) => {
        const mval = Number(it[metric]) || 0;
        if (i < topN) {
          labels.push(it.key);
          data.push(mval);
          metaFarmers.push(it.farmers);
          metaSessions.push(it.sessions);
        } else {
          otherMetric += mval;
          otherFarmers += it.farmers;
          otherSessions += it.sessions;
        }
      });

      if (otherMetric > 0) {
        labels.push('Other');
        data.push(otherMetric);
        metaFarmers.push(otherFarmers);
        metaSessions.push(otherSessions);
      }

      const ctx = canvas.getContext('2d');
      const bgColors = data.map((_, i) => palette[i % palette.length]);

      window[winKey] = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: bgColors,
            borderColor: '#ffffff10',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: chartAnimation(),
          cutout: '55%',
          plugins: {
            legend: {
              position: 'right',
              labels: { color: legendColor, usePointStyle: true, padding: 12, boxWidth: 10 }
            },
            tooltip: {
              callbacks: {
                label: function(ctx) {
                  const i = ctx.dataIndex;
                  const lab = ctx.label || '';
                  const val = ctx.dataset.data[i];
                  const total = ctx.dataset.data.reduce((acc, v) => acc + v, 0);
                  const pct = total ? ((val / total) * 100).toFixed(1) : '0.0';
                  const sessions = ((metaSessions[i] === null || metaSessions[i] === undefined) ? 0 : metaSessions[i]);
                  const farmers = ((metaFarmers[i] === null || metaFarmers[i] === undefined) ? 0 : metaFarmers[i]);

                  if (anyFarmers) {
                    return `${lab}: ${Math.round(val)} farmers (${pct}%) • ${sessions} session${sessions === 1 ? '' : 's'}`;
                  }
                  return `${lab}: ${Math.round(val)} session${Math.round(val) === 1 ? '' : 's'} (${pct}%)`;
                }
              }
            }
          }
        }
      });
    };

    // Farmers by region (REG)
    renderGroupDonut('#regionPie', 'regionChart', (s) => s.region, 'No region entries yet.');

    // Farmers by territory
    renderGroupDonut('#territoryPie', 'territoryChart', (s) => s.city, 'No territory entries yet.');

    // Session score distribution
    (function renderScoreBands(){
      const canvas = $$('#scoreBandsDonut');
      if (!canvas || typeof Chart === 'undefined') return;

      if (window.scoreBandsChart && typeof window.scoreBandsChart.destroy === 'function') {
        window.scoreBandsChart.destroy();
      }

      const bands = [
        { label: '<60', min: -Infinity, max: 59.9999 },
        { label: '60–69', min: 60, max: 69.9999 },
        { label: '70–79', min: 70, max: 79.9999 },
        { label: '80–89', min: 80, max: 89.9999 },
        { label: '90+', min: 90, max: Infinity },
      ];

      const counts = new Array(bands.length).fill(0);
      const farmersByBand = new Array(bands.length).fill(0);

      for (const s of fs) {
        const sc = Number(s.score);
        if (!Number.isFinite(sc)) continue;
        const f = farmersFor(s);
        let bi = bands.findIndex(b => sc >= b.min && sc <= b.max);
        if (bi < 0) bi = 0;
        counts[bi] += 1;
        farmersByBand[bi] += f;
      }

      const total = counts.reduce((a, v) => a + v, 0);
      if (!total) { setPlaceholder(canvas, 'No scored sessions in the current filter.', true); return; }
      setPlaceholder(canvas, '', false);

      const labels = bands.map(b => b.label);
      const ctx = canvas.getContext('2d');
      const bgColors = counts.map((_, i) => palette[i % palette.length]);

      window.scoreBandsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: counts,
            backgroundColor: bgColors,
            borderColor: '#ffffff10',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: chartAnimation(),
          cutout: '55%',
          plugins: {
            legend: {
              position: 'right',
              labels: { color: legendColor, usePointStyle: true, padding: 12, boxWidth: 10 }
            },
            tooltip: {
              callbacks: {
                label: function(ctx) {
                  const i = ctx.dataIndex;
                  const lab = ctx.label || '';
                  const val = ctx.dataset.data[i];
                  const total = ctx.dataset.data.reduce((acc, v) => acc + v, 0);
                  const pct = total ? ((val / total) * 100).toFixed(1) : '0.0';
                  const f = farmersByBand[i] || 0;
                  return `${lab}: ${val} session${val === 1 ? '' : 's'} (${pct}%)${f ? ` • ${Math.round(f)} farmers` : ''}`;
                }
              }
            }
          }
        }
      });
    })();

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
        const scoreNum = Number(s.score||0);
        const badgeClass = scoreNum >= 85 ? 'badge badge--gold' : 'badge';
        const si = idx ? idx.get(s.sheetRef) : null;
        const f = si ? fmtInt(si.farmers_present) : (Number.isFinite(Number((s.metrics && s.metrics.farmers))) ? fmtInt(s.metrics.farmers) : '—');
        const a = si ? fmt1(si.acres) : (Number.isFinite(Number((s.metrics && s.metrics.wheatAcres))) ? fmt1(s.metrics.wheatAcres) : '—');
        const href = `details.html?campaign=${encodeURIComponent(state.campaignId)}&session=${encodeURIComponent(String(s.id))}`;
        return `<tr data-session-id="${sid}">
          <td>${date}</td>
          <td><span class="${badgeClass}">${sheet}</span></td>
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
        const si = idx ? idx.get(s.sheetRef) : null;
        const farmers = Number(coalesce(si && si.farmers_present, (s.metrics && s.metrics.farmers), 0));
        const acres = Number(coalesce(si && si.acres, (s.metrics && s.metrics.wheatAcres), 0));
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

      let agg = [...byD.values()].map(o => {
        const aw = avg(o.awSum, o.awDen);
        const de = avg(o.deSum, o.deDen);
        const sc = avg(o.scSum, o.scDen);
        return { ...o, aw, de, sc };
      });
      
      agg.sort((a,b) => {
        const ad = Number.isFinite(a.de) ? a.de : 1e9;
        const bd = Number.isFinite(b.de) ? b.de : 1e9;
        if (ad !== bd) return ad - bd;
        const as = Number.isFinite(a.sc) ? a.sc : 1e9;
        const bs = Number.isFinite(b.sc) ? b.sc : 1e9;
        return as - bs;
      });
      
      const rows = agg.slice(0, 8);

      const takeawayEl = $$('#summaryTakeaways');
      if (takeawayEl) {
        if (rows.length) {
          const topNames = rows.slice(0, 2).map(r => r.district).filter(Boolean);
          takeawayEl.textContent = topNames.length ? `Focus next on ${topNames.join(' and ')}` : '';
        } else {
          takeawayEl.textContent = '';
        }
      }

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
    const renderReasonsDonut = (mp, canvasSel, legendSel, winKey, emptyMsg, hueBase) => {
      const canvas = $$(canvasSel);
      const legend = $$(legendSel);

      if (!canvas) return;

      if (typeof Chart === 'undefined') {
        if (legend) legend.innerHTML = `<div class="muted">${esc(emptyMsg || 'Chart library not loaded.')}</div>`;
        return;
      }

      const prior = window[winKey];
      if (prior && typeof prior.destroy === 'function') prior.destroy();

      const total = totalFarmers || 0;

      const entries = [...mp.entries()]
        .map(([k, v]) => [String(k || '').trim(), Number(v) || 0])
        .filter(([k, v]) => k && v > 0)
        .sort((a, b) => b[1] - a[1]);

      if (!entries.length) {
        if (legend) legend.innerHTML = `<div class="muted">${esc(emptyMsg || 'No entries captured.')}</div>`;
        try {
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        } catch (_) {}
        return;
      }

      const top = entries.slice(0, 6);
      const rest = entries.slice(6);
      if (rest.length) {
        const other = rest.reduce((acc, [, v]) => acc + (Number(v) || 0), 0);
        if (other > 0) top.push(['Other', other]);
      }

      const labels = top.map(([k]) => k);
      const values = top.map(([, v]) => Number(v) || 0);

      const n = Math.max(values.length, 1);
      const colors = values.map((_, i) => `hsl(${(hueBase + (i * 360) / n) % 360} 65% 55%)`);

      if (legend) {
        legend.innerHTML = top.map(([k, v], i) => {
          const cnt = Number(v) || 0;
          const pctFarmers = total ? (cnt / total) * 100 : null;
          return `<div class="legendItem">
            <span class="legendDot" style="background:${colors[i]};"></span>
            <span class="legendText">${esc(k)}</span>
            <span class="legendVal">${fmtInt(cnt)}${pctFarmers != null ? ` (${fmt1(pctFarmers)}%)` : ''}</span>
          </div>`;
        }).join('');
      }

      window[winKey] = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: values,
            backgroundColor: colors,
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: chartAnimation(),
          cutout: '60%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function(ctx) {
                  const i = ctx.dataIndex;
                  const lab = ctx.label || '';
                  const val = Number(ctx.parsed) || 0;
                  const sum = (ctx.dataset.data || []).reduce((acc, v) => acc + (Number(v) || 0), 0);
                  const pctReasons = sum ? ((val / sum) * 100).toFixed(1) : '0.0';
                  const pctFarmers = total ? ((val / total) * 100).toFixed(1) : null;
                  return `${lab}: ${fmtInt(val)}${pctFarmers != null ? ` (${pctFarmers}% of farmers)` : ''} • ${pctReasons}% of reasons`;
                }
              }
            }
          }
        }
      });
    };

    renderReasonsDonut(drivers, '#driversDonut', '#driversLegend', 'driversDonutChart', 'No driver entries yet.', 200);
    renderReasonsDonut(barriers, '#barriersDonut', '#barriersLegend', 'barriersDonutChart', 'No barrier entries yet.', 12);
    
    // ---------- Data readiness / status ----------
    setStatus(
      `Loaded ${fmtInt(fs.length)} sessions and ${fmtInt(((state.sheetsIndex && state.sheetsIndex.sheets) ? state.sheetsIndex.sheets.length : 0) || 0)} sheet summaries.\n` +
      `Reach: ${totalFarmers ? fmtInt(totalFarmers) : '—'} farmers • ${totalAcres ? fmt1(totalAcres) : '—'} acres • Est. Buctril acres: ${totalEstAcres ? fmt1(totalEstAcres) : '—'}.\n` +
      `Referenced media: ${fmtInt(imgRefs)} images • ${fmtInt(vidRefs)} videos.\n` +
      `Conversion coverage: ${denAw ? fmtInt(denAw) : '—'} farmer-weighted records (of ${totalFarmers ? fmtInt(totalFarmers) : '—'} farmers).`,
      'ok'
    );
  }

  function renderSessionsTable() {
    const tbody = $$('#sessionsTable tbody');
    if (!tbody) return;

    const idx = (state.sheetsIndex && state.sheetsIndex.sheets) ? new Map(state.sheetsIndex.sheets.map(x => [x.sheet, x])) : null;

    const rows = state.filteredSessions.map(s => {
      const sid = esc(s.id);
      const date = esc(s.date || '');
      const sheet = esc(s.sheetRef || '');
      const district = esc(s.district || '');
      const village = esc(s.village || s.spot || '');
      const score = Number.isFinite(Number(s.score)) ? fmt1(s.score) : '—';
      const si = idx ? idx.get(s.sheetRef) : null;
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

    tbody.onclick = (ev) => {
      const tr = ev.target.closest('tr[data-session-id]');
      if (!tr) return;
      if (ev.target.closest('a')) return;
      const sid = Number(tr.dataset.sessionId);
      openDrawer(sid);
    };

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

    if (!state._mediaBound) {
      state._mediaBound = true;

      const seg = $$('.mediaSeg');
      if (seg) {
        seg.addEventListener('click', (e) => {
          const btn = e.target.closest('button[data-media-type]');
          if (!btn) return;
          const t = btn.getAttribute('data-media-type') || 'all';
          state.mediaType = t;
          $$$('button[data-media-type]', seg).forEach(b => b.classList.toggle('segBtn--active', b === btn));
          state.mediaLimit = 24;
          renderMedia();
        });
      }

      const search = $$('#mediaSearch');
      if (search) {
        search.addEventListener('input', () => {
          state.mediaSearch = String(search.value || '');
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
    const photoIcon = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 19H3V5h4l2-2h6l2 2h4v14Z" stroke="currentColor" stroke-width="1.5"/><path d="M8 14l2.5-3 2 2 3.5-4 4 5H6l2-6Z" fill="currentColor" opacity=".35"/></svg>';

    const q = String(state.mediaSearch || '').trim().toLowerCase();
    const type = String(state.mediaType || 'all');
    const sortMode = String(state.mediaSort || 'newest');

    let list = Array.isArray(state.filteredSessions) ? state.filteredSessions.slice() : [];

    list = list.filter(s => !!firstMediaVideo(s) || !!firstMediaImage(s));

    if (type === 'videos') list = list.filter(s => !!firstMediaVideo(s));
    if (type === 'images') list = list.filter(s => !!firstMediaImage(s));

    if (q) {
      list = list.filter(s => {
        const sheet = String(s.sheetRef || '');
        const district = String(s.district || '');
        const village = String(s.village || s.spot || '');
        return (sheet + ' ' + district + ' ' + village).toLowerCase().indexOf(q) >= 0;
      });
    }

    list.sort((a, b) => {
      const daObj = parseDateSafe(a.date);
      const dbObj = parseDateSafe(b.date);
      const da = daObj ? daObj.getTime() : 0;
      const db = dbObj ? dbObj.getTime() : 0;
      return sortMode === 'oldest' ? (da - db) : (db - da);
    });

    const limit = Number(state.mediaLimit || 24);
    const shown = list.slice(0, limit);

    grid.innerHTML = '';

    for (let i = 0; i < shown.length; i++) {
      const s = shown[i];
      const sid = String(s.id);
      const sheet = String(s.sheetRef || '');
      const district = String(s.district || '');
      const village = String(s.village || s.spot || '');

      const vidPath = firstMediaVideo(s);
      const imgPath = firstMediaImage(s);
      const title = sheet + ' • ' + district + ' • ' + village;
      const hrefDetails = 'details.html?campaign=' + encodeURIComponent(String(state.campaignId)) + '&session=' + encodeURIComponent(String(s.id));

      const card = document.createElement('div');
      card.className = 'mediaCard';
      card.setAttribute('data-session-id', sid);

      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'mediaThumb';

      const badge = document.createElement('div');
      badge.className = 'mediaBadge';
      if (vidPath) {
        badge.title = 'Video';
        badge.innerHTML = playIcon + '<span>Video</span>';
      } else {
        badge.title = 'Image';
        badge.innerHTML = photoIcon + '<span>Image</span>';
      }

      thumbWrap.appendChild(badge);

      if (vidPath) {
        const v = document.createElement('video');
        v.autoplay = true;
        v.loop = true;
        v.muted = true;
        v.playsInline = true;
        v.setAttribute('playsinline', '');
        v.className = 'mediaThumbVideo';

        attachSmartVideo(v, vidPath, { muted: true, loop: true, controls: false, togglePlayOnClick: true, stopPropagation: true });

        thumbWrap.appendChild(v);
      } else {
        const img = document.createElement('img');
        img.setAttribute('data-media-thumb', '1');
        img.alt = title;
        attachSmartImage(img, imgPath || 'assets/placeholder.svg');
        thumbWrap.appendChild(img);
      }

      const meta = document.createElement('div');
      meta.className = 'mediaMeta';

      const t = document.createElement('div');
      t.className = 'mediaTitle';
      t.textContent = title;

      const actions = document.createElement('div');
      actions.className = 'mediaActions';

      const aSheet = document.createElement('a');
      aSheet.className = 'btn btnSmall';
      aSheet.href = 'sheets.html?campaign=' + encodeURIComponent(String(state.campaignId)) + '&sheet=' + encodeURIComponent(String(s.sheetRef || ''));
      aSheet.textContent = 'Sheet';

      const aDetails = document.createElement('a');
      aDetails.className = 'btn btnSmall btnGhost';
      aDetails.href = hrefDetails;
      aDetails.textContent = 'Details';

      const btnOpen = document.createElement('button');
      btnOpen.className = 'btn btnSmall btnGhost';
      btnOpen.setAttribute('data-action', 'open');
      btnOpen.textContent = 'Open';

      actions.appendChild(aSheet);
      actions.appendChild(aDetails);
      actions.appendChild(btnOpen);

      meta.appendChild(t);
      meta.appendChild(actions);

      card.appendChild(thumbWrap);
      card.appendChild(meta);

      grid.appendChild(card);
    }

    const countEl = $$('#mediaCount');
    if (countEl) countEl.textContent = shown.length + ' shown of ' + list.length;

    const moreBtn = $$('#mediaLoadMore');
    if (moreBtn) moreBtn.style.display = (limit < list.length) ? '' : 'none';

    grid.onclick = (ev) => {
      const card = ev.target.closest('.mediaCard[data-session-id]');
      if (!card) return;
      if (ev.target.closest('a')) return;
      const sidNum = Number(card.getAttribute('data-session-id'));
      openLightbox(sidNum);
    };
  }

  function renderAll() {
    renderSummary();
    renderSessionsTable();
    renderMedia();
    updateMapData();
  }

  // ---------- Drawer ----------
  function closeDrawer() {
    const ov = $$('#drawerOverlay');
    const dr = $$('#sessionDrawer');
    if (ov) ov.classList.add('hidden');
    if (dr) dr.classList.add('hidden');
    if (ov) ov.setAttribute('aria-hidden', 'true');
    if (dr) dr.setAttribute('aria-hidden', 'true');
    try {
      const base = location.pathname + location.search;
      if (location.hash) {
        location.href = base;
      }
    } catch (_e) { /* noop */ }
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

    const si = (state.sheetsIndex && state.sheetsIndex.sheets) ? state.sheetsIndex.sheets.find(x => x.sheet === s.sheetRef) : null;
    $$('#dFarmers').textContent = si ? fmtInt(si.farmers_present) : '—';
    $$('#dAcres').textContent = si ? fmt1(si.acres) : '—';
    $$('#dScore').textContent = Number.isFinite(Number(s.score)) ? fmt1(s.score) : '—';

    const meta = [
      s.city ? `City: ${esc(s.city)}` : '',
      s.district ? `District: ${esc(s.district)}` : '',
      s.spot ? `Spot: ${esc(s.spot)}` : '',
      (s.dealer && s.dealer.name) ? `Dealer: ${esc(s.dealer.name)}` : '',
      (s.salesRep && s.salesRep.name) ? `Sales: ${esc(s.salesRep.name)}` : '',
      (s.host && s.host.name) ? `Host: ${esc(s.host.name)}` : '',
    ].filter(Boolean).join(' • ');
    $$('#dMeta').innerHTML = meta || '<span class="muted">—</span>';

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

    const acts = [];
    const farmersNow = Number(coalesce(si && si.farmers_present, m.farmers, 0));
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

    const sheetUrl = `sheets.html?campaign=${encodeURIComponent(state.campaignId)}&sheet=${encodeURIComponent(s.sheetRef)}`;
    const detailsUrl = `details.html?campaign=${encodeURIComponent(state.campaignId)}&session=${encodeURIComponent(String(s.id))}`;
    $$('#dOpenSheet').setAttribute('href', sheetUrl);
    $$('#dOpenDetails').setAttribute('href', detailsUrl);

    const lat = Number((s.geo && s.geo.lat));
    const lng = Number((s.geo && s.geo.lng));
    const g = (Number.isFinite(lat) && Number.isFinite(lng)) ? `https://www.google.com/maps?q=${lat},${lng}` : '#';
    $$('#dOpenMaps').setAttribute('href', g);

    const sumEl = $$('#dSheetSummary');
    if (sumEl) sumEl.textContent = 'Loading…';
    try {
      const sheet = await fetchJson(`data/${state.campaignId}/sheets/${s.sheetRef}.json`, 'sheet');
      const fb = sheet.feedback || {};
      const farmers = Array.isArray(sheet.farmers) ? sheet.farmers : [];
      const top = [...farmers].sort((a,b) => Number(b.acres||0)-Number(a.acres||0)).slice(0,5);

      const topHtml = top.length
        ? `<ul>${top.map(x => `<li>${esc(x.name || '')} — ${esc(String(((x.acres === null || x.acres === undefined) ? '' : x.acres)))} acres</li>`).join('')}</ul>`
        : '<div class="muted">No farmer rows found in sheet.</div>';

      const hostComment = fb.host_comment ? `<div><b>Host comment:</b> ${esc(fb.host_comment)}</div>` : '';
      const mgr = fb.manager_note ? `<div><b>Manager note:</b> ${esc(fb.manager_note)}</div>` : '';
      const sales = fb.sales_feedback ? `<div><b>Sales feedback:</b> ${esc(fb.sales_feedback)}</div>` : '';

      sumEl.innerHTML = `
        <div class="muted">Sheet: <b>${esc((sheet.meta && sheet.meta.sheet) || s.sheetRef)}</b> • Date: <b>${esc((sheet.meta && sheet.meta.date) || s.date || '')}</b></div>
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
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (ov) ov.addEventListener('click', closeDrawer);
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
    try {
      const base = location.pathname + location.search;
      if (location.hash) {
        location.href = base;
      }
    } catch (_e) { /* ignore */ }
  }

  function bindLightbox() {
    const c = $$('#lbClose');
    if (c) c.addEventListener('click', closeLightbox);

    const lb = $$('#lightbox');
    if (lb) {
      lb.addEventListener('click', (ev) => {
        if (ev.target && ev.target.id === 'lightbox') closeLightbox();
      });
    }
  }

  function openLightbox(sessionId) {
    const s = state.sessionsById.get(Number(sessionId));
    if (!s) return;

    const lb = $$('#lightbox');
    const body = $$('#lbBody');
    if (!lb || !body) return;

    const titleEl = $$('#lbTitle');
    if (titleEl) titleEl.textContent = 'Session ' + String(s.id) + ' • ' + String(s.sheetRef || '');

    lb.classList.add('open');
    body.innerHTML = '';

    const items = allMediaItems(s);
    if (!items || !items.length) {
      body.innerHTML = '<div class="muted">No media listed for this session.</div>';
      return;
    }

    let active = 0;

    const main = document.createElement('div');
    main.className = 'lbMain';
    const strip = document.createElement('div');
    strip.className = 'drawerMedia';
    
    const nav = document.createElement('div');
    nav.className = 'lbNav';
    nav.innerHTML = `
      <button class="lbNavBtn" data-direction="prev" aria-label="Previous">‹</button>
      <button class="lbNavBtn" data-direction="next" aria-label="Next">›</button>
    `;

    body.appendChild(main);
    body.appendChild(nav);
    body.appendChild(strip);

    function updateActive(newIndex) {
      active = (newIndex + items.length) % items.length;
      renderMain();
      renderStrip();
    }

    function renderMain() {
      main.innerHTML = '';
      const it = items[active];
      if (!it) return;

      const mediaWrapper = document.createElement('div');
      mediaWrapper.className = 'lbMediaWrapper';
      
      if (it.type === 'video') {
        const v = document.createElement('video');
        v.className = 'lightboxMedia';
        v.controls = true;
        v.playsInline = true;
        v.setAttribute('playsinline', '');
        v.setAttribute('preload', 'metadata');
        
        // Add loading state
        const loading = document.createElement('div');
        loading.className = 'lbLoading';
        loading.textContent = 'Loading video...';
        v.appendChild(loading);
        
        attachSmartVideo(v, it.path, { 
          controls: true, 
          muted: false, 
          loop: false
        });
        
        v.onloadeddata = () => {
          loading.remove();
        };
        
        mediaWrapper.appendChild(v);
      } else {
        const img = document.createElement('img');
        img.className = 'lightboxMedia';
        img.alt = `Session ${s.id} media ${active + 1}`;
        img.loading = 'eager';
        img.style.background = 'var(--card)';
        img.style.minHeight = '200px';
        
        attachSmartImage(img, it.path);
        img.onload = () => {
          img.style.background = 'none';
        };
        
        mediaWrapper.appendChild(img);
      }
      
      main.appendChild(mediaWrapper);
      
      // Add counter
      const counter = document.createElement('div');
      counter.className = 'lbCounter';
      counter.textContent = `${active + 1} / ${items.length}`;
      main.appendChild(counter);
    }

    function renderStrip() {
      strip.innerHTML = '';
      items.forEach((it, i) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'lbThumbWrapper';
        
        const t = document.createElement(it.type === 'video' ? 'video' : 'img');
        t.className = 'thumb' + (i === active ? ' thumb--active' : '');
        t.dataset.index = i;

        if (it.type === 'video') {
          t.muted = true;
          t.loop = true;
          t.autoplay = true;
          t.playsInline = true;
          t.setAttribute('playsinline', '');
          attachSmartVideo(t, it.path, { 
            muted: true, 
            loop: true, 
            controls: false,
            preload: 'metadata'
          });
        } else {
          attachSmartImage(t, it.path);
        }

        t.addEventListener('click', (e) => {
          e.stopPropagation();
          updateActive(i);
        });

        wrapper.appendChild(t);
        strip.appendChild(wrapper);
      });
    }

    // Navigation
    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('.lbNavBtn');
      if (!btn) return;
      
      const direction = btn.dataset.direction;
      updateActive(direction === 'next' ? active + 1 : active - 1);
    });

    // Keyboard navigation
    function lbKeyHandler(e) {
      if (!lb.classList.contains('open')) {
        document.removeEventListener('keydown', lbKeyHandler);
        return;
      }
      
      if (e.key === 'ArrowLeft') {
        updateActive(active - 1);
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        updateActive(active + 1);
        e.preventDefault();
      } else if (e.key === 'Escape') {
        closeLightbox();
        document.removeEventListener('keydown', lbKeyHandler);
      }
    }

    document.addEventListener('keydown', lbKeyHandler);

    // Clean up event listener when lightbox closes
    const originalClose = closeLightbox;
    closeLightbox = function() {
      document.removeEventListener('keydown', lbKeyHandler);
      originalClose();
    };

    renderMain();
    renderStrip();
  }

  // ---------- Map ----------
  function updateMapData() {
    if (!state.map || !state.markerLayer || !window.L) return;

    state.markerLayer.clearLayers();
    state.markersBySessionId.clear();

    const idx = (state.sheetsIndex && state.sheetsIndex.sheets) ? new Map(state.sheetsIndex.sheets.map(x => [x.sheet, x])) : null;

    const pts = [];
    const heatPoints = [];
    for (const s of state.filteredSessions) {
      const lat = Number((s.geo && s.geo.lat));
      const lng = Number((s.geo && s.geo.lng));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      pts.push([lat, lng]);
      
      let weight = 1;
      const si = idx ? idx.get(s.sheetRef) : null;
      const acres = Number(coalesce(si && si.acres, (s.metrics && s.metrics.wheatAcres), 0));
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

    if (state.heatLayer && Array.isArray(heatPoints)) {
      try {
        state.heatLayer.setLatLngs(heatPoints);
      } catch (_e) {
        /* Ignore errors */
      }
    }

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
    
    if (waBtn) waBtn.addEventListener('click', () => {
      const phoneRaw = ((phoneInput && phoneInput.value) ? String(phoneInput.value).trim() : '');
      const msg = ((msgInput && msgInput.value) ? String(msgInput.value).trim() : '');
      const phone = phoneRaw.replace(/[^0-9]/g, '');
      if (!phone) {
        displayStatus('Please enter a valid phone number.', false);
        return;
      }
      const encoded = encodeURIComponent(msg);
      const waUrl = `https://wa.me/${phone}?text=${encoded}`;
      window.open(waUrl, '_blank');
      displayStatus('Opening WhatsApp…');
    });
    
    if (mailBtn) mailBtn.addEventListener('click', () => {
      const email = ((emailInput && emailInput.value) ? String(emailInput.value).trim() : '');
      const msg = ((msgInput && msgInput.value) ? String(msgInput.value).trim() : '');
      if (!email) {
        displayStatus('Please enter a valid email address.', false);
        return;
      }
      const subject = encodeURIComponent('Feedback on Harvest Horizons Dashboard');
      const body = encodeURIComponent(msg);
      const mailto = `mailto:${email}?subject=${subject}&body=${body}`;
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

    sel.value = state.campaignId || ((state.campaigns[0] && state.campaigns[0].id) ? state.campaigns[0].id : '');
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

    const sj = await fetchJson(sessionsPath, 'sessions');
    const sessions = Array.isArray(sj.sessions) ? sj.sessions : Array.isArray(sj) ? sj : [];
    
    (function assignRegions() {
      const regionMap = {
        'dadu': 'SKR',
        'daharki': 'SKR',
        'dharki': 'SKR',
        'ghotki': 'SKR',
        'jafferabad': 'SKR',
        'jaferabad': 'SKR',
        'jafarabad': 'SKR',
        'mehrabpur': 'SKR',
        'ranipur': 'SKR',
        'sukkur': 'SKR',
        'ubaro': 'SKR',
        'ubauro': 'SKR',
        'rahim yarkhan': 'RYK',
        'rahim yar khan': 'RYK',
        'rajan pur': 'RYK',
        'rajanpur': 'RYK',
        'bhakkar': 'DGK',
        'karor lal esan': 'DGK',
        'kot adu': 'DGK',
        'mianwali': 'DGK',
        'muzaffar garh': 'DGK',
        'muzaffargarh': 'DGK',
        'chakwal': 'FSD',
        'sargodha': 'FSD',
        'toba tek singh': 'FSD',
        'phalia': 'GUJ'
      };
      
      for (const s of sessions) {
        const district = String(s.district || '').toLowerCase().replace(/\s+/g, '');
        let matchedRegion = '';
        for (const [key, reg] of Object.entries(regionMap)) {
          const normKey = key.toLowerCase().replace(/\s+/g, '');
          if (district === normKey) { matchedRegion = reg; break; }
        }
        s.region = matchedRegion;
      }
    })();

    state.sessions = sessions;
    state.sessionsById = new Map(sessions.map(s => [Number(s.id), s]));

    try {
      state.sheetsIndex = await fetchJson(sheetsIndexPath, 'sheets index');
    } catch (_e) {
      state.sheetsIndex = null;
    }

    try {
      state.mediaCfg = await fetchJson(mediaPath, 'media config');
    } catch (_e) {
      state.mediaCfg = null;
    }

    const dates = sessions.map(s => parseDateSafe(s.date)).filter(Boolean);
    if (!dates.length) throw new Error('No session dates found.');
    dates.sort((a,b) => a - b);

    const cfgStart = parseDateSafe(state.campaign.startDate);
    const cfgEnd = parseDateSafe(state.campaign.endDate);

    state.dateMin = cfgStart || dates[0];
    state.dateMax = cfgEnd || dates[dates.length - 1];

    if (state.dateMin < dates[0]) state.dateMin = dates[0];
    if (state.dateMax > dates[dates.length - 1]) state.dateMax = dates[dates.length - 1];

    state.dateFrom = state.dateMin;
    state.dateTo = state.dateMax;

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
    var el_applyBtn = $$('#applyBtn'); if (el_applyBtn) el_applyBtn.addEventListener('click', applyDateInputs);
    var el_resetBtn = $$('#resetBtn'); if (el_resetBtn) el_resetBtn.addEventListener('click', resetDateInputs);
    var el_exportBtn = $$('#exportBtn'); if (el_exportBtn) el_exportBtn.addEventListener('click', exportCsv);

    var el_dateFrom = $$('#dateFrom'); if (el_dateFrom) el_dateFrom.addEventListener('change', applyDateInputs);
    var el_dateTo = $$('#dateTo'); if (el_dateTo) el_dateTo.addEventListener('change', applyDateInputs);

    var el_nameFilter = $$('#nameFilter'); if (el_nameFilter) el_nameFilter.addEventListener('input', applyDateInputs);
    var el_cityFilter = $$('#cityFilter'); if (el_cityFilter) el_cityFilter.addEventListener('input', applyDateInputs);
    var el_regionFilter = $$('#regionFilter'); if (el_regionFilter) el_regionFilter.addEventListener('input', applyDateInputs);
    var el_districtFilter = $$('#districtFilter'); if (el_districtFilter) el_districtFilter.addEventListener('input', applyDateInputs);
    var el_scoreMin = $$('#scoreMin'); if (el_scoreMin) el_scoreMin.addEventListener('input', applyDateInputs);
    var el_scoreMax = $$('#scoreMax'); if (el_scoreMax) el_scoreMax.addEventListener('input', applyDateInputs);
  }

  function exportCsv() {
    const rows = [];
    rows.push(['id','sheetRef','date','district','village','score'].join(','));
    for (const s of state.filteredSessions) {
      const row = [
        s.id,
        s.sheetRef,
        s.date,
        (s.district || '').split(',').join(' '),
        (s.village || s.spot || '').split(',').join(' '),
        ((s.score === null || s.score === undefined) ? '' : s.score)
      ];
      rows.push(row.map(x => String((x === null || x === undefined) ? '' : x).split('\n').join(' ').split('\r').join(' ')).join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${state.campaignId || 'campaign'}_sessions.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

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
      const tab = (e.detail && e.detail.tab) ? e.detail.tab : '';
      if (tab === 'map') {
        setTimeout(ensureMapReady, 50);
        setTimeout(() => (state.map && state.map.invalidateSize ? state.map.invalidateSize() : void 0), 200);
      }
    });
  }

  // ---------- Donut row auto-scroll ----------
  function initDonutRows() {
    if (window.__REDUCE_MOTION__) return;

    const rows = document.querySelectorAll('.donutRow[data-autoscroll="1"]');
    rows.forEach((row) => {
      if (row.dataset._autoBound === '1') return;
      row.dataset._autoBound = '1';

      if (row.scrollWidth <= row.clientWidth + 5) {
        row.style.overflowX = 'hidden';
        return;
      }

      const speed = Math.max(0, parseFloat(row.dataset.speed || '0.22'));
      let paused = false;
      let wheelTimer = null;
      let scrollDirection = 1;

      const step = () => {
        if (paused || document.hidden || speed <= 0) {
          requestAnimationFrame(step);
          return;
        }

        const maxScroll = row.scrollWidth - row.clientWidth;
        if (maxScroll <= 0) {
          row.style.overflowX = 'hidden';
          return;
        }

        row.scrollLeft += speed * scrollDirection;
        
        if (row.scrollLeft >= maxScroll - 2) {
          scrollDirection = -1;
          paused = true;
          setTimeout(() => { paused = false; }, 800);
        } else if (row.scrollLeft <= 2) {
          scrollDirection = 1;
          paused = true;
          setTimeout(() => { paused = false; }, 800);
        }
        
        requestAnimationFrame(step);
      };

      const pauseEvents = ['mouseenter', 'touchstart', 'pointerdown', 'focusin'];
      const resumeEvents = ['mouseleave', 'touchend', 'pointerup', 'focusout'];
      
      pauseEvents.forEach(evt => row.addEventListener(evt, () => { paused = true; }));
      resumeEvents.forEach(evt => row.addEventListener(evt, () => { 
        setTimeout(() => { paused = false; }, 100);
      }));

      row.addEventListener('wheel', (e) => {
        paused = true;
        if (wheelTimer) clearTimeout(wheelTimer);
        wheelTimer = setTimeout(() => { paused = false; }, 2000);
      }, { passive: true });

      requestAnimationFrame(step);
    });
  }

  // ---------- Boot ----------
  async function boot() {
    try {
      bindDrawer();
      bindLightbox();
      bindFeedback();
      bindTopControls();
      initDonutRows();
      bindTabEvents();

      await loadCampaignRegistry();

      const req = qs();
      const id = req.get('campaign') || ((state.campaigns[0] && state.campaigns[0].id) ? state.campaigns[0].id : '');
      renderCampaignSelect();

      await loadCampaign(id);

      syncTabFromHash();

      if (activeTabFromHash() === 'map') {
        setTimeout(ensureMapReady, 50);
      }

      closeDrawer();

      var dO = $$('#drawerOverlay'); if (dO) dO.classList.add('hidden');
      var sD = $$('#sessionDrawer'); if (sD) sD.classList.add('hidden');

      var el_lbClose = $$('#lbClose'); if (el_lbClose) el_lbClose.addEventListener('click', closeLightbox);

      // Bind map reload button
      const reloadMapBtn = document.getElementById('reloadMap');
      if (reloadMapBtn) {
        reloadMapBtn.addEventListener('click', () => {
          setMapStatus('Reloading map...', false);
          ensureMapReady();
        });
      }

      // Bind heatmap toggle
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

      setMapStatus('Ready when opened', true);

      // Performance monitoring
      window.addEventListener('load', () => {
        if ('performance' in window) {
          const perf = performance.getEntriesByType('navigation')[0];
          if (perf) {
            console.info(`[WheatCampaign] Load: ${Math.round(perf.loadEventEnd)}ms`);
          }
        }
        
        // Check if animations are supported
        const animationTest = document.createElement('div');
        document.body.appendChild(animationTest);
        const supportsAnimations = window.getComputedStyle(animationTest).animationName !== 'none';
        document.body.removeChild(animationTest);
        
        if (!supportsAnimations) {
          console.warn('[WheatCampaign] CSS animations not fully supported');
          document.documentElement.classList.add('no-animations');
        }
      });

    } catch (e) {
      console.error(e);
      setStatus(e.message || 'Failed to load.', 'bad');
    }
  }

  boot();
})();
