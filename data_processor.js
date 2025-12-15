/* AgriVista Dashboard - single file controller
   - Prefers sessions.json (fast, small; no Git LFS issues)
   - Falls back to XLSX parsing (Buctril_Super_Activations.xlsx) if sessions.json missing
   - Media reads media.json (A_compact format) and auto-falls back to placeholder when assets are missing
*/

(() => {
  'use strict';

  // ---------------------------
  // Config (you can edit safely)
  // ---------------------------
  const CONFIG = {
    sessionsJson: 'sessions.json',
    mediaJson: 'media.json',
    xlsxFallback: 'Buctril_Super_Activations.xlsx',
    heroVideo: 'assets/bg.mp4',
    placeholder: 'assets/placeholder.svg',
    maxShowcase: 5,
    maxGallery: 48
  };

  // ---------------------------
  // DOM helpers
  // ---------------------------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const el = {
    shell: $('#appShell'),
    overlay: $('#loadingOverlay'),
    status: $('#loadingStatus'),
    buildStamp: $('#buildStamp'),
    err: $('#errorContainer'),
    notice: $('#noticeBox'),
    diag: $('#diagBox'),
    summary: $('#filterSummary'),

    filterCity: $('#filter-city'),
    filterSpot: $('#filter-district') || $('#filter-spot'),
    filterFrom: $('#filter-date-from'),
    filterTo: $('#filter-date-to'),
    filterSearch: $('#filter-search'),

    btnExport: $('#btn-export'),
    btnReset: $('#btn-reset'),

    kpiSessions: $('#kpi-sessions'),
    kpiFarmers: $('#kpi-farmers'),
    kpiAcres: $('#kpi-acres'),
    kpiDemo: $('#kpi-demo'),
    barSessions: $('#bar-sessions'),
    barFarmers: $('#bar-farmers'),
    barAcres: $('#bar-acres'),
    barDemo: $('#bar-demo'),

    snapshot: $('#snapshot'),
    snapShowcase: $('#snapshotShowcase'),
    reasonUse: $('#reasonUse'),
    reasonNo: $('#reasonNo'),

    chartCity: $('#chartCity'),
    chartIntent: $('#chartIntent'),
    chartTrend: $('#chartTrend'),

    mapWrap: $('#map'),
    mapLegend: $('#mapLegend'),
    mapSelTitle: $('#mapSelTitle'),
    mapSelFarmers: $('#mapSelFarmers'),
    mapSelAcres: $('#mapSelAcres'),
    mapSelDate: $('#mapSelDate'),
    mapShowcase: $('#mapShowcase'),

    gallery: $('#galleryGrid'),
    gallerySummary: $('#gallerySummary'),
    tbl: $('#tblSessions'),

    heroVideo: $('#heroVideo'),

    // Lightbox
    lb: $('#lightbox'),
    lbMedia: $('#lbMedia'),
    lbCaption: $('#lbCaption'),
    lbTranscript: $('#lbTranscript'),
    lbPrev: $('#lbPrev'),
    lbNext: $('#lbNext'),
    lbClose: $('#lbClose'),
    lbNav: $('.lbNav'),
    lbHint: $('#lbHint')
  };

  function setLoadingStatus(msg) {
    if (el.status) el.status.textContent = msg;
  }
  function setNotice(html) {
    if (!el.notice) return;
    el.notice.innerHTML = html;
  }
  function setDiag(lines) {
    if (el.diag) el.diag.textContent = lines.join('\n');
  }
  function showError(html) {
    if (!el.err) return;
    el.err.style.display = 'block';
    el.err.innerHTML = html;
  }
  function clearError() {
    if (!el.err) return;
    el.err.style.display = 'none';
    el.err.innerHTML = '';
  }

  const escapeHtml = (unsafe) => {
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  };

  const fmt = {
    int: (n) => (n === null || n === undefined || isNaN(n)) ? '—' : Math.round(n).toLocaleString(),
    num: (n, d=1) => (n === null || n === undefined || isNaN(n)) ? '—' : Number(n).toFixed(d),
    pct: (n, d=0) => (n === null || n === undefined || isNaN(n)) ? '—' : `${Number(n).toFixed(d)}%`,
    date: (iso) => {
      if (!iso) return '—';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      return d.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'2-digit' });
    }
  };

  // ---------------------------
  // State
  // ---------------------------
  const state = {
    sessions: [],
    filtered: [],
    mediaItems: [],
    mediaBySessionId: new Map(), // sessionId -> media[]
    pinnedSession: null,
    uniqueCities: [],
    uniqueSpots: [],
    uniqueDates: [],

    map: null,
    circles: [],
    charts: { city:null, intent:null, trend:null },
    lightbox: { items: [], index: 0 }
  };

  // ---------------------------
  // Utilities
  // ---------------------------
  function uniq(arr) { return Array.from(new Set(arr.filter(Boolean))); }
  function safeStr(v) { return (v === null || v === undefined) ? '' : String(v).trim(); }

  function parseISO(d) {
    if (!d) return null;
    const dt = new Date(d);
    // Check if valid date and not just "Invalid Date" from a non-date string
    return isNaN(dt.getTime()) || String(d).length < 8 ? null : dt;
  }

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function toCsv(rows, cols) {
    const esc = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      if (/[,"\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
      return s;
    };
    const header = cols.map(c => esc(c.label)).join(',');
    const lines = rows.map(r => cols.map(c => esc(c.get(r))).join(','));
    return [header, ...lines].join('\n');
  }

  function downloadText(filename, text, mime='text/plain') {
    const blob = new Blob([text], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  function inferBasePath() {
    // Works for GitHub Pages under /repo/
    const u = new URL('.', window.location.href);
    return u.pathname.endsWith('/') ? u.pathname : (u.pathname + '/');
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const text = await res.text();
    // Detect Git LFS pointer
    if (text.includes('version https://git-lfs.github.com/spec/v1')) {
      const msg = `Git LFS pointer detected for ${url}. GitHub Pages is serving the pointer text, not the real file.`;
      const e = new Error(msg);
      e.code = 'LFS_POINTER';
      throw e;
    }
    return JSON.parse(text);
  }

  async function fetchArrayBuffer(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.arrayBuffer();
  }

  // ---------------------------
  // Data Loading & Processing
  // ---------------------------

  function transformSession(s) {
    // Clean up and standardize the session object
    const sn = safeStr(s.sn);
    const id = safeStr(s.id || sn);
    const city = safeStr(s.city);
    const spot = safeStr(s.spot);
    const farmers = (s.farmers === '' ? null : Number(s.farmers));
    const acres = (s.acres === '' ? null : Number(s.acres));
    const definite = (s.definite === '' ? null : Number(s.definite));
    const maybe = (s.maybe === '' ? null : Number(s.maybe));
    const notInterested = (s.notInterested === '' ? null : Number(s.notInterested));
    const reasonsUse = safeStr(s.reasonsUse);
    const reasonsNo = safeStr(s.reasonsNo);

    // Standardize percentage calculations (if they weren't pre-calculated)
    const definitePct = s.definitePct !== undefined ? Number(s.definitePct) : (farmers > 0 ? (definite / farmers * 100) : null);
    const awarenessPct = s.awarenessPct !== undefined ? Number(s.awarenessPct) : null;
    const clarityPct = s.clarityPct !== undefined ? Number(s.clarityPct) : null;

    let lat = Number(s.lat);
    let lon = Number(s.lon);
    if (isNaN(lat) || isNaN(lon)) {
      lat = null;
      lon = null;
    }

    return {
      sn: sn, // Session Number (for grouping media/sessions)
      id: id, // Unique Session ID (if different from SN)
      date: safeStr(s.date),
      city: city,
      spot: spot,
      farmers: farmers,
      acres: acres,
      definite: definite,
      maybe: maybe,
      notInterested: notInterested,
      definitePct: definitePct,
      awarenessPct: awarenessPct,
      clarityPct: clarityPct,
      lat: lat,
      lon: lon,
      reasonsUse: reasonsUse,
      reasonsNo: reasonsNo,
    };
  }

  async function loadSessionsJson(url) {
    setLoadingStatus(`Loading ${CONFIG.sessionsJson}...`);
    logDiag(`Attempting to fetch ${url}`);
    const data = await fetchJson(url);
    if (!data.sessions || !Array.isArray(data.sessions)) {
      throw new Error(`Invalid format in ${CONFIG.sessionsJson}. Expected array 'sessions'.`);
    }

    return data.sessions.map(transformSession).filter(s => s.date && s.sn);
  }

  async function loadSessionsXlsx(url) {
    if (typeof XLSX === 'undefined') {
      throw new Error('SheetJS (XLSX) library not loaded. Cannot use XLSX fallback.');
    }
    setLoadingStatus(`Loading ${CONFIG.xlsxFallback} (large file, may take time)...`);
    logDiag(`Attempting to fetch ${url}`);
    const arrayBuffer = await fetchArrayBuffer(url);
    const data = new Uint8Array(arrayBuffer);
    const wb = XLSX.read(data, { type: 'array' });

    // Try to find sheet named 'SUM' or just use the first one
    const sheetName = wb.SheetNames.find(n => String(n).toLowerCase() === 'sum') || wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    if (!sheet) throw new Error('XLSX: SUM sheet not found.');

    // Convert sheet to JSON array of arrays
    const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });

    if (!rawData || rawData.length < 2) throw new Error('XLSX sheet is empty.');

    // Standardize headers (assuming the 2nd row is the header)
    const headers = rawData[1].map(h => String(h || '').trim());
    const headerMap = {
      'SN': 'sn',
      'Activity Date': 'date',
      'City': 'city',
      'Village / Mauza': 'spot',
      'No. of Farmers': 'farmers',
      'Total Acres (in 000)': 'acres',
      'Definite to Use': 'definite',
      'May Use': 'maybe',
      'Not Interested': 'notInterested',
      'Reasons to Use': 'reasonsUse',
      'Reasons Not to Use': 'reasonsNo',
      'Lat (Decimal)': 'lat',
      'Long (Decimal)': 'lon',
      // Include any other keys needed from the sheet and map them to standard session properties
    };

    const sessions = [];
    // Start from the third row (index 2)
    for (let i = 2; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || !row.length) continue;

      const session = {};
      let hasData = false;
      for (let j = 0; j < headers.length; j++) {
        const key = headers[j];
        const prop = headerMap[key];
        if (prop) {
          const val = row[j];
          session[prop] = val;
          if (val) hasData = true;
        }
      }

      if (hasData) {
        sessions.push(transformSession(session));
      }
    }

    if (!sessions.length) throw new Error('XLSX: Could not extract any valid sessions.');

    logDiag(`XLSX loaded: ${sessions.length} sessions`);
    return sessions;
  }

  async function loadMedia(sessions) {
    setLoadingStatus(`Loading ${CONFIG.mediaJson}...`);
    logDiag(`Attempting to fetch ${CONFIG.mediaJson}`);

    const basePath = inferBasePath();
    const mediaPath = `${basePath}${CONFIG.mediaJson}`;

    try {
      const data = await fetchJson(mediaPath);

      if (data.format !== 'A_compact') {
        throw new Error(`media.json has unsupported format: ${data.format}`);
      }

      const mediaItems = [];
      const mediaBasePath = `${basePath}${data.basePath}`;
      const defaults = data.defaults;

      // Ensure sessions are unique by 'id' to avoid media duplication
      const uniqueSessions = new Set();
      for (const s of sessions) {
        uniqueSessions.add(s.sn);
      }

      for (const s of data.sessions) {
        const id = safeStr(s.id);
        if (!id || !uniqueSessions.has(id)) continue;

        const caption = safeStr(s.caption) || `Session ${id}`;
        const transcript = safeStr(s.transcript);
        const city = safeStr(s.city);
        const spot = safeStr(s.spot);
        const date = safeStr(s.date);

        // 1. Main video + image
        const mainVideoExt = safeStr(s.mainVideoExt || defaults.mainVideoExt);
        const mainImageExt = safeStr(s.mainImageExt || defaults.mainImageExt);

        mediaItems.push({
          sessionId: id, type: 'video',
          src: `${mediaBasePath}${id}.${mainVideoExt}`, caption, transcript, city, spot, date
        });
        mediaItems.push({
          sessionId: id, type: 'image',
          src: `${mediaBasePath}${id}.${mainImageExt}`, caption, transcript, city, spot, date
        });

        // 2. Variant images/videos
        const variants = s.variants || defaults.variants || [];
        const variantImageExt = safeStr(s.variantImageExt || defaults.variantImageExt);
        const variantVideoExt = safeStr(s.variantVideoExt || defaults.variantVideoExt);

        for (const v of variants) {
          mediaItems.push({
            sessionId: id, type: 'image', variant: v,
            src: `${mediaBasePath}${id}-${v}.${variantImageExt}`, caption: `${caption} (${v.toUpperCase()})`, transcript: '', city, spot, date
          });
          mediaItems.push({
            sessionId: id, type: 'video', variant: v,
            src: `${mediaBasePath}${id}-${v}.${variantVideoExt}`, caption: `${caption} (${v.toUpperCase()})`, transcript: '', city, spot, date
          });
        }
      }

      // Group media items by session ID
      const mediaBySessionId = new Map();
      for (const item of mediaItems) {
        if (!mediaBySessionId.has(item.sessionId)) {
          mediaBySessionId.set(item.sessionId, []);
        }
        mediaBySessionId.get(item.sessionId).push(item);
      }

      state.mediaBySessionId = mediaBySessionId;
      return mediaItems.filter(item => item.src);

    } catch (e) {
      logDiag(`Media load error: ${e.message}`);
      setNotice(`<strong>Status:</strong> Media index load error. Gallery/Showcase disabled. (${e.code || e.name})`);
      return [];
    }
  }

  // ---------------------------
  // Calculations
  // ---------------------------
  function sum(arr, fn) {
    return arr.reduce((acc, curr) => {
      const v = fn(curr);
      return acc + (typeof v === 'number' && !isNaN(v) ? v : 0);
    }, 0);
  }

  function mean(arr, fn) {
    const vals = arr.map(fn).filter(v => typeof v === 'number' && !isNaN(v));
    if (!vals.length) return null;
    return vals.reduce((a,b)=>a+b,0) / vals.length;
  }

  function setBar(elBar, valuePct) {
    if (!elBar) return;
    const w = clamp(valuePct || 0, 0, 100);
    elBar.style.width = `${w}%`;
  }

  function computeKpis(rows) {
    const totalSessions = new Set(rows.map(r => r.sn).filter(Boolean)).size;
    const totalFarmers = sum(rows, r => r.farmers);
    const totalAcres = sum(rows, r => r.acres);
    const definiteIntent = sum(rows, r => r.definite);
    const definiteIntentPct = totalFarmers > 0 ? (definiteIntent / totalFarmers * 100) : null;

    const definitePctMean = mean(rows, r => r.definitePct);
    const awarenessPctMean = mean(rows, r => r.awarenessPct);
    const clarityPctMean = mean(rows, r => r.clarityPct);

    if (el.kpiSessions) el.kpiSessions.textContent = fmt.int(totalSessions);
    if (el.kpiFarmers) el.kpiFarmers.textContent = fmt.int(totalFarmers);
    if (el.kpiAcres) el.kpiAcres.textContent = fmt.int(totalAcres);
    if (el.kpiDemo) el.kpiDemo.textContent = definiteIntentPct !== null ? fmt.pct(definiteIntentPct) : '—';

    // Set bar widths (compared to the max of all sessions)
    const maxSessions = new Set(state.sessions.map(r => r.sn).filter(Boolean)).size;
    const maxFarmers = sum(state.sessions, r => r.farmers);
    const maxAcres = sum(state.sessions, r => r.acres);

    setBar(el.barSessions, maxSessions > 0 ? (totalSessions / maxSessions * 100) : 0);
    setBar(el.barFarmers, maxFarmers > 0 ? (totalFarmers / maxFarmers * 100) : 0);
    setBar(el.barAcres, maxAcres > 0 ? (totalAcres / maxAcres * 100) : 0);
    setBar(el.barDemo, definiteIntentPct); // Relative to 100%
  }

  function computeReasons(rows) {
    const reasonUseMap = new Map();
    const reasonNoMap = new Map();

    for (const r of rows) {
      if (r.reasonsUse) {
        r.reasonsUse.split(';').map(s => safeStr(s)).filter(Boolean).forEach(reason => {
          reasonUseMap.set(reason, (reasonUseMap.get(reason) || 0) + 1);
        });
      }
      if (r.reasonsNo) {
        r.reasonsNo.split(';').map(s => safeStr(s)).filter(Boolean).forEach(reason => {
          reasonNoMap.set(reason, (reasonNoMap.get(reason) || 0) + 1);
        });
      }
    }

    const sortAndTake = (map) => Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, count]) => `<li>${reason} (${count} sessions)</li>`).join('');

    if (el.reasonUse) el.reasonUse.innerHTML = sortAndTake(reasonUseMap) || '<li>No data in filter.</li>';
    if (el.reasonNo) el.reasonNo.innerHTML = sortAndTake(reasonNoMap) || '<li>No data in filter.</li>';
  }

  // ---------------------------
  // Filtering & UI Updates
  // ---------------------------

  function populateFilters() {
    state.uniqueCities = uniq(state.sessions.map(s => s.city)).sort();
    state.uniqueDates = uniq(state.sessions.map(s => s.date)).map(parseISO).filter(Boolean).sort((a,b) => a.getTime() - b.getTime());

    const cityOptions = state.uniqueCities.map(c => `<option value="${c}">${c}</option>`).join('');
    if (el.filterCity) el.filterCity.innerHTML = `<option value="">All Cities (${state.uniqueCities.length})</option>${cityOptions}`;

    // Spot/District options will be dynamically populated upon city selection
  }

  function handleCityFilterChange() {
    const selectedCity = el.filterCity.value;
    const spots = selectedCity
      ? uniq(state.sessions.filter(s => s.city === selectedCity).map(s => s.spot)).sort()
      : [];

    state.uniqueSpots = spots;
    const spotOptions = spots.map(s => `<option value="${s}">${s}</option>`).join('');
    if (el.filterSpot) el.filterSpot.innerHTML = `<option value="">All Spots (${spots.length})</option>${spotOptions}`;
    applyFilters();
  }

  function applyFilters() {
    let rows = state.sessions;

    const city = el.filterCity?.value;
    const spot = el.filterSpot?.value;
    const from = el.filterFrom?.value;
    const to = el.filterTo?.value;
    const q = el.filterSearch?.value.toLowerCase().trim();

    if (city) {
      rows = rows.filter(r => r.city === city);
    }
    if (spot) {
      rows = rows.filter(r => r.spot === spot);
    }

    const fromDt = parseISO(from);
    const toDt = parseISO(to);

    if (fromDt && !isNaN(fromDt.getTime())) {
      rows = rows.filter(r => {
        const d = parseISO(r.date);
        return d ? (d.getTime() >= fromDt.getTime()) : true;
      });
    }
    if (toDt && !isNaN(toDt.getTime())) {
      // inclusive end (end of day)
      const end = new Date(toDt.getTime() + 24*3600*1000 - 1);
      rows = rows.filter(r => {
        const d = parseISO(r.date);
        return d ? (d.getTime() <= end.getTime()) : true;
      });
    }

    if (q) {
      rows = rows.filter(r => {
        return (r.city?.toLowerCase().includes(q) ||
                r.spot?.toLowerCase().includes(q) ||
                r.date?.toLowerCase().includes(q) ||
                r.reasonsUse?.toLowerCase().includes(q) ||
                r.reasonsNo?.toLowerCase().includes(q));
      });
    }

    state.filtered = rows;

    // Update UI components
    updateSummary(rows);
    computeKpis(rows);
    computeReasons(rows);
    renderCharts(rows);
    updateMapMarkers(rows);
    updateSessionTable(rows);
    buildGallery(rows);

    // If pinned session is filtered out, unpin it
    if (state.pinnedSession && !rows.includes(state.pinnedSession)) {
      unpinSession();
    }
  }

  function updateSummary(rows) {
    if (!el.summary) return;
    const city = el.filterCity?.value;
    const spot = el.filterSpot?.value;
    const from = el.filterFrom?.value;
    const to = el.filterTo?.value;
    const q = el.filterSearch?.value;

    let summary = 'All Sessions';
    const parts = [];
    if (city) parts.push(city);
    if (spot) parts.push(spot);
    if (from && to) parts.push(`${fmt.date(from)} - ${fmt.date(to)}`);
    else if (from) parts.push(`From ${fmt.date(from)}`);
    else if (to) parts.push(`Up to ${fmt.date(to)}`);
    if (q) parts.push(`Search: "${q}"`);

    if (parts.length > 0) {
      summary = parts.join(' • ');
    }

    el.summary.textContent = `${rows.length} Sessions | ${summary}`;
  }

  function resetFilters() {
    el.filterCity.value = '';
    if (el.filterSpot) el.filterSpot.innerHTML = '<option value="">All Spots</option>';
    if (el.filterFrom) el.filterFrom.value = '';
    if (el.filterTo) el.filterTo.value = '';
    if (el.filterSearch) el.filterSearch.value = '';
    handleCityFilterChange(); // Will also call applyFilters()
  }

  function setupEventListeners() {
    el.filterCity?.addEventListener('change', handleCityFilterChange);
    el.filterSpot?.addEventListener('change', applyFilters);
    el.filterFrom?.addEventListener('change', applyFilters);
    el.filterTo?.addEventListener('change', applyFilters);
    el.filterSearch?.addEventListener('input', debounce(applyFilters, 300));

    el.btnReset?.addEventListener('click', resetFilters);
    el.btnExport?.addEventListener('click', exportFilteredData);

    $$('.tabs button').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        $$('.tabs button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        $$('.tab-content').forEach(c => c.style.display = 'none');
        $(`#tab-${tabName}`).style.display = 'block';
        if (tabName === 'map') {
          invalidateMapSoon();
          if (!state.map) initMap();
        }
      });
    });

    // Lightbox controls
    el.lbClose?.addEventListener('click', closeLightbox);
    el.lbPrev?.addEventListener('click', () => changeLightboxIndex(-1));
    el.lbNext?.addEventListener('click', () => changeLightboxIndex(1));
    document.addEventListener('keydown', (e) => {
      if (el.lb.style.display === 'block') {
        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'ArrowLeft') changeLightboxIndex(-1);
        else if (e.key === 'ArrowRight') changeLightboxIndex(1);
      }
    });

    if (el.heroVideo) {
      el.heroVideo.src = CONFIG.heroVideo;
    }

    if (el.buildStamp) {
      el.buildStamp.textContent = `Build: ${new Date().toISOString().slice(0, 19)}`;
    }
  }

  function exportFilteredData() {
    const cols = [
      { label: 'Session Number', get: r => r.sn },
      { label: 'Date', get: r => r.date },
      { label: 'City', get: r => r.city },
      { label: 'Spot/Village', get: r => r.spot },
      { label: 'Farmers', get: r => fmt.int(r.farmers) },
      { label: 'Acres', get: r => fmt.int(r.acres) },
      { label: 'Definite Intent', get: r => fmt.int(r.definite) },
      { label: 'Maybe Intent', get: r => fmt.int(r.maybe) },
      { label: 'Not Interested', get: r => fmt.int(r.notInterested) },
      { label: 'Definite %', get: r => fmt.num(r.definitePct, 2) },
      { label: 'Awareness %', get: r => fmt.num(r.awarenessPct, 2) },
      { label: 'Clarity %', get: r => fmt.num(r.clarityPct, 2) },
      { label: 'Latitude', get: r => r.lat },
      { label: 'Longitude', get: r => r.lon },
      { label: 'Reasons to Use', get: r => r.reasonsUse },
      { label: 'Reasons Not to Use', get: r => r.reasonsNo },
    ];
    const csv = toCsv(state.filtered, cols);
    const filename = `agrivista_sessions_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadText(filename, csv, 'text/csv');
  }

  // ---------------------------
  // Session Pinning
  // ---------------------------

  function pinSession(session, opts={}) {
    state.pinnedSession = session;
    const { openMedia, focusMap } = opts;

    if (!session) return unpinSession();

    // 1. Update UI
    if (el.snapshot) el.snapshot.style.display = 'block';

    // 2. Map info panel
    if (el.mapSelTitle) el.mapSelTitle.textContent = `${session.city} — ${session.spot} (SN: ${session.sn})`;
    if (el.mapSelFarmers) el.mapSelFarmers.textContent = `${fmt.int(session.farmers)} Farmers | ${fmt.num(session.definitePct, 1)}% Definite Intent`;
    if (el.mapSelAcres) el.mapSelAcres.textContent = `${fmt.int(session.acres)} Acres Covered`;
    if (el.mapSelDate) el.mapSelDate.textContent = fmt.date(session.date);

    // 3. Showcase media
    renderShowcase(el.snapShowcase, [session.sn]);

    // 4. Map focus
    if (focusMap && state.map && session.lat && session.lon) {
      state.map.setView([session.lat, session.lon], 10);
    }

    // 5. Table highlight
    $$('#tblSessions tr').forEach(tr => tr.classList.remove('pinned'));
    $(`#tblSessions tr[data-sn="${session.sn}"]`)?.classList.add('pinned');

    // 6. Open media/lightbox
    if (openMedia) {
      openLightboxForSession(session.sn);
    }
  }

  function unpinSession() {
    state.pinnedSession = null;
    if (el.snapshot) el.snapshot.style.display = 'none';

    if (el.mapSelTitle) el.mapSelTitle.textContent = 'Select a session on the map or in the table.';
    if (el.mapSelFarmers) el.mapSelFarmers.textContent = '—';
    if (el.mapSelAcres) el.mapSelAcres.textContent = '—';
    if (el.mapSelDate) el.mapSelDate.textContent = '—';
    if (el.snapShowcase) el.snapShowcase.innerHTML = '';
    $$('#tblSessions tr').forEach(tr => tr.classList.remove('pinned'));
  }

  // ---------------------------
  // Charts
  // ---------------------------
  function destroyChart(ch) { try { ch?.destroy(); } catch(_) {} }

  function renderCharts(rows) {
    if (typeof Chart === 'undefined') return;

    // City mix (doughnut)
    const byCity = new Map();
    for (const r of rows) {
      if (r.city) {
        byCity.set(r.city, (byCity.get(r.city) || 0) + (r.farmers || 0));
      }
    }
    const cityLabels = Array.from(byCity.keys());
    const cityData = Array.from(byCity.values());
    const cityBg = cityLabels.map(() => `hsl(${Math.random() * 360}, 70%, 50%)`);

    destroyChart(state.charts.city);
    if (el.chartCity) {
      state.charts.city = new Chart(el.chartCity, {
        type: 'doughnut', data: { labels: cityLabels, datasets: [{ data: cityData, backgroundColor: cityBg }] },
        options: { responsive: true, plugins: { legend: { position: 'right' } } }
      });
    }

    // Purchase Intent Mix (doughnut)
    const totalFarmers = sum(rows, r => r.farmers);
    const definite = sum(rows, r => r.definite);
    const maybe = sum(rows, r => r.maybe);
    const notInterested = sum(rows, r => r.notInterested);
    const other = totalFarmers - definite - maybe - notInterested;

    const intentData = [definite, maybe, notInterested, other].filter(n => n > 0);
    const intentLabels = ['Definite', 'Maybe', 'Not Interested', 'Other'];
    const intentBg = ['#86efac', '#7dd3fc', '#fb7185', '#9fb0ca'];

    destroyChart(state.charts.intent);
    if (el.chartIntent) {
      state.charts.intent = new Chart(el.chartIntent, {
        type: 'doughnut', data: {
          labels: intentLabels.filter((_, i) => [definite, maybe, notInterested, other][i] > 0),
          datasets: [{
            data: intentData,
            backgroundColor: intentBg.filter((_, i) => [definite, maybe, notInterested, other][i] > 0)
          }]
        },
        options: { responsive: true, plugins: { legend: { position: 'right' } } }
      });
    }

    // Sessions Trend (bar)
    const byDate = new Map();
    for (const r of rows) {
      if (r.date) {
        byDate.set(r.date, (byDate.get(r.date) || 0) + 1);
      }
    }
    const trendLabels = Array.from(byDate.keys()).sort();
    const trendData = trendLabels.map(d => byDate.get(d));

    destroyChart(state.charts.trend);
    if (el.chartTrend) {
      state.charts.trend = new Chart(el.chartTrend, {
        type: 'bar', data: {
          labels: trendLabels.map(fmt.date),
          datasets: [{ label: 'Sessions', data: trendData, backgroundColor: '#7dd3fc' }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { x: { ticks: { autoSkip: false } }, y: { beginAtZero: true } }
        }
      });
    }
  }

  // ---------------------------
  // Map
  // ---------------------------
  function initMap() {
    if (!el.mapWrap) return;
    if (typeof L === 'undefined') {
      showError('Leaflet did not load. Check your network and script tags.');
      return;
    }

    // Set initial view (a general center for the data, e.g., Pakistan)
    const initialLat = 30.3753;
    const initialLon = 69.3451;
    const initialZoom = 6;

    state.map = L.map(el.mapWrap).setView([initialLat, initialLon], initialZoom);

    // Dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(state.map);

    // Initial marker render
    updateMapMarkers(state.filtered);
  }

  function getCircleRadius(farmers) {
    // Scaling function for radius based on farmer count
    // Base radius: 5px, Max radius: 40px
    if (farmers === null || isNaN(farmers)) return 5;
    const minFarmers = 10; // Assuming minimal session size
    const maxFarmers = sum(state.sessions, r => r.farmers);
    const range = maxFarmers - minFarmers;

    if (range <= 0) return 15; // Default if all sessions are the same size

    const normalized = (farmers - minFarmers) / range;
    return 8 + (normalized * 28); // Radius from 8 to 36
  }

  function updateMapMarkers(rows) {
    if (!state.map) return;

    // Clear existing circles
    state.circles.forEach(c => state.map.removeLayer(c));
    state.circles = [];

    // Group rows by city for a single marker per lat/lon pair (sn)
    const mapData = new Map();
    for (const r of rows) {
      if (r.lat && r.lon && r.sn) {
        if (!mapData.has(r.sn)) {
          mapData.set(r.sn, {
            lat: r.lat, lon: r.lon, sn: r.sn,
            farmers: 0, acres: 0, definitePct: mean(rows.filter(x => x.sn === r.sn), x => x.definitePct),
            date: fmt.date(r.date),
            title: `${r.city} — ${r.spot}`
          });
        }
        const item = mapData.get(r.sn);
        item.farmers += (r.farmers || 0);
        item.acres += (r.acres || 0);
      }
    }

    const maxDefinitePct = 100;
    const maxFarmers = sum(state.sessions, r => r.farmers);
    const avgFarmers = maxFarmers / new Set(state.sessions.map(r => r.sn).filter(Boolean)).size;

    let totalMarkers = 0;
    for (const item of mapData.values()) {
      totalMarkers++;
      const radius = getCircleRadius(item.farmers);
      const definitePct = item.definitePct !== null ? item.definitePct : 0;
      const colorIntensity = definitePct / maxDefinitePct;

      // Color from red (low intent) to green (high intent)
      // hsl(h, s, l): 120 (green) to 0 (red)
      const hue = colorIntensity * 120;
      const fillColor = `hsl(${hue}, 80%, 45%)`;

      const circle = L.circleMarker([item.lat, item.lon], {
        radius: radius,
        fillColor: fillColor,
        color: '#fff',
        weight: 1.5,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(state.map);

      // Popup content
      const popupContent = `
        <strong>${item.title} (SN: ${item.sn})</strong><br/>
        Date: ${item.date}<br/>
        Farmers: ${fmt.int(item.farmers)}<br/>
        Acres: ${fmt.int(item.acres)}<br/>
        Definite Intent: ${item.definitePct !== null ? fmt.pct(item.definitePct) : '—'}
      `;
      circle.bindPopup(popupContent);

      circle.on('click', () => {
        const session = state.sessions.find(s => String(s.sn) === String(item.sn));
        if (session) pinSession(session, { openMedia: true, focusMap: false });
        // The Leaflet event handles map focus itself
      });

      state.circles.push(circle);
    }

    if (el.mapLegend) {
      el.mapLegend.textContent = `Showing ${totalMarkers} unique sessions. Marker size ~ Farmers. Color: Red (low intent) to Green (high intent).`;
    }
  }

  function invalidateMapSoon() {
    if (!state.map) return;
    setTimeout(() => { try{ state.map.invalidateSize(); } catch(_) {} }, 80);
  }

  // ---------------------------
  // Media / Showcase / Lightbox
  // ---------------------------
  function renderMediaItem(item, isLarge=false) {
    const isVideo = item.type === 'video' && item.src.endsWith('mp4'); // simple check

    return `
      <div class="mediaTile" data-session-id="${item.sessionId}" data-type="${item.type}" onclick="app.openLightboxForSession('${item.sessionId}')">
        ${isVideo ?
          `<video preload="metadata" muted playsinline poster="${item.src.replace(/\.(mp4|mov)/i, '.jpg')}" onerror="this.onerror=null; this.src='${item.src.replace(/\.(mp4|mov)/i, '.png')}'">
            <source src="${item.src}" type="video/mp4" onerror="this.parentNode.remove()">
          </video>` :
          `<img src="${item.src}" alt="${item.caption}" onerror="this.onerror=null; this.src='${CONFIG.placeholder}'">`
        }
        <div class="mediaTag">${item.caption}</div>
      </div>
    `;
  }

  function renderShowcase(container, sessionIds) {
    if (!container) return;
    container.innerHTML = '';
    if (!sessionIds || !sessionIds.length) return;

    const uniqueMedia = new Map(); // Use Map to ensure unique items based on src
    let count = 0;

    for (const sn of sessionIds) {
      const media = state.mediaBySessionId.get(String(sn)) || [];
      for (const item of media) {
        if (!item.src) continue;
        if (uniqueMedia.has(item.src)) continue;
        if (item.type === 'video' && item.variant) continue; // Only show main video/image in showcase

        uniqueMedia.set(item.src, item);
        container.insertAdjacentHTML('beforeend', renderMediaItem(item, true));
        count++;
        if (count >= CONFIG.maxShowcase) break;
      }
      if (count >= CONFIG.maxShowcase) break;
    }

    if (count === 0) {
      container.innerHTML = `<div class="muted" style="font-size:12px; padding: 10px;">No media available for selected session(s).</div>`;
    }
  }

  function buildGallery(rows) {
    if (!el.gallery) return;
    el.gallery.innerHTML = '';

    const ids = new Set(rows.map(r => String(r.sn)).filter(Boolean));
    const items = [];
    for (const id of ids) {
      const arr = state.mediaBySessionId.get(id) || [];
      items.push(...arr.filter(item => item.src && !item.variant)); // Only main media for gallery
    }

    items.sort((a,b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()); // Newest first

    if (el.gallerySummary) {
      el.gallerySummary.textContent = `Showing ${Math.min(items.length, CONFIG.maxGallery)} of ${items.length} total media items for the filtered sessions. Click to open full view.`;
    }

    let count = 0;
    for (const item of items) {
      if (count >= CONFIG.maxGallery) break;
      el.gallery.insertAdjacentHTML('beforeend', renderMediaItem(item));
      count++;
    }

    if (count === 0) {
      el.gallery.innerHTML = `<div class="muted" style="font-size:12px; padding: 10px;">No media available for the current filters.</div>`;
    }
  }

  function openLightbox(items, startIndex) {
    if (!el.lb) return;
    state.lightbox.items = items;
    state.lightbox.index = clamp(startIndex, 0, items.length - 1);

    el.lb.style.display = 'block';
    renderLightbox();
  }

  function openLightboxForSession(sessionId) {
    const items = (state.mediaBySessionId.get(String(sessionId)) || [])
      .filter(it => it.src && it.type === 'image' || it.type === 'video' && it.src.endsWith('.mp4')); // Only valid media
    if (!items.length) {
      openLightbox([{ sessionId, type:'image', src: CONFIG.placeholder, caption:`Session ${sessionId}`, transcript:'No media found.' }], 0);
      return;
    }
    // Filter out redundant non-main items for simplicity in lightbox nav
    const uniqueItems = items.filter(it => it.type !== 'video' || it.variant);

    openLightbox(uniqueItems.slice(0, 50), 0);
  }

  function closeLightbox() {
    el.lb.style.display = 'none';
    el.lbMedia.innerHTML = '';
    state.lightbox.items = [];
    state.lightbox.index = 0;
  }

  function changeLightboxIndex(delta) {
    const newIndex = state.lightbox.index + delta;
    if (newIndex >= 0 && newIndex < state.lightbox.items.length) {
      state.lightbox.index = newIndex;
      renderLightbox();
    }
  }

  function renderLightbox() {
    const items = state.lightbox.items || [];
    const index = state.lightbox.index;
    const item = items[index];

    if (!item) {
      closeLightbox();
      return;
    }

    el.lbCaption.textContent = item.caption || `Session ${item.sessionId}`;
    el.lbTranscript.textContent = item.transcript || 'No transcript or detailed information available.';
    el.lbPrev.disabled = index === 0;
    el.lbNext.disabled = index === items.length - 1;

    el.lbMedia.innerHTML = '';
    if (item.type === 'video') {
      el.lbMedia.innerHTML = `
        <video controls autoplay loop playsinline>
          <source src="${item.src}" type="video/mp4" onerror="this.parentNode.remove();">
          Your browser does not support the video tag.
        </video>
      `;
    } else {
      el.lbMedia.innerHTML = `<img src="${item.src}" alt="${item.caption}" onerror="this.onerror=null; this.src='${CONFIG.placeholder}'">`;
    }
  }

  // ---------------------------
  // Table
  // ---------------------------
  function updateSessionTable(rows) {
    if (!el.tbl) return;
    el.tbl.innerHTML = '';

    rows.sort((a,b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()); // Newest first

    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.setAttribute('data-sn', r.sn);
      if (state.pinnedSession?.sn === r.sn) tr.classList.add('pinned');

      tr.innerHTML = `
        <td>${fmt.date(r.date)}</td>
        <td>${r.city}</td>
        <td>${r.spot}</td>
        <td>${fmt.int(r.farmers)}</td>
        <td>${fmt.int(r.acres)}</td>
        <td>${fmt.pct(r.definitePct, 0)}</td>
        <td>${fmt.pct(r.awarenessPct, 0)}</td>
        <td>${fmt.pct(r.clarityPct, 0)}</td>
      `;
      tr.addEventListener('click', () => {
        const sn = tr.getAttribute('data-sn');
        const session = state.filtered.find(x => String(x.sn) === String(sn)) || state.sessions.find(x => String(x.sn) === String(sn));
        if (session) pinSession(session, { openMedia:true, focusMap:true });
      });

      el.tbl.appendChild(tr);
    }
  }

  // ---------------------------
  // Diagnostics / logging
  // ---------------------------
  const diagLines = [];
  function logDiag(line) {
    diagLines.push(`[${new Date().toISOString()}] ${line}`);
    if (diagLines.length > 200) diagLines.shift();
    setDiag(diagLines.slice(-40));
  }

  // ---------------------------
  // Initialization
  // ---------------------------

  async function boot() {
    logDiag('Dashboard starting...');
    setLoadingStatus('Initializing application...');
    clearError();
    setupEventListeners();

    // Expose utility functions for inline HTML calls (like media tiles)
    window.app = { openLightboxForSession, pinSession };

    try {
      // 1. Load Sessions Data
      let sessions = [];
      try {
        sessions = await loadSessionsJson(CONFIG.sessionsJson);
        logDiag(`sessions.json loaded: ${sessions.length} sessions`);
        setNotice(`<strong>Status:</strong> Data loaded from <code>${CONFIG.sessionsJson}</code>`);
      } catch (e) {
        logDiag(`sessions.json error: ${e.message}. Falling back to XLSX.`);
        setNotice(`<strong>Status:</strong> Falling back to <code>${CONFIG.xlsxFallback}</code> due to error with <code>${CONFIG.sessionsJson}</code>.`);
        sessions = await loadSessionsXlsx(CONFIG.xlsxFallback);
      }

      state.sessions = sessions;

      // 2. Load Media Index
      state.mediaItems = await loadMedia(sessions);
      logDiag(`media items loaded: ${state.mediaItems.length}`);

      // 3. Populate filters and initial render
      populateFilters();
      applyFilters(); // Initial render based on all sessions

      // 4. Initialize Map (do last to allow Leaflet a moment to load)
      initMap();

      // 5. Done
      setLoadingStatus('Ready');
      if (el.overlay) el.overlay.style.opacity = '0';
      if (el.shell) {
        el.shell.style.display = 'grid';
        el.shell.classList.add('ready');
      }
      setTimeout(() => { if (el.overlay) el.overlay.style.display = 'none'; }, 250);

    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      showError(`<b>Dashboard failed to load.</b><br/><br/>${escapeHtml(msg)}<br/><br/>
        <b>Quick checks:</b><br/>
        1) Verify all files exist: <code>index.html</code>, <code>data_processor.js</code>, <code>sessions.json</code>, <code>media.json</code> (or <code>${CONFIG.xlsxFallback}</code>)<br/>
        2) If using Git LFS, ensure media is hosted correctly.<br/>
        3) Check browser DevTools → Console/Network for specific 404/blocked errors.`);
      setNotice('<strong>Status:</strong> Error');
      logDiag(`boot error: ${msg}`);

      if (el.shell) {
        el.shell.style.display = 'grid';
        el.shell.classList.add('ready');
      }
      if (el.overlay) el.overlay.style.display = 'none';
    }
  }

  function debounce(fn, ms) {
    let t = null;
    return (...args) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  boot();
})();
