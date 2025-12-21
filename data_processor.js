/* AgriVista Dashboard - revised controller with fixed map and charts
   - Uses reliable coordinate parsing from old version
   - Fixed map initialization and rendering
   - Fixed chart rendering issues
   - Keeps sessions.json + media.json structure
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
    filterSpot: $('#filter-spot'),
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
  };

  function setLoadingStatus(msg) {
    if (el.status) el.status.textContent = msg;
  }
  function setNotice(html) {
    if (!el.notice) return;
    el.notice.innerHTML = html;
  }
  function setDiag(lines) {
    if (!el.diag) return;
    el.diag.textContent = lines.join('\n');
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
    mediaBySessionId: new Map(),
    pinnedSession: null,

    map: null,
    mapMarkers: [], // Changed from circles to mapMarkers for consistency
    charts: { city:null, intent:null, trend:null },
    lightbox: { items: [], index: 0 }
  };

  // ---------------------------
  // Utilities - INCLUDING OLD COORDINATE PARSING
  // ---------------------------
  function uniq(arr) { return Array.from(new Set(arr.filter(Boolean))); }
  function safeStr(v) { return (v === null || v === undefined) ? '' : String(v).trim(); }
  function safeNumber(val) {
    if (val === null || val === undefined) return 0;
    const n = parseFloat(String(val).replace(/,/g, "").trim());
    return isNaN(n) ? 0 : n;
  }

  // ROBUST DMS PARSER FROM OLD FILE
  function parseDMS(dmsStr) {
    if (!dmsStr) return null;
    const s = String(dmsStr).trim();
    const m = s.match(
      /(\d+(?:\.\d+)?)[°\s]+(\d+(?:\.\d+)?)['\u2019]?\s*(\d*(?:\.\d+)?)["\u201d]?\s*([NSEW])/i
    );
    if (!m) return null;
    const deg = parseFloat(m[1]) || 0;
    const min = parseFloat(m[2]) || 0;
    const sec = parseFloat(m[3]) || 0;
    const hemi = m[4].toUpperCase();
    let dec = deg + min / 60 + sec / 3600;
    if (hemi === "S" || hemi === "W") dec = -dec;
    return dec;
  }

  // COORDINATE EXTRACTOR FROM OLD FILE (ADAPTED)
  function extractLatLng(row) {
    // Try direct lat/lng fields first
    let lat = safeNumber(row.lat || row.latitude);
    let lng = safeNumber(row.lon || row.lng || row.longitude);
    
    if (lat && lng) {
      return { lat, lng, original: lat + ", " + lng };
    }

    // Try coordinates field if present
    const spot = row.coordinates || row.coords || "";
    if (spot) {
      const text = String(spot).trim();
      const m = text.match(/([0-9°'".\s]+[NS])[, ]+([0-9°'".\s]+[EW])/i);
      if (m) {
        const latStr = m[1];
        const lngStr = m[2];
        const dLat = parseDMS(latStr);
        const dLng = parseDMS(lngStr);
        if (dLat && dLng) {
          return { lat: dLat, lng: dLng, original: text };
        }
      }
    }

    return { lat: null, lng: null, original: "" };
  }

  function parseISO(d) {
    if (!d) return null;
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? null : dt;
  }

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (m) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  // ---------------------------
  // Data loading (SIMPLIFIED)
  // ---------------------------
  function normalizeSession(s) {
    const sn = safeStr(s.sn || s.SN || s.Sn);
    const date = safeStr(s.date);
    const city = safeStr(s.city);
    const spot = safeStr(s.spot);

    const farmers = safeNumber(s.farmers || s.TotalFarmers);
    const acres = safeNumber(s.acres || s.TotalAcres || s['Total Wheat Acres']);
    const definite = safeNumber(s.definite || s['Will Definitely Use']);
    const maybe = safeNumber(s.maybe);
    const notInterested = safeNumber(s.notInterested);

    const definitePct = (s.definitePct !== null && s.definitePct !== undefined) ? 
      safeNumber(s.definitePct) :
      (farmers > 0) ? (definite / farmers * 100) : 0;

    const awarenessPct = safeNumber(s.awarenessPct || s['Know Buctril']);
    const clarityPct = safeNumber(s.clarityPct) || 60; // Default to 60 if not provided

    // Use the robust coordinate extractor
    const { lat, lng } = extractLatLng(s);

    return {
      id: sn || `${date}|${city}|${spot}`,
      sn,
      date,
      city,
      spot,
      farmers,
      acres,
      definite,
      maybe,
      notInterested,
      definitePct,
      awarenessPct,
      clarityPct,
      lat: lat || null,
      lon: lng || null,
      reasonsUse: safeStr(s.reasonsUse || s['Top reason to use']),
      reasonsNo: safeStr(s.reasonsNo || s['Top reason not to use']),
    };
  }

  async function loadSessions() {
    try {
      setLoadingStatus('Loading sessions.json…');
      const res = await fetch(CONFIG.sessionsJson);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${CONFIG.sessionsJson}`);
      
      const payload = await res.json();
      const sessions = (payload.sessions || payload.data || []);
      
      if (!Array.isArray(sessions) || sessions.length === 0) {
        throw new Error('sessions.json is empty or invalid.');
      }
      
      const normalized = sessions.map(normalizeSession);
      logDiag(`Loaded ${normalized.length} sessions from sessions.json`);
      return normalized;
      
    } catch (e) {
      logDiag(`sessions.json failed: ${e.message}`);
      showError(`Failed to load sessions: ${e.message}. Check console for details.`);
      return [];
    }
  }

  // ---------------------------
  // Media loading (UNCHANGED BUT SIMPLIFIED)
  // ---------------------------
  async function loadMedia(sessions) {
    try {
      setLoadingStatus('Loading media.json…');
      const res = await fetch(CONFIG.mediaJson);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${CONFIG.mediaJson}`);
      
      const payload = await res.json();
      let items = [];
      
      if (payload && payload.format === 'A_compact') {
        const basePath = safeStr(payload.basePath || '');
        const sessionsData = Array.isArray(payload.sessions) ? payload.sessions : [];
        
        items = sessionsData.flatMap(s => {
          const id = safeStr(s.id);
          if (!id) return [];
          
          return [
            {
              sessionId: id,
              type: 'video',
              src: `${basePath}${id}a.mp4`,
              caption: safeStr(s.caption) || `Session ${id}`,
              city: safeStr(s.city),
              spot: safeStr(s.spot),
              date: safeStr(s.date)
            },
            {
              sessionId: id,
              type: 'image',
              src: `${basePath}${id}a.jpg`,
              caption: safeStr(s.caption) || `Session ${id}`,
              city: safeStr(s.city),
              spot: safeStr(s.spot),
              date: safeStr(s.date)
            }
          ];
        });
      }
      
      // Build lookup
      const by = new Map();
      for (const it of items) {
        const k = it.sessionId || '';
        if (!k) continue;
        if (!by.has(k)) by.set(k, []);
        by.get(k).push(it);
      }
      
      state.mediaItems = items;
      state.mediaBySessionId = by;
      
      logDiag(`Loaded ${items.length} media items`);
      return items;
      
    } catch (e) {
      logDiag(`media.json failed: ${e.message}`);
      state.mediaItems = [];
      state.mediaBySessionId = new Map();
      return [];
    }
  }

  // ---------------------------
  // Rendering: KPIs, charts, table
  // ---------------------------
  function sum(arr, fn) {
    return arr.reduce((acc, x) => {
      const v = fn(x);
      return acc + (typeof v === 'number' && !isNaN(v) ? v : 0);
    }, 0);
  }

  function mean(arr, fn) {
    const vals = arr.map(fn).filter(v => typeof v === 'number' && !isNaN(v));
    if (!vals.length) return null;
    return vals.reduce((a,b)=>a+b,0) / vals.length;
  }

  function computeKpis(rows) {
    const sessions = rows.length;
    const farmers = sum(rows, r => r.farmers);
    const acres = sum(rows, r => r.acres);
    const defPct = mean(rows, r => r.definitePct);
    return { sessions, farmers, acres, defPct };
  }

  function updateKpis(rows) {
    const k = computeKpis(rows);
    el.kpiSessions.textContent = fmt.int(k.sessions);
    el.kpiFarmers.textContent = fmt.int(k.farmers);
    el.kpiAcres.textContent = fmt.num(k.acres, 1);
    el.kpiDemo.textContent = fmt.pct(k.defPct, 0);
  }

  // ---------------------------
  // MAP FUNCTIONS - USING OLD APPROACH
  // ---------------------------
  function initMap() {
    if (!el.mapWrap || typeof L === 'undefined') {
      showError('Leaflet map library not loaded. Check network.');
      return;
    }
    
    // Clear existing map if any
    if (state.map) {
      state.map.remove();
      state.map = null;
    }
    
    state.map = L.map(el.mapWrap, { preferCanvas: true });
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(state.map);
    
    // Default view for Pakistan
    state.map.setView([30.3753, 69.3451], 5);
    logDiag('Leaflet map initialized');
  }

  function renderMap(rows) {
    if (!state.map) {
      logDiag('Map not initialized, skipping render');
      return;
    }
    
    // Clear existing markers
    state.mapMarkers.forEach(marker => marker.remove());
    state.mapMarkers = [];
    
    const points = [];
    rows.forEach(row => {
      const lat = row.lat;
      const lon = row.lon;
      
      if (lat && lon && !isNaN(lat) && !isNaN(lon)) {
        points.push({ ...row, lat, lon });
      }
    });
    
    logDiag(`Rendering ${points.length} map points`);
    
    if (points.length === 0) {
      el.mapLegend.textContent = 'No coordinates available in the filtered set.';
      return;
    }
    
    const bounds = [];
    points.forEach(row => {
      const farmers = row.farmers || 0;
      const acres = row.acres || 0;
      const radius = Math.max(4, Math.min(18, acres ? acres / 200 : 6));
      
      const circle = L.circleMarker([row.lat, row.lon], {
        radius: radius,
        color: '#2e7d32',
        fillColor: '#66bb6a',
        fillOpacity: 0.7,
        weight: 2
      }).addTo(state.map);
      
      const popup = `<div class="popup">
        <div class="popupTitle"><b>${escapeHtml(row.city)} — ${escapeHtml(row.spot)}</b></div>
        <div class="popupBody">
          <div><b>Date:</b> ${escapeHtml(fmt.date(row.date))}</div>
          <div><b>Farmers:</b> ${fmt.int(row.farmers)}</div>
          <div><b>Wheat Acres:</b> ${fmt.num(row.acres,1)}</div>
          <div><b>Definite Intent:</b> ${fmt.pct(row.definitePct,0)}</div>
        </div>
      </div>`;
      
      circle.bindPopup(popup);
      circle.on('click', () => {
        pinSession(row, { openMedia: true, focusMap: true });
      });
      
      state.mapMarkers.push(circle);
      bounds.push([row.lat, row.lon]);
    });
    
    if (bounds.length > 0) {
      try {
        state.map.fitBounds(bounds, { padding: [20, 20] });
      } catch (e) {
        logDiag(`Map bounds error: ${e.message}`);
      }
    }
    
    el.mapLegend.textContent = 'Marker size represents wheat acres covered. Click a marker to pin that session.';
  }

  // ---------------------------
  // CHARTS - SIMPLIFIED VERSION
  // ---------------------------
  function destroyChart(ch) {
    try { ch?.destroy(); } catch(_) {}
  }

  function renderCharts(rows) {
    if (typeof Chart === 'undefined') {
      logDiag('Chart.js not loaded');
      return;
    }
    
    // City Mix Chart
    const byCity = new Map();
    rows.forEach(r => {
      const city = r.city || 'Unknown';
      byCity.set(city, (byCity.get(city) || 0) + (r.farmers || 0));
    });
    
    destroyChart(state.charts.city);
    if (byCity.size > 0) {
      state.charts.city = new Chart(el.chartCity, {
        type: 'doughnut',
        data: {
          labels: Array.from(byCity.keys()),
          datasets: [{
            data: Array.from(byCity.values()),
            backgroundColor: ['#7dd3fc', '#86efac', '#fbbf24', '#a78bfa', '#f472b6']
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#e7edf7' } }
          }
        }
      });
    }
    
    // Intent Split Chart
    const sumDef = sum(rows, r => r.definite);
    const sumMay = sum(rows, r => r.maybe);
    const sumNo = sum(rows, r => r.notInterested);
    
    destroyChart(state.charts.intent);
    state.charts.intent = new Chart(el.chartIntent, {
      type: 'pie',
      data: {
        labels: ['Definite', 'Maybe', 'Not Interested'],
        datasets: [{
          data: [sumDef, sumMay, sumNo],
          backgroundColor: ['#86efac', '#fbbf24', '#fb7185']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#e7edf7' } }
        }
      }
    });
    
    // Trend Chart
    const buckets = new Map();
    rows.forEach(r => {
      const d = r.date || '';
      if (!d) return;
      if (!buckets.has(d)) buckets.set(d, { farmers: 0, acres: 0 });
      const b = buckets.get(d);
      b.farmers += (r.farmers || 0);
      b.acres += (r.acres || 0);
    });
    
    const dates = Array.from(buckets.keys()).sort((a,b) => new Date(a) - new Date(b));
    const farmersSeries = dates.map(d => buckets.get(d).farmers);
    const acresSeries = dates.map(d => buckets.get(d).acres);
    
    destroyChart(state.charts.trend);
    if (dates.length > 0) {
      state.charts.trend = new Chart(el.chartTrend, {
        type: 'line',
        data: {
          labels: dates.map(d => fmt.date(d)),
          datasets: [
            {
              label: 'Farmers',
              data: farmersSeries,
              borderColor: '#7dd3fc',
              backgroundColor: 'rgba(125, 211, 252, 0.1)',
              tension: 0.25
            },
            {
              label: 'Wheat Acres',
              data: acresSeries,
              borderColor: '#86efac',
              backgroundColor: 'rgba(134, 239, 172, 0.1)',
              tension: 0.25
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#e7edf7' } }
          },
          scales: {
            x: { 
              ticks: { color: '#9fb0ca' },
              grid: { color: 'rgba(255,255,255,0.08)' }
            },
            y: {
              ticks: { color: '#9fb0ca' },
              grid: { color: 'rgba(255,255,255,0.08)' }
            }
          }
        }
      });
    }
    
    logDiag(`Charts rendered: city=${byCity.size > 0}, intent=true, trend=${dates.length > 0}`);
  }

  // ---------------------------
  // Table and other rendering (SIMPLIFIED)
  // ---------------------------
  function renderTable(rows) {
    if (!el.tbl) return;
    
    el.tbl.innerHTML = rows.map(r => {
      return `<tr data-sn="${escapeHtml(r.sn || '')}">
        <td>${escapeHtml(fmt.date(r.date))}</td>
        <td>${escapeHtml(r.city || '—')}</td>
        <td>${escapeHtml(r.spot || '—')}</td>
        <td>${fmt.int(r.farmers)}</td>
        <td>${fmt.num(r.acres,1)}</td>
        <td>${fmt.pct(r.definitePct,0)}</td>
        <td>${fmt.pct(r.awarenessPct,0)}</td>
        <td>${fmt.pct(r.clarityPct,0)}</td>
      </tr>`;
    }).join('') || `<tr><td colspan="8" class="muted">No sessions match the filters.</td></tr>`;
    
    // Add click handlers
    el.tbl.querySelectorAll('tr[data-sn]').forEach(tr => {
      tr.addEventListener('click', () => {
        const sn = tr.getAttribute('data-sn');
        const session = state.filtered.find(x => String(x.sn) === String(sn)) || 
                       state.sessions.find(x => String(x.sn) === String(sn));
        if (session) pinSession(session, { openMedia: true, focusMap: true });
      });
    });
  }

  // ---------------------------
  // Filters and main logic
  // ---------------------------
  function populateFilters() {
    const cities = uniq(state.sessions.map(s => s.city)).sort((a,b) => a.localeCompare(b));
    el.filterCity.innerHTML = `<option value="">All</option>` + 
      cities.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    
    // Set date range
    const dates = state.sessions.map(s => parseISO(s.date)).filter(Boolean).sort((a,b) => a - b);
    if (dates.length > 0) {
      const min = dates[0].toISOString().slice(0,10);
      const max = dates[dates.length-1].toISOString().slice(0,10);
      el.filterFrom.value = min;
      el.filterTo.value = max;
    }
  }

  function applyFilters() {
    const city = el.filterCity.value;
    const spot = el.filterSpot.value;
    const from = el.filterFrom.value;
    const to = el.filterTo.value;
    const q = (el.filterSearch.value || '').trim().toLowerCase();
    
    let rows = state.sessions.slice();
    
    if (city) rows = rows.filter(r => r.city === city);
    if (spot) rows = rows.filter(r => r.spot === spot);
    
    if (from) {
      const fromDt = new Date(from);
      rows = rows.filter(r => {
        const d = parseISO(r.date);
        return d ? (d >= fromDt) : true;
      });
    }
    
    if (to) {
      const toDt = new Date(to + 'T23:59:59');
      rows = rows.filter(r => {
        const d = parseISO(r.date);
        return d ? (d <= toDt) : true;
      });
    }
    
    if (q) {
      rows = rows.filter(r => {
        const hay = `${r.city} ${r.spot} ${r.reasonsUse} ${r.reasonsNo}`.toLowerCase();
        return hay.includes(q);
      });
    }
    
    // Sort by date descending
    rows.sort((a,b) => {
      const da = parseISO(a.date);
      const db = parseISO(b.date);
      return db - da;
    });
    
    state.filtered = rows;
    
    // Update all displays
    updateKpis(rows);
    renderCharts(rows);
    renderTable(rows);
    renderMap(rows);
    updateMapBanner(rows);
    
    setNotice(`<strong>Status:</strong> Ready · <b>${fmt.int(rows.length)}</b> sessions in current view.`);
  }

  function updateMapBanner(rows) {
    const s = state.pinnedSession;
    if (s) {
      el.mapSelTitle.textContent = `${s.city || '—'} — ${s.spot || '—'}`;
      el.mapSelFarmers.textContent = fmt.int(s.farmers);
      el.mapSelAcres.textContent = fmt.num(s.acres, 1);
      el.mapSelDate.textContent = fmt.date(s.date);
    } else {
      const k = computeKpis(rows);
      el.mapSelTitle.textContent = 'All sessions';
      el.mapSelFarmers.textContent = fmt.int(k.farmers);
      el.mapSelAcres.textContent = fmt.num(k.acres, 1);
      
      const dates = rows.map(r => parseISO(r.date)).filter(Boolean).sort((a,b) => a-b);
      const span = dates.length ? 
        `${dates[0].toISOString().slice(0,10)} → ${dates[dates.length-1].toISOString().slice(0,10)}` : 
        '—';
      el.mapSelDate.textContent = span;
    }
  }

  function pinSession(session, opts = {}) {
    state.pinnedSession = session;
    updateMapBanner(state.filtered);
    
    if (opts.focusMap && state.map && session.lat && session.lon) {
      state.map.setView([session.lat, session.lon], 12, { animate: true });
    }
  }

  // ---------------------------
  // Diagnostics / logging
  // ---------------------------
  const diagLines = [];
  function logDiag(line) {
    diagLines.push(`[${new Date().toISOString().slice(11,19)}] ${line}`);
    if (diagLines.length > 200) diagLines.shift();
    setDiag(diagLines.slice(-40));
  }

  // ---------------------------
  // Main boot function
  // ---------------------------
  async function boot() {
    try {
      setLoadingStatus('Initializing…');
      
      // Initialize UI
      el.shell.style.display = 'grid';
      setTimeout(() => el.shell.classList.add('ready'), 50);
      
      // Initialize map early
      initMap();
      
      // Load data
      setNotice('<strong>Status:</strong> Loading data…');
      logDiag('Starting data load');
      
      const sessions = await loadSessions();
      state.sessions = sessions;
      
      if (sessions.length === 0) {
        throw new Error('No sessions loaded. Check sessions.json format.');
      }
      
      await loadMedia(sessions);
      
      // Populate filters and render
      populateFilters();
      applyFilters();
      
      // Hide loading overlay
      el.overlay.style.opacity = '0';
      setTimeout(() => {
        el.overlay.style.display = 'none';
        setLoadingStatus('Ready');
      }, 300);
      
      logDiag(`Dashboard ready with ${sessions.length} sessions`);
      
    } catch (e) {
      console.error('Boot error:', e);
      showError(`<b>Dashboard failed to load.</b><br/>${escapeHtml(e.message)}<br/>Check browser console for details.`);
      setNotice('<strong>Status:</strong> Error');
      logDiag(`Boot error: ${e.message}`);
      
      el.shell.style.display = 'grid';
      el.shell.classList.add('ready');
      el.overlay.style.display = 'none';
    }
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
