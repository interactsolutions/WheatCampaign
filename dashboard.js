(() => {
  'use strict';

  // ---------- Helper: Fetch with retry (network resilience) ----------
  async function fetchWithRetry(url, attempts = 3, timeout = 5000) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
        clearTimeout(timer);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (err) {
        clearTimeout(timer);
        if (attempt === attempts) {
          setStatus(`Failed to load data from ${url}`);
          throw err;
        }
        console.warn(`Fetch attempt ${attempt} for ${url} failed; retrying...`);
      }
    }
  }

  // ---------- DOM helpers ----------
  const $$ = (sel, root = document) => root.querySelector(sel);
  const $$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function htmlEscape(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- URL and status handling ----------
  function getHash() {
    return (window.location.hash || '#summary').replace('#', '').trim();
  }
  function activeTabFromHash() {
    const h = getHash();
    if (!h) return 'summary';
    // Support deep-links like #session-<id>
    if (h.startsWith('session-')) return 'sessions';
    if (['summary','map','sessions','media','feedback'].includes(h)) return h;
    return 'summary';
  }
  function setHashSilently(tab) {
    shouldIgnoreHashChange = true;
    window.location.hash = tab ? '#' + tab : '';
    setTimeout(() => { shouldIgnoreHashChange = false; }, 0);
  }
  let shouldIgnoreHashChange = false;
  window.addEventListener('hashchange', () => {
    if (shouldIgnoreHashChange) return;
    showTab(activeTabFromHash());
  });

  // ---------- Global state ----------
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
    nameFilter: '',
    cityFilter: '',
    regionFilter: '',
    districtFilter: '',
    scoreMin: null,
    scoreMax: null,
    mediaType: 'all',
    mediaSearch: '',
    mediaSort: 'newest',
    _mediaBound: false
  };

  // ---------- Parsing / formatting helpers ----------
  function parseDateSafe(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    const s = String(v).trim();
    // Prefer YYYY-MM-DD format
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    // Fallback to Date.parse
    const t = Date.parse(s);
    if (Number.isFinite(t)) return new Date(t);
    return null;
  }
  function formatDate(dt) {
    if (!(dt instanceof Date)) return '';
    return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function formatPercent(num) {
    if (num == null || isNaN(num)) return '—';
    return (num * 100).toFixed(1) + '%';
  }

  // ---------- Media path resolution ----------
  const existsCache = new Map();
  async function assetExists(relOrAbs) {
    const u = /^(https?:|data:|blob:)/i.test(relOrAbs) ? relOrAbs : relOrAbs;
    if (existsCache.has(u)) return existsCache.get(u);
    try {
      // Try HEAD request to see if asset exists (no-cache to avoid CDN)
      const r = await fetch(u, { method: 'HEAD', cache: 'no-store' });
      const ok = r.ok;
      existsCache.set(u, ok);
      return ok;
    } catch {
      // Try requesting first byte (Range) if HEAD failed (some servers don't support HEAD)
      try {
        const r = await fetch(u, {
          method: 'GET',
          headers: { Range: 'bytes=0-0' },
          cache: 'no-store'
        });
        const ok = r.status === 206 || r.status === 200;
        existsCache.set(u, ok);
        return ok;
      } catch {
        existsCache.set(u, false);
        return false;
      }
    }
  }

  function normalizeMediaPath(p) {
    const raw = String(p ?? '').trim();
    if (!raw) return '';
    if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
    let x = raw.replace(/^\.?\//, '').replace(/^\//, '');
    // Common patterns from sessions data
    if (x.startsWith('assets/')) x = x.slice('assets/'.length);
    if (x.startsWith('gallery/')) return 'assets/gallery/' + x.slice('gallery/'.length);
    if (!x.includes('/')) return 'assets/gallery/' + x;
    return 'assets/' + x;
  }

  function candidatePaths(p) {
    const raw = String(p ?? '').trim();
    const norm = normalizeMediaPath(raw);
    if (!norm) return [];
    if (/^(https?:|data:|blob:)/i.test(norm)) return [norm];
    const candidates = [norm];
    if (!norm.startsWith('assets/') && !norm.startsWith('assets/gallery/')) {
      candidates.push('assets/' + norm);
    }
    const fname = norm.split('/').pop();
    if (fname) candidates.push('assets/gallery/' + fname);
    // Ensure unique candidates
    return candidates.filter((v, i, a) => a.indexOf(v) === i);
  }

  async function attachSmartImage(imgEl, path) {
    let cancelled = false;
    const placeholder = 'assets/placeholder.svg';
    const cands = candidatePaths(path).map(p => p);
    let i = 0;
    const tryNext = () => {
      if (cancelled) return;
      if (i >= cands.length) {
        imgEl.src = placeholder;
        return;
      }
      const src = cands[i++];
      imgEl.src = src;
      // When image loads or errors, decide next steps
      imgEl.onload = () => { /* loaded successfully */ };
      imgEl.onerror = () => { tryNext(); };
    };
    // Start with placeholder until real image is loaded
    imgEl.src = placeholder;
    try {
      // If any candidate path exists on the server, load it (to avoid 404 flash)
      for (const cand of cands) {
        if (await assetExists(cand)) {
          imgEl.src = cand;
          return;
        }
      }
    } catch (e) {
      // ignore any errors
    }
    tryNext();
    return () => { cancelled = true; };
  }

  // ---------- State initialization and data loading ----------
  const heroVideo = document.getElementById('heroVideo');
  const heroTitle = document.getElementById('heroTitle');
  const heroSub = document.getElementById('heroSub');
  const thumbs = document.getElementById('heroThumbs');
  const prevBtn = document.getElementById('heroPrev');
  const nextBtn = document.getElementById('heroNext');
  const heroTapHint = document.getElementById('heroTapHint');

  async function loadCampaignData(campaignId) {
    setStatus('Loading campaign data...');
    const base = `data/${campaignId}/`;
    try {
      // Load all relevant JSON files for the campaign in parallel
      const [summary, sessions, farmers, media, extras, people, sheetsIndex] = await Promise.all([
        fetchWithRetry(base + 'summary.json'),
        fetchWithRetry(base + 'sessions.json'),
        fetchWithRetry(base + 'farmers.json'),
        fetchWithRetry(base + 'media.json'),
        fetchWithRetry(base + 'extras.json'),
        fetchWithRetry(base + 'people.json'),
        fetchWithRetry(base + 'sheets_index.json')
      ]);
      // Save data to state
      state.campaign = summary;
      state.sessions = sessions;
      state.sessionsById = new Map(sessions.map(s => [s.id, s]));
      state.dateMin = parseDateSafe(summary.startDate);
      state.dateMax = parseDateSafe(summary.endDate);
      state.farmers = farmers;
      state.mediaCfg = media;
      state.extras = extras;
      state.people = people;
      state.sheetsIndex = sheetsIndex;
      // Populate UI with loaded data
      populateSummary();
      populateSessionsTable();
      initMap();
      initMediaTab();
      initHeroSequence();
      setStatus(''); // clear status
    } catch (e) {
      console.error('Data loading error:', e);
      setStatus('Error loading campaign data');
    }
  }

  function setStatus(msg) {
    const statusEl = $$('.statusMsg') || document.body;
    if (!msg) {
      statusEl.textContent = '';
      statusEl.style.display = 'none';
    } else {
      statusEl.textContent = msg;
      statusEl.style.display = 'block';
    }
  }

  // ---------- Hero sequence (header carousel) ----------
  function initHeroSequence() {
    heroVideo.muted = true;
    heroVideo.playsInline = true;
    heroVideo.setAttribute('playsinline', '');
    heroVideo.loop = false; // crucial for sequential playback

    const cfg = state.mediaCfg;
    const items = Array.isArray(cfg?.headerSequence) ? cfg.headerSequence : [];
    if (!items.length) {
      // No hero sequence defined
      return;
    }

    // Populate hero thumbnails
    thumbs.innerHTML = '';
    items.forEach((it, idx) => {
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = it.label || `Item ${idx+1}`;
      img.addEventListener('click', () => selectHero(idx, true));
      thumbs.appendChild(img);
      attachSmartImage(img, it.poster || 'assets/placeholder.svg');
    });

    let currentIdx = 0;
    let timerId = null;
    let safetyTimerId = null;

    function selectHero(index, userInitiated) {
      // Clear any existing timers
      if (timerId) clearTimeout(timerId);
      if (safetyTimerId) clearTimeout(safetyTimerId);

      // Compute index in valid range
      currentIdx = (index + items.length) % items.length;
      // Update thumbnail highlights
      $$$('.heroThumbs img').forEach((el, idx) => {
        if (idx === currentIdx) el.classList.add('is-active');
        else el.classList.remove('is-active');
      });
      // Update hero caption text
      const it = items[currentIdx];
      if (heroTitle) heroTitle.textContent = it.label || '';
      if (heroSub) heroSub.textContent = it.sub || '';
      // Prepare next video
      const chosen = it.video || it.poster || '';
      // If user clicked a thumb or arrow, stop autoplay progression
      const autoplay = !userInitiated;
      try {
        heroVideo.src = chosen;
        heroVideo.play().catch(() => {});;
      } catch(e) {
        // Autoplay failed, show tap to play hint
        heroTapHint?.classList.remove('hidden');
        heroPlayer?.addEventListener('click', () => {
          heroTapHint.classList.add('hidden');
          heroVideo.play().catch(() => {});
        }, { once: true });
      }
      // When video ends, auto-advance
      heroVideo.onended = () => selectHero(currentIdx + 1, false);
      // Safety timer: in case a video stalls or is very short, advance after 10 seconds
      safetyTimerId = setTimeout(() => {
        try { heroVideo.pause(); } catch (_e) {}
        selectHero(currentIdx + 1, false);
      }, 10000);
      // If autoplay, also set a timer to advance after a fixed interval (e.g., 5 seconds) for any content
      if (autoplay) {
        timerId = setTimeout(() => selectHero(currentIdx + 1, false), 5000);
      }
    }

    // Arrow button events
    prevBtn?.addEventListener('click', () => selectHero(currentIdx - 1, true));
    nextBtn?.addEventListener('click', () => selectHero(currentIdx + 1, true));
    // Start with the first hero item
    selectHero(0, false);
  }

  // ---------- Highlights strip (auto-scrolling visuals) ----------
  function initHighlights() {
    const track = document.getElementById('highlightsTrack');
    if (!track) return;
    const items = Array.isArray(state.mediaCfg?.headerSequence) ? state.mediaCfg.headerSequence : [];
    const posters = items.map(x => x.poster).filter(Boolean);
    if (!posters.length) {
      track.parentElement.classList.add('hidden');
      return;
    }
    track.innerHTML = '';
    // Duplicate the posters list to create seamless loop
    const seq = posters.concat(posters);
    seq.forEach(p => {
      const wrap = document.createElement('div');
      wrap.className = 'highlightItem';
      const img = document.createElement('img');
      img.alt = 'highlight';
      img.loading = 'lazy';
      wrap.appendChild(img);
      track.appendChild(wrap);
      attachSmartImage(img, p || 'assets/placeholder.svg');
    });
  }

  // ---------- Map initialization ----------
  function initMap() {
    const mapEl = $$('#map');
    if (!mapEl || state.map) return;
    // Initialize Leaflet map
    state.map = L.map(mapEl).setView([30.0, 70.0], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(state.map);
    state.markerLayer = L.layerGroup().addTo(state.map);
    // Add heatmap or markers based on sessions data...
    updateMapMarkers();
  }

  function updateMapMarkers() {
    if (!state.map || !state.sessions.length) return;
    state.markerLayer.clearLayers();
    // Add a heat layer based on definite interest (example logic)
    const heatPoints = state.sessions.filter(s => s.latitude && s.longitude && s.definite)
                                    .map(s => [s.latitude, s.longitude, s.definite]);
    if (heatPoints.length) {
      L.heatLayer(heatPoints, { radius: 25, maxZoom: 12 }).addTo(state.markerLayer);
    }
  }

  // ---------- Populate Summary (KPIs and charts) ----------
  function populateSummary() {
    const c = state.campaign;
    if (!c) return;
    // Set KPI values from summary data
    $$('#kpiSessions').textContent = c.totalSessions ?? '—';
    $$('#kpiFarmers').textContent = c.totalFarmers ?? '—';
    $$('#kpiAcres').textContent = c.totalAcres ?? '—';
    $$('#kpiEstAcres').textContent = c.estimatedAcres ?? '—';
    $$('#kpiAwareness').textContent = c.avgAwareness ? c.avgAwareness.toFixed(1) : '—';
    $$('#kpiDefinite').textContent = c.avgDefinite ? c.avgDefinite.toFixed(1) : '—';
    // Initialize charts (donut and pie)
    initAttendanceChart(c.attendanceData);
    initDecisionChart(c.decisionData);
    // Initialize highlights strip visuals
    initHighlights();
  }

  function initAttendanceChart(data) {
    const ctx = $$('#attendanceDonut');
    if (!ctx || !data) return;
    // Chart.js donut chart for attendance breakdown
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.labels,
        datasets: [{
          data: data.values,
          backgroundColor: ['#60a5fa', '#a3e635', '#f87171']  // example colors
        }]
      },
      options: { responsive: true, cutout: '50%' }
    });
  }
  function initDecisionChart(data) {
    const ctx = $$('#decisionPie');
    if (!ctx || !data) return;
    // Chart.js pie chart for decision breakdown
    new Chart(ctx, {
      type: 'pie',
      data: {
        labels: data.labels,
        datasets: [{
          data: data.values,
          backgroundColor: ['#34d399', '#facc15', '#94a3b8']
        }]
      },
      options: { responsive: true }
    });
  }

  // ---------- Populate sessions table ----------
  function populateSessionsTable() {
    const tbody = $$('#sessionTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    state.filteredSessions.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDate(parseDateSafe(s.date))}</td>
        <td>${htmlEscape(s.city || '')}</td>
        <td>${htmlEscape(s.hostFarmer || '')}</td>
        <td>${s.farmersAttended ?? ''}</td>
        <td>${s.definite ?? ''}</td>
        <td>${s.maybe ?? ''}</td>
        <td>${s.notInterested ?? ''}</td>
        <td>${formatPercent(s.definitePercent)}</td>
        <td>${formatPercent(s.maybePercent)}</td>
        <td>${s.feedbackScore ?? ''}</td>
      `;
      tbody.appendChild(tr);
    });
    // Update count
    const countEl = $$('#sessionCount');
    if (countEl) {
      countEl.textContent = `(${state.filteredSessions.length})`;
    }
  }

  // ---------- Filter sessions based on inputs ----------
  function applyFilters() {
    const name = state.nameFilter.toLowerCase();
    const city = state.cityFilter.toLowerCase();
    const region = state.regionFilter.toLowerCase();
    const district = state.districtFilter.toLowerCase();
    const minScore = state.scoreMin;
    const maxScore = state.scoreMax;
    state.filteredSessions = state.sessions.filter(s => {
      let ok = true;
      if (name && !(s.hostFarmer || '').toLowerCase().includes(name)) ok = false;
      if (city && !(s.city || '').toLowerCase().includes(city)) ok = false;
      if (region && !(s.regionCode || '').toLowerCase().includes(region)) ok = false;
      if (district && !(s.district || '').toLowerCase().includes(district)) ok = false;
      if (minScore != null && s.feedbackScore != null && s.feedbackScore < minScore) ok = false;
      if (maxScore != null && s.feedbackScore != null && s.feedbackScore > maxScore) ok = false;
      return ok;
    });
    populateSessionsTable();
  }

  // ---------- Media tab logic ----------
  function initMediaTab() {
    if (state._mediaBound) return;
    state._mediaBound = true;
    // Event listeners for media filters
    $$$('input[name="mediaType"]').forEach(input => {
      input.addEventListener('change', () => {
        state.mediaType = input.value;
        populateMediaGrid(true);
      });
    });
    $$('#mediaSearch')?.addEventListener('input', () => {
      state.mediaSearch = $$('#mediaSearch').value.trim().toLowerCase();
      populateMediaGrid(true);
    });
    $$('#mediaSort')?.addEventListener('change', () => {
      state.mediaSort = $$('#mediaSort').value;
      populateMediaGrid(true);
    });
    $$('#loadMoreBtn')?.addEventListener('click', () => {
      state.mediaLimit += 24;
      populateMediaGrid();
    });
    // Initial populate
    populateMediaGrid(true);
  }

  function populateMediaGrid(reset = false) {
    const grid = $$('#mediaGrid');
    if (!grid || !state.campaign) return;
    if (reset) state.mediaLimit = 24;
    grid.innerHTML = '';
    // Get all media entries (from campaign extras or sessions data)
    const mediaEntries = Array.isArray(state.campaign.media) ? state.campaign.media : [];
    let entries = mediaEntries.map(m => ({ ...m }));  // shallow copy
    // Filter by type
    if (state.mediaType !== 'all') {
      entries = entries.filter(m => {
        const isVid = /\.mp4$/i.test(m.url) || m.type === 'video';
        return state.mediaType === 'video' ? isVid : !isVid;
      });
    }
    // Filter by search term
    if (state.mediaSearch) {
      entries = entries.filter(m => {
        const term = state.mediaSearch;
        return (m.caption || '').toLowerCase().includes(term) || (m.fileName || '').toLowerCase().includes(term);
      });
    }
    // Sort entries (newest or oldest)
    entries.sort((a, b) => {
      if (state.mediaSort === 'oldest') return (a.date || 0) - (b.date || 0);
      return (b.date || 0) - (a.date || 0);
    });
    // Slice to limit
    entries = entries.slice(0, state.mediaLimit);
    // Create elements for each media entry
    for (const m of entries) {
      const isVideo = /\.mp4$/i.test(m.url) || m.type === 'video';
      const thumbEl = document.createElement(isVideo ? 'video' : 'img');
      thumbEl.className = 'thumb' + (isVideo ? ' videoThumb' : '');
      thumbEl.setAttribute('data-id', m.id);
      thumbEl.setAttribute('data-type', isVideo ? 'video' : 'image');
      thumbEl.setAttribute('alt', m.caption || (isVideo ? 'Video' : 'Image'));
      thumbEl.setAttribute('title', m.caption || '');
      if (isVideo) {
        thumbEl.muted = true;
        thumbEl.playsInline = true;
        thumbEl.preload = 'metadata';
      }
      // Lazy load (use attachSmartImage for images, direct src for videos)
      if (isVideo) {
        thumbEl.src = m.url;
      } else {
        attachSmartImage(thumbEl, m.url);
      }
      thumbEl.addEventListener('click', () => openLightbox(m));
      grid.appendChild(thumbEl);
    }
    // Show/hide "Load more" button
    const loadMoreBtn = $$('#loadMoreBtn');
    if (loadMoreBtn) {
      if (entries.length < mediaEntries.length) {
        loadMoreBtn.style.display = 'block';
      } else {
        loadMoreBtn.style.display = 'none';
      }
    }
  }

  function openLightbox(mediaItem) {
    const lb = $$('#lightbox');
    const lbBody = $$('#lbBody');
    if (!lb || !lbBody || !mediaItem) return;
    lbBody.innerHTML = '';
    // Determine media type and create appropriate element
    const isVideo = /\.mp4$/i.test(mediaItem.url) || mediaItem.type === 'video';
    if (isVideo) {
      const vid = document.createElement('video');
      vid.controls = true;
      vid.src = mediaItem.url;
      lbBody.appendChild(vid);
      vid.play().catch(() => {});  // autoplay video in lightbox if possible
    } else {
      const img = document.createElement('img');
      attachSmartImage(img, mediaItem.url);
      lbBody.appendChild(img);
    }
    lb.style.display = 'block';
  }
  $$('#lightboxClose')?.addEventListener('click', closeLightbox);
  function closeLightbox() {
    const lb = $$('#lightbox');
    if (lb) lb.style.display = 'none';
  }

  // ---------- Event handlers for filter inputs ----------
  $$('#nameFilter')?.addEventListener('input', () => {
    state.nameFilter = $$('#nameFilter').value;
    applyFilters();
  });
  $$('#cityFilter')?.addEventListener('input', () => {
    state.cityFilter = $$('#cityFilter').value;
    applyFilters();
  });
  $$('#regionFilter')?.addEventListener('input', () => {
    state.regionFilter = $$('#regionFilter').value;
    applyFilters();
  });
  $$('#districtFilter')?.addEventListener('input', () => {
    state.districtFilter = $$('#districtFilter').value;
    applyFilters();
  });
  $$('#scoreMin')?.addEventListener('input', () => {
    const val = parseFloat($$('#scoreMin').value);
    state.scoreMin = Number.isFinite(val) ? val : null;
    applyFilters();
  });
  $$('#scoreMax')?.addEventListener('input', () => {
    const val = parseFloat($$('#scoreMax').value);
    state.scoreMax = Number.isFinite(val) ? val : null;
    applyFilters();
  });

  // ---------- Tab controller ----------
  function showTab(tab) {
    const active = tab || activeTabFromHash();
    $$('.tabBtn[aria-selected="true"]')?.setAttribute('aria-selected', 'false');
    $$(`.tabBtn[data-tab="${active}"]`)?.setAttribute('aria-selected', 'true');
    $$$('.tabPanel').forEach(panel => {
      panel.setAttribute('aria-hidden', 'true');
    });
    const activePanel = $$(`.tabPanel[data-tab="${active}"]`);
    if (activePanel) {
      activePanel.setAttribute('aria-hidden', 'false');
      activePanel.setAttribute('data-active', '1');
    }
    if (active === 'sessions') {
      // Refresh map in sessions tab if needed (e.g., mini map)
      updateMapMarkers();
    }
    if (active === 'media') {
      // Load more media if needed or adjust layout
    }
  }

  // Tab button event binding
  $$$('.tabBtn[data-tab]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const tab = btn.getAttribute('data-tab');
      setHashSilently(tab);
      showTab(tab);
    });
  });

  // ---------- Initialize page on load ----------
  async function init() {
    try {
      // Load campaign registry to identify campaigns
      const reg = await fetchWithRetry('data/campaigns.json');
      state.campaigns = Array.isArray(reg.campaigns) ? reg.campaigns : [];
      if (!state.campaigns.length) throw new Error('No campaigns found');
      // Select the first campaign by default (or matching id in URL)
      state.campaignId = state.campaigns[0].id;
      // Load data for selected campaign
      await loadCampaignData(state.campaignId);
      // Show initial tab based on URL hash
      showTab(activeTabFromHash());
    } catch (e) {
      console.error('Initialization error:', e);
      setStatus('Failed to initialize dashboard.');
    }
  }
  // Wait for DOM content to be loaded
  document.addEventListener('DOMContentLoaded', init);
})();
