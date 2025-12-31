/* Harvest Horizons Dashboard (WheatCampaign) */
(() => {
  'use strict';

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const BASE = new URL('./', window.location.href);
  const QS = new URLSearchParams(window.location.search);
  const CAMPAIGN = (QS.get('campaign') || 'buctril-super-2025').trim();

  const state = {
    campaign: CAMPAIGN,
    campaigns: [],
    sessions: [],
    people: null,
    farmers: null,
    extras: null,
    sheetsIndex: null,
    filtered: [],
    map: null,
    markers: [],
    charts: {},
    activeTab: 'summary'
  };

  // -------------------------- utils --------------------------
  function resolveUrl(path){
    return new URL(path.replace(/^\//,''), BASE).toString();
  }

  async function getJson(path){
    const res = await fetch(resolveUrl(path), { cache: 'no-store' });
    if(!res.ok) throw new Error(`Fetch failed ${path} (${res.status})`);
    return res.json();
  }

  function parseISO(d){
    if(!d) return null;
    const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(!m) return null;
    const dt = new Date(+m[1], +m[2]-1, +m[3]);
    return isNaN(dt) ? null : dt;
  }

  function fmtDateISO(dt){
    const y = dt.getFullYear();
    const m = String(dt.getMonth()+1).padStart(2,'0');
    const d = String(dt.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }

  function fmtPct(v){
    if(v===null||v===undefined||v==='') return '—';
    const n = Number(v);
    if(!isFinite(n)) return '—';
    return `${Math.round(n)}%`;
  }

  function fmtNum(v){
    if(v===null||v===undefined||v==='') return '—';
    const n = Number(v);
    if(!isFinite(n)) return '—';
    return n.toLocaleString();
  }

  function safeText(v){
    return (v===null||v===undefined||v==='') ? '—' : String(v);
  }

  function normalizeMediaPath(p){
    if(!p) return null;
    const s = String(p).replace(/^\.\//,'').replace(/^\//,'');
    if(s.startsWith('assets/')) return s;
    if(s.startsWith('gallery/')) return 'assets/' + s;
    if(s.startsWith('signatures/')) return 'assets/' + s;
    return s;
  }

  function normalizeSession(raw){
    const s = { ...raw };
    const id = s.sheetRef || s.id || s.sessionId || s.code;
    const date = s.date || s.sessionDate;

    const farmers = Number(s.farmers ?? s.farmerCount ?? s.metrics?.farmers ?? 0) || 0;
    const acres = Number(s.wheatAcres ?? s.acres ?? s.metrics?.wheatAcres ?? 0) || 0;

    const metrics = {
      farmers,
      wheatAcres: acres,
      definitePct: Number(s.definitePct ?? s.definite ?? s.metrics?.definitePct ?? 0) || 0,
      maybePct: Number(s.maybePct ?? s.maybe ?? s.metrics?.maybePct ?? 0) || 0,
      notPct: Number(s.notPct ?? s.not ?? s.metrics?.notPct ?? 0) || 0,
      awarenessPct: Number(s.awarenessPct ?? s.awarePct ?? s.metrics?.awarenessPct ?? 0) || 0,
      notAwarePct: Number(s.notAwarePct ?? s.metrics?.notAwarePct ?? 0) || 0,
      avgUnderstanding: Number(s.avgUnderstanding ?? s.clarity ?? s.metrics?.avgUnderstanding ?? 0) || 0,
      usedLastYearPct: Number(s.usedLastYearPct ?? s.metrics?.usedLastYearPct ?? 0) || 0,
      demoplotDesirePct: Number(s.demoplotDesirePct ?? s.metrics?.demoplotDesirePct ?? 0) || 0,
    };

    const media = {
      images: (s.media?.images || s.images || []).map(normalizeMediaPath).filter(Boolean),
      videos: (s.media?.videos || s.videos || []).map(normalizeMediaPath).filter(Boolean)
    };

    return {
      ...s,
      id,
      sheetRef: id,
      date,
      dateObj: parseISO(date),
      district: s.district || s.city || '',
      spot: s.spot || s.location || '',
      host: { name: s.host?.name || s.hostName || '' },
      salesRep: { name: s.salesRep?.name || s.salesName || '' },
      dealer: { name: s.dealer?.name || s.dealerName || '' },
      metrics,
      score: Number(s.score100 ?? s.score ?? s.metrics?.score ?? 0) || 0,
      geo: (Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng))) ? { lat: Number(s.lat), lng: Number(s.lng) } : null,
      media
    };
  }

  function uniq(arr){
    return Array.from(new Set(arr.filter(Boolean)));
  }

  // -------------------------- tabs --------------------------
  function setActiveTab(tab){
    state.activeTab = tab;
    $$('.tabs .chip').forEach(b => b.classList.toggle('chip--active', b.dataset.tab === tab));
    $$('[data-tab]').forEach(el => el.classList.toggle('hidden', el.dataset.tab !== tab));
    const hash = `#${tab}`;
    if(location.hash !== hash) history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
    if(tab === 'map') setTimeout(() => { try { state.map?.invalidateSize(); } catch(e){} }, 50);
  }

  function initTabs(){
    $$('.tabs .chip').forEach(btn => {
      btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
    });
    const h = (location.hash || '').replace('#','');
    if(['summary','map','sessions','media','feedback'].includes(h)) setActiveTab(h);
    else setActiveTab('summary');
  }

  // -------------------------- load data --------------------------
  async function loadAll(){
    const campaignsPayload = await getJson('data/campaigns.json');
    state.campaigns = campaignsPayload.campaigns || [];

    const c = state.campaigns.find(x => x.id === state.campaign) || state.campaigns[0];
    if(!c) throw new Error('No campaign found');
    state.campaign = c.id;

    // campaign selector
    const sel = $('#campaignSelect');
    if(sel){
      sel.innerHTML = state.campaigns.map(x => `<option value="${x.id}">${x.name}</option>`).join('');
      sel.value = state.campaign;
      sel.addEventListener('change', () => {
        const url = new URL(window.location.href);
        url.searchParams.set('campaign', sel.value);
        url.hash = '';
        window.location.href = url.toString();
      });
    }

    const base = `data/${state.campaign}/`;
    const sessionsPayload = await getJson(base + 'sessions.json');
    const sessions = (sessionsPayload.sessions || sessionsPayload || []).map(normalizeSession);
    state.sessions = sessions.filter(s => s.id && s.dateObj);

    // optional files
    try { state.people = await getJson(base + 'people.json'); } catch(e) { state.people = null; }
    try { state.farmers = await getJson(base + 'farmers.json'); } catch(e) { state.farmers = null; }
    try { state.extras = await getJson(base + 'extras.json'); } catch(e) { state.extras = null; }
    try { state.sheetsIndex = await getJson(base + 'sheets_index.json'); } catch(e) { state.sheetsIndex = null; }

    initDefaultDateRange();
    initDistrictFilter();
    _applyFiltersFixed();
    initGlobalHandlers();
  }

  // -------------------------- filters --------------------------
  function initDefaultDateRange(){
    const min = new Date(Math.min(...state.sessions.map(s => s.dateObj.getTime())));
    const max = new Date(Math.max(...state.sessions.map(s => s.dateObj.getTime())));
    const from = $('#fromDate');
    const to = $('#toDate');
    if(from && !from.value) from.value = fmtDateISO(min);
    if(to && !to.value) to.value = fmtDateISO(max);
  }

  function initDistrictFilter(){
    const districts = uniq(state.sessions.map(s => s.district)).sort();
    const sel = $('#districtSelect');
    if(!sel) return;
    sel.innerHTML = `<option value="ALL">All districts</option>` + districts.map(d => `<option value="${d}">${d}</option>`).join('');
  }

    function _applyFiltersFixed(){
    const from = parseISO($('#fromDate')?.value);
    const to = parseISO($('#toDate')?.value);
    const district = $('#districtSelect')?.value || 'ALL';
    const q = ($('#q')?.value || '').trim().toLowerCase();

    state.filtered = state.sessions.filter(s => {
      if(from && s.dateObj < from) return false;
      if(to && s.dateObj > to) return false;
      if(district !== 'ALL' && s.district !== district) return false;
      if(q){
        const hay = [s.district,s.spot,s.dealer?.name,s.host?.name,s.salesRep?.name,s.topReasonUse,s.topReasonNotUse].filter(Boolean).join(' ').toLowerCase();
        if(!hay.includes(q)) return false;
      }
      return true;
    });

    renderAll();
  }

  function resetFilters(){
    $('#districtSelect').value = 'ALL';
    $('#q').value = '';
    initDefaultDateRange();
    _applyFiltersFixed();
  }

  function initGlobalHandlers(){
    $('#apply')?.addEventListener('click', _applyFiltersFixed);
    $('#reset')?.addEventListener('click', resetFilters);
    $('#q')?.addEventListener('keydown', (e) => { if(e.key === 'Enter') _applyFiltersFixed(); });

    // deep-link open session
    const open = QS.get('open');
    if(open){
      const s = state.sessions.find(x => String(x.sheetRef) === String(open));
      if(s) setTimeout(() => openSession(s), 200);
    }
  }

  // -------------------------- rendering --------------------------
  function aggregate(){
    const arr = state.filtered;
    const farmers = arr.reduce((a,s)=>a + (s.metrics.farmers||0),0);
    const acres = arr.reduce((a,s)=>a + (s.metrics.wheatAcres||0),0);
    const avgScore = arr.length ? (arr.reduce((a,s)=>a + (s.score||0),0)/arr.length) : 0;
    const avgDefinite = arr.length ? (arr.reduce((a,s)=>a + (s.metrics.definitePct||0),0)/arr.length) : 0;
    const avgAware = arr.length ? (arr.reduce((a,s)=>a + (s.metrics.awarenessPct||0),0)/arr.length) : 0;
    return { sessions: arr.length, farmers, acres, avgScore, avgDefinite, avgAware };
  }

  function renderKPIs(){
    const a = aggregate();
    $('#kpiSessions').textContent = fmtNum(a.sessions);
    $('#kpiFarmers').textContent = fmtNum(a.farmers);
    $('#kpiAcres').textContent = fmtNum(a.acres);
    $('#kpiScore').textContent = a.sessions ? a.avgScore.toFixed(1) : '—';

    // donuts (Chart.js)
    const ctx1 = $('#donutIntent');
    const ctx2 = $('#donutAwareness');

    const definite = a.avgDefinite;
    const other = Math.max(0, 100 - definite);

    if(ctx1){
      if(state.charts.intent) state.charts.intent.destroy();
      state.charts.intent = new Chart(ctx1, {
        type: 'doughnut',
        data: { labels: ['Definite','Other'], datasets: [{ data: [definite, other] }] },
        options: { responsive: true, cutout: '72%', plugins: { legend: { display: false }, tooltip: { enabled: true } } }
      });
      $('#intentCenter').textContent = a.sessions ? `${Math.round(definite)}%` : '—%';
    }

    const aware = a.avgAware;
    const notAware = Math.max(0, 100 - aware);
    if(ctx2){
      if(state.charts.aware) state.charts.aware.destroy();
      state.charts.aware = new Chart(ctx2, {
        type: 'doughnut',
        data: { labels: ['Aware','Not aware'], datasets: [{ data: [aware, notAware] }] },
        options: { responsive: true, cutout: '72%', plugins: { legend: { display: false }, tooltip: { enabled: true } } }
      });
      $('#awareCenter').textContent = a.sessions ? `${Math.round(aware)}%` : '—%';
    }
  }

  function renderSessionsTable(){
    const body = $('#sessionsBody');
    body.innerHTML = '';

    if(!state.filtered.length){
      body.innerHTML = `<tr><td colspan="8" class="muted">No sessions match the filters.</td></tr>`;
      $('#pageLabel').textContent = 'Page 1 / 1';
      return;
    }

    const perPage = 12;
    const page = 1; // simple for now
    const slice = state.filtered.slice((page-1)*perPage, page*perPage);

    slice.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${safeText(s.date)}</td>
        <td>${safeText(s.district)}</td>
        <td>${safeText(s.spot)}</td>
        <td>${fmtNum(s.metrics.farmers)}</td>
        <td>${fmtNum(s.metrics.wheatAcres)}</td>
        <td>${fmtPct(s.metrics.definitePct)}</td>
        <td>${fmtPct(s.metrics.awarenessPct)}</td>
        <td>${(s.score||0).toFixed(1)}</td>
      `;
      tr.addEventListener('click', () => openSession(s));
      body.appendChild(tr);
    });
    $('#pageLabel').textContent = `Page 1 / 1`;
  }

  function ensureMap(){
    if(state.map) return;
    const el = $('#map');
    if(!el) return;
    state.map = L.map(el, { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(state.map);
    state.map.setView([30.3753, 69.3451], 5); // Pakistan-ish
  }

  function renderMap(){
    ensureMap();
    if(!state.map) return;

    // clear old
    state.markers.forEach(m => m.remove());
    state.markers = [];

    const pts = state.filtered.filter(s => s.geo);
    if(!pts.length){
      state.map.setView([30.3753, 69.3451], 5);
      return;
    }

    const bounds = [];
    pts.forEach(s => {
      const m = L.marker([s.geo.lat, s.geo.lng]).addTo(state.map);
      m.bindPopup(`<b>${safeText(s.sheetRef)}</b><br>${safeText(s.date)} • ${safeText(s.district)}<br>${fmtNum(s.metrics.farmers)} farmers • score ${(s.score||0).toFixed(1)}`);
      m.on('click', () => openSession(s));
      state.markers.push(m);
      bounds.push([s.geo.lat, s.geo.lng]);
    });

    state.map.fitBounds(bounds, { padding: [30,30] });
  }

  function renderMediaWall(){
    const grid = $('#mediaGrid');
    grid.innerHTML = '';

    const items = [];
    state.filtered.forEach(s => {
      const img = (s.media.images||[])[0];
      const vid = (s.media.videos||[])[0];
      if(img || vid) items.push({ session: s, img, vid });
    });

    $('#mediaCountSessions').textContent = `${items.length} Sessions`;
    $('#mediaCountImages').textContent = `${items.filter(x=>x.img).length} Images`;
    $('#mediaCountVideos').textContent = `${items.filter(x=>x.vid).length} Videos`;

    if(!items.length){
      grid.innerHTML = `<div class="muted">No media found for the current filter. Ensure media paths are under <b>assets/gallery/</b> and sessions.json references <b>gallery/…</b> or <b>assets/gallery/…</b>.</div>`;
      return;
    }

    items.slice(0, 120).forEach(({session, img, vid}) => {
      const card = document.createElement('div');
      card.className = 'mediaCard';
      const thumb = img ? `<img src="${resolveUrl(img)}" alt="${safeText(session.sheetRef)}" loading="lazy"/>` : `<div class="ph"></div>`;
      card.innerHTML = `
        <div class="mediaThumb">${thumb}</div>
        <div class="mediaMeta">
          <div class="mediaTitle">Session ${safeText(session.id).replace(/[^0-9]/g,'') || safeText(session.id)} • ${safeText(session.date)}</div>
          <div class="muted">${fmtNum(session.metrics.farmers)} farmers • Score ${(session.score||0).toFixed(0)}/100</div>
        </div>
      `;
      card.addEventListener('click', () => {
        if(vid) openLightboxVideo(resolveUrl(vid));
        else if(img) openLightboxImage(resolveUrl(img));
        else openSession(session);
      });
      grid.appendChild(card);
    });
  }

  function openLightboxImage(src){
    const lb = $('#lightbox');
    const body = $('#lightboxBody');
    body.innerHTML = `<img class="lightbox__img" src="${src}" alt="Media"/>`;
    lb.classList.remove('hidden');
    lb.setAttribute('aria-hidden','false');
  }

  function openLightboxVideo(src){
    const lb = $('#lightbox');
    const body = $('#lightboxBody');
    body.innerHTML = `<video class="lightbox__video" src="${src}" controls playsinline></video>`;
    lb.classList.remove('hidden');
    lb.setAttribute('aria-hidden','false');
  }

  function closeLightbox(){
    const lb = $('#lightbox');
    const body = $('#lightboxBody');
    body.innerHTML = '';
    lb.classList.add('hidden');
    lb.setAttribute('aria-hidden','true');
  }

  function openSession(s){
    // set details
    $('#detailTitle').textContent = `Session ${safeText(s.sheetRef)}`;
    $('#dHost').textContent = safeText(s.host?.name);
    $('#dSales').textContent = safeText(s.salesRep?.name);
    $('#dDealer').textContent = safeText(s.dealer?.name);
    $('#dFarmers').textContent = fmtNum(s.metrics.farmers);
    $('#dAcres').textContent = fmtNum(s.metrics.wheatAcres);
    $('#dScore').textContent = (s.score||0).toFixed(1);
    $('#dDefinite').textContent = fmtPct(s.metrics.definitePct);
    $('#dTopUse').textContent = safeText(s.topReasonUse);
    $('#dTopNotUse').textContent = safeText(s.topReasonNotUse);

    // map buttons
    $('#openMaps')?.addEventListener('click', () => {
      if(!s.geo) return;
      window.open(`https://www.google.com/maps?q=${s.geo.lat},${s.geo.lng}`, '_blank');
    }, { once: true });

    $('#shareSession')?.addEventListener('click', async () => {
      const url = new URL(window.location.href);
      url.searchParams.set('open', s.sheetRef);
      url.hash = '#sessions';
      try {
        await navigator.clipboard.writeText(url.toString());
        alert('Session link copied');
      } catch(e){
        prompt('Copy session link:', url.toString());
      }
    }, { once: true });

    $('#viewSheet')?.addEventListener('click', () => {
      const u = `./sheets.html?campaign=${encodeURIComponent(state.campaign)}&sheet=${encodeURIComponent(s.sheetRef)}&from=dashboard`;
      window.open(u, '_blank');
    }, { once: true });

    // session media
    const sm = $('#sessionMedia');
    sm.innerHTML = '';
    const imgs = s.media.images || [];
    const vids = s.media.videos || [];
    [...imgs.map(u=>({t:'img',u})), ...vids.map(u=>({t:'vid',u}))].forEach(item => {
      const div = document.createElement('button');
      div.className = 'mediaMini';
      if(item.t==='img'){
        div.innerHTML = `<img src="${resolveUrl(item.u)}" alt="" loading="lazy"/>`;
        div.addEventListener('click', () => openLightboxImage(resolveUrl(item.u)));
      } else {
        div.innerHTML = `<div class="mediaMini__video">▶ Video</div>`;
        div.addEventListener('click', () => openLightboxVideo(resolveUrl(item.u)));
      }
      sm.appendChild(div);
    });

    // open drawer
    $('#sessionDrawer').classList.add('open');
  }

  function closeSession(){
    $('#sessionDrawer').classList.remove('open');
  }

  function renderAll(){
    renderKPIs();
    renderSessionsTable();
    renderMap();
    renderMediaWall();
  }

  // -------------------------- init --------------------------
  async function main(){
    initTabs();
    $('#closeSession')?.addEventListener('click', closeSession);
    $('#closeLightbox')?.addEventListener('click', closeLightbox);
    $('#lightbox')?.addEventListener('click', (e)=>{ if(e.target && e.target.id==='lightbox') closeLightbox(); });

    // background + logos
    const bg = $('#bgVideo');
    if(bg) bg.src = resolveUrl('assets/bg.mp4');
    const interact = $('#interactGif');
    if(interact) interact.src = resolveUrl('assets/interact.gif');

    await loadAll();
  }

  main().catch(err => {
    console.error(err);
    const box = $('#statusBox');
    if(box){
      box.textContent = `Error: ${err.message}`;
    }
  });
})();
