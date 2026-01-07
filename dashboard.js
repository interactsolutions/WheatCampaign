(() => {
  'use strict';

  // Build marker (for cache-busting verification)
  const WHEATCAMPAIGN_BUILD = "2026-01-07.2";
  console.info("[WheatCampaign] dashboard.js loaded", WHEATCAMPAIGN_BUILD);

  const REDUCE_MOTION = !!window.__REDUCE_MOTION__;
  function chartAnimation(){
    return REDUCE_MOTION ? false : { duration: 1500, easing: "easeOutBounce" };
  }


  // ---------------------------------------------------------------------------
  // Minimal Chart.js fallback
  // Many static deployments fail to load CDN dependencies. The dashboard mainly
  // needs doughnut/pie charts; this lightweight renderer keeps those sections
  // functional without external scripts.
  (function ensureMiniChart(){
    if (typeof window.Chart !== 'undefined') return;

    function parseCutout(v) {
      if (v == null) return 0.0;
      if (typeof v === 'string' && v.trim().endsWith('%')) {
        const n = parseFloat(v);
        return Number.isFinite(n) ? Math.max(0, Math.min(0.95, n / 100)) : 0.0;
      }
      const n = Number(v);
      if (!Number.isFinite(n)) return 0.0;
      // Chart.js treats numeric as pixels; we interpret as ratio when 0..1
      if (n > 0 && n < 1) return Math.max(0, Math.min(0.95, n));
      return 0.0;
    }


    function mutedColor(fallback = '#9aa4b2') {
      try {
        const v = getComputedStyle(document.documentElement).getPropertyValue('--muted2');
        const s = (v || '').trim();
        return s || fallback;
      } catch (_e) {
        return fallback;
      }
    }

    function getCanvasAndCtx(target) {
      if (!target) return { canvas: null, ctx: null };
      if (target.getContext) {
        const ctx = target.getContext('2d');
        return { canvas: target, ctx };
      }
      if (target.canvas && target.clearRect) {
        return { canvas: target.canvas, ctx: target };
      }
      return { canvas: null, ctx: null };
    }

    class MiniChart {
      constructor(target, config) {
        const { canvas, ctx } = getCanvasAndCtx(target);
        this.canvas = canvas;
        this.ctx = ctx;
        this.config = config || {};
        this._ro = null;
        this._render();
        const responsive = this.config?.options?.responsive;
        if (responsive !== false && this.canvas) this._bindResize();
      }

      _bindResize() {
        try {
          const parent = this.canvas.parentElement;
          if (!parent || typeof ResizeObserver === 'undefined') return;
          this._ro = new ResizeObserver(() => this._render());
          this._ro.observe(parent);
        } catch (_e) {}
      }

      _size() {
        const c = this.canvas;
        const ctx = this.ctx;
        if (!c || !ctx) return null;
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const w = Math.max(1, c.clientWidth || c.width || 300);
        const h = Math.max(1, c.clientHeight || c.height || 150);
        if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
          c.width = Math.round(w * dpr);
          c.height = Math.round(h * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { w, h };
      }

      _clear(w, h) {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, w, h);
      }

      _render() {
        const { canvas, ctx } = this;
        if (!canvas || !ctx) return;
        const size = this._size();
        if (!size) return;
        const { w, h } = size;
        this._clear(w, h);

        const type = String(this.config?.type || '').toLowerCase();
        const data = this.config?.data || {};
        const ds0 = (data.datasets && data.datasets[0]) ? data.datasets[0] : {};
        const values = (ds0.data || []).map(v => Number(v) || 0);
        const colors = Array.isArray(ds0.backgroundColor) ? ds0.backgroundColor : [];

        if (type === 'doughnut' || type === 'pie') {
          const total = values.reduce((a,b) => a + (Number(b) || 0), 0);
          if (!total) {
            ctx.font = '13px system-ui, -apple-system, Segoe UI, Roboto, Inter, sans-serif';
            ctx.fillStyle = mutedColor();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('No data', w / 2, h / 2);
            return;
          }

          const cx = w / 2;
          const cy = h / 2;
          const r = Math.min(w, h) * 0.42;
          const cut = type === 'doughnut' ? parseCutout(this.config?.options?.cutout) : 0;
          const rInner = r * cut;

          let start = -Math.PI / 2;
          for (let i = 0; i < values.length; i++) {
            const v = values[i];
            const ang = (v / total) * Math.PI * 2;
            if (!ang) continue;
            const end = start + ang;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, r, start, end);
            ctx.closePath();
            ctx.fillStyle = colors[i] || `hsl(${(i * 360) / Math.max(1, values.length)} 70% 55%)`;
            ctx.fill();
            start = end;
          }

          if (rInner > 0) {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
          }

          return;
        }

        // Unsupported chart type: show a small message so sections aren't blank
        ctx.font = '13px system-ui, -apple-system, Segoe UI, Roboto, Inter, sans-serif';
        ctx.fillStyle = mutedColor();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Chart', w / 2, h / 2);
      }

      update() { this._render(); }

      destroy() {
        try { this._ro?.disconnect(); } catch (_e) {}
        this._ro = null;
        if (this.canvas && this.ctx) {
          const w = this.canvas.clientWidth || this.canvas.width;
          const h = this.canvas.clientHeight || this.canvas.height;
          try { this._clear(w, h); } catch (_e) {}
        }
      }
    }

    window.Chart = MiniChart;
  })();
// Surface runtime errors in the UI (helps diagnose GitHub Pages issues)
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


  // Normalize place names for consistent display (capitalization + common typos)
  const prettyPlaceName = (v) => {
    const raw = String(v ?? '').trim();
    if (!raw) return '';
    let s = raw.replace(/\s+/g, ' ');

    const map = {
      'karor lal esan': 'Karor Lal Esan',
      'bassti maachi buchi wala': 'Basti Maachi Buchi Wala',
      'daud khail kacha': 'Daud Khail Kacha',
      'toba take singh': 'Toba Tek Singh',
    };

    const low = s.toLowerCase();
    if (map[low]) s = map[low];

    // Token-level corrections
    s = s.replace(/\bbassti\b/ig, "Basti").replace(/\bkhai[lL]\b/ig, "Khail");

    // Smart title-case: preserve ALL-CAPS and tokens with digits (e.g., 262-GB)
    s = s
      .split(' ')
      .map((w) => {
        if (!w) return w;
        if (/[0-9]/.test(w)) return w.toUpperCase();
        if (w === w.toUpperCase() && /[A-Z]/.test(w)) return w;
        return w.length === 1 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(' ');

    return s;
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

  
  // ---------- Theme helpers ----------
  function getTheme() {
    return (document.documentElement.getAttribute('data-theme') || 'dark').trim();
  }
  function cssVar(name, fallback = '') {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name);
      const s = (v || '').trim();
      return s || fallback;
    } catch (_e) {
      return fallback;
    }
  }
  function tooltipBgForTheme(t) {
    return (t === 'light') ? 'rgba(255,255,255,0.96)' : 'rgba(12,18,35,0.92)';
  }
  function registerChart(chart) {
    try {
      if (!chart) return chart;
      if (!state._charts) state._charts = new Set();
      state._charts.add(chart);
    } catch (_e) { /* ignore */ }
    return chart;
  }

  function unregisterChart(chart) {
    try {
      if (state._charts && chart) state._charts.delete(chart);
    } catch (_e) { /* ignore */ }
  }

  function applyChartTheme(chart) {
    try {
      if (!chart) return;

      const t = getTheme();
      const text = cssVar('--text', '#f0f4ff');
      const stroke = cssVar('--stroke', 'rgba(255,255,255,.12)');
      const chartBorder = cssVar('--chartBorder', 'rgba(255,255,255,.10)');

      // Chart.js: chart.options exists. MiniChart fallback also has options.
      if (chart.options) {
        chart.options.color = text;

        chart.options.plugins = chart.options.plugins || {};

        // Tooltip
        chart.options.plugins.tooltip = chart.options.plugins.tooltip || {};
        Object.assign(chart.options.plugins.tooltip, {
          backgroundColor: tooltipBgForTheme(t),
          titleColor: text,
          bodyColor: text,
          borderColor: stroke,
          borderWidth: 1
        });

        // Legend
        chart.options.plugins.legend = chart.options.plugins.legend || {};
        chart.options.plugins.legend.labels = chart.options.plugins.legend.labels || {};
        chart.options.plugins.legend.labels.color = text;

        // Title (if used)
        if (chart.options.plugins.title) {
          chart.options.plugins.title.color = text;
        }
      }

      // Dataset borders (doughnut/pie readability on both themes)
      if (chart.data && Array.isArray(chart.data.datasets)) {
        chart.data.datasets.forEach((ds) => {
          if (ds && typeof ds === 'object') {
            // Only apply if border props exist or if the dataset is a doughnut-like chart.
            if (ds.borderWidth == null) ds.borderWidth = 1;
            if (ds.borderColor == null) ds.borderColor = chartBorder;
          }
        });
      }

      // MiniChart fallback supports update(); Chart.js supports update('none')
      if (typeof chart.update === 'function') {
        try { chart.update('none'); } catch (_e) { chart.update(); }
      }
    } catch (_e) { /* ignore */ }
  }

  function applyAllChartThemes() {
    try {
      if (state._charts && typeof state._charts.forEach === 'function') {
        state._charts.forEach(applyChartTheme);
      }
      // Backward compatibility in case a chart wasn't registered.
      applyAllChartThemes();
    } catch (_e) { /* ignore */ }
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
    baseLayer: null,
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
    if (!norm || /^(https?:|data:|blob:)/i.test(norm)) return norm ? [norm] : [];

    const base = norm.replace(/\.(jpeg|jpg|png|webp|mp4|webm)$/i, '');
    const ext = (norm.split('.').pop() || '').toLowerCase();

    // Only try the most likely variants to reduce 404 noise:
    // 1) original
    // 2) gallery root fallback
    // 3) common "a" suffix variants (e.g., 17a, 17_a, 17-a)
    const cands = [norm];

    const file = norm.split('/').pop();
    if (file && !/assets\/gallery\//i.test(norm)) {
      cands.push('assets/gallery/' + file);
    }

    if (ext) {
      cands.push(base + 'a.' + ext);
      cands.push(base + '_a.' + ext);
      cands.push(base + '-a.' + ext);

      // Extension swaps (common on static sites): .jpg ↔ .jpeg
      if (ext === 'jpg') cands.push(base + '.jpeg');
      if (ext === 'jpeg') cands.push(base + '.jpg');

      // Optional: a few safe variants (kept small to avoid noisy 404s)
      if (ext === 'png') cands.push(base + '.webp');
      if (ext === 'webp') cands.push(base + '.png');
      if (ext === 'mp4') cands.push(base + '.webm');
      if (ext === 'webm') cands.push(base + '.mp4');
    }

    // de-dup
    return [...new Set(cands)];
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
    let resolved = false;

    // Always keep gesture-safe playback: resolve src eagerly (async),
    // but call play() synchronously in click handlers.
    videoEl.preload = 'metadata';
    videoEl.controls = true;
    videoEl.playsInline = true;
    videoEl.setAttribute('playsinline', '');

    (async () => {
      try {
        const chosen = await resolveFirstExisting(path);
        videoEl.src = chosen ? url(chosen) : url(placeholder);
      } catch (_e) {
        videoEl.src = url(placeholder);
      } finally {
        resolved = true;
        try { videoEl.load(); } catch (_e) {}
      }
    })();

    videoEl.addEventListener('click', () => {
      // User gesture preserved: no await in this handler.
      if (videoEl.paused) {
        const p = videoEl.play();
        if (p && typeof p.catch === 'function') {
          p.catch((err) => console.warn('[WheatCampaign] Playback blocked:', err));
        }
      }
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
    // Close transient overlays when navigating between tabs.
    closeDrawer();
    closeLightbox();
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
    // If the page already has a Leaflet CSS link (often id="leafletCss"),
    // prefer switching it to local-first instead of silently keeping a CDN-only href.
    if (document.querySelector('link[data-leaflet-css="1"]')) return;
    const hrefs = [
      'assets/leaflets/dist/leaflet.css',
      'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
      'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css'
    ];
    const existing = document.getElementById('leafletCss');
    const link = existing || document.createElement('link');
    link.rel = 'stylesheet';
    link.dataset.leafletCss = '1';
    link.href = hrefs[0];
    if (!existing) document.head.appendChild(link);

    // Best-effort fallbacks if local assets or a CDN is blocked.
    if (!link.dataset.fallbackBound) {
      link.dataset.fallbackBound = '1';
      let i = 0;
      link.onerror = () => {
        i += 1;
        if (i < hrefs.length) link.href = hrefs[i];
      };
    }
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

      // NOTE: Your repo vendors Leaflet under assets/leaflets/.
      // The file named `leaflet.js` in that bundle can be an ES module build
      // (which throws "Unexpected keyword 'export'" when loaded as a classic script).
      // `leaflet-global.js` is the UMD/global build that exposes window.L, so we
      // load it first.
      const srcs = [
        'assets/leaflets/dist/leaflet-global.js',
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
        'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
        'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'
      ];

      const start = Date.now();
      for (const src of srcs) {
        try {
          await loadScriptOnce(src);
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
    const legendColor = (getComputedStyle(document.documentElement).getPropertyValue('--text') || '#e9eef7').trim();

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

    
    // Summary progress: treat awareness as the primary "education progress" proxy.
    const progEl = $$('#summaryProgress');
    if (progEl) {
      const pctVal = Number.isFinite(awarenessAvg) ? Math.max(0, Math.min(100, Math.round(awarenessAvg))) : null;
      if (pctVal == null) {
        progEl.innerHTML = '';
      } else {
        progEl.innerHTML = `
          <div class="progressContainer">
            <div class="progressTrack"><div class="progressBar" style="width:${pctVal}%"></div></div>
            <div class="smallMuted progressNote">${pctVal}% average awareness (proxy for farmer education) across ${fmtInt(denAw)} farmer-weighted responses.</div>
          </div>`;
      }
    }

    // Push headline KPIs into the hero captions (optional, if hero slider is present).
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
        unregisterChart(window.attendanceChart);
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
          datasets: [{ data: data, backgroundColor: bgColors, borderColor: cssVar('--chartBorder', '#ffffff10'), borderWidth: 1 }]
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
      registerChart(window.attendanceChart);
    }

    // ---------- Decision breakdown pie chart ----------
    const decisionCanvas = $$('#decisionPie');
    if (decisionCanvas && typeof Chart !== 'undefined' && Array.isArray(fs)) {
      if (window.decisionChart && typeof window.decisionChart.destroy === 'function') {
        unregisterChart(window.decisionChart);
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
      registerChart(window.decisionChart);
    }

    
    // ---------- Additional breakdowns (Region / Territory / Score distribution) ----------
    // These charts were intentionally kept lightweight: computed from the current filtered set,
    // weighted by refined (sheet-index) farmers when available.
    const palette = ['#44b8ff','#6be675','#ffce56','#ff6384','#9966ff','#ff9f40','#4bc0c0','#c9cbcf','#36a2eb','#8dd1ff'];

    const farmersFor = (s) => {
      const si = idx?.get(s.sheetRef);
      const f = Number(si?.farmers_present ?? s?.metrics?.farmers ?? s?.farmers ?? 0);
      return (Number.isFinite(f) && f > 0) ? f : 0;
    };

    const normKey = (v, fallback = 'Unknown') => {
      const x = String(v ?? '').trim();
      if (!x) return fallback;
      return x.toUpperCase();
    };

    const setPlaceholder = (canvas, msg, show) => {
      const wrap = canvas?.parentElement;
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

      // Destroy prior chart instance (re-render safe)
      const prior = window[winKey];
      if (prior && typeof prior.destroy === 'function') { unregisterChart(prior); prior.destroy(); }

      const mp = new Map(); // key -> {farmers, sessions}
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

      // Nothing to show
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
            borderColor: cssVar('--chartBorder', '#ffffff10'),
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
                  const sessions = metaSessions[i] ?? 0;
                  const farmers = metaFarmers[i] ?? 0;

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
      registerChart(window[winKey]);
    };

    // Farmers by region (REG)
    renderGroupDonut('#regionPie', 'districtChart', (s) => s.district, 'No district entries yet.');

    // Farmers by territory (uses s.city in this dataset)
    renderGroupDonut('#territoryPie', 'territoryChart', (s) => s.city, 'No territory entries yet.');

    // Session score distribution (banded)
    (function renderScoreBands(){
      const canvas = $$('#scoreBandsDonut');
      if (!canvas || typeof Chart === 'undefined') return;

      if (window.scoreBandsChart && typeof window.scoreBandsChart.destroy === 'function') {
        unregisterChart(window.scoreBandsChart);
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
            borderColor: cssVar('--chartBorder', '#ffffff10'),
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
      registerChart(window.scoreBandsChart);
    })();

// ---------- Top sessions table (by score) ----------
    const topBody = $$('#topSessionsTable tbody');
    if (topBody) {
      const top = [...fs].sort((a,b) => Number(b.score||0) - Number(a.score||0)).slice(0, 8);
      topBody.innerHTML = top.map(s => {
        const sid = esc(s.id);
        const date = esc(s.date || '');
        const sheet = esc(s.sheetRef || '');
        const district = esc(prettyPlaceName(s.district) || '');
        const village = esc(prettyPlaceName(s.village || s.spot) || '');
        const score = Number.isFinite(Number(s.score)) ? fmt1(s.score) : '—';
        const scoreNum = Number(s.score||0);
        const badgeClass = scoreNum >= 85 ? 'badge badge--gold' : 'badge';
        const si = idx?.get(s.sheetRef);
        const f = si ? fmtInt(si.farmers_present) : (Number.isFinite(Number(s?.metrics?.farmers)) ? fmtInt(s.metrics.farmers) : '—');
        const a = si ? fmt1(si.acres) : (Number.isFinite(Number(s?.metrics?.wheatAcres)) ? fmt1(s.metrics.wheatAcres) : '—');
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
    // Render the top drivers and barriers as donut charts (with a compact legend).
    // Note: reason counts are multi-select; percentages shown are "share of farmers", not "share of reasons".
    const renderReasonsDonut = (mp, canvasSel, legendSel, winKey, emptyMsg, hueBase) => {
      const canvas = $$(canvasSel);
      const legend = $$(legendSel);

      if (!canvas) return;

      // If Chart.js isn't available, fall back to a readable legend/list.
      if (typeof Chart === 'undefined') {
        if (legend) legend.innerHTML = `<div class="muted">${esc(emptyMsg || 'Chart library not loaded.')}</div>`;
        return;
      }

      // Destroy prior chart instance (re-render safe)
      const prior = window[winKey];
      if (prior && typeof prior.destroy === 'function') { unregisterChart(prior); prior.destroy(); }

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

      // Top reasons + aggregate remainder
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

      // Render compact legend (keeps row alignment stable)
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

      // Build chart
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
      registerChart(window[winKey]);
    };

    renderReasonsDonut(drivers, '#driversDonut', '#driversLegend', 'driversDonutChart', 'No driver entries yet.', 200);
    renderReasonsDonut(barriers, '#barriersDonut', '#barriersLegend', 'barriersDonutChart', 'No barrier entries yet.', 12);
    // ---------- Data readiness / status ----------
    setStatus(
      `Loaded ${fmtInt(fs.length)} sessions and ${fmtInt(state.sheetsIndex?.sheets?.length || 0)} sheet summaries.\n` +
      `Reach: ${totalFarmers ? fmtInt(totalFarmers) : '—'} farmers • ${totalAcres ? fmt1(totalAcres) : '—'} acres • Est. Buctril acres: ${totalEstAcres ? fmt1(totalEstAcres) : '—'}.\n` +
      `Referenced media: ${fmtInt(imgRefs)} images • ${fmtInt(vidRefs)} videos.\n` +
      `Conversion coverage: ${denAw ? fmtInt(denAw) : '—'} farmer-weighted records (of ${totalFarmers ? fmtInt(totalFarmers) : '—'} farmers).`,
      'ok'
    );

    // Keep chart UI (tooltips/labels) aligned with the active theme.
    try {
      applyAllChartThemes();
    } catch (_e) {}
  }

  function renderSessionsTable() {
    const tbody = $$('#sessionsTable tbody');
    if (!tbody) return;

    const idx = state.sheetsIndex?.sheets ? new Map(state.sheetsIndex.sheets.map(x => [x.sheet, x])) : null;
    const legendColor = (getComputedStyle(document.documentElement).getPropertyValue('--text') || '#e9eef7').trim();

    const rows = state.filteredSessions.map(s => {
      const sid = esc(s.id);
      const date = esc(s.date || '');
      const sheet = esc(s.sheetRef || '');
      const district = esc(prettyPlaceName(s.district) || '');
      const village = esc(prettyPlaceName(s.village || s.spot) || '');
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
          <a class="btn btnSmall" href="${hrefSheet}">Sheet ${esc(s.sheetRef)}</a>
          <a class="btn btnSmall btnGhost" href="${hrefDetails}">Details ${esc(s.sheetRef)}</a>
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
        // Reset paging
        state.mediaLimit = 24;
        renderMedia();
      });

      const search = $$('#mediaSearch');
      search?.addEventListener('input', () => {
        state.mediaSearch = String(search.value || '');
        state.mediaLimit = 24;
        renderMedia();
      });

      const sort = $$('#mediaSort');
      sort?.addEventListener('change', () => {
        state.mediaSort = String(sort.value || 'newest');
        state.mediaLimit = 24;
        renderMedia();
      });

      const moreBtn = $$('#mediaLoadMore');
      moreBtn?.addEventListener('click', () => {
        state.mediaLimit = Math.max(0, Number(state.mediaLimit || 24)) + 24;
        renderMedia();
      });
    }

    const playIcon = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 7.5v9l8-4.5-8-4.5Z" fill="currentColor"/><path d="M12 2.75c5.11 0 9.25 4.14 9.25 9.25S17.11 21.25 12 21.25 2.75 17.11 2.75 12 6.89 2.75 12 2.75Z" stroke="currentColor" opacity=".35"/></svg>';
    const photoIcon = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H17.5A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19H6.5A2.5 2.5 0 0 1 4 16.5v-9Z" stroke="currentColor"/><path d="M8 11.5 10.5 14l2-2 3.5 4H6l2-4.5Z" fill="currentColor" opacity=".35"/><path d="M16.5 9a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" fill="currentColor"/></svg>';

    const q = String(state.mediaSearch || '').trim().toLowerCase();
    const type = String(state.mediaType || 'all');
    const sortMode = String(state.mediaSort || 'newest');

    const fs = Array.isArray(state.filteredSessions) ? state.filteredSessions : [];

    // Build an item-level list (not session-level) so "Images" truly shows only images.
    let items = [];
    fs.forEach((s) => {
      const media = allMediaItems(s);
      if (!media || !media.length) return;

      const district = prettyPlaceName(s.district) || '';
      const village = prettyPlaceName(s.village || s.spot) || '';

      media.forEach((it, idx) => {
        if (!it || !it.path) return;
        items.push({
          sessionId: Number(s.id),
          sheetRef: String(s.sheetRef || ''),
          date: String(s.date || ''),
          district,
          village,
          type: it.type,
          path: String(it.path),
          order: Number(idx) || 0,
          poster: (it.type === 'video') ? String(firstMediaImage(s) || '') : ''
        });
      });
    });

    // Type filter (item-level)
    if (type === 'videos') items = items.filter(it => it.type === 'video');
    if (type === 'images') items = items.filter(it => it.type === 'image');

    // Text filter
    if (q) {
      items = items.filter(it => {
        const hay = `${it.sheetRef} ${it.district} ${it.village} ${it.path}`.toLowerCase();
        return hay.includes(q);
      });
    }

    // Sort by date (stable tie-breaks)
    items.sort((a, b) => {
      const da = parseDateSafe(a.date)?.getTime() || 0;
      const db = parseDateSafe(b.date)?.getTime() || 0;
      let cmp = (sortMode === 'oldest') ? (da - db) : (db - da);
      if (cmp) return cmp;
      cmp = String(a.sheetRef || '').localeCompare(String(b.sheetRef || ''));
      if (cmp) return cmp;
      cmp = Number(a.sessionId) - Number(b.sessionId);
      if (cmp) return cmp;
      return Number(a.order || 0) - Number(b.order || 0);
    });

    const total = items.length;
    const limit = Math.max(0, Number(state.mediaLimit || 24));
    const shown = items.slice(0, limit);

    const cards = shown.map(it => {
      const sid = esc(it.sessionId);
      const sheet = esc(it.sheetRef || '');
      const district = esc(it.district || '');
      const village = esc(it.village || '');
      const title = `${sheet} • ${district} • ${village}`;
      const hrefDetails = `details.html?campaign=${encodeURIComponent(String(state.campaignId || ''))}&session=${encodeURIComponent(String(it.sessionId))}`;

      const primaryType = it.type;
      const path = esc(it.path);
      const poster = esc(it.poster || '');

      let thumb;
      let badge;
      if (primaryType === 'video') {
        thumb = `<video data-media-vid="1" preload="metadata" muted playsinline></video>`;
        badge = `<div class="mediaBadge" title="Video">${playIcon}<span>Video</span></div>`;
      } else {
        thumb = `<img data-media-thumb="1" alt="${esc(title)}" loading="lazy" decoding="async" />`;
        badge = `<div class="mediaBadge" title="Image">${photoIcon}<span>Image</span></div>`;
      }

      return `<div class="mediaCard" data-session-id="${sid}" data-primary-type="${primaryType}" data-media-path="${path}" data-poster-path="${poster}">
        <div class="mediaThumb">
          ${badge}
          ${thumb}
        </div>
        <div class="mediaMeta">
          <div class="mediaTitle">${esc(title)}</div>
          <div class="mediaSub smallMuted">${esc(it.date || '')}</div>
          <div class="mediaActions">
            <a class="btn btnSmall" href="sheets.html?campaign=${encodeURIComponent(String(state.campaignId || ''))}&sheet=${encodeURIComponent(String(it.sheetRef || ''))}">Sheet ${sheet}</a>
            <a class="btn btnSmall btnGhost" href="${hrefDetails}">Details ${sheet}</a>
            <button class="btn btnSmall btnGhost" data-action="open" type="button">Open</button>
          </div>
        </div>
      </div>`;
    });

    grid.innerHTML = cards.join('');

    // Update count + load more button
    const countEl = $$('#mediaCount');
    if (countEl) countEl.textContent = total ? `Showing ${Math.min(limit, total)} of ${total}` : 'No media for current filters';
    const moreBtn = $$('#mediaLoadMore');
    if (moreBtn) moreBtn.style.display = (limit < total) ? '' : 'none';

    // Attach image thumbs
    $$$('[data-media-thumb="1"]', grid).forEach(img => {
      const card = img.closest('.mediaCard');
      const p = card?.dataset.mediaPath || '';
      attachSmartImage(img, p || 'assets/placeholder.svg');
    });

    // Attach video thumbs
    $$$('[data-media-vid="1"]', grid).forEach(v => {
      const card = v.closest('.mediaCard');
      const p = card?.dataset.mediaPath || '';
      attachSmartVideo(v, p || 'assets/placeholder-video.mp4');
      // thumbnails should not show full controls
      try { v.controls = false; } catch (_e) {}
      // Prefer a poster (first session image) to avoid a black rectangle while metadata loads.
      const poster = card?.dataset.posterPath || '';
      if (poster) {
        resolveFirstExisting(poster).then((chosen) => {
          if (chosen) {
            try { v.poster = url(chosen); } catch (_e) {}
          }
        }).catch(() => {});
      }
    });

    grid.onclick = (ev) => {
      const card = ev.target.closest('.mediaCard[data-session-id]');
      if (!card) return;
      if (ev.target.closest('a')) return;

      const sid = Number(card.dataset.sessionId);
      // Open lightbox, respecting the active media filter (Images/Videos/All)
      const mode = String(state.mediaType || 'all');
      const startType = card.dataset.primaryType || null;
      const startPath = card.dataset.mediaPath || null;
      openLightbox(sid, mode, startType, startPath);
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
    if (lb) lb.classList.add('hidden');
    if (lb) lb.setAttribute('aria-hidden', 'true');

    const frame = $$('#lightboxFrame');
    if (frame) frame.src = '';
  }

  function bindLightbox() {
    $$('#lbClose')?.addEventListener('click', closeLightbox);
    $$('#lightbox')?.addEventListener('click', (ev) => {
      if (ev.target && ev.target.id === 'lightbox') closeLightbox();
    });
  }

  async function openLightbox(sessionId, mode = 'all', startType = null, startPath = null) {
    const s = state.sessionsById.get(Number(sessionId));
    if (!s) return;

    const lb = $$('#lightbox');
    const body = $$('#lbBody');
    if (!lb || !body) return;

    const titleEl = $$('#lbTitle');
    if (titleEl) titleEl.textContent = 'Session ' + String(s.id) + (s.sheetRef ? (' • ' + String(s.sheetRef)) : '');

    lb.classList.add('open');
    body.innerHTML = '';

    let items = allMediaItems(s);

    // Respect active filter from the Media tab.
    const m = String(mode || 'all');
    if (m === 'images') items = items.filter(it => it.type === 'image');
    if (m === 'videos') items = items.filter(it => it.type === 'video');

    if (!items || !items.length) {
      body.innerHTML = '<div class="muted">No media for the selected filter.</div>';
      return;
    }

let active = 0;

    // If we opened from a specific media item (e.g., in the Media grid), start there.
    const sp = (startPath ? String(startPath) : '').trim();
    if (sp) {
      const idxPath = items.findIndex(it => String(it.path || '') === sp);
      if (idxPath >= 0) active = idxPath;
    } else {
      // Fallback: start at matching media type (only meaningful in "all" mode).
      if (m === 'all' && (startType === 'image' || startType === 'video')) {
        const idxType = items.findIndex(it => it.type === startType);
        if (idxType >= 0) active = idxType;
      }
    }

    const main = document.createElement('div');
    main.className = 'lbMain';
    const strip = document.createElement('div');
    strip.className = 'drawerMedia';

    body.appendChild(main);
    body.appendChild(strip);

    function renderMain() {
      main.innerHTML = '';
      const it = items[active];
      if (!it) return;

      if (it.type === 'video') {
        const v = document.createElement('video');
        v.className = 'lightboxMedia';
        v.controls = true;
        v.playsInline = true;
        v.setAttribute('playsinline', '');
        v.preload = 'metadata';

        // Resolve src eagerly, but keep playback gesture-safe (no await in click).
        attachSmartVideo(v, it.path);

        // Attempt autoplay (may be blocked; user can press play).
        setTimeout(() => {
          const p = v.play();
          if (p && typeof p.catch === 'function') {
            p.catch(() => {
              v.muted = true;
              v.play().catch(() => {});
            });
          }
        }, 0);

        main.appendChild(v);
      } else {
        const img = document.createElement('img');
        img.className = 'lightboxMedia';
        img.alt = `Session ${s.id} media ${active + 1}`;
        img.loading = 'eager';
        attachSmartImage(img, it.path);
        main.appendChild(img);
      }

      const cap = document.createElement('div');
      cap.className = 'lbCaption';
      cap.innerHTML = `<div class="smallMuted">${active + 1} / ${items.length}</div>`;
      main.appendChild(cap);
    }

    function renderStrip() {
      strip.innerHTML = '';
      items.forEach((it, i) => {
        const t = document.createElement(it.type === 'video' ? 'video' : 'img');
        t.className = 'thumb' + (i === active ? ' thumb--active' : '');
        t.dataset.index = String(i);

        if (it.type === 'video') {
          t.muted = true;
          t.loop = false;
          t.autoplay = false;
          t.playsInline = true;
          t.setAttribute('playsinline', '');
          attachSmartVideo(t, it.path);
        } else {
          attachSmartImage(t, it.path);
        }

        t.addEventListener('click', (e) => {
          e.stopPropagation();
          active = i;
          renderMain();
          renderStrip();
        });

        strip.appendChild(t);
      });
    }

    renderMain();
    renderStrip();
  }

  // ---------- Map ----------
  function makeBasemapLayer(theme) {
    const t = (theme === 'light') ? 'light' : 'dark';
    const url = (t === 'light')
      ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    const attribution = (t === 'light')
      ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
    return window.L.tileLayer(url, { maxZoom: 18, attribution });
  }

  function applyMapTheme(theme) {
    try {
      if (!state.map || !window.L) return;
      const t = (theme === 'light') ? 'light' : 'dark';
      if (state.baseLayer) {
        try { state.map.removeLayer(state.baseLayer); } catch (_e) {}
        state.baseLayer = null;
      }
      state.baseLayer = makeBasemapLayer(t).addTo(state.map);
    } catch (_e) { /* ignore */ }
  }

  async function ensureMapReady() {
    const el = $$('#leafletMap');
    if (!el) return;

    setMapStatus('Loading map…', false);

    try {
      // Prefer the robust loader injected from index.html if present.
      if (typeof window.loadLeaflet === 'function') {
        const ok = await window.loadLeaflet();
        if (!ok) throw new Error('Leaflet failed to load');
      } else {
        const ok = await ensureLeafletReady({ timeoutMs: 12000 });
        if (!ok) throw new Error('Leaflet failed to load');
      }

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

      state.baseLayer = makeBasemapLayer(getTheme()).addTo(map);

      if (window.L.heatLayer) {
        state.heatLayer = window.L.heatLayer([], { radius: 25, blur: 15, maxZoom: 18 });
      }

      updateMapData();
      setMapStatus('Ready', true);

      setTimeout(() => map.invalidateSize(true), 100);
      setTimeout(() => map.invalidateSize(true), 500);
    } catch (e) {
      console.error('Map failed:', e);
      setMapStatus('Map unavailable - check network', false);
      const mf = $$('#mapFallback');
      if (mf) {
        mf.classList.remove('hidden');
        mf.innerHTML = `
          <div style="padding: 20px; text-align: center;">
            <div style="color: var(--warn); margin-bottom: 10px;">⚠️ Map cannot load</div>
            <div class="smallMuted">
              Use the Sessions table below for navigation.<br>
              <button class="btn btnSmall" onclick="location.reload()">Retry</button>
            </div>
          </div>`;
      }
    }
  }

  function updateMapData() {
    if (!state.map || !state.markerLayer || !window.L) return;

    state.markerLayer.clearLayers();
    state.markersBySessionId.clear();

    // Build a quick lookup of sheet metadata to obtain farmers and acreage.
    const idx = state.sheetsIndex?.sheets ? new Map(state.sheetsIndex.sheets.map(x => [x.sheet, x])) : null;
    const legendColor = (getComputedStyle(document.documentElement).getPropertyValue('--text') || '#e9eef7').trim();

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
            <a class="btn btnSmall btnGhost" href="${detailsUrl}">Details ${esc(s.sheetRef)}</a>
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

  
  // ---------- Donut row auto-scroll ----------
  // Creates a subtle horizontal auto-scroll for donut rows, and pauses on mouse-over / interaction.
  function initDonutRows() {
    if (window.__REDUCE_MOTION__) return;

    const rows = document.querySelectorAll('.donutRow[data-autoscroll="1"]');
    rows.forEach((row) => {
      if (row.dataset._autoBound === '1') return;
      row.dataset._autoBound = '1';

      // Ensure single-line layout and avoid snap fighting the animation
      try {
        row.style.flexWrap = 'nowrap';
        row.style.scrollSnapType = 'none';
      } catch (_e) {}

      // If not scrollable, nothing to animate.
      const initialWidth = row.scrollWidth;
      if (initialWidth <= row.clientWidth + 8) return;

      // Duplicate the row content once to create a seamless loop.
      if (row.dataset._cloned !== '1') {
        const children = Array.from(row.children);
        children.forEach((ch) => {
          const clone = ch.cloneNode(true);
          clone.dataset._clone = '1';
          clone.setAttribute('aria-hidden', 'true');
          row.appendChild(clone);
        });
        row.dataset._cloned = '1';
      }

      const loopPoint = initialWidth; // scrollLeft wraps at the original width
      const speed = Math.max(0, parseFloat(row.dataset.speed || '0.22')); // px per frame (≈60fps)

      let paused = false;
      let last = performance.now();

      // Pause only when user interacts or hovers an actual tile.
      const pauseEvents = ['touchstart', 'pointerdown', 'focusin', 'wheel'];
      const resumeEvents = ['touchend', 'pointerup', 'focusout'];

      pauseEvents.forEach(evt => row.addEventListener(evt, () => { paused = true; }, { passive: true }));
      resumeEvents.forEach(evt => row.addEventListener(evt, () => {
        setTimeout(() => { paused = false; }, 120);
      }, { passive: true }));

      const bindTileHover = () => {
        const tiles = row.querySelectorAll('.chartTile');
        tiles.forEach((tile) => {
          if (tile.dataset._hoverBound === '1') return;
          tile.dataset._hoverBound = '1';
          tile.addEventListener('mouseenter', () => { paused = true; }, { passive: true });
          tile.addEventListener('pointerenter', () => { paused = true; }, { passive: true });
          tile.addEventListener('mouseleave', () => { setTimeout(() => { paused = false; }, 120); }, { passive: true });
          tile.addEventListener('pointerleave', () => { setTimeout(() => { paused = false; }, 120); }, { passive: true });
        });
      };
      bindTileHover();

      const step = (now) => {
        const dt = Math.max(0, now - last);
        last = now;

        if (!paused) {
          // Convert "px per frame" to "px per ms"
          const delta = speed * (dt / 16.6667);
          row.scrollLeft += delta;

          // Seamless wrap
          if (row.scrollLeft >= loopPoint) {
            row.scrollLeft -= loopPoint;
          }
        }

        requestAnimationFrame(step);
      };

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

      // React to theme changes (light/dark) without a full reload.
      document.addEventListener('themechange', (ev) => {
        const t = ev?.detail?.theme || getTheme();
        applyMapTheme(t);
        try {
          applyAllChartThemes();
        } catch (_e) {}
      });

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
