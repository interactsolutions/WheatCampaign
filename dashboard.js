(() => {
  'use strict';

  const $$ = (sel, root = document) => root.querySelector(sel);
  const $$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const state = {
    campaigns: [],
    campaign: null,
    mediaCfg: null,
    sheetsIndex: null,
    allSessions: [],
    filteredSessions: [],
    filters: {
      district: '',
      q: '',
      from: '',
      to: ''
    },
    page: 1,
    pageSize: 12,
    map: null,
    markerLayer: null,
    selected: null,
    selectedMediaUrl: null,
    mediaPreviewsEnabled: false
  };

  function url(path) {
    // Always resolve relative to the current document (works on GitHub Pages subpaths)
    return new URL(String(path || ''), document.baseURI).toString();
  }

  async function fetchJson(path) {
    const res = await fetch(url(path), { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch ${path} (HTTP ${res.status})`);
    return res.json();
  }

  function safeStr(v) {
    if (v === null || v === undefined) return '';
    return String(v);
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = safeStr(s);
    return div.innerHTML;
  }

  function fmtInt(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '—';
    return Math.round(x).toLocaleString();
  }

  function fmtPct(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '—';
    return `${Math.round(x)}%`;
  }

  function parseDateSafe(s) {
    const t = Date.parse(String(s || ''));
    if (!Number.isFinite(t)) return null;
    return new Date(t);
  }

  function formatDateHuman(s) {
    const d = parseDateSafe(s);
    if (!d) return safeStr(s || '—');
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  }

  function formatDateInput(s) {
    const d = parseDateSafe(s);
    if (!d) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function setStatus(msg, type = 'info') {
    const el = $$('#statusChip');
    if (!el) return;
    el.textContent = `Status: ${msg}`;
    el.classList.toggle('warnChip', type === 'warn');
  }

  function getCampaignIdFromUrl() {
    const qs = new URLSearchParams(location.search);
    return qs.get('campaign') || '';
  }

  function setCampaignInUrl(campaignId) {
    const u = new URL(location.href);
    u.searchParams.set('campaign', campaignId);
    // keep hash
    location.href = u.toString();
  }

  function activeTab() {
    return (location.hash || '#summary').replace(/^#/, '');
  }

  function sessionTitle(s) {
    const ref = s.sheetRef ? ` ${s.sheetRef}` : '';
    const spot = s.spot || s.village || '';
    const dist = s.district || s.city || '';
    return `${dist}${spot ? ' • ' + spot : ''}${ref ? ' •' + ref : ''}`.trim();
  }

  function openInMapsUrl(lat, lng, label) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
    const q = encodeURIComponent(label || `${lat},${lng}`);
    return `https://www.google.com/maps?q=${q}&ll=${lat},${lng}`;
  }

  function aggregateTop(objList, keyFn) {
    const m = new Map();
    for (const it of objList) {
      const k = keyFn(it);
      if (!k) continue;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }

  function renderDonut(el, pct, centerLabel) {
    if (!el) return;
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    const size = 116;
    const stroke = 14;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const off = c * (1 - p / 100);

    el.innerHTML = `
      <div style="position:relative;width:${size}px;height:${size}px;">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
          <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="rgba(255,255,255,.14)" stroke-width="${stroke}" fill="none"></circle>
          <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="rgba(76,111,255,.95)" stroke-width="${stroke}" fill="none"
            stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"
            transform="rotate(-90 ${size / 2} ${size / 2})"></circle>
        </svg>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;">
          <div style="font-size:22px;font-weight:800;line-height:1;">${Math.round(p)}%</div>
          <div style="font-size:12px;opacity:.78;">${escapeHtml(centerLabel || '')}</div>
        </div>
      </div>
    `;
  }

  function populateCampaignSelect() {
    const sel = $$('#campaignSelect');
    if (!sel) return;

    sel.innerHTML = '';
    for (const c of state.campaigns) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name || c.id;
      if (state.campaign && c.id === state.campaign.id) opt.selected = true;
      sel.appendChild(opt);
    }

    sel.addEventListener('change', () => {
      const next = sel.value;
      if (!next) return;
      setCampaignInUrl(next);
    });
  }

  function populateDistrictSelect() {
    const sel = $$('#districtSelect');
    if (!sel) return;

    const districts = Array.from(new Set(state.allSessions.map(s => safeStr(s.district || s.city || '').trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));

    const current = state.filters.district;
    sel.innerHTML = '<option value="">All districts</option>';
    for (const d of districts) {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      if (d === current) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  function readFiltersFromUI() {
    state.filters.district = safeStr($$('#districtSelect')?.value || '').trim();
    state.filters.q = safeStr($$('#searchInput')?.value || '').trim();
    state.filters.from = safeStr($$('#fromDate')?.value || '').trim();
    state.filters.to = safeStr($$('#toDate')?.value || '').trim();
  }

  function resetFiltersUI() {
    const districtSelect = $$('#districtSelect');
    if (districtSelect) districtSelect.value = '';
    const q = $$('#searchInput');
    if (q) q.value = '';
    const from = $$('#fromDate');
    if (from) from.value = '';
    const to = $$('#toDate');
    if (to) to.value = '';

    state.filters = { district: '', q: '', from: '', to: '' };
  }

  function applyFilters(resetPage = false) {
    if (resetPage) state.page = 1;

    const q = state.filters.q.toLowerCase();
    const district = state.filters.district.toLowerCase();
    const from = state.filters.from ? Date.parse(state.filters.from) : null;
    const to = state.filters.to ? Date.parse(state.filters.to) : null;

    const filtered = state.allSessions.filter(s => {
      const d = safeStr(s.district || s.city || '').toLowerCase();
      if (district && d !== district) return false;

      if (q) {
        const hay = [
          s.sheetRef, s.spot, s.village, s.district, s.city,
          s.host?.name, s.salesRep?.name, s.dealer?.nearest, s.dealer?.name
        ].map(safeStr).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }

      const dt = Date.parse(s.date || '');
      if (Number.isFinite(from) && Number.isFinite(dt) && dt < from) return false;
      if (Number.isFinite(to) && Number.isFinite(dt) && dt > to) return false;

      return true;
    });

    // Sort newest first
    filtered.sort((a, b) => Date.parse(b.date || '') - Date.parse(a.date || ''));

    state.filteredSessions = filtered;

    renderSelectionChip();
    renderSummary();
    renderSessionsTable();
    updateMapData();

    if (state.mediaPreviewsEnabled) renderMediaWall(true);
  }

  function renderSelectionChip() {
    const el = $$('#selectionChip');
    if (!el) return;

    const parts = [];
    if (state.filters.district) parts.push(state.filters.district);
    if (state.filters.q) parts.push(`search: ${state.filters.q}`);
    if (state.filters.from) parts.push(`from ${state.filters.from}`);
    if (state.filters.to) parts.push(`to ${state.filters.to}`);
    el.textContent = parts.length ? `Filter: ${parts.join(' • ')}` : 'Filter: none';
  }

  function renderSummary() {
    const ss = state.filteredSessions;

    const totalSessions = ss.length;
    const totalFarmers = ss.reduce((a, s) => a + (Number(s.metrics?.farmers) || 0), 0);
    const totalAcres = ss.reduce((a, s) => a + (Number(s.metrics?.wheatAcres) || Number(s.metrics?.acres) || 0), 0);
    const avgScore = ss.length ? (ss.reduce((a, s) => a + (Number(s.score) || 0), 0) / ss.length) : 0;

    $$('#sSessions') && ($$('#sSessions').textContent = fmtInt(totalSessions));
    $$('#sFarmers') && ($$('#sFarmers').textContent = fmtInt(totalFarmers));
    $$('#sAcres') && ($$('#sAcres').textContent = fmtInt(totalAcres));
    $$('#sScore') && ($$('#sScore').textContent = ss.length ? `${avgScore.toFixed(1)}` : '—');

    // Donuts (average %)
    const avgAwareness = ss.length ? (ss.reduce((a, s) => a + (Number(s.metrics?.awarenessPct) || 0), 0) / ss.length) : 0;
    const avgDefinite = ss.length ? (ss.reduce((a, s) => a + (Number(s.metrics?.definitePct) || 0), 0) / ss.length) : 0;
    // Understanding: map scale 1-5 -> percent
    const avgUnderstandingRaw = ss.length ? (ss.reduce((a, s) => a + (Number(s.metrics?.avgUnderstanding) || 0), 0) / ss.length) : 0;
    const avgUnderstanding = Math.max(0, Math.min(100, (avgUnderstandingRaw / 5) * 100));

    renderDonut($$('#donutIntent'), avgDefinite, 'avg definite');
    $$('#metaIntent') && ($$('#metaIntent').textContent = `${fmtPct(avgDefinite)} average definite intent`);

    renderDonut($$('#donutAwareness'), avgAwareness, 'avg aware');
    $$('#metaAwareness') && ($$('#metaAwareness').textContent = `${fmtPct(avgAwareness)} average awareness`);

    renderDonut($$('#donutUnderstanding'), avgUnderstanding, 'avg (1–5)');
    $$('#metaUnderstanding') && ($$('#metaUnderstanding').textContent = `${avgUnderstandingRaw ? avgUnderstandingRaw.toFixed(1) : '—'} / 5 average understanding`);

    // Coverage: estimated buctril acres over wheat acres
    const est = ss.reduce((a, s) => a + (Number(s.metrics?.estimatedBuctrilAcres) || 0), 0);
    const cov = totalAcres ? (est / totalAcres) * 100 : 0;
    renderDonut($$('#donutCoverage'), cov, 'est share');
    $$('#metaCoverage') && ($$('#metaCoverage').textContent = `${fmtPct(cov)} estimated coverage share`);

    // Top reasons
    const topUse = aggregateTop(ss, s => safeStr(s.topReasonUse || '').trim());
    const topNot = aggregateTop(ss, s => safeStr(s.topReasonNotUse || '').trim());
    const topComp = aggregateTop(ss, s => safeStr(s.competitors || '').trim());

    $$('#topUse') && ($$('#topUse').textContent = topUse.length ? `${topUse[0][0]} (${topUse[0][1]})` : '—');
    $$('#topNotUse') && ($$('#topNotUse').textContent = topNot.length ? `${topNot[0][0]} (${topNot[0][1]})` : '—');
    $$('#topCompetitors') && ($$('#topCompetitors').textContent = topComp.length ? `${topComp[0][0]} (${topComp[0][1]})` : '—');

    // Date range
    const dates = ss.map(s => Date.parse(s.date || '')).filter(Number.isFinite).sort((a, b) => a - b);
    const range = dates.length ? `${formatDateHuman(new Date(dates[0]).toISOString().slice(0,10))} → ${formatDateHuman(new Date(dates[dates.length - 1]).toISOString().slice(0,10))}` : '—';
    $$('#range') && ($$('#range').textContent = range);
  }

  function renderSessionsTable() {
    const tbody = $$('#sessionsTbody');
    if (!tbody) return;

    const ss = state.filteredSessions;
    const totalPages = Math.max(1, Math.ceil(ss.length / state.pageSize));
    state.page = Math.min(state.page, totalPages);

    const start = (state.page - 1) * state.pageSize;
    const pageItems = ss.slice(start, start + state.pageSize);

    tbody.innerHTML = '';
    for (const s of pageItems) {
      const tr = document.createElement('tr');
      tr.tabIndex = 0;
      tr.innerHTML = `
        <td>${escapeHtml(s.sheetRef || '')}</td>
        <td>${escapeHtml(formatDateHuman(s.date))}</td>
        <td>${escapeHtml(s.district || s.city || '')}</td>
        <td>${escapeHtml(s.spot || s.village || '')}</td>
        <td class="num">${escapeHtml(fmtInt(s.metrics?.farmers))}</td>
        <td class="num">${escapeHtml(fmtInt(s.metrics?.wheatAcres))}</td>
        <td class="num">${escapeHtml(fmtPct(s.metrics?.awarenessPct))}</td>
        <td class="num">${escapeHtml(fmtPct(s.metrics?.definitePct))}</td>
        <td class="num">${escapeHtml((Number(s.score) || 0).toFixed(1))}</td>
      `;
      tr.addEventListener('click', () => openSession(s));
      tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') openSession(s); });
      tbody.appendChild(tr);
    }

    $$('#pageInfo') && ($$('#pageInfo').textContent = `Page ${state.page} / ${totalPages}`);
    $$('#prevBtn') && ($$('#prevBtn').disabled = state.page <= 1);
    $$('#nextBtn') && ($$('#nextBtn').disabled = state.page >= totalPages);
  }

  function downloadCsv() {
    const ss = state.filteredSessions;
    const cols = [
      ['sheetRef', 'sheetRef'],
      ['date', 'date'],
      ['district', 'district'],
      ['spot', 'spot'],
      ['farmers', s => s.metrics?.farmers],
      ['wheatAcres', s => s.metrics?.wheatAcres],
      ['awarenessPct', s => s.metrics?.awarenessPct],
      ['definitePct', s => s.metrics?.definitePct],
      ['score', 'score']
    ];

    const lines = [];
    lines.push(cols.map(c => `"${c[0]}"`).join(','));
    for (const s of ss) {
      const row = cols.map(([_, getter]) => {
        const v = (typeof getter === 'function') ? getter(s) : s[getter];
        const txt = safeStr(v).replace(/"/g, '""');
        return `"${txt}"`;
      }).join(',');
      lines.push(row);
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const fname = `${state.campaign?.id || 'campaign'}-sessions.csv`;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  function openDrawer() {
    const drawer = $$('#sessionDrawer');
    const backdrop = $$('#drawerBackdrop');
    if (!drawer || !backdrop) return;
    drawer.classList.remove('hidden');
    backdrop.classList.remove('hidden');
    // trigger transition
    requestAnimationFrame(() => drawer.classList.add('open'));
  }

  function closeDrawer() {
    const drawer = $$('#sessionDrawer');
    const backdrop = $$('#drawerBackdrop');
    if (!drawer || !backdrop) return;
    drawer.classList.remove('open');
    // wait for transition
    setTimeout(() => {
      drawer.classList.add('hidden');
      backdrop.classList.add('hidden');
    }, 180);
  }

  async function loadSheetSummary(sheetRef) {
    const host = $$('#drawerSheet');
    if (!host) return;

    if (!sheetRef || !state.campaign?.id) {
      host.innerHTML = '<div class="muted">No sheet reference for this session.</div>';
      return;
    }

    host.innerHTML = '<div class="muted">Loading sheet…</div>';
    try {
      const sheet = await fetchJson(`data/${state.campaign.id}/sheets/${sheetRef}.json`);
      const meta = sheet.meta || {};
      const fb = sheet.feedback || {};
      const sig = sheet.signatures || {};

      const rows = [];
      rows.push(['Village', meta.village || meta.spot || '—']);
      rows.push(['District', meta.district || '—']);
      rows.push(['Farmers', fmtInt(meta.farmers_present)]);
      rows.push(['Acres', fmtInt(meta.acres)]);
      if (fb.host_comment) rows.push(['Host comment', fb.host_comment]);
      if (fb.manager_note) rows.push(['Manager note', fb.manager_note]);

      const sigHtml = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
          ${sig.host ? `<div><div class="muted" style="margin-bottom:6px;">Host signature</div><img src="${escapeHtml(sig.host)}" alt="Host signature" style="width:100%;border-radius:12px;border:1px solid rgba(255,255,255,.10)"/></div>` : ''}
          ${sig.sales ? `<div><div class="muted" style="margin-bottom:6px;">Sales signature</div><img src="${escapeHtml(sig.sales)}" alt="Sales signature" style="width:100%;border-radius:12px;border:1px solid rgba(255,255,255,.10)"/></div>` : ''}
        </div>
      `;

      host.innerHTML = `
        ${rows.map(([k, v]) => `<div class="row"><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div></div>`).join('')}
        ${sigHtml}
      `;
    } catch (err) {
      console.warn('Sheet load failed:', err);
      host.innerHTML = '<div class="muted">Sheet summary unavailable.</div>';
    }
  }

  function sessionMediaItems(s) {
    const media = s.media || {};
    const imgs = Array.isArray(media.images) ? media.images : [];
    const vids = Array.isArray(media.videos) ? media.videos : [];
    return {
      images: imgs,
      videos: vids
    };
  }

  function normalizeGalleryPath(p) {
    const raw = safeStr(p).trim();
    if (!raw) return '';
    if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) return raw;

    // sessions.json stores "gallery/.."
    if (raw.startsWith('gallery/')) return `assets/${raw}`;
    // already under assets/
    if (raw.startsWith('assets/')) return raw;
    return `assets/gallery/${raw.replace(/^\/+/, '')}`;
  }

  function renderDrawerMedia(s) {
    const host = $$('#drawerMedia');
    if (!host) return;

    const { images, videos } = sessionMediaItems(s);
    const items = [
      ...images.map(x => ({ type: 'image', path: x })),
      ...videos.map(x => ({ type: 'video', path: x }))
    ];

    if (!items.length) {
      host.innerHTML = '<div class="muted">No media references for this session.</div>';
      return;
    }

    // Do not auto-load missing assets: show filenames and load-on-click
    host.innerHTML = items.map((it, i) => {
      const p = normalizeGalleryPath(it.path);
      const label = it.type === 'video' ? 'Video' : 'Image';
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06);">
          <div style="min-width:0;">
            <div style="font-weight:700;">${label} ${i + 1}</div>
            <div class="muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px;">${escapeHtml(it.path)}</div>
          </div>
          <button class="btn" data-open-media="${escapeHtml(p)}" data-media-type="${it.type}">Open</button>
        </div>
      `;
    }).join('');

    $$$('[data-open-media]', host).forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-open-media') || '';
        const t = btn.getAttribute('data-media-type') || 'image';
        openLightbox(p, t);
      });
    });
  }

  async function openSession(s) {
    state.selected = s;

    $$('#dTitle') && ($$('#dTitle').textContent = sessionTitle(s));
    $$('#dSub') && ($$('#dSub').textContent = `${formatDateHuman(s.date)} • ${fmtInt(s.metrics?.farmers)} farmers • ${fmtInt(s.metrics?.wheatAcres)} acres`);

    $$('#dHost') && ($$('#dHost').textContent = `${safeStr(s.host?.name || '')}${s.host?.phone ? ' (' + safeStr(s.host.phone) + ')' : ''}`.trim() || '—');
    $$('#dRep') && ($$('#dRep').textContent = `${safeStr(s.salesRep?.name || '')}${s.salesRep?.phone ? ' (' + safeStr(s.salesRep.phone) + ')' : ''}`.trim() || '—');
    $$('#dDealer') && ($$('#dDealer').textContent = `${safeStr(s.dealer?.nearest || s.dealer?.name || '')}${s.dealer?.phone ? ' (' + safeStr(s.dealer.phone) + ')' : ''}`.trim() || '—');

    $$('#dFarmers') && ($$('#dFarmers').textContent = fmtInt(s.metrics?.farmers));
    $$('#dAcres') && ($$('#dAcres').textContent = fmtInt(s.metrics?.wheatAcres));
    $$('#dDefinite') && ($$('#dDefinite').textContent = fmtPct(s.metrics?.definitePct));
    $$('#dScore') && ($$('#dScore').textContent = (Number(s.score) || 0).toFixed(1));
    $$('#dTopUse') && ($$('#dTopUse').textContent = safeStr(s.topReasonUse || '—'));
    $$('#dTopNotUse') && ($$('#dTopNotUse').textContent = safeStr(s.topReasonNotUse || '—'));

    // Action buttons
    const mapsBtn = $$('#openMapsBtn');
    if (mapsBtn) {
      const lat = Number(s.geo?.lat);
      const lng = Number(s.geo?.lng);
      const link = openInMapsUrl(lat, lng, sessionTitle(s));
      mapsBtn.disabled = !link;
      mapsBtn.onclick = () => { if (link) window.open(link, '_blank', 'noopener'); };
    }

    const shareBtn = $$('#shareSessionBtn');
    if (shareBtn) {
      shareBtn.onclick = async () => {
        const u = new URL(location.href);
        u.searchParams.set('campaign', state.campaign?.id || '');
        u.hash = `session-${s.sheetRef || s.id}`;
        await shareUrl(u.toString(), `Session ${s.sheetRef || s.id}`);
      };
    }

    const openSheetBtn = $$('#openSheetBtn');
    if (openSheetBtn) {
      const ref = s.sheetRef || '';
      openSheetBtn.disabled = !ref;
      openSheetBtn.onclick = () => {
        if (!ref) return;
        const u = new URL('sheets.html', document.baseURI);
        u.searchParams.set('campaign', state.campaign?.id || '');
        u.searchParams.set('sheet', ref);
        window.open(u.toString(), '_blank', 'noopener');
      };
    }

    renderDrawerMedia(s);
    await loadSheetSummary(s.sheetRef);

    openDrawer();
  }

  function openLightbox(assetUrl, type = 'image') {
    const lb = $$('#lightbox');
    const body = $$('#lightboxBody');
    if (!lb || !body) return;

    state.selectedMediaUrl = assetUrl;

    const safeUrl = escapeHtml(assetUrl);
    if (type === 'video') {
      body.innerHTML = `
        <video controls preload="metadata" style="width:100%;max-height:70vh;border-radius:16px;border:1px solid rgba(255,255,255,.10);background:#000" src="${safeUrl}">
          Sorry, your browser cannot play this video.
        </video>
        <div class="muted" style="margin-top:8px;">If this shows an error or stays blank, the video file is missing on the server.</div>
      `;
    } else {
      body.innerHTML = `
        <img src="${safeUrl}" alt="Media" style="width:100%;max-height:70vh;object-fit:contain;border-radius:16px;border:1px solid rgba(255,255,255,.10);background:#0b0f19"
          onerror="this.onerror=null;this.src='assets/placeholder.svg';" />
        <div class="muted" style="margin-top:8px;">If you see a placeholder, the image file is missing on the server.</div>
      `;
    }

    lb.classList.remove('hidden');
    lb.setAttribute('aria-hidden', 'false');
  }

  function closeLightbox() {
    const lb = $$('#lightbox');
    const body = $$('#lightboxBody');
    if (!lb || !body) return;
    lb.classList.add('hidden');
    lb.setAttribute('aria-hidden', 'true');
    body.innerHTML = '';
    state.selectedMediaUrl = null;
  }

  async function shareUrl(u, title) {
    const urlToShare = safeStr(u);
    if (!urlToShare) return;

    if (navigator.share) {
      try {
        await navigator.share({ title: title || 'INTERACT Campaign', url: urlToShare });
        return;
      } catch (err) {
        // cancelled
      }
    }
    try {
      await navigator.clipboard.writeText(urlToShare);
      alert('Link copied to clipboard.');
    } catch (err) {
      prompt('Copy this link:', urlToShare);
    }
  }

  
  function renderMediaWall(force = false) {
    const host = $$('#mediaWall');
    if (!host) return;

    const ss = state.filteredSessions;

    const counts = ss.reduce((acc, s) => {
      const m = sessionMediaItems(s);
      acc.sessions += 1;
      acc.images += m.images.length;
      acc.videos += m.videos.length;
      return acc;
    }, { sessions: 0, images: 0, videos: 0 });

    $$('#mSessions') && ($$('#mSessions').textContent = `${counts.sessions} Sessions`);
    $$('#mImages') && ($$('#mImages').textContent = `${counts.images} Images`);
    $$('#mVideos') && ($$('#mVideos').textContent = `${counts.videos} Videos`);

    const hint = $$('#mediaHint');
    if (hint) {
      hint.textContent = state.mediaPreviewsEnabled
        ? 'Previews enabled. If you see 404 errors, deploy your media under assets/gallery/ using the same filenames as sessions.json.'
        : 'Previews are off to avoid 404 spam. Click “Load media previews” to try thumbnails (requires media files deployed under assets/gallery/).';
    }

    // Lightweight cards: no automatic <video> loads. Images are optional (behind a toggle).
    host.innerHTML = ss.map(s => {
      const m = sessionMediaItems(s);
      const imageCount = m.images.length;
      const videoCount = m.videos.length;
      const thumb = (state.mediaPreviewsEnabled && m.images[0]) ? normalizeGalleryPath(m.images[0]) : 'assets/placeholder.svg';

      return `
        <div class="mediaCard" data-open-session="${escapeHtml(s.sheetRef || s.id)}" role="button" tabindex="0">
          <div class="mediaThumb" style="background-image:url('${escapeHtml(thumb)}');background-size:cover;background-position:center;display:flex;align-items:flex-end;justify-content:flex-start;">
            <div style="width:100%;padding:10px;background:linear-gradient(to top, rgba(0,0,0,.55), rgba(0,0,0,0));border-radius:16px;">
              <div style="font-size:20px;font-weight:900;">${escapeHtml(s.sheetRef || '')}</div>
              <div class="muted">${escapeHtml(formatDateHuman(s.date))}</div>
            </div>
          </div>
          <div class="mediaMeta">
            <div class="mediaTitle">${escapeHtml(s.district || s.city || '')}</div>
            <div class="muted">${escapeHtml(s.spot || s.village || '')}</div>
            <div class="muted">${imageCount} images • ${videoCount} videos</div>
          </div>
        </div>
      `;
    }).join('');

    $$$('.mediaCard[data-open-session]', host).forEach(card => {
      const open = () => {
        const ref = card.getAttribute('data-open-session');
        const s = state.filteredSessions.find(x => safeStr(x.sheetRef || x.id) === safeStr(ref));
        if (s) openSession(s);
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
    });
  }


  // --- Map ---
  function initMap() {
    const el = $$('#leafletMap');
    const fb = $$('#mapFallback');
    if (!el) return;

    if (!window.L) {
      fb && fb.classList.remove('hidden');
      el.classList.add('hidden');
      renderMapListFallback();
      return;
    }

    fb && fb.classList.add('hidden');
    el.classList.remove('hidden');

    if (state.map) return; // already

    const map = window.L.map(el, { zoomControl: false });
    state.map = map;
    state.markerLayer = window.L.layerGroup().addTo(map);

    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    window.L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Click handling for marker popup buttons (if any in future)
    updateMapData();
  }

  function updateMapData() {
    if (activeTab() === 'map') {
      if (!state.map) initMap();
    }
    if (!state.map || !state.markerLayer || !window.L) {
      renderMapListFallback();
      return;
    }

    state.markerLayer.clearLayers();
    const points = [];

    for (const s of state.filteredSessions) {
      const lat = Number(s.geo?.lat);
      const lng = Number(s.geo?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      points.push([lat, lng]);

      const marker = window.L.circleMarker([lat, lng], {
        radius: 7,
        weight: 2,
        fillOpacity: 0.8
      });

      const html = `
        <div style="min-width:220px">
          <div style="font-weight:900;margin-bottom:4px;">${escapeHtml(s.sheetRef || '')} • ${escapeHtml(s.district || '')}</div>
          <div style="margin-bottom:6px;">${escapeHtml(s.spot || s.village || '')}</div>
          <div class="muted" style="margin-bottom:6px;">${escapeHtml(formatDateHuman(s.date))} • ${escapeHtml(fmtInt(s.metrics?.farmers))} farmers</div>
          <button class="btn" data-open-session="${escapeHtml(s.sheetRef || s.id)}" style="width:100%;">Open session</button>
        </div>
      `;
      marker.bindPopup(html);

      marker.on('popupopen', (ev) => {
        const container = ev.popup.getElement();
        if (!container) return;
        const btn = container.querySelector('[data-open-session]');
        if (btn) {
          btn.addEventListener('click', () => openSession(s));
        }
      });

      marker.addTo(state.markerLayer);
    }

    // Fit map
    if (points.length) {
      try {
        state.map.fitBounds(points, { padding: [24, 24] });
      } catch (_) {}
    } else {
      try { state.map.setView([30.0, 70.0], 5); } catch (_) {}
    }
  }

  function renderMapListFallback() {
    const host = $$('#mapList');
    if (!host) return;

    const rows = state.filteredSessions
      .filter(s => Number.isFinite(Number(s.geo?.lat)) && Number.isFinite(Number(s.geo?.lng)))
      .slice(0, 20)
      .map(s => {
        const lat = Number(s.geo?.lat);
        const lng = Number(s.geo?.lng);
        const link = openInMapsUrl(lat, lng, sessionTitle(s));
        const label = `${safeStr(s.sheetRef || '')} • ${safeStr(s.district || '')} • ${safeStr(s.spot || s.village || '')}`;
        return `<a href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;
      })
      .join('');

    host.innerHTML = rows || '<div class="muted">No geo points available in the current filter.</div>';
  }

  // --- Bindings ---
  function bindUI() {
    // Filters
    $$('#applyBtn')?.addEventListener('click', () => { readFiltersFromUI(); applyFilters(true); });
    $$('#resetBtn')?.addEventListener('click', () => { resetFiltersUI(); applyFilters(true); });
    $$('#exportBtn')?.addEventListener('click', downloadCsv);

    // Pagination
    $$('#prevBtn')?.addEventListener('click', () => { state.page = Math.max(1, state.page - 1); renderSessionsTable(); });
    $$('#nextBtn')?.addEventListener('click', () => { state.page += 1; renderSessionsTable(); });

    // Drawer close
    $$('#drawerClose')?.addEventListener('click', closeDrawer);
    $$('#drawerBackdrop')?.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeDrawer(); closeLightbox(); } });

    // Lightbox close
    $$('#lightboxClose')?.addEventListener('click', closeLightbox);
    $$('#lightbox')?.addEventListener('click', (e) => { if (e.target && e.target.id === 'lightbox') closeLightbox(); });

    $$('#shareMediaBtn')?.addEventListener('click', () => {
      if (!state.selectedMediaUrl) return;
      shareUrl(state.selectedMediaUrl, 'Campaign media');
    });
    $$('#copyLinkBtn')?.addEventListener('click', async () => {
      if (!state.selectedMediaUrl) return;
      try { await navigator.clipboard.writeText(state.selectedMediaUrl); alert('Link copied.'); }
      catch { prompt('Copy link:', state.selectedMediaUrl); }
    });

    // Media previews toggle
    $$('#loadMediaBtn')?.addEventListener('click', () => {
      state.mediaPreviewsEnabled = true;
      renderMediaWall(true);
    });

    // Map buttons
    $$('#fitBtn')?.addEventListener('click', () => {
      if (state.map) updateMapData();
    });
    $$('#mapResetBtn')?.addEventListener('click', () => {
      state.filters = { ...state.filters, district: '', q: '', from: '', to: '' };
      resetFiltersUI();
      applyFilters(true);
    });

    // Tab changes: initialize map when entering map tab
    window.addEventListener('hashchange', () => {
      if (activeTab() === 'map') initMap();
      // If hash indicates a session: #session-D1S1 or #session-1
      const h = activeTab();
      if (h.startsWith('session-')) {
        const ref = h.replace(/^session-/, '');
        const s = state.filteredSessions.find(x => safeStr(x.sheetRef) === ref || safeStr(x.id) === ref);
        if (s) openSession(s);
      }
    });

    if (activeTab() === 'map') initMap();
  }

  async function loadCampaign(c) {
    setStatus('loading campaign…');
    const sessionsDoc = await fetchJson(c.sessionsUrl);
    state.allSessions = Array.isArray(sessionsDoc.sessions) ? sessionsDoc.sessions : [];
    state.filteredSessions = state.allSessions.slice();

    // Prefill default date range inputs
    const dates = state.allSessions.map(s => Date.parse(s.date || '')).filter(Number.isFinite).sort((a, b) => a - b);
    if (dates.length) {
      const from = formatDateInput(new Date(dates[0]).toISOString().slice(0, 10));
      const to = formatDateInput(new Date(dates[dates.length - 1]).toISOString().slice(0, 10));
      // Only set if empty
      if ($$('#fromDate') && !$$('#fromDate').value) $$('#fromDate').value = from;
      if ($$('#toDate') && !$$('#toDate').value) $$('#toDate').value = to;
    }

    // media cfg (optional)
    try { state.mediaCfg = await fetchJson(c.mediaUrl); } catch (_) { state.mediaCfg = null; }

    // sheets index (optional)
    try { state.sheetsIndex = await fetchJson(c.sheetsIndexUrl); } catch (_) { state.sheetsIndex = null; }

    populateDistrictSelect();
  }

  async function boot() {
    try {
      setStatus('starting…');
      const campaignsDoc = await fetchJson('data/campaigns.json');
      state.campaigns = Array.isArray(campaignsDoc.campaigns) ? campaignsDoc.campaigns : [];
      const cid = getCampaignIdFromUrl() || state.campaigns[0]?.id;
      state.campaign = state.campaigns.find(x => x.id === cid) || state.campaigns[0];

      if (!state.campaign) {
        setStatus('no campaigns found', 'warn');
        return;
      }

      populateCampaignSelect();
      await loadCampaign(state.campaign);
      bindUI();
      applyFilters(true);
      renderMediaWall(true); // lightweight view, still no auto-load
      setStatus('ready');
    } catch (err) {
      console.error(err);
      setStatus('failed to load', 'warn');
      const host = $$('#mediaWall');
      if (host) host.innerHTML = `<div class="warn">Failed to load data. ${escapeHtml(err.message || err)}</div>`;
    }
  }

  boot();
})();
