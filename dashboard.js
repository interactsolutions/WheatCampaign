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

    add(norm);

    // If request is wrong folder (root) try under assets/gallery
    if (!norm.startsWith('assets/gallery/') && !norm.includes('/gallery/')) {
      const fname = norm.split('/').pop();
      add('assets/gallery/' + fname);
    }

    // Extension swaps
    const exts = ['.jpeg','.jpg','.png','.webp'];
    const isImg = /\.(jpeg|jpg|png|webp)$/i.test(norm);
    const isVid = /\.(mp4|webm)$/i.test(norm);

    if (isImg) {
      const base = norm.replace(/\.(jpeg|jpg|png|webp)$/i, '');
      for (const e of exts) add(base + e);

      // with/without trailing 'a'
      const m = base.match(/(.*?)(a)$/i);
      if (m) {
        const b2 = m[1];
        for (const e of exts) add(b2 + e);
      } else {
        for (const e of exts) add(base + 'a' + e);
      }
    }

    if (isVid) {
      const base = norm.replace(/\.(mp4|webm)$/i, '');
      add(base + '.mp4');
      add(base + '.webm');

      const m = base.match(/(.*?)(a)$/i);
      if (m) {
        add(m[1] + '.mp4');
        add(m[1] + '.webm');
      } else {
        add(base + 'a.mp4');
        add(base + 'a.webm');
      }
    }

    return candidates;
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
    const panels = $$$('[data-tab]');

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

    filterSessions();
    renderAll();
  }

  function resetDateInputs() {
    const fromEl = $$('#dateFrom');
    const toEl = $$('#dateTo');

    if (fromEl && state.dateMin) fromEl.value = formatDateInput(state.dateMin);
    if (toEl && state.dateMax) toEl.value = formatDateInput(state.dateMax);

    applyDateInputs();
  }

  function filterSessions() {
    const a = state.dateFrom;
    const b = state.dateTo;
    state.filteredSessions = state.sessions.filter(s => {
      const d = parseDateSafe(s.date);
      if (!d) return false;
      return d >= a && d <= b;
    });
  }

  // ---------- Render ----------
  function renderSummary() {
    $$('#kpiSessions').textContent = fmtInt(state.filteredSessions.length);

    // Farmers/acres from sheets_index if available; else from session fields
    let farmers = 0;
    let acres = 0;
    let scoreSum = 0;
    let scoreN = 0;

    const idx = state.sheetsIndex?.sheets ? new Map(state.sheetsIndex.sheets.map(x => [x.sheet, x])) : null;

    for (const s of state.filteredSessions) {
      const si = idx?.get(s.sheetRef);
      if (si) {
        farmers += Number(si.farmers_present || 0);
        acres += Number(si.acres || 0);
      } else {
        // fallback
        farmers += Number(s.farmersPresent || 0);
        acres += Number(s.acres || 0);
      }
      if (Number.isFinite(Number(s.score))) {
        scoreSum += Number(s.score);
        scoreN += 1;
      }
    }

    $$('#kpiFarmers').textContent = fmtInt(farmers);
    $$('#kpiAcres').textContent = fmt1(acres);
    $$('#kpiScore').textContent = scoreN ? fmt1(scoreSum / scoreN) : '—';

    // top sessions table (by score)
    const top = [...state.filteredSessions].sort((a,b) => Number(b.score||0) - Number(a.score||0)).slice(0, 10);
    const tbody = $$('#topSessionsTable tbody');
    if (!tbody) return;
    tbody.innerHTML = top.map(s => {
      const sid = esc(s.id);
      const sheet = esc(s.sheetRef || '');
      const date = esc(s.date || '');
      const district = esc(s.district || '');
      const village = esc(s.village || s.spot || '');
      const score = Number.isFinite(Number(s.score)) ? fmt1(s.score) : '—';
      const si = idx?.get(s.sheetRef);
      const f = si ? fmtInt(si.farmers_present) : '—';
      const a = si ? fmt1(si.acres) : '—';
      const hrefSheet = `sheets.html?campaign=${encodeURIComponent(state.campaignId)}&sheet=${encodeURIComponent(s.sheetRef)}`;
      return `<tr data-session-id="${sid}">
        <td>${date}</td>
        <td><span class="badge">${sheet}</span></td>
        <td>${district}</td>
        <td>${village}</td>
        <td>${f}</td>
        <td>${a}</td>
        <td>${score}</td>
        <td><a class="btn btnSmall" href="${hrefSheet}">Open sheet</a></td>
      </tr>`;
    }).join('');
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
      const img = firstMediaImage(s);
      const title = `${sheet} • ${district} • ${village}`;
      const hrefDetails = `details.html?campaign=${encodeURIComponent(state.campaignId)}&session=${encodeURIComponent(String(s.id))}`;
      return `<div class="mediaCard" data-session-id="${sid}">
        <div class="mediaThumb">
          <img data-media-thumb="1" alt="${esc(title)}" />
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
  function ensureMapReady() {
    const el = $$('#leafletMap');
    if (!el) return;

    if (!window.L) {
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
