/* INTERACT Field Intelligence Dashboard
   - Multi-campaign framework: /data/campaigns.json + /data/<id>/{sessions,media}.json
   - Totals computed from session rows (sum_sheet.csv summary row is excluded at source)
*/
(() => {
  'use strict';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const state = {
    campaigns: [],
    campaign: null,
    sessions: [],
    media: null,
    filtered: [],
    view: 'exec',
    mediaFilter: 'all',
    page: 1,
    perPage: 10,
    map: null,
    markers: null,
    markerBySessionId: new Map(),
  };

  function fmtInt(n){ return new Intl.NumberFormat().format(Number(n||0)); }
  function clamp(x,min,max){ return Math.max(min, Math.min(max, x)); }
  function safeStr(v){ return (v===undefined || v===null) ? '' : String(v).trim(); }

  function parseQuery() {
    const u = new URL(window.location.href);
    return Object.fromEntries(u.searchParams.entries());
  }

  function buildShareLink() {
    const q = parseQuery();
    const u = new URL(window.location.href);
    u.searchParams.set('campaign', state.campaign?.id || q.campaign || '');
    return u.toString();
  }

  async function fetchJson(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
    return res.json();
  }

  // Session score formula (0–100)
  // 35% Definite Use + 25% Awareness + 15% Used Last Year + 25% Understanding
  function sessionScore(s) {
    const definite = Number(s?.rates?.definiteUse ?? 0);
    const aware = Number(s?.rates?.awareness ?? 0);
    const last = Number(s?.rates?.usedLastYear ?? 0);
    const understandingRaw = Number(s?.understanding?.averageScore ?? 0); // 0–3
    const understanding = clamp((understandingRaw / 3) * 100, 0, 100);

    const score = (0.35 * definite) + (0.25 * aware) + (0.15 * last) + (0.25 * understanding);
    return clamp(Math.round(score), 0, 100);
  }

  function scoreClass(score){
    if (score >= 80) return 'good';
    if (score >= 65) return 'mid';
    return 'low';
  }

  function scorePill(score){
    const cls = scoreClass(score);
    const label = cls === 'good' ? 'High' : cls === 'mid' ? 'Medium' : 'Low';
    return `<span class="score-pill score-${cls}"><i class="fa-solid fa-gauge-high"></i>${score} • ${label}</span>`;
  }

  function setHero(campaignMeta, sessions) {
    $('#campaignTitle').textContent = campaignMeta.campaign || campaignMeta.name || 'Campaign';
    const start = campaignMeta.startDate || '';
    const end = campaignMeta.endDate || '';
    const range = (start && end) ? `${start} → ${end}` : '';
    $('#campaignMeta').textContent = `${state.campaign?.name || campaignMeta.campaign || 'Campaign'}${range ? ' • ' + range : ''}`;

    const totalSessions = sessions.length;
    const totalFarmers = sessions.reduce((a,s)=>a+(Number(s.farmers)||0),0);
    const totalAcres = sessions.reduce((a,s)=>a+(Number(s.acres)||0),0);
    const districts = new Set(sessions.map(s => safeStr(s.district)).filter(Boolean)).size;

    $('#kpiSessions').textContent = fmtInt(totalSessions);
    $('#kpiFarmers').textContent = fmtInt(totalFarmers);
    $('#kpiAcres').textContent = fmtInt(totalAcres);
    $('#kpiDistricts').textContent = fmtInt(districts);
  }

  function setFilters(campaignMeta, sessions) {
    // Districts
    const sel = $('#districtFilter');
    const districts = Array.from(new Set(sessions.map(s => safeStr(s.district)).filter(Boolean))).sort();
    sel.innerHTML = `<option value="all">All Districts (${districts.length})</option>` +
      districts.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');

    // Dates
    const dates = sessions.map(s => s.date).filter(Boolean).sort();
    const min = dates[0] || campaignMeta.startDate || '';
    const max = dates[dates.length-1] || campaignMeta.endDate || '';
    $('#dateFrom').value = min;
    $('#dateTo').value = max;
  }

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  }

  function applyFilters() {
    const district = $('#districtFilter').value;
    const q = safeStr($('#searchInput').value).toLowerCase();
    const from = $('#dateFrom').value;
    const to = $('#dateTo').value;

    let out = state.sessions.slice();

    if (district && district !== 'all') {
      out = out.filter(s => safeStr(s.district) === district);
    }

    if (from) out = out.filter(s => (s.date || '') >= from);
    if (to) out = out.filter(s => (s.date || '') <= to);

    if (q) {
      out = out.filter(s => {
        const hay = [
          s.sessionId, s.district, s.location, s.village, s.facilitator, s.dealer, s.dealerName
        ].map(safeStr).join(' ').toLowerCase();
        return hay.includes(q);
      });
    }

    // Sort by date then session id
    out.sort((a,b) => (a.date||'').localeCompare(b.date||'') || safeStr(a.sessionId).localeCompare(safeStr(b.sessionId)));

    // compute score once
    out = out.map(s => ({...s, _score: sessionScore(s)}));

    state.filtered = out;
    state.page = 1;

    renderInsights();
    renderTable();
    renderMapMarkers();
  }

  function resetFilters() {
    $('#districtFilter').value = 'all';
    $('#searchInput').value = '';
    // reset dates based on campaign
    setFilters(state.campaignMeta, state.sessions);
    applyFilters();
  }

  function renderInsights() {
    const list = $('#insightsList');
    const ss = state.filtered.length ? state.filtered : state.sessions.map(s => ({...s, _score: sessionScore(s)}));

    if (!ss.length) {
      list.innerHTML = `<div class="insight"><div class="t">No data</div><div class="d">No sessions match the filters.</div></div>`;
      return;
    }

    // Top acres district
    const byDist = new Map();
    ss.forEach(s => {
      const d = safeStr(s.district) || 'Unknown';
      byDist.set(d, (byDist.get(d)||0) + (Number(s.acres)||0));
    });
    const topDist = Array.from(byDist.entries()).sort((a,b)=>b[1]-a[1])[0];

    // Lowest awareness district (avg)
    const aw = new Map();
    ss.forEach(s => {
      const d = safeStr(s.district) || 'Unknown';
      const v = Number(s?.rates?.awareness ?? 0);
      if (!aw.has(d)) aw.set(d, []);
      aw.get(d).push(v);
    });
    const awAvg = Array.from(aw.entries()).map(([d,arr]) => [d, arr.reduce((a,x)=>a+x,0)/Math.max(1,arr.length)]);
    const lowAw = awAvg.sort((a,b)=>a[1]-b[1])[0];

    // Top reason to use
    const reasonCounts = new Map();
    ss.forEach(s=>{
      const r = safeStr(s?.reasons?.topUse);
      if (r) reasonCounts.set(r, (reasonCounts.get(r)||0) + 1);
    });
    const topReason = Array.from(reasonCounts.entries()).sort((a,b)=>b[1]-a[1])[0];

    // Score distribution
    const dist = { good:0, mid:0, low:0 };
    ss.forEach(s => { dist[scoreClass(s._score)]++; });

    list.innerHTML = [
      topDist ? insight(`Top coverage district: ${topDist[0]}`, `${fmtInt(topDist[1])} acres covered in the selected dataset.`) : '',
      lowAw ? insight(`Attention needed: ${lowAw[0]}`, `Lowest average awareness at ${Math.round(lowAw[1])}%. Consider re-activation + dealer touchpoints.`) : '',
      topReason ? insight(`Top adoption driver`, `${topReason[0]} • Appears in ${topReason[1]} sessions.`) : '',
      insight(`Session score distribution`, `High: ${dist.good} • Medium: ${dist.mid} • Low: ${dist.low}`),
    ].filter(Boolean).join('');
  }

  function insight(title, desc){
    return `<div class="insight"><div class="t">${escapeHtml(title)}</div><div class="d">${escapeHtml(desc)}</div></div>`;
  }

  function renderTableHead() {
    const thead = $('#sessionsThead');
    const colsExec = [
      ['SN', 'id'],
      ['Date', 'date'],
      ['District', 'district'],
      ['Location', 'location'],
      ['Farmers', 'farmers'],
      ['Acres', 'acres'],
      ['Awareness', 'rates.awareness'],
      ['Definite', 'rates.definiteUse'],
      ['Score', '_score'],
    ];
    const colsField = [
      ['Session', 'sessionId'],
      ['Date', 'date'],
      ['District', 'district'],
      ['Village', 'village'],
      ['Facilitator', 'facilitator'],
      ['Dealer', 'dealerName'],
      ['Contact', 'dealerContact'],
      ['Score', '_score'],
    ];
    const cols = state.view === 'exec' ? colsExec : colsField;

    thead.innerHTML = `<tr>${cols.map(c => `<th>${escapeHtml(c[0])}</th>`).join('')}</tr>`;
    state._tableCols = cols;
  }

  function renderTable() {
    renderTableHead();
    const tbody = $('#sessionsTbody');
    const rows = state.filtered;
    const totalPages = Math.max(1, Math.ceil(rows.length / state.perPage));
    state.page = clamp(state.page, 1, totalPages);

    const start = (state.page - 1) * state.perPage;
    const pageRows = rows.slice(start, start + state.perPage);

    tbody.innerHTML = pageRows.map(s => {
      const cols = state._tableCols;
      const tds = cols.map(([label, key]) => {
        if (key === '_score') return `<td>${scorePill(s._score)}</td>`;
        if (key.startsWith('rates.')) {
          const k = key.split('.')[1];
          const v = Number(s?.rates?.[k] ?? 0);
          return `<td>${Math.round(v)}%</td>`;
        }
        const v = key.split('.').reduce((acc,part)=>acc && acc[part], s);
        if (key === 'farmers' || key === 'acres') return `<td>${fmtInt(v)}</td>`;
        return `<td>${escapeHtml(safeStr(v) || '—')}</td>`;
      }).join('');

      return `<tr data-session="${escapeHtml(s.sessionId||String(s.id))}">${tds}</tr>`;
    }).join('');

    $('#pageNow').textContent = String(state.page);
    $('#pageTotal').textContent = String(totalPages);
    $('#prevPage').disabled = state.page <= 1;
    $('#nextPage').disabled = state.page >= totalPages;

    // Row click opens modal
    $$('#sessionsTbody tr').forEach(tr => {
      tr.addEventListener('click', () => {
        const sid = tr.getAttribute('data-session');
        const s = state.filtered.find(x => (x.sessionId||String(x.id)) === sid);
        if (s) openSessionModal(s);
      });
    });
  }

  function openSessionModal(s) {
    const m = $('#modal');
    const body = $('#modalBody');

    const mediaForSession = getMediaForSession(s.sessionId);
    const primary = mediaForSession.find(x => x.type === 'video') || mediaForSession.find(x => x.type === 'photo') || null;

    const mediaHtml = primary ? renderMedia(primary) : `
      <div class="media-view">
        <img src="${state.media?.mediaBasePath || 'assets/'}placeholder.svg" alt="Media pending" />
      </div>
      <div class="muted" style="margin-top:8px;">Media pending for this session.</div>
    `;

    const metaCards = [
      ['Session', s.sessionId || s.id],
      ['Date', s.date || s.dateLabel],
      ['District', s.district],
      ['Location', s.location],
      ['Farmers', fmtInt(s.farmers)],
      ['Acres', fmtInt(s.acres)],
      ['Awareness', `${Math.round(Number(s?.rates?.awareness||0))}%`],
      ['Definite Use', `${Math.round(Number(s?.rates?.definiteUse||0))}%`],
      ['Used Last Year', `${Math.round(Number(s?.rates?.usedLastYear||0))}%`],
      ['Understanding', `${Math.round((Number(s?.understanding?.averageScore||0))*100)/100} / 3`],
      ['Top Reason', s?.reasons?.topUse || '—'],
      ['Competitors', s?.reasons?.competitors || '—'],
      ['Dealer', s.dealerName || s.dealer || '—'],
      ['Dealer Contact', s.dealerContact || '—'],
      ['Facilitator', s.facilitator || '—'],
      ['Facilitator Contact', s.facilitatorContact || '—'],
    ].map(([k,v]) => `<div class="meta-card"><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(safeStr(v) || '—')}</div></div>`).join('');

    const thumbs = mediaForSession.slice(0,12).map(item => `
      <div class="media-card" data-media-id="${item.id}">
        ${thumbFor(item)}
        <div class="media-body">
          <div class="media-badge"><i class="fa-solid ${item.type==='video'?'fa-video':'fa-image'}"></i>${escapeHtml(item.type.toUpperCase())}</div>
          <div class="media-title">${escapeHtml(item.caption || '')}</div>
          <div class="media-meta">${escapeHtml(item.date || '')} • ${escapeHtml(item.district || '')}</div>
        </div>
      </div>
    `).join('');

    body.innerHTML = `
      <div class="modal">
        <h3>${escapeHtml(s.sessionId || 'Session')} • ${escapeHtml(s.location || '')}</h3>
        <p>${scorePill(s._score)} &nbsp; <span class="mono">${escapeHtml(s.coordinatesRaw || '')}</span></p>

        <div class="modal-grid">
          <div>
            ${mediaHtml}
            ${mediaForSession.length ? `<div style="margin-top:12px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px;">${thumbs}</div>` : ''}
          </div>
          <div>
            <div class="meta-cards">${metaCards}</div>
          </div>
        </div>
      </div>
    `;

    // thumb click
    $$('.media-card', body).forEach(card => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = Number(card.getAttribute('data-media-id'));
        const item = state._mediaIndex.get(id);
        if (item) openMediaModal(item, s);
      });
    });

    m.setAttribute('aria-hidden', 'false');

    // map focus if marker exists
    const marker = state.markerBySessionId.get(s.sessionId);
    if (marker && state.map) {
      try { state.map.setView(marker.getLatLng(), 9, { animate: true }); marker.openPopup(); } catch(_) {}
    }
  }

  function openMediaModal(item, session) {
    const m = $('#modal');
    const body = $('#modalBody');

    body.innerHTML = `
      <h3>${escapeHtml(item.caption || 'Media')}</h3>
      <p class="muted">${escapeHtml(item.date || '')} • ${escapeHtml(item.district || '')} • ${escapeHtml(item.sessionId || '')}</p>
      <div class="media-view">
        ${renderMedia(item, true)}
      </div>
      ${session ? `<p class="muted" style="margin-top:10px;">Related Session: <b>${escapeHtml(session.sessionId || '')}</b> — ${escapeHtml(session.location || '')}</p>` : ''}
    `;

    m.setAttribute('aria-hidden', 'false');
  }

  function renderMedia(item, autoplay=false) {
    const base = state.media?.mediaBasePath || 'assets/';
    const src = base + item.filename;
    if (item.type === 'video') {
      return `<video controls ${autoplay?'autoplay':''} playsinline preload="metadata" src="${escapeHtml(src)}"></video>`;
    }
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(item.caption || 'Image')}" loading="lazy" />`;
  }

  function thumbFor(item) {
    const base = state.media?.mediaBasePath || 'assets/';
    const src = base + item.filename;
    const isVideo = item.type === 'video';
    if (isVideo) {
      return `<video class="media-thumb" muted playsinline preload="metadata" src="${escapeHtml(src)}"></video>`;
    }
    return `<img class="media-thumb" src="${escapeHtml(src)}" alt="${escapeHtml(item.caption || 'Image')}" loading="lazy" onerror="this.onerror=null;this.src='${base}placeholder.svg';" />`;
  }

  function getMediaItems() {
    const items = Array.isArray(state.media?.mediaItems) ? state.media.mediaItems : [];
    return items;
  }

  function indexMedia() {
    state._mediaIndex = new Map();
    getMediaItems().forEach(it => state._mediaIndex.set(Number(it.id), it));
  }

  function getMediaForSession(sessionId) {
    const sid = safeStr(sessionId);
    if (!sid) return [];
    return getMediaItems().filter(it => safeStr(it.sessionId) === sid);
  }

  function renderGallery() {
    const el = $('#gallery');
    const items = getMediaItems();
    const mf = state.mediaFilter;

    const filtered = items.filter(it => {
      if (mf === 'all') return true;
      if (mf === 'photo') return it.type === 'photo';
      if (mf === 'video') return it.type === 'video';
      if (mf === 'brand') return it.category === 'brand';
      return true;
    });

    const imgCount = items.filter(x => x.type === 'photo').length;
    const vidCount = items.filter(x => x.type === 'video').length;

    $('#imgCount').textContent = fmtInt(imgCount);
    $('#vidCount').textContent = fmtInt(vidCount);
    $('#allCount').textContent = fmtInt(items.length);

    if (!filtered.length) {
      el.innerHTML = `<div class="skeleton">No media matches this filter.</div>`;
      return;
    }

    el.innerHTML = filtered.map(item => {
      const pending = item.filename === 'placeholder.svg';
      const badge = item.type === 'video' ? 'fa-video' : item.type === 'photo' ? 'fa-image' : 'fa-circle-info';
      const date = item.date || '';
      const dist = item.district || '';
      const sid = item.sessionId || '';
      const meta = [date, dist, sid].filter(Boolean).join(' • ');

      return `
        <div class="media-card" data-media-id="${item.id}">
          ${thumbFor(item)}
          <div class="media-body">
            <div class="media-badge"><i class="fa-solid ${badge}"></i>${escapeHtml((item.type || 'media').toUpperCase())}${pending ? ' • <span class="pending">PENDING</span>' : ''}</div>
            <div class="media-title">${escapeHtml(item.caption || '')}</div>
            <div class="media-meta">${escapeHtml(meta)}</div>
          </div>
        </div>
      `;
    }).join('');

    // click
    $$('.media-card', el).forEach(card => {
      card.addEventListener('click', () => {
        const id = Number(card.getAttribute('data-media-id'));
        const item = state._mediaIndex.get(id);
        if (!item) return;

        const sess = item.sessionId ? state.sessions.find(s => safeStr(s.sessionId) === safeStr(item.sessionId)) : null;
        openMediaModal(item, sess);
      });
    });
  }

  function initMap() {
    if (state.map) return;

    state.map = L.map('map', { scrollWheelZoom: false });
    // OSM tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(state.map);

    state.markers = L.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 45,
    });

    state.map.addLayer(state.markers);
  }

  function renderMapMarkers() {
    if (!state.map) initMap();
    state.markers.clearLayers();
    state.markerBySessionId.clear();

    const rows = state.filtered.length ? state.filtered : state.sessions.map(s => ({...s, _score: sessionScore(s)}));
    const points = rows.filter(s => Number.isFinite(s.latitude) && Number.isFinite(s.longitude));

    if (!points.length) {
      state.map.setView([30.3753, 69.3451], 5); // Pakistan
      return;
    }

    points.forEach(s => {
      const cls = scoreClass(s._score);
      const icon = L.divIcon({
        className: '',
        html: `<div class="marker ${cls}" title="${escapeHtml(s.sessionId || '')}"></div>`,
        iconSize: [16,16],
        iconAnchor: [8,8]
      });

      const popup = `
        <div style="font-weight:900; margin-bottom:6px;">${escapeHtml(s.sessionId || 'Session')} • ${escapeHtml(s.district || '')}</div>
        <div style="color:#5b6560; font-size:12px;">${escapeHtml(s.location || '')}</div>
        <div style="margin-top:8px; font-size:12px;">
          Farmers: <b>${fmtInt(s.farmers)}</b> • Acres: <b>${fmtInt(s.acres)}</b><br/>
          Awareness: <b>${Math.round(Number(s?.rates?.awareness||0))}%</b> • Definite: <b>${Math.round(Number(s?.rates?.definiteUse||0))}%</b><br/>
          Score: <b>${s._score}</b>
        </div>
        <div style="margin-top:10px;">
          <button data-open="${escapeHtml(s.sessionId||String(s.id))}" style="border:none; padding:8px 10px; border-radius:999px; background:#2e7d32; color:#fff; font-weight:900; cursor:pointer;">Open</button>
        </div>
      `;

      const marker = L.marker([s.latitude, s.longitude], { icon }).bindPopup(popup);
      marker.on('popupopen', (e) => {
        const btn = e.popup.getElement()?.querySelector('[data-open]');
        if (btn) {
          btn.addEventListener('click', () => openSessionModal(s));
        }
      });

      state.markers.addLayer(marker);
      if (s.sessionId) state.markerBySessionId.set(s.sessionId, marker);
    });

    // Fit map
    const latlngs = points.map(s => [s.latitude, s.longitude]);
    const bounds = L.latLngBounds(latlngs);
    state.map.fitBounds(bounds.pad(0.2));
  }

  function exportCsv() {
    const rows = state.filtered.length ? state.filtered : state.sessions.map(s => ({...s, _score: sessionScore(s)}));
    const headers = [
      'SessionId','Date','District','Location','Farmers','Acres','AwarenessRate','UsedLastYearRate','DefiniteUseRate','UnderstandingAvg','SessionScore','TopReasonUse','TopReasonNotUse'
    ];
    const lines = [headers.join(',')];

    rows.forEach(s => {
      const vals = [
        s.sessionId, s.date, s.district, s.location,
        s.farmers, s.acres,
        s?.rates?.awareness, s?.rates?.usedLastYear, s?.rates?.definiteUse,
        s?.understanding?.averageScore,
        sessionScore(s),
        safeStr(s?.reasons?.topUse).replace(/,/g,';'),
        safeStr(s?.reasons?.topNotUse).replace(/,/g,';'),
      ].map(v => `"${String(v ?? '').replace(/"/g,'""')}"`);
      lines.push(vals.join(','));
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${state.campaign?.id || 'campaign'}_export.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function handleModal() {
    const m = $('#modal');
    m.addEventListener('click', (e) => {
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute('data-close') === '1') closeModal();
      if (t && t.closest && t.closest('[data-close="1"]')) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  function closeModal(){
    const m = $('#modal');
    m.setAttribute('aria-hidden', 'true');
    $('#modalBody').innerHTML = '';
  }

  function wireUI() {
    $('#applyFilters').addEventListener('click', applyFilters);
    $('#resetFilters').addEventListener('click', resetFilters);
    $('#exportCsv').addEventListener('click', exportCsv);

    $('#prevPage').addEventListener('click', () => { state.page--; renderTable(); });
    $('#nextPage').addEventListener('click', () => { state.page++; renderTable(); });

    $$('.view-toggle .chip').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.view-toggle .chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.view = btn.getAttribute('data-view');
        renderTable();
      });
    });

    $$('.gallery-filters .chip').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.gallery-filters .chip').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.mediaFilter = btn.getAttribute('data-media');
        renderGallery();
      });
    });

    $('#campaignSelect').addEventListener('change', () => {
      const id = $('#campaignSelect').value;
      const c = state.campaigns.find(x => x.id === id);
      if (c) {
        const u = new URL(window.location.href);
        u.searchParams.set('campaign', c.id);
        window.location.href = u.toString();
      }
    });

    $('#shareLink').addEventListener('click', async (e) => {
      e.preventDefault();
      const link = buildShareLink();
      try {
        await navigator.clipboard.writeText(link);
        $('#shareLink').innerHTML = `<i class="fa-solid fa-check"></i><span>Copied</span>`;
        setTimeout(() => $('#shareLink').innerHTML = `<i class="fa-solid fa-link"></i><span>Share</span>`, 1200);
      } catch {
        window.prompt('Copy link:', link);
      }
    });

    handleModal();
  }

  function iOSVideoFallback() {
    // iOS safari sometimes struggles with autoplay video backgrounds.
    // If video cannot play, hide it gracefully.
    const v = $('#bgVideo');
    if (!v) return;
    const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const tryPlay = v.play?.bind(v);
    if (!tryPlay) return;

    tryPlay().catch(() => {
      v.style.display = 'none';
    });
  }

  async function boot() {
    $('#year').textContent = String(new Date().getFullYear());

    const cfg = await fetchJson('data/campaigns.json');
    state.campaigns = Array.isArray(cfg.campaigns) ? cfg.campaigns : [];

    // campaign selection
    const q = parseQuery();
    const chosenId = q.campaign || state.campaigns[0]?.id;
    state.campaign = state.campaigns.find(c => c.id === chosenId) || state.campaigns[0];

    const sel = $('#campaignSelect');
    sel.innerHTML = state.campaigns.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
    sel.value = state.campaign?.id || '';

    const base = state.campaign.dataPath.replace(/\/$/,'');
    const sessionsPayload = await fetchJson(`${base}/sessions.json`);
    const mediaPayload = await fetchJson(`${base}/media.json`);

    state.campaignMeta = {
      ...state.campaign,
      campaign: sessionsPayload.campaign,
      description: sessionsPayload.description,
    };

    // sessions + enforce computed totals
    state.sessions = Array.isArray(sessionsPayload.sessions) ? sessionsPayload.sessions : [];
    state.sessions = state.sessions.map(s => ({...s, _score: sessionScore(s)}));

    state.media = mediaPayload;
    indexMedia();

    setHero(state.campaignMeta, state.sessions);
    setFilters(state.campaignMeta, state.sessions);

    initMap();
    applyFilters();
    renderGallery();
    wireUI();
    iOSVideoFallback();
  }

  boot().catch(err => {
    console.error(err);
    $('#campaignTitle').textContent = 'Failed to load dashboard';
    $('#campaignMeta').textContent = err?.message || 'Unknown error';
  });
})();
