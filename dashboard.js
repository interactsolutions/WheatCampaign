(() => {
  'use strict';

  /* =========================
   * Utilities
   * ========================= */
  const qs = (sel, root=document) => root.querySelector(sel);
  const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const fmtInt = (n) => (Number.isFinite(n) ? n.toLocaleString('en-US') : '—');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function safeLower(v) {
    return (v == null ? '' : String(v)).toLowerCase();
  }

  function baseUrl() {
    // GitHub Pages project-safe base (e.g., https://.../WheatCampaign/)
    return new URL('./', document.baseURI);
  }

  async function fetchJson(relUrl) {
    const url = new URL(relUrl, baseUrl());
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Fetch failed (${res.status}) for ${url.pathname}. ${text ? 'Response: ' + text.slice(0,120) : ''}`);
    }
    const txt = await res.text();
    try {
      return JSON.parse(txt);
    } catch (e) {
      throw new Error(`Invalid JSON at ${url.pathname}: ${e.message}`);
    }
  }

  function parseQuery() {
    const params = new URLSearchParams(window.location.search);
    return {
      campaign: params.get('campaign') || '',
    };
  }

  function showError(message) {
    const banner = qs('#errorBanner');
    const text = qs('#errorText');
    if (!banner || !text) return;
    text.textContent = message;
    banner.classList.remove('hidden');
  }

  function hideError() {
    qs('#errorBanner')?.classList.add('hidden');
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  /* =========================
   * Session Score (0–100)
   * 35% Definite + 25% Awareness + 15% UsedLastYear + 25% Understanding (0–3 -> 0–100)
   * Missing values are weight-renormalized.
   * ========================= */
  const SCORE_WEIGHTS = {
    definite: 0.35,
    awareness: 0.25,
    used: 0.15,
    understanding: 0.25
  };

  function computeSessionScore(session) {
    const p = session.performance || {};
    const u = session.understandingScores || {};

    const definite = Number.isFinite(p.definiteUseRate) ? p.definiteUseRate : null;      // 0-100
    const awareness = Number.isFinite(p.awarenessRate) ? p.awarenessRate : null;        // 0-100
    const used = Number.isFinite(p.usedLastYearRate) ? p.usedLastYearRate : null;      // 0-100

    let understanding = null;
    if (Number.isFinite(u.averageScore)) {
      understanding = clamp((u.averageScore / 3) * 100, 0, 100);
    } else {
      // fallback: average of the 5 comprehension items (0-3)
      const fields = ['yieldLoss','goldenPeriod','buctrilBroadleaf','buctrilAtlantis','safetyPPE'];
      const vals = fields.map(k => Number.isFinite(u[k]) ? u[k] : null).filter(v => v != null);
      if (vals.length) {
        const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
        understanding = clamp((avg / 3) * 100, 0, 100);
      }
    }

    const parts = [
      { key:'definite', v:definite },
      { key:'awareness', v:awareness },
      { key:'used', v:used },
      { key:'understanding', v:understanding },
    ].filter(x => x.v != null);

    if (!parts.length) return null;

    const weightSum = parts.reduce((s,x)=>s + SCORE_WEIGHTS[x.key], 0);
    const score = parts.reduce((s,x)=>s + (SCORE_WEIGHTS[x.key] / weightSum) * x.v, 0);
    return Math.round(score * 10) / 10;
  }

  function scoreBand(score) {
    if (!Number.isFinite(score)) return {label:'—', cls:'score-mid'};
    if (score >= 85) return {label:'High', cls:'score-high'};
    if (score >= 70) return {label:'Medium', cls:'score-mid'};
    return {label:'Low', cls:'score-low'};
  }

  /* =========================
   * State
   * ========================= */
  const state = {
    campaigns: [],
    campaign: null,
    sessions: [],
    mediaItems: [], // from media.json (brand + session)
    filtered: [],
    mediaFilter: 'all', // all/photos/videos
    charts: {},
    map: null,
    markersLayer: null
  };

  /* =========================
   * Campaign / Assets rendering
   * ========================= */
  function setBackgroundVideo(src) {
    const v = qs('#bgVideo');
    if (!v) return;
    v.src = new URL(src, baseUrl()).toString();
    v.muted = true;
    v.loop = true;
    v.playsInline = true;

    const play = async () => {
      try {
        await v.play();
      } catch {
        // iOS autoplay restrictions – disable video background
        v.removeAttribute('src');
        v.load();
      }
    };
    play();
  }

  function renderHeaderStrip(assets) {
    const strip = qs('#headerStrip');
    if (!strip) return;
    strip.innerHTML = '';

    const seq = assets?.headerVideos || [];
    // enforce sequence by rendering in array order
    seq.forEach((item, idx) => {
      const tile = document.createElement('div');
      tile.className = 'brand-tile';
      tile.setAttribute('data-idx', String(idx));

      const label = document.createElement('div');
      label.className = 'tile-label';
      label.textContent = item.label || '';

      const badge = document.createElement('div');
      badge.className = 'tile-badge';
      badge.textContent = 'Header';

      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.loop = true;
      v.preload = 'metadata';
      v.autoplay = true;

      let srcUrl = new URL(item.src, baseUrl()).toString();
      v.src = srcUrl;

      const fallbackToImage = () => {
        const img = document.createElement('img');
        const fallback = item.fallback || assets?.placeholder;
        img.src = new URL(fallback, baseUrl()).toString();
        img.alt = item.label || 'Header';
        tile.innerHTML = '';
        tile.appendChild(img);
        tile.appendChild(label);
        tile.appendChild(badge);
      };

      v.addEventListener('error', () => {
        // try altSrc once (case-sensitive filenames on GitHub Pages can cause this)
        if (item.altSrc && v.getAttribute('data-alt-tried') !== '1') {
          v.setAttribute('data-alt-tried', '1');
          v.src = new URL(item.altSrc, baseUrl()).toString();
          v.load();
          v.play().catch(() => fallbackToImage());
          return;
        }
        fallbackToImage();
      });
      v.addEventListener('loadedmetadata', async () => {
        try {
          await v.play();
        } catch {
          fallbackToImage();
        }
      });

      tile.appendChild(v);
      tile.appendChild(label);
      tile.appendChild(badge);
      strip.appendChild(tile);
    });
  }

  /* =========================
   * Filters
   * ========================= */
  function getFilters() {
    const district = qs('#districtSelect')?.value || '__all__';
    const q = (qs('#searchInput')?.value || '').trim().toLowerCase();
    const df = qs('#dateFrom')?.value || '';
    const dt = qs('#dateTo')?.value || '';
    return { district, q, df, dt };
  }

  function applyFilters() {
    const { district, q, df, dt } = getFilters();
    let arr = state.sessions.slice();

    if (district !== '__all__') {
      arr = arr.filter(s => (s.district || '').toLowerCase() === district.toLowerCase());
    }

    if (q) {
      arr = arr.filter(s => {
        const blob = [
          s.sessionId, s.location, s.district, s.host, s.dealerName, s.dealerShop,
          s.facilitator, s.village
        ].map(safeLower).join(' | ');
        return blob.includes(q);
      });
    }

    if (df) arr = arr.filter(s => s.date >= df);
    if (dt) arr = arr.filter(s => s.date <= dt);

    // compute score on the fly (cached into session object)
    arr.forEach(s => {
      if (s._score == null) s._score = computeSessionScore(s);
    });

    state.filtered = arr;
  }

  function resetFilters() {
    qs('#districtSelect').value = '__all__';
    qs('#searchInput').value = '';
    qs('#dateFrom').value = '';
    qs('#dateTo').value = '';
    state.mediaFilter = 'all';
    qsa('.chip').forEach(c => c.classList.remove('active'));
    qs('.chip[data-media-filter="all"]')?.classList.add('active');
  }

  /* =========================
   * KPI + Insights
   * ========================= */
  function sum(arr, fn) { return arr.reduce((a,x)=>a + (fn(x) || 0), 0); }

  function aggregate(arr) {
    const totalFarmers = sum(arr, s => s.farmers);
    const totalWheatFarmers = sum(arr, s => s.wheatFarmers);
    const totalAcres = sum(arr, s => s.acres);
    const estBuctrilAcres = sum(arr, s => s.performance?.estimatedBuctrilAcres);
    const influencers = sum(arr, s => s.performance?.keyInfluencers);

    const knowBuctril = sum(arr, s => s.performance?.knowBuctril);
    const usedLastYear = sum(arr, s => s.performance?.usedLastYear);
    const definite = sum(arr, s => s.performance?.willDefinitelyUse);
    const maybe = sum(arr, s => s.performance?.maybe);
    const notInterested = sum(arr, s => s.performance?.notInterested);

    const avgScore = (() => {
      const scores = arr.map(s => s._score).filter(Number.isFinite);
      if (!scores.length) return null;
      return Math.round((scores.reduce((a,b)=>a+b,0) / scores.length) * 10) / 10;
    })();

    // Rates derived from counts where possible (more trustworthy than averaging rates)
    const awarenessRate = totalFarmers ? (knowBuctril / totalFarmers) * 100 : null;
    const usedRate = totalFarmers ? (usedLastYear / totalFarmers) * 100 : null;
    const definiteRate = totalFarmers ? (definite / totalFarmers) * 100 : null;
    const maybeRate = totalFarmers ? (maybe / totalFarmers) * 100 : null;
    const notRate = totalFarmers ? (notInterested / totalFarmers) * 100 : null;

    return {
      sessions: arr.length,
      totalFarmers, totalWheatFarmers, totalAcres, estBuctrilAcres, influencers,
      awarenessRate, usedRate, definiteRate, maybeRate, notRate,
      avgScore
    };
  }

  function renderKPIs() {
    const a = aggregate(state.filtered);

    qs('#kpiSessions').textContent = fmtInt(a.sessions);
    qs('#kpiFarmers').textContent = fmtInt(a.totalFarmers);
    qs('#kpiWheatFarmers').textContent = `Wheat farmers: ${fmtInt(a.totalWheatFarmers)}`;
    qs('#kpiAcres').textContent = fmtInt(a.totalAcres);
    qs('#kpiEstAcres').textContent = `Est. Buctril acres: ${fmtInt(a.estBuctrilAcres)}`;
    qs('#kpiInfluencers').textContent = fmtInt(a.influencers);

    qs('#badgeSessions').textContent = `Sessions: ${fmtInt(a.sessions)}`;
    qs('#badgeFarmers').textContent = `Farmers: ${fmtInt(a.totalFarmers)}`;
    qs('#badgeAcres').textContent = `Acres: ${fmtInt(a.totalAcres)}`;
    qs('#badgeScore').textContent = `Avg Session Score: ${a.avgScore != null ? a.avgScore : '—'}`;
  }

  function renderInsights() {
    const box = qs('#insightsBox');
    if (!box) return;

    const arr = state.filtered.slice();
    const a = aggregate(arr);

    if (!arr.length) {
      box.innerHTML = `<div class="muted">No sessions match the selection.</div>`;
      return;
    }

    // District rankings (even when district selected, these help show internal variance)
    const byDistrict = new Map();
    arr.forEach(s => {
      const key = (s.district || 'Unknown').trim() || 'Unknown';
      if (!byDistrict.has(key)) byDistrict.set(key, []);
      byDistrict.get(key).push(s);
    });

    const districtStats = Array.from(byDistrict.entries()).map(([district, ss]) => {
      const agg = aggregate(ss);
      return { district, ...agg };
    }).sort((x,y) => (y.avgScore || 0) - (x.avgScore || 0));

    const best = districtStats[0];
    const worst = districtStats.slice().sort((x,y)=> (x.avgScore||0)-(y.avgScore||0))[0];

    // Reasons (top)
    const reasonUseTotals = {
      trustInBayer: sum(arr, s => s.reasons?.toUse?.trustInBayer),
      betterWeedControl: sum(arr, s => s.reasons?.toUse?.betterWeedControl),
      safeOnCrop: sum(arr, s => s.reasons?.toUse?.safeOnCrop),
      dealerRecommending: sum(arr, s => s.reasons?.toUse?.dealerRecommending),
      goodPastExperience: sum(arr, s => s.reasons?.toUse?.goodPastExperience),
      offerGift: sum(arr, s => s.reasons?.toUse?.offerGift),
      other: sum(arr, s => s.reasons?.toUse?.other),
    };

    const reasonNotTotals = {
      priceTooHigh: sum(arr, s => s.reasons?.notToUse?.priceTooHigh),
      happyWithGeneric: sum(arr, s => s.reasons?.notToUse?.happyWithGeneric),
      fearOfBurn: sum(arr, s => s.reasons?.notToUse?.fearOfBurn),
      noMoney: sum(arr, s => s.reasons?.notToUse?.noMoney),
      notAvailable: sum(arr, s => s.reasons?.notToUse?.notAvailable),
      doNotBelieve: sum(arr, s => s.reasons?.notToUse?.doNotBelieve),
      other: sum(arr, s => s.reasons?.notToUse?.other),
    };

    const topUse = Object.entries(reasonUseTotals).sort((a,b)=>b[1]-a[1])[0];
    const topBlock = Object.entries(reasonNotTotals).sort((a,b)=>b[1]-a[1])[0];

    const li = [];
    li.push(`<li><strong>Selection summary:</strong> ${fmtInt(a.sessions)} sessions, ${fmtInt(a.totalFarmers)} farmers, ${fmtInt(a.totalAcres)} acres. Definite intent ≈ <strong>${a.definiteRate ? a.definiteRate.toFixed(1) : '—'}%</strong>, awareness ≈ <strong>${a.awarenessRate ? a.awarenessRate.toFixed(1) : '—'}%</strong>.</li>`);

    if (best && worst && districtStats.length > 1) {
      li.push(`<li><strong>Best district by Session Score:</strong> ${best.district} (avg score ${best.avgScore ?? '—'}). <strong>Needs support:</strong> ${worst.district} (avg score ${worst.avgScore ?? '—'}).</li>`);
    }

    if (topUse && topUse[1] > 0) {
      li.push(`<li><strong>Top driver:</strong> ${prettyReason(topUse[0])} (mentions: ${fmtInt(topUse[1])}).</li>`);
    }
    if (topBlock && topBlock[1] > 0) {
      li.push(`<li><strong>Top barrier:</strong> ${prettyReason(topBlock[0])} (mentions: ${fmtInt(topBlock[1])}).</li>`);
    }

    // Actionable
    if (a.awarenessRate != null && a.awarenessRate < 60) {
      li.push(`<li><strong>Action:</strong> Awareness below 60% suggests pre-activation + dealer touchpoints before sessions.</li>`);
    }
    if (a.definiteRate != null && a.definiteRate < 70) {
      li.push(`<li><strong>Action:</strong> Definite intent below 70% suggests improving ROI/value narrative and objection handling.</li>`);
    }
    if (a.avgScore != null && a.avgScore < 75) {
      li.push(`<li><strong>Action:</strong> Session Score below 75 suggests retraining on the 5 key messages (Yield loss, Golden period, Broadleaf, Buctril+Atlantis, Safety).</li>`);
    }

    box.innerHTML = `<ul>${li.join('')}</ul>`;
  }

  function prettyReason(key) {
    const map = {
      trustInBayer:'Trust in Bayer',
      betterWeedControl:'Better weed control',
      safeOnCrop:'Safe on crop',
      dealerRecommending:'Dealer recommending',
      goodPastExperience:'Good past experience',
      offerGift:'Offer / gift',
      priceTooHigh:'Price too high',
      happyWithGeneric:'Happy with generic',
      fearOfBurn:'Fear of burn',
      noMoney:'No money',
      notAvailable:'Not available',
      doNotBelieve:'Do not believe',
      other:'Other'
    };
    return map[key] || key;
  }

  /* =========================
   * Charts
   * ========================= */
  function destroyChart(key) {
    const c = state.charts[key];
    if (c) {
      try { c.destroy(); } catch {}
      delete state.charts[key];
    }
  }

  function renderCharts() {
    const arr = state.filtered;
    const a = aggregate(arr);

    // Fallback when Chart.js missing
    const hasChart = typeof window.Chart !== 'undefined';

    const funnelFallback = qs('#chartFunnelFallback');
    const districtFallback = qs('#chartDistrictFallback');
    const understandFallback = qs('#chartUnderstandingFallback');
    const reasonsFallback = qs('#chartReasonsFallback');

    if (!hasChart) {
      destroyChart('funnel'); destroyChart('district'); destroyChart('understanding'); destroyChart('reasons');
      qs('#chartFunnel').classList.add('hidden');
      qs('#chartDistrict').classList.add('hidden');
      qs('#chartUnderstanding').classList.add('hidden');
      qs('#chartReasons').classList.add('hidden');
      [funnelFallback,districtFallback,understandFallback,reasonsFallback].forEach(x=>x.classList.remove('hidden'));
      funnelFallback.textContent = `Awareness ${a.awarenessRate?.toFixed(1) ?? '—'}%, Used last year ${a.usedRate?.toFixed(1) ?? '—'}%, Definite ${a.definiteRate?.toFixed(1) ?? '—'}%.`;
      districtFallback.textContent = `District chart unavailable (Chart.js not loaded).`;
      understandFallback.textContent = `Understanding chart unavailable (Chart.js not loaded).`;
      reasonsFallback.textContent = `Reasons chart unavailable (Chart.js not loaded).`;
      return;
    }

    // ensure canvases visible
    qsa('canvas').forEach(c=>c.classList.remove('hidden'));
    [funnelFallback,districtFallback,understandFallback,reasonsFallback].forEach(x=>x.classList.add('hidden'));

    // 1) Funnel
    destroyChart('funnel');
    const ctxF = qs('#chartFunnel');
    if (ctxF) {
      state.charts.funnel = new window.Chart(ctxF, {
        type: 'bar',
        data: {
          labels: ['Awareness', 'Used last year', 'Definite intent', 'Maybe', 'Not interested'],
          datasets: [{
            label: '% of farmers',
            data: [
              a.awarenessRate ?? 0,
              a.usedRate ?? 0,
              a.definiteRate ?? 0,
              a.maybeRate ?? 0,
              a.notRate ?? 0
            ]
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, max: 100, ticks: { callback: (v)=>`${v}%` } }
          }
        }
      });
    }

    // 2) District coverage (top 8 by acres within selection)
    destroyChart('district');
    const byDistrict = new Map();
    arr.forEach(s => {
      const k = (s.district || 'Unknown').trim() || 'Unknown';
      if (!byDistrict.has(k)) byDistrict.set(k, { acres:0, farmers:0, sessions:0, scoreSum:0, scoreN:0 });
      const o = byDistrict.get(k);
      o.acres += (s.acres || 0);
      o.farmers += (s.farmers || 0);
      o.sessions += 1;
      if (Number.isFinite(s._score)) { o.scoreSum += s._score; o.scoreN += 1; }
    });
    const districtArr = Array.from(byDistrict.entries()).map(([k,v]) => ({
      district:k,
      acres:v.acres,
      farmers:v.farmers,
      sessions:v.sessions,
      avgScore: v.scoreN ? (v.scoreSum/v.scoreN) : 0
    })).sort((x,y)=>y.acres - x.acres).slice(0, 8);

    const ctxD = qs('#chartDistrict');
    if (ctxD) {
      state.charts.district = new window.Chart(ctxD, {
        type: 'bar',
        data: {
          labels: districtArr.map(d => d.district),
          datasets: [{
            label: 'Acres covered',
            data: districtArr.map(d => d.acres)
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } }
        }
      });
    }

    // 3) Understanding
    destroyChart('understanding');
    const uAgg = aggregateUnderstanding(arr);
    const ctxU = qs('#chartUnderstanding');
    if (ctxU) {
      state.charts.understanding = new window.Chart(ctxU, {
        type: 'bar',
        data: {
          labels: ['Yield loss', 'Golden period', 'Broadleaf', 'Buctril+Atlantis', 'Safety/PPE'],
          datasets: [{
            label: 'Avg (0–3)',
            data: [uAgg.yieldLoss, uAgg.goldenPeriod, uAgg.buctrilBroadleaf, uAgg.buctrilAtlantis, uAgg.safetyPPE]
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, max: 3, ticks: { stepSize: 1 } }
          }
        }
      });
    }

    // 4) Reasons to use (top 5)
    destroyChart('reasons');
    const reasons = aggregateReasonsToUse(arr);
    const top = Object.entries(reasons).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const ctxR = qs('#chartReasons');
    if (ctxR) {
      state.charts.reasons = new window.Chart(ctxR, {
        type: 'bar',
        data: {
          labels: top.map(([k]) => prettyReason(k)),
          datasets: [{
            label: 'Mentions',
            data: top.map(([,v]) => v)
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } }
        }
      });
    }
  }

  function aggregateUnderstanding(arr) {
    const sumField = (k) => {
      const vals = arr.map(s => s.understandingScores?.[k]).filter(Number.isFinite);
      return vals.length ? (vals.reduce((a,b)=>a+b,0) / vals.length) : 0;
    };
    return {
      yieldLoss: round1(sumField('yieldLoss')),
      goldenPeriod: round1(sumField('goldenPeriod')),
      buctrilBroadleaf: round1(sumField('buctrilBroadleaf')),
      buctrilAtlantis: round1(sumField('buctrilAtlantis')),
      safetyPPE: round1(sumField('safetyPPE')),
    };
  }

  function aggregateReasonsToUse(arr) {
    const keys = ['trustInBayer','betterWeedControl','safeOnCrop','dealerRecommending','goodPastExperience','offerGift','other'];
    const out = {};
    keys.forEach(k => { out[k] = sum(arr, s => s.reasons?.toUse?.[k]); });
    return out;
  }

  function round1(n){ return Math.round((n || 0) * 10) / 10; }

  /* =========================
   * Gallery
   * Only show assets/gallery/* (session media), not root assets
   * ========================= */
  function renderGallery() {
    const grid = qs('#galleryGrid');
    const meta = qs('#galleryMeta');
    if (!grid || !meta) return;

    const filter = state.mediaFilter;
    const items = [];

    state.filtered.forEach(s => {
      const files = s.mediaFiles || {};
      const imgs = (files.images || []).filter(fn => fn.startsWith('gallery/'));
      const vids = (files.videos || []).filter(fn => fn.startsWith('gallery/'));

      imgs.forEach(fn => items.push({ type:'photo', filename: fn, session: s }));
      vids.forEach(fn => items.push({ type:'video', filename: fn, session: s }));
    });

    const filteredItems = items.filter(it => {
      if (filter === 'photos') return it.type === 'photo';
      if (filter === 'videos') return it.type === 'video';
      return true;
    });

    meta.textContent = `${fmtInt(filteredItems.length)} item(s) from assets/gallery — linked to current selection`;

    if (!filteredItems.length) {
      grid.innerHTML = `<div class="gallery-placeholder">No media for this selection (or media not yet uploaded).</div>`;
      return;
    }

    const placeholder = state.campaign?.assets?.placeholder || 'assets/placeholder.svg';
    const base = state.campaign?.assets?.galleryBase || 'assets/';

    grid.innerHTML = '';
    filteredItems.slice(0, 60).forEach((it) => {
      const card = document.createElement('div');
      card.className = 'gallery-item';
      const src = new URL(base + it.filename, baseUrl()).toString();

      const mediaEl = (it.type === 'video') ? document.createElement('video') : document.createElement('img');
      if (it.type === 'video') {
        mediaEl.muted = true;
        mediaEl.playsInline = true;
        mediaEl.preload = 'metadata';
        mediaEl.src = src;
      } else {
        mediaEl.src = src;
        mediaEl.alt = `${it.session.sessionId} media`;
      }
      mediaEl.addEventListener('error', () => {
        if (it.type === 'video') {
          // fallback: show placeholder image
          const img = document.createElement('img');
          img.src = new URL(placeholder, baseUrl()).toString();
          img.alt = 'Missing media';
          card.insertBefore(img, card.firstChild);
          try { mediaEl.remove(); } catch {}
        } else {
          mediaEl.src = new URL(placeholder, baseUrl()).toString();
        }
      });

      const cap = document.createElement('div');
      cap.className = 'cap';
      cap.innerHTML = `<div class="t">${it.session.sessionId} • ${escapeHtml(it.session.district || '—')}</div>
                       <div class="m">${escapeHtml(it.session.location || '')}</div>`;

      card.appendChild(mediaEl);
      card.appendChild(cap);
      card.addEventListener('click', () => openDrawer(it.session));
      grid.appendChild(card);
    });
  }

  function escapeHtml(str) {
    return String(str || '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  /* =========================
   * Sessions (table + cards)
   * ========================= */
  function renderSessions() {
    const tbody = qs('#sessionsTbody');
    const cards = qs('#sessionsCards');
    const meta = qs('#sessionsMeta');
    if (!tbody || !cards || !meta) return;

    const arr = state.filtered.slice();
    meta.textContent = `${fmtInt(arr.length)} session(s) shown. Click a row/card or map marker for full details (host, dealer, intent, reasons, media).`;

    tbody.innerHTML = '';
    cards.innerHTML = '';

    if (!arr.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="muted">No sessions match the selection.</td></tr>`;
      cards.innerHTML = `<div class="muted">No sessions match the selection.</div>`;
      return;
    }

    arr.forEach(s => {
      const score = s._score;
      const band = scoreBand(score);
      const def = s.performance?.definiteUseRate;
      const aware = s.performance?.awarenessRate;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fmtInt(s.sessionNumber)}</td>
        <td>${escapeHtml(s.date)}</td>
        <td>${escapeHtml(s.district || '—')}</td>
        <td>${escapeHtml(s.location || '—')}</td>
        <td>${fmtInt(s.farmers)}</td>
        <td>${fmtInt(s.acres)}</td>
        <td>${Number.isFinite(def) ? def.toFixed(1)+'%' : '—'}</td>
        <td>${Number.isFinite(aware) ? aware.toFixed(1)+'%' : '—'}</td>
        <td><span class="score-pill ${band.cls}">${Number.isFinite(score) ? score.toFixed(1) : '—'}</span></td>
      `;
      tr.addEventListener('click', () => openDrawer(s));
      tbody.appendChild(tr);

      const card = document.createElement('div');
      card.className = 'session-card';
      card.innerHTML = `
        <div class="top">
          <div>
            <div class="id">${escapeHtml(s.sessionId)} • ${escapeHtml(s.district || '—')}</div>
            <div class="meta">${escapeHtml(s.date)} • ${escapeHtml(s.location || '')}</div>
          </div>
          <span class="score-pill ${band.cls}">${Number.isFinite(score) ? score.toFixed(1) : '—'}</span>
        </div>
        <div class="grid">
          <div class="kv"><div class="k">Farmers</div><div class="v">${fmtInt(s.farmers)}</div></div>
          <div class="kv"><div class="k">Acres</div><div class="v">${fmtInt(s.acres)}</div></div>
          <div class="kv"><div class="k">Definite</div><div class="v">${Number.isFinite(def) ? def.toFixed(1)+'%' : '—'}</div></div>
          <div class="kv"><div class="k">Awareness</div><div class="v">${Number.isFinite(aware) ? aware.toFixed(1)+'%' : '—'}</div></div>
        </div>
      `;
      card.addEventListener('click', () => openDrawer(s));
      cards.appendChild(card);
    });
  }

  /* =========================
   * Map (Leaflet)
   * - Normal view shows spots (filtered selection)
   * - Clicking a spot opens session details (host, guests proxy: influencers/competitors, etc.)
   * ========================= */
  function ensureMap() {
    const mapEl = qs('#map');
    const fallback = qs('#mapFallback');
    if (!mapEl || !fallback) return;

    if (typeof window.L === 'undefined') {
      mapEl.classList.add('hidden');
      fallback.classList.remove('hidden');
      return;
    }

    fallback.classList.add('hidden');
    mapEl.classList.remove('hidden');

    if (!state.map) {
      state.map = window.L.map(mapEl, { zoomControl: true });
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap'
      }).addTo(state.map);

      state.markersLayer = window.L.layerGroup().addTo(state.map);
    }
  }

  function markerColor(score) {
    if (!Number.isFinite(score)) return '#ff9800';
    if (score >= 85) return '#2e7d32';
    if (score >= 70) return '#ff9800';
    return '#f44336';
  }

  function renderMap() {
    const meta = qs('#mapMeta');
    if (!meta) return;

    ensureMap();
    if (!state.map || !state.markersLayer) {
      meta.textContent = `Markers: ${fmtInt(state.filtered.length)} (map unavailable)`;
      return;
    }

    state.markersLayer.clearLayers();

    const markers = [];
    state.filtered.forEach(s => {
      if (!Number.isFinite(s.latitude) || !Number.isFinite(s.longitude)) return;
      const score = s._score;
      const color = markerColor(score);

      const icon = window.L.divIcon({
        className: 'custom-marker',
        html: `<div style="width:12px;height:12px;border-radius:999px;background:${color};border:2px solid rgba(255,255,255,.92);box-shadow:0 5px 12px rgba(0,0,0,.35)"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
      });

      const m = window.L.marker([s.latitude, s.longitude], { icon });
      m.on('click', () => openDrawer(s));
      m.addTo(state.markersLayer);
      markers.push(m);
    });

    meta.textContent = `Markers: ${fmtInt(markers.length)}. Marker color is driven by Session Score: High ≥ 85, Medium 70–84.9, Low < 70.`;

    if (markers.length) {
      const group = window.L.featureGroup(markers);
      state.map.fitBounds(group.getBounds().pad(0.15));
      // iOS fix: invalidate after render
      setTimeout(() => state.map.invalidateSize(true), 220);
    } else {
      state.map.setView([30.3753, 69.3451], 5); // Pakistan centroid
    }
  }

  /* =========================
   * Drawer
   * ========================= */
  function openDrawer(session) {
    const drawer = qs('#drawer');
    const backdrop = qs('#backdrop');
    if (!drawer || !backdrop) return;

    qs('#drawerTitle').textContent = `${session.sessionId} • ${session.district || '—'}`;
    qs('#drawerSub').textContent = `${session.date} • ${session.location || ''}`;

    const score = session._score;
    const band = scoreBand(score);

    const perf = session.performance || {};
    const u = session.understandingScores || {};
    const r = session.reasons || {};
    const toUse = r.toUse || {};
    const notUse = r.notToUse || {};

    const body = qs('#drawerBody');
    const placeholder = state.campaign?.assets?.placeholder || 'assets/placeholder.svg';
    const base = state.campaign?.assets?.galleryBase || 'assets/';

    const mediaThumbs = [];
    (session.mediaFiles?.images || []).slice(0,6).forEach(fn => {
      if (!fn.startsWith('gallery/')) return;
      mediaThumbs.push(`<div class="media-thumb"><img src="${new URL(base+fn, baseUrl()).toString()}" onerror="this.src='${new URL(placeholder, baseUrl()).toString()}'" alt="media"/></div>`);
    });
    (session.mediaFiles?.videos || []).slice(0,3).forEach(fn => {
      if (!fn.startsWith('gallery/')) return;
      mediaThumbs.push(`<div class="media-thumb"><video src="${new URL(base+fn, baseUrl()).toString()}" muted playsinline preload="metadata" onerror="this.outerHTML='<div class=\\'media-thumb\\'><img src=\\'${new URL(placeholder, baseUrl()).toString()}\\' alt=\\'missing\\'/></div>'"></video></div>`);
    });

    const html = `
      <div class="drawer-section">
        <h4>Snapshot</h4>
        <div class="kv-row">
          <div class="kvbox"><div class="k">Session Score</div><div class="v"><span class="score-pill ${band.cls}">${Number.isFinite(score) ? score.toFixed(1) : '—'}</span></div></div>
          <div class="kvbox"><div class="k">Farmers / Acres</div><div class="v">${fmtInt(session.farmers)} / ${fmtInt(session.acres)}</div></div>
          <div class="kvbox"><div class="k">Definite / Awareness</div><div class="v">${Number.isFinite(perf.definiteUseRate) ? perf.definiteUseRate.toFixed(1)+'%' : '—'} / ${Number.isFinite(perf.awarenessRate) ? perf.awarenessRate.toFixed(1)+'%' : '—'}</div></div>
          <div class="kvbox"><div class="k">Used last year</div><div class="v">${Number.isFinite(perf.usedLastYearRate) ? perf.usedLastYearRate.toFixed(1)+'%' : '—'}</div></div>
        </div>
      </div>

      <div class="drawer-section">
        <h4>Field ownership</h4>
        <div class="kv-row">
          <div class="kvbox"><div class="k">Host</div><div class="v">${escapeHtml(session.host || '—')}</div></div>
          <div class="kvbox"><div class="k">Host contact</div><div class="v">${escapeHtml(session.hostContact || '—')}</div></div>
          <div class="kvbox"><div class="k">Facilitator (Sales rep)</div><div class="v">${escapeHtml(session.facilitator || '—')}</div></div>
          <div class="kvbox"><div class="k">Facilitator contact</div><div class="v">${escapeHtml(session.facilitatorContact || '—')}</div></div>
          <div class="kvbox"><div class="k">Dealer shop</div><div class="v">${escapeHtml(session.dealerShop || '—')}</div></div>
          <div class="kvbox"><div class="k">Dealer contact</div><div class="v">${escapeHtml(session.dealerContact || '—')}</div></div>
          ${Array.isArray(session.guests) && session.guests.length
            ? `<div class="kvbox"><div class="k">Session guests</div><div class="v">${escapeHtml(session.guests.join(', '))}</div></div>`
            : ``}
        </div>
      </div>

      <div class="drawer-section">
        <h4>Understanding (0–3)</h4>
        <div class="kv-row">
          <div class="kvbox"><div class="k">Yield loss</div><div class="v">${fmtInt(u.yieldLoss)}</div></div>
          <div class="kvbox"><div class="k">Golden period</div><div class="v">${fmtInt(u.goldenPeriod)}</div></div>
          <div class="kvbox"><div class="k">Broadleaf control</div><div class="v">${fmtInt(u.buctrilBroadleaf)}</div></div>
          <div class="kvbox"><div class="k">Buctril + Atlantis</div><div class="v">${fmtInt(u.buctrilAtlantis)}</div></div>
          <div class="kvbox"><div class="k">Safety / PPE</div><div class="v">${fmtInt(u.safetyPPE)}</div></div>
          <div class="kvbox"><div class="k">Average</div><div class="v">${Number.isFinite(u.averageScore) ? u.averageScore.toFixed(1) : '—'}</div></div>
        </div>
      </div>

      <div class="drawer-section">
        <h4>Drivers & barriers</h4>
        <div class="kv-row">
          <div class="kvbox"><div class="k">Top reason to use</div><div class="v">${escapeHtml(r.topReasonUse || '—')}</div></div>
          <div class="kvbox"><div class="k">Top reason not to use</div><div class="v">${escapeHtml(r.topReasonNotUse || '—')}</div></div>
          <div class="kvbox"><div class="k">Influencers</div><div class="v">${fmtInt(perf.keyInfluencers)}</div></div>
          <div class="kvbox"><div class="k">Competitors mentioned</div><div class="v">${escapeHtml(r.competitorBrandsMentioned || '—')}</div></div>
        </div>

        <div class="kv-row" style="margin-top:10px">
          <div class="kvbox"><div class="k">Use: Trust in Bayer</div><div class="v">${fmtInt(toUse.trustInBayer)}</div></div>
          <div class="kvbox"><div class="k">Use: Better weed control</div><div class="v">${fmtInt(toUse.betterWeedControl)}</div></div>
          <div class="kvbox"><div class="k">Block: Price too high</div><div class="v">${fmtInt(notUse.priceTooHigh)}</div></div>
          <div class="kvbox"><div class="k">Block: Generic ok</div><div class="v">${fmtInt(notUse.happyWithGeneric)}</div></div>
        </div>
      </div>

      <div class="drawer-section">
        <h4>Media (session-linked)</h4>
        ${mediaThumbs.length ? `<div class="media-row">${mediaThumbs.join('')}</div>` : `<div class="muted">No media linked to this session.</div>`}
      </div>
    `;

    body.innerHTML = html;

    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    backdrop.classList.remove('hidden');
  }

  function closeDrawer() {
    const drawer = qs('#drawer');
    const backdrop = qs('#backdrop');
    if (!drawer || !backdrop) return;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    backdrop.classList.add('hidden');
  }

  /* =========================
   * CSV Export (iOS-friendly)
   * ========================= */
  function sessionsToCsv(arr) {
    const cols = [
      'sessionId','date','district','location','farmers','wheatFarmers','acres',
      'definiteUseRate','awarenessRate','usedLastYearRate','sessionScore',
      'host','hostContact','facilitator','facilitatorContact','dealerShop','dealerName','dealerContact'
    ];
    const rows = [cols.join(',')];
    arr.forEach(s => {
      const p = s.performance || {};
      const line = [
        s.sessionId, s.date, s.district, s.location,
        s.farmers, s.wheatFarmers, s.acres,
        p.definiteUseRate, p.awarenessRate, p.usedLastYearRate,
        s._score,
        s.host, s.hostContact, s.facilitator, s.facilitatorContact, s.dealerShop, s.dealerName, s.dealerContact
      ].map(v => {
        const str = (v == null ? '' : String(v));
        // escape
        if (/[,"\n]/.test(str)) return `"${str.replaceAll('"','""')}"`;
        return str;
      });
      rows.push(line.join(','));
    });
    return rows.join('\n');
  }

  async function exportCsv() {
    const arr = state.filtered.slice();
    const csv = sessionsToCsv(arr);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const fileName = `${state.campaign?.id || 'campaign'}_${new Date().toISOString().slice(0,10)}.csv`;

    // iOS/modern: share sheet
    try {
      const file = new File([blob], fileName, { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName });
        return;
      }
    } catch {}

    // default download
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();

    if (isIOS()) {
      // fallback: open in new tab so "Save to Files" works reliably
      window.open(url, '_blank');
    }
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /* =========================
   * Rendering (master)
   * ========================= */
  function renderAll() {
    renderKPIs();
    renderCharts();
    renderMap();
    renderGallery();
    renderSessions();
    renderInsights();
  }

  /* =========================
   * Init / Load
   * ========================= */
  async function loadCampaign(campaignId) {
    hideError();

    const campaign = state.campaigns.find(c => c.id === campaignId) || state.campaigns[0];
    if (!campaign) throw new Error('No campaigns configured.');
    state.campaign = campaign;

    // Title/desc
    qs('#campaignTitle').textContent = campaign.name || 'Campaign';
    qs('#campaignDesc').textContent = campaign.description || '';

    // Background + header assets
    setBackgroundVideo(campaign.assets?.backgroundVideo || 'assets/bg.mp4');
    renderHeaderStrip(campaign.assets || {});

    // Load data
    const sessionsPayload = await fetchJson(campaign.sessionsPath);
    const mediaPayload = await fetchJson(campaign.mediaPath);

    state.sessions = (sessionsPayload.sessions || []).map(s => ({ ...s, _score: null }));
    state.mediaItems = (mediaPayload.mediaItems || []);

    // Populate districts
    const districts = Array.from(new Set(state.sessions.map(s => (s.district || '').trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
    const districtSelect = qs('#districtSelect');
    districtSelect.innerHTML = `<option value="__all__">All</option>` + districts.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');

    // Update hero badges from totals (overall, not filtered)
    const totalSessions = sessionsPayload.totalSessions ?? state.sessions.length;
    const totalFarmers = sessionsPayload.totalFarmers ?? sum(state.sessions, s=>s.farmers);
    const totalAcres = sessionsPayload.totalAcres ?? sum(state.sessions, s=>s.acres);
    qs('#badgeSessions').textContent = `Sessions: ${fmtInt(totalSessions)}`;
    qs('#badgeFarmers').textContent = `Farmers: ${fmtInt(totalFarmers)}`;
    qs('#badgeAcres').textContent = `Acres: ${fmtInt(totalAcres)}`;
  }

  function wireEvents() {
    qs('#applyBtn')?.addEventListener('click', () => { applyFilters(); renderAll(); });
    qs('#resetBtn')?.addEventListener('click', () => { resetFilters(); applyFilters(); renderAll(); });

    qsa('.chip').forEach(btn => {
      btn.addEventListener('click', () => {
        qsa('.chip').forEach(x=>x.classList.remove('active'));
        btn.classList.add('active');
        state.mediaFilter = btn.getAttribute('data-media-filter') || 'all';
        renderGallery();
      });
    });

    qs('#exportBtn')?.addEventListener('click', exportCsv);
    qs('#drawerCloseBtn')?.addEventListener('click', closeDrawer);
    qs('#backdrop')?.addEventListener('click', closeDrawer);
    qs('#dismissErrorBtn')?.addEventListener('click', hideError);

    qs('#campaignSelect')?.addEventListener('change', async (e) => {
      const id = e.target.value;
      // update URL
      const url = new URL(window.location.href);
      url.searchParams.set('campaign', id);
      history.replaceState({}, '', url.toString());
      try {
        await loadCampaign(id);
        applyFilters();
        renderAll();
      } catch (err) {
        showError(err.message || String(err));
      }
    });
  }

  async function init() {
    wireEvents();

    try {
      const campaignsPayload = await fetchJson('data/campaigns.json');
      state.campaigns = campaignsPayload.campaigns || [];

      const sel = qs('#campaignSelect');
      sel.innerHTML = state.campaigns.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name || c.id)}</option>`).join('');

      const q = parseQuery();
      const initial = state.campaigns.find(c => c.id === q.campaign)?.id || state.campaigns[0]?.id;
      if (!initial) throw new Error('No campaigns found in data/campaigns.json.');

      sel.value = initial;
      await loadCampaign(initial);

      applyFilters();
      renderAll();
    } catch (err) {
      showError(err.message || String(err));
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
