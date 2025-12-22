/* AgriVista Dashboard - enhanced single file controller
   - Complete 40 sessions support
   - Route mapping between spots
   - Day-based navigation
   - Region-based coloring
   - Enhanced XLSX parsing
*/
(() => {
  'use strict';

  // ---------------------------
  // Config
  // ---------------------------
  const CONFIG = {
    sessionsJson: 'sessions.json',
    mediaJson: 'media.json',
    xlsxFallback: 'Buctril_Super_Activations.xlsx',
    heroVideo: 'assets/bg.mp4',
    placeholder: 'assets/placeholder.svg',
    maxShowcase: 5,
    maxGallery: 48,
    mapCenter: [30.3753, 69.3451],
    mapZoom: 5
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
    campaignOverview: $('#campaignOverview'),
    dayNavigation: $('#dayNavigation'),

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
    circles: [],
    routeLine: null,
    charts: { city:null, intent:null, trend:null },
    lightbox: { items: [], index: 0 },
    
    // New state for enhanced features
    days: new Map(),
    regions: new Map(),
    currentDay: null
  };

  // ---------------------------
  // Utilities
  // ---------------------------
  function uniq(arr) { return Array.from(new Set(arr.filter(Boolean))); }
  function safeStr(v) { return (v === null || v === undefined) ? '' : String(v).trim(); }

  function parseISO(d) {
    if (!d) return null;
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? null : dt;
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

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (m) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const text = await res.text();
    if (text.includes('version https://git-lfs.github.com/spec/v1')) {
      const e = new Error(`Git LFS pointer detected for ${url}.`);
      e.code = 'LFS_POINTER';
      throw e;
    }
    return JSON.parse(text);
  }

  async function fetchArrayBuffer(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 5000) {
      const txt = new TextDecoder().decode(new Uint8Array(buf));
      if (txt.includes('version https://git-lfs.github.com/spec/v1')) {
        const e = new Error(`Git LFS pointer detected for ${url}.`);
        e.code = 'LFS_POINTER';
        throw e;
      }
    }
    return buf;
  }

  // ---------------------------
  // Enhanced Data Processing
  // ---------------------------
  function detectRegion(city) {
    const cityLower = String(city || '').toLowerCase();
    const regionMap = {
      'ubaro': 'SKR', 'dharki': 'SKR', 'ghotki': 'SKR', 'sukkur': 'SKR',
      'jaferabad': 'SKR', 'ranipur': 'SKR', 'mehrabpur': 'SKR', 'dadu': 'SKR',
      'muzaffar': 'DGK', 'kot adu': 'DGK', 'karor': 'DGK', 'bhakkar': 'DGK',
      'mianwali': 'DGK', 'sargodha': 'FSD', 'chakwal': 'FSD', 'phalia': 'GUJ',
      'toba': 'FSD'
    };
    
    for (const [key, region] of Object.entries(regionMap)) {
      if (cityLower.includes(key)) return region;
    }
    return 'Unknown';
  }

  function getRegionColor(region) {
    const colors = {
      'SKR': { border: '#3b82f6', fill: '#60a5fa', name: 'Sukkur' },
      'DGK': { border: '#10b981', fill: '#34d399', name: 'Dera Ghazi Khan' },
      'FSD': { border: '#f59e0b', fill: '#fbbf24', name: 'Faisalabad' },
      'GUJ': { border: '#8b5cf6', fill: '#a78bfa', name: 'Gujranwala' },
      'Unknown': { border: '#6b7280', fill: '#9ca3af', name: 'Unknown' }
    };
    return colors[region] || colors['Unknown'];
  }

  function parseCoordPairEnhanced(s) {
    if (!s) return { lat:null, lon:null };
    const str = String(s).trim();
    if (!str) return { lat:null, lon:null };

    if (str.includes(',')) {
      const parts = str.split(',').map(x => x.trim());
      if (parts.length >= 2) {
        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
          return { lat, lon };
        }
      }
    }

    const nums = str.match(/-?\d+(\.\d+)?/g);
    if (nums && nums.length >= 2) {
      const lat = parseFloat(nums[0]);
      const lon = parseFloat(nums[1]);
      if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        return { lat, lon };
      }
    }

    return { lat:null, lon:null };
  }

  function normalizeSession(s) {
    const sn = (s.sn !== null && s.sn !== undefined && s.sn !== '') ? String(s.sn) : '';
    const date = safeStr(s.date);
    const city = safeStr(s.city);
    const spot = safeStr(s.spot);
    
    let day = s.day || null;
    if (!day && date) {
      const campaignStart = new Date('2025-11-24');
      const currentDate = parseISO(date);
      if (currentDate) {
        const diffTime = currentDate - campaignStart;
        day = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }
    }
    
    const farmers = (s.farmers === '' ? null : Number(s.farmers));
    const acres = (s.acres === '' ? null : Number(s.acres));
    const definite = (s.definite === '' ? null : Number(s.definite));
    const maybe = (s.maybe === '' ? null : Number(s.maybe));
    const notInterested = (s.notInterested === '' ? null : Number(s.notInterested));
    const knowBuctril = (s.knowBuctril === '' ? null : Number(s.knowBuctril));
    const usedLastYear = (s.usedLastYear === '' ? null : Number(s.usedLastYear));

    const definitePct = (s.definitePct !== null && s.definitePct !== undefined) ? Number(s.definitePct) :
      (farmers && definite !== null && !isNaN(farmers) && farmers > 0) ? (definite / farmers * 100) : null;

    const awarenessPct = (s.awarenessPct !== null && s.awarenessPct !== undefined) ? Number(s.awarenessPct) :
      (farmers && knowBuctril !== null && !isNaN(farmers) && farmers > 0) ? (knowBuctril / farmers * 100) : null;

    const clarityPct = (s.clarityPct !== null && s.clarityPct !== undefined) ? Number(s.clarityPct) : null;

    const { lat, lon } = parseCoordPairEnhanced(s.lat ?? s.latitude ?? null, s.lon ?? s.lng ?? s.longitude ?? null);

    return {
      id: sn || `${date}|${city}|${spot}`,
      sn,
      date,
      city,
      spot,
      farmers: isNaN(farmers) ? null : farmers,
      acres: isNaN(acres) ? null : acres,
      definite: isNaN(definite) ? null : definite,
      maybe: isNaN(maybe) ? null : maybe,
      notInterested: isNaN(notInterested) ? null : notInterested,
      knowBuctril: isNaN(knowBuctril) ? null : knowBuctril,
      usedLastYear: isNaN(usedLastYear) ? null : usedLastYear,
      definitePct: isNaN(definitePct) ? null : definitePct,
      awarenessPct: isNaN(awarenessPct) ? null : awarenessPct,
      clarityPct: isNaN(clarityPct) ? null : clarityPct,
      lat: isNaN(lat) ? null : lat,
      lon: isNaN(lon) ? null : lon,
      reasonsUse: safeStr(s.reasonsUse),
      reasonsNo: safeStr(s.reasonsNo),
      day: day,
      region: detectRegion(city) || s.region || 'Unknown'
    };
  }

  // ---------------------------
  // Data loading
  // ---------------------------
  async function loadSessions() {
    try {
      setLoadingStatus('Loading sessions.json…');
      const payload = await fetchJson(CONFIG.sessionsJson);
      
      if (payload.overallSummary) {
        state.overallSummary = payload.overallSummary;
      }
      
      const sessions = (payload.sessions || []);
      if (!Array.isArray(sessions) || sessions.length === 0) {
        throw new Error('sessions.json is empty or invalid.');
      }
      
      const normalized = sessions.map(normalizeSession);
      
      // Organize by day
      normalized.forEach(session => {
        if (session.day) {
          if (!state.days.has(session.day)) {
            state.days.set(session.day, []);
          }
          state.days.get(session.day).push(session);
        }
        
        if (session.region) {
          state.regions.set(session.region, (state.regions.get(session.region) || 0) + 1);
        }
      });
      
      return normalized;
    } catch (e) {
      logDiag(`sessions.json failed: ${e.message}`);
      throw e;
    }
  }

  async function loadMedia(sessions) {
    try {
      setLoadingStatus('Loading media.json…');
      const payload = await fetchJson(CONFIG.mediaJson);
      
      let items = [];
      if (payload && payload.format === 'A_compact') {
        items = expandMediaCompact(payload);
      } else if (Array.isArray(payload)) {
        items = payload;
      } else if (payload && Array.isArray(payload.sessions)) {
        items = payload.sessions.map(x => ({
          sessionId: safeStr(x.id || x.sessionId || ''),
          type: 'image',
          srcCandidates: [`assets/gallery/${safeStr(x.id || '')}.jpg`, `assets/gallery/${safeStr(x.id || '')}.jpeg`],
          caption: safeStr(x.caption || ''),
          transcript: safeStr(x.description || ''),
          city: safeStr(x.city || ''),
          spot: safeStr(x.spot || ''),
          date: safeStr(x.date || '')
        }));
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

      return items;
    } catch (e) {
      logDiag(`media.json failed: ${e.message}`);
      state.mediaItems = [];
      state.mediaBySessionId = new Map();
      return [];
    }
  }

  function expandMediaCompact(payload) {
    const basePath = safeStr(payload.basePath || '');
    const d = payload.defaults || {};

    const imageExts = uniq([
      d.mainImageExt || 'jpg',
      d.variantImageExt || 'jpg',
      'jpeg', 'png', 'webp'
    ].map(e => safeStr(e).replace('.', '')).filter(Boolean));

    const videoExts = uniq([
      d.mainVideoExt || 'mp4',
      d.variantVideoExt || 'mp4',
      'webm', 'mov'
    ].map(e => safeStr(e).replace('.', '')).filter(Boolean));

    const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
    const items = [];

    for (const s of sessions) {
      const id = safeStr(s.id);
      if (!id) continue;

      const caption = safeStr(s.caption) || `Session ${id}`;
      const transcript = safeStr(s.description || s.transcript || '');
      const city = safeStr(s.city);
      const spot = safeStr(s.spot);
      const date = safeStr(s.date);

      // Build candidates
      const buildCandidates = (exts) => {
        const candidates = [];
        const primaryVariant = d.primaryVariant || 'a';
        
        for (const ext of exts) {
          candidates.push(`${basePath}${id}${primaryVariant}.${ext}`);
          candidates.push(`${basePath}${id}_${primaryVariant}.${ext}`);
          candidates.push(`${basePath}${id}.${ext}`);
          candidates.push(`${basePath}${id}.${ext.replace('jpg', 'jpeg').replace('jpeg', 'jpg')}`);
        }
        candidates.push(CONFIG.placeholder);
        return candidates;
      };

      // Add image
      items.push({
        sessionId: id,
        type: 'image',
        srcCandidates: buildCandidates(imageExts),
        caption: caption,
        transcript: transcript,
        city: city,
        spot: spot,
        date: date
      });

      // Add video if likely exists
      items.push({
        sessionId: id,
        type: 'video',
        srcCandidates: buildCandidates(videoExts),
        caption: caption,
        transcript: transcript,
        city: city,
        spot: spot,
        date: date
      });
    }

    return items;
  }

  // ---------------------------
  // Rendering: Campaign Overview
  // ---------------------------
  function renderCampaignOverview() {
    if (!el.campaignOverview) return;
    
    const totalSessions = state.sessions.length;
    const totalFarmers = sum(state.sessions, s => s.farmers);
    const totalAcres = sum(state.sessions, s => s.acres);
    const totalDefinite = sum(state.sessions, s => s.definite);
    const definiteRate = totalFarmers > 0 ? (totalDefinite / totalFarmers * 100) : 0;
    const avgAwareness = mean(state.sessions, s => s.awarenessPct);
    const regionsCount = state.regions.size;
    
    const stats = [
      { value: fmt.int(totalSessions), label: 'Total Sessions' },
      { value: fmt.int(totalFarmers), label: 'Farmers Reached' },
      { value: fmt.num(totalAcres, 0), label: 'Wheat Acres' },
      { value: fmt.pct(definiteRate, 1), label: 'Definite Intent' },
      { value: fmt.pct(avgAwareness, 1), label: 'Avg Awareness' },
      { value: regionsCount.toString(), label: 'Regions Covered' }
    ];
    
    el.campaignOverview.innerHTML = stats.map(stat => `
      <div class="summary-stat">
        <div class="value">${stat.value}</div>
        <div class="label">${stat.label}</div>
      </div>
    `).join('');
  }

  function renderDayNavigation() {
    if (!el.dayNavigation) return;
    
    const days = Array.from(state.days.keys()).sort((a, b) => a - b);
    
    const dayButtons = days.map(day => {
      const daySessions = state.days.get(day) || [];
      const farmers = sum(daySessions, s => s.farmers);
      const isActive = state.currentDay === day;
      
      return `
        <button class="day-btn ${isActive ? 'active' : ''}" data-day="${day}" title="Day ${day}: ${farmers} farmers">
          ${day}
        </button>
      `;
    }).join('');
    
    const allButton = `<button class="day-btn ${!state.currentDay ? 'active' : ''}" data-day="all" title="All days">All</button>`;
    
    el.dayNavigation.innerHTML = allButton + dayButtons;
    
    // Add event listeners
    el.dayNavigation.querySelectorAll('.day-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const day = btn.dataset.day;
        if (day === 'all') {
          state.currentDay = null;
          resetFilters();
        } else {
          state.currentDay = parseInt(day);
          filterByDay(state.currentDay);
        }
        
        // Update UI
        el.dayNavigation.querySelectorAll('.day-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  function filterByDay(day) {
    if (!day) return resetFilters();
    
    const daySessions = state.days.get(day) || [];
    if (daySessions.length === 0) return;
    
    // Find the date range for this day
    const dates = daySessions.map(s => parseISO(s.date)).filter(Boolean).sort((a, b) => a - b);
    if (dates.length > 0) {
      const dateStr = dates[0].toISOString().slice(0, 10);
      el.filterFrom.value = dateStr;
      el.filterTo.value = dateStr;
    }
    
    // Get unique cities for this day
    const cities = uniq(daySessions.map(s => s.city));
    if (cities.length === 1) {
      el.filterCity.value = cities[0];
    } else {
      el.filterCity.value = '';
    }
    
    el.filterSpot.value = '';
    el.filterSearch.value = '';
    state.pinnedSession = null;
    
    applyFilters();
  }

  // ---------------------------
  // Enhanced Map Functions
  // ---------------------------
  function initMap() {
    if (!el.mapWrap) return;
    if (typeof L === 'undefined') {
      showError('Leaflet did not load. Check your network and script tags.');
      return;
    }
    
    state.map = L.map(el.mapWrap, {
      preferCanvas: true,
      zoomControl: true,
      attributionControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(state.map);

    state.map.setView(CONFIG.mapCenter, CONFIG.mapZoom);
    
    // Add scale control
    L.control.scale({ imperial: false }).addTo(state.map);
  }

  function clearMap() {
    if (!state.map) return;
    
    for (const c of state.circles) c.remove();
    state.circles = [];
    
    if (state.routeLine) {
      state.routeLine.remove();
      state.routeLine = null;
    }
  }

  function acresToRadiusMeters(acres) {
    const a = (typeof acres === 'number' && !isNaN(acres) && acres > 0) ? acres : 1;
    const area = a * 4046.86;
    const r = Math.sqrt(area / Math.PI);
    return clamp(r, 25, 2200);
  }

  function renderRouteLines(points) {
    if (!state.map || !points.length) return;
    
    const sortedPoints = [...points].sort((a, b) => {
      const dayA = a.day || 0;
      const dayB = b.day || 0;
      if (dayA !== dayB) return dayA - dayB;
      return new Date(a.date || 0) - new Date(b.date || 0);
    });
    
    const routeCoords = sortedPoints
      .filter(p => p.lat && p.lon)
      .map(p => [p.lat, p.lon]);
    
    if (routeCoords.length >= 2) {
      if (state.routeLine) state.routeLine.remove();
      
      state.routeLine = L.polyline(routeCoords, {
        color: 'rgba(125, 211, 252, 0.7)',
        weight: 3,
        opacity: 0.6,
        dashArray: '10, 10',
        lineJoin: 'round'
      }).addTo(state.map);
      
      // Add arrow marker at the end
      if (L.polylineDecorator) {
        L.polylineDecorator(state.routeLine, {
          patterns: [{
            offset: '100%',
            repeat: 0,
            symbol: L.Symbol.arrowHead({
              pixelSize: 12,
              polygon: false,
              pathOptions: {
                stroke: true,
                color: 'rgba(125, 211, 252, 0.9)',
                weight: 2,
                fillOpacity: 1
              }
            })
          }]
        }).addTo(state.map);
      }
    }
  }

  function renderMap(rows) {
    if (!state.map) return;
    clearMap();

    const points = rows.filter(r => r.lat && r.lon && !isNaN(r.lat) && !isNaN(r.lon));
    
    if (!points.length) {
      el.mapLegend.textContent = 'No coordinates available in the filtered set.';
      return;
    }

    // Draw route lines
    renderRouteLines(points);

    // Create markers
    const bounds = [];
    points.forEach((r, index) => {
      const radius = acresToRadiusMeters(r.acres || 100);
      const color = getRegionColor(r.region);
      
      const circle = L.circle([r.lat, r.lon], {
        radius,
        color: color.border,
        weight: 2,
        fillColor: color.fill,
        fillOpacity: 0.7
      }).addTo(state.map);

      // Enhanced popup
      const popupContent = `
        <div class="map-popup">
          <div class="popup-header">
            <h4>${escapeHtml(r.city)} — ${escapeHtml(r.spot)}</h4>
            <div class="popup-subtitle">Day ${r.day || '?'} • ${escapeHtml(r.region)} Region</div>
          </div>
          <div class="popup-body">
            <div class="popup-stats">
              <div class="stat-row">
                <span class="stat-label">Date:</span>
                <span class="stat-value">${escapeHtml(fmt.date(r.date))}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Farmers:</span>
                <span class="stat-value">${fmt.int(r.farmers)}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Wheat Acres:</span>
                <span class="stat-value">${fmt.num(r.acres, 1)}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Definite Use:</span>
                <span class="stat-value">${fmt.pct(r.definitePct, 1)}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Awareness:</span>
                <span class="stat-value">${fmt.pct(r.awarenessPct, 1)}</span>
              </div>
            </div>
            ${r.reasonsUse ? `<div class="popup-reason"><strong>Top Reason:</strong> ${escapeHtml(r.reasonsUse)}</div>` : ''}
            ${r.reasonsNo ? `<div class="popup-reason"><strong>Concern:</strong> ${escapeHtml(r.reasonsNo)}</div>` : ''}
          </div>
          <div class="popup-actions">
            <button onclick="window.dashboardPinSession('${r.id}')" class="popup-btn">View Details</button>
          </div>
        </div>
      `;

      circle.bindPopup(popupContent);
      circle.on('click', () => {
        pinSession(r, { openMedia: true, focusMap: true });
      });

      state.circles.push(circle);
      bounds.push([r.lat, r.lon]);
    });

    // Fit map to bounds
    if (bounds.length > 0) {
      try {
        state.map.fitBounds(bounds, { padding: [50, 50] });
      } catch (_) {}
    }
    
    el.mapLegend.textContent = 'Bubble radius represents wheat acres covered. Colored by region. Click to view session details.';
  }

  // Global function for popup buttons
  window.dashboardPinSession = function(sessionId) {
    const session = state.sessions.find(s => s.id === sessionId) || 
                    state.filtered.find(s => s.id === sessionId);
    if (session) {
      pinSession(session, { openMedia: true, focusMap: true });
    }
  };

  // ---------------------------
  // Core Dashboard Functions
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

  function setBar(elBar, valuePct) {
    if (!elBar) return;
    const w = clamp(valuePct || 0, 0, 100);
    elBar.style.width = `${w}%`;
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

    setBar(el.barSessions, clamp((k.sessions / Math.max(1, state.sessions.length)) * 100, 0, 100));
    const totFarmers = sum(state.sessions, s => s.farmers);
    const totAcres = sum(state.sessions, s => s.acres);
    setBar(el.barFarmers, clamp((k.farmers / Math.max(1, totFarmers)) * 100, 0, 100));
    setBar(el.barAcres, clamp((k.acres / Math.max(1e-9, totAcres)) * 100, 0, 100));
    setBar(el.barDemo, clamp(k.defPct || 0, 0, 100));
  }

  function renderReasons(rows) {
    const splitReasons = (txt) => {
      return String(txt || '')
        .split(/[,;|]/g)
        .map(s => s.trim())
        .filter(s => s.length >= 3);
    };

    const countMap = (field) => {
      const m = new Map();
      for (const r of rows) {
        for (const part of splitReasons(r[field])) {
          const key = part.toLowerCase();
          m.set(key, (m.get(key) || 0) + 1);
        }
      }
      const sorted = Array.from(m.entries()).sort((a,b)=>b[1]-a[1]).slice(0,6);
      return sorted.map(([k,v]) => ({ label: k, count: v }));
    };

    const renderTable = (tbody, items) => {
      if (!tbody) return;
      tbody.innerHTML = items.map(it =>
        `<tr><td style="width:70%">${escapeHtml(it.label)}</td><td>${it.count}</td></tr>`
      ).join('') || `<tr><td colspan="2" class="muted">No data</td></tr>`;
    };

    renderTable(el.reasonUse, countMap('reasonsUse'));
    renderTable(el.reasonNo, countMap('reasonsNo'));
  }

  function renderSnapshot(rows) {
    const k = computeKpis(rows);
    const city = el.filterCity?.value || '';
    const spot = el.filterSpot?.value || '';
    const scope = (city || spot) ? `${city || 'All cities'}${spot ? ' → ' + spot : ''}` : 'All sessions';

    const avgAware = mean(rows, r => r.awarenessPct);
    const avgClarity = mean(rows, r => r.clarityPct);

    el.snapshot.innerHTML =
      `<div><b>Scope:</b> ${escapeHtml(scope)}</div>
       <div style="margin-top:8px" class="muted">
         Sessions: <b>${fmt.int(k.sessions)}</b> · Farmers: <b>${fmt.int(k.farmers)}</b> · Acres: <b>${fmt.num(k.acres,1)}</b><br/>
         Definite intent: <b>${fmt.pct(k.defPct,0)}</b> · Awareness: <b>${fmt.pct(avgAware,0)}</b> · Clarity: <b>${fmt.pct(avgClarity,0)}</b>
       </div>`;

    renderReasons(rows);

    const ids = [];
    if (state.pinnedSession?.sn) ids.push(String(state.pinnedSession.sn));
    for (const r of rows) {
      if (ids.length >= CONFIG.maxShowcase) break;
      if (r.sn && !ids.includes(String(r.sn))) ids.push(String(r.sn));
    }
    renderShowcase(el.snapShowcase, ids);
  }

  function renderCharts(rows) {
    if (typeof Chart === 'undefined') return;

    // City mix (doughnut)
    const byCity = new Map();
    for (const r of rows) byCity.set(r.city, (byCity.get(r.city) || 0) + (r.farmers || 0));
    const cityLabels = Array.from(byCity.keys());
    const cityVals = Array.from(byCity.values());

    if (state.charts.city) state.charts.city.destroy();
    state.charts.city = new Chart(el.chartCity, {
      type: 'doughnut',
      data: { 
        labels: cityLabels, 
        datasets: [{ 
          data: cityVals, 
          backgroundColor: [
            '#7dd3fc', '#86efac', '#fbbf24', '#a78bfa', '#f472b6',
            '#60a5fa', '#34d399', '#fbbf24', '#c084fc', '#fb7185'
          ] 
        }] 
      },
      options: { 
        responsive: true, 
        plugins: { 
          legend: { 
            position: 'bottom', 
            labels: { color: '#e7edf7' } 
          } 
        } 
      }
    });

    // Intent split (pie)
    const sumDef = sum(rows, r => r.definite);
    const sumMay = sum(rows, r => r.maybe);
    const sumNo = sum(rows, r => r.notInterested);

    if (state.charts.intent) state.charts.intent.destroy();
    state.charts.intent = new Chart(el.chartIntent, {
      type: 'pie',
      data: { 
        labels: ['Definite','Maybe','Not Interested'], 
        datasets: [{ 
          data: [sumDef, sumMay, sumNo], 
          backgroundColor: ['#86efac', '#fbbf24', '#fb7185'] 
        }] 
      },
      options: { 
        responsive: true, 
        plugins: { 
          legend: { 
            position: 'bottom', 
            labels: { color: '#e7edf7' } 
          } 
        } 
      }
    });

    // Trend (line)
    const buckets = new Map();
    for (const r of rows) {
      const d = r.date || '';
      if (!d) continue;
      if (!buckets.has(d)) buckets.set(d, { farmers:0, acres:0 });
      const b = buckets.get(d);
      b.farmers += (r.farmers || 0);
      b.acres += (r.acres || 0);
    }
    const dates = Array.from(buckets.keys()).sort((a,b) => new Date(a) - new Date(b));
    const farmersSeries = dates.map(d => buckets.get(d).farmers);
    const acresSeries = dates.map(d => buckets.get(d).acres);

    if (state.charts.trend) state.charts.trend.destroy();
    state.charts.trend = new Chart(el.chartTrend, {
      type: 'line',
      data: {
        labels: dates.map(d => fmt.date(d)),
        datasets: [
          { 
            label: 'Farmers', 
            data: farmersSeries, 
            tension: 0.25, 
            borderColor: '#7dd3fc', 
            backgroundColor: 'rgba(125,211,252,0.1)',
            borderWidth: 2
          },
          { 
            label: 'Wheat Acres', 
            data: acresSeries, 
            tension: 0.25, 
            borderColor: '#86efac', 
            backgroundColor: 'rgba(134,239,172,0.1)',
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { 
          legend: { 
            position: 'bottom', 
            labels: { color: '#e7edf7' } 
          } 
        },
        scales: {
          x: { 
            ticks: { color: '#9fb0ca' }, 
            grid: { color: 'rgba(255,255,255,.08)' } 
          },
          y: { 
            ticks: { color: '#9fb0ca' }, 
            grid: { color: 'rgba(255,255,255,.08)' } 
          }
        }
      }
    });
  }

  function renderTable(rows) {
    if (!el.tbl) return;
    el.tbl.innerHTML = rows.map(r => {
      return `<tr data-sn="${escapeHtml(r.sn || '')}" data-day="${r.day || ''}">
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

    el.tbl.querySelectorAll('tr[data-sn]').forEach(tr => {
      tr.addEventListener('click', () => {
        const sn = tr.getAttribute('data-sn');
        const session = state.filtered.find(x => String(x.sn) === String(sn)) || 
                        state.sessions.find(x => String(x.sn) === String(sn));
        if (session) pinSession(session, { openMedia:true, focusMap:true });
      });
    });
  }

  function renderShowcase(container, sessionIds) {
    if (!container) return;
    container.innerHTML = '';

    const ids = sessionIds.filter(Boolean).slice(0, CONFIG.maxShowcase);
    if (!ids.length) {
      container.innerHTML = `<div class="muted" style="grid-column:1/-1">No pinned session. Click a bubble or a session row to preview media.</div>`;
      return;
    }

    ids.forEach(id => {
      const items = (state.mediaBySessionId.get(String(id)) || []).slice(0, 1);
      const it = items[0] || { 
        sessionId: id, 
        type: 'image', 
        src: CONFIG.placeholder, 
        caption: `Session ${id}` 
      };

      const tile = document.createElement('div');
      tile.className = 'showItem';
      tile.title = it.caption || '';

      const node = makeMediaNode(it, true);
      tile.appendChild(node);

      tile.addEventListener('click', () => openLightboxForSession(String(id)));
      container.appendChild(tile);
    });
  }

  function makeMediaNode(it, mute=false) {
    const candidates = Array.isArray(it.srcCandidates) && it.srcCandidates.length
      ? it.srcCandidates.slice()
      : [it.src || CONFIG.placeholder, CONFIG.placeholder];

    if (!candidates.includes(CONFIG.placeholder)) candidates.push(CONFIG.placeholder);

    if (it.type === 'video') {
      const v = document.createElement('video');
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.autoplay = !!mute;
      v.controls = false;

      function setNextVideoSrc() {
        const next = candidates.shift();
        v.src = next || CONFIG.placeholder;
        try { v.load(); } catch(_) {}
      }

      v.addEventListener('error', () => {
        if (candidates.length) {
          setNextVideoSrc();
        } else {
          v.replaceWith(makeImageNode(CONFIG.placeholder, it.caption));
        }
      });

      setNextVideoSrc();
      return v;
    }

    return makeImageNode(candidates, it.caption);
  }

  function makeImageNode(srcOrCandidates, alt='') {
    const candidates = Array.isArray(srcOrCandidates)
      ? srcOrCandidates.slice()
      : [srcOrCandidates];

    if (!candidates.length) candidates.push(CONFIG.placeholder);
    if (!candidates.includes(CONFIG.placeholder)) candidates.push(CONFIG.placeholder);

    const img = document.createElement('img');
    img.alt = alt || '';
    img.loading = 'lazy';

    function setNext() {
      const next = candidates.shift();
      img.src = next || CONFIG.placeholder;
    }

    img.addEventListener('error', () => {
      if (candidates.length) setNext();
      else img.src = CONFIG.placeholder;
    });

    setNext();
    return img;
  }

  function renderGallery(rows) {
    if (!el.gallery) return;
    
    const ids = rows.map(r => r.sn).filter(Boolean).map(String);
    const items = [];
    for (const id of ids) {
      const arr = state.mediaBySessionId.get(id) || [];
      for (const it of arr) items.push(it);
      if (items.length >= CONFIG.maxGallery) break;
    }
    
    if (!items.length) {
      for (const id of ids.slice(0, Math.min(CONFIG.maxGallery, 12))) {
        items.push({ 
          sessionId: id, 
          type: 'image', 
          src: CONFIG.placeholder, 
          caption: `Session ${id}`, 
          transcript: '' 
        });
      }
    }
    
    const galleryItems = items.slice(0, CONFIG.maxGallery);
    el.gallery.innerHTML = '';

    galleryItems.forEach((it, idx) => {
      const tile = document.createElement('div');
      tile.className = 'mediaTile';
      tile.dataset.index = String(idx);
      tile.appendChild(makeMediaNode(it, false));

      const tag = document.createElement('div');
      tag.className = 'mediaTag';
      tag.textContent = it.caption || `Session ${it.sessionId || ''}`;
      tile.appendChild(tag);

      tile.addEventListener('click', () => openLightbox(galleryItems, idx));
      el.gallery.appendChild(tile);
    });
  }

  // ---------------------------
  // Filters
  // ---------------------------
  function populateFilters() {
    const cities = uniq(state.sessions.map(s => s.city)).sort((a,b)=>a.localeCompare(b));
    el.filterCity.innerHTML = `<option value="">All</option>` + cities.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    populateSpot();
    initDateBounds();
  }

  function populateSpot() {
    const city = el.filterCity.value;
    const rows = city ? state.sessions.filter(s => s.city === city) : state.sessions;
    const spots = uniq(rows.map(s => s.spot)).sort((a,b)=>a.localeCompare(b));
    el.filterSpot.innerHTML = `<option value="">All</option>` + spots.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
  }

  function initDateBounds() {
    const dates = state.sessions.map(s => parseISO(s.date)).filter(Boolean).sort((a,b)=>a-b);
    if (!dates.length) return;
    const min = dates[0].toISOString().slice(0,10);
    const max = dates[dates.length-1].toISOString().slice(0,10);
    el.filterFrom.value = min;
    el.filterTo.value = max;
    el.filterFrom.min = min; el.filterFrom.max = max;
    el.filterTo.min = min; el.filterTo.max = max;
  }

  function applyFilters() {
    const city = el.filterCity.value;
    const spot = el.filterSpot.value;
    const from = el.filterFrom.value;
    const to = el.filterTo.value;
    const q = (el.filterSearch.value || '').trim().toLowerCase();

    const fromDt = from ? new Date(from) : null;
    const toDt = to ? new Date(to) : null;

    let rows = state.sessions.slice();

    if (city) rows = rows.filter(r => r.city === city);
    if (spot) rows = rows.filter(r => r.spot === spot);

    if (fromDt && !isNaN(fromDt.getTime())) {
      rows = rows.filter(r => {
        const d = parseISO(r.date);
        return d ? (d >= fromDt) : true;
      });
    }
    if (toDt && !isNaN(toDt.getTime())) {
      const end = new Date(toDt.getTime() + 24*3600*1000 - 1);
      rows = rows.filter(r => {
        const d = parseISO(r.date);
        return d ? (d <= end) : true;
      });
    }

    if (q) {
      rows = rows.filter(r => {
        const hay = `${r.city} ${r.spot} ${r.reasonsUse} ${r.reasonsNo}`.toLowerCase();
        return hay.includes(q);
      });
    }

    rows.sort((a,b) => {
      const da = parseISO(a.date), db = parseISO(b.date);
      const ta = da ? da.getTime() : 0;
      const tb = db ? db.getTime() : 0;
      if (tb !== ta) return tb - ta;
      return String(a.sn||'').localeCompare(String(b.sn||''));
    });

    state.filtered = rows;

    updateSummary(rows);
    updateKpis(rows);
    renderSnapshot(rows);
    renderCharts(rows);
    renderTable(rows);
    renderMap(rows);
    updateMapBanner(rows);
    renderGallery(rows);
    
    if (state.pinnedSession) {
      const exists = rows.some(r => r.id === state.pinnedSession.id);
      if (!exists) state.pinnedSession = null;
    }

    setNotice(`<strong>Status:</strong> Ready · <b>${fmt.int(rows.length)}</b> sessions in current view.`);
  }

  function updateSummary(rows) {
    const city = el.filterCity.value || 'All cities';
    const spot = el.filterSpot.value || 'All spots';
    const from = el.filterFrom.value || '—';
    const to = el.filterTo.value || '—';
    const q = (el.filterSearch.value || '').trim();
    const k = computeKpis(rows);
    el.summary.innerHTML =
      `<b>Selection:</b> ${escapeHtml(city)} → ${escapeHtml(spot)}<br/>
       <span class="muted">${escapeHtml(from)} → ${escapeHtml(to)}${q ? ' · Search: <b>' + escapeHtml(q) + '</b>' : ''}</span><br/>
       <span class="muted">Sessions: <b>${fmt.int(k.sessions)}</b> · Farmers: <b>${fmt.int(k.farmers)}</b> · Acres: <b>${fmt.num(k.acres,1)}</b></span>`;
  }

  function resetFilters() {
    el.filterCity.value = '';
    populateSpot();
    initDateBounds();
    el.filterSearch.value = '';
    state.pinnedSession = null;
    state.currentDay = null;
    applyFilters();
  }

  // ---------------------------
  // Pin session
  // ---------------------------
  function pinSession(session, opts={ openMedia:false, focusMap:false }) {
    state.pinnedSession = session;
    updateMapBanner(state.filtered);

    if (opts.focusMap && state.map && session.lat && session.lon) {
      try {
        state.map.setView([session.lat, session.lon], 12, { animate:true });
      } catch(_) {}
    }

    if (opts.openMedia) {
      activateTab('tab-media');
      invalidateMapSoon();
      openLightboxForSession(String(session.sn));
    }
  }

  function invalidateMapSoon() {
    if (!state.map) return;
    setTimeout(() => { try{ state.map.invalidateSize(); } catch(_) {} }, 80);
  }

  // ---------------------------
  // Lightbox
  // ---------------------------
  function openLightbox(items, index) {
    state.lightbox.items = items;
    state.lightbox.index = index;
    renderLightbox();
    el.lb.style.display = 'flex';
  }

  function openLightboxForSession(sessionId) {
    const items = (state.mediaBySessionId.get(String(sessionId)) || []).filter(it => it.src);
    if (!items.length) {
      openLightbox([{ sessionId, type:'image', src: CONFIG.placeholder, caption:`Session ${sessionId}`, transcript:'' }], 0);
      return;
    }
    openLightbox(items.slice(0, 50), 0);
  }

  function closeLightbox() {
    el.lb.style.display = 'none';
    el.lbMedia.innerHTML = '';
  }

  function renderLightbox() {
    const items = state.lightbox.items || [];
    const idx = clamp(state.lightbox.index || 0, 0, Math.max(0, items.length - 1));
    state.lightbox.index = idx;

    const it = items[idx] || null;
    if (!it) return;

    el.lbCaption.textContent = it.caption || `Session ${it.sessionId || ''}`;
    el.lbTranscript.textContent = it.transcript || '—';

    el.lbMedia.innerHTML = '';
    const node = makeMediaNode(it, false);
    if (node.tagName === 'VIDEO') {
      node.controls = true;
      node.autoplay = true;
    }
    el.lbMedia.appendChild(node);

    el.lbPrev.disabled = (idx <= 0);
    el.lbNext.disabled = (idx >= items.length - 1);
  }

  // ---------------------------
  // Tabs
  // ---------------------------
  function activateTab(tabId) {
    $$('.tabBtn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    $$('.tabPanel').forEach(p => p.classList.toggle('active', p.id === tabId));
    if (tabId === 'tab-map') invalidateMapSoon();
  }

  // ---------------------------
  // Diagnostics
  // ---------------------------
  const diagLines = [];
  function logDiag(line) {
    diagLines.push(`[${new Date().toISOString()}] ${line}`);
    if (diagLines.length > 200) diagLines.shift();
    setDiag(diagLines.slice(-40));
  }

  // ---------------------------
  // Boot
  // ---------------------------
  async function boot() {
    try {
      setLoadingStatus('Initializing UI…');

      clearError();
      
      // Bind UI events
      bindTabs();
      bindLightbox();

      el.shell.style.display = 'grid';
      el.shell.classList.add('ready');

      el.buildStamp.textContent = `build ${new Date().toISOString().slice(0,10)}`;

      // Filters events
      el.filterCity.addEventListener('change', () => { 
        populateSpot(); 
        state.pinnedSession = null; 
        applyFilters(); 
      });
      el.filterSpot.addEventListener('change', () => { 
        state.pinnedSession = null; 
        applyFilters(); 
      });
      el.filterFrom.addEventListener('change', () => applyFilters());
      el.filterTo.addEventListener('change', () => applyFilters());
      el.filterSearch.addEventListener('input', debounce(applyFilters, 220));
      el.btnReset.addEventListener('click', resetFilters);

      // Export button
      el.btnExport.addEventListener('click', () => {
        const rows = state.filtered.slice().reverse();
        const csv = toCsv(rows, [
          { label:'SN', get:r => r.sn },
          { label:'Day', get:r => r.day },
          { label:'Date', get:r => r.date },
          { label:'City', get:r => r.city },
          { label:'Spot', get:r => r.spot },
          { label:'Region', get:r => r.region },
          { label:'Farmers', get:r => r.farmers },
          { label:'Wheat Acres', get:r => r.acres },
          { label:'Definite', get:r => r.definite },
          { label:'Maybe', get:r => r.maybe },
          { label:'Not Interested', get:r => r.notInterested },
          { label:'Know Buctril', get:r => r.knowBuctril },
          { label:'Used Last Year', get:r => r.usedLastYear },
          { label:'Definite %', get:r => r.definitePct },
          { label:'Awareness %', get:r => r.awarenessPct },
          { label:'Clarity %', get:r => r.clarityPct },
          { label:'Lat', get:r => r.lat },
          { label:'Lon', get:r => r.lon },
          { label:'Top reason to use', get:r => r.reasonsUse },
          { label:'Top reason not to use', get:r => r.reasonsNo },
        ]);
        downloadText('buctril_super_sessions_export.csv', csv, 'text/csv');
      });

      // Init map
      initMap();

      // Load data
      setNotice('<strong>Status:</strong> Loading data…');
      logDiag('Starting data load...');

      const sessions = await loadSessions();
      state.sessions = sessions;

      logDiag(`sessions loaded: ${sessions.length}`);

      const media = await loadMedia(sessions);
      logDiag(`media items loaded: ${media.length}`);

      // Populate and render
      populateFilters();
      renderCampaignOverview();
      renderDayNavigation();
      applyFilters();

      // Done
      setLoadingStatus('Ready');
      el.overlay.style.opacity = '0';
      setTimeout(() => { el.overlay.style.display = 'none'; }, 250);

    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      showError(`<b>Dashboard failed to load.</b><br/><br/>${escapeHtml(msg)}<br/><br/>
        <b>Quick checks:</b><br/>
        1) Verify sessions.json and media.json exist<br/>
        2) Check browser DevTools → Console for errors<br/>
        3) Ensure all assets are properly hosted`);
      setNotice('<strong>Status:</strong> Error');
      logDiag(`boot error: ${msg}`);

      el.shell.style.display = 'grid';
      el.shell.classList.add('ready');
      el.overlay.style.display = 'none';
    }
  }

  function bindTabs() {
    $$('.tabBtn').forEach(btn => {
      btn.addEventListener('click', () => activateTab(btn.dataset.tab));
    });
  }

  function bindLightbox() {
    if (!el.lb) return;
    el.lbClose.addEventListener('click', closeLightbox);
    el.lbPrev.addEventListener('click', () => { state.lightbox.index--; renderLightbox(); });
    el.lbNext.addEventListener('click', () => { state.lightbox.index++; renderLightbox(); });
    el.lb.addEventListener('click', (e) => {
      if (e.target === el.lb) closeLightbox();
    });
    window.addEventListener('keydown', (e) => {
      if (el.lb.style.display !== 'flex') return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') { state.lightbox.index--; renderLightbox(); }
      if (e.key === 'ArrowRight') { state.lightbox.index++; renderLightbox(); }
    });
  }

  function debounce(fn, ms) {
    let t = null;
    return (...args) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
