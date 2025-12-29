
(() => {
  'use strict';

  const $$ = (sel, root=document) => root.querySelector(sel);
  const $$$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const fmtInt = (n) => (n === null || n === undefined || Number.isNaN(n)) ? '—' : new Intl.NumberFormat().format(Math.round(n));
  const fmt1 = (n) => (n === null || n === undefined || Number.isNaN(n)) ? '—' : (Math.round(n*10)/10).toFixed(1);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const safeStr = (v) => (v === null || v === undefined || String(v).trim()==='' ? '—' : String(v).trim());

  const BASE = new URL('./', window.location.href); // resolves /WheatCampaign/
  const url = (rel) => new URL(rel, BASE).toString();

  // Normalize asset paths so '/assets/..' does not escape the GitHub Pages sub-path
  const resolveUrl = (p) => {
    const s = String(p || '').trim();
    if (!s) return '';
    if (/^(https?:)?\/\//i.test(s) || s.startsWith('data:') || s.startsWith('blob:')) return s;
    // prevent absolute-path resolution to origin root (breaks /WheatCampaign/ hosting)
    return url(s.replace(/^\/+/, ''));
  };

  // Attribute-safe escaping (for src/href attributes)
  function escapeAttr(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }



  function parseDateSafe(val) {
    if (!val) return null;
    const s = String(val).trim();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
      return isNaN(d.getTime()) ? null : d;
    }
    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
      const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function fmtISO(d) {
    if (!d) return '';
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Lightbox (used by session media + gallery)
  function openLightbox(item) {
    const lb = document.getElementById('lightbox');
    const body = document.getElementById('lightboxBody');
    if (!lb || !body) return;
    const rawUrl = item && item.url ? item.url : '';
    const srcUrl = resolveUrl(rawUrl);
    if (!srcUrl) return;

    state.selectedMediaUrl = srcUrl;

    const kind = String(item?.kind || item?.type || '').toLowerCase();
    const src = escapeAttr(srcUrl);

    body.innerHTML = (kind === 'video')
      ? `<video src="${src}" controls autoplay playsinline style="width:100%;max-height:75vh;border-radius:14px;background:#000"></video>`
      : `<img src="${src}" alt="" style="max-width:100%;max-height:75vh;border-radius:14px" />`;

    lb.classList.remove('hidden');
    lb.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    const lb = document.getElementById('lightbox');
    const body = document.getElementById('lightboxBody');
    if (body) body.innerHTML = '';
    if (lb) {
      lb.classList.add('hidden');
      lb.setAttribute('aria-hidden', 'true');
    }
    state.selectedMediaUrl = null;
    document.body.style.overflow = '';
  }


  // Asset path tolerance: GitHub Pages is case-sensitive; allow common case/typo variants.
  const assetCandidates = (p) => {
    const s0 = String(p || '').trim().replace(/^\/+/, '');
    if (!s0) return [];
    const out = [s0];
    const parts = s0.split('/');
    const fname = parts[parts.length - 1] || '';
    const lower = fname.toLowerCase();
    const upperFirst = lower ? (lower.charAt(0).toUpperCase() + lower.slice(1)) : fname;

    const withName = (name) => parts.slice(0, -1).concat([name]).join('/');

    if (lower && lower !== fname) out.push(withName(lower));
    if (upperFirst && upperFirst !== fname) out.push(withName(upperFirst));

    // Common typo seen in repo history
    if (lower === 'products.jpg') out.push(withName('poducts.jpg'));
    if (lower === 'poducts.jpg') out.push(withName('products.jpg'));

    return Array.from(new Set(out));
  };

  async function resolveExistingAsset(p){
    for (const c of assetCandidates(p)) {
      if (await assetExists(c)) return c;
    }
    return '';
  }


  const state = {
    campaigns: [],
    campaign: null,
    sessions: [],
    media: null,
    filtered: [],
    map: null,
    markers: [],
    page: 1,
    pageSize: 12,
    selected: null,
    selectedMediaUrl: null
  };

  function setStatus(msg, type='info') {
    const el = $$('#statusChip');
    if (!el) return;
    el.textContent = `Status: ${msg}`;
    el.classList.toggle('warnChip', type==='warn');
  }

  async function fetchJson(relUrl, timeoutMs=12000) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try{
      const res = await fetch(relUrl, { cache: 'no-store', signal: controller.signal });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  // Asset existence cache (prevents rendering placeholder tiles for missing files)
  const _existsCache = new Map();
  async function assetExists(relUrl){
    const key = String(relUrl||'');
    if(_existsCache.has(key)) return _existsCache.get(key);
    const u = url(String(relUrl||'').replace(/^\/?/,''));
    let ok = false;
    try{
      let res = await fetch(u, { method:'HEAD', cache:'no-store' });
      if(res && res.ok) ok = true;
      else{
        res = await fetch(u, { method:'GET', cache:'no-store' });
        ok = !!(res && res.ok);
      }
    }catch{ ok = false; }
    _existsCache.set(key, ok);
    return ok;
  }

  function getCampaignFromQuery() {
    const p = new URLSearchParams(window.location.search);
    return p.get('campaign');
  }

  function setQueryCampaign(id) {
    const u = new URL(window.location.href);
    u.searchParams.set('campaign', id);
    history.replaceState({}, '', u.toString());
  }

  
  function renderHero(cfg){
    const hero = $$('#heroPlayer');
    const v = $$('#heroVideo');
    const poster = $$('#heroPoster');
    const thumbs = $$('#heroThumbs');
    const t = $$('#heroTitle');
    const s = $$('#heroSub');
    const btnPrev = $$('#heroPrev');
    const btnNext = $$('#heroNext');
    const btnMute = $$('#heroMute');
    if(!hero || !v || !poster || !thumbs) return;

    const seq = Array.isArray(cfg.headerSequence) ? cfg.headerSequence : [];
    const playlist = seq.map((x, idx)=>({
      idx,
      label: x.label || `Header ${idx+1}`,
      title: x.title || x.label || 'Campaign highlights',
      video: x.video || '',
      poster: x.poster || 'assets/placeholder.svg'
    }));

    let cur = 0;
    let autoTimer = null;

    function setActiveThumb(){
      $$$('.heroThumb', thumbs).forEach((el)=>el.classList.remove('active'));
      const el = thumbs.querySelector(`[data-idx="${cur}"]`);
      if(el) el.classList.add('active');
    }

    async function loadIndex(i, user=false){
      if(!playlist.length) return;
      cur = (i + playlist.length) % playlist.length;
      const item = playlist[cur];

      t.textContent = item.title;
      s.textContent = 'If video does not auto-play on iPhone, tap once to start.';
      setActiveThumb();

      const vidPath = item.video ? await resolveExistingAsset(item.video) : '';
      const posterPath = item.poster ? (await resolveExistingAsset(item.poster)) : '';
      const hasVid = !!vidPath;
      const hasPoster = !!posterPath;

      const posterSrc = resolveUrl(hasPoster ? posterPath : 'assets/placeholder.svg');
      poster.src = posterSrc;

      if(hasVid){
        hero.classList.remove('fallback');
        v.src = resolveUrl(vidPath);
        v.load();
        try{
          const p = v.play();
          if(p && p.catch) await p;
        }catch(_e){
          hero.classList.add('fallback');
          s.textContent = 'Tap to play (autoplay blocked by device/browser).';
        }
      }else{
        hero.classList.add('fallback');
        v.removeAttribute('src');
        v.load();
        s.textContent = 'Video not found. Showing poster image.';
      }

      if(user){
        // If user interacted, keep autoplay rotation but slower.
        restartAuto(11000);
      }
    }

    function restartAuto(ms=8500){
      if(autoTimer) window.clearInterval(autoTimer);
      if(!playlist.length) return;
      autoTimer = window.setInterval(()=>loadIndex(cur+1), ms);
    }

    // Build thumbs
    thumbs.innerHTML = '';
    playlist.slice(0, 4).forEach((item)=>{
      const el = document.createElement('div');
      el.className = 'heroThumb';
      el.dataset.idx = String(item.idx);
      el.innerHTML = `
        <img alt="" src="${escapeHtml(resolveUrl(item.poster || 'assets/placeholder.svg'))}" onerror="this.src='assets/placeholder.svg'"/>
        <div class="badge">${escapeHtml(item.label)}</div>
      `;
      el.addEventListener('click', ()=>loadIndex(item.idx, true));
      thumbs.appendChild(el);
    });

    btnPrev?.addEventListener('click', (e)=>{ e.preventDefault(); loadIndex(cur-1, true); });
    btnNext?.addEventListener('click', (e)=>{ e.preventDefault(); loadIndex(cur+1, true); });
    btnMute?.addEventListener('click', (e)=>{
      e.preventDefault();
      v.muted = !v.muted;
      btnMute.textContent = v.muted ? '🔇' : '🔊';
    });

    hero.addEventListener('click', async ()=>{
      try{
        if(v.paused){
          await v.play();
          hero.classList.remove('fallback');
        }else{
          v.pause();
        }
      }catch(_e){
        hero.classList.add('fallback');
      }
    });

    loadIndex(0);
    restartAuto();
  }

  async function renderFooterBrands(cfg){
    const host = $$('#footerBrands');
    if(!host) return;

    const candidates = [
      {name:'INTERACT', img:(cfg.brandImages && cfg.brandImages.interactGif) ? cfg.brandImages.interactGif : 'assets/interact.gif'},
      {name:'Bayer', img:(cfg.brandImages && cfg.brandImages.bayerLogo) ? cfg.brandImages.bayerLogo : 'assets/bayer.png'},
      {name:'Buctril Super', img:(cfg.brandImages && cfg.brandImages.buctril) ? cfg.brandImages.buctril : 'assets/buctril.jpg'},
      {name:'Atlantis', img:(cfg.brandImages && cfg.brandImages.atlantis) ? cfg.brandImages.atlantis : 'assets/atlantis.jpg'},
      {name:'Products', img:(cfg.brandImages && cfg.brandImages.products) ? cfg.brandImages.products : 'assets/products.jpg'}
    ];

    host.innerHTML = '';
    for(const c of candidates){
      const resolved = await resolveExistingAsset(c.img);
      if(!resolved) continue;
      const pill = document.createElement('div');
      pill.className = 'brandPill';
      pill.innerHTML = `<img alt="${escapeHtml(c.name)}" src="${escapeHtml(resolveUrl(resolved))}"/><span>${escapeHtml(c.name)}</span>`;
      host.appendChild(pill);
    }
  }


  
  async function initBgVideo(cfg) {
    const v = $$('#bgVideo');
    if(!v) return;
    const src0 = cfg.backgroundVideo || 'assets/bg.mp4';
    const src = await resolveExistingAsset(src0);
    if(!src){
      // Keep the element but don’t break layout; background falls back to gradient.
      v.removeAttribute('src');
      v.style.display = 'none';
      return;
    }
    v.src = resolveUrl(src);
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.autoplay = true;
    v.preload = 'metadata';

    // Try autoplay; if blocked, show paused first frame and allow tap to start.
    try{
      const p = v.play();
      if(p && p.catch) await p;
    }catch(_e){
      v.classList.add('paused');
    }
    v.addEventListener('click', async ()=>{
      try{ await v.play(); v.classList.remove('paused'); }catch(_e){}
    });
  }


  function donutSvg(parts, centerText, subText) {
    // parts: [{label, value(0..1), colorClass}]
    const size = 132;
    const r = 50;
    const c = 2 * Math.PI * r;
    let offset = 0;
    const segs = parts.map((p, i) => {
      const len = clamp(p.value, 0, 1) * c;
      const dash = `${len} ${c - len}`;
      const el = `<circle class="donutSeg ${p.colorClass||''}" cx="${size/2}" cy="${size/2}" r="${r}" stroke-dasharray="${dash}" stroke-dashoffset="${-offset}" />`;
      offset += len;
      return el;
    }).join('');
    const legend = parts.filter(p=>p.label).map(p => `<span class="legendItem"><span class="dot ${p.colorClass||''}"></span>${p.label}</span>`).join('');
    return `
      <div class="donut">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
          <circle class="donutTrack" cx="${size/2}" cy="${size/2}" r="${r}"/>
          ${segs}
          <text x="50%" y="48%" text-anchor="middle" class="donutCenter">${centerText}</text>
          <text x="50%" y="62%" text-anchor="middle" class="donutSub">${subText||''}</text>
        </svg>
        <div class="legend">${legend}</div>
      </div>
    `;
  }

  function injectDonutStyles() {
    if ($$('#donutStyle')) return;
    const s = document.createElement('style');
    s.id = 'donutStyle';
    s.textContent = `
      .donutTrack{fill:none; stroke: rgba(26,41,71,.55); stroke-width: 12}
      .donutSeg{fill:none; stroke-width: 12; stroke-linecap: butt}
      .donutCenter{fill:#e9f0ff; font-size:16px; font-weight:900}
      .donutSub{fill:#a9b7d6; font-size:10px}
      .legend{margin-top:8px; display:flex; gap:10px; flex-wrap:wrap; justify-content:center; font-size:11px; color:#a9b7d6}
      .legendItem{display:flex; gap:6px; align-items:center}
      .dot{width:10px; height:10px; border-radius:999px; background:#4c6fff}
      .c1{stroke:#4c6fff}.c2{stroke:#22c55e}.c3{stroke:#f59e0b}.c4{stroke:#ef4444}
      .dot.c1{background:#4c6fff}.dot.c2{background:#22c55e}.dot.c3{background:#f59e0b}.dot.c4{background:#ef4444}
    `;
    document.head.appendChild(s);
  }

  function computeTopReason(sessions, key='use') {
    const counts = new Map();
    for (const s of sessions) {
      const obj = key==='use' ? (s.reasonsUse||{}) : (s.reasonsNotUse||{});
      for (const [k,v] of Object.entries(obj)) {
        if (!v || v<=0) continue;
        counts.set(k, (counts.get(k)||0) + v);
      }
    }
    const sorted = Array.from(counts.entries()).sort((a,b)=>b[1]-a[1]);
    return sorted.length ? {label: sorted[0][0], value: sorted[0][1]} : {label:'—', value:0};
  }

  function computeCompetitors(sessions) {
    const m = new Map();
    for (const s of sessions) {
      const txt = (s.competitors||'').trim();
      if (!txt) continue;
      txt.split(/[;,]/).map(x=>x.trim()).filter(Boolean).forEach(b=>{
        m.set(b, (m.get(b)||0) + 1);
      });
    }
    const sorted = Array.from(m.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5);
    return sorted.length ? sorted.map(([b,c])=>`${b} (${c})`).join(', ') : '—';
  }

  function filterSessions() {
    const district = $$('#districtSelect').value;
    const q = ($$('#searchInput').value || '').toLowerCase().trim();
    const from = $$('#fromDate').value ? parseDateSafe($$('#fromDate').value) : null;
    const to = $$('#toDate').value ? parseDateSafe($$('#toDate').value) : null;

    const res = state.sessions.filter(s => {
      if (district && district !== 'ALL' && (s.district||'') !== district) return false;
      if (from) {
        const d = parseDateSafe(s.date);
        if (d && d < from) return false;
      }
      if (to) {
        const d = parseDateSafe(s.date);
        // inclusive end
        const t2 = new Date(to.getTime() + 24*3600*1000 - 1);
        if (d && d > t2) return false;
      }
      if (q) {
        const blob = `${s.city} ${s.district} ${s.spot} ${s.village} ${(s.host&&s.host.name)||''} ${(s.dealer&&s.dealer.name)||''} ${(s.salesRep&&s.salesRep.name)||''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });

    state.filtered = res;
    state.page = 1;

    const distLabel = (district && district !== 'ALL') ? district : 'All districts';
    const dateLabel = (from || to) ? `${from ? fmtISO(from) : '…'} → ${to ? fmtISO(to) : '…'}` : 'All dates';
    $$('#selectionChip').textContent = `${distLabel} • ${dateLabel}`;
  }

  function updateKPIs() {
    const s = state.filtered;
    const sessions = s.length;
    const farmers = s.reduce((a,x)=>a+(x.metrics?.farmers||0),0);
    const acres = s.reduce((a,x)=>a+(x.metrics?.wheatAcres||0),0);
    const scores = s.map(x=>x.score).filter(v=>typeof v==='number');
    const avgScore = scores.length ? scores.reduce((a,v)=>a+v,0)/scores.length : null;

    $$('#kSessions').textContent = fmtInt(sessions);
    $$('#kFarmers').textContent = fmtInt(farmers);
    $$('#kAcres').textContent = fmtInt(acres);
    $$('#kScore').textContent = avgScore===null ? '—' : fmt1(avgScore);

    // donuts
    injectDonutStyles();

    const avgAwareness = avg(s.map(x=>x.metrics?.awarenessPct));
    const avgUsed = avg(s.map(x=>x.metrics?.usedLastYearPct));
    const avgDef = avg(s.map(x=>x.metrics?.definitePct));
    const avgMaybe = avg(s.map(x=>x.metrics?.maybePct));
    const avgNot = avg(s.map(x=>x.metrics?.notInterestedPct));
    const avgUnderstand = avg(s.map(x=>x.metrics?.avgUnderstanding)); // 0..3

    // Intent donut: definite/maybe/not
    const defV = (avgDef??0)/100;
    const maybeV = (avgMaybe??0)/100;
    const notV = (avgNot??0)/100;
    const rem = clamp(1 - (defV+maybeV+notV), 0, 1);
    $$('#donutIntent').innerHTML = donutSvg([
      {label:'Definite', value:defV, colorClass:'c2'},
      {label:'Maybe', value:maybeV, colorClass:'c3'},
      {label:'Not', value:notV, colorClass:'c4'},
      {label:'Other', value:rem, colorClass:'c1'},
    ], `${avgDef===null?'—':Math.round(avgDef)}%`, 'definite');
    $$('#metaIntent').textContent = `Avg definite intent across selection.`;

    // Awareness donut
    const aware = (avgAwareness??0)/100;
    $$('#donutAwareness').innerHTML = donutSvg([
      {label:'Aware', value:aware, colorClass:'c1'},
      {label:'Not aware', value:1-aware, colorClass:'c4'},
    ], `${avgAwareness===null?'—':Math.round(avgAwareness)}%`, 'aware');
    $$('#metaAwareness').textContent = `Average awareness in the filtered set.`;

    // Understanding donut
    const u = (avgUnderstand??0)/3;
    $$('#donutUnderstanding').innerHTML = donutSvg([
      {label:'Understood', value:u, colorClass:'c2'},
      {label:'Gap', value:1-u, colorClass:'c3'},
    ], `${avgUnderstand===null?'—':fmt1(avgUnderstand)}`, '/ 3');
    $$('#metaUnderstanding').textContent = `Average understanding across 5 key messages (0–3).`;

    // Coverage donut: acres vs estimated buctril acres
    const est = s.reduce((a,x)=>a+(x.metrics?.estimatedBuctrilAcres||0),0);
    const cov = acres>0 ? clamp(est/acres,0,1) : 0;
    $$('#donutCoverage').innerHTML = donutSvg([
      {label:'Est. Buctril acres', value:cov, colorClass:'c2'},
      {label:'Other acres', value:1-cov, colorClass:'c1'},
    ], acres?`${Math.round(cov*100)}%`:'—', 'share');
    $$('#metaCoverage').textContent = `Est. product acres vs total wheat acres.`;

    // Top reasons
    const topUse = computeTopReason(s,'use');
    const topNot = computeTopReason(s,'not');
    $$('#topUse').textContent = topUse.label || '—';
    $$('#topNotUse').textContent = topNot.label || '—';
    $$('#topCompetitors').textContent = computeCompetitors(s);

    // counters
    const imageCount = s.reduce((a,x)=>a + (x.media?.images?.length||0), 0);
    const videoCount = s.reduce((a,x)=>a + (x.media?.videos?.length||0), 0);
    $$('#mSessions').textContent = `${fmtInt(s.length)} Sessions`;
    $$('#mImages').textContent = `${fmtInt(imageCount)} Images`;
    $$('#mVideos').textContent = `${fmtInt(videoCount)} Videos`;
  }

  function avg(list) {
    const nums = list.filter(v => typeof v === 'number' && !Number.isNaN(v));
    if (!nums.length) return null;
    return nums.reduce((a,v)=>a+v,0)/nums.length;
  }

  function rebuildDistrictOptions() {
    const sel = $$('#districtSelect');
    const districts = Array.from(new Set(state.sessions.map(s=>s.district).filter(Boolean))).sort();
    sel.innerHTML = `<option value="ALL">All</option>` + districts.map(d=>`<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // Sessions table
  function renderTable() {
    const start = (state.page-1)*state.pageSize;
    const chunk = state.filtered.slice(start, start+state.pageSize);

    const totalPages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
    $$('#pageInfo').textContent = `Page ${state.page} / ${totalPages}`;
    $$('#prevBtn').disabled = state.page<=1;
    $$('#nextBtn').disabled = state.page>=totalPages;

    const tbody = $$('#sessionsTbody');
    if (!chunk.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="muted">No sessions match the filters.</td></tr>`;
      return;
    }
    tbody.innerHTML = chunk.map(s => `
      <tr class="rowBtn" data-id="${s.id}">
        <td>${s.date || '—'}</td>
        <td>${escapeHtml(s.district || s.city || '—')}</td>
        <td>${escapeHtml(s.spot || '—')}</td>
        <td class="num">${fmtInt(s.metrics?.farmers)}</td>
        <td class="num">${fmtInt(s.metrics?.wheatAcres)}</td>
        <td class="num">${s.metrics?.definitePct ?? '—'}</td>
        <td class="num">${s.metrics?.awarenessPct ?? '—'}</td>
        <td class="num">${s.score ?? '—'}</td>
      </tr>
    `).join('');

    $$$('tr.rowBtn', tbody).forEach(tr => tr.addEventListener('click', () => {
      const id = Number(tr.dataset.id);
      const s = state.sessions.find(x=>x.id===id);
      if (s) openSession(s);
    }));
  }

  // Media wall
  function renderMediaWall() {
    const host = $$('#mediaWall');
    if(!host) return;

    host.innerHTML = '';
    for(const s of state.filtered){
      const card = document.createElement('div');
      card.className = 'mwCard';
      card.innerHTML = `
        <div class="mwStack" data-id="${escapeHtml(String(s.id))}">
          <img class="mwImg" id="mwImg-${escapeHtml(String(s.id))}" alt="" loading="lazy" src="${escapeHtml(resolveUrl('assets/placeholder.svg'))}"/>
          <img class="mwImg mwAlt" id="mwAlt-${escapeHtml(String(s.id))}" alt="" loading="lazy" src="${escapeHtml(resolveUrl('assets/placeholder.svg'))}" style="opacity:0"/>
          <video class="mwVid" id="mwVid-${escapeHtml(String(s.id))}" muted playsinline loop preload="metadata" style="opacity:0"></video>
          <div class="mwBadge">${escapeHtml(s.location?.district || s.location?.city || 'Session')}</div>
        </div>
        <div class="mwMeta">
          <div class="mwTitle">Session ${escapeHtml(String(s.id))} • ${escapeHtml(s.date || '')}</div>
          <div class="mwSub">${escapeHtml(fmtInt(s.metrics?.farmers))} farmers • Score ${escapeHtml(String(Math.round(s.score||0)))}/100</div>
        </div>
      `;
      const stack = card.querySelector('.mwStack');
      stack.addEventListener('click', ()=>openSession(s));
      host.appendChild(card);

      // hydrate with real media
      hydrateMediaCard(s);
    }
  }

  async function hydrateMediaCard(s){
    const id = String(s.id);
    const img = $$('#mwImg-'+id);
    const alt = $$('#mwAlt-'+id);
    const vid = $$('#mwVid-'+id);
    if(!img || !alt || !vid) return;

    const resolved = await resolveSessionMedia(s);
    const imgs = resolved.items.filter(x=>x.kind==='image').map(x=>x.url);
    const vids = resolved.items.filter(x=>x.kind==='video').map(x=>x.url);

    if(imgs[0]){
      img.src = resolveUrl(imgs[0]);
    }
    if(imgs[1]){
      alt.src = resolveUrl(imgs[1]);
      alt.style.opacity = '1';
    }else{
      alt.style.display = 'none';
    }
    if(vids[0]){
      vid.src = resolveUrl(vids[0]);
      vid.style.opacity = '0.0';
      // Reveal video on hover (desktop) or on tap (mobile)
      const parent = img.closest('.mwStack');
      parent.addEventListener('mouseenter', ()=>{ vid.style.opacity='1'; try{vid.play();}catch{} });
      parent.addEventListener('mouseleave', ()=>{ vid.style.opacity='0'; try{vid.pause();}catch{} });
      parent.addEventListener('touchstart', ()=>{ vid.style.opacity='1'; try{vid.play();}catch{} }, {passive:true});
    }else{
      vid.style.display = 'none';
    }
  }  // Map
  function initMap() {
    const el = $$('#map');
    if (!window.L || !el) {
      $$('#mapFallback').classList.remove('hidden');
      el.classList.add('hidden');
      return;
    }

    const map = L.map('map', { zoomControl: false });
    state.map = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    L.control.zoom({ position:'bottomright' }).addTo(map);

    // Delegate popup button clicks
    map.getContainer().addEventListener('click', (ev)=>{
      const btn = ev.target && ev.target.closest ? ev.target.closest('.popupBtn') : null;
      if(!btn) return;
      const id = btn.getAttribute('data-session');
      const s = (state.filtered||[]).find(x=>String(x.id)===String(id)) || (state.sessions||[]).find(x=>String(x.id)===String(id));
      if(s) openSession(s);
    });

    renderMarkers();
    fitMap();
  }

  function markerColor(score) {
    if (typeof score !== 'number') return '#4c6fff';
    if (score >= 80) return '#22c55e';
    if (score >= 65) return '#f59e0b';
    return '#ef4444';
  }

  function renderMarkers() {
    if (!state.map || !window.L) return;
    // clear
    state.markers.forEach(m => { try{ m.remove(); } catch{} });
    state.markers = [];

    for (const s of state.filtered) {
      const lat = s.geo?.lat, lng = s.geo?.lng;
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;
      const acres = s.metrics?.wheatAcres || 0;
      const radius = clamp(Math.sqrt(acres||0) * 1.6, 6, 26);
      const col = markerColor(s.score);
      const marker = L.circleMarker([lat,lng], {
        radius,
        color: col,
        weight: 2,
        fillColor: col,
        fillOpacity: 0.55
      }).addTo(state.map);

      const district = s.location?.district || s.location?.city || '—';
      const farmers = s.metrics?.farmers || 0;
      const score = Math.round(s.score || 0);

      const popupHtml = `
        <div class="mapPopup">
          <div class="mpTitle">${escapeHtml(district)} <span class="mpMeta">• Session ${escapeHtml(String(s.id||''))}</span></div>
          <div class="mpRow">
            <span>Farmers</span><strong>${escapeHtml(String(farmers))}</strong>
            <span style="margin-left:10px">Score</span><strong>${escapeHtml(String(score))}</strong>
          </div>
          <button class="popupBtn" data-session="${escapeHtml(String(s.id))}">View session details</button>
        </div>
      `;
      marker.bindPopup(popupHtml, { closeButton:true, autoPan:true });

      marker.on('click', () => {
        openSession(s);
        try{ marker.openPopup(); }catch{}
        // Ensure session panel is visible on small screens
        const drawer = $$('#drawer');
        drawer?.scrollIntoView({behavior:'smooth', block:'start'});
      });

      state.markers.push(marker);
    }
  }

  function fitMap() {
    if (!state.map || !state.markers.length) return;
    const g = L.featureGroup(state.markers);
    state.map.fitBounds(g.getBounds().pad(0.2));
  }

  
  async function resolveSessionMedia(s){
    const base = (state.media && state.media.galleryBase) ? state.media.galleryBase : 'assets/gallery/';
    const id = String(s.id||'').trim();
    const dedupe = (arr)=>Array.from(new Set(arr.filter(Boolean)));
    const imgCandidates = dedupe([
      ...(s.media?.images||[]),
      `${base}${id}.jpeg`, `${base}${id}a.jpeg`,
      `${base}${id}.jpg`, `${base}${id}a.jpg`,
      `${base}${id}.png`, `${base}${id}a.png`
    ]);
    const vidCandidates = dedupe([
      ...(s.media?.videos||[]),
      `${base}${id}.mp4`, `${base}${id}a.mp4`
    ]);

    const images = [];
    for(const u of imgCandidates){ if(await assetExists(u)) images.push(u); }
    const videos = [];
    for(const u of vidCandidates){ if(await assetExists(u)) videos.push(u); }
    const items = [
      ...images.slice(0,3).map(u=>({kind:'image', url:u})),
      ...videos.slice(0,2).map(u=>({kind:'video', url:u})),
      ...images.slice(3).map(u=>({kind:'image', url:u})),
      ...videos.slice(2).map(u=>({kind:'video', url:u}))
    ].slice(0,10);
    return { items };
  }

// Session drawer
  async function openSession(s) {
    state.selected = s;
    const drawer = $$('#drawer');
    drawer?.scrollIntoView({behavior:'smooth', block:'nearest'});

    $$('#dTitle').textContent = `${safeStr(s.district||s.location?.district||s.location?.city||'Session')} • ${safeStr(s.date||'')}`;
    $$('#dSub').textContent = `${safeStr(s.province||s.location?.province||'Pakistan')} • ${fmtInt(s.metrics?.farmers||0)} farmers • ${fmtInt(s.metrics?.acres||s.metrics?.wheatAcres||0)} acres`;

    $$('#dHost').textContent = safeStr(s.people?.host || s.host);
    $$('#dRep').textContent = safeStr(s.people?.rep || s.rep);
    $$('#dDealer').textContent = safeStr(s.people?.dealer || s.dealer);

    $$('#dFarmers').textContent = fmtInt(s.metrics?.farmers);
    $$('#dAcres').textContent = fmtInt(s.metrics?.acres || s.metrics?.wheatAcres);
    $$('#dAwareness').textContent = fmtPct(s.metrics?.awarenessPct);
    $$('#dIntent').textContent = fmtPct(s.metrics?.intentPct);
    $$('#dClarity').textContent = fmtPct(s.metrics?.clarityPct);
    $$('#dScore').textContent = `${fmtInt(Math.round(s.score||0))}/100`;

    // Share / maps
    const lat = s.geo?.lat, lng = s.geo?.lng;
    const mapsUrl = (typeof lat==='number' && typeof lng==='number') ? `https://www.google.com/maps?q=${lat},${lng}` : '';
    const openMaps = $$('#openMapsBtn');
    if(openMaps){
      openMaps.disabled = !mapsUrl;
      openMaps.onclick = ()=>{ if(mapsUrl) window.open(mapsUrl, '_blank'); };
    }
    const shareBtn = $$('#shareSessionBtn');
    if(shareBtn){
      shareBtn.onclick = async ()=> {
        const u = new URL(window.location.href);
        u.searchParams.set('campaign', state.campaign?.id || '');
        u.hash = `session-${s.id}`;
        await shareUrl(u.toString(), `Session ${s.id} • ${state.campaign?.name||''}`);
      };
    }

    // Media (only existing files)
    const mediaHost = $$('#sessionMedia');
    if(mediaHost){
      mediaHost.innerHTML = '';
      const resolved = await resolveSessionMedia(s);
      if(!resolved.items.length){
        mediaHost.innerHTML = '<div class="emptyState">No media mapped for this session yet.</div>';
      }else{
        for(const it of resolved.items){
          const tile = document.createElement('button');
          tile.className = 'mediaTile';
          tile.type = 'button';
          tile.innerHTML = (it.kind==='video')
            ? `<div class="mediaInner"><video muted playsinline preload="metadata" src="${escapeHtml(url(it.url.replace(/^\/?/,'') ))}"></video><div class="tag">VID</div></div>`
            : `<div class="mediaInner"><img alt="" loading="lazy" src="${escapeHtml(url(it.url.replace(/^\/?/,'') ))}"/><div class="tag">IMG</div></div>`;
          tile.addEventListener('click', ()=>openLightbox(it));
          mediaHost.appendChild(tile);
        }
      }
    }
  }

  // Feedback
  function validEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s||'').trim());
  }
  function validPkPhone(s) {
    const t = (s||'').replace(/\s+/g,'').trim();
    return /^(\+?92|0)?3\d{9}$/.test(t);
  }

  function feedbackPayload() {
    const name = $$('#fbName').value.trim();
    const email = $$('#fbEmail').value.trim();
    const phone = $$('#fbPhone').value.trim();
    const text = $$('#fbText').value.trim();
    const ok = (validEmail(email) || validPkPhone(phone)) && text.length >= 3;
    return { ok, name, email, phone, text };
  }

  function buildFeedbackMessage(p) {
    const sel = $$('#selectionChip').textContent;
    return [
      `INTERACT Campaign Feedback`,
      `Campaign: ${state.campaign?.name||state.campaign?.id||'—'}`,
      `Selection: ${sel}`,
      `Name: ${p.name||'—'}`,
      `Email: ${p.email||'—'}`,
      `Phone: ${p.phone||'—'}`,
      ``,
      p.text
    ].join('\n');
  }

  function sendEmailFeedback() {
    const p = feedbackPayload();
    if (!p.ok) {
      alert('Please enter valid email or phone, and write feedback.');
      return;
    }
    const body = encodeURIComponent(buildFeedbackMessage(p));
    const subject = encodeURIComponent(`Campaign dashboard feedback — ${state.campaign?.id||''}`);
    window.location.href = `mailto:interact@paksaf.com?subject=${subject}&body=${body}`;
  }

  function sendWhatsAppFeedback() {
    const p = feedbackPayload();
    if (!p.ok) {
      alert('Please enter valid email or phone, and write feedback.');
      return;
    }
    const msg = encodeURIComponent(buildFeedbackMessage(p));
    window.open(`https://wa.me/923303570463?text=${msg}`, '_blank');
  }

  async function boot() {
    try{
      setStatus('loading campaigns…');
      const reg = await fetchJson(url('data/campaigns.json'));
      state.campaigns = reg.campaigns || [];
      const cs = $$('#campaignSelect');
      cs.innerHTML = state.campaigns.map(c => `<option value="${c.id}">${escapeHtml(c.name||c.id)}</option>`).join('');

      const wanted = getCampaignFromQuery();
      const chosen = state.campaigns.find(c=>c.id===wanted) || state.campaigns[0];
      if (!chosen) throw new Error('No campaigns defined');
      cs.value = chosen.id;
      setQueryCampaign(chosen.id);

      cs.addEventListener('change', async () => {
        const id = cs.value;
        const c = state.campaigns.find(x=>x.id===id);
        if (c) {
          setQueryCampaign(c.id);
          await loadCampaign(c);
        }
      });

      await loadCampaign(chosen);
      wireUi();
      setStatus('ready');
    }catch(e){
      console.error(e);
      setStatus(`error: ${e.message || e}`, 'warn');
      // leave UI usable but show hint
      alert(`Dashboard failed to load: ${e.message || e}\n\nOpen /data/campaigns.json in your browser to confirm it exists.`);
    }
  }

  async function loadCampaign(c) {
    state.campaign = c;
    setStatus(`loading ${c.id}…`);
    // load media first (for header/bg)
    state.media = await fetchJson(url(c.mediaUrl));
    await initBgVideo(state.media);
    renderHero(state.media);
    await renderFooterBrands(state.media);

    const payload = await fetchJson(url(c.sessionsUrl));
    state.sessions = payload.sessions || payload || [];
    rebuildDistrictOptions();
    // default district all
    $$('#districtSelect').value = 'ALL';

    filterSessions();
    updateKPIs();
    renderTable();
    renderMediaWall();

    // map
    if (!state.map) {
      initMap();
    } else {
      renderMarkers();
      fitMap();
    }
    setStatus('loaded');
  }

  function wireUi() {
    $$('#applyBtn').addEventListener('click', () => {
      filterSessions(); updateKPIs(); renderTable(); renderMediaWall(); renderMarkers(); fitMap();
    });
    $$('#resetBtn').addEventListener('click', () => {
      $$('#districtSelect').value = 'ALL';
      $$('#searchInput').value = '';
      $$('#fromDate').value = '';
      $$('#toDate').value = '';
      filterSessions(); updateKPIs(); renderTable(); renderMediaWall(); renderMarkers(); fitMap();
    });
    $$('#exportBtn').addEventListener('click', () => {
      if (!state.filtered.length) { alert('Nothing to export for current filters.'); return; }
      exportCsv();
    });

    $$('#prevBtn').addEventListener('click', () => { if (state.page>1){ state.page--; renderTable(); } });
    $$('#nextBtn').addEventListener('click', () => {
      const totalPages = Math.max(1, Math.ceil(state.filtered.length/state.pageSize));
      if (state.page<totalPages){ state.page++; renderTable(); }
    });

    $$('#fitBtn').addEventListener('click', fitMap);
    $$('#mapResetBtn').addEventListener('click', () => { renderMarkers(); fitMap(); });

    $$('#drawerClose').addEventListener('click', () => $$('#sessionDrawer').classList.add('hidden'));
    $$('#openMapsBtn').addEventListener('click', () => {
      const s = state.selected;
      if (!s) return;
      const lat = s.geo?.lat, lng = s.geo?.lng;
      if (typeof lat === 'number' && typeof lng === 'number') {
        window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
      } else {
        alert('No coordinates available for this session.');
      }
    });
    $$('#shareSessionBtn').addEventListener('click', async () => {
      const s = state.selected;
      if (!s) return;
      const u = new URL(window.location.href);
      u.searchParams.set('campaign', state.campaign?.id || '');
      u.hash = `session-${s.id}`;
      await shareUrl(u.toString(), `Session ${s.id} • ${state.campaign?.name||''}`);
    });

    // lightbox
    $$('#lightboxClose').addEventListener('click', closeLightbox);
    $$('#lightbox').addEventListener('click', (e) => { if (e.target.id==='lightbox') closeLightbox(); });
    document.addEventListener('keydown', (e) => { if (e.key==='Escape') closeLightbox(); });

    $$('#shareMediaBtn').addEventListener('click', () => {
      if (!state.selectedMediaUrl) return;
      shareUrl(state.selectedMediaUrl, 'Campaign media');
    });
    $$('#copyLinkBtn').addEventListener('click', async () => {
      if (!state.selectedMediaUrl) return;
      try{ await navigator.clipboard.writeText(state.selectedMediaUrl); alert('Link copied.'); }
      catch{ prompt('Copy link:', state.selectedMediaUrl); }
    });

    // feedback
    $$('#emailFeedbackBtn').addEventListener('click', sendEmailFeedback);
    $$('#waFeedbackBtn').addEventListener('click', sendWhatsAppFeedback);
  }

  boot();
})();