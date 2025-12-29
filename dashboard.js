
(() => {
  'use strict';

  const $$ = (sel, root=document) => root.querySelector(sel);
  const $$$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const fmtInt = (n) => (n === null || n === undefined || Number.isNaN(n)) ? '—' : new Intl.NumberFormat().format(Math.round(n));
  const fmt1 = (n) => (n === null || n === undefined || Number.isNaN(n)) ? '—' : (Math.round(n*10)/10).toFixed(1);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const BASE = new URL('./', window.location.href); // resolves /WheatCampaign/
  const url = (rel) => new URL(rel, BASE).toString();

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

  function getCampaignFromQuery() {
    const p = new URLSearchParams(window.location.search);
    return p.get('campaign');
  }

  function setQueryCampaign(id) {
    const u = new URL(window.location.href);
    u.searchParams.set('campaign', id);
    history.replaceState({}, '', u.toString());
  }

  function renderHeaderMedia(cfg) {
    const host = $$('#headerMedia');
    host.innerHTML = '';
    const seq = (cfg && cfg.headerSequence) ? cfg.headerSequence : [];
    for (const item of seq) {
      const tile = document.createElement('div');
      tile.className = 'headerTile';
      const vid = document.createElement('video');
      vid.muted = true;
      vid.loop = true;
      vid.autoplay = true;
      vid.playsInline = true;
      vid.preload = 'metadata';
      vid.src = url(item.video.replace(/^\/?/,''));
      const img = document.createElement('img');
      img.src = url(item.poster.replace(/^\/?/,''));
      img.alt = item.label || '';
      // fallback logic
      let videoOk = true;
      vid.addEventListener('error', () => {
        videoOk = false;
        vid.remove();
        img.style.display = 'block';
      });
      vid.addEventListener('canplay', () => {
        if (!videoOk) return;
        vid.play().catch(() => {
          // iOS may block; show poster
          vid.remove();
          img.style.display = 'block';
        });
      });
      tile.appendChild(vid);
      tile.appendChild(img);
      const badge = document.createElement('div');
      badge.className = 'badge';
      badge.textContent = item.label || '';
      tile.appendChild(badge);
      host.appendChild(tile);
    }
  }

  function initBgVideo(cfg) {
    const v = $$('#bgVideo');
    if (!v) return;
    v.src = url(cfg.backgroundVideo.replace(/^\/?/,''));
    v.addEventListener('error', () => {
      v.style.display = 'none';
    });
    v.play().catch(() => {
      // iOS autoplay
      v.style.display = 'none';
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
    const from = $$('#fromDate').value ? new Date($$('#fromDate').value) : null;
    const to = $$('#toDate').value ? new Date($$('#toDate').value) : null;

    const res = state.sessions.filter(s => {
      if (district && district !== 'ALL' && (s.district||'') !== district) return false;
      if (from) {
        const d = s.date ? new Date(s.date) : null;
        if (d && d < from) return false;
      }
      if (to) {
        const d = s.date ? new Date(s.date) : null;
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
    const dateLabel = (from || to) ? `${from ? from.toISOString().slice(0,10) : '…'} → ${to ? to.toISOString().slice(0,10) : '…'}` : 'All dates';
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
    const ph = state.media?.placeholder ? url(state.media.placeholder.replace(/^\/?/,'') ) : url('assets/placeholder.svg');

    const cards = state.filtered.map(s => {
      // Use first image/video of those that are from gallery
      const img0 = (s.media?.images||[]).find(p=>p && p.startsWith('gallery/'));
      const img1 = (s.media?.images||[]).find(p=>p && p.startsWith('gallery/') && p !== img0);
      const vid0 = (s.media?.videos||[]).find(p=>p && p.startsWith('gallery/'));
      const imgUrl0 = img0 ? url(state.media.galleryBase + img0.replace('gallery/','')) : ph;
      const imgUrl1 = img1 ? url(state.media.galleryBase + img1.replace('gallery/','')) : ph;
      const vidUrl0 = vid0 ? url(state.media.galleryBase + vid0.replace('gallery/','')) : null;

      return { s, imgUrl0, imgUrl1, vidUrl0 };
    });

    host.innerHTML = cards.map(({s,imgUrl0,imgUrl1,vidUrl0}) => {
      const sub = `${s.district || s.city || ''}${s.date ? ' • ' + s.date : ''}`;
      return `
        <div class="mediaCard" data-id="${s.id}">
          <div class="mediaStack">
            <img src="${imgUrl0}" alt="" onerror="this.onerror=null;this.src='${ph}'">
            <img class="alt" src="${imgUrl1}" alt="" onerror="this.onerror=null;this.style.display='none'">
            ${vidUrl0 ? `<video muted loop playsinline preload="metadata" src="${vidUrl0}"></video>` : ``}
          </div>
          <div class="mediaOverlay"></div>
          <div class="mediaMeta">
            <div>
              <div class="t">Session ${s.id}: ${escapeHtml(s.spot || '—')}</div>
              <div class="s">${escapeHtml(sub)}</div>
            </div>
            <div class="mediaBtns">
              <div class="mediaIcon" title="Open" data-act="open">⤢</div>
              <div class="mediaIcon" title="Share" data-act="share">⤴</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    $$$('.mediaCard', host).forEach(card => {
      const id = Number(card.dataset.id);
      const s = state.sessions.find(x=>x.id===id);
      const vid = $$('video', card);
      if (vid) {
        card.addEventListener('mouseenter', () => vid.play().catch(()=>{}));
        card.addEventListener('mouseleave', () => { try{vid.pause(); vid.currentTime=0;}catch{} });
        // mobile: tap to play/pause
        card.addEventListener('touchstart', () => {
          if (vid.paused) vid.play().catch(()=>{}); else vid.pause();
        }, {passive:true});
      }
      $$$('.mediaIcon', card).forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = btn.dataset.act;
        if (act === 'open') {
          openSession(s);
        } else if (act === 'share') {
          const any = firstShareableMedia(s);
          if (any) shareUrl(any, `Session ${s.id} media`);
        }
      }));
      card.addEventListener('click', () => openSession(s));
    });
  }

  function firstShareableMedia(s) {
    const g = state.media?.galleryBase || 'assets/gallery/';
    const img = (s.media?.images||[]).find(p=>p && p.startsWith('gallery/'));
    if (img) return url(g + img.replace('gallery/',''));
    const vid = (s.media?.videos||[]).find(p=>p && p.startsWith('gallery/'));
    if (vid) return url(g + vid.replace('gallery/',''));
    return null;
  }

  // Map
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
      const m = L.circleMarker([lat,lng], {
        radius,
        color: markerColor(s.score),
        weight: 2,
        fillColor: markerColor(s.score),
        fillOpacity: 0.55
      }).addTo(state.map);
      m.on('click', () => openSession(s));
      state.markers.push(m);
    }
  }

  function fitMap() {
    if (!state.map || !state.markers.length) return;
    const g = L.featureGroup(state.markers);
    state.map.fitBounds(g.getBounds().pad(0.2));
  }

  // Session drawer
  function openSession(s) {
    state.selected = s;
    const drawer = $$('#sessionDrawer');
    drawer.classList.remove('hidden');

    $$('#dTitle').textContent = `Session ${s.id}: ${s.spot || '—'}`;
    $$('#dSub').textContent = `${s.district || s.city || '—'}${s.date ? ' • ' + s.date : ''}`;

    $$('#dHost').textContent = fmtPerson(s.host);
    $$('#dRep').textContent = fmtPerson(s.salesRep);
    $$('#dDealer').textContent = fmtPerson(s.dealer);

    $$('#dFarmers').textContent = fmtInt(s.metrics?.farmers);
    $$('#dAcres').textContent = fmtInt(s.metrics?.wheatAcres);
    $$('#dDefinite').textContent = (s.metrics?.definitePct ?? '—') + (s.metrics?.definitePct!=null ? '%' : '');
    $$('#dScore').textContent = s.score ?? '—';
    $$('#dTopUse').textContent = s.topReasonUse || '—';
    $$('#dTopNotUse').textContent = s.topReasonNotUse || '—';

    // drawer media thumbnails
    const host = $$('#drawerMedia');
    host.innerHTML = '';
    const ph = state.media?.placeholder ? url(state.media.placeholder.replace(/^\/?/,'') ) : url('assets/placeholder.svg');
    const gb = state.media?.galleryBase || 'assets/gallery/';

    const imgs = (s.media?.images||[]).filter(p=>p && p.startsWith('gallery/'));
    const vids = (s.media?.videos||[]).filter(p=>p && p.startsWith('gallery/'));

    const items = [
      ...imgs.map(p => ({type:'img', url: url(gb + p.replace('gallery/','')) })),
      ...vids.map(p => ({type:'vid', url: url(gb + p.replace('gallery/','')) })),
    ];

    if (!items.length) {
      host.innerHTML = `<div class="muted">No media mapped for this session.</div>`;
    } else {
      for (const it of items) {
        const t = document.createElement('div');
        t.className = 'thumb';
        t.innerHTML = it.type === 'img'
          ? `<img src="${it.url}" alt="" onerror="this.onerror=null;this.src='${ph}'"><div class="type">IMG</div>`
          : `<video muted playsinline preload="metadata" src="${it.url}"></video><div class="type">VID</div>`;
        t.addEventListener('click', () => openLightbox(it));
        host.appendChild(t);
      }
    }

    // map pan
    if (state.map && window.L && typeof s.geo?.lat === 'number' && typeof s.geo?.lng === 'number') {
      state.map.setView([s.geo.lat, s.geo.lng], Math.max(state.map.getZoom(), 11));
    }
  }

  function fmtPerson(p) {
    if (!p) return '—';
    const name = (p.name||'').trim();
    const phone = (p.phone||'').trim();
    if (!name && !phone) return '—';
    return phone ? `${name || '—'} (${phone})` : (name || '—');
  }

  // Lightbox
  function openLightbox(it) {
    const lb = $$('#lightbox');
    const body = $$('#lightboxBody');
    lb.classList.remove('hidden');
    lb.setAttribute('aria-hidden','false');
    state.selectedMediaUrl = it.url;
    body.innerHTML = it.type === 'img'
      ? `<img src="${it.url}" alt="">`
      : `<video controls playsinline src="${it.url}"></video>`;
  }

  function closeLightbox() {
    const lb = $$('#lightbox');
    lb.classList.add('hidden');
    lb.setAttribute('aria-hidden','true');
    $$('#lightboxBody').innerHTML = '';
    state.selectedMediaUrl = null;
  }

  async function shareUrl(u, title='Campaign media') {
    try{
      if (navigator.share) {
        await navigator.share({ title, text: title, url: u });
        return true;
      }
    }catch{}
    try{
      await navigator.clipboard.writeText(u);
      alert('Link copied to clipboard.');
      return true;
    }catch{
      prompt('Copy this link:', u);
      return false;
    }
  }

  // Export
  function exportCsv() {
    const rows = state.filtered.map(s => ({
      id: s.id,
      date: s.date,
      district: s.district,
      spot: s.spot,
      farmers: s.metrics?.farmers,
      acres: s.metrics?.wheatAcres,
      awarenessPct: s.metrics?.awarenessPct,
      usedLastYearPct: s.metrics?.usedLastYearPct,
      definitePct: s.metrics?.definitePct,
      avgUnderstanding: s.metrics?.avgUnderstanding,
      score: s.score
    }));
    const header = Object.keys(rows[0]||{});
    const csv = [header.join(',')].concat(rows.map(r => header.map(k => `"${String(r[k]??'').replace(/"/g,'""')}"`).join(','))).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const filename = `campaign_${state.campaign?.id||'export'}.csv`;

    // iOS-friendly share fallback
    const file = new File([blob], filename, {type: blob.type});
    if (navigator.canShare && navigator.canShare({files:[file]})) {
      navigator.share({files:[file], title: filename}).catch(()=>{});
      return;
    }
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // iOS: open in new tab
    const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isiOS) window.open(u, '_blank');
    setTimeout(()=>URL.revokeObjectURL(u), 5000);
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
    initBgVideo(state.media);
    renderHeaderMedia(state.media);

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
