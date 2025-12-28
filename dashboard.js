/* dashboard.js — INTERACT multi-campaign dashboard (v7) */
(() => {
  'use strict';

  // -------------------------
  // Helpers
  // -------------------------
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const fmtInt = (n) => Number.isFinite(n) ? Math.round(n).toLocaleString() : '—';
  const fmtPct = (n, digits = 0) => Number.isFinite(n) ? `${Number(n).toFixed(digits)}%` : '—';
  const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  };

  const normalizePhone = (raw) => String(raw || '')
    .replace(/[^\d+]/g, '')
    .replace(/^0092/, '+92')
    .replace(/^92/, '+92')
    .replace(/^0/, '+92');

  const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
  const isValidPKPhone = (s) => {
    const n = normalizePhone(s);
    // +92 3xx... or +92 2xx... allow 10–12 digits after +92
    return /^\+92\d{9,12}$/.test(n);
  };

  const safeText = (s) => String(s ?? '').trim();
  const urlParams = new URLSearchParams(location.search);

  const SITE_BASE = new URL('.', location.href).toString();

  async function fetchJson(path) {
    const res = await fetch(new URL(path, SITE_BASE), { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch ${path} (${res.status})`);
    return await res.json();
  }

  // -------------------------
  // DOM
  // -------------------------
  const dom = {
    campaignSelect: $('#campaignSelect'),
    headerBrandStrip: $('#headerBrandStrip'),
    footerBrandImages: $('#footerBrandImages'),
    bgVideoSrc: $('#bgVideoSrc'),
    bgVideo: $('#bgVideo'),

    campaignTitle: $('#campaignTitle'),
    campaignSubtitle: $('#campaignSubtitle'),
    campaignDateRange: $('#campaignDateRange'),
    campaignDistricts: $('#campaignDistricts'),
    campaignFarmers: $('#campaignFarmers'),

    districtFilter: $('#districtFilter'),
    searchInput: $('#searchInput'),
    dateFrom: $('#dateFrom'),
    dateTo: $('#dateTo'),
    applyFilters: $('#applyFilters'),
    resetFilters: $('#resetFilters'),
    exportCsv: $('#exportCsv'),

    selectionText: $('#selectionText'),
    selSessions: $('#selSessions'),
    selFarmers: $('#selFarmers'),
    selAcres: $('#selAcres'),
    selScore: $('#selScore'),

    // Donut KPIs
    kpiDefinite: $('#kpiDefinite'),
    kpiAwareness: $('#kpiAwareness'),
    kpiUnderstanding: $('#kpiUnderstanding'),
    kpiCoverage: $('#kpiCoverage'),

    legendIntent: $('#legendIntent'),
    legendAwareness: $('#legendAwareness'),
    legendCoverage: $('#legendCoverage'),

    // Charts
    chartIntent: $('#chartIntent'),
    chartAwareness: $('#chartAwareness'),
    chartUnderstanding: $('#chartUnderstanding'),
    chartCoverage: $('#chartCoverage'),

    // Map
    mapStats: $('#mapStats'),
    fitMap: $('#fitMap'),
    resetMap: $('#resetMap'),

    // Drawer
    drawer: $('#sessionDrawer'),
    drawerClose: $('#drawerClose'),
    drawerKicker: $('#drawerKicker'),
    drawerTitle: $('#drawerTitle'),
    drawerSub: $('#drawerSub'),
    drawerHost: $('#drawerHost'),
    drawerSales: $('#drawerSales'),
    drawerDealer: $('#drawerDealer'),
    drawerCompetitors: $('#drawerCompetitors'),
    drawerFarmers: $('#drawerFarmers'),
    drawerAcres: $('#drawerAcres'),
    drawerDefinite: $('#drawerDefinite'),
    drawerScore: $('#drawerScore'),
    drawerReasonUse: $('#drawerReasonUse'),
    drawerReasonNo: $('#drawerReasonNo'),
    drawerMediaStrip: $('#drawerMediaStrip'),
    drawerShareAll: $('#drawerShareAll'),

    // Sessions list + pagination
    sessionsList: $('#sessionsList'),
    prevPage: $('#prevPage'),
    nextPage: $('#nextPage'),
    pageNow: $('#pageNow'),
    pageTotal: $('#pageTotal'),

    // Gallery / media wall
    mediaWall: $('#mediaWall'),
    galSessions: $('#galSessions'),
    galImages: $('#galImages'),
    galVideos: $('#galVideos'),

    // Modal
    mediaModal: $('#mediaModal'),
    modalBackdrop: $('#modalBackdrop'),
    modalClose: $('#modalClose'),
    modalShare: $('#modalShare'),
    modalKicker: $('#modalKicker'),
    modalTitle: $('#modalTitle'),
    modalBody: $('#modalBody'),

    // Feedback
    feedbackForm: $('#feedbackForm'),
    fbName: $('#fbName'),
    fbEmail: $('#fbEmail'),
    fbPhone: $('#fbPhone'),
    fbMessage: $('#fbMessage'),
    fbError: $('#fbError'),
    fbWhatsApp: $('#fbWhatsApp'),

    sharePage: $('#sharePage')
  };

  // -------------------------
  // State
  // -------------------------
  let campaigns = null;
  let currentCampaign = null;
  let sessionsPayload = null;
  let allSessions = [];
  let filteredSessions = [];

  let map = null;
  let markerCluster = null;
  let markersBySn = new Map();

  let page = 1;
  const PAGE_SIZE = 10;

  let charts = {
    intent: null,
    awareness: null,
    understanding: null,
    coverage: null
  };

  let currentModalMedia = null; // {type, src, title, session}

  // -------------------------
  // Campaign loading
  // -------------------------
  async function init() {
    try {
      campaigns = await fetchJson('data/campaigns.json');
      const campaignList = campaigns.campaigns || [];
      if (!campaignList.length) throw new Error('No campaigns configured');

      // Populate campaign select
      dom.campaignSelect.innerHTML = '';
      for (const c of campaignList) {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        dom.campaignSelect.appendChild(opt);
      }

      const urlCampaign = urlParams.get('campaign');
      const selected = campaignList.find(c => c.id === urlCampaign) || campaignList[0];
      dom.campaignSelect.value = selected.id;

      dom.campaignSelect.addEventListener('change', () => {
        const id = dom.campaignSelect.value;
        const next = campaignList.find(c => c.id === id);
        if (!next) return;
        const u = new URL(location.href);
        u.searchParams.set('campaign', id);
        u.searchParams.delete('media');
        history.replaceState({}, '', u.toString());
        loadCampaign(next).catch(console.error);
      });

      await loadCampaign(selected);

      wireUI();
    } catch (e) {
      console.error(e);
      document.body.innerHTML = `<div style="padding:20px;font-family:system-ui;color:#fff;">
        <h2>Dashboard failed to load</h2>
        <p>${escapeHtml(e.message)}</p>
        <p>Please confirm <code>data/campaigns.json</code> exists and assets are deployed.</p>
      </div>`;
    }
  }

  async function loadCampaign(campaign) {
    currentCampaign = campaign;

    // Header meta
    dom.campaignTitle.textContent = campaign.name || 'Campaign Dashboard';
    dom.campaignSubtitle.textContent = campaign.subtitle || 'Insights, coverage and field media.';
    dom.campaignDateRange.textContent = campaign.dateRange ? `${fmtDate(campaign.dateRange.from)} → ${fmtDate(campaign.dateRange.to)}` : '—';

    // Brand assets (fixed sequence)
    renderBrandStrip(campaign.assets?.headerVideos || []);
    renderFooterBrands(campaign.assets?.brandImages || []);

    // Background video
    if (campaign.assets?.backgroundVideo) {
      dom.bgVideoSrc.src = campaign.assets.backgroundVideo;
      // iOS sometimes needs explicit load()
      dom.bgVideo.load();
      dom.bgVideo.play().catch(() => {});
    }

    // Load sessions
    sessionsPayload = await fetchJson(campaign.sessionsUrl);
    allSessions = (sessionsPayload.sessions || []).slice().sort((a, b) => (a.sn || 0) - (b.sn || 0));

    // Campaign totals display
    const totals = sessionsPayload.totals || {};
    dom.campaignDistricts.textContent = fmtInt(totals.districts);
    dom.campaignFarmers.textContent = fmtInt(totals.farmers);

    // Filters
    setupFilters(campaign, allSessions);

    // Initial filtered set
    page = 1;
    applyFilters();

    // Map init / update
    await ensureMap();
    updateMap();

    // Deep link media or session?
    const deepMedia = urlParams.get('media');
    if (deepMedia) {
      openMediaModal({ type: deepMedia.endsWith('.mp4') ? 'video' : 'image', src: deepMedia, title: 'Shared media', session: null });
    }
  }

  function setupFilters(campaign, sessions) {
    // Districts
    const districts = Array.from(new Set(sessions.map(s => safeText(s.district)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    dom.districtFilter.innerHTML = '';
    const optAll = document.createElement('option');
    optAll.value = 'all';
    optAll.textContent = `All districts (${districts.length})`;
    dom.districtFilter.appendChild(optAll);
    for (const d of districts) {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      dom.districtFilter.appendChild(opt);
    }

    // Dates
    const from = campaign.dateRange?.from || minDateIso(sessions.map(s => s.date));
    const to = campaign.dateRange?.to || maxDateIso(sessions.map(s => s.date));
    dom.dateFrom.value = from || '';
    dom.dateTo.value = to || '';
    dom.dateFrom.max = to || '';
    dom.dateTo.max = to || '';
    dom.dateFrom.min = from || '';
    dom.dateTo.min = from || '';
  }

  function wireUI() {
    dom.applyFilters.addEventListener('click', () => { page = 1; applyFilters(); });
    dom.resetFilters.addEventListener('click', () => {
      dom.districtFilter.value = 'all';
      dom.searchInput.value = '';
      dom.dateFrom.value = currentCampaign?.dateRange?.from || '';
      dom.dateTo.value = currentCampaign?.dateRange?.to || '';
      page = 1;
      applyFilters();
    });

    dom.exportCsv.addEventListener('click', exportFilteredCsv);

    dom.prevPage.addEventListener('click', () => {
      if (page > 1) { page -= 1; renderSessions(); }
    });
    dom.nextPage.addEventListener('click', () => {
      const totalPages = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE));
      if (page < totalPages) { page += 1; renderSessions(); }
    });

    dom.drawerClose.addEventListener('click', closeDrawer);

    dom.fitMap.addEventListener('click', () => fitMapToFiltered());
    dom.resetMap.addEventListener('click', () => resetMapView());

    dom.modalBackdrop.addEventListener('click', closeMediaModal);
    dom.modalClose.addEventListener('click', closeMediaModal);
    dom.modalShare.addEventListener('click', () => shareCurrentModal().catch(console.error));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeMediaModal();
        closeDrawer();
      }
    });

    dom.feedbackForm.addEventListener('submit', (e) => {
      e.preventDefault();
      sendFeedback('email');
    });
    dom.fbWhatsApp.addEventListener('click', () => sendFeedback('whatsapp'));

    dom.sharePage.addEventListener('click', (e) => {
      e.preventDefault();
      shareUrl(location.href, `INTERACT — ${currentCampaign?.name || 'Campaign Dashboard'}`).catch(console.error);
    });
  }

  // -------------------------
  // Filtering + aggregation
  // -------------------------
  function applyFilters() {
    const district = dom.districtFilter.value;
    const q = safeText(dom.searchInput.value).toLowerCase();
    const from = dom.dateFrom.value ? new Date(dom.dateFrom.value) : null;
    const to = dom.dateTo.value ? new Date(dom.dateTo.value) : null;

    filteredSessions = allSessions.filter(s => {
      if (district !== 'all' && safeText(s.district) !== district) return false;

      if (from && s.date) {
        const d = new Date(s.date);
        if (!Number.isNaN(d.getTime()) && d < from) return false;
      }
      if (to && s.date) {
        const d = new Date(s.date);
        if (!Number.isNaN(d.getTime())) {
          const end = new Date(to); end.setHours(23, 59, 59, 999);
          if (d > end) return false;
        }
      }

      if (q) {
        const hay = [
          s.location, s.village, s.district,
          s.sessionRef,
          s.host?.name, s.dealer?.name, s.salesRep?.name,
          s.insights?.competitorsMentioned
        ].map(x => safeText(x).toLowerCase()).join(' | ');
        if (!hay.includes(q)) return false;
      }

      return true;
    });

    updateSelectionSummary();
    renderDonuts();
    renderSessions();
    renderMediaWall();
    updateMap();
  }

  function updateSelectionSummary() {
    const district = dom.districtFilter.value;
    const from = dom.dateFrom.value;
    const to = dom.dateTo.value;

    const districts = Array.from(new Set(filteredSessions.map(s => safeText(s.district)).filter(Boolean))).length;
    const farmers = sum(filteredSessions, s => s.metrics?.farmers || 0);
    const acres = sum(filteredSessions, s => s.metrics?.wheatAcres || 0);
    const scoreAvg = avg(filteredSessions, s => s.metrics?.sessionScore);

    const minD = minDateIso(filteredSessions.map(s => s.date));
    const maxD = maxDateIso(filteredSessions.map(s => s.date));

    const districtLabel = (district === 'all') ? `All districts (${districts})` : district;
    const dateLabel = (minD && maxD) ? `${fmtDate(minD)} → ${fmtDate(maxD)}` : (from && to ? `${fmtDate(from)} → ${fmtDate(to)}` : 'All dates');

    dom.selectionText.textContent = `${districtLabel} • ${dateLabel}`;

    dom.selSessions.textContent = fmtInt(filteredSessions.length);
    dom.selFarmers.textContent = fmtInt(farmers);
    dom.selAcres.textContent = fmtInt(acres);
    dom.selScore.textContent = Number.isFinite(scoreAvg) ? scoreAvg.toFixed(1) : '—';
  }

  // -------------------------
  // Donut charts (Chart.js)
  // -------------------------
  function ensureCharts() {
    const centerTextPlugin = {
      id: 'centerText',
      afterDraw(chart, args, opts) {
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        const text = opts?.text;
        if (!text) return;

        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = '800 18px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const x = (chartArea.left + chartArea.right) / 2;
        const y = (chartArea.top + chartArea.bottom) / 2;
        ctx.fillText(text, x, y);
        ctx.restore();
      }
    };

    Chart.register(centerTextPlugin);

    const baseOptions = (centerText) => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed;
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total ? (100 * v / total) : 0;
              return `${ctx.label}: ${fmtInt(v)} (${pct.toFixed(1)}%)`;
            }
          }
        },
        centerText: { text: centerText }
      }
    });

    const mk = (el, labels, data, centerText) => new Chart(el.getContext('2d'), {
      type: 'doughnut',
      data: { labels, datasets: [{ data }] },
      options: baseOptions(centerText)
    });

    // Create empty charts if missing (first run)
    if (!charts.intent) charts.intent = mk(dom.chartIntent, ['Definite', 'Maybe', 'Not interested'], [0, 0, 0], '—%');
    if (!charts.awareness) charts.awareness = mk(dom.chartAwareness, ['Know Buctril', 'Not aware'], [0, 0], '—%');
    if (!charts.understanding) charts.understanding = mk(dom.chartUnderstanding, ['Understood', 'Gap'], [0, 0], '—');
    if (!charts.coverage) charts.coverage = mk(dom.chartCoverage, ['Estimated Buctril acres', 'Other wheat acres'], [0, 0], '—');
  }

  function renderDonuts() {
    ensureCharts();

    const farmers = sum(filteredSessions, s => s.metrics?.farmers || 0);
    const wheatAcres = sum(filteredSessions, s => s.metrics?.wheatAcres || 0);
    const est = sum(filteredSessions, s => s.metrics?.estimatedBuctrilAcres || 0);

    const definite = sum(filteredSessions, s => s.metrics?.definite || 0);
    const maybe = sum(filteredSessions, s => s.metrics?.maybe || 0);
    const notInterested = sum(filteredSessions, s => s.metrics?.notInterested || 0);

    const aware = sum(filteredSessions, s => s.metrics?.knowBuctril || 0);
    const notAware = Math.max(0, farmers - aware);

    const understandingAvg = avg(filteredSessions, s => s.metrics?.understanding?.avg);
    const understood = Number.isFinite(understandingAvg) ? understandingAvg : 0;
    const gap = Math.max(0, 3 - understood);

    const definitePct = farmers ? (100 * definite / farmers) : 0;
    const awarePct = farmers ? (100 * aware / farmers) : 0;

    dom.kpiDefinite.textContent = fmtPct(definitePct, 0);
    dom.kpiAwareness.textContent = fmtPct(awarePct, 0);
    dom.kpiUnderstanding.textContent = Number.isFinite(understandingAvg) ? `${understandingAvg.toFixed(1)}/3` : '—/3';
    dom.kpiCoverage.textContent = fmtInt(wheatAcres);

    // Update charts
    updateChart(charts.intent, ['Definite', 'Maybe', 'Not interested'], [definite, maybe, notInterested], `${definitePct.toFixed(0)}%`);
    updateChart(charts.awareness, ['Know Buctril', 'Not aware'], [aware, notAware], `${awarePct.toFixed(0)}%`);
    updateChart(charts.understanding, ['Understood', 'Gap'], [understood, gap], Number.isFinite(understandingAvg) ? understandingAvg.toFixed(1) : '—');

    const otherAcres = Math.max(0, wheatAcres - est);
    updateChart(charts.coverage, ['Estimated Buctril acres', 'Other wheat acres'], [est, otherAcres], `${wheatAcres ? (100 * est / wheatAcres).toFixed(0) : 0}%`);

    dom.legendIntent.innerHTML = legendHtml([
      { label: 'Definite', value: definite },
      { label: 'Maybe', value: maybe },
      { label: 'Not interested', value: notInterested }
    ]);

    dom.legendAwareness.innerHTML = legendHtml([
      { label: 'Know Buctril', value: aware },
      { label: 'Not aware', value: notAware }
    ]);

    dom.legendCoverage.innerHTML = legendHtml([
      { label: 'Estimated Buctril acres', value: est },
      { label: 'Other wheat acres', value: otherAcres }
    ]);
  }

  function updateChart(chart, labels, data, centerText) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data.map(x => Number.isFinite(x) ? x : 0);
    chart.options.plugins.centerText.text = centerText;
    chart.update();
  }

  function legendHtml(items) {
    return `<div class="legend">${items.map(it =>
      `<div class="legend-item"><span class="dot"></span><span>${escapeHtml(it.label)}</span><span class="val">${fmtInt(it.value)}</span></div>`
    ).join('')}</div>`;
  }

  // -------------------------
  // Map
  // -------------------------
  async function ensureMap() {
    if (map) return;

    map = L.map('campaignMap', {
      zoomControl: true,
      attributionControl: false
    });

    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    });
    tiles.addTo(map);

    markerCluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 44
    });
    markerCluster.addTo(map);

    // Default view (Pakistan region)
    map.setView([29.5, 70.5], 6);
  }

  function updateMap() {
    if (!map || !markerCluster) return;

    markerCluster.clearLayers();
    markersBySn.clear();

    const points = filteredSessions
      .map(s => ({ s, lat: s.coords?.lat, lng: s.coords?.lng }))
      .filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lng));

    for (const p of points) {
      const m = L.marker([p.lat, p.lng], { title: `Session ${p.s.sn}` });
      m.on('click', () => openDrawer(p.s));
      markerCluster.addLayer(m);
      markersBySn.set(p.s.sn, m);
    }

    dom.mapStats.textContent = `${fmtInt(points.length)} session spots shown`;

    // Fit bounds to points if filtering significantly reduces set
    if (points.length) {
      fitMapToFiltered(false);
    }
  }

  function fitMapToFiltered(animate = true) {
    const pts = filteredSessions
      .map(s => [s.coords?.lat, s.coords?.lng])
      .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));

    if (!pts.length) return;
    const bounds = L.latLngBounds(pts);
    map.fitBounds(bounds.pad(0.12), { animate });
  }

  function resetMapView() {
    map.setView([29.5, 70.5], 6, { animate: true });
    closeDrawer();
  }

  // -------------------------
  // Drawer (session profile)
  // -------------------------
  function openDrawer(session) {
    dom.drawer.setAttribute('aria-hidden', 'false');

    dom.drawerKicker.textContent = `Session ${session.sn} • ${safeText(session.sessionRef)}`;
    dom.drawerTitle.textContent = `${safeText(session.location) || 'Location'}`;
    dom.drawerSub.textContent = `${safeText(session.district)} • ${fmtDate(session.date)}`;

    dom.drawerHost.textContent = formatPerson(session.host);
    dom.drawerSales.textContent = formatPerson(session.salesRep);
    dom.drawerDealer.textContent = formatPerson(session.dealer);
    dom.drawerCompetitors.textContent = safeText(session.insights?.competitorsMentioned) || '—';

    dom.drawerFarmers.textContent = fmtInt(session.metrics?.farmers || 0);
    dom.drawerAcres.textContent = fmtInt(session.metrics?.wheatAcres || 0);
    dom.drawerDefinite.textContent = fmtPct(session.metrics?.rates?.definite ?? 0, 0);
    dom.drawerScore.textContent = Number.isFinite(session.metrics?.sessionScore) ? session.metrics.sessionScore.toFixed(1) : '—';

    dom.drawerReasonUse.textContent = safeText(session.insights?.topReasonToUse) || '—';
    dom.drawerReasonNo.textContent = safeText(session.insights?.topReasonNotToUse) || '—';

    renderDrawerMedia(session);
    // On mobile, scroll to drawer
    if (window.innerWidth <= 1060) dom.drawer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeDrawer() {
    dom.drawer.setAttribute('aria-hidden', 'true');
  }

  function formatPerson(p) {
    const name = safeText(p?.name);
    const phone = safeText(p?.phone);
    if (!name && !phone) return '—';
    if (phone) return `${name || '—'} (${phone})`;
    return name;
  }

  function renderDrawerMedia(session) {
    dom.drawerMediaStrip.innerHTML = '';

    const media = getSessionMedia(session);
    const items = [...media.images.slice(0, 4).map(src => ({ type: 'image', src })), ...media.videos.slice(0, 2).map(src => ({ type: 'video', src }))];

    if (!items.length) {
      dom.drawerMediaStrip.innerHTML = `<div style="color:rgba(255,255,255,0.65); font-size:13px; padding:8px 0;">No media found for this session in assets/gallery/</div>`;
      dom.drawerShareAll.disabled = true;
      return;
    }
    dom.drawerShareAll.disabled = false;
    dom.drawerShareAll.onclick = () => shareUrl(buildShareUrlForSession(session), `Session ${session.sn} — ${currentCampaign?.name || 'Campaign'}`).catch(console.error);

    for (const it of items) {
      const el = document.createElement('div');
      el.className = 'media-thumb';
      if (it.type === 'video') {
        el.innerHTML = `<video muted playsinline preload="metadata"><source src="${escapeAttr(it.src)}" type="video/mp4"></video><div class="play"><i class="fa-solid fa-play"></i></div>`;
      } else {
        el.innerHTML = `<img loading="lazy" src="${escapeAttr(it.src)}" alt="Session media" />`;
      }
      el.addEventListener('click', () => openMediaModal({ type: it.type, src: it.src, title: `Session ${session.sn} • ${session.district}`, session }));
      dom.drawerMediaStrip.appendChild(el);
    }
  }

  // -------------------------
  // Sessions list
  // -------------------------
  function renderSessions() {
    const totalPages = Math.max(1, Math.ceil(filteredSessions.length / PAGE_SIZE));
    page = clamp(page, 1, totalPages);

    dom.pageNow.textContent = String(page);
    dom.pageTotal.textContent = String(totalPages);

    dom.prevPage.disabled = page <= 1;
    dom.nextPage.disabled = page >= totalPages;

    const start = (page - 1) * PAGE_SIZE;
    const slice = filteredSessions.slice(start, start + PAGE_SIZE);

    dom.sessionsList.innerHTML = '';
    if (!slice.length) {
      dom.sessionsList.innerHTML = `<div style="padding:16px;color:rgba(255,255,255,0.72)">No sessions match the current filters.</div>`;
      return;
    }

    for (const s of slice) {
      const card = document.createElement('article');
      card.className = 'session-card';

      const definite = s.metrics?.rates?.definite ?? 0;
      const aware = s.metrics?.rates?.awareness ?? 0;
      const score = s.metrics?.sessionScore;

      card.innerHTML = `
        <div class="session-head">
          <div>
            <div class="session-title">Session ${escapeHtml(s.sn)} • ${escapeHtml(s.district)}</div>
            <div class="session-sub">${escapeHtml(s.location)} • ${escapeHtml(fmtDate(s.date))}</div>
          </div>
          <div class="session-badges">
            <span class="pill"><i class="fa-solid fa-users"></i> ${fmtInt(s.metrics?.farmers || 0)}</span>
            <span class="pill"><i class="fa-solid fa-seedling"></i> ${fmtInt(s.metrics?.wheatAcres || 0)} acres</span>
          </div>
        </div>

        <div class="session-badges">
          <span class="pill">Awareness: ${fmtPct(aware, 0)}</span>
          <span class="pill">Definite: ${fmtPct(definite, 0)}</span>
          <span class="pill">Score: ${Number.isFinite(score) ? score.toFixed(1) : '—'}</span>
        </div>

        <div class="session-actions">
          <button class="btn ghost small" data-act="map"><i class="fa-solid fa-map-location-dot"></i> View on map</button>
          <button class="btn primary small" data-act="open"><i class="fa-solid fa-id-card"></i> Open session</button>
          <button class="btn secondary small" data-act="media"><i class="fa-solid fa-photo-film"></i> Media</button>
        </div>
      `;

      $('[data-act="map"]', card).addEventListener('click', () => {
        const m = markersBySn.get(s.sn);
        if (m) {
          map.setView(m.getLatLng(), 12, { animate: true });
          m.fire('click');
        } else {
          openDrawer(s);
        }
      });

      $('[data-act="open"]', card).addEventListener('click', () => openDrawer(s));
      $('[data-act="media"]', card).addEventListener('click', () => {
        // Open first available media for the session
        const media = getSessionMedia(s);
        const src = media.videos[0] || media.images[0];
        if (!src) return openDrawer(s);
        openMediaModal({ type: src.endsWith('.mp4') ? 'video' : 'image', src, title: `Session ${s.sn} media`, session: s });
      });

      dom.sessionsList.appendChild(card);
    }
  }

  // -------------------------
  // Media wall (animated overlap)
  // -------------------------
  function getSessionMedia(session) {
    const images = (session.media?.images || []).filter(p => String(p).includes('assets/gallery/'));
    const videos = (session.media?.videos || []).filter(p => String(p).includes('assets/gallery/'));

    // Always keep primary first
    return {
      images: images.filter(Boolean),
      videos: videos.filter(Boolean)
    };
  }

  function renderMediaWall() {
    dom.mediaWall.innerHTML = '';

    const mediaBySession = filteredSessions.map(s => {
      const media = getSessionMedia(s);
      const primaryImg = media.images[0] || currentCampaign?.assets?.placeholder || 'assets/placeholder.svg';
      const altImg = media.images[1] || null;
      const primaryVid = media.videos[0] || null;
      return { session: s, primaryImg, altImg, primaryVid, media };
    });

    const totalImgs = sum(mediaBySession, x => x.media.images.length);
    const totalVids = sum(mediaBySession, x => x.media.videos.length);

    dom.galSessions.textContent = fmtInt(mediaBySession.length);
    dom.galImages.textContent = fmtInt(totalImgs);
    dom.galVideos.textContent = fmtInt(totalVids);

    if (!mediaBySession.length) {
      dom.mediaWall.innerHTML = `<div style="padding:16px;color:rgba(255,255,255,0.72)">No media to show for the current filters.</div>`;
      return;
    }

    for (const item of mediaBySession) {
      const s = item.session;
      const card = document.createElement('article');
      card.className = 'media-card';

      const shareBtn = document.createElement('button');
      shareBtn.className = 'sharebtn';
      shareBtn.type = 'button';
      shareBtn.innerHTML = `<i class="fa-solid fa-share-nodes"></i>`;
      shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const u = buildShareUrlForSession(s);
        shareUrl(u, `Session ${s.sn} — ${currentCampaign?.name || 'Campaign'}`).catch(console.error);
      });

      card.innerHTML = `
        <div class="media-stage">
          <img class="base" loading="lazy" src="${escapeAttr(item.primaryImg)}" alt="Session ${escapeHtml(s.sn)} media" />
          ${item.altImg ? `<img class="alt" loading="lazy" src="${escapeAttr(item.altImg)}" alt="" />` : ``}
          ${item.primaryVid ? `<video muted playsinline preload="metadata"><source src="${escapeAttr(item.primaryVid)}" type="video/mp4"></video>` : ``}
          <div class="badgebar">
            <span class="badgechip">Session ${escapeHtml(s.sn)}</span>
            <span class="badgechip">${escapeHtml(s.district || '—')}</span>
          </div>
          ${item.primaryVid ? `<div class="playhint" aria-hidden="true"><i class="fa-solid fa-play"></i></div>` : ``}
        </div>
        <div class="media-meta">
          <div class="media-title">${escapeHtml(s.location || 'Field session')}</div>
          <div class="media-sub">${escapeHtml(fmtDate(s.date))} • Farmers: ${fmtInt(s.metrics?.farmers || 0)} • Score: ${Number.isFinite(s.metrics?.sessionScore) ? s.metrics.sessionScore.toFixed(1) : '—'}</div>
        </div>
      `;
      card.appendChild(shareBtn);

      // If video exists, start/stop on hover for desktop; for mobile, toggle on tap inside modal only
      const vid = $('video', card);
      if (vid) {
        card.addEventListener('mouseenter', () => { vid.play().catch(() => {}); });
        card.addEventListener('mouseleave', () => { try { vid.pause(); vid.currentTime = 0; } catch {} });
      }

      // Handle missing images gracefully
      const imgs = $$('img', card);
      imgs.forEach(img => {
        img.addEventListener('error', () => { img.style.display = 'none'; });
      });

      // Click opens modal with gallery for the session
      card.addEventListener('click', () => openMediaModalForSession(s));

      dom.mediaWall.appendChild(card);
    }
  }

  function openMediaModalForSession(session) {
    const media = getSessionMedia(session);
    const items = [...media.images.map(src => ({ type: 'image', src })), ...media.videos.map(src => ({ type: 'video', src }))];
    if (!items.length) return openDrawer(session);

    // Prefer video first (more engaging), otherwise image
    const first = items.find(i => i.type === 'video') || items[0];
    openMediaModal({ type: first.type, src: first.src, title: `Session ${session.sn} • ${session.district}`, session, all: items });
  }

  // -------------------------
  // Modal + sharing
  // -------------------------
  function openMediaModal(media) {
    currentModalMedia = media;

    dom.mediaModal.setAttribute('aria-hidden', 'false');
    dom.modalKicker.textContent = media.session ? `Session ${media.session.sn}` : 'Media';
    dom.modalTitle.textContent = media.title || 'Media';

    const items = media.all || [media];
    const gridClass = (items.length === 1) ? 'modal-grid single' : 'modal-grid';

    dom.modalBody.innerHTML = `
      <div class="${gridClass}">
        ${items.map(it => it.type === 'video'
          ? `<video controls playsinline preload="metadata"><source src="${escapeAttr(it.src)}" type="video/mp4"></video>`
          : `<img loading="lazy" src="${escapeAttr(it.src)}" alt="Media" />`
        ).join('')}
      </div>
      ${media.session ? modalSessionNote(media.session) : ''}
    `;

    // Make sure any videos are paused when closing
    dom.modalBody.scrollTop = 0;
  }

  function modalSessionNote(session) {
    const m = session.metrics || {};
    return `
      <div style="margin-top:12px; color:rgba(255,255,255,0.72); font-size:13px;">
        <strong>Session profile:</strong>
        ${escapeHtml(session.district)} • ${escapeHtml(fmtDate(session.date))} • Farmers ${fmtInt(m.farmers || 0)} • Definite ${fmtPct(m.rates?.definite ?? 0, 0)} • Score ${Number.isFinite(m.sessionScore) ? m.sessionScore.toFixed(1) : '—'}.
      </div>
    `;
  }

  function closeMediaModal() {
    if (dom.mediaModal.getAttribute('aria-hidden') === 'true') return;
    dom.mediaModal.setAttribute('aria-hidden', 'true');
    // Pause any videos
    $$('video', dom.modalBody).forEach(v => { try { v.pause(); } catch {} });
    dom.modalBody.innerHTML = '';
    currentModalMedia = null;
  }

  function buildShareUrlForSession(session) {
    const media = getSessionMedia(session);
    const src = media.videos[0] || media.images[0];
    const u = new URL(location.href);
    u.searchParams.set('campaign', currentCampaign?.id || 'campaign');
    if (src) u.searchParams.set('media', src);
    return u.toString();
  }

  async function shareCurrentModal() {
    if (!currentModalMedia) return;

    // Prefer sharing the specific media file when supported; otherwise share the link.
    const u = currentModalMedia.session ? buildShareUrlForSession(currentModalMedia.session) : location.href;
    const title = currentModalMedia.title || 'Media';

    // Try Web Share with file (works on many mobile browsers)
    if (navigator.share && currentModalMedia.src && currentModalMedia.src.startsWith('assets/')) {
      try {
        const abs = new URL(currentModalMedia.src, SITE_BASE).toString();
        const blob = await fetch(abs).then(r => r.blob());
        const ext = currentModalMedia.src.split('.').pop().toLowerCase();
        const mime = currentModalMedia.type === 'video' ? 'video/mp4' : (ext === 'png' ? 'image/png' : 'image/jpeg');
        const file = new File([blob], currentModalMedia.src.split('/').pop(), { type: mime });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ title, text: 'Shared from INTERACT dashboard', files: [file] });
          return;
        }
      } catch {
        // fall back to URL
      }
    }

    await shareUrl(u, title);
  }

  async function shareUrl(url, title) {
    if (navigator.share) {
      await navigator.share({ title, text: title, url });
      return;
    }
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied to clipboard');
    } catch {
      prompt('Copy this link:', url);
    }
  }

  // -------------------------
  // Brand strip rendering (fixed order)
  // -------------------------
  function renderBrandStrip(items) {
    dom.headerBrandStrip.innerHTML = '';
    const ordered = items.slice(0, 4);

    for (const it of ordered) {
      const clip = document.createElement('div');
      clip.className = 'brand-clip';

      const video = document.createElement('video');
      video.muted = true;
      video.autoplay = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.src = it.src;

      const img = document.createElement('img');
      img.src = it.fallback || (currentCampaign?.assets?.placeholder || 'assets/placeholder.svg');
      img.alt = it.label || 'Brand';

      // If video fails (iOS autoplay restrictions), show fallback image
      video.addEventListener('error', () => { video.remove(); });
      video.addEventListener('loadeddata', () => {
        // Attempt play; if blocked, keep fallback image visible
        video.play().catch(() => {});
      });

      clip.appendChild(video);
      clip.appendChild(img);

      // Hide fallback image once video is playing (best-effort)
      const hideFallback = () => { img.style.opacity = '0'; img.style.transition = 'opacity .25s ease'; };
      video.addEventListener('playing', hideFallback);

      const label = document.createElement('div');
      label.className = 'brand-label';
      label.textContent = it.label || '';
      clip.appendChild(label);

      dom.headerBrandStrip.appendChild(clip);
    }
  }

  function renderFooterBrands(items) {
    dom.footerBrandImages.innerHTML = '';
    for (const it of items.slice(0, 6)) {
      const img = document.createElement('img');
      img.src = it.src;
      img.alt = it.label || 'Brand';
      img.loading = 'lazy';
      img.addEventListener('error', () => { img.style.display = 'none'; });
      dom.footerBrandImages.appendChild(img);
    }
  }

  // -------------------------
  // Feedback
  // -------------------------
  function sendFeedback(channel) {
    dom.fbError.textContent = '';

    const name = safeText(dom.fbName.value);
    const email = safeText(dom.fbEmail.value);
    const phone = safeText(dom.fbPhone.value);
    const msg = safeText(dom.fbMessage.value);

    if (!msg || msg.length < 8) {
      dom.fbError.textContent = ' Please add a short message (8+ characters).';
      return;
    }

    const hasEmail = email && isValidEmail(email);
    const hasPhone = phone && isValidPKPhone(phone);

    if (!hasEmail && !hasPhone) {
      dom.fbError.textContent = ' Please provide a valid email or a valid Pakistani phone number.';
      return;
    }

    const district = dom.districtFilter.value;
    const dateFrom = dom.dateFrom.value;
    const dateTo = dom.dateTo.value;

    const selection = `Campaign: ${currentCampaign?.name || ''}\nSelection: ${district} | ${dateFrom} to ${dateTo}\nSessions shown: ${filteredSessions.length}\n`;
    const contact = `\nFrom:\nName: ${name || '-'}\nEmail: ${email || '-'}\nPhone: ${phone || '-'}\n\nMessage:\n${msg}\n\n`;
    const body = selection + contact + `Sent via INTERACT dashboard (${location.href})\n`;

    if (channel === 'whatsapp') {
      const waNumber = normalizePhone(campaigns?.agency?.whatsapp || '+923303570463').replace('+', '');
      const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(body)}`;
      window.open(waUrl, '_blank', 'noopener');
      return;
    }

    const to = campaigns?.agency?.email || 'interact@paksaf.com';
    const subject = `Dashboard Feedback — ${currentCampaign?.id || 'campaign'}`;
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }

  // -------------------------
  // CSV export
  // -------------------------
  function exportFilteredCsv() {
    if (!filteredSessions.length) return;

    const headers = [
      'sn', 'sessionRef', 'date', 'district', 'location',
      'farmers', 'wheatAcres', 'awarenessRate', 'definiteRate', 'sessionScore',
      'host', 'hostContact', 'salesRep', 'salesContact', 'dealer', 'dealerContact',
      'competitorsMentioned'
    ];

    const lines = [headers.join(',')];
    for (const s of filteredSessions) {
      const m = s.metrics || {};
      const r = m.rates || {};
      const row = [
        s.sn, q(s.sessionRef), q(s.date), q(s.district), q(s.location),
        m.farmers ?? 0, m.wheatAcres ?? 0, r.awareness ?? 0, r.definite ?? 0, m.sessionScore ?? '',
        q(s.host?.name), q(s.host?.phone), q(s.salesRep?.name), q(s.salesRep?.phone), q(s.dealer?.name), q(s.dealer?.phone),
        q(s.insights?.competitorsMentioned)
      ];
      lines.push(row.join(','));
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${currentCampaign?.id || 'campaign'}_filtered_sessions.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function q(v) {
    const s = String(v ?? '');
    const escaped = s.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  // -------------------------
  // Utilities
  // -------------------------
  function sum(arr, fn) {
    return arr.reduce((acc, x) => acc + (Number(fn(x)) || 0), 0);
  }

  function avg(arr, fn) {
    const vals = arr.map(fn).filter(v => Number.isFinite(v));
    if (!vals.length) return NaN;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function minDateIso(list) {
    const ds = list.map(x => new Date(x)).filter(d => !Number.isNaN(d.getTime()));
    if (!ds.length) return null;
    ds.sort((a, b) => a - b);
    return ds[0].toISOString().slice(0, 10);
  }

  function maxDateIso(list) {
    const ds = list.map(x => new Date(x)).filter(d => !Number.isNaN(d.getTime()));
    if (!ds.length) return null;
    ds.sort((a, b) => a - b);
    return ds[ds.length - 1].toISOString().slice(0, 10);
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  function escapeAttr(str) { return escapeHtml(str).replace(/"/g, '&quot;'); }

  function toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);padding:10px 12px;border-radius:999px;background:rgba(0,0,0,0.72);border:1px solid rgba(255,255,255,0.16);color:#fff;font-family:system-ui;z-index:80;box-shadow:0 12px 40px rgba(0,0,0,0.35)";
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .25s ease'; }, 1400);
    setTimeout(() => t.remove(), 1750);
  }

  // -------------------------
  // Kick off
  // -------------------------
  document.addEventListener('DOMContentLoaded', init);
})();
