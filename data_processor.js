/* Harvest Horizons Dashboard - Data Processor
   - Handles sessions.json and media.json
   - Implements Thematic (Seed, Growth, Harvest, Future) rendering
*/

(() => {
  'use strict';

  // ---------------------------
  // Config (File paths, etc.)
  // ---------------------------
  const CONFIG = {
    sessionsJson: 'sessions.json',
    mediaJson: 'media.json',
    heroVideo: 'assets/bg.mp4',
    placeholder: 'assets/placeholder.svg', // Ensure this file exists at assets/placeholder.svg
    tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', // OpenStreetMap tiles
    attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
  };

  // ---------------------------
  // DOM & Utility Helpers
  // ---------------------------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const el = {
    shell: $('#appShell'),
    overlay: $('#loadingOverlay'),
    status: $('#loadingStatus'),
    filterCity: $('#filter-city'),
    filterSpot: $('#filter-spot'),
    chartIntent: $('#chartIntent'),
    tblSessions: $('#tblSessions') // Ensure this is defined in your HTML
  };

  const state = {
    sessions: [],
    media: [],
    filteredSessions: [],
    totals: { farmers: 0, acres: 0 },
    filter: { city: '', spot: '', dateFrom: null, dateTo: null },
    map: { obj: null, markers: [] },
    charts: { intent: null }
  };
  
  // Basic Utility Functions
  const fmtInt = (n) => (n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const fmtPct = (n) => `${(n || 0).toFixed(1)}%`;
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const sum = (arr, prop) => arr.reduce((acc, item) => acc + (item[prop] || 0), 0);
  const avg = (arr) => arr.length ? sum(arr.filter(n => !isNaN(n)), 'value') / arr.length : 0;
  const uniq = (arr) => [...new Set(arr)];
  const escapeHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  
  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }
  
  function showError(message) {
      el.overlay.style.display = 'none';
      const err = document.getElementById('errorContainer');
      if (err) {
          err.style.display = 'flex';
          err.innerHTML = `<h2>Error</h2><p>${message}</p>`;
      }
  }

  // ---------------------------
  // Data Loading
  // ---------------------------
  async function loadData() {
    el.status.textContent = 'Loading Session Data...';
    try {
      const sessionRes = await fetch(CONFIG.sessionsJson);
      if (!sessionRes.ok) throw new Error(`Failed to load ${CONFIG.sessionsJson}: ${sessionRes.statusText}`);
      const sessionData = await sessionRes.json();
      state.sessions = sessionData.sessions || [];
      logDiag(`Sessions loaded: ${state.sessions.length}`);

      el.status.textContent = 'Loading Media Assets...';
      const mediaRes = await fetch(CONFIG.mediaJson);
      if (!mediaRes.ok) throw new Error(`Failed to load ${CONFIG.mediaJson}: ${mediaRes.statusText}`);
      const mediaData = await mediaRes.json();
      state.media = mediaData.sessions || [];
      logDiag(`Media items loaded: ${state.media.length}`);

      // Initial map setup (needs to happen early)
      initMap(); 

      // Populate filters and initial render
      populateFilters();
      applyFilters();

      // Done
      el.overlay.style.opacity = '0';
      setTimeout(() => { el.overlay.style.display = 'none'; }, 250);

    } catch (e) {
      showError(`Dashboard failed to load: ${escapeHtml(e.message)}<br/>
        Please ensure <code>sessions.json</code> and <code>media.json</code> are correctly formatted and accessible.`);
    }
  }

  // ---------------------------
  // Filter Logic
  // ---------------------------
  function populateFilters() {
    if (el.filterCity) {
      el.filterCity.innerHTML = '<option value="">All Cities</option>';
      const cities = uniq(state.sessions.map(s => s.city)).sort();
      cities.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.text = c;
        el.filterCity.appendChild(opt);
      });
      el.filterCity.addEventListener('change', () => { 
        state.filter.city = el.filterCity.value;
        state.filter.spot = ''; // Reset spot filter on city change
        updateSpotOptions();
        applyFilters(); 
      });
    }
    updateSpotOptions();
    
    // Add event listeners for other filters here (date, search, etc.)
  }
  
  function updateSpotOptions() {
    if (el.filterSpot) {
      el.filterSpot.innerHTML = '<option value="">All Spots</option>';
      const spots = uniq(state.sessions
        .filter(s => !state.filter.city || s.city === state.filter.city)
        .map(s => s.spot)
        .filter(s => s) // Remove empty spots
      ).sort();
      spots.forEach(sp => {
        const opt = document.createElement('option');
        opt.value = sp;
        opt.text = sp;
        el.filterSpot.appendChild(opt);
      });
      el.filterSpot.addEventListener('change', () => {
        state.filter.spot = el.filterSpot.value;
        applyFilters();
      });
    }
  }
  
  function applyFilters() {
    state.filteredSessions = state.sessions.filter(s => {
      let pass = true;
      if (state.filter.city && s.city !== state.filter.city) pass = false;
      if (state.filter.spot && s.spot !== state.filter.spot) pass = false;
      // Add date/search filters here
      return pass;
    });

    // Update totals
    state.totals.farmers = sum(state.filteredSessions, 'farmers');
    state.totals.acres = sum(state.filteredSessions, 'acres');

    // Update filter summary date
    if (state.filteredSessions.length === 1) {
        setText('filter-date', fmtDate(state.filteredSessions[0].date));
    } else if (state.filteredSessions.length > 1) {
        const dates = state.filteredSessions.map(s => new Date(s.date)).sort((a,b) => a - b);
        setText('filter-date', `${fmtDate(dates[0])} to ${fmtDate(dates[dates.length-1])}`);
    } else {
        setText('filter-date', 'None');
    }

    renderThemes();
  }

  // ---------------------------
  // Thematic Rendering (NEW LOGIC)
  // ---------------------------

  function renderThemes() {
    const ss = state.filteredSessions;
    
    // --- Seed: High awareness media ---
    const seedSs = ss.filter(s => (s.awarenessPct || 0) > 80);
    const seedMedia = state.media.filter(m => seedSs.some(s => m.spot === s.spot && m.city === s.city && m.date === s.date && m.theme === 'seed-awareness'));
    renderCentral('awareness-media', seedMedia.length ? seedMedia : state.media.filter(m => m.theme === 'seed-awareness')); // Fallback to any 'seed' media
    setText('awareness-farmers', fmtInt(sum(seedSs, 'farmers')));
    setText('awareness-acres', fmtInt(sum(seedSs, 'acres')));
    setText('awareness-pct', fmtPct(avg(seedSs.map(s => s.awarenessPct))));

    // --- Growth: Journey videos + map ---
    const growthMedia = state.media.filter(m => m.theme === 'growth-journey' && m.type === 'video');
    renderCentral('journey-media', growthMedia.length ? growthMedia : state.media.filter(m => m.theme === 'growth-journey'));
    setText('journey-sessions', fmtInt(ss.length));
    setText('journey-def', fmtPct(avg(ss.map(s => s.definitePct))));
    renderMap(); // Map update

    // --- Harvest: Impact charts ---
    const impactMedia = state.media.filter(m => m.theme === 'harvest-impact');
    renderCentral('impact-media', impactMedia.length ? impactMedia : state.media.filter(m => m.theme === 'harvest-impact'));
    setText('impact-clarity', fmtPct(avg(ss.map(s => s.clarityPct))));
    renderIntentChart(ss); 

    // --- Future: Table + shares ---
    const futureMedia = state.media.filter(m => m.theme === 'future-fields');
    renderCentral('future-media', futureMedia.length ? futureMedia : state.media.filter(m => m.theme === 'future-fields').slice(0, 5));
    renderSessionsTable(); 

    // Orbit adjustments (dynamic radii)
    $$('.data-planet').forEach((p, i) => {
      // Re-apply animation to ensure start is smooth
      const duration = 20 + (i % 3) * 5; 
      p.style.animation = `none`;
      p.offsetHeight; // Trigger reflow
      p.style.animation = `orbit ${duration}s linear infinite`;
    });
    
    // Share button: Generate canvas visual
    $$('.share-btn').forEach(btn => btn.onclick = shareVisual);
  }

  function renderCentral(id, items) {
    const cont = $(id);
    cont.innerHTML = '';
    
    // Filter out items without an ID to prevent errors
    const validItems = items.filter(i => i.id); 

    if (validItems.length) {
      // Randomly select one media item for the center
      const it = validItems[Math.floor(Math.random() * validItems.length)]; 
      
      const el = document.createElement(it.type || 'img');
      const basePath = 'assets/gallery/'; // Base path from media.json

      // Determine the source based on type
      let src = CONFIG.placeholder;
      if (it.type === 'video' && it.id) {
        src = `${basePath}${it.id}.mp4`;
      } else if (it.type === 'image' && it.id) {
        src = `${basePath}${it.id}.jpg`;
      }
      
      el.src = src;
      el.alt = it.caption || 'Session Media';
      
      if (it.type === 'video') {
        el.controls = true;
        el.muted = true;
        el.loop = true;
      }
      
      // Critical: Add onerror handler to hide missing media silently
      el.onerror = function() { this.style.display = 'none'; };

      cont.appendChild(el);
    } else {
        // Fallback placeholder if no media is found for the theme
        cont.innerHTML = `<img src="${CONFIG.placeholder}" alt="Placeholder" style="width: 100%; height: 100%; object-fit: contain; opacity: 0.5;">`;
    }
  }
  
  function renderSessionsTable() {
    const tb = $('#tblSessions');
    if (!tb) return;
    tb.innerHTML = '';
    state.filteredSessions.forEach(s => {
      const tr = document.createElement('tr');
      // Use an attribute to store SN for future row clicking/linking if needed
      tr.dataset.sn = s.sn; 
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

  // ---------------------------
  // Map Logic
  // ---------------------------
  
  function initMap() {
    if (state.map.obj) return;
    const mapElement = $('#map');
    if (!mapElement) return;

    // Use a central point of your data as default view (e.g., first session)
    const defaultCenter = state.sessions.length 
        ? [state.sessions[0].lat, state.sessions[0].lon]
        : [30.3753, 69.3451]; // Default to center of Pakistan

    state.map.obj = L.map('map', {
        center: defaultCenter,
        zoom: 6
    });

    L.tileLayer(CONFIG.tileLayer, {
        maxZoom: 18,
        attribution: CONFIG.attribution
    }).addTo(state.map.obj);
    
    // Force map size refresh after it's initialized
    state.map.obj.invalidateSize(); 
  }
  
  function renderMap() {
    if (!state.map.obj) return;

    // Clear existing markers/circles
    state.map.markers.forEach(m => state.map.obj.removeLayer(m));
    state.map.markers = [];

    let bounds = [];
    
    state.filteredSessions.forEach(s => {
      if (!isNaN(s.lat) && !isNaN(s.lon) && s.lat && s.lon) {
        const latLng = [s.lat, s.lon];
        bounds.push(latLng);
        
        // Scale circle radius by acres (minimum 100 acres for visibility)
        const radius = Math.max(100, (s.acres || 100) * 8); 
        
        const circle = L.circle(latLng, {
          radius: radius, 
          color: '#86efac',
          fillOpacity: 0.6,
          weight: 1
        }).addTo(state.map.obj);

        // Add popup for details
        circle.bindPopup(`
            <strong>${escapeHtml(s.spot)}</strong><br/>
            ${fmtInt(s.farmers)} Farmers, ${fmtInt(s.acres)} Acres<br/>
            Definite: ${fmtPct(s.definitePct)}
        `);
        
        // Add click listener to update the banner (Growth Journey section)
        circle.on('click', () => {
          setText('mapSelFarmers', fmtInt(s.farmers));
          setText('mapSelAcres', fmtInt(s.acres));
        });
        
        state.map.markers.push(circle);
      }
    });
    
    // Zoom map to fit all data points if filter is active
    if (bounds.length > 0) {
        const latLngBounds = L.latLngBounds(bounds);
        // Only fit if there's more than one point, otherwise center on the point.
        if (bounds.length > 1) {
            state.map.obj.fitBounds(latLngBounds, { padding: [50, 50] });
        } else {
            state.map.obj.setView(bounds[0], 10); // Center on single point, zoom 10
        }
    } else {
        // Reset to default view if no sessions are filtered
        state.map.obj.setView([30.3753, 69.3451], 6);
    }
  }


  // ---------------------------
  // Chart Logic
  // ---------------------------

  function destroyChart(chartInstance) {
    if (chartInstance) {
      chartInstance.destroy();
      return null;
    }
    return null;
  }
  
  function renderIntentChart(rows) {
    if (!el.chartIntent) return;
    
    const totalFarmers = sum(rows, 'farmers');
    const definite = sum(rows, 'definite');
    const maybe = sum(rows, 'maybe');
    const notInterested = sum(rows, 'notInterested');
    const remaining = totalFarmers - (definite + maybe + notInterested);

    const intentData = {
        labels: ['Definite', 'Maybe', 'Not Interested', 'No Data'],
        values: [definite, maybe, notInterested, remaining],
        colors: ['#86efac', '#fbbf24', '#fb7185', '#9fb0ca']
    };
    
    state.charts.intent = destroyChart(state.charts.intent);
    
    state.charts.intent = new Chart(el.chartIntent, {
      type: 'pie',
      data: {
        labels: intentData.labels,
        datasets: [{
          data: intentData.values,
          backgroundColor: intentData.colors,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
          legend: { 
            display: false // Hide legend for the small orbiting planet
          } 
        }
      }
    });
  }


  // ---------------------------
  // Share Logic
  // ---------------------------

  function shareVisual() {
    alert("Generating share visual is complex for a plain HTML/JS dashboard. Please use your browser's screenshot tool for now.\n\n(A proper implementation requires HTML2Canvas or similar library which is not included.)");
    // // The implementation provided in the suggestion is basic and requires an image load, 
    // // which can be tricky due to CORS/timing. 
    // // Simplified implementation to show concept:
    // const canvas = document.createElement('canvas');
    // canvas.width = 800; canvas.height = 600;
    // const ctx = canvas.getContext('2d');
    // ctx.fillStyle = CONFIG.sessions.length > 0 ? 'var(--panel2)' : '#070c15';
    // ctx.fillRect(0, 0, 800, 600);
    // ctx.fillStyle = 'white'; ctx.font = 'bold 40px ui-sans-serif';
    // ctx.fillText('Harvest Horizons Report', 50, 80);
    // ctx.font = '30px ui-sans-serif';
    // ctx.fillText(`Total Farmers: ${fmtInt(state.totals.farmers)}`, 50, 150);
    // ctx.fillText(`Total Acres: ${fmtInt(state.totals.acres)}`, 50, 200);
    // const url = canvas.toDataURL('image/png');
    // const a = document.createElement('a');
    // a.href = url; a.download = 'harvest-visual.png'; a.click();
  }
  
  // ---------------------------
  // Bootstrapping
  // ---------------------------
  function logDiag(msg) {
    console.log(`[HH] ${msg}`);
  }

  window.addEventListener('load', loadData);
})();
