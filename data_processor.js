console.log('AgriVista Dashboard loading...');

// Global variables
let map;
let markersLayer; // Now a cluster group for markers
let allSessions = []; // Store full data for filtering

// Initialize map on load
document.addEventListener('DOMContentLoaded', function() {
  // Init Leaflet map (center on Pakistan, zoom level 6)
  map = L.map('map').setView([30.3753, 69.3451], 6);
  
  // Add tile layer (OpenStreetMap)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  
  // Create a marker cluster group with custom icons
  markersLayer = L.markerClusterGroup({
    showCoverageOnHover: true, // Show cluster bounds on hover
    zoomToBoundsOnClick: true, // Zoom to cluster on click
    spiderfyOnMaxZoom: true,   // Spread out markers at max zoom
    iconCreateFunction: function(cluster) {
      var childCount = cluster.getChildCount();
      var size = 40 + (childCount > 10 ? 10 : 0) + (childCount > 50 ? 10 : 0); // Dynamically size based on count
      return L.divIcon({
        html: `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 21v-3.75" />
            <path d="M5.93 9.5l-.43 1.6c-.71 2.66 .87 5.39 3.52 6.1 1 .27 2 .54 3 .8v-3.44c-.16-2.1-1.64-3.88-3.68-4.43l-2.41-.64z" />
            <path d="M13.74 11.16c.45-.45 .82-.99 1.06-1.59 .25-.59 .37-1.23 .37-1.87 0-.64-.13-1.28-.37-1.87-.25-.59-.61-1.14-1.06-1.59" />
          </svg>
          <span>${childCount}</span>
        `,
        className: 'marker-cluster-custom',
        iconSize: new L.Point(size, size)
      });
    }
  }).addTo(map);

  // Load data
  fetch('sessions.json')
    .then(response => response.json())
    .then(data => {
      allSessions = data.sessions; // Store full sessions
      updateMap(allSessions); // Initial plot
      
      // Update summary stats
      document.querySelector('.stat-value:nth-of-type(1)').textContent = data.totalSessions;
      document.querySelector('.stat-value:nth-of-type(2)').textContent = data.totalFarmers;
      document.querySelector('.stat-value:nth-of-type(3)').textContent = data.totalAcres;
      
      // Populate session table, gallery, etc. (extend as needed)
    })
    .catch(error => console.error('Error loading sessions.json:', error));

  // Filter button event
  const applyBtn = document.querySelector('.btn-primary');
  if (applyBtn) {
    applyBtn.addEventListener('click', applyFilters);
  }

  // Reset button
  const resetBtn = document.querySelector('.btn-secondary');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      document.getElementById('cityFilter').value = 'all';
      document.getElementById('dateFrom').value = '2025-11-24';
      document.getElementById('dateTo').value = '2025-12-12';
      applyFilters();
    });
  }
});

// Function to update map with filtered sessions
function updateMap(sessions) {
  markersLayer.clearLayers(); // Clear existing markers/clusters
  
  if (sessions.length === 0) {
    const noDataElem = document.querySelector('#map ~ .no-data-message');
    if (noDataElem) noDataElem.textContent = 'No coordinates available in the filtered set';
    return;
  }
  
  sessions.forEach(session => {
    if (session.latitude && session.longitude) {
      const marker = L.marker([session.latitude, session.longitude])
        .bindPopup(`
          <b>${session.spot}</b><br>
          Date: ${session.date}<br>
          Farmers: ${session.farmers}<br>
          Acres: ${session.acres}<br>
          Facilitator: ${session.facilitator}<br>
          Focus: ${session.focus}
        `);
      markersLayer.addLayer(marker);
    }
  });
  
  // Auto-fit bounds if sessions > 0
  if (sessions.length > 0) {
    const bounds = L.latLngBounds(sessions.map(s => [s.latitude, s.longitude]));
    map.fitBounds(bounds, { padding: [50, 50] });
  }
}

// Function to apply filters and update map + other sections
function applyFilters() {
  const city = document.getElementById('cityFilter').value.toLowerCase();
  const fromDate = new Date(document.getElementById('dateFrom').value);
  const toDate = new Date(document.getElementById('dateTo').value);
  
  const filtered = allSessions.filter(session => {
    const sessionDate = new Date(session.date);
    return (city === 'all' || session.city === city) &&
           (isNaN(fromDate.getTime()) || sessionDate >= fromDate) &&
           (isNaN(toDate.getTime()) || sessionDate <= toDate);
  });
  
  updateMap(filtered);
  
  // Update other sections with filtered data (e.g., recalculate totals)
  const totalFarmers = filtered.reduce((sum, s) => sum + s.farmers, 0);
  // Update DOM accordingly (extend as needed)
}
