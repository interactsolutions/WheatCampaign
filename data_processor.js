/* Harvest Horizons Dashboard */

(() => {
  'use strict';

  const CONFIG = { /* existing */ };

  // ... existing DOM helpers, utils ...

  // Enhanced rendering for themes
  function renderThemes() {
    const ss = state.filteredSessions;

    // Seed: High awareness media
    const seedSs = ss.filter(s => s.awarenessPct > 80);
    const seedMedia = state.media.filter(m => seedSs.some(s => m.spot === s.spot && m.type === 'video'));
    renderCentral('awareness-media', seedMedia);
    setText('awareness-farmers', fmtInt(sum(ss, 'farmers')));
    setText('awareness-acres', fmtInt(sum(ss, 'acres')));
    setText('awareness-pct', fmtPct(avg(ss.map(s => s.awarenessPct))));

    // Growth: Journey videos + map
    const growthMedia = state.media.filter(m => m.type === 'image' && m.caption.includes('Variant'));
    renderCentral('journey-media', growthMedia);
    setText('journey-sessions', fmtInt(ss.length));
    setText('journey-def', fmtPct(avg(ss.map(s => s.definitePct))));
    renderMap(); // Map in orbit

    // Harvest: Impact charts
    const impactMedia = state.media.filter(m => m.transcript.includes('content'));
    renderCentral('impact-media', impactMedia);
    setText('impact-clarity', fmtPct(avg(ss.map(s => s.clarityPct))));
    renderCharts(); // Intent chart in orbit

    // Future: Table + shares
    const futureMedia = state.media.slice(0, 5);
    renderCentral('future-media', futureMedia);
    renderSessionsTable(); // Cleaned

    // Orbit adjustments (dynamic radii)
    $$('.data-planet').forEach((p, i) => {
      p.style.animation = `orbit ${20 + i*5}s linear infinite`;
    });

    // Share button: Generate canvas visual
    $$('.share-btn').forEach(btn => btn.addEventListener('click', shareVisual));
  }

  function renderCentral(id, items) {
    const cont = $(id);
    cont.innerHTML = '';
    if (items.length) {
      const it = items[Math.floor(Math.random() * items.length)]; // Random for variety
      const el = document.createElement(it.type);
      el.src = it.src || CONFIG.placeholder;
      el.alt = it.caption;
      if (it.type === 'video') el.controls = true;
      cont.appendChild(el);
    }
  }

  function shareVisual() {
    const canvas = document.createElement('canvas');
    canvas.width = 800; canvas.height = 600;
    const ctx = canvas.getContext('2d');
    // Draw media + stats (simplified)
    const img = new Image();
    img.src = state.media[0].src;
    img.onload = () => {
      ctx.drawImage(img, 0, 0, 800, 600);
      ctx.fillStyle = 'white'; ctx.font = 'bold 30px Roboto';
      ctx.fillText(`Farmers: ${state.totals.farmers}`, 20, 50);
      // ... more stats
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url; a.download = 'harvest-visual.png'; a.click();
    };
  }

  // Cleaned table: No SN/coords
  function renderSessionsTable() {
    const tb = $('tblSessions');
    tb.innerHTML = '';
    state.filteredSessions.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${fmtDate(s.date)}</td>
        <td>${escapeHtml(s.city)}</td>
        <td>${escapeHtml(s.spot)}</td>
        <td class="right">${fmtInt(s.farmers)}</td>
        <td class="right">${fmtInt(s.acres)}</td>
        <td class="right">${fmtPct(s.definitePct)}</td>
        <td class="right">${fmtPct(s.awarenessPct)}</td>
        <td class="right">${fmtPct(s.clarityPct)}</td>
      `;
      tb.appendChild(tr);
    });
  }

  // Map: Scaled circles by acres, banner info
  function renderMap() {
    // Existing, plus:
    state.filteredSessions.forEach(s => {
      if (!isNaN(s.lat) && !isNaN(s.lon)) {
        L.circle([s.lat, s.lon], {
          radius: (s.acres || 100) * 10, // Scale by acres
          color: '#86efac',
          fillOpacity: 0.6
        }).addTo(state.map.obj).on('click', () => {
          setText('mapSelFarmers', fmtInt(s.farmers));
          setText('mapSelAcres', fmtInt(s.acres));
          // Banner update
        });
      }
    });
  }

  // Filters: Spot names, auto-date
  function updateSpotOptions() {
    el.filterSpot.innerHTML = '<option value="">All</option>';
    const spots = uniq(state.sessions
      .filter(s => !state.filter.city || s.city === state.filter.city)
      .map(s => s.spot)
    ).sort();
    spots.forEach(sp => {
      const opt = document.createElement('option');
      opt.value = sp;
      opt.text = sp;
      el.filterSpot.appendChild(opt);
    });
  }

  function applyFilters() {
    // Existing, plus auto-date
    if (state.filteredSessions.length === 1) {
      setText('filter-date', fmtDate(state.filteredSessions[0].date));
    } else {
      setText('filter-date', 'Multiple');
    }
    renderThemes();
  }

  // ... rest existing ...

})();
