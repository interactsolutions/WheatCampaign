/* Harvest Horizons Dashboard */

(() => {
  'use strict';

  // ---------------------------
  // Config (you can edit safely)
  // ---------------------------
  const CONFIG = {
    sessionsJson: 'sessions.json',
    mediaJson: 'media.json',
    xlsxFallback: 'Buctril_Super_Activations.xlsx',
    heroVideoCandidates: ['assets/bg.mp4','tmp.mp4'],
    placeholderCandidates: ['assets/placeholder.svg','placeholder.svg'],
    maxShowcase: 5,
    maxGallery: 48
  };

  // ---------------------------
  // DOM helpers
  // ---------------------------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  
  // ---------------------------
  // Placeholders / media fallbacks
  // ---------------------------
  const INLINE_PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#0b1220"/>
          <stop offset="1" stop-color="#111f39"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#g)"/>
      <text x="50%" y="48%" text-anchor="middle" fill="rgba(231,237,247,.70)" font-size="44" font-family="system-ui, -apple-system, Segoe UI, Roboto">
        Media missing
      </text>
      <text x="50%" y="56%" text-anchor="middle" fill="rgba(159,176,202,.75)" font-size="22" font-family="system-ui, -apple-system, Segoe UI, Roboto">
        Add assets under /assets and /assets/gallery
      </text>
    </svg>`
  );

  function placeholderCandidate(i) {
    const c = Array.isArray(CONFIG.placeholderCandidates) ? CONFIG.placeholderCandidates : [];
    return c[i] || '';
  }
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

    // Hero donuts
    clarityDonut: $('#clarityDonut'),
    definiteDonut: $('#definiteDonut'),
    clarityMain: $('#clarity-main'),
    definiteMain: $('#definite-main'),

    // Themes
    awarenessMedia: $('#awareness-media'),
    journeyMedia: $('#journey-media'),
    impactMedia: $('#impact-media'),
    futureMedia: $('#future-media'),
    awarenessFarmers: $('#awareness-farmers'),
    awarenessAcres: $('#awareness-acres'),
    awarenessPct: $('#awareness-pct'),
    journeySessions: $('#journey-sessions'),
    journeyDef: $('#journey-def'),
    impactClarity: $('#impact-clarity'),
    btnReset2: $('#btn-reset-2'),

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
    filteredSessions: [],
    mediaItems: [],
    mediaBySessionId: new Map(), // sn -> media[]
    mediaByKey: new Map(),       // date|city|spot -> media[]
    pinnedSession: null,

    map: null,
    circles: [],
    totals: { sessions:0, farmers:0, acres:0, defPct:null, awarenessPct:null, clarityPct:null },
    charts: { city:null, intent:null, trend:null, clarityDonut:null, definiteDonut:null },
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
  };

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
      (farmers !== null && definite !== null && !isNaN(farmers) && farmers > 0) ? (definite / farmers * 100) : null;

    const awarenessPct = (s.awarenessPct !== null && s.awarenessPct !== undefined) ? Number(s.awarenessPct) : null;
    const clarityPct = (s.clarityPct !== null && s.clarityPct !== undefined) ? Number(s.clarityPct) : null;

    const lat = (s.lat === '' ? null : Number(s.lat));
    const lon = (s.lon === '' ? null : Number(s.lon));

    const key = `${date}|${city}|${spot}`;
    const id = `${sn || 'NA'}|${key}`;

    return {
      id,
      key,
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
      theme: safeStr(s.theme)
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
    const dir = (mm[4] || '').toUpperCase();
    if ([deg,min,sec].some(x => isNaN(x))) return null;
    let dd = Math.abs(deg) + (min/60) + (sec/3600);
    if (dir === 'S' || dir === 'W') dd *= -1;
    return dd;
  }

  function parseCoordPair(s) {
    if (!s) return { lat:null, lon:null };
    const str = String(s).trim();
    if (!str) return { lat:null, lon:null };

    if (str.includes(',')) {
      const parts = str.split(',').map(x => x.trim());
      if (parts.length >= 2) {
        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
      }
    }

    // find two DMS segments
    const segs = str.match(/(\d+(?:\.\d+)?\D+\d+(?:\.\d+)?\D*\d*(?:\.\d+)?\D*[NSEW])/ig);
    if (segs && segs.length >= 2) {
      const a = parseDmsToDd(segs[0]);
      const b = parseDmsToDd(segs[1]);
      // Guess which is lat vs lon based on absolute range
      if (a !== null && b !== null) {
        const lat = (Math.abs(a) <= 90) ? a : b;
        const lon = (lat === a) ? b : a;
        return { lat, lon };
      }
    }

    // fallback: take first 2 numbers
    const nums = str.match(/-?\d+(\.\d+)?/g);
    if (nums && nums.length >= 2) {
      const lat = parseFloat(nums[0]);
      const lon = parseFloat(nums[1]);
      if (!isNaN(lat) && !isNaN(lon)) return { lat, lon };
    }

    return { lat:null, lon:null };
  }

  function normalizeDateExcel(v) {
    // XLSX: dates may be JS Date or number
    if (!v) return '';
    if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0,10);
    if (typeof v === 'number') {
      // Excel date number -> JS Date
      const d = XLSX.SSF.parse_date_code(v);
      if (d) {
        const dt = new Date(Date.UTC(d.y, d.m - 1, d.d));
        if (!isNaN(dt.getTime())) return dt.toISOString().slice(0,10);
      }
    }
    // string
    const dt = new Date(String(v));
    return isNaN(dt.getTime()) ? String(v) : dt.toISOString().slice(0,10);
  }

  async function loadSessionsFromXlsx() {
    if (typeof XLSX === 'undefined') throw new Error('SheetJS (XLSX) library not loaded.');
    setLoadingStatus('Loading XLSX fallback…');
    const buf = await fetchArrayBuffer(CONFIG.xlsxFallback);
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });

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
      city: bestHeaderIndex(headers, ['^city$']),
      date: bestHeaderIndex(headers, ['^date$']),
      spot: bestHeaderIndex(headers, ['session location','spot']),
      coords: bestHeaderIndex(headers, ['spot coordinates','coordinates']),
      farmers: bestHeaderIndex(headers, ['total farmers']),
      acres: bestHeaderIndex(headers, ['total wheat acres','wheat acres']),
      know: bestHeaderIndex(headers, ['know buctril']),
      def: bestHeaderIndex(headers, ['will definitely use']),
      may: bestHeaderIndex(headers, ['^maybe$']),
      no: bestHeaderIndex(headers, ['not interested']),
      reasonUse: bestHeaderIndex(headers, ['top reason to use']),
      reasonNo: bestHeaderIndex(headers, ['top reason not to use']),
    };

    // score understood columns (1..5)
    const scoreIdxs = [];
    headers.forEach((h, i) => {
      const t = String(h || '').toLowerCase();
      if (t.includes('score understood')) scoreIdxs.push(i);
    });

    // Parse rows
    const out = [];
    let last = {};
    for (let r = 2; r < 1000; r++) {
      const row = [];
      let empty = true;
      for (let c = 0; c < headers.length; c++) {
        const v = getSheetCell(sheet, r, c);
        row.push(v);
        if (v !== undefined && v !== null && String(v).trim() !== '') empty = false;
      }
      if (empty) continue;

      // forward fill for merged cells: sn, city, date
      for (const k of ['sn','city','date']) {
        const ci = idx[k];
        if (ci >= 0) {
          const v = row[ci];
          if (v === undefined || v === null || String(v).trim() === '') {
            row[ci] = last[k];
          } else {
            last[k] = v;
          }
        }
      }

      const city = safeStr(idx.city >= 0 ? row[idx.city] : '');
      const spot = safeStr(idx.spot >= 0 ? row[idx.spot] : '');
      const farmers = idx.farmers >= 0 ? Number(row[idx.farmers]) : null;

      if (!city && !spot && !farmers) continue;

      const date = normalizeDateExcel(idx.date >= 0 ? row[idx.date] : '');
      const sn = idx.sn >= 0 ? safeStr(row[idx.sn]) : '';
      const acres = idx.acres >= 0 ? Number(row[idx.acres]) : null;
      const know = idx.know >= 0 ? Number(row[idx.know]) : null;
      const def = idx.def >= 0 ? Number(row[idx.def]) : null;
      const may = idx.may >= 0 ? Number(row[idx.may]) : null;
      const no = idx.no >= 0 ? Number(row[idx.no]) : null;

      let awarenessPct = null;
      if (farmers && !isNaN(farmers) && farmers > 0 && know !== null && !isNaN(know)) {
        awarenessPct = (know <= farmers) ? (know / farmers * 100) : (know <= 100 ? know : null);
      }

      // clarity: average score understood columns; if 1..5 convert to %
      let clarityPct = null;
      const scores = scoreIdxs.map(i => Number(row[i])).filter(v => !isNaN(v));
      if (scores.length) {
        const avg = scores.reduce((a,b)=>a+b,0) / scores.length;
        clarityPct = (avg <= 5.01) ? (avg / 5 * 100) : (avg <= 100 ? avg : null);
      }

      let definitePct = null;
      if (farmers && def !== null && !isNaN(def) && farmers > 0) definitePct = def / farmers * 100;

      const { lat, lon } = parseCoordPair(idx.coords >= 0 ? row[idx.coords] : '');

      out.push(normalizeSession({
        sn,
        city,
        spot,
        date,
        farmers,
        acres,
        definite: def,
        maybe: may,
        notInterested: no,
        definitePct,
        awarenessPct,
        clarityPct,
        lat, lon,
        reasonsUse: idx.reasonUse >= 0 ? row[idx.reasonUse] : '',
        reasonsNo: idx.reasonNo >= 0 ? row[idx.reasonNo] : ''
      }));
    }

    if (!out.length) throw new Error('XLSX parsed but produced 0 sessions.');
    return out;
  }

  async function loadSessions() {
    const fromJson = await loadSessionsPreferred();
    if (fromJson) return fromJson;

    // fallback
    try {
      const fromXlsx = await loadSessionsFromXlsx();
      setNotice(`<strong>Status:</strong> Loaded XLSX fallback (<code>${CONFIG.xlsxFallback}</code>). Consider committing <code>sessions.json</code> to avoid Git LFS issues.`);
      return fromXlsx;
    } catch (e) {
      const lfsHint = (e && e.code === 'LFS_POINTER')
        ? `<br/><br/><b>Fix:</b> do not serve XLSX via Git LFS on GitHub Pages. Use <code>sessions.json</code> (recommended) or host the XLSX on a non-LFS URL (e.g., GitHub Release / CDN).`
        : '';
      throw new Error(`Unable to load sessions data. ${e.message}${lfsHint}`);
    }
  }

  // ---------------------------
  // Media loading
  // ---------------------------
  function expandMediaCompact(payload) {
    const basePath = safeStr(payload.basePath || '');
    const d = payload.defaults || {};
    const mainVideoExt = d.mainVideoExt || 'mp4';
    const mainImageExt = d.mainImageExt || 'jpg';
    const variantImageExt = d.variantImageExt || 'jpg';
    const variantVideoExt = d.variantVideoExt || 'mp4';
    const variants = Array.isArray(d.variants) ? d.variants : ['a','b','c','d','e','f'];
    const includeVariantVideos = !!d.includeVariantVideos;

    const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
    const items = [];

    for (const s of sessions) {
      const id = safeStr(s.id);
      if (!id) continue;

      const caption = safeStr(s.caption) || `Session ${id}`;
      const transcript = safeStr(s.transcript);
      const city = safeStr(s.city);
      const spot = safeStr(s.spot);
      const date = safeStr(s.date);
      const theme = safeStr(s.theme);

      // Main video + main image (always emitted; UI will gracefully fall back when assets are missing)
      items.push({
        sessionId: id,
        key: `${date}|${city}|${spot}`,
        type: 'video',
        src: `${basePath}${id}.${mainVideoExt}`,
        caption,
        transcript,
        theme,
        city, spot, date
      });
      items.push({
        sessionId: id,
        key: `${date}|${city}|${spot}`,
        type: 'image',
        src: `${basePath}${id}.${mainImageExt}`,
        caption,
        transcript,
        theme,
        city, spot, date
      });

      // Variant images (cheap + useful)
      for (const v of variants) {
        items.push({
          sessionId: id,
          key: `${date}|${city}|${spot}`,
          type: 'image',
          src: `${basePath}${id}_${v}.${variantImageExt}`,
          caption: `${caption} (Variant ${v})`,
          transcript,
          theme,
          city, spot, date
        });
      }

      // Optional variant videos (often missing; disabled by default)
      if (includeVariantVideos) {
        for (const v of variants) {
          items.push({
            sessionId: id,
            key: `${date}|${city}|${spot}`,
            type: 'video',
            src: `${basePath}${id}_${v}.${variantVideoExt}`,
            caption: `${caption} (Variant ${v} video)`,
            transcript,
            theme,
            city, spot, date
          });
        }
      }
    }
    return items;
  }

  async function loadMedia(sessions) {
    try {
      setLoadingStatus('Loading media.json…');
      const payload = await fetchJson(CONFIG.mediaJson);
      let items = [];
      if (payload && payload.format === 'A_compact') {
        items = expandMediaCompact(payload);
      } else if (Array.isArray(payload)) {
        // flat array support
        items = payload.map(x => ({
          sessionId: safeStr(x.sessionId || x.session || ''),
          type: safeStr(x.type || 'image'),
          src: safeStr(x.src || ''),
          caption: safeStr(x.caption || ''),
          transcript: safeStr(x.transcript || ''),
          city: safeStr(x.city || ''),
          spot: safeStr(x.spot || ''),
          date: safeStr(x.date || '')
        }));
      } else if (payload && Array.isArray(payload.items)) {
        items = payload.items;
      }

      // If sessionId missing, infer from filename prefix (e.g., "11_a.jpg" -> "11")
      for (const it of items) {
        if (!it.sessionId && it.src) {
          const m = it.src.match(/\/(\d+)[._]/) || it.src.match(/^(\d+)[._]/);
          if (m) it.sessionId = m[1];
        }
        if (!it.caption) it.caption = it.sessionId ? `Session ${it.sessionId}` : 'Media';
      }

      // Build lookup
      const by = new Map();
      for (const it of items) {
        const k = it.sessionId || '';
        if (!k) continue;
        if (!by.has(k)) by.set(k, []);
        by.get(k).push(it);
      }

      // Keep only sessions that exist in data OR have identifiable fields
      const knownSessionIds = new Set(sessions.map(s => s.sn).filter(Boolean));
      const filteredItems = items.filter(it => it.sessionId && knownSessionIds.has(String(it.sessionId)));

      state.mediaItems = filteredItems;
      state.mediaBySessionId = by;
      // Secondary index for exact (date|city|spot) matching
      const byKey = new Map();
      for (const it of filteredItems) {
        const k = it.key || `${safeStr(it.date)}|${safeStr(it.city)}|${safeStr(it.spot)}`;
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k).push(it);
      }
      state.mediaByKey = byKey;

      return filteredItems;
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

    // Bars are relative indicators, not absolute truth.
    setBar(el.barSessions, clamp((k.sessions / Math.max(1, state.sessions.length)) * 100, 0, 100));
    const totFarmers = sum(state.sessions, s => s.farmers);
    const totAcres = sum(state.sessions, s => s.acres);
    setBar(el.barFarmers, clamp((k.farmers / Math.max(1, totFarmers)) * 100, 0, 100));
    setBar(el.barAcres, clamp((k.acres / Math.max(1e-9, totAcres)) * 100, 0, 100));
    setBar(el.barDemo, clamp(k.defPct || 0, 0, 100));
  }

  // ---------------------------
  // Hero donuts (Clarity + Definite)
  // ---------------------------
  function updateHeroDonuts(rows) {
    const clarity = mean(rows, r => r.clarityPct);
    const definite = mean(rows, r => r.definitePct);

    state.totals = {
      ...state.totals,
      sessions: rows.length,
      farmers: sum(rows, r => r.farmers),
      acres: sum(rows, r => r.acres),
      defPct: definite,
      awarenessPct: mean(rows, r => r.awarenessPct),
      clarityPct: clarity
    };

    if (el.clarityMain) el.clarityMain.textContent = `${fmt.pct(clarity, 0)}`;
    if (el.definiteMain) el.definiteMain.textContent = `${fmt.pct(definite, 0)}`;

    if (typeof Chart === 'undefined') return;

    const makeDonut = (canvas, value) => {
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      return new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Value', 'Remaining'],
          datasets: [{
            data: [clamp(value || 0, 0, 100), clamp(100 - (value || 0), 0, 100)],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
          },
          cutout: '75%'
        }
      });
    };

    // Create or update donuts
    if (el.clarityDonut) {
      if (!state.charts.clarityDonut) state.charts.clarityDonut = makeDonut(el.clarityDonut, clarity || 0);
      else {
        state.charts.clarityDonut.data.datasets[0].data = [clamp(clarity || 0,0,100), clamp(100-(clarity||0),0,100)];
        state.charts.clarityDonut.update();
      }
    }
    if (el.definiteDonut) {
      if (!state.charts.definiteDonut) state.charts.definiteDonut = makeDonut(el.definiteDonut, definite || 0);
      else {
        state.charts.definiteDonut.data.datasets[0].data = [clamp(definite || 0,0,100), clamp(100-(definite||0),0,100)];
        state.charts.definiteDonut.update();
      }
    }
  }

  // ---------------------------
  // Harvest Horizons themes
  // ---------------------------
  function pickMediaForSessions(rows, preferType='video') {
    if (!rows.length) return null;
    // prefer exact key matches (date|city|spot), then fall back to sn mapping
    const pool = [];
    for (const r of rows) {
      const key = r.key || `${safeStr(r.date)}|${safeStr(r.city)}|${safeStr(r.spot)}`;
      const arr = (state.mediaByKey.get(key) || state.mediaBySessionId.get(String(r.sn)) || []);
      for (const it of arr) pool.push(it);
    }
    if (!pool.length) return null;

    const preferred = pool.filter(it => it.type === preferType);
    const candidates = preferred.length ? preferred : pool;

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function renderCentral(containerEl, it, opts={ controls:true }) {
    if (!containerEl) return;
    containerEl.innerHTML = '';
    if (!it) {
      const img = makeImageNode(placeholderCandidate(0) || placeholderCandidate(1) || INLINE_PLACEHOLDER, 'Media missing');
      containerEl.appendChild(img);
      return;
    }
    const node = makeMediaNode(it, false, { controls: it.type === 'video' ? !!opts.controls : false });
    if (it.type === 'video') {
      node.muted = false; // central video is user-controlled
      node.loop = false;
      node.autoplay = false;
      node.controls = true;
    }
    containerEl.appendChild(node);
  }

  function renderThemes() {
    const rows = state.filteredSessions || state.filtered || [];

    // Seed: high-awareness sessions
    const seedRows = rows.filter(s => (s.awarenessPct || 0) >= 80);
    const seedPick = pickMediaForSessions(seedRows.length ? seedRows : rows, 'video');
    renderCentral(el.awarenessMedia, seedPick, { controls:true });
    if (el.awarenessFarmers) el.awarenessFarmers.textContent = fmt.int(sum(rows, r => r.farmers));
    if (el.awarenessAcres) el.awarenessAcres.textContent = fmt.num(sum(rows, r => r.acres), 1);
    if (el.awarenessPct) el.awarenessPct.textContent = fmt.pct(mean(rows, r => r.awarenessPct), 0);

    // Growth: wider selection (images often more available)
    const growthPick = pickMediaForSessions(rows, 'image');
    renderCentral(el.journeyMedia, growthPick, { controls:false });
    if (el.journeySessions) el.journeySessions.textContent = fmt.int(rows.length);
    if (el.journeyDef) el.journeyDef.textContent = fmt.pct(mean(rows, r => r.definitePct), 0);

    // Harvest: impact-oriented pick
    const harvestRows = rows.filter(s => (s.definitePct || 0) >= 92 || (s.theme || '') === 'harvest-impact');
    const harvestPick = pickMediaForSessions(harvestRows.length ? harvestRows : rows, 'video');
    renderCentral(el.impactMedia, harvestPick, { controls:true });
    if (el.impactClarity) el.impactClarity.textContent = fmt.pct(mean(rows, r => r.clarityPct), 0);

    // Future: objections / recommendations
    const futureRows = rows.filter(s => ((s.reasonsNo || '').toLowerCase().includes('price') || (s.theme || '') === 'future-fields'));
    const futurePick = pickMediaForSessions(futureRows.length ? futureRows : rows, 'image');
    renderCentral(el.futureMedia, futurePick, { controls:false });
  }

  async function shareVisual() {
    // Generates a simple 800x600 share image using the first available image media
    try {
      const rows = state.filteredSessions || state.filtered || [];
      const pick = pickMediaForSessions(rows, 'image') || pickMediaForSessions(rows, 'video');
      const canvas = document.createElement('canvas');
      canvas.width = 800; canvas.height = 600;
      const ctx = canvas.getContext('2d');

      // background
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(0,0,canvas.width,canvas.height);

      const drawOverlay = () => {
        ctx.fillStyle = 'rgba(0,0,0,.42)';
        ctx.fillRect(0, 0, canvas.width, 92);

        ctx.fillStyle = 'white';
        ctx.font = 'bold 28px system-ui, -apple-system, Segoe UI, Roboto';
        ctx.fillText('Harvest Horizons', 20, 38);

        ctx.font = '600 16px system-ui, -apple-system, Segoe UI, Roboto';
        ctx.fillStyle = 'rgba(231,237,247,.95)';
        ctx.fillText(`Sessions: ${fmt.int(rows.length)}   Farmers: ${fmt.int(sum(rows, r=>r.farmers))}   Acres: ${fmt.num(sum(rows,r=>r.acres),1)}`, 20, 66);

        ctx.font = '600 16px system-ui, -apple-system, Segoe UI, Roboto';
        ctx.fillStyle = 'rgba(159,176,202,.95)';
        ctx.fillText(`Definite: ${fmt.pct(mean(rows, r=>r.definitePct),0)}   Awareness: ${fmt.pct(mean(rows, r=>r.awarenessPct),0)}   Clarity: ${fmt.pct(mean(rows, r=>r.clarityPct),0)}`, 20, 88);
      };

      const finalize = () => {
        drawOverlay();
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = 'harvest-horizons.png';
        a.click();
      };

      if (!pick || !pick.src) {
        finalize();
        return;
      }

      if (pick.type === 'video') {
        // Use poster-like placeholder if video; still include stats
        finalize();
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = pick.src;

      img.onload = () => {
        // cover crop
        const iw = img.width, ih = img.height;
        const cw = canvas.width, ch = canvas.height;
        const s = Math.max(cw/iw, ch/ih);
        const nw = iw*s, nh=ih*s;
        const dx=(cw-nw)/2, dy=(ch-nh)/2;
        ctx.drawImage(img, dx, dy, nw, nh);
        finalize();
      };
      img.onerror = () => finalize();
    } catch (e) {
      logDiag(`shareVisual failed: ${e.message}`);
      setNotice(`<strong>Status:</strong> Unable to generate image. (${escapeHtml(e.message)})`);
    }
  }

  function bindThemeControls() {
    // Secondary reset button inside themes
    if (el.btnReset2) el.btnReset2.addEventListener('click', resetFilters);

    // Open-tab buttons
    $$('[data-open-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-open-tab');
        if (tab) activateTab(tab);
      });
    });

    // Share buttons
    $$('.share-btn').forEach(btn => btn.addEventListener('click', shareVisual));
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

    // Showcase: attempt to show pinned session media, else first sessions’ media
    const ids = [];
    if (state.pinnedSession?.sn) ids.push(String(state.pinnedSession.sn));
    for (const r of rows) {
      if (ids.length >= CONFIG.maxShowcase) break;
      if (r.sn && !ids.includes(String(r.sn))) ids.push(String(r.sn));
    }
    renderShowcase(el.snapShowcase, ids);
  }

  function destroyChart(ch) {
    try { ch?.destroy(); } catch(_) {}
  }

  function renderCharts(rows) {
    if (typeof Chart === 'undefined') return;

    // City mix (doughnut)
    const byCity = new Map();
    for (const r of rows) byCity.set(r.city, (byCity.get(r.city) || 0) + (r.farmers || 0));
    const cityLabels = Array.from(byCity.keys());
    const cityVals = Array.from(byCity.values());

    destroyChart(state.charts.city);
    state.charts.city = new Chart(el.chartCity, {
      type: 'doughnut',
      data: { labels: cityLabels, datasets: [{ data: cityVals }] },
      options: { responsive:true, plugins:{ legend:{ position:'bottom', labels:{ color:'#e7edf7' } } } }
    });

    // Intent split (pie): definite/maybe/no totals
    const sumDef = sum(rows, r => r.definite);
    const sumMay = sum(rows, r => r.maybe);
    const sumNo = sum(rows, r => r.notInterested);

    destroyChart(state.charts.intent);
    state.charts.intent = new Chart(el.chartIntent, {
      type: 'pie',
      data: { labels: ['Definite','Maybe','Not Interested'], datasets: [{ data: [sumDef, sumMay, sumNo] }] },
      options: { responsive:true, plugins:{ legend:{ position:'bottom', labels:{ color:'#e7edf7' } } } }
    });

    // Trend (line): farmers & acres by date
    const buckets = new Map(); // date -> agg
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

    destroyChart(state.charts.trend);
    state.charts.trend = new Chart(el.chartTrend, {
      type: 'line',
      data: {
        labels: dates.map(d => fmt.date(d)),
        datasets: [
          { label:'Farmers', data: farmersSeries, tension:.25 },
          { label:'Wheat Acres', data: acresSeries, tension:.25 }
        ]
      },
      options: {
        responsive:true,
        plugins:{ legend:{ position:'bottom', labels:{ color:'#e7edf7' } } },
        scales: {
          x: { ticks:{ color:'#9fb0ca' }, grid:{ color:'rgba(255,255,255,.08)' } },
          y: { ticks:{ color:'#9fb0ca' }, grid:{ color:'rgba(255,255,255,.08)' } }
        }
      }
    });
  }

  function renderTable(rows) {
    if (!el.tbl) return;
    el.tbl.innerHTML = rows.map(r => {
      const defP = r.definitePct;
      const aw = r.awarenessPct;
      const cl = r.clarityPct;
      return `<tr data-id="${escapeHtml(r.id || '')}" data-sn="${escapeHtml(r.sn || '')}">
        <td>${escapeHtml(fmt.date(r.date))}</td>
        <td>${escapeHtml(r.city || '—')}</td>
        <td>${escapeHtml(r.spot || '—')}</td>
        <td>${fmt.int(r.farmers)}</td>
        <td>${fmt.num(r.acres,1)}</td>
        <td>${fmt.pct(defP,0)}</td>
        <td>${fmt.pct(aw,0)}</td>
        <td>${fmt.pct(cl,0)}</td>
      </tr>`;
    }).join('') || `<tr><td colspan="8" class="muted">No sessions match the filters.</td></tr>`;

    // row click
    el.tbl.querySelectorAll('tr[data-sn]').forEach(tr => {
      tr.addEventListener('click', () => {
        const id = tr.getAttribute('data-id');
        const session = state.filtered.find(x => String(x.id) === String(id)) || state.sessions.find(x => String(x.id) === String(id));
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

    // Default view Pakistan
    state.map.setView([30.3753, 69.3451], 5);
  }

  function clearMap() {
    if (!state.map) return;
    for (const c of state.circles) c.remove();
    state.circles = [];
  }

  function acresToRadiusMeters(acres) {
    // area scale: acres -> m^2 (1 acre = 4046.86 m^2) => radius = sqrt(area/pi)
    const a = (typeof acres === 'number' && !isNaN(acres) && acres > 0) ? acres : 1;
    const area = a * 4046.86;
    const r = Math.sqrt(area / Math.PI);
    return clamp(r, 25, 2200);
  }

  function renderMap(rows) {
    if (!state.map) return;
    clearMap();

    const points = rows.filter(r => typeof r.lat === 'number' && typeof r.lon === 'number' && !isNaN(r.lat) && !isNaN(r.lon));
    if (!points.length) {
      el.mapLegend.textContent = 'No coordinates available in the filtered set.';
      return;
    }
    el.mapLegend.textContent = 'Bubble radius represents wheat acres covered (area-scaled). Click a bubble to pin that session.';

    const bounds = [];
    for (const r of points) {
      const radius = acresToRadiusMeters(r.acres || 1);
      const c = L.circle([r.lat, r.lon], {
        radius,
        weight: 1,
        opacity: 0.9,
        fillOpacity: 0.22
      }).addTo(state.map);

      c.on('click', () => pinSession(r, { openMedia:false, focusMap:false }));

      const html = `
        <div style="min-width:210px">
          <div style="font-weight:900">${escapeHtml(r.city || '')} — ${escapeHtml(r.spot || '')}</div>
          <div style="margin-top:6px; font-size:12px">
            <b>Date:</b> ${escapeHtml(fmt.date(r.date))}<br/>
            <b>Farmers:</b> ${fmt.int(r.farmers)}<br/>
            <b>Wheat Acres:</b> ${fmt.num(r.acres,1)}<br/>
            <b>Definite:</b> ${fmt.pct(r.definitePct,0)} · <b>Clarity:</b> ${fmt.pct(r.clarityPct,0)}
          </div>
        </div>`;
      c.bindPopup(html);

      state.circles.push(c);
      bounds.push([r.lat, r.lon]);
    }

    try {
      state.map.fitBounds(bounds, { padding:[18,18] });
    } catch(_) {}
  }

  function updateMapBanner(rows) {
    const s = state.pinnedSession;
    if (s) {
      el.mapSelTitle.textContent = `${s.city || '—'} — ${s.spot || '—'}`;
      el.mapSelFarmers.textContent = fmt.int(s.farmers);
      el.mapSelAcres.textContent = fmt.num(s.acres, 1);
      el.mapSelDate.textContent = fmt.date(s.date);
      renderShowcase(el.mapShowcase, [String(s.sn)].filter(Boolean));
      return;
    }

    const k = computeKpis(rows);
    el.mapSelTitle.textContent = 'All sessions';
    el.mapSelFarmers.textContent = fmt.int(k.farmers);
    el.mapSelAcres.textContent = fmt.num(k.acres, 1);
    // show date span
    const dates = rows.map(r => parseISO(r.date)).filter(Boolean).sort((a,b)=>a-b);
    const span = dates.length ? `${dates[0].toISOString().slice(0,10)} → ${dates[dates.length-1].toISOString().slice(0,10)}` : '—';
    el.mapSelDate.textContent = span;
    renderShowcase(el.mapShowcase, []);
  }

  function invalidateMapSoon() {
    if (!state.map) return;
    setTimeout(() => { try{ state.map.invalidateSize(); } catch(_) {} }, 80);
  }

  // ---------------------------
  // Media / Showcase / Lightbox
  // ---------------------------
  function buildGalleryList(rows) {
    // Choose media items for the filtered sessions; keep a max
    const items = [];
    for (const r of rows) {
      const key = r.key || `${safeStr(r.date)}|${safeStr(r.city)}|${safeStr(r.spot)}`;
      const arr = (state.mediaByKey.get(key) || state.mediaBySessionId.get(String(r.sn)) || []);
      for (const it of arr) items.push(it);
      if (items.length >= CONFIG.maxGallery) break;
    }

    // If empty, show placeholders derived from sessions
    if (!items.length) {
      const top = rows.slice(0, Math.min(CONFIG.maxGallery, 12));
      for (const r of top) {
        const label = `${safeStr(r.city)} — ${safeStr(r.spot)}`.trim() || `Session ${r.sn || ''}`;
        items.push({ sessionId: String(r.sn || ''), type:'image', src: placeholderCandidate(0) || INLINE_PLACEHOLDER, caption: label, transcript:'' });
      }
    }
    return items.slice(0, CONFIG.maxGallery);
  }

  function renderShowcase(container, sessionIds) {
    if (!container) return;
    container.innerHTML = '';

    const ids = sessionIds.filter(Boolean).slice(0, CONFIG.maxShowcase);
    if (!ids.length) {
      container.innerHTML = `<div class="muted" style="grid-column:1/-1">No pinned session. Click a bubble or a session row to preview media.</div>`;
      return;
    }

    for (const id of ids) {
      const items = (state.mediaBySessionId.get(String(id)) || []).slice(0, 1);
      const it = items[0] || { sessionId: id, type:'image', src: (placeholderCandidate(0) || placeholderCandidate(1) || INLINE_PLACEHOLDER), caption:`Session ${id}` };

      const tile = document.createElement('div');
      tile.className = 'showItem';
      tile.title = it.caption || '';

      const node = makeMediaNode(it, true);
      tile.appendChild(node);

      tile.addEventListener('click', () => openLightboxForSession(String(id)));

      container.appendChild(tile);
    }
  }

  function makeMediaNode(it, mute=false, opts={ controls:false }) {
    const src = it.src || placeholderCandidate(0) || INLINE_PLACEHOLDER;

    if (it.type === 'video') {
      const v = document.createElement('video');
      v.src = src;
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.autoplay = mute;
      v.controls = !!opts.controls;

      v.addEventListener('error', () => {
        // fallback to image placeholder
        v.replaceWith(makeImageNode(placeholderCandidate(0) || placeholderCandidate(1) || INLINE_PLACEHOLDER, it.caption));
      });
      return v;
    }
    return makeImageNode(src, it.caption);
  }

  function makeImageNode(src, alt='') {
    const img = document.createElement('img');
    img.src = src || placeholderCandidate(0) || INLINE_PLACEHOLDER;
    img.alt = alt || '';
    img.loading = 'lazy';

    img.addEventListener('error', () => {
      const p0 = placeholderCandidate(0);
      const p1 = placeholderCandidate(1);

      if (img.src.endsWith(p0) && p1) { img.src = p1; return; }
      if (p1 && img.src.endsWith(p1)) { img.src = INLINE_PLACEHOLDER; return; }

      // fallback path for any failing media
      img.src = p0 || p1 || INLINE_PLACEHOLDER;
    });

    return img;
  }

  function renderGallery(rows) {
    if (!el.gallery) return;
    const items = buildGalleryList(rows);
    el.gallery.innerHTML = '';

    items.forEach((it, idx) => {
      const tile = document.createElement('div');
      tile.className = 'mediaTile';
      tile.dataset.index = String(idx);
      tile.appendChild(makeMediaNode(it, false));

      const tag = document.createElement('div');
      tag.className = 'mediaTag';
      tag.textContent = it.caption || `Session ${it.sessionId || ''}`;
      tile.appendChild(tag);

      tile.addEventListener('click', () => openLightbox(items, idx));
      el.gallery.appendChild(tile);
    });
  }

  function openLightbox(items, index) {
    state.lightbox.items = items;
    state.lightbox.index = index;
    renderLightbox();
    el.lb.style.display = 'flex';
  }

  function openLightboxForSession(sessionId) {
    const items = (state.mediaBySessionId.get(String(sessionId)) || []).filter(it => it.src);
    if (!items.length) {
      openLightbox([{ sessionId, type:'image', src: (placeholderCandidate(0) || placeholderCandidate(1) || INLINE_PLACEHOLDER), caption:`Session ${sessionId}`, transcript:'' }], 0);
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
    // In lightbox, show controls for video
    if (node.tagName === 'VIDEO') {
      node.controls = true;
      node.autoplay = true;
    }
    el.lbMedia.appendChild(node);

    // keyboard
    el.lbPrev.disabled = (idx <= 0);
    el.lbNext.disabled = (idx >= items.length - 1);
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
      // inclusive end
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

    // Sort by date desc then sn
    rows.sort((a,b) => {
      const da = parseISO(a.date), db = parseISO(b.date);
      const ta = da ? da.getTime() : 0;
      const tb = db ? db.getTime() : 0;
      if (tb !== ta) return tb - ta;
      return String(a.sn||'').localeCompare(String(b.sn||''));
    });

    state.filtered = rows;
    state.filteredSessions = rows;

    updateSummary(rows);
    updateKpis(rows);
    updateHeroDonuts(rows);
    renderSnapshot(rows);
    renderCharts(rows);
    renderTable(rows);
    renderMap(rows);
    updateMapBanner(rows);
    renderGallery(rows);
    renderThemes();

    // note: keep pinned session only if still in scope; else clear
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

    // Select related media if available
    if (opts.openMedia) {
      // Switch to Media tab and open lightbox for this session
      activateTab('tab-media');
      invalidateMapSoon();
      openLightboxForSession(String(session.sn));
    }
  }

  // ---------------------------
  // Tabs
  // ---------------------------
  function activateTab(tabId) {
    $$('.tabBtn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    $$('.tabPanel').forEach(p => p.classList.toggle('active', p.id === tabId));
    if (tabId === 'tab-map') invalidateMapSoon();
  }

  function bindTabs() {
    $$('.tabBtn').forEach(btn => {
      btn.addEventListener('click', () => activateTab(btn.dataset.tab));
    });
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
  // Hero video
  // ---------------------------
  function initHeroVideo() {
    if (!el.heroVideo) return;

    const candidates = Array.isArray(CONFIG.heroVideoCandidates) ? CONFIG.heroVideoCandidates : [];
    let idx = 0;

    const tryNext = () => {
      const src = candidates[idx] || '';
      idx += 1;
      if (!src) {
        el.heroVideo.classList.add('hide');
        return;
      }
      el.heroVideo.src = src;
      // attempt play (autoplay might be blocked; keep muted)
      el.heroVideo.load();
      try { el.heroVideo.play(); } catch(_) {}
    };

    el.heroVideo.addEventListener('error', () => tryNext());
    el.heroVideo.addEventListener('canplay', () => {
      try { el.heroVideo.play(); } catch(_) {}
    });

    tryNext();
  }

  // ---------------------------
  // Escaping
  // ---------------------------
  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (m) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  // ---------------------------
  // Boot
  // ---------------------------
  async function boot() {
    try {
      setLoadingStatus('Initializing UI…');

      clearError();
      bindTabs();
      bindLightbox();
      bindThemeControls();

      el.shell.style.display = 'grid';
      el.shell.classList.add('ready');

      el.buildStamp.textContent = `build ${new Date().toISOString().slice(0,10)}`;

      // Filters events
      el.filterCity.addEventListener('change', () => { populateSpot(); state.pinnedSession = null; applyFilters(); });
      el.filterSpot.addEventListener('change', () => { state.pinnedSession = null; applyFilters(); });
      el.filterFrom.addEventListener('change', () => applyFilters());
      el.filterTo.addEventListener('change', () => applyFilters());
      el.filterSearch.addEventListener('input', debounce(applyFilters, 220));
      el.btnReset.addEventListener('click', resetFilters);

      el.btnExport.addEventListener('click', () => {
        const rows = state.filtered.slice().reverse(); // export oldest -> newest
        const csv = toCsv(rows, [
          { label:'SN', get:r => r.sn },
          { label:'Date', get:r => r.date },
          { label:'City', get:r => r.city },
          { label:'Spot', get:r => r.spot },
          { label:'Farmers', get:r => r.farmers },
          { label:'Wheat Acres', get:r => r.acres },
          { label:'Definite', get:r => r.definite },
          { label:'Maybe', get:r => r.maybe },
          { label:'Not Interested', get:r => r.notInterested },
          { label:'Definite %', get:r => r.definitePct },
          { label:'Awareness %', get:r => r.awarenessPct },
          { label:'Clarity %', get:r => r.clarityPct },
          { label:'Lat', get:r => r.lat },
          { label:'Lon', get:r => r.lon },
          { label:'Top reason to use', get:r => r.reasonsUse },
          { label:'Top reason not to use', get:r => r.reasonsNo },
        ]);
        downloadText('sessions_export.csv', csv, 'text/csv');
      });

      // init hero
      initHeroVideo();

      // init map
      initMap();

      // Data
      setNotice('<strong>Status:</strong> Loading data…');
      logDiag(`basePath = ${inferBasePath()}`);
      logDiag(`sessionsJson = ${CONFIG.sessionsJson}`);
      logDiag(`mediaJson = ${CONFIG.mediaJson}`);
      logDiag(`xlsxFallback = ${CONFIG.xlsxFallback}`);

      const sessions = await loadSessions();
      state.sessions = sessions;

      logDiag(`sessions loaded: ${sessions.length}`);

      const media = await loadMedia(sessions);
      logDiag(`media items loaded: ${media.length}`);

      // Populate filters and initial render
      populateFilters();
      applyFilters();

      // Done
      setLoadingStatus('Ready');
      el.overlay.style.opacity = '0';
      setTimeout(() => { el.overlay.style.display = 'none'; }, 250);

    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      showError(`<b>Dashboard failed to load.</b><br/><br/>${escapeHtml(msg)}<br/><br/>
        <b>Quick checks:</b><br/>
        1) Verify these files exist at your GitHub Pages root: <code>index.html</code>, <code>data_processor.js</code>, <code>sessions.json</code>, <code>media.json</code><br/>
        2) If you use Git LFS for assets, GitHub Pages may serve pointer files (not actual media). In that case, host media via GitHub Releases / CDN.<br/>
        3) Open browser DevTools → Console and Network for specific 404/blocked errors.`);
      setNotice('<strong>Status:</strong> Error');
      logDiag(`boot error: ${msg}`);

      el.shell.style.display = 'grid';
      el.shell.classList.add('ready');
      el.overlay.style.display = 'none';
    }
  }

  function debounce(fn, ms) {
    let t = null;
    return (...args) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  // Start after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
