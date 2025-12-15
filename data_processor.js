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
  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
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
    mediaBySessionId: new Map(), // sessionId -> media[]
    pinnedSession: null,

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
    const buf = await res.arrayBuffer();
    // LFS pointer detection: if the payload is small and looks like text
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
  // Data loading
  // ---------------------------
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
    const definitePct = (s.definitePct !== null && s.definitePct !== undefined) ? Number(s.definitePct) :
      (farmers && definite !== null && !isNaN(farmers) && farmers > 0) ? (definite / farmers * 100) : null;
    const awarenessPct = (s.awarenessPct !== null && s.awarenessPct !== undefined) ? Number(s.awarenessPct) : null;
    const clarityPct = (s.clarityPct !== null && s.clarityPct !== undefined) ? Number(s.clarityPct) : null;

    const lat = (s.lat === '' ? null : Number(s.lat));
    const lon = (s.lon === '' ? null : Number(s.lon));

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
      definitePct: isNaN(definitePct) ? null : definitePct,
      awarenessPct: isNaN(awarenessPct) ? null : awarenessPct,
      clarityPct: isNaN(clarityPct) ? null : clarityPct,
      lat: isNaN(lat) ? null : lat,
      lon: isNaN(lon) ? null : lon,
      reasonsUse: safeStr(s.reasonsUse),
      reasonsNo: safeStr(s.reasonsNo),
    };
  }

  async function loadSessionsPreferred() {
    // 1) sessions.json
    try {
      setLoadingStatus('Loading sessions.json…');
      const payload = await fetchJson(CONFIG.sessionsJson);
      const sessions = (payload.sessions || payload.data || payload || []);
      if (!Array.isArray(sessions) || sessions.length === 0) throw new Error('sessions.json is empty or invalid.');
      return sessions.map(normalizeSession);
    } catch (e) {
      // keep error; fallback to xlsx
      logDiag(`sessions.json failed: ${e.message}`);
      return null;
    }
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

  function parseDmsToDd(s) {
    if (!s) return null;
    const str = String(s).trim();
    if (!str) return null;

    // decimals like "31.123, 73.456"
    const m = str.match(/-?\d+(\.\d+)?/g);
    if (m && m.length === 1 && !/[NSEW]/i.test(str)) {
      const v = parseFloat(m[0]);
      return isNaN(v) ? null : v;
    }

    // DMS like 31°23'28.5"N
    const mm = str.match(/(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)?\D*(\d+(?:\.\d+)?)?\D*([NSEW])/i);
    if (!mm) return null;

    const deg = parseFloat(mm[1]);
    const min = parseFloat(mm[2] || '0');
    const sec = parseFloat(mm[3] || '0');
    let dd = deg + min/60 + sec/3600;
    const dir = (mm[4] || '').toUpperCase();
    if (dir === 'S' || dir === 'W') dd *= -1;

    return isNaN(dd) ? null : dd;
  }

  async function loadSessionsXlsx() {
    if (typeof XLSX === 'undefined') return null;

    try {
      setLoadingStatus(`Loading XLSX fallback: ${CONFIG.xlsxFallback}…`);
      const buf = await fetchArrayBuffer(CONFIG.xlsxFallback);
      const wb = XLSX.read(buf, { type: 'array', cellDates: true, cellNF: false, cellText: false });
      
      const sheetName = wb.SheetNames.find(n => String(n).toLowerCase() === 'sum') || wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      if (!sheet) throw new Error('XLSX: SUM sheet not found.');

      // Build header row (assume row index 1 in 0-based == row 2 in Excel)
      const headerRow = 1;
      const headers = [];
      for (let c = 0; c < 220; c++) {
        const v = getSheetCell(sheet, headerRow, c);
        if (v === undefined) break;
        headers.push(v);
      }
      
      const idx = {
        sn: bestHeaderIndex(headers, ['^sn$','^s\\.?n\\.?$']),
        city: bestHeaderIndex(headers, ['^city$','^district$']),
        spot: bestHeaderIndex(headers, ['^spot$','^location$']),
        date: bestHeaderIndex(headers, ['^date$','^session\\s*date$']),
        farmers: bestHeaderIndex(headers, ['^farmers$','^total\\s*farmers$']),
        acres: bestHeaderIndex(headers, ['^acres$','^total\\s*acres$']),
        def: bestHeaderIndex(headers, ['definite', 'def\\.?']),
        may: bestHeaderIndex(headers, ['maybe', 'may\\.?']),
        no: bestHeaderIndex(headers, ['not\\s*interested', 'no\\s*int\\.?']),
        know: bestHeaderIndex(headers, ['awareness', 'know', 'heard\\s*before']),
        lat: bestHeaderIndex(headers, ['lat\\.?']),
        lon: bestHeaderIndex(headers, ['lon\\.?']),
        reasonsUse: bestHeaderIndex(headers, ['reason.*use', 'positive\\s*feedback']),
        reasonsNo: bestHeaderIndex(headers, ['reason.*no', 'negative\\s*feedback']),
      };
      
      // Look for clarity/score columns
      const scorePatterns = ['score', 'clarity', 'understood'];
      const scoreIdxs = [];
      for (let c = 0; c < headers.length; c++) {
        const h = String(headers[c] || '').toLowerCase();
        if (scorePatterns.some(p => h.includes(p))) {
          scoreIdxs.push(c);
        }
      }

      const sessions = [];
      const dataStartRow = 2; // Data starts at row 3 (index 2)
      for (let r = dataStartRow; ; r++) {
        const row = headers.map((_, c) => getSheetCell(sheet, r, c));
        const sn = idx.sn >= 0 ? row[idx.sn] : null;
        const dateRaw = idx.date >= 0 ? row[idx.date] : null;

        // Stop if essential row data is missing (assuming SN and Date are required)
        if (!sn && !dateRaw) break;
        if (r > 5000) break; // Safety break

        const farmers = idx.farmers >= 0 ? Number(row[idx.farmers]) : null;
        const definite = idx.def >= 0 ? Number(row[idx.def]) : null;
        const maybe = idx.may >= 0 ? Number(row[idx.may]) : null;
        const no = idx.no >= 0 ? Number(row[idx.no]) : null;
        const know = idx.know >= 0 ? Number(row[idx.know]) : null;

        // Calculate awarenessPct (if 'know' is a count)
        let awarenessPct = null;
        if (farmers && !isNaN(farmers) && farmers > 0 && know !== null && !isNaN(know)) {
          awarenessPct = (know <= farmers) ? (know / farmers * 100) : (know <= 100 ? know : null);
        }
        
        // Calculate clarityPct: average score understood columns; if 1..5 convert to %
        let clarityPct = null;
        const scores = scoreIdxs.map(i => Number(row[i])).filter(v => !isNaN(v));
        if (scores.length) {
          const avg = scores.reduce((a,b)=>a+b,0) / scores.length;
          // Assume 1-5 scale -> 20-100%
          if (avg > 0 && avg <= 5) clarityPct = (avg / 5) * 100;
          // Otherwise, assume it's already a percentage (e.g. 55.0)
          else if (avg > 0 && avg <= 100) clarityPct = avg;
        }


        let date = null;
        if (dateRaw instanceof Date) {
          date = dateRaw.toISOString().substring(0, 10);
        } else if (typeof dateRaw === 'number' && dateRaw > 10000) { // Excel date number
          date = XLSX.SSF.parse_date_code(dateRaw).toISOString().substring(0, 10);
        } else {
          date = String(dateRaw || '').trim();
        }

        const latRaw = idx.lat >= 0 ? row[idx.lat] : null;
        const lonRaw = idx.lon >= 0 ? row[idx.lon] : null;

        const session = {
          sn: sn,
          city: idx.city >= 0 ? safeStr(row[idx.city]) : '',
          spot: idx.spot >= 0 ? safeStr(row[idx.spot]) : '',
          date: date,
          farmers: farmers,
          acres: idx.acres >= 0 ? Number(row[idx.acres]) : null,
          definite: definite,
          maybe: maybe,
          notInterested: no,
          // definitePct will be calculated in normalizeSession if missing
          // awarenessPct is calculated above
          awarenessPct: awarenessPct, 
          // clarityPct is calculated above
          clarityPct: clarityPct,
          lat: parseDmsToDd(latRaw),
          lon: parseDmsToDd(lonRaw),
          reasonsUse: idx.reasonsUse >= 0 ? safeStr(row[idx.reasonsUse]) : '',
          reasonsNo: idx.reasonsNo >= 0 ? safeStr(row[idx.reasonsNo]) : '',
        };
        sessions.push(normalizeSession(session));
      }

      if (sessions.length === 0) throw new Error('XLSX parsed but contained no valid sessions.');
      return sessions;

    } catch (e) {
      logDiag(`XLSX failed: ${e.message}`);
      throw new Error(`Failed to load data from both sessions.json and the XLSX fallback. Error: ${e.message}`);
    }
  }


  async function loadSessions() {
    let sessions = await loadSessionsPreferred();
    if (!sessions) {
      if (typeof XLSX !== 'undefined') {
        sessions = await loadSessionsXlsx();
      } else {
        throw new Error('sessions.json failed to load, and SheetJS (XLSX) library is missing for the XLSX fallback.');
      }
    }
    
    // Sort by date ascending (or SN if date missing)
    sessions.sort((a,b) => {
      const da = parseISO(a.date), db = parseISO(b.date);
      const ta = da ? da.getTime() : (a.sn || 0);
      const tb = db ? db.getTime() : (b.sn || 0);
      return ta - tb;
    });

    return sessions;
  }

  async function loadMedia(sessions) {
    try {
      setLoadingStatus('Loading media.json…');
      const mediaData = await fetchJson(CONFIG.mediaJson);
      
      const basePath = mediaData.basePath || CONFIG.basePath || '';
      const defaults = mediaData.defaults || {};
      const mainVideoExt = defaults.mainVideoExt || 'mp4';
      const mainImageExt = defaults.mainImageExt || 'jpg';
      const variantImageExt = defaults.variantImageExt || 'jpg';
      const variantVideoExt = defaults.variantVideoExt || 'mp4';
      const variants = defaults.variants || [];

      const items = [];
      const sessionMap = new Map(sessions.map(s => [String(s.sn), s]));

      for (const s of (mediaData.sessions || [])) {
        const id = String(s.id || s.sn || '').trim();
        if (!id) continue;

        // Skip if session doesn't exist in sessions data (or has no SN)
        if (!sessionMap.has(id)) continue;
        
        const caption = safeStr(s.caption) || `Session ${id}`;
        const transcript = safeStr(s.transcript);
        const city = safeStr(s.city);
        const spot = safeStr(s.spot);
        const date = safeStr(s.date);

        // main video + image
        items.push({
          sessionId: id, type: 'video',
          src: `${basePath}${id}.${mainVideoExt}`,
          caption, transcript, city, spot, date
        });
        items.push({
          sessionId: id, type: 'image',
          src: `${basePath}${id}.${mainImageExt}`,
          caption, transcript, city, spot, date
        });
        
        // variants (images first)
        for (const v of variants) {
          items.push({
            sessionId: id, type: 'image',
            src: `${basePath}${id}_${v}.${variantImageExt}`,
            caption: `${caption} (${v})`, transcript, city, spot, date
          });
        }
        
        // optional variant videos
        if (defaults.hasVariantVideos) {
            for (const v of variants) {
                items.push({
                    sessionId: id, type: 'video',
                    src: `${basePath}${id}_${v}.${variantVideoExt}`,
                    caption: `${caption} (${v})`, transcript, city, spot, date
                });
            }
        }
      }
      
      // Map media by session ID
      for (const it of items) {
        const arr = state.mediaBySessionId.get(it.sessionId) || [];
        arr.push(it);
        state.mediaBySessionId.set(it.sessionId, arr);
      }
      
      return items;

    } catch (e) {
      // Media is optional/secondary, so we log and proceed
      logDiag(`media.json failed: ${e.message}`);
      setNotice('<strong>Status:</strong> Data OK, Media Missing');
      return [];
    }
  }

  // ---------------------------
  // Filters and Data Processing
  // ---------------------------

  function populateFilters() {
    const cities = uniq(state.sessions.map(r => r.city)).sort();
    const spots = uniq(state.sessions.map(r => r.spot)).sort();

    const createOption = (v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`;

    // City Filter
    el.filterCity.innerHTML = '<option value="">All Cities</option>' + cities.map(createOption).join('');
    
    // Spot Filter
    el.filterSpot.innerHTML = '<option value="">All Spots</option>' + spots.map(createOption).join('');

    // Date Range (default to full range)
    if (state.sessions.length) {
      el.filterFrom.value = state.sessions[0].date;
      el.filterTo.value = state.sessions[state.sessions.length - 1].date;
    }

    el.filterCity.addEventListener('change', () => applyFilters(50));
    el.filterSpot.addEventListener('change', () => applyFilters(50));
    el.filterFrom.addEventListener('change', () => applyFilters(50));
    el.filterTo.addEventListener('change', () => applyFilters(50));
    el.filterSearch.addEventListener('input', debounce(() => applyFilters(0), 400));
    
    el.btnReset.addEventListener('click', () => {
      el.filterCity.value = '';
      el.filterSpot.value = '';
      el.filterSearch.value = '';
      if (state.sessions.length) {
        el.filterFrom.value = state.sessions[0].date;
        el.filterTo.value = state.sessions[state.sessions.length - 1].date;
      }
      applyFilters();
    });
    
    el.btnExport.addEventListener('click', () => exportCsv());

    // Tabs
    $$('.tabBtn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabId = e.target.getAttribute('data-tab');
        $$('.tabBtn').forEach(b => b.classList.remove('active'));
        $$('.tabContent').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        $(`#${tabId}`).classList.add('active');
        
        if (tabId === 'tab-map') invalidateMapSoon();
      });
    });

    // Lightbox events
    el.lbClose.addEventListener('click', closeLightbox);
    el.lbPrev.addEventListener('click', () => changeLightboxItem(-1));
    el.lbNext.addEventListener('click', () => changeLightboxItem(1));
    document.addEventListener('keydown', (e) => {
      if (el.lb.classList.contains('active')) {
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') changeLightboxItem(-1);
        if (e.key === 'ArrowRight') changeLightboxItem(1);
      }
    });

  }

  function applyFilters(delay=0) {
    if (delay) return setTimeout(applyFilters, delay);

    const city = el.filterCity.value;
    const spot = el.filterSpot.value;
    const from = el.filterFrom.value;
    const to = el.filterTo.value;
    const q = safeStr(el.filterSearch.value).toLowerCase();

    const fromDt = parseISO(from);
    const toDt = parseISO(to);

    let rows = state.sessions.slice();

    // 1. City/Spot Filters
    if (city) {
      rows = rows.filter(r => r.city === city);
    }
    if (spot) {
      rows = rows.filter(r => r.spot === spot);
    }

    // 2. Date Filters
    if (fromDt && !isNaN(fromDt.getTime())) {
      rows = rows.filter(r => {
        const d = parseISO(r.date);
        return d ? (d >= fromDt) : true;
      });
    }
    if (toDt && !isNaN(toDt.getTime())) {
      // inclusive end
      const end = new Date(toDt.getTime() + 24*3600*1000 - 1);
      rows = rows.filter(r => {
        const d = parseISO(r.date);
        return d ? (d <= end) : true;
      });
    }

    // 3. Search Filter
    if (q) {
      rows = rows.filter(r => {
        const hay = `${r.city} ${r.spot} ${r.reasonsUse} ${r.reasonsNo}`.toLowerCase();
        return hay.includes(q);
      });
    }
    
    // Sort by date desc then sn
    rows.sort((a,b) => {
      const da = parseISO(a.date), db = parseISO(b.date);
      const ta = da ? da.getTime() : 0;
      const tb = db ? db.getTime() : 0;
      
      // Sort by date descending
      if (tb !== ta) return tb - ta;

      // Secondary sort by SN descending (for same-day sessions)
      return (b.sn || 0) - (a.sn || 0);
    });

    state.filtered = rows;
    updateDashboard(rows);
  }

  function sum(arr, fn) {
    return arr.reduce((a, r) => {
      const v = fn(r);
      return a + (typeof v === 'number' && !isNaN(v) ? v : 0);
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
    // Average definite percentage weighted by number of farmers (if available)
    const totalDefinite = sum(rows, r => r.definite);
    const definiteTotalFarmers = sum(rows.filter(r => typeof r.definite === 'number' && r.definite !== null), r => r.farmers);
    const defPct = (definiteTotalFarmers > 0) ? (totalDefinite / definiteTotalFarmers) * 100 : mean(rows, r => r.definitePct);
    
    return { sessions, farmers, acres, defPct };
  }

  function updateKpis(rows) {
    const k = computeKpis(rows);
    el.kpiSessions.textContent = fmt.int(k.sessions);
    el.kpiFarmers.textContent = fmt.int(k.farmers);
    el.kpiAcres.textContent = fmt.int(k.acres);
    el.kpiDemo.textContent = fmt.pct(k.defPct);

    // Assuming max values for bars are based on total data, but as a shortcut we'll use a fixed number or the max of the filtered set
    const totalFarmers = sum(state.sessions, r => r.farmers);
    const maxFarmers = totalFarmers || 1000;
    const maxAcres = sum(state.sessions, r => r.acres) || 10000;

    setBar(el.barSessions, k.sessions / state.sessions.length * 100);
    setBar(el.barFarmers, k.farmers / maxFarmers * 100);
    setBar(el.barAcres, k.acres / maxAcres * 100);
    setBar(el.barDemo, k.defPct);
  }

  function updateSummary(rows) {
    if (el.summary) {
      el.summary.querySelector('.summary-text strong').textContent = fmt.int(rows.length);
    }
    // Update build stamp if sessions.json was used
    if (state.sessions[0]?.date) {
        el.buildStamp.textContent = `Data from ${fmt.date(state.sessions[0].date)} to ${fmt.date(state.sessions[state.sessions.length - 1].date)}`;
    }
  }

  function renderReasons(rows) {
    const useMap = new Map();
    const noMap = new Map();

    const split = (s) => (s || '').split(/[;,\n]/).map(x => safeStr(x).replace(/^reason\s*(to\s*use|not\s*to\s*use|:)\s*/i, '').trim()).filter(Boolean);

    for (const r of rows) {
      if (r.definite > 0 || (r.definite === null && r.definitePct > 50)) {
        for (const reason of split(r.reasonsUse)) {
          useMap.set(reason, (useMap.get(reason) || 0) + 1);
        }
      } else if (r.notInterested > 0 || r.maybe > 0 || (r.definitePct !== null && r.definitePct <= 50)) {
        for (const reason of split(r.reasonsNo)) {
          noMap.set(reason, (noMap.get(reason) || 0) + 1);
        }
      }
    }

    const use = Array.from(useMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const no = Array.from(noMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

    el.reasonUse.innerHTML = use.map(([r, c]) => `<li>${escapeHtml(r)} (${c})</li>`).join('');
    el.reasonNo.innerHTML = no.map(([r, c]) => `<li>${escapeHtml(r)} (${c})</li>`).join('');
  }


  function renderTable(rows) {
    if (!el.tbl) return;
    const html = rows.map(r => `
      <tr data-sn="${escapeHtml(r.sn)}" title="Click to view media and map location">
        <td>${fmt.date(r.date)}</td>
        <td>${escapeHtml(r.city)}</td>
        <td>${escapeHtml(r.spot)}</td>
        <td class="right">${fmt.int(r.farmers)}</td>
        <td class="right">${fmt.int(r.acres)}</td>
        <td class="right">${fmt.pct(r.definitePct)}</td>
        <td class="right">${fmt.pct(r.awarenessPct)}</td>
        <td class="right">${fmt.pct(r.clarityPct)}</td>
      </tr>
    `).join('');
    el.tbl.innerHTML = html;

    // Attach click handlers
    $$('#tblSessions tr').forEach(tr => {
      tr.addEventListener('click', () => {
        const sn = tr.getAttribute('data-sn');
        const session = state.filtered.find(x => String(x.sn) === String(sn)) || state.sessions.find(x => String(x.sn) === String(sn));
        if (session) pinSession(session, { openMedia:true, focusMap:true });
      });
    });
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
    state.map = L.map(el.mapWrap, { preferCanvas:true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap'
    }).addTo(state.map);

    // Default view Pakistan (approximate center)
    state.map.setView([30.3753, 69.3451], 5);
    logDiag('Map initialized.');

    // Event handler to pick session on map click
    state.map.on('click', (e) => {
        // Find the closest marker, but for now we rely only on the markers already rendered
        const closest = state.circles.map(c => ({
            dist: e.latlng.distanceTo(c.getLatLng()),
            session: c.session
        })).sort((a, b) => a.dist - b.dist).filter(d => d.dist < 50000)[0]; // 50km radius
        
        if (closest) {
            pinSession(closest.session, { openMedia: false, focusMap: true });
        }
    });

    invalidateMapSoon();
  }

  function renderMap(rows) {
    if (!state.map) return;
    
    // Clear existing markers
    for (const circle of state.circles) {
      state.map.removeLayer(circle);
    }
    state.circles = [];
    
    // Default to initial view
    let bounds = [[30.3753, 69.3451], [30.3753, 69.3451]]; // Pakistan

    // Add new markers
    const sessionIds = uniq(rows.map(r => r.sn).filter(Boolean).map(String));
    
    for (const id of sessionIds) {
      const sessionGroup = rows.filter(r => String(r.sn) === id);
      const first = sessionGroup.find(r => r.lat && r.lon) || sessionGroup[0];
      
      if (first.lat && first.lon) {
        const totalFarmers = sum(sessionGroup, r => r.farmers);
        const definitePct = mean(sessionGroup, r => r.definitePct);
        const radius = Math.max(8000, Math.sqrt(totalFarmers) * 50); // Scale radius by sqrt of farmers
        
        // Pin color (blue/accent) or normal color (white/muted)
        const isPinned = state.pinnedSession && String(state.pinnedSession.sn) === id;
        const color = isPinned ? '#7dd3fc' : 'white';
        const fillColor = isPinned ? '#7dd3fc' : 'white';
        const opacity = isPinned ? 1.0 : 0.8;

        const circle = L.circle([first.lat, first.lon], {
          color: color,
          fillColor: fillColor,
          fillOpacity: opacity * 0.35,
          radius: radius,
          weight: isPinned ? 3 : 1,
        });

        // Add metadata for click handling
        circle.session = first;
        circle.isPinned = isPinned;

        circle.on('click', () => {
          pinSession(first, { openMedia:false, focusMap:false });
        });

        const tooltipContent = `
          <strong>Session ${id}</strong><br/>
          ${first.city} - ${first.spot}<br/>
          Farmers: ${fmt.int(totalFarmers)}<br/>
          Definite: ${fmt.pct(definitePct)}
        `;
        circle.bindTooltip(tooltipContent);
        
        circle.addTo(state.map);
        state.circles.push(circle);

        // Update bounds
        bounds.push([first.lat, first.lon]);
      }
    }
    
    // Fit map to bounds if markers exist
    if (state.circles.length > 0) {
      try {
        state.map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50], maxZoom: 8 });
      } catch (e) {
        logDiag(`Error fitting map bounds: ${e.message}`);
      }
    }

    // Re-render map selection panel
    renderMapSelectionPanel(state.pinnedSession);
  }

  function pinSession(session, options={openMedia:false, focusMap:false}) {
    if (!session || !session.sn) {
      state.pinnedSession = null;
    } else {
      state.pinnedSession = session;
    }
    
    // Re-render map to update pin/circle style
    renderMap(state.filtered); 
    
    if (state.map && state.pinnedSession && state.pinnedSession.lat && state.pinnedSession.lon && options.focusMap) {
      state.map.setView([state.pinnedSession.lat, state.pinnedSession.lon], 12);
    }
    
    if (options.openMedia) {
      openLightboxForSession(state.pinnedSession.sn);
    }
    
    // Scroll to map
    if (state.pinnedSession) {
      const mapTab = $('[data-tab="tab-map"]');
      if (mapTab) mapTab.click(); // Switch to map tab
      el.mapWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function renderMapSelectionPanel(session) {
    if (!el.mapSelTitle) return;

    if (!session) {
      el.mapSelTitle.textContent = 'Selected Session Details (Click a point on the map or a row in the table)';
      el.mapSelFarmers.textContent = '—';
      el.mapSelAcres.textContent = '—';
      el.mapSelDate.textContent = '—';
      renderShowcase(el.mapShowcase, []);
      return;
    }

    const sessionGroup = state.sessions.filter(r => String(r.sn) === String(session.sn));
    const totalFarmers = sum(sessionGroup, r => r.farmers);
    const totalAcres = sum(sessionGroup, r => r.acres);
    const dateSpan = sessionGroup.map(r => r.date).filter(Boolean).sort().map(fmt.date).join(' & ');
    
    el.mapSelTitle.textContent = `Session ${session.sn}: ${session.city} - ${session.spot}`;
    el.mapSelFarmers.textContent = fmt.int(totalFarmers);
    el.mapSelAcres.textContent = fmt.int(totalAcres);
    el.mapSelDate.textContent = dateSpan;

    const ids = sessionGroup.map(r => r.sn).filter(Boolean).map(String);
    renderShowcase(el.mapShowcase, ids);
  }

  function invalidateMapSoon() {
    if (!state.map) return;
    setTimeout(() => { try{ state.map.invalidateSize(); } catch(_) {} }, 80);
  }

  // ---------------------------
  // Media / Showcase / Lightbox
  // ---------------------------
  
  function renderShowcase(targetEl, sessionIds) {
    targetEl.innerHTML = '';
    
    const items = [];
    for (const id of sessionIds) {
      const arr = state.mediaBySessionId.get(String(id)) || [];
      // Only take the first image or video (prioritize image if both exist)
      const image = arr.find(it => it.type === 'image' && it.src);
      const video = arr.find(it => it.type === 'video' && it.src);
      if (image) items.push(image);
      else if (video) items.push(video);
      
      // Stop after 5 items total
      if (items.length >= CONFIG.maxShowcase) break;
    }
    
    if (!items.length) {
      targetEl.innerHTML = '<div class="muted" style="padding:10px;">No media available for these sessions.</div>';
      return;
    }

    items.forEach((it, index) => {
      const isVideo = it.type === 'video';
      const card = document.createElement('div');
      card.className = 'showcase';
      card.title = isVideo ? 'Click to play video' : 'Click to view image';
      card.innerHTML = `
        ${isVideo 
            ? `<video muted loop playsinline src="${it.src}"></video>` 
            : `<img src="${it.src}" alt="${escapeHtml(it.caption)}" onerror="this.onerror=null;this.src='${CONFIG.placeholder}';">`
        }
        <div class="showcase-text">
          <div>
            <strong>Session ${escapeHtml(it.sessionId)}</strong>
            <span>${escapeHtml(it.city)} - ${escapeHtml(it.date)}</span>
          </div>
        </div>
      `;
      
      card.addEventListener('click', () => {
        openLightboxForSession(it.sessionId);
      });
      targetEl.appendChild(card);
    });
  }
  
  function buildGalleryList(rows) {
    // Choose media items for the filtered sessions; keep a max
    const ids = rows.map(r => r.sn).filter(Boolean).map(String);
    const items = [];
    const usedSrcs = new Set();
    
    for (const id of ids) {
      const arr = state.mediaBySessionId.get(id) || [];
      for (const it of arr) {
        if (it.src && !usedSrcs.has(it.src)) {
            items.push(it);
            usedSrcs.add(it.src);
        }
      }
      if (items.length >= CONFIG.maxGallery) break;
    }
    
    // If empty, show placeholders derived from sessions
    if (!items.length && rows.length) {
      for (const id of ids.slice(0, Math.min(CONFIG.maxGallery, 12))) {
        items.push({ sessionId: id, type:'image', src: CONFIG.placeholder, caption:`Session ${id}`, transcript:'' });
      }
    }
    
    return items.slice(0, CONFIG.maxGallery);
  }

  function renderGallery(rows) {
    if (!el.gallery) return;
    el.gallery.innerHTML = '';
    
    const items = buildGalleryList(rows);
    state.lightbox.items = items; // Update the list of items for the lightbox

    items.forEach((it, index) => {
      const isVideo = it.type === 'video';
      const card = document.createElement('div');
      card.className = 'mediaTile';
      card.title = it.caption;
      
      const mediaHtml = isVideo 
        ? `<video muted loop playsinline src="${it.src}"></video><div class="icon">▶</div>` 
        : `<img src="${it.src}" alt="${escapeHtml(it.caption)}" onerror="this.onerror=null;this.src='${CONFIG.placeholder}';">`;
      
      card.innerHTML = `
        ${mediaHtml}
        <div class="mediaTag">${escapeHtml(it.caption)}</div>
      `;
      
      card.addEventListener('click', () => {
        openLightbox(items, index);
      });
      el.gallery.appendChild(card);
    });
    
  }

  function openLightbox(items, index) {
    if (!el.lb) return;
    
    state.lightbox.items = items;
    state.lightbox.index = index;
    
    renderLightbox();
    el.lb.classList.add('active');
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
    el.lb.classList.remove('active');
    el.lbMedia.innerHTML = '';
  }

  function changeLightboxItem(direction) {
    const newIndex = clamp(state.lightbox.index + direction, 0, Math.max(0, state.lightbox.items.length - 1));
    if (newIndex !== state.lightbox.index) {
      state.lightbox.index = newIndex;
      renderLightbox();
    }
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
    
    if (it.type === 'video') {
      const vid = document.createElement('video');
      vid.setAttribute('controls', '');
      vid.setAttribute('autoplay', '');
      vid.setAttribute('playsinline', '');
      vid.src = it.src;
      el.lbMedia.appendChild(vid);
    } else {
      const img = document.createElement('img');
      img.src = it.src;
      img.alt = it.caption;
      el.lbMedia.appendChild(img);
    }
    
    // Update navigation buttons
    el.lbPrev.disabled = idx === 0;
    el.lbNext.disabled = idx >= items.length - 1;
    
    // Update footer
    const navDiv = el.lb.querySelector('.lbNav');
    navDiv.textContent = `Item ${idx + 1} of ${items.length}`;
  }


  // ---------------------------
  // Charts
  // ---------------------------

  function destroyChart(ch) {
    try { ch?.destroy(); } catch(_) {}
  }

  function renderCharts(rows) {
    if (typeof Chart === 'undefined') return;

    // --- City mix (doughnut) ---
    const byCity = new Map();
    for (const r of rows) byCity.set(r.city, (byCity.get(r.city) || 0) + (r.farmers || 0));
    const cityLabels = Array.from(byCity.keys());
    const cityVals = Array.from(byCity.values());
    
    destroyChart(state.charts.city);
    state.charts.city = new Chart(el.chartCity, {
      type: 'doughnut',
      data: {
        labels: cityLabels,
        datasets: [{
          data: cityVals,
          backgroundColor: ['#7dd3fc', '#86efac', '#fbbf24', '#e879f9', '#f87171', '#34d399', '#f97316', '#22d3ee', '#c084fc', '#f472b6'],
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#e7edf7' } } }
      }
    });


    // --- Intent mix (pie) ---
    const totalFarmers = sum(rows, r => r.farmers);
    const definite = sum(rows, r => r.definite);
    const maybe = sum(rows, r => r.maybe);
    const notInterested = sum(rows, r => r.notInterested);
    const remaining = totalFarmers - (definite + maybe + notInterested);

    const intentData = {
        labels: ['Definite', 'Maybe', 'Not Interested', 'No Data'],
        values: [definite, maybe, notInterested, remaining],
        colors: ['#86efac', '#fbbf24', '#fb7185', '#9fb0ca']
    };

    destroyChart(state.charts.intent);
    state.charts.intent = new Chart(el.chartIntent, {
      type: 'pie',
      data: {
        labels: intentData.labels,
        datasets: [{
          data: intentData.values,
          backgroundColor: intentData.colors,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#e7edf7' } } }
      }
    });

    // --- Trend Over Time (line) ---
    const byDate = new Map();
    for (const r of rows) {
      if (r.date
