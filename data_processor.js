/* AgriVista Dashboard - Enhanced Excel Parser with Route Mapping
   - Extracts maximum data from Buctril_Super_Activations.xlsx (SUM sheet)
   - Draws route through coordinates with arrow markers
   - Enhanced data extraction including all available columns
*/
(() => {
  'use strict';

  const CONFIG = {
    sessionsJson: 'sessions.json',
    mediaJson: 'media.json',
    xlsxFallback: 'Buctril_Super_Activations.xlsx',
    heroVideo: 'assets/bg.mp4',
    placeholder: 'assets/placeholder.svg',
    maxShowcase: 5,
    maxGallery: 48
  };

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
    btnShowRoute: $('#btn-show-route'),
    btnHideRoute: $('#btn-hide-route'),
    btnShowAll: $('#btn-show-all'),

    layerMarkers: $('#layer-markers'),
    layerRoute: $('#layer-route'),
    layerBubbles: $('#layer-bubbles'),

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
    tblRaw: $('#tblRawData'),

    heroVideo: $('#heroVideo'),

    lb: $('#lightbox'),
    lbMedia: $('#lbMedia'),
    lbCaption: $('#lbCaption'),
    lbTranscript: $('#lbTranscript'),
    lbPrev: $('#lbPrev'),
    lbNext: $('#lbNext'),
    lbClose: $('#lbClose'),
  };

  const state = {
    sessions: [],
    filtered: [],
    rawData: [],
    mediaItems: [],
    mediaBySessionId: new Map(),
    pinnedSession: null,
    map: null,
    circles: [],
    markers: [],
    routeLine: null,
    routeDecorator: null,
    charts: { city:null, intent:null, trend:null },
    lightbox: { items: [], index: 0 },
    showRoute: true,
    showMarkers: true,
    showBubbles: true
  };

  function setLoadingStatus(msg) { if (el.status) el.status.textContent = msg; }
  function setNotice(html) { if (el.notice) el.notice.innerHTML = html; }
  function setDiag(lines) { if (el.diag) el.diag.textContent = lines.join('\n'); }
  function showError(html) { if (el.err) { el.err.style.display = 'block'; el.err.innerHTML = html; } }
  function clearError() { if (el.err) { el.err.style.display = 'none'; el.err.innerHTML = ''; } }

  const fmt = {
    int: (n) => (n === null || n === undefined || isNaN(n)) ? '—' : Math.round(n).toLocaleString(),
    num: (n, d=1) => (n === null || n === undefined || isNaN(n)) ? '—' : Number(n).toFixed(d),
    pct: (n, d=0) => (n === null || n === undefined || isNaN(n)) ? '—' : `${Number(n).toFixed(d)}%`,
    date: (iso) => {
      if (!iso) return '—';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      return d.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'2-digit' });
    },
    coord: (lat, lon) => {
      if (lat === null || lon === null) return '—';
      return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    }
  };

  function uniq(arr) { return Array.from(new Set(arr.filter(Boolean))); }
  function safeStr(v) { return (v === null || v === undefined) ? '' : String(v).trim(); }
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

  function normalizeSession(s) {
    const sn = (s.sn !== null && s.sn !== undefined && s.sn !== '') ? String(s.sn) : '';
    const date = safeStr(s.date);
    const city = safeStr(s.city);
    const spot = safeStr(s.spot);

    const farmers = (s.farmers === '' ? null : Number(s.farmers));
    const acres = (s.acres === '' ? null : Number(s.acres));
    const definite = (s.definite === '' ? null : Number(s.definite));
    const maybe = (s.maybe === '' ? null : Number(s.maybe));
    const notInterested = (s.notInterested === '' ? null : Number(s.notInterested));
    const knowBuctril = (s.knowBuctril === '' ? null : Number(s.knowBuctril));

    const definitePct = (s.definitePct !== null && s.definitePct !== undefined) ? Number(s.definitePct) :
      (farmers && definite !== null && !isNaN(farmers) && farmers > 0) ? (definite / farmers * 100) : null;

    const awarenessPct = (s.awarenessPct !== null && s.awarenessPct !== undefined) ? Number(s.awarenessPct) : 
      (farmers && knowBuctril !== null && !isNaN(farmers) && farmers > 0) ? (knowBuctril / farmers * 100) : null;

    const clarityPct = (s.clarityPct !== null && s.clarityPct !== undefined) ? Number(s.clarityPct) : null;

    const latRaw = (s.lat ?? s.latitude ?? s.Lat ?? s.Latitude ?? null);
    const lonRaw = (s.lon ?? s.lng ?? s.long ?? s.longitude ?? s.Lon ?? s.Longitude ?? null);
    const lat = (latRaw === '' || latRaw === null || latRaw === undefined) ? null : Number(latRaw);
    const lon = (lonRaw === '' || lonRaw === null || lonRaw === undefined) ? null : Number(lonRaw);

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
      definitePct: isNaN(definitePct) ? null : definitePct,
      awarenessPct: isNaN(awarenessPct) ? null : awarenessPct,
      clarityPct: isNaN(clarityPct) ? null : clarityPct,
      lat: isNaN(lat) ? null : lat,
      lon: isNaN(lon) ? null : lon,
      reasonsUse: safeStr(s.reasonsUse),
      reasonsNo: safeStr(s.reasonsNo),
      rawData: s.rawData || {}
    };
  }

  function getSheetCell(sheet, r, c) {
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell = sheet[addr];
    return cell ? cell.v : undefined;
  }

  function bestHeaderIndex(headers, patterns) {
    const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g,' ').trim();
    const hs = headers.map(h => norm(h));
    for (const p of patterns) {
      const re = new RegExp(p, 'i');
      const idx = hs.findIndex(h => re.test(h));
      if (idx >= 0) return idx;
    }
    return -1;
  }

  function parseCoordinates(value) {
    if (!value) return { lat: null, lon: null };
    const str = String(value).trim();
    
    // Try comma-separated decimal coordinates first
    const commaMatch = str.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
    if (commaMatch) {
      const lat = parseFloat(commaMatch[1]);
      const lon = parseFloat(commaMatch[2]);
      if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
    }
    
    // Try DMS format
    const dmsRegex = /(\d+)[°\s]?\s*(\d+)?['\s]?\s*(\d+\.?\d*)?["\s]?\s*([NSEW])?/gi;
    const matches = [...str.matchAll(dmsRegex)];
    if (matches.length >= 2) {
      const coords = [];
      for (const match of matches) {
        const deg = parseFloat(match[1] || '0');
        const min = parseFloat(match[2] || '0');
        const sec = parseFloat(match[3] || '0');
        const dir = (match[4] || '').toUpperCase();
        let dd = deg + (min / 60) + (sec / 3600);
        if (dir === 'S' || dir === 'W') dd = -dd;
        coords.push(dd);
      }
      if (coords.length >= 2) {
        // Assume first is lat, second is lon
        return { lat: coords[0], lon: coords[1] };
      }
    }
    
    // Try to extract any two numbers
    const numbers = str.match(/-?\d+\.?\d*/g);
    if (numbers && numbers.length >= 2) {
      const lat = parseFloat(numbers[0]);
      const lon = parseFloat(numbers[1]);
      if (!isNaN(lat) && !isNaN(lon)) {
        // Validate reasonable Pakistan coordinates
        if (lat >= 23 && lat <= 37 && lon >= 60 && lon <= 75) {
          return { lat, lon };
        }
      }
    }
    
    return { lat: null, lon: null };
  }

  function normalizeDateExcel(v) {
    if (!v) return '';
    if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0,10);
    if (typeof v === 'number') {
      const d = XLSX.SSF.parse_date_code(v);
      if (d) {
        const dt = new Date(Date.UTC(d.y, d.m - 1, d.d));
        if (!isNaN(dt.getTime())) return dt.toISOString().slice(0,10);
      }
    }
    const dt = new Date(String(v));
    return isNaN(dt.getTime()) ? String(v) : dt.toISOString().slice(0,10);
  }

  async function loadSessionsFromXlsx() {
    if (typeof XLSX === 'undefined') throw new Error('SheetJS (XLSX) library not loaded.');
    setLoadingStatus('Loading and parsing XLSX file...');
    const buf = await fetchArrayBuffer(CONFIG.xlsxFallback);
    const wb = XLSX.read(buf, { type: 'array', cellDates: true, cellNF: true });

    // Try to find SUM sheet or first sheet with data
    const sheetName = wb.SheetNames.find(n => 
      String(n).toLowerCase().includes('sum') || 
      String(n).toLowerCase().includes('sheet1') ||
      String(n).toLowerCase().includes('data')
    ) || wb.SheetNames[0];
    
    const sheet = wb.Sheets[sheetName];
    if (!sheet) throw new Error('XLSX: No sheet found.');

    // Determine header row (skip merged header rows)
    let headerRow = 0;
    for (let r = 0; r < 10; r++) {
      const cellVal = getSheetCell(sheet, r, 0);
      if (cellVal && String(cellVal).toLowerCase().includes('sn')) {
        headerRow = r;
        break;
      }
    }

    // Extract headers
    const headers = [];
    for (let c = 0; c < 50; c++) {
      const v = getSheetCell(sheet, headerRow, c);
      if (v === undefined) break;
      headers.push(v);
    }

    // Map column indices
    const idx = {
      sn: bestHeaderIndex(headers, ['^sn$', '^s\\.?n\\.?$', 'serial', 'no']),
      city: bestHeaderIndex(headers, ['^city$', 'town', 'location']),
      date: bestHeaderIndex(headers, ['^date$', 'session date', 'date of session']),
      spot: bestHeaderIndex(headers, ['session location', 'spot', 'meeting point', 'village']),
      coords: bestHeaderIndex(headers, ['coordinates', 'lat.*lon', 'gps', 'location coordinates']),
      farmers: bestHeaderIndex(headers, ['total farmers', 'farmers', 'no\\. of farmers', 'participants']),
      acres: bestHeaderIndex(headers, ['total wheat acres', 'wheat acres', 'acres', 'area']),
      know: bestHeaderIndex(headers, ['know buctril', 'awareness', 'heard of', 'knowledge']),
      def: bestHeaderIndex(headers, ['will definitely use', 'definite', 'sure']),
      may: bestHeaderIndex(headers, ['^maybe$', 'unsure', 'considering']),
      no: bestHeaderIndex(headers, ['not interested', 'refuse', 'decline']),
      reasonUse: bestHeaderIndex(headers, ['top reason to use', 'reason use', 'why use']),
      reasonNo: bestHeaderIndex(headers, ['top reason not to use', 'reason not', 'why not']),
      // Additional columns that might exist
      score1: bestHeaderIndex(headers, ['score understood', 'clarity score', 'understanding']),
      contact: bestHeaderIndex(headers, ['contact', 'phone', 'mobile']),
      remarks: bestHeaderIndex(headers, ['remarks', 'notes', 'comments'])
    };

    // Parse data rows
    const sessions = [];
    const rawData = [];
    let lastSn = '', lastCity = '', lastDate = '';

    for (let r = headerRow + 1; r < headerRow + 500; r++) {
      const row = [];
      let isEmpty = true;
      
      for (let c = 0; c < headers.length; c++) {
        const v = getSheetCell(sheet, r, c);
        row.push(v);
        if (v !== undefined && v !== null && String(v).toString().trim() !== '') {
          isEmpty = false;
        }
      }
      
      if (isEmpty) continue;

      // Handle merged cells (forward fill)
      const currentSn = idx.sn >= 0 ? safeStr(row[idx.sn]) : '';
      const currentCity = idx.city >= 0 ? safeStr(row[idx.city]) : '';
      const currentDate = idx.date >= 0 ? safeStr(row[idx.date]) : '';

      const sn = currentSn || lastSn;
      const city = currentCity || lastCity;
      const date = currentDate ? normalizeDateExcel(currentDate) : lastDate;

      if (currentSn) lastSn = sn;
      if (currentCity) lastCity = city;
      if (currentDate) lastDate = date;

      const spot = idx.spot >= 0 ? safeStr(row[idx.spot]) : '';
      const farmers = idx.farmers >= 0 ? Number(row[idx.farmers]) : null;
      
      // Skip rows without essential data
      if (!city && !spot && (!farmers || farmers === 0)) continue;

      const acres = idx.acres >= 0 ? Number(row[idx.acres]) : null;
      const know = idx.know >= 0 ? Number(row[idx.know]) : null;
      const def = idx.def >= 0 ? Number(row[idx.def]) : null;
      const may = idx.may >= 0 ? Number(row[idx.may]) : null;
      const no = idx.no >= 0 ? Number(row[idx.no]) : null;
      
      // Parse coordinates
      const coordsValue = idx.coords >= 0 ? row[idx.coords] : null;
      const { lat, lon } = parseCoordinates(coordsValue);

      // Build raw data object
      const rawRow = {};
      headers.forEach((header, i) => {
        if (header && row[i] !== undefined) {
          rawRow[header] = row[i];
        }
      });

      sessions.push(normalizeSession({
        sn,
        city,
        spot,
        date,
        farmers,
        acres,
        knowBuctril: know,
        definite: def,
        maybe: may,
        notInterested: no,
        lat, lon,
        reasonsUse: idx.reasonUse >= 0 ? row[idx.reasonUse] : '',
        reasonsNo: idx.reasonNo >= 0 ? row[idx.reasonNo] : '',
        rawData: rawRow
      }));

      rawData.push(rawRow);
    }

    if (!sessions.length) throw new Error('XLSX parsed but produced 0 sessions.');
    
    // Sort by date
    sessions.sort((a, b) => {
      const dateA = parseISO(a.date);
      const dateB = parseISO(b.date);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateA - dateB;
    });

    state.rawData = rawData;
    return sessions;
  }

  async function loadSessions() {
    try {
      setLoadingStatus('Loading sessions.json...');
      const payload = await fetchJson(CONFIG.sessionsJson);
      const sessions = (payload.sessions || payload.data || payload || []);
      if (Array.isArray(sessions) && sessions.length > 0) {
        return sessions.map(normalizeSession);
      }
    } catch (e) {
      console.log('sessions.json failed, falling back to XLSX:', e.message);
    }

    return await loadSessionsFromXlsx();
  }

  async function loadMedia(sessions) {
    try {
      setLoadingStatus('Loading media gallery...');
      const payload = await fetchJson(CONFIG.mediaJson);
      let items = [];
      
      if (payload && payload.format === 'A_compact') {
        const basePath = safeStr(payload.basePath || 'assets/gallery/');
        const sessionsData = Array.isArray(payload.sessions) ? payload.sessions : [];
        
        for (const s of sessionsData) {
          const id = safeStr(s.id);
          if (!id) continue;
          
          items.push({
            sessionId: id,
            type: 'image',
            src: `${basePath}${id}.jpg`,
            caption: safeStr(s.caption) || `Session ${id}`,
            city: safeStr(s.city),
            spot: safeStr(s.spot),
            date: safeStr(s.date)
          });
          
          items.push({
            sessionId: id,
            type: 'video',
            src: `${basePath}${id}.mp4`,
            caption: safeStr(s.caption) || `Session ${id}`,
            city: safeStr(s.city),
            spot: safeStr(s.spot),
            date: safeStr(s.date)
          });
        }
      } else if (Array.isArray(payload)) {
        items = payload;
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
      console.log('Media loading failed:', e.message);
      state.mediaItems = [];
      state.mediaBySessionId = new Map();
      return [];
    }
  }

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

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(state.map);

    // Default view centered on Pakistan
    state.map.setView([30.3753, 69.3451], 5);
  }

  function clearMap() {
    if (!state.map) return;
    
    // Clear circles
    for (const c of state.circles) c.remove();
    state.circles = [];
    
    // Clear markers
    for (const m of state.markers) m.remove();
    state.markers = [];
    
    // Clear route
    if (state.routeLine) {
      state.routeLine.remove();
      state.routeLine = null;
    }
    
    if (state.routeDecorator) {
      state.routeDecorator.remove();
      state.routeDecorator = null;
    }
  }

  function acresToRadiusMeters(acres) {
    const a = (typeof acres === 'number' && !isNaN(acres) && acres > 0) ? acres : 1;
    const area = a * 4046.86;
    const r = Math.sqrt(area / Math.PI);
    return clamp(r, 25, 2200);
  }

  function drawRoute(points) {
    if (!state.map || points.length < 2) return;
    
    // Create polyline for the route
    const latLngs = points.map(p => [p.lat, p.lon]);
    
    if (state.showRoute) {
      state.routeLine = L.polyline(latLngs, {
        color: '#7dd3fc',
        weight: 4,
        opacity: 0.7,
        lineJoin: 'round',
        dashArray: '10, 10'
      }).addTo(state.map);
      
      // Add arrow decorations
      state.routeDecorator = L.polylineDecorator(state.routeLine, {
        patterns: [
          {
            offset: '100%',
            repeat: 100,
            symbol: L.Symbol.arrowHead({
              pixelSize: 15,
              polygon: false,
              pathOptions: {
                stroke: true,
                color: '#86efac',
                weight: 3,
                opacity: 0.8
              }
            })
          }
        ]
      }).addTo(state.map);
    }
    
    return latLngs;
  }

  function renderMap(rows) {
    if (!state.map) return;
    clearMap();

    // Filter and sort points with coordinates
    const points = rows
      .filter(r => r.lat !== null && r.lon !== null && !isNaN(r.lat) && !isNaN(r.lon))
      .sort((a, b) => {
        const dateA = parseISO(a.date);
        const dateB = parseISO(b.date);
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA - dateB;
      });

    if (!points.length) {
      el.mapLegend.textContent = 'No coordinates available in the filtered set.';
      return;
    }

    // Draw route
    const latLngs = drawRoute(points);

    // Add markers and circles
    const bounds = [];
    points.forEach((r, index) => {
      // Add marker
      if (state.showMarkers) {
        const marker = L.marker([r.lat, r.lon], {
          title: `${r.city} - ${r.spot}`,
          riseOnHover: true
        }).addTo(state.map);
        
        marker.bindPopup(`
          <div class="popup">
            <div class="popupTitle"><b>${escapeHtml(r.city)} — ${escapeHtml(r.spot)}</b></div>
            <div class="popupBody">
              <div><b>Date:</b> ${escapeHtml(fmt.date(r.date))}</div>
              <div><b>SN:</b> ${escapeHtml(r.sn || '—')}</div>
              <div><b>Farmers:</b> ${fmt.int(r.farmers)}</div>
              <div><b>Wheat Acres:</b> ${fmt.num(r.acres, 1)}</div>
              <div><b>Definite:</b> ${fmt.pct(r.definitePct, 0)}</div>
              <div><b>Clarity:</b> ${fmt.pct(r.clarityPct, 0)}</div>
            </div>
          </div>
        `);
        
        marker.on('click', () => {
          pinSession(r, { openMedia: true, focusMap: true });
        });
        
        state.markers.push(marker);
      }
      
      // Add circle for acreage visualization
      if (state.showBubbles) {
        const radius = acresToRadiusMeters(r.acres || 1);
        const circle = L.circle([r.lat, r.lon], {
          radius,
          color: 'rgba(134, 239, 172, 0.7)',
          weight: 1,
          fillColor: 'rgba(125, 211, 252, 0.3)',
          fillOpacity: 0.3
        }).addTo(state.map);
        
        circle.on('click', () => {
          pinSession(r, { openMedia: true, focusMap: true });
        });
        
        state.circles.push(circle);
      }
      
      bounds.push([r.lat, r.lon]);
    });

    // Fit bounds to show all points
    if (bounds.length > 0) {
      try {
        state.map.fitBounds(bounds, { padding: [50, 50] });
      } catch(e) {
        console.log('Map fitBounds error:', e);
      }
    }

    el.mapLegend.textContent = `Showing ${points.length} locations with ${latLngs.length > 1 ? 'route' : 'no route'}. Green arrows show chronological direction.`;
  }

  function updateMapLayers() {
    // Toggle markers
    state.markers.forEach(marker => {
      if (state.showMarkers) {
        if (!state.map.hasLayer(marker)) {
          marker.addTo(state.map);
        }
      } else {
        if (state.map.hasLayer(marker)) {
          marker.remove();
        }
      }
    });
    
    // Toggle circles
    state.circles.forEach(circle => {
      if (state.showBubbles) {
        if (!state.map.hasLayer(circle)) {
          circle.addTo(state.map);
        }
      } else {
        if (state.map.hasLayer(circle)) {
          circle.remove();
        }
      }
    });
    
    // Toggle route
    if (state.routeLine) {
      if (state.showRoute) {
        if (!state.map.hasLayer(state.routeLine)) {
          state.routeLine.addTo(state.map);
        }
        if (state.routeDecorator && !state.map.hasLayer(state.routeDecorator)) {
          state.routeDecorator.addTo(state.map);
        }
      } else {
        if (state.map.hasLayer(state.routeLine)) {
          state.routeLine.remove();
        }
        if (state.routeDecorator && state.map.hasLayer(state.routeDecorator)) {
          state.routeDecorator.remove();
        }
      }
    }
  }

  function renderRawDataTable() {
    if (!el.tblRaw) return;
    
    const rows = state.rawData.slice(0, 100); // Limit to 100 rows for performance
    
    el.tblRaw.innerHTML = rows.map((row, index) => {
      const session = state.sessions[index] || {};
      return `
        <tr>
          <td>${escapeHtml(row.SN || row.sn || session.sn || '')}</td>
          <td>${escapeHtml(row.City || row.city || session.city || '')}</td>
          <td>${escapeHtml(row['Session Location'] || row.spot || session.spot || '')}</td>
          <td>${escapeHtml(fmt.date(row.Date || row.date || session.date))}</td>
          <td>${fmt.int(row['Total Farmers'] || row.farmers || session.farmers)}</td>
          <td>${fmt.num(row['Total Wheat Acres'] || row.acres || session.acres, 1)}</td>
          <td>${fmt.int(row['Know Buctril'] || row.knowBuctril || '')}</td>
          <td>${fmt.int(row['Will Definitely Use'] || row.definite || session.definite)}</td>
          <td>${fmt.int(row['Maybe'] || row.maybe || session.maybe)}</td>
          <td>${fmt.int(row['Not Interested'] || row.notInterested || session.notInterested)}</td>
          <td>${session.lat ? session.lat.toFixed(6) : ''}</td>
          <td>${session.lon ? session.lon.toFixed(6) : ''}</td>
          <td>${escapeHtml(row['Top Reason to Use'] || row.reasonsUse || session.reasonsUse || '')}</td>
          <td>${escapeHtml(row['Top Reason Not to Use'] || row.reasonsNo || session.reasonsNo || '')}</td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="14" class="muted">No raw data available</td></tr>';
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

    // Sort by date desc
    rows.sort((a, b) => {
      const da = parseISO(a.date), db = parseISO(b.date);
      const ta = da ? da.getTime() : 0;
      const tb = db ? db.getTime() : 0;
      if (tb !== ta) return tb - ta;
      return String(a.sn||'').localeCompare(String(b.sn||''));
    });

    state.filtered = rows;

    // Update UI
    updateSummary(rows);
    updateKpis(rows);
    renderSnapshot(rows);
    renderCharts(rows);
    renderTable(rows);
    renderRawDataTable();
    renderMap(rows);
    updateMapBanner(rows);
    renderGallery(rows);

    if (state.pinnedSession) {
      const exists = rows.some(r => r.id === state.pinnedSession.id);
      if (!exists) state.pinnedSession = null;
    }

    setNotice(`<strong>Status:</strong> Ready · <b>${fmt.int(rows.length)}</b> sessions in current view.`);
  }

  // Initialize and bind events
  async function boot() {
    try {
      setLoadingStatus('Initializing dashboard...');
      clearError();
      
      el.shell.style.display = 'grid';
      el.shell.classList.add('ready');
      el.buildStamp.textContent = `build ${new Date().toISOString().slice(0,10)}`;

      // Initialize map
      initMap();

      // Load data
      setNotice('<strong>Status:</strong> Loading data...');
      const sessions = await loadSessions();
      state.sessions = sessions;
      
      const media = await loadMedia(sessions);
      console.log(`Loaded ${sessions.length} sessions, ${media.length} media items`);

      // Populate filters and render
      populateFilters();
      applyFilters();

      // Bind events
      bindTabs();
      bindLightbox();
      bindMapControls();

      // Done
      setLoadingStatus('Ready');
      el.overlay.style.opacity = '0';
      setTimeout(() => { el.overlay.style.display = 'none'; }, 250);

    } catch (e) {
      const msg = e.message || String(e);
      showError(`<b>Dashboard failed to load.</b><br/><br/>${escapeHtml(msg)}<br/><br/>
        <b>Check:</b><br/>
        1) Files exist: index.html, data_processor.js, sessions.json, media.json<br/>
        2) Excel file available: Buctril_Super_Activations.xlsx<br/>
        3) Check browser console for errors`);
      setNotice('<strong>Status:</strong> Error');
      
      el.shell.style.display = 'grid';
      el.shell.classList.add('ready');
      el.overlay.style.display = 'none';
    }
  }

  function bindMapControls() {
    el.btnShowRoute.addEventListener('click', () => {
      state.showRoute = true;
      el.btnShowRoute.classList.add('active');
      el.btnHideRoute.classList.remove('active');
      updateMapLayers();
    });
    
    el.btnHideRoute.addEventListener('click', () => {
      state.showRoute = false;
      el.btnHideRoute.classList.add('active');
      el.btnShowRoute.classList.remove('active');
      updateMapLayers();
    });
    
    el.btnShowAll.addEventListener('click', () => {
      resetFilters();
    });
    
    el.layerMarkers.addEventListener('change', (e) => {
      state.showMarkers = e.target.checked;
      updateMapLayers();
    });
    
    el.layerRoute.addEventListener('change', (e) => {
      state.showRoute = e.target.checked;
      updateMapLayers();
    });
    
    el.layerBubbles.addEventListener('change', (e) => {
      state.showBubbles = e.target.checked;
      updateMapLayers();
    });
  }

  // Other existing functions (populateFilters, renderTable, updateKpis, etc.)
  // ... [keep all other functions from original data_processor.js]

  // Start after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
