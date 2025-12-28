(() => {
  'use strict';

  // ---------- Utilities ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const fmtInt = (n) => {
    if (n === null || n === undefined || Number.isNaN(n)) return '—';
    try { return Number(n).toLocaleString('en-US'); } catch { return String(n); }
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function parseDateISO(s) {
    if (!s) return null;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  function showStatus(type, msg) {
    const bar = $('#statusBar');
    if (!bar) return;
    bar.classList.remove('status--error', 'status--ok', 'status--show');
    bar.textContent = msg || '';
    if (type === 'error') bar.classList.add('status--show', 'status--error');
    else if (type === 'ok') bar.classList.add('status--show', 'status--ok');
    else bar.classList.remove('status--show');
  }

  async function fetchJSON(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  }

  function getParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  }

  function setParam(name, val) {
    const url = new URL(window.location.href);
    if (val === null || val === undefined || val === '') url.searchParams.delete(name);
    else url.searchParams.set(name, val);
    history.replaceState({}, '', url.toString());
  }

  // iPhone-friendly CSV export
  async function exportCsvIOSFriendly(filename, csvText) {
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
    const file = new File([blob], filename, { type: blob.type });

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

    const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isiOS) window.open(url, '_blank');

    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function scoreBand(score) {
    if (score === null || score === undefined) return 'mid';
    if (score >= 85) return 'high';
    if (score >= 70) return 'mid';
    return 'low';
  }

  function markerColor(score) {
    const b = scoreBand(score);
    if (b === 'high') return '#2e7d32';
    if (b === 'mid') return '#ff9800';
    return '#d32f2f';
  }

  // ---------- State ----------
  const state = {
    campaigns: null,
    campaign: null,
    sessions: [],
    media: null,
    filtered: [],
    mediaFilter: 'all',
    map: null,
    cluster: null,
  };

  // ---------- UI Wiring ----------
  function bindUI() {
    $('#btnApply')?.addEventListener('click', () => applyFilters());
    $('#btnReset')?.addEventListener('click', () => resetFilters());
    $('#districtFilter')?.addEventListener('change', () => applyFilters(true));
    $('#q')?.addEventListener('input', debounce(() => applyFilters(true), 200));
    $('#from')?.addEventListener('change', () => applyFilters(true));
    $('#to')?.addEventListener('change', () => applyFilters(true));

    $('#btnExport')?.addEventListener('click', async () => {
      if (!state.filtered.length) {
        showStatus('error', 'No sessions to export for the current filter.');
        return;
      }
      const csv = buildCsv(state.filtered);
      const campaignId = state.campaign?.id || 'campaign';
      const filename = `${campaignId}-sessions.csv`;
      try {
        await exportCsvIOSFriendly(filename, csv);
        showStatus('ok', 'Export prepared.');
        setTimeout(() => showStatus(null, ''), 1800);
      } catch (e) {
        showStatus('error', `Export failed: ${e.message}`);
      }
    });

    $('#campaignSelect')?.addEventListener('change', async (e) => {
      const id = e.target.value;
      setParam('campaign', id);
      await loadCampaignById(id);
    });

    // Modal close
    const modal = $('#modal');
    modal?.addEventListener('click', (e) => {
      if (e.target && e.target.hasAttribute('data-close')) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    // Gallery filters
    $$('.chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.chip').forEach((b) => b.classList.remove('chip--active'));
        btn.classList.add('chip--active');
        state.mediaFilter = btn.getAttribute('data-media-filter') || 'all';
        renderGallery();
      });
    });
  }

  function debounce(fn, ms) {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  // ---------- Data Load ----------
  async function boot() {
    bindUI();
    tryPlayBackgroundVideo();

    try {
      showStatus(null, '');
      const campaigns = await fetchJSON('data/campaigns.json');
      state.campaigns = campaigns;

      const campaignId = getParam('campaign') || campaigns.defaultCampaignId || campaigns.campaigns?.[0]?.id;
      if (!campaignId) throw new Error('No campaigns configured in data/campaigns.json');

      populateCampaignSelect(campaignId);
      await loadCampaignById(campaignId);

      showStatus('ok', 'Dashboard loaded.');
      setTimeout(() => showStatus(null, ''), 1200);
    } catch (e) {
      console.error(e);
      showStatus('error', `Load failed: ${e.message}. Check that data/ files exist in the repo root and GitHub Pages serves them.`);
    }
  }

  function populateCampaignSelect(selectedId) {
    const sel = $('#campaignSelect');
    if (!sel) return;
    sel.innerHTML = '';
    for (const c of state.campaigns.campaigns || []) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.title;
      if (c.id === selectedId) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  async function loadCampaignById(id) {
    const cfg = (state.campaigns.campaigns || []).find(c => c.id === id) || (state.campaigns.campaigns || [])[0];
    if (!cfg) throw new Error(`Campaign "${id}" not found.`);

    state.campaign = cfg;

    // Header text
    $('#campaignTitle').textContent = cfg.title || 'Campaign';
    $('#campaignSubtitle').textContent = cfg.title || 'Campaign';
    const dr = cfg.dateRange ? `${cfg.dateRange.from} → ${cfg.dateRange.to}` : '—';
    $('#campaignRange').textContent = dr;

    // Prefill dates
    const from = $('#from');
    const to = $('#to');
    if (from && cfg.dateRange?.from) from.value = cfg.dateRange.from;
    if (to && cfg.dateRange?.to) to.value = cfg.dateRange.to;

    // Load data
    const sessionsUrl = cfg.data?.sessions;
    const mediaUrl = cfg.data?.media;
    if (!sessionsUrl || !mediaUrl) throw new Error('Campaign config missing data.sessions or data.media');

    // If Leaflet not available, still show data/table/gallery
    const [sessionsPayload, mediaPayload] = await Promise.all([
      fetchJSON(sessionsUrl),
      fetchJSON(mediaUrl),
    ]);

    state.sessions = normalizeSessions(sessionsPayload);
    state.media = mediaPayload;

    // District dropdown
    populateDistricts(state.sessions);

    // KPIs
    renderKPIs(sessionsPayload);

    // Apply filters (default)
    applyFilters(true);

    // Map + Gallery + Insights
    initOrRefreshMap();
    renderGallery();
    renderInsights();

    // Pills
    $('#sessionsPill').textContent = `Showing ${fmtInt(state.filtered.length)} of ${fmtInt(state.sessions.length)}`;
  }

  function normalizeSessions(payload) {
    const sessions = payload.sessions || [];
    return sessions.map(s => ({
      ...s,
      __date: parseDateISO(s.date),
      __score: (s.sessionScore === null || s.sessionScore === undefined) ? null : Number(s.sessionScore),
      __aw: s?.rates?.awareness ?? null,
      __def: s?.rates?.definite ?? null,
    }));
  }

  function renderKPIs(payload) {
    $('#kpiSessions').textContent = fmtInt(payload.totalSessions);
    $('#kpiFarmers').textContent = fmtInt(payload.totalFarmers);
    $('#kpiWheatFarmers').textContent = fmtInt(payload.totalWheatFarmers);
    $('#kpiAcres').textContent = fmtInt(payload.totalAcres);
    $('#kpiBuctrilAcres').textContent = fmtInt(payload.estimatedBuctrilAcres);
    $('#kpiInfluencers').textContent = fmtInt(payload.keyInfluencers);
  }

  function populateDistricts(sessions) {
    const sel = $('#districtFilter');
    if (!sel) return;
    const districts = Array.from(new Set(sessions.map(s => (s.district || '').trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
    const current = sel.value || 'all';
    sel.innerHTML = '<option value="all">All</option>' + districts.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
    sel.value = districts.includes(current) ? current : 'all';
  }

  // ---------- Filters ----------
  function applyFilters(silent = false) {
    const district = ($('#districtFilter')?.value || 'all').trim();
    const q = ($('#q')?.value || '').trim().toLowerCase();
    const from = parseDateISO($('#from')?.value);
    const to = parseDateISO($('#to')?.value);
    const toEnd = to ? new Date(to.getTime() + 24*60*60*1000 - 1) : null;

    state.filtered = state.sessions.filter(s => {
      if (district !== 'all' && (s.district || '').trim() !== district) return false;
      if (q) {
        const hay = [
          s.sessionId, s.district, s.location, s.facilitator, s.host, s.dealer, s.dealerName, s.village
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (from && s.__date && s.__date < from) return false;
      if (toEnd && s.__date && s.__date > toEnd) return false;
      return true;
    });

    renderSessions();
    refreshMapMarkers();
    renderInsights();
    if (!silent) showStatus('ok', `Applied filters. Showing ${state.filtered.length} sessions.`);
    $('#sessionsPill').textContent = `Showing ${fmtInt(state.filtered.length)} of ${fmtInt(state.sessions.length)}`;
  }

  function resetFilters() {
    $('#districtFilter').value = 'all';
    $('#q').value = '';
    // reset to campaign range if available
    if (state.campaign?.dateRange?.from) $('#from').value = state.campaign.dateRange.from;
    if (state.campaign?.dateRange?.to) $('#to').value = state.campaign.dateRange.to;
    applyFilters(false);
  }

  // ---------- Rendering: Sessions ----------
  function renderSessions() {
    const tbody = $('#sessionsTbody');
    const cards = $('#sessionCards');
    if (!tbody || !cards) return;

    tbody.innerHTML = '';
    cards.innerHTML = '';

    for (const s of state.filtered) {
      const band = scoreBand(s.__score);
      const pillClass = band === 'high' ? 'scorePill scorePill--high' : band === 'low' ? 'scorePill scorePill--low' : 'scorePill scorePill--mid';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(String(s.sn ?? ''))}</td>
        <td>${escapeHtml(s.date || '')}</td>
        <td>${escapeHtml(s.district || '')}</td>
        <td>${escapeHtml(s.location || '')}</td>
        <td>${fmtInt(s.farmers)}</td>
        <td>${fmtInt(s.acres)}</td>
        <td>${fmtRate(s?.rates?.definite)}</td>
        <td>${fmtRate(s?.rates?.awareness)}</td>
        <td><span class="${pillClass}">${escapeHtml(s.__score !== null ? String(s.__score) : '—')}</span></td>
      `;
      tr.addEventListener('click', () => openSessionModal(s));
      tbody.appendChild(tr);

      const card = document.createElement('div');
      card.className = 'cardRow';
      card.innerHTML = `
        <div class="cardRow__top">
          <div>
            <div class="cardRow__title">${escapeHtml((s.sessionId ? s.sessionId + ' — ' : '') + (s.location || ''))}</div>
            <div class="cardRow__meta">${escapeHtml([s.date, s.district].filter(Boolean).join(' • '))}</div>
          </div>
          <span class="${pillClass}">${escapeHtml(s.__score !== null ? String(s.__score) : '—')}</span>
        </div>
        <div class="kv">
          <div><div class="k">Farmers</div><div class="v">${fmtInt(s.farmers)}</div></div>
          <div><div class="k">Acres</div><div class="v">${fmtInt(s.acres)}</div></div>
          <div><div class="k">Definite</div><div class="v">${fmtRate(s?.rates?.definite)}</div></div>
          <div><div class="k">Awareness</div><div class="v">${fmtRate(s?.rates?.awareness)}</div></div>
        </div>
      `;
      card.addEventListener('click', () => openSessionModal(s));
      cards.appendChild(card);
    }
  }

  function fmtRate(v) {
    if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
    return `${Math.round(Number(v))}%`;
  }

  function openSessionModal(s) {
    const el = $('#modalContent');
    if (!el) return;

    el.innerHTML = `
      <h3 style="margin:0 0 10px 0; color:#1b5e20;">${escapeHtml((s.sessionId ? s.sessionId + ' — ' : '') + (s.location || 'Session'))}</h3>
      <div class="muted" style="margin-bottom:12px;">${escapeHtml([s.date, s.district, s.village].filter(Boolean).join(' • '))}</div>

      <div class="kv" style="grid-template-columns:repeat(3,1fr);">
        <div><div class="k">Farmers</div><div class="v">${fmtInt(s.farmers)}</div></div>
        <div><div class="k">Acres</div><div class="v">${fmtInt(s.acres)}</div></div>
        <div><div class="k">Session Score</div><div class="v">${escapeHtml(s.__score !== null ? String(s.__score) : '—')}</div></div>
      </div>

      <div style="height:10px"></div>
      <div class="kv" style="grid-template-columns:repeat(3,1fr);">
        <div><div class="k">Awareness</div><div class="v">${fmtRate(s?.rates?.awareness)}</div></div>
        <div><div class="k">Used Last Year</div><div class="v">${fmtRate(s?.rates?.usedLastYear)}</div></div>
        <div><div class="k">Definite</div><div class="v">${fmtRate(s?.rates?.definite)}</div></div>
      </div>

      <div style="height:10px"></div>
      <div class="kv" style="grid-template-columns:repeat(2,1fr);">
        <div><div class="k">Facilitator</div><div class="v">${escapeHtml(s.facilitator || '—')}</div></div>
        <div><div class="k">Dealer</div><div class="v">${escapeHtml(s.dealerName || s.dealer || '—')}</div></div>
        <div><div class="k">Top reason to use</div><div class="v">${escapeHtml(s.topReasonUse || '—')}</div></div>
        <div><div class="k">Top reason not to use</div><div class="v">${escapeHtml(s.topReasonNotUse || '—')}</div></div>
      </div>

      <div style="height:14px"></div>
      <div class="muted"><strong>Coordinates:</strong> ${escapeHtml(s.coordinatesDMS || '—')} ${s.lat && s.lng ? `( ${s.lat}, ${s.lng} )` : ''}</div>
    `;

    const modal = $('#modal');
    modal?.classList.add('modal--open');
    modal?.setAttribute('aria-hidden', 'false');

    // If map exists, pan to marker
    if (state.map && s.lat && s.lng) {
      state.map.setView([s.lat, s.lng], Math.max(state.map.getZoom(), 9), { animate: true });
    }
  }

  function closeModal() {
    const modal = $('#modal');
    modal?.classList.remove('modal--open');
    modal?.setAttribute('aria-hidden', 'true');
  }

  // ---------- Rendering: Map ----------
  function initOrRefreshMap() {
    const mapEl = $('#map');
    if (!mapEl) return;

    // Leaflet might fail if CDN blocked
    if (typeof window.L === 'undefined') {
      mapEl.innerHTML = `<div class="skeleton">Map library failed to load. If you are on a restricted network/device, Leaflet CDN may be blocked.</div>`;
      return;
    }

    if (!state.map) {
      state.map = L.map('map', { zoomControl: true, scrollWheelZoom: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(state.map);

      state.cluster = L.markerClusterGroup({ maxClusterRadius: 44 });
      state.map.addLayer(state.cluster);

      // Default view
      state.map.setView([27.5, 69.0], 6);

      // iOS/Safari sizing fixes
      setTimeout(() => { try { state.map.invalidateSize(); } catch {} }, 300);
      window.addEventListener('resize', () => {
        setTimeout(() => { try { state.map.invalidateSize(); } catch {} }, 200);
      });
    }

    refreshMapMarkers();
  }

  function refreshMapMarkers() {
    if (!state.map || !state.cluster || typeof window.L === 'undefined') return;
    state.cluster.clearLayers();

    let count = 0;
    for (const s of state.filtered) {
      if (!s.lat || !s.lng) continue;
      const score = s.__score;
      const color = markerColor(score);

      const icon = L.divIcon({
        className: 'x-marker',
        html: `<div style="width:14px;height:14px;border-radius:999px;background:${color};border:2px solid rgba(255,255,255,.9);box-shadow:0 8px 18px rgba(0,0,0,.35)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const m = L.marker([s.lat, s.lng], { icon });
      const popup = `
        <div style="min-width:220px">
          <div style="font-weight:900;color:#1b5e20">${escapeHtml((s.sessionId ? s.sessionId + ' — ' : '') + (s.location || ''))}</div>
          <div style="color:#55635a;margin-top:4px">${escapeHtml([s.date, s.district].filter(Boolean).join(' • '))}</div>
          <div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <div><strong>Farmers:</strong> ${fmtInt(s.farmers)}</div>
            <div><strong>Acres:</strong> ${fmtInt(s.acres)}</div>
            <div><strong>Definite:</strong> ${fmtRate(s?.rates?.definite)}</div>
            <div><strong>Score:</strong> ${escapeHtml(score !== null ? String(score) : '—')}</div>
          </div>
        </div>
      `;
      m.bindPopup(popup);
      m.on('click', () => openSessionModal(s));
      state.cluster.addLayer(m);
      count++;
    }

    $('#mapPill').textContent = `Markers: ${fmtInt(count)}`;
  }

  // ---------- Rendering: Gallery ----------
  function renderGallery() {
    const root = $('#gallery');
    if (!root) return;
    if (!state.media) {
      root.innerHTML = `<div class="skeleton">No media loaded.</div>`;
      return;
    }

    const base = state.media.mediaBasePath || '';
    const items = (state.media.mediaItems || []).filter(it => {
      const cat = it.category || '';
      if (state.mediaFilter === 'all') return true;
      if (state.mediaFilter === 'brand') return cat === 'brand';
      if (state.mediaFilter === 'photo') return it.type === 'photo';
      if (state.mediaFilter === 'video') return it.type === 'video' || it.filename?.toLowerCase().endsWith('.mp4');
      return true;
    });

    const counts = {
      photos: (state.media.mediaItems || []).filter(i => i.type === 'photo').length,
      videos: (state.media.mediaItems || []).filter(i => i.type === 'video').length,
    };
    $('#mediaPill').textContent = `${fmtInt(counts.photos)} photos • ${fmtInt(counts.videos)} videos`;

    root.innerHTML = '';
    if (!items.length) {
      root.innerHTML = `<div class="skeleton">No media matches this filter.</div>`;
      return;
    }

    const placeholder = `${base}gallery/placeholder.svg`;

    for (const it of items) {
      const file = it.filename || '';
      const url = base + file;
      const isVideo = (it.type === 'video') || file.toLowerCase().endsWith('.mp4');
      const badge = it.category || it.type || 'media';
      const title = it.caption || file;

      const tile = document.createElement('div');
      tile.className = 'media';
      tile.innerHTML = `
        ${isVideo
          ? `<video class="media__thumb" src="${escapeHtml(url)}" preload="metadata" muted playsinline></video>`
          : `<img class="media__thumb" src="${escapeHtml(url)}" alt="${escapeHtml(title)}" loading="lazy" />`
        }
        <div class="media__meta">
          <div class="badge"><i class="fa-solid ${isVideo ? 'fa-video' : 'fa-image'}"></i> ${escapeHtml(badge)}</div>
          <p class="media__title">${escapeHtml(title)}</p>
          <p class="media__sub">${escapeHtml([it.district, it.date, it.sessionId].filter(Boolean).join(' • '))}</p>
        </div>
      `;

      // Fail-safe: if file missing, use placeholder
      const thumb = tile.querySelector('.media__thumb');
      if (thumb && !isVideo) {
        thumb.addEventListener('error', () => { thumb.src = placeholder; });
      }
      if (thumb && isVideo) {
        // If the video cannot load, swap to placeholder image
        thumb.addEventListener('error', () => {
          const img = document.createElement('img');
          img.className = 'media__thumb';
          img.src = placeholder;
          img.alt = 'Missing video';
          thumb.replaceWith(img);
        });
        // Try to show first frame on hover (desktop)
        tile.addEventListener('mouseenter', () => { try { thumb.play(); } catch {} });
        tile.addEventListener('mouseleave', () => { try { thumb.pause(); thumb.currentTime = 0; } catch {} });
      }

      tile.addEventListener('click', () => openMediaModal(it, url, isVideo, placeholder));
      root.appendChild(tile);
    }
  }

  function openMediaModal(it, url, isVideo, placeholder) {
    const el = $('#modalContent');
    if (!el) return;

    const title = it.caption || it.filename || 'Media';
    el.innerHTML = `
      <h3 style="margin:0 0 10px 0; color:#1b5e20;">${escapeHtml(title)}</h3>
      <div class="muted" style="margin-bottom:12px;">${escapeHtml([it.district, it.date, it.sessionId].filter(Boolean).join(' • '))}</div>
      <div style="border-radius:14px; overflow:hidden; border:1px solid rgba(0,0,0,.08); background:#fff;">
        ${isVideo
          ? `<video src="${escapeHtml(url)}" controls playsinline style="width:100%; max-height:70vh; background:#000"></video>`
          : `<img src="${escapeHtml(url)}" onerror="this.src='${escapeHtml(placeholder)}'" style="width:100%; max-height:70vh; object-fit:contain; background:#f2f5f3;" />`
        }
      </div>
    `;
    const modal = $('#modal');
    modal?.classList.add('modal--open');
    modal?.setAttribute('aria-hidden', 'false');
  }

  // ---------- Insights ----------
  function renderInsights() {
    const el = $('#insights');
    if (!el) return;
    if (!state.filtered.length) {
      el.innerHTML = `<div class="skeleton">No sessions in current filter.</div>`;
      return;
    }

    // Compute basics
    const byDistrict = new Map();
    for (const s of state.filtered) {
      const d = (s.district || 'Unknown').trim() || 'Unknown';
      if (!byDistrict.has(d)) byDistrict.set(d, { sessions: 0, farmers: 0, acres: 0, avgScoreSum: 0, avgScoreN: 0 });
      const agg = byDistrict.get(d);
      agg.sessions += 1;
      agg.farmers += Number(s.farmers || 0);
      agg.acres += Number(s.acres || 0);
      if (s.__score !== null && s.__score !== undefined) { agg.avgScoreSum += s.__score; agg.avgScoreN += 1; }
    }

    const districts = Array.from(byDistrict.entries()).map(([name, agg]) => ({
      name,
      ...agg,
      avgScore: agg.avgScoreN ? agg.avgScoreSum / agg.avgScoreN : null
    }));

    const topAcres = districts.slice().sort((a,b)=>b.acres-a.acres)[0];
    const topFarmers = districts.slice().sort((a,b)=>b.farmers-a.farmers)[0];
    const lowScore = districts.slice().filter(d=>d.avgScore!==null).sort((a,b)=>a.avgScore-b.avgScore)[0];

    const scores = state.filtered.map(s => s.__score).filter(v => v !== null && v !== undefined);
    const high = scores.filter(v => v >= 85).length;
    const mid = scores.filter(v => v >= 70 && v < 85).length;
    const low = scores.filter(v => v < 70).length;

    const msgLow = lowScore
      ? `Lowest avg score district: ${lowScore.name} (${lowScore.avgScore.toFixed(1)}). Consider refresher talk-track + on-spot objection handling.`
      : `No score data available to rank districts.`;

    el.innerHTML = `
      <div class="insight">
        <p class="insight__title">Coverage Leader</p>
        <p class="insight__body">${topAcres ? `Top district by acres: <strong>${escapeHtml(topAcres.name)}</strong> (${fmtInt(topAcres.acres)} acres across ${fmtInt(topAcres.sessions)} sessions).` : '—'}</p>
      </div>
      <div class="insight">
        <p class="insight__title">Engagement Leader</p>
        <p class="insight__body">${topFarmers ? `Top district by farmers: <strong>${escapeHtml(topFarmers.name)}</strong> (${fmtInt(topFarmers.farmers)} farmers).` : '—'}</p>
      </div>
      <div class="insight">
        <p class="insight__title">Quality Watch</p>
        <p class="insight__body">${msgLow}</p>
      </div>
      <div class="insight">
        <p class="insight__title">Score Distribution</p>
        <p class="insight__body">
          High (≥85): <strong>${fmtInt(high)}</strong> •
          Medium (70–84): <strong>${fmtInt(mid)}</strong> •
          Low (&lt;70): <strong>${fmtInt(low)}</strong>
        </p>
      </div>
      <div class="insight">
        <p class="insight__title">Data Integrity</p>
        <p class="insight__body">
          KPIs are computed from session rows only; summary-row values are ignored to prevent segment mismatch.
        </p>
      </div>
      <div class="insight">
        <p class="insight__title">Next Action</p>
        <p class="insight__body">
          Prioritize districts with low score + high acres for fastest ROI on follow-up activations.
        </p>
      </div>
    `;
  }

  // ---------- CSV Export ----------
  function buildCsv(sessions) {
    const cols = [
      'sn','sessionId','date','district','location','farmers','wheatFarmers','acres',
      'awareness','usedLastYear','definite','maybe','notInterested','understandingAvg','sessionScore',
      'facilitator','host','dealerName','dealerContact','coordinatesDMS','lat','lng','topReasonUse','topReasonNotUse'
    ];
    const lines = [];
    lines.push(cols.join(','));
    for (const s of sessions) {
      const row = [
        s.sn, s.sessionId, s.date, s.district, s.location,
        s.farmers, s.wheatFarmers, s.acres,
        s?.rates?.awareness, s?.rates?.usedLastYear, s?.rates?.definite, s?.rates?.maybe, s?.rates?.notInterested,
        s.understandingAvg, s.sessionScore,
        s.facilitator, s.host, s.dealerName, s.dealerContact,
        s.coordinatesDMS, s.lat, s.lng, s.topReasonUse, s.topReasonNotUse
      ].map(v => csvCell(v));
      lines.push(row.join(','));
    }
    return lines.join('\n');
  }

  function csvCell(v) {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/\r?\n/g, ' ').trim();
    if (/[",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  // ---------- Background video on iOS ----------
  function tryPlayBackgroundVideo() {
    const v = $('#bgVideo');
    if (!v) return;

    const attempt = () => v.play().catch(() => {
      // iOS often blocks autoplay; hide video but keep overlay
      document.body.classList.add('bg--noVideo');
      v.style.display = 'none';
    });

    // Try shortly after load
    setTimeout(attempt, 400);

    // Try again on first user interaction
    const once = () => {
      attempt();
      window.removeEventListener('touchstart', once);
      window.removeEventListener('click', once);
    };
    window.addEventListener('touchstart', once, { passive: true });
    window.addEventListener('click', once);
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  // ---------- Start ----------
  document.addEventListener('DOMContentLoaded', boot);
})();
