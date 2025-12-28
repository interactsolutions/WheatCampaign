/* INTERACT v4 — robust GitHub Pages + iOS friendly dashboard (no build tools) */
(() => {
  'use strict';

  // --- DOM helpers
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const el = (tag, attrs = {}, children = []) => {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    });
    children.forEach((c) => n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return n;
  };

  // --- Base URL resolution (critical for GitHub Pages project sites)
  const scriptEl =
    document.currentScript ||
    document.querySelector('script[src$="dashboard.js"]') ||
    document.querySelector('script[src*="dashboard.js"]');
  const SCRIPT_BASE = scriptEl ? new URL('./', scriptEl.src) : new URL('./', window.location.href);
  const abs = (path) => new URL(path, SCRIPT_BASE).href;

  const qs = new URLSearchParams(window.location.search);
  const DEBUG = qs.get('debug') === '1';

  const state = {
    campaigns: [],
    campaign: null,
    sessions: [],
    media: null,
    filtered: [],
    map: null,
    markersLayer: null,
    mediaFilter: '__all__',
  };

  function log(...args) {
    if (DEBUG) console.log('[INTERACT]', ...args);
  }

  function fmtInt(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return '—';
    return new Intl.NumberFormat().format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return '—';
    return `${Math.round(n)}%`;
  }

  function scoreBand(score) {
    if (score === null || score === undefined || Number.isNaN(score)) return { cls: 'mid', label: '—' };
    if (score >= 85) return { cls: 'high', label: 'High' };
    if (score >= 70) return { cls: 'mid', label: 'Medium' };
    return { cls: 'low', label: 'Low' };
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} for ${url}\n${text.slice(0, 200)}`);
    }
    // Robust JSON parse with better error messages
    const txt = await res.text();
    try {
      return JSON.parse(txt);
    } catch (e) {
      throw new Error(`Invalid JSON at ${url}\n${String(e)}\nFirst 200 chars:\n${txt.slice(0, 200)}`);
    }
  }

  function showError(userMsg, details) {
    $('#errorBanner').classList.remove('hidden');
    $('#errorMsg').textContent = userMsg;
    $('#errorDetails').textContent = details || '';
  }

  function hideError() {
    $('#errorBanner').classList.add('hidden');
    $('#errorMsg').textContent = '';
    $('#errorDetails').textContent = '';
  }

  function setCampaignHeader(c) {
    $('#campaignTitle').textContent = c?.name || '—';
    const meta = [];
    if (c?.region) meta.push(c.region);
    if (c?.startDate && c?.endDate) meta.push(`${c.startDate} → ${c.endDate}`);
    $('#campaignMeta').textContent = meta.length ? meta.join(' • ') : '—';
  }

  function buildCampaignSelect(campaigns, activeId) {
    const sel = $('#campaignSelect');
    sel.innerHTML = '';
    campaigns.forEach((c) => {
      const o = document.createElement('option');
      o.value = c.id;
      o.textContent = c.name;
      if (c.id === activeId) o.selected = true;
      sel.appendChild(o);
    });

    sel.addEventListener('change', () => {
      const id = sel.value;
      const next = new URL(window.location.href);
      next.searchParams.set('campaign', id);
      window.location.href = next.toString();
    });
  }

  function computeTotals(items) {
    return items.reduce(
      (acc, s) => {
        acc.sessions += 1;
        acc.farmers += s.farmers || 0;
        acc.wheatFarmers += s.wheatFarmers || 0;
        acc.acres += s.acres || 0;
        acc.estimatedBuctrilAcres += s.estimatedBuctrilAcres || 0;
        acc.keyInfluencers += s.keyInfluencers || 0;
        return acc;
      },
      { sessions: 0, farmers: 0, wheatFarmers: 0, acres: 0, estimatedBuctrilAcres: 0, keyInfluencers: 0 }
    );
  }

  function applyFilters() {
    const district = $('#districtSelect').value;
    const q = $('#searchInput').value.trim().toLowerCase();
    const from = $('#fromDate').value ? new Date($('#fromDate').value) : null;
    const to = $('#toDate').value ? new Date($('#toDate').value) : null;

    state.filtered = state.sessions.filter((s) => {
      if (district !== '__all__' && (s.district || '').toLowerCase() !== district.toLowerCase()) return false;

      if (q) {
        const hay = `${s.sessionId} ${s.location} ${s.host} ${s.dealer} ${s.dealerName} ${s.facilitator}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (from || to) {
        const d = s.date ? new Date(s.date) : null;
        if (!d || Number.isNaN(d.getTime())) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
      }

      return true;
    });

    renderAll();
  }

  function resetFilters() {
    $('#districtSelect').value = '__all__';
    $('#searchInput').value = '';
    $('#fromDate').value = '';
    $('#toDate').value = '';
    state.filtered = [...state.sessions];
    renderAll();
  }

  function renderKPIs() {
    const t = computeTotals(state.filtered);
    $('#kpiSessions').textContent = fmtInt(t.sessions);
    $('#kpiFarmers').textContent = fmtInt(t.farmers);
    $('#kpiWheatFarmers').textContent = fmtInt(t.wheatFarmers);
    $('#kpiAcres').textContent = fmtInt(t.acres);
    $('#kpiBuctrilAcres').textContent = fmtInt(t.estimatedBuctrilAcres);
    $('#kpiInfluencers').textContent = fmtInt(t.keyInfluencers);

    $('#sessionCount').textContent = `${fmtInt(t.sessions)} sessions`;
    $('#markerCount').textContent = fmtInt(state.filtered.filter((s) => typeof s.latitude === 'number' && typeof s.longitude === 'number').length);
  }

  function renderDistrictDropdown() {
    const districts = Array.from(new Set(state.sessions.map((s) => (s.district || '').trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
    const sel = $('#districtSelect');
    // Keep "All" and rebuild rest
    const current = sel.value || '__all__';
    sel.innerHTML = '<option value="__all__">All</option>';
    districts.forEach((d) => {
      const o = document.createElement('option');
      o.value = d;
      o.textContent = d;
      sel.appendChild(o);
    });
    // Restore if still valid
    if (districts.includes(current)) sel.value = current;
  }

  function renderSessionsTable() {
    const tbody = $('#sessionsTbody');
    tbody.innerHTML = '';

    if (!state.filtered.length) {
      tbody.appendChild(el('tr', {}, [el('td', { colspan: '9', class: 'muted' }, ['No sessions match the filters.'])]));
      return;
    }

    state.filtered.forEach((s) => {
      const band = scoreBand(s.sessionScore);
      const tr = el('tr', {}, [
        el('td', {}, [String(s.sn ?? '')]),
        el('td', {}, [s.date || s.dateLabel || '—']),
        el('td', {}, [s.district || '—']),
        el('td', {}, [s.location || '—']),
        el('td', { class: 'num' }, [fmtInt(s.farmers)]),
        el('td', { class: 'num' }, [fmtInt(s.acres)]),
        el('td', { class: 'num' }, [fmtPct(s.definiteUseRate)]),
        el('td', { class: 'num' }, [fmtPct(s.awarenessRate)]),
        el('td', { class: 'num' }, [
          el('span', { class: `badge ${band.cls}`, title: `Session Score: ${s.sessionScore ?? '—'}` }, [
            String(s.sessionScore ?? '—'),
            ' ',
            band.label,
          ]),
        ]),
      ]);

      tr.addEventListener('click', () => openSessionModal(s));
      tbody.appendChild(tr);
    });
  }

  function renderSessionCards() {
    const wrap = $('#sessionCards');
    wrap.innerHTML = '';
    if (!state.filtered.length) {
      wrap.appendChild(el('div', { class: 'muted' }, ['No sessions match the filters.']));
      return;
    }

    state.filtered.forEach((s) => {
      const band = scoreBand(s.sessionScore);
      wrap.appendChild(
        el('div', { class: 'card' }, [
          el('div', { class: 'card-top' }, [
            el('div', {}, [
              el('div', { class: 'card-title' }, [`${s.sessionId || '—'} • ${s.district || '—'}`]),
              el('div', { class: 'card-sub' }, [`${s.date || s.dateLabel || '—'} • ${s.location || '—'}`]),
            ]),
            el('span', { class: `badge ${band.cls}` }, [String(s.sessionScore ?? '—'), ' ', band.label]),
          ]),
          el('div', { class: 'card-grid' }, [
            metric('Farmers', fmtInt(s.farmers)),
            metric('Acres', fmtInt(s.acres)),
            metric('Definite', fmtPct(s.definiteUseRate)),
            metric('Awareness', fmtPct(s.awarenessRate)),
          ]),
          el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => openSessionModal(s) }, ['Details']),
        ])
      );
    });
  }

  function metric(label, value) {
    return el('div', { class: 'card-m' }, [el('div', { class: 'l' }, [label]), el('div', { class: 'v' }, [value])]);
  }

  function openSessionModal(s) {
    // Lightweight modal using native <dialog> if available; fallback to alert
    if (!('HTMLDialogElement' in window)) {
      alert(
        [
          `${s.sessionId || ''} — ${s.district || ''}`,
          `Location: ${s.location || '—'}`,
          `Farmers: ${s.farmers ?? '—'} | Acres: ${s.acres ?? '—'}`,
          `Definite: ${fmtPct(s.definiteUseRate)} | Awareness: ${fmtPct(s.awarenessRate)} | Score: ${s.sessionScore ?? '—'}`,
          `Dealer: ${s.dealer || ''} (${s.dealerName || ''})`,
          `Host: ${s.host || ''}`,
        ].join('\n')
      );
      return;
    }

    let dlg = $('#sessionDlg');
    if (!dlg) {
      dlg = el('dialog', { id: 'sessionDlg' }, []);
      document.body.appendChild(dlg);
    }
    dlg.innerHTML = '';
    const band = scoreBand(s.sessionScore);

    const closeBtn = el('button', { class: 'btn btn-ghost', type: 'button' }, ['Close']);
    closeBtn.addEventListener('click', () => dlg.close());

    const mapsLink = (() => {
      if (typeof s.latitude !== 'number' || typeof s.longitude !== 'number') return null;
      const u = `https://www.google.com/maps?q=${encodeURIComponent(String(s.latitude) + ',' + String(s.longitude))}`;
      return el('a', { class: 'link', href: u, target: '_blank', rel: 'noopener' }, ['Open in Google Maps']);
    })();

    dlg.appendChild(
      el('div', { class: 'panel', style: 'margin:0; max-width:720px;' }, [
        el('div', { class: 'panel-head' }, [
          el('h2', {}, [`${s.sessionId || '—'} • ${s.district || '—'}`]),
          el('div', { class: 'panel-sub' }, [`${s.date || s.dateLabel || '—'} • ${s.location || '—'}`]),
        ]),
        el('div', { style: 'display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px;' }, [
          el('span', { class: `badge ${band.cls}` }, [`Score: ${s.sessionScore ?? '—'} (${band.label})`]),
          el('span', { class: 'badge mid' }, [`Definite: ${fmtPct(s.definiteUseRate)}`]),
          el('span', { class: 'badge mid' }, [`Awareness: ${fmtPct(s.awarenessRate)}`]),
          el('span', { class: 'badge mid' }, [`Used last year: ${fmtPct(s.usedLastYearRate)}`]),
        ]),
        el('div', { class: 'insights' }, [
          info('Farmers', fmtInt(s.farmers)),
          info('Wheat farmers', fmtInt(s.wheatFarmers)),
          info('Acres', fmtInt(s.acres)),
          info('Estimated Buctril acres', fmtInt(s.estimatedBuctrilAcres)),
          info('Key influencers', fmtInt(s.keyInfluencers)),
          info('Top reason to use', s.topReasonUse || '—'),
          info('Top reason not to use', s.topReasonNotUse || '—'),
          info('Dealer', `${s.dealer || '—'} • ${s.dealerName || ''} • ${s.dealerContact || ''}`.trim()),
          info('Host', `${s.host || '—'} • ${s.hostContact || ''}`.trim()),
          info('Facilitator', `${s.facilitator || '—'} • ${s.facilitatorContact || ''}`.trim()),
        ]),
        el('div', { style: 'display:flex; justify-content:space-between; align-items:center; gap:12px; margin-top:12px;' }, [
          mapsLink || el('span', { class: 'muted' }, ['—']),
          closeBtn,
        ]),
      ])
    );

    dlg.addEventListener('click', (e) => {
      const r = dlg.getBoundingClientRect();
      const inDialog = r.top <= e.clientY && e.clientY <= r.bottom && r.left <= e.clientX && e.clientX <= r.right;
      if (!inDialog) dlg.close();
    });

    dlg.showModal();
  }

  function info(title, value) {
    return el('div', { class: 'insight' }, [el('h3', {}, [title]), el('p', {}, [String(value ?? '—')])]);
  }

  function initMap() {
    const mapEl = $('#map');
    const fallback = $('#mapFallback');

    if (!window.L || !mapEl) {
      fallback.classList.remove('hidden');
      return;
    }

    const points = state.filtered
      .filter((s) => typeof s.latitude === 'number' && typeof s.longitude === 'number')
      .map((s) => [s.latitude, s.longitude, s]);

    const center = points.length ? [points[0][0], points[0][1]] : [27.5, 68.8];

    const map = L.map(mapEl, { scrollWheelZoom: false }).setView(center, 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    state.map = map;
    state.markersLayer = L.layerGroup().addTo(map);

    // iOS: fix map size after initial render
    setTimeout(() => map.invalidateSize(), 300);
  }

  function refreshMarkers() {
    if (!state.map || !state.markersLayer || !window.L) return;

    state.markersLayer.clearLayers();
    const points = state.filtered.filter((s) => typeof s.latitude === 'number' && typeof s.longitude === 'number');

    points.forEach((s) => {
      const band = scoreBand(s.sessionScore);
      const color =
        band.cls === 'high' ? '#2e7d32' : band.cls === 'mid' ? '#ff9800' : band.cls === 'low' ? '#f44336' : '#6c757d';

      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 4px 10px rgba(0,0,0,0.22)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const m = L.marker([s.latitude, s.longitude], { icon });
      const html = `
        <div style="font-weight:900; margin-bottom:4px">${escapeHtml(s.sessionId || '')} • ${escapeHtml(
        s.district || ''
      )}</div>
        <div style="font-size:12px; color:#555">${escapeHtml(s.location || '')}</div>
        <div style="font-size:12px; margin-top:6px">Farmers: <b>${s.farmers ?? '—'}</b> • Acres: <b>${s.acres ?? '—'}</b></div>
        <div style="font-size:12px">Definite: <b>${fmtPct(s.definiteUseRate)}</b> • Awareness: <b>${fmtPct(
        s.awarenessRate
      )}</b></div>
        <div style="font-size:12px">Score: <b>${s.sessionScore ?? '—'}</b></div>
      `;
      m.bindPopup(html);
      m.addTo(state.markersLayer);
    });

    if (points.length) {
      const bounds = L.latLngBounds(points.map((s) => [s.latitude, s.longitude]));
      state.map.fitBounds(bounds, { padding: [30, 30] });
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function renderGallery() {
    const wrap = $('#gallery');
    wrap.innerHTML = '';

    if (!state.media || !Array.isArray(state.media.mediaItems)) {
      wrap.appendChild(el('div', { class: 'muted' }, ['No media configuration found.']));
      $('#mediaCount').textContent = '0 items';
      return;
    }

    const base = state.media.mediaBasePath || '';
    const placeholder = abs(state.media?.assets?.placeholder || 'assets/placeholder.svg');

    const items = state.media.mediaItems.filter((m) => {
      const kind = (m.type || '').toLowerCase();
      if (state.mediaFilter === '__all__') return true;
      if (state.mediaFilter === 'photo') return kind === 'image' || kind === 'photo';
      if (state.mediaFilter === 'video') return kind === 'video';
      if (state.mediaFilter === 'brand') return (m.category || '').toLowerCase() === 'brand';
      return true;
    });

    $('#mediaCount').textContent = `${items.length} items`;

    if (!items.length) {
      wrap.appendChild(el('div', { class: 'muted' }, ['No media items match the filter.']));
      return;
    }

    items.forEach((m) => {
      const kind = (m.type || '').toLowerCase();
      const file = m.file || m.path || m.filename || '';
      const url = file ? abs(base + file) : placeholder;

      const cap = el('div', { class: 'media-cap' }, [
        el('div', { class: 'media-title' }, [m.title || m.sessionId || m.category || 'Media']),
        el('div', { class: 'media-meta' }, [
          [m.sessionId, m.district, m.date].filter(Boolean).join(' • ') || (m.category || '—'),
        ]),
      ]);

      let mediaNode;
      if (kind === 'video') {
        mediaNode = el('video', { controls: '', preload: 'metadata' }, []);
        mediaNode.src = url;
        mediaNode.addEventListener('error', () => {
          // video can't fallback well; show placeholder poster via replacing node
          const img = el('img', { src: placeholder, alt: 'Missing video' }, []);
          mediaNode.replaceWith(img);
        });
      } else {
        mediaNode = el('img', { src: url, alt: m.title || 'Media', loading: 'lazy' }, []);
        mediaNode.addEventListener('error', () => {
          mediaNode.src = placeholder;
        });
      }

      wrap.appendChild(el('div', { class: 'media' }, [mediaNode, cap]));
    });
  }

  function renderInsights() {
    const wrap = $('#insights');
    wrap.innerHTML = '';

    if (!state.filtered.length) {
      wrap.appendChild(el('div', { class: 'muted' }, ['No sessions available for insights.']));
      return;
    }

    // Top district by acres
    const byDistrict = new Map();
    state.filtered.forEach((s) => {
      const d = s.district || 'Unknown';
      const cur = byDistrict.get(d) || { acres: 0, farmers: 0, sessions: 0, awareness: [], definite: [] };
      cur.acres += s.acres || 0;
      cur.farmers += s.farmers || 0;
      cur.sessions += 1;
      if (typeof s.awarenessRate === 'number') cur.awareness.push(s.awarenessRate);
      if (typeof s.definiteUseRate === 'number') cur.definite.push(s.definiteUseRate);
      byDistrict.set(d, cur);
    });

    const districtList = Array.from(byDistrict.entries()).map(([d, v]) => {
      const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
      return { district: d, ...v, awarenessAvg: avg(v.awareness), definiteAvg: avg(v.definite) };
    });

    districtList.sort((a, b) => b.acres - a.acres);
    const top = districtList[0];

    // Lowest awareness district
    const lowAw = [...districtList].filter((x) => x.awarenessAvg !== null).sort((a, b) => a.awarenessAvg - b.awarenessAvg)[0];

    // Score distribution
    const scores = state.filtered.map((s) => s.sessionScore).filter((x) => typeof x === 'number');
    const dist = { high: 0, mid: 0, low: 0 };
    scores.forEach((sc) => {
      const b = scoreBand(sc).cls;
      if (b === 'high') dist.high++;
      else if (b === 'mid') dist.mid++;
      else dist.low++;
    });

    wrap.appendChild(
      el('div', { class: 'insight' }, [
        el('h3', {}, ['Top district by acres']),
        el('p', {}, [
          `${top.district}: ${fmtInt(top.acres)} acres across ${fmtInt(top.sessions)} sessions (${fmtInt(top.farmers)} farmers).`,
        ]),
      ])
    );

    if (lowAw) {
      wrap.appendChild(
        el('div', { class: 'insight' }, [
          el('h3', {}, ['Lowest awareness (re-activation candidate)']),
          el('p', {}, [`${lowAw.district}: avg awareness ${fmtPct(lowAw.awarenessAvg)} across ${fmtInt(lowAw.sessions)} sessions.`]),
        ])
      );
    }

    wrap.appendChild(
      el('div', { class: 'insight' }, [
        el('h3', {}, ['Session Score distribution']),
        el('p', {}, [`High: ${fmtInt(dist.high)} • Medium: ${fmtInt(dist.mid)} • Low: ${fmtInt(dist.low)} (scored sessions: ${fmtInt(scores.length)}).`]),
      ])
    );
  }

  function renderAll() {
    renderKPIs();
    renderSessionsTable();
    renderSessionCards();
    renderGallery();
    renderInsights();
    refreshMarkers();
  }

  function bindUI() {
    $('#applyBtn').addEventListener('click', applyFilters);
    $('#resetBtn').addEventListener('click', resetFilters);

    // Filters should feel responsive
    $('#districtSelect').addEventListener('change', applyFilters);

    // Media chips
    $$('.chip').forEach((b) => {
      b.addEventListener('click', () => {
        $$('.chip').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        state.mediaFilter = b.getAttribute('data-media-filter') || '__all__';
        renderGallery();
      });
    });

    // Export
    $('#exportBtn').addEventListener('click', async () => {
      try {
        const csv = buildCsv(state.filtered);
        await exportCsvIOSFriendly(`interact_${state.campaign?.id || 'campaign'}_${new Date().toISOString().slice(0, 10)}.csv`, csv);
      } catch (e) {
        showError('Export failed.', String(e));
      }
    });
  }

  function buildCsv(items) {
    const cols = [
      'sn',
      'sessionId',
      'date',
      'district',
      'location',
      'farmers',
      'wheatFarmers',
      'acres',
      'awarenessRate',
      'usedLastYearRate',
      'definiteUseRate',
      'sessionScore',
      'dealer',
      'dealerName',
      'dealerContact',
      'host',
      'facilitator',
      'latitude',
      'longitude',
    ];

    const esc = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      const needs = /[",\n\r]/.test(s);
      const clean = s.replaceAll('"', '""');
      return needs ? `"${clean}"` : clean;
    };

    const lines = [];
    lines.push(cols.join(','));
    items.forEach((it) => {
      lines.push(cols.map((c) => esc(it[c])).join(','));
    });
    return lines.join('\n');
  }

  async function exportCsvIOSFriendly(filename, csvText) {
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
    const file = new File([blob], filename, { type: blob.type });

    // Best option: iOS share sheet / modern browsers
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    // iOS fallback: open in a new tab so user can Save to Files
    const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isiOS) window.open(url, '_blank');

    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function applyCampaignAssets() {
    // Header videos + background video are configured per-campaign in media.json under `assets`.
    const media = state.media || {};
    const assets = media.assets || {};

    // 1) Background video
    const bg = assets.backgroundVideo || 'assets/bg.mp4';
    const bgVideo = document.getElementById('bgVideo');
    if (bgVideo) {
      const src = bgVideo.querySelector('source');
      if (src) {
        const next = abs(bg);
        if (src.getAttribute('src') !== next) {
          src.setAttribute('src', next);
          try { bgVideo.load(); } catch (_) {}
        }
      }
      // iOS autoplay guard
      bgVideo.play().catch(() => {
        // If autoplay is blocked, hide the video container (CSS backdrop remains)
        const container = document.querySelector('.video-bg-container');
        if (container) container.style.display = 'none';
      });
    }

    // 2) Header brand strip
    const wrap = document.getElementById('headerMedia');
    if (!wrap) return;
    wrap.innerHTML = '';

    const headerVideos = Array.isArray(assets.headerVideos) ? assets.headerVideos : [
      'assets/bayer.mp4', 'assets/interact.mp4', 'assets/buctril.mp4', 'assets/atlantis.mp4'
    ];

    const brandImages = Array.isArray(assets.brandImages) ? assets.brandImages : [
      'assets/interact.gif', 'assets/bayer.jpg', 'assets/Buctril.jpg', 'assets/Atlantis.jpg', 'assets/products.jpg'
    ];

    // Build media tiles; if a header video is missing, fallback to a related brand image when possible.
    headerVideos.forEach((v, idx) => {
      const tile = el('div', { class: 'hmedia' }, []);
      const url = abs(v);

      const vid = el('video', { muted: '', autoplay: '', loop: '', playsinline: '', preload: 'metadata' }, []);
      const source = el('source', { src: url, type: 'video/mp4' }, []);
      vid.appendChild(source);

      vid.addEventListener('error', () => {
        const fallback = brandImages[idx] || brandImages[0] || 'assets/placeholder.svg';
        const img = el('img', { src: abs(fallback), alt: 'Brand media' }, []);
        tile.innerHTML = '';
        tile.appendChild(img);
      });

      // If autoplay is blocked on iOS, also fallback to image
      vid.play().catch(() => {
        const fallback = brandImages[idx] || brandImages[0] || 'assets/placeholder.svg';
        const img = el('img', { src: abs(fallback), alt: 'Brand media' }, []);
        tile.innerHTML = '';
        tile.appendChild(img);
      });

      tile.appendChild(vid);
      wrap.appendChild(tile);
    });
  }


  async function load() {
    hideError();

    // 1) Load campaign registry
    const campaignsUrl = abs('data/campaigns.json');
    log('Loading campaigns:', campaignsUrl);
    const reg = await fetchJson(campaignsUrl);
    const campaigns = Array.isArray(reg.campaigns) ? reg.campaigns : [];
    if (!campaigns.length) throw new Error(`No campaigns found in ${campaignsUrl}`);

    const requestedId = (qs.get('campaign') || reg.defaults?.campaignId || campaigns[0].id || '').trim();
    const active = campaigns.find((c) => c.id === requestedId) || campaigns[0];

    state.campaigns = campaigns;
    state.campaign = active;

    buildCampaignSelect(campaigns, active.id);
    setCampaignHeader(active);

    // 2) Load sessions
    const sessionsUrl = abs(active.sessionsPath);
    log('Loading sessions:', sessionsUrl);
    const sessObj = await fetchJson(sessionsUrl);
    const sessions = Array.isArray(sessObj.sessions) ? sessObj.sessions : [];
    if (!sessions.length) throw new Error(`No sessions found in ${sessionsUrl}`);

    // 3) Load media
    const mediaUrl = abs(active.mediaPath);
    log('Loading media:', mediaUrl);
    const mediaObj = await fetchJson(mediaUrl);

    state.sessions = sessions;
    state.media = mediaObj;
    state.filtered = [...sessions];

    // Apply per-campaign media settings (header + background)
    applyCampaignAssets();

    // Build district dropdown now that sessions exist
    renderDistrictDropdown();

    // Render counts immediately
    $('#campaignTitle').textContent = active.name;
    $('#campaignMeta').textContent =
      [active.region, active.startDate && active.endDate ? `${active.startDate} → ${active.endDate}` : '']
        .filter(Boolean)
        .join(' • ') || '—';

    // Init map once; then re-render markers
    initMap();

    // Render everything
    renderAll();

    // Health: verify totals against expectedTotals (non-blocking)
    if (active.expectedTotals) {
      const actual = computeTotals(state.sessions);
      const mismatch = Object.keys(active.expectedTotals).filter((k) => active.expectedTotals[k] !== actual[k]);
      if (mismatch.length) {
        showError(
          'Data totals mismatch (campaign registry vs computed).',
          `Mismatched keys: ${mismatch.join(', ')}\nExpected: ${JSON.stringify(active.expectedTotals)}\nActual: ${JSON.stringify(actual)}`
        );
      }
    }

    // show media count
    $('#mediaCount').textContent = state.media?.mediaItems ? `${state.media.mediaItems.length} items` : '0 items';
  }

  function showMobileLayout() {
    // CSS handles table vs cards; we only toggle a helper flag
    const isMobile = window.matchMedia('(max-width: 760px)').matches;
    $('#sessionCards').classList.toggle('hidden', !isMobile);
  }

  async function main() {
    try {
      bindUI();
      showMobileLayout();
      window.addEventListener('resize', showMobileLayout);

      await load();

      // Apply URL-specified filters if present
      if (qs.get('district')) {
        $('#districtSelect').value = qs.get('district');
      }
      applyFilters();
    } catch (e) {
      log('Load error', e);
      showError(
        'Required files could not be loaded from GitHub Pages.',
        `${String(e)}\n\nTips:\n- Confirm GitHub Pages is serving from /(root) and files exist in repo root.\n- Open ./healthcheck.html to see which URL is failing.\n- Ensure filenames and folders match case (GitHub Pages is case-sensitive).`
      );
      // Also show map fallback message
      $('#mapFallback').classList.remove('hidden');
      $('#gallery').innerHTML = '<div class="muted">Media is unavailable until data loads.</div>';
      $('#sessionsTbody').innerHTML = '<tr><td colspan="9" class="muted">Sessions are unavailable until data loads.</td></tr>';
      $('#insights').innerHTML = '<div class="muted">Insights are unavailable until data loads.</div>';
    }
  }

  document.addEventListener('DOMContentLoaded', main);
})();
