/* INTERACT Multi-Campaign Field Intelligence (v2)
   - Data integrity: totals computed from session rows (summary row excluded upstream)
   - Session Score: 35% Definite + 25% Awareness + 15% UsedLastYear + 25% Understanding
   - Mobile-first + iPhone safe-area support
*/

(() => {
  'use strict';

  const CONFIG = {
    campaignsPath: 'data/campaigns.json',
    storageKeyCampaign: 'interact_campaign_id',
    // session score weights
    scoreWeights: { definite: 0.35, awareness: 0.25, usedLastYear: 0.15, understanding: 0.25 },
    scoreThresholds: { good: 85, mid: 70 },
    // placeholder fallbacks (repo reality may vary)
    placeholderCandidates: ['assets/gallery/placeholder.svg', 'assets/placeholder.svg', 'assets/gallery/placeholder.png'],
    maxInsightDistricts: 5,
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const state = {
    campaigns: null,
    campaign: null,
    sessions: [],
    media: null,
    filtered: [],
    viewMode: 'exec',
    charts: { score: null, districtAcres: null },
    map: null,
    cluster: null,
    markerBySessionId: new Map(),
  };

  /* ------------------------------
     Utilities
  ------------------------------ */
  function safeNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function fmtInt(n) {
    const x = Math.round(Number(n) || 0);
    return x.toLocaleString('en-US');
  }
  function fmtPct(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '–';
    return `${Math.round(x)}%`;
  }
  function fmtDate(iso) {
    if (!iso) return '–';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  }
  function escapeHtml(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
  function getParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  }
  function setParam(name, value) {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set(name, value);
    else url.searchParams.delete(name);
    history.replaceState({}, '', url.toString());
  }

  async function fetchJson(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
    return await res.json();
  }

  async function firstReachable(paths) {
    for (const p of paths) {
      try {
        const res = await fetch(p, { method: 'HEAD', cache: 'no-store' });
        if (res.ok) return p;
      } catch { /* ignore */ }
    }
    return paths[0];
  }

  /* ------------------------------
     Scoring
  ------------------------------ */
  function computeSessionScore(s) {
    const p = s.performance || {};
    const u = s.understandingScores || {};
    const w = CONFIG.scoreWeights;

    const definite = safeNum(p.definiteUseRate);
    const awareness = safeNum(p.awarenessRate);
    const used = safeNum(p.usedLastYearRate);

    // averageUnderstandingScore is 0..3; normalize to 0..100
    const avgU = safeNum(p.avgUnderstandingScore);
    const understanding = avgU == null ? null : Math.max(0, Math.min(100, (avgU / 3) * 100));

    // If avg isn't present, compute from detailed understanding scores if available.
    const computedU = (() => {
      if (understanding != null) return understanding;
      const parts = ['yieldLoss', 'goldenPeriod', 'buctrilBroadleaf', 'buctrilAtlantis', 'safetyPPE']
        .map(k => safeNum(u[k]))
        .filter(v => v != null);
      if (!parts.length) return null;
      const avg = parts.reduce((a, b) => a + b, 0) / parts.length;
      return Math.max(0, Math.min(100, (avg / 3) * 100));
    })();

    const components = [
      { v: definite, w: w.definite },
      { v: awareness, w: w.awareness },
      { v: used, w: w.usedLastYear },
      { v: computedU, w: w.understanding },
    ].filter(x => x.v != null);

    if (!components.length) return null;

    // re-normalize weights if some components missing
    const wSum = components.reduce((a, b) => a + b.w, 0) || 1;
    const score = components.reduce((a, b) => a + (b.v * (b.w / wSum)), 0);

    return Math.round(score);
  }

  function scoreBand(score) {
    if (score == null) return { label: '–', pillClass: 'pill--neutral' };
    if (score >= CONFIG.scoreThresholds.good) return { label: 'High', pillClass: 'pill--good' };
    if (score >= CONFIG.scoreThresholds.mid) return { label: 'Medium', pillClass: 'pill--mid' };
    return { label: 'Low', pillClass: 'pill--low' };
  }

  function markerColor(score) {
    if (score == null) return '#94a3b8';
    if (score >= CONFIG.scoreThresholds.good) return '#16a34a';
    if (score >= CONFIG.scoreThresholds.mid) return '#f59e0b';
    return '#ef4444';
  }

  function circleIcon(color) {
    return L.divIcon({
      className: 'interact-marker',
      html: `<div style="width:14px;height:14px;border-radius:999px;background:${color};border:2px solid rgba(255,255,255,.85);box-shadow:0 8px 18px rgba(0,0,0,.25)"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  }

  /* ------------------------------
     Filtering
  ------------------------------ */
  function applyFilters() {
    const district = $('#districtFilter').value;
    const from = $('#dateFrom').value ? new Date($('#dateFrom').value + 'T00:00:00') : null;
    const to = $('#dateTo').value ? new Date($('#dateTo').value + 'T23:59:59') : null;
    const q = ($('#search').value || '').trim().toLowerCase();

    state.filtered = state.sessions.filter(s => {
      if (district !== 'all' && (s.district || '') !== district) return false;
      if (from && s.dateObj < from) return false;
      if (to && s.dateObj > to) return false;
      if (q) {
        const hay = [
          s.sessionId, s.district, s.location, s.facilitator, s.dealer, s.host, s.coordinates
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    updateAll();
  }

  function resetFilters() {
    $('#districtFilter').value = 'all';
    $('#search').value = '';
    if (state.campaign) {
      $('#dateFrom').value = state.campaign.dateFrom || '';
      $('#dateTo').value = state.campaign.dateTo || '';
    }
    applyFilters();
  }

  /* ------------------------------
     Rendering: KPIs + Health
  ------------------------------ */
  function computeTotals(list) {
    const sum = (key) => list.reduce((a, s) => a + (Number(s.performance?.[key]) || 0), 0);
    return {
      sessions: list.length,
      farmers: Math.round(sum('farmers')),
      acres: Math.round(sum('acres')),
      wheatFarmers: Math.round(sum('wheatFarmers')),
      estBuctrilAcres: Math.round(sum('estimatedBuctrilAcres')),
      influencers: Math.round(sum('keyInfluencers')),
    };
  }

  function renderKPIs() {
    const t = computeTotals(state.filtered);
    $('#kpiSessions').textContent = fmtInt(t.sessions);
    $('#kpiFarmers').textContent = fmtInt(t.farmers);
    $('#kpiAcres').textContent = fmtInt(t.acres);
    $('#kpiInfluencers').textContent = fmtInt(t.influencers);

    const meta = `${fmtDate($('#dateFrom').value)} → ${fmtDate($('#dateTo').value)} • ${fmtInt(t.sessions)} sessions selected`;
    $('#campaignMeta').textContent = meta;
  }

  function renderDataHealth(declaredTotals) {
    const computed = computeTotals(state.sessions);
    const ok =
      declaredTotals &&
      computed.sessions === (declaredTotals.totalSessions ?? declaredTotals.sessions) &&
      computed.farmers === (declaredTotals.totalFarmers ?? declaredTotals.farmers) &&
      computed.acres === (declaredTotals.totalAcres ?? declaredTotals.acres);

    const el = $('#dataHealth');
    el.hidden = false;

    if (ok) {
      el.className = 'notice notice--ok';
      $('#dataHealthText').textContent =
        `Totals match source sheets: ${fmtInt(computed.sessions)} sessions, ${fmtInt(computed.farmers)} farmers, ${fmtInt(computed.acres)} acres. Summary row is excluded by design.`;
    } else {
      el.className = 'notice notice--warn';
      $('#dataHealthText').textContent =
        `Totals computed from session rows: ${fmtInt(computed.sessions)} sessions, ${fmtInt(computed.farmers)} farmers, ${fmtInt(computed.acres)} acres. Source totals differ — check sheet summary row and CSV header row.`;
    }
  }

  /* ------------------------------
     Insights + Charts
  ------------------------------ */
  function renderInsights() {
    const list = state.filtered;
    const totals = computeTotals(list);

    const avg = (key) => {
      const vals = list.map(s => safeNum(s.performance?.[key])).filter(v => v != null);
      if (!vals.length) return null;
      return vals.reduce((a,b)=>a+b,0)/vals.length;
    };

    const avgAwareness = avg('awarenessRate');
    const avgDefinite = avg('definiteUseRate');
    const avgUsed = avg('usedLastYearRate');

    // top districts by acres
    const byDistrict = new Map();
    for (const s of list) {
      const d = s.district || 'Unknown';
      const acres = Number(s.performance?.acres) || 0;
      const farmers = Number(s.performance?.farmers) || 0;
      const cur = byDistrict.get(d) || { acres:0, farmers:0, sessions:0 };
      cur.acres += acres; cur.farmers += farmers; cur.sessions += 1;
      byDistrict.set(d, cur);
    }
    const topDistricts = Array.from(byDistrict.entries())
      .sort((a,b)=>b[1].acres - a[1].acres)
      .slice(0, CONFIG.maxInsightDistricts);

    // lowest score sessions
    const low = list
      .filter(s => s.sessionScore != null)
      .sort((a,b)=>a.sessionScore - b.sessionScore)
      .slice(0, 3);

    const nodes = [];

    nodes.push(insightCard('Selected scale', `${fmtInt(totals.sessions)} sessions`, `${fmtInt(totals.farmers)} farmers • ${fmtInt(totals.acres)} acres`));
    nodes.push(insightCard('Average performance', `${fmtPct(avgDefinite)} definite`, `${fmtPct(avgAwareness)} awareness • ${fmtPct(avgUsed)} used last year`));

    if (topDistricts.length) {
      const lines = topDistricts.map(([d, v]) => `${escapeHtml(d)}: ${fmtInt(v.acres)} acres`).join('<br/>');
      nodes.push(insightCard('Top districts by acres', `${escapeHtml(topDistricts[0][0])}`, lines));
    } else {
      nodes.push(insightCard('Top districts by acres', '–', 'No district data in selection'));
    }

    if (low.length) {
      const lines = low.map(s => `${escapeHtml(s.sessionId)} (${escapeHtml(s.district||'')}) — ${s.sessionScore}`).join('<br/>');
      nodes.push(insightCard('Lowest session scores', `${low[0].sessionScore}`, lines));
    } else {
      nodes.push(insightCard('Lowest session scores', '–', 'Scores not available'));
    }

    $('#insights').innerHTML = nodes.join('');
  }

  function insightCard(kicker, value, note) {
    return `
      <div class="insight">
        <div class="insight__kicker">${escapeHtml(kicker)}</div>
        <div class="insight__value">${escapeHtml(value)}</div>
        <div class="insight__note">${note}</div>
      </div>
    `;
  }

  function destroyChart(c) { try { c?.destroy(); } catch {} }

  function renderCharts() {
    // Score distribution
    const scores = state.filtered.map(s => s.sessionScore).filter(v => v != null);
    const bins = { High:0, Medium:0, Low:0 };
    for (const sc of scores) {
      if (sc >= CONFIG.scoreThresholds.good) bins.High++;
      else if (sc >= CONFIG.scoreThresholds.mid) bins.Medium++;
      else bins.Low++;
    }

    const ctx1 = $('#chartScore');
    destroyChart(state.charts.score);
    state.charts.score = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: Object.keys(bins),
        datasets: [{ label: 'Sessions', data: Object.values(bins) }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });

    // District acres
    const byDistrict = new Map();
    for (const s of state.filtered) {
      const d = s.district || 'Unknown';
      const acres = Number(s.performance?.acres) || 0;
      byDistrict.set(d, (byDistrict.get(d) || 0) + acres);
    }
    const top = Array.from(byDistrict.entries()).sort((a,b)=>b[1]-a[1]).slice(0, 8);
    const ctx2 = $('#chartDistrictAcres');
    destroyChart(state.charts.districtAcres);
    state.charts.districtAcres = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: top.map(x => x[0]),
        datasets: [{ label: 'Acres', data: top.map(x => x[1]) }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  /* ------------------------------
     Sessions Table + Cards
  ------------------------------ */
  const VIEWS = {
    exec: {
      columns: [
        { key:'sessionId', label:'Session', render: s => `<a href="#" data-open="${s.sessionId}">${escapeHtml(s.sessionId)}</a>` },
        { key:'date', label:'Date', render: s => fmtDate(s.date) },
        { key:'district', label:'District', render: s => escapeHtml(s.district||'–') },
        { key:'farmers', label:'Farmers', render: s => fmtInt(s.performance?.farmers) },
        { key:'acres', label:'Acres', render: s => fmtInt(s.performance?.acres) },
        { key:'definiteUseRate', label:'Definite %', render: s => fmtPct(s.performance?.definiteUseRate) },
        { key:'sessionScore', label:'Score', render: s => renderScorePill(s.sessionScore) },
      ]
    },
    field: {
      columns: [
        { key:'sessionId', label:'Session', render: s => `<a href="#" data-open="${s.sessionId}">${escapeHtml(s.sessionId)}</a>` },
        { key:'district', label:'District', render: s => escapeHtml(s.district||'–') },
        { key:'location', label:'Location', render: s => escapeHtml(s.location||'–') },
        { key:'facilitator', label:'Facilitator', render: s => escapeHtml(s.facilitator||'–') },
        { key:'dealer', label:'Dealer', render: s => escapeHtml(s.dealer||'–') },
        { key:'coordinates', label:'Coordinates', render: s => escapeHtml(s.coordinates||'–') },
        { key:'sessionScore', label:'Score', render: s => renderScorePill(s.sessionScore) },
      ]
    }
  };

  function renderScorePill(score) {
    const b = scoreBand(score);
    if (score == null) return `<span class="pill pill--neutral">–</span>`;
    return `<span class="pill ${b.pillClass}">${escapeHtml(b.label)} • ${score}</span>`;
  }

  function renderSessions() {
    const view = VIEWS[state.viewMode] || VIEWS.exec;

    // table head
    $('#sessionsThead').innerHTML = `<tr>${view.columns.map(c => `<th>${escapeHtml(c.label)}</th>`).join('')}</tr>`;

    // table body
    $('#sessionsTbody').innerHTML = state.filtered.map(s => {
      return `<tr>${view.columns.map(c => `<td>${c.render(s)}</td>`).join('')}</tr>`;
    }).join('');

    // cards (mobile)
    $('#sessionsCards').innerHTML = state.filtered.map(s => {
      const band = scoreBand(s.sessionScore);
      const title = `${escapeHtml(s.sessionId)} • ${escapeHtml(s.district || '–')}`;
      const meta = `${fmtDate(s.date)} • ${escapeHtml(s.location || '–')}`;
      return `
        <div class="card">
          <div class="card__top">
            <div>
              <div class="card__title">${title}</div>
              <div class="card__meta">${meta}</div>
            </div>
            <span class="pill ${band.pillClass}">${band.label} • ${s.sessionScore ?? '–'}</span>
          </div>

          <div class="card__grid">
            <div class="card__item">
              <div class="card__label">Farmers</div>
              <div class="card__value">${fmtInt(s.performance?.farmers)}</div>
            </div>
            <div class="card__item">
              <div class="card__label">Acres</div>
              <div class="card__value">${fmtInt(s.performance?.acres)}</div>
            </div>
            <div class="card__item">
              <div class="card__label">Definite Use</div>
              <div class="card__value">${fmtPct(s.performance?.definiteUseRate)}</div>
            </div>
            <div class="card__item">
              <div class="card__label">Awareness</div>
              <div class="card__value">${fmtPct(s.performance?.awarenessRate)}</div>
            </div>
          </div>

          <div class="card__actions">
            <button class="btn btn--primary btn--sm" data-open="${escapeHtml(s.sessionId)}"><i class="fa-solid fa-circle-info"></i> Details</button>
            ${s.latitude != null && s.longitude != null
              ? `<button class="btn btn--ghost btn--sm" data-pan="${escapeHtml(s.sessionId)}"><i class="fa-solid fa-location-dot"></i> On map</button>`
              : ``}
          </div>
        </div>
      `;
    }).join('');
  }

  /* ------------------------------
     Map
  ------------------------------ */
  function initMapIfNeeded() {
    if (state.map) return;

    state.map = L.map('map', { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(state.map);

    state.cluster = L.markerClusterGroup();
    state.map.addLayer(state.cluster);

    // default view: Pakistan-ish
    state.map.setView([29.5, 70.5], 6);
  }

  function renderMap() {
    initMapIfNeeded();

    state.cluster.clearLayers();
    state.markerBySessionId.clear();

    const points = state.filtered
      .filter(s => s.latitude != null && s.longitude != null)
      .map(s => {
        const color = markerColor(s.sessionScore);
        const m = L.marker([s.latitude, s.longitude], { icon: circleIcon(color) });
        const popup = `
          <div style="min-width:220px">
            <div style="font-weight:900">${escapeHtml(s.sessionId)} • ${escapeHtml(s.district||'')}</div>
            <div style="color:#475569;font-size:12px;margin-top:4px">${escapeHtml(s.location||'–')}</div>
            <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
              <span style="font-weight:800">${fmtInt(s.performance?.farmers)} farmers</span>
              <span style="font-weight:800">${fmtInt(s.performance?.acres)} acres</span>
              <span style="font-weight:900">${s.sessionScore ?? '–'} score</span>
            </div>
            <div style="margin-top:10px">
              <a href="#" data-open="${escapeHtml(s.sessionId)}" style="font-weight:900;color:#0ea5e9;text-decoration:none">Open session details</a>
            </div>
          </div>
        `;
        m.bindPopup(popup);
        state.cluster.addLayer(m);
        state.markerBySessionId.set(s.sessionId, m);
        return [s.latitude, s.longitude];
      });

    if (points.length) {
      const bounds = L.latLngBounds(points);
      state.map.fitBounds(bounds.pad(0.15));
    }
  }

  function panToSession(sessionId) {
    const m = state.markerBySessionId.get(sessionId);
    if (!m) return;
    const ll = m.getLatLng();
    // switch to map tab
    setActiveTab('map');
    state.map.setView(ll, 12, { animate: true });
    setTimeout(() => m.openPopup(), 250);
  }

  /* ------------------------------
     Media
  ------------------------------ */
  function isPlaceholderItem(item) {
    const fn = (item?.filename || '').toLowerCase();
    return fn.includes('placeholder');
  }

  function mediaUrl(item) {
    const base = (state.media?.mediaBasePath || '').replace(/\/?$/, '/');
    const filename = (item?.filename || '').replace(/^\/+/, '');
    return base + filename;
  }

  async function renderMedia() {
    if (!state.media?.mediaItems) {
      $('#mediaGrid').innerHTML = '<div class="insight">No media file loaded.</div>';
      $('#mediaCount').textContent = '0 items';
      $('#mediaMissing').textContent = '0 pending';
      return;
    }

    // only session media for current filtered set
    const allowed = new Set(state.filtered.map(s => s.sessionId));
    const items = state.media.mediaItems.filter(m => (m.category === 'session') && allowed.has(m.sessionId));
    const bySession = new Map();
    for (const it of items) {
      const key = it.sessionId;
      const arr = bySession.get(key) || [];
      arr.push(it);
      bySession.set(key, arr);
    }

    // stats
    const pending = items.filter(isPlaceholderItem).length;
    $('#mediaCount').textContent = `${items.length} items`;
    $('#mediaMissing').textContent = `${pending} pending`;

    // build groups in session order
    const groups = state.filtered.map(s => ({
      session: s,
      items: (bySession.get(s.sessionId) || []).sort((a,b)=> (a.type||'').localeCompare(b.type||'')),
    })).filter(g => g.items.length);

    if (!groups.length) {
      $('#mediaGrid').innerHTML = '<div class="insight">No media for the current selection.</div>';
      return;
    }

    const placeholder = await firstReachable(CONFIG.placeholderCandidates);

    $('#mediaGrid').innerHTML = groups.map(g => {
      const s = g.session;
      const band = scoreBand(s.sessionScore);
      return `
        <div class="mediaGroup">
          <div class="mediaGroup__head">
            <div>
              <div class="mediaGroup__title">${escapeHtml(s.sessionId)} • ${escapeHtml(s.district||'–')}</div>
              <div class="mediaGroup__sub">${fmtDate(s.date)} • ${escapeHtml(s.location||'–')}</div>
            </div>
            <span class="pill ${band.pillClass}">${band.label} • ${s.sessionScore ?? '–'}</span>
          </div>
          <div class="mediaItems">
            ${g.items.map(it => {
              const url = mediaUrl(it);
              const pending = isPlaceholderItem(it);
              const thumb = pending ? placeholder : url;
              const badge = pending
                ? `<div class="mediaItem__badge mediaItem__badge--pending"><i class="fa-solid fa-hourglass-half"></i> Pending</div>`
                : `<div class="mediaItem__badge"><i class="fa-solid ${it.type === 'video' ? 'fa-video' : 'fa-image'}"></i> ${escapeHtml((it.type||'media').toUpperCase())}</div>`;

              return `
                <div class="mediaItem" data-lightbox="${escapeHtml(url)}" data-type="${escapeHtml(it.type||'photo')}" data-pending="${pending ? '1' : '0'}">
                  ${badge}
                  <img class="mediaItem__thumb" loading="lazy" src="${escapeHtml(thumb)}" alt="${escapeHtml(it.caption||'media')}"
                    onerror="this.src='${escapeHtml(placeholder)}';" />
                  <div class="mediaItem__cap">${escapeHtml(it.caption || '')}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');
  }

  /* ------------------------------
     Modals / Lightbox
  ------------------------------ */
  function openModal(sessionId) {
    const s = state.sessions.find(x => x.sessionId === sessionId);
    if (!s) return;

    $('#modalTitle').textContent = `${s.sessionId} • ${s.district || ''}`;
    $('#modalBody').innerHTML = sessionDetailHtml(s);
    $('#modal').hidden = false;
  }

  function sessionDetailHtml(s) {
    const p = s.performance || {};
    const band = scoreBand(s.sessionScore);

    const kv = (k, v) => `
      <div class="kv">
        <div class="kv__k">${escapeHtml(k)}</div>
        <div class="kv__v">${v}</div>
      </div>
    `;

    const reasons = s.reasons || {};
    const toUse = reasons.toUse || {};
    const notUse = reasons.notToUse || {};

    const listReasons = (obj) => {
      const entries = Object.entries(obj || {}).filter(([,v]) => Number(v) > 0);
      if (!entries.length) return '–';
      return entries
        .sort((a,b)=>Number(b[1])-Number(a[1]))
        .slice(0, 6)
        .map(([k,v]) => `${escapeHtml(k)}: <b>${fmtInt(v)}</b>`)
        .join('<br/>');
    };

    return `
      <div class="modalGrid">
        <div class="modalCard">
          <div class="modalCard__title">Session Summary</div>
          ${kv('Date', escapeHtml(fmtDate(s.date)))}
          ${kv('District', escapeHtml(s.district || '–'))}
          ${kv('Location', escapeHtml(s.location || '–'))}
          ${kv('Facilitator', escapeHtml(s.facilitator || '–'))}
          ${kv('Dealer', escapeHtml(s.dealer || '–'))}
          ${kv('Coordinates', escapeHtml(s.coordinates || '–'))}
        </div>

        <div class="modalCard">
          <div class="modalCard__title">Performance</div>
          ${kv('Session Score', `<span class="pill ${band.pillClass}">${band.label} • ${s.sessionScore ?? '–'}</span>`)}
          ${kv('Farmers', `<b>${fmtInt(p.farmers)}</b>`)}
          ${kv('Acres', `<b>${fmtInt(p.acres)}</b>`)}
          ${kv('Awareness', `<b>${fmtPct(p.awarenessRate)}</b> (Know Buctril: ${fmtInt(p.knowBuctril)})`)}
          ${kv('Used last year', `<b>${fmtPct(p.usedLastYearRate)}</b> (${fmtInt(p.usedLastYear)})`)}
          ${kv('Definite use', `<b>${fmtPct(p.definiteUseRate)}</b> (${fmtInt(p.willDefinitelyUse)})`)}
          ${kv('Maybe / Not interested', `${fmtInt(p.maybe)} / ${fmtInt(p.notInterested)}`)}
          ${kv('Estimated Buctril acres', `<b>${fmtInt(p.estimatedBuctrilAcres)}</b>`)}
        </div>

        <div class="modalCard">
          <div class="modalCard__title">Top reasons to use</div>
          <div style="font-size:13px;color:#475569;margin-bottom:8px">Session stated: <b>${escapeHtml(reasons.topReasonUse || '–')}</b></div>
          <div style="font-size:13px">${listReasons(toUse)}</div>
        </div>

        <div class="modalCard">
          <div class="modalCard__title">Top reasons not to use</div>
          <div style="font-size:13px;color:#475569;margin-bottom:8px">Session stated: <b>${escapeHtml(reasons.topReasonNotUse || '–')}</b></div>
          <div style="font-size:13px">${listReasons(notUse)}</div>
        </div>
      </div>
    `;
  }

  function openLightbox(url, type, pending) {
    // pending placeholders do not open
    if (pending === '1') return;

    const safeUrl = escapeHtml(url);
    const node = type === 'video'
      ? `<video controls playsinline src="${safeUrl}"></video>`
      : `<img src="${safeUrl}" alt="media"/>`;

    $('#lightboxBody').innerHTML = node;
    $('#lightbox').hidden = false;
  }

  function closeOverlays() {
    $('#modal').hidden = true;
    $('#lightbox').hidden = true;
    $('#lightboxBody').innerHTML = '';
  }

  /* ------------------------------
     Tabs
  ------------------------------ */
  function setActiveTab(tabName) {
    $$('.tab').forEach(t => t.classList.toggle('tab--active', t.dataset.tab === tabName));
    $$('.tabPanel').forEach(p => p.classList.toggle('tabPanel--active', p.id === `tab-${tabName}`));

    // Leaflet needs invalidateSize when panel becomes visible
    if (tabName === 'map' && state.map) {
      setTimeout(() => state.map.invalidateSize(), 180);
    }
  }

  /* ------------------------------
     Export / Share
  ------------------------------ */
  function exportCSV() {
    const cols = [
      ['Session', 'sessionId'],
      ['Date', 'date'],
      ['District', 'district'],
      ['Location', 'location'],
      ['Farmers', (s) => s.performance?.farmers ?? ''],
      ['Acres', (s) => s.performance?.acres ?? ''],
      ['Awareness %', (s) => s.performance?.awarenessRate ?? ''],
      ['Definite %', (s) => s.performance?.definiteUseRate ?? ''],
      ['Score', (s) => s.sessionScore ?? ''],
      ['Facilitator', 'facilitator'],
      ['Dealer', 'dealer'],
      ['Coordinates', 'coordinates'],
    ];

    const rows = [
      cols.map(c => c[0]),
      ...state.filtered.map(s => cols.map(([,key]) => {
        const v = typeof key === 'function' ? key(s) : s[key];
        return String(v ?? '').replaceAll('"', '""');
      }))
    ];

    const csv = rows.map(r => r.map(x => `"${x}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(state.campaign?.id || 'campaign')}_sessions.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function copyShareLink() {
    const id = state.campaign?.id;
    if (!id) return;
    setParam('campaign', id);
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast('Share link copied.');
    } catch {
      prompt('Copy this link:', url);
    }
  }

  function toast(msg) {
    // lightweight: reuse data health container style if present
    const el = $('#dataHealth');
    if (!el) return;
    el.hidden = false;
    el.className = 'notice notice--ok';
    $('#dataHealthText').textContent = msg;
    setTimeout(() => renderDataHealth(state.campaign?.totals), 1600);
  }

  /* ------------------------------
     Global updates
  ------------------------------ */
  function updateAll() {
    renderKPIs();
    renderInsights();
    renderCharts();
    renderSessions();
    renderMap();
    renderMedia();
  }

  /* ------------------------------
     Campaign Loading
  ------------------------------ */
  function normalizeSessions(rawSessions) {
    return rawSessions.map(s => {
      const dateObj = s.date ? new Date(s.date + 'T00:00:00') : new Date('1970-01-01T00:00:00');
      const sessionScore = computeSessionScore(s);
      return { ...s, dateObj, sessionScore };
    });
  }

  async function loadCampaign(campaignId) {
    const c = state.campaigns.campaigns.find(x => x.id === campaignId) || state.campaigns.campaigns[0];
    if (!c) throw new Error('No campaigns configured.');
    state.campaign = c;

    // update URL + storage
    setParam('campaign', c.id);
    try { localStorage.setItem(CONFIG.storageKeyCampaign, c.id); } catch {}

    // load data
    const sessionsPayload = await fetchJson(c.paths.sessions);
    const mediaPayload = await fetchJson(c.paths.media);

    $('#campaignTitle').textContent = sessionsPayload.campaign || c.title || 'Campaign';
    $('#dateFrom').value = c.dateFrom || '';
    $('#dateTo').value = c.dateTo || '';

    state.sessions = normalizeSessions(sessionsPayload.sessions || []);
    state.media = mediaPayload;

    // district options
    const districts = Array.from(new Set(state.sessions.map(s => s.district).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
    $('#districtFilter').innerHTML = ['<option value="all">All districts</option>', ...districts.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`)].join('');

    // initial filtered = all
    state.filtered = [...state.sessions];

    // data health check (declared totals from campaign config, generated from XLSX)
    renderDataHealth(c.totals);

    applyFilters();
  }

  async function initCampaignSelector() {
    const select = $('#campaignSelect');
    select.innerHTML = state.campaigns.campaigns.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.title)}</option>`).join('');

    const fromUrl = getParam('campaign');
    const fromStorage = (() => { try { return localStorage.getItem(CONFIG.storageKeyCampaign); } catch { return null; } })();
    const initial = fromUrl || fromStorage || state.campaigns.defaultCampaignId || state.campaigns.campaigns[0]?.id;

    select.value = initial;
    await loadCampaign(select.value);

    select.addEventListener('change', async () => {
      await loadCampaign(select.value);
      resetFilters();
    });
  }

  /* ------------------------------
     Event Wiring
  ------------------------------ */
  function wireEvents() {
    $('#btnApply').addEventListener('click', applyFilters);
    $('#btnReset').addEventListener('click', resetFilters);
    $('#btnExport').addEventListener('click', exportCSV);
    $('#btnShare').addEventListener('click', copyShareLink);

    // tabs
    $$('.tab').forEach(btn => btn.addEventListener('click', () => setActiveTab(btn.dataset.tab)));

    // view toggle
    $$('.viewBtn').forEach(btn => btn.addEventListener('click', () => {
      state.viewMode = btn.dataset.view;
      $$('.viewBtn').forEach(b => b.classList.toggle('viewBtn--active', b === btn));
      renderSessions();
    }));

    // open session detail (delegated)
    document.body.addEventListener('click', (e) => {
      const a = e.target.closest('[data-open]');
      if (a) {
        e.preventDefault();
        openModal(a.getAttribute('data-open'));
        return;
      }
      const pan = e.target.closest('[data-pan]');
      if (pan) {
        e.preventDefault();
        panToSession(pan.getAttribute('data-pan'));
        return;
      }
      const lb = e.target.closest('[data-lightbox]');
      if (lb) {
        e.preventDefault();
        openLightbox(lb.getAttribute('data-lightbox'), lb.getAttribute('data-type'), lb.getAttribute('data-pending'));
        return;
      }
      const close = e.target.closest('[data-close]');
      if (close) {
        e.preventDefault();
        closeOverlays();
      }
    });

    // ESC closes overlays
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeOverlays();
    });

    // Source info
    $('#openSourceInfo').addEventListener('click', (e) => {
      e.preventDefault();
      const msg =
        `Data sources:\n` +
        `• sessions.json generated from XLSX SUM sheet (session rows only; summary row excluded)\n` +
        `• media.json defines gallery entries and base asset path\n\n` +
        `Session Score formula (0–100):\n` +
        `35% Definite Use + 25% Awareness + 15% Used Last Year + 25% Understanding\n` +
        `Understanding is normalized from 0–3 average score to 0–100.\n\n` +
        `Multi-campaign:\n` +
        `Add folder data/<campaignId>/ with sessions.json + media.json and register in data/campaigns.json.`;
      alert(msg);
    });
  }

  /* ------------------------------
     iPhone video autoplay fallback
  ------------------------------ */
  async function ensureBackgroundVideo() {
    const v = $('#bgVideo');
    if (!v) return;

    // iOS often blocks autoplay despite muted; if it fails, hide video.
    try {
      await v.play();
    } catch {
      v.classList.add('is-hidden');
    }
  }

  /* ------------------------------
     Boot
  ------------------------------ */
  async function boot() {
    wireEvents();
    await ensureBackgroundVideo();

    state.campaigns = await fetchJson(CONFIG.campaignsPath);
    await initCampaignSelector();

    // default tab
    setActiveTab('overview');
  }

  boot().catch(err => {
    console.error(err);
    $('#campaignTitle').textContent = 'Failed to load dashboard';
    $('#campaignMeta').textContent = String(err?.message || err);
  });
})();
