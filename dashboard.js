// dashboard.js - FIXED VERSION
console.log('AgriVista Dashboard v2.5 - FIXED initializing...');

// GLOBAL STATE
let allSessions = [];
let currentFilteredSessions = [];
let mediaItems = [];
let map;
let markerCluster;
let currentPage = 1;
const itemsPerPage = 10;

// DOM ELEMENTS
const elements = {
    sessionCount: document.getElementById('sessionCount'),
    farmerCount: document.getElementById('farmerCount'),
    acreCount: document.getElementById('acreCount'),
    cityCount: document.getElementById('cityCount'),
    totalSessions: document.getElementById('totalSessions'),
    totalFarmers: document.getElementById('totalFarmers'),
    totalAcres: document.getElementById('totalAcres'),
    statusIndicator: document.getElementById('statusIndicator'),
    mapStats: document.getElementById('mapStats'),
    mediaGallery: document.getElementById('mediaGallery'),
    sessionsTableBody: document.getElementById('sessionsTableBody'),
    shownSessions: document.getElementById('shownSessions'),
    totalSessionsCount: document.getElementById('totalSessionsCount'),
    errorBanner: document.getElementById('errorBanner'),
    errorMessage: document.getElementById('errorMessage'),
    loadingOverlay: document.getElementById('loadingOverlay')
};

// INITIALIZE EVERYTHING
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM loaded. Starting initialization...');
    
    // Setup event listeners FIRST
    setupEventListeners();
    initializeTabs();
    
    // Set date max to today
    const today = new Date().toISOString().split('T')[0];
    const dateTo = document.getElementById('dateTo');
    if (dateTo) {
        dateTo.max = today;
        dateTo.value = '2025-12-12';
    }
    
    // Set date from
    const dateFrom = document.getElementById('dateFrom');
    if (dateFrom) {
        dateFrom.value = '2025-11-24';
    }
    
    // Load data
    loadAllData();
});

// LOAD ALL DATA - FIXED VERSION
async function loadAllData() {
    try {
        updateStatus('Loading dashboard data...', 'loading');
        
        // TRY TO LOAD sessions.json - USE EMBEDDED DATA IF NOT FOUND
        try {
            // First try to fetch from file
            const sessionsResponse = await fetch('sessions.json');
            if (sessionsResponse.ok) {
                const sessionsData = await sessionsResponse.json();
                allSessions = sessionsData.sessions || [];
                console.log(`Loaded ${allSessions.length} sessions from file`);
                updateStatus('Loaded session data from file', 'success');
            } else {
                // If file not found, use embedded data
                console.warn('sessions.json not found, using embedded data');
                await loadEmbeddedSessionsData();
            }
        } catch (fetchError) {
            console.warn('Fetch error, using embedded data:', fetchError);
            await loadEmbeddedSessionsData();
        }
        
        currentFilteredSessions = [...allSessions];
        
        // TRY TO LOAD media.json - USE EMBEDDED DATA IF NOT FOUND
        try {
            const mediaResponse = await fetch('media.json');
            if (mediaResponse.ok) {
                const mediaData = await mediaResponse.json();
                mediaItems = mediaData.mediaItems || [];
                console.log(`Loaded ${mediaItems.length} media items from file`);
            } else {
                console.warn('media.json not found, using fallback');
                mediaItems = createFallbackMedia();
            }
        } catch (mediaError) {
            console.warn('Failed to load media data:', mediaError);
            mediaItems = createFallbackMedia();
        }

        // UPDATE THE ENTIRE DASHBOARD
        updateDashboardStats();
        initializeMap();
        renderGallery();
        renderSessionsTable();
        initializeAnalyticsCharts();
        
        // Hide loading overlay
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = 'none';
        }
        
        updateStatus('Dashboard loaded successfully', 'success');
        console.log('Dashboard initialization complete.');

    } catch (error) {
        console.error('Fatal error loading data:', error);
        showError(`Data loading error: ${error.message}. Using embedded data.`);
        updateStatus('Using embedded data', 'warning');
        
        // Load fallback data
        await loadEmbeddedSessionsData();
        mediaItems = createFallbackMedia();
        
        // Update dashboard with fallback data
        updateDashboardStats();
        renderSessionsTable();
        initializeMap();
        renderGallery();
        initializeAnalyticsCharts();
        
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = 'none';
        }
    }
}

// EMBEDDED SESSIONS DATA - Fallback when sessions.json is not available
async function loadEmbeddedSessionsData() {
    console.log('Loading embedded session data...');
    
    // Create embedded sessions data from your provided JSON
    const embeddedSessions = [
        // Sukkur sessions
        {id: 1, sessionNumber: "SKR-01", city: "sukkur", cityName: "Ubaro", spot: "Ameen khan Chacharr", date: "2025-11-24", day: "Monday", farmers: 42, acres: 553, latitude: 27.7132, longitude: 68.8482, facilitator: "Ali Raza", focus: "Product Introduction", type: "education"},
        {id: 2, sessionNumber: "SKR-02", city: "sukkur", cityName: "Ubaro", spot: "Naseer Dhondo", date: "2025-11-24", day: "Monday", farmers: 46, acres: 553, latitude: 27.7232, longitude: 68.8582, facilitator: "Bilal Ahmed", focus: "Application Techniques", type: "demonstration"},
        {id: 3, sessionNumber: "SKR-03", city: "sukkur", cityName: "Dharki", spot: "Matal Mahar", date: "2025-11-25", day: "Tuesday", farmers: 39, acres: 553, latitude: 27.6832, longitude: 68.8382, facilitator: "Faisal Khan", focus: "Dosage Guidelines", type: "training"},
        {id: 4, sessionNumber: "SKR-04", city: "sukkur", cityName: "Dharki", spot: "Abdullah Rajni", date: "2025-11-25", day: "Tuesday", farmers: 52, acres: 553, latitude: 27.7032, longitude: 68.8682, facilitator: "Kamran Ali", focus: "Safety Measures", type: "safety"},
        
        // DGK sessions
        {id: 17, sessionNumber: "DGK-01", city: "dgk", cityName: "Muzaffar Ghar", spot: "Bassti Seerein", date: "2025-12-03", day: "Wednesday", farmers: 41, acres: 553, latitude: 30.3489, longitude: 70.9402, facilitator: "Babar Javed", focus: "Field Application", type: "demonstration"},
        {id: 18, sessionNumber: "DGK-02", city: "dgk", cityName: "Muzaffar Ghar", spot: "Topi Maanay wali", date: "2025-12-03", day: "Wednesday", farmers: 47, acres: 553, latitude: 30.0489, longitude: 70.6402, facilitator: "Chaudhry Naeem", focus: "Expert Talk", type: "expert"},
        {id: 19, sessionNumber: "DGK-03", city: "dgk", cityName: "Muzaffar Ghar", spot: "Phaty wala", date: "2025-12-03", day: "Wednesday", farmers: 34, acres: 553, latitude: 29.9989, longitude: 69.9402, facilitator: "Dawood Ahmed", focus: "High Altitude Farming", type: "specialized"},
        
        // Faisalabad sessions
        {id: 27, sessionNumber: "FSD-01", city: "faisalabad", cityName: "Bhakkar", spot: "Majoka", date: "2025-12-07", day: "Sunday", farmers: 47, acres: 553, latitude: 31.0604, longitude: 72.4750, facilitator: "Liaqat Ali", focus: "Market Linkages", type: "commercial"},
        {id: 28, sessionNumber: "FSD-02", city: "faisalabad", cityName: "Mianwali", spot: "Kalor Sharif Kacha", date: "2025-12-08", day: "Monday", farmers: 42, acres: 553, latitude: 32.1304, longitude: 71.5350, facilitator: "Mohsin Raza", focus: "Technology Adoption", type: "technology"},
        
        // Gujranwala sessions
        {id: 35, sessionNumber: "GSM-01", city: "gujranwala", cityName: "Phalia", spot: "Kamoke", date: "2025-12-10", day: "Wednesday", farmers: 23, acres: 553, latitude: 31.9777, longitude: 74.2245, facilitator: "Tahir Mehmood", focus: "Hybrid Solutions", type: "hybrid"},
        {id: 36, sessionNumber: "GSM-02", city: "gujranwala", cityName: "Phalia", spot: "Nowshera Virkan", date: "2025-12-10", day: "Wednesday", farmers: 25, acres: 553, latitude: 31.9877, longitude: 73.9945, facilitator: "Umar Hayat", focus: "Water Conservation", type: "conservation"},
    ];
    
    allSessions = embeddedSessions;
    console.log(`Loaded ${allSessions.length} embedded sessions`);
    return Promise.resolve();
}

function createFallbackMedia() {
    console.log('Creating fallback media data');
    const cities = ['sukkur', 'dgk', 'faisalabad', 'gujranwala'];
    const types = ['education', 'demonstration', 'training', 'field', 'safety', 'interaction'];
    
    return Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        filename: `https://via.placeholder.com/400x300/2e7d32/ffffff?text=Session+${i + 1}`,
        caption: `Campaign Session ${i + 1}: ${types[i % types.length]} demonstration`,
        date: `2025-11-${24 + (i % 10)}`,
        city: cities[i % 4],
        sessionId: (i % 40) + 1,
        type: types[i % types.length],
        displayIn: 'gallery'
    }));
}

// UPDATE DASHBOARD STATS
function updateDashboardStats() {
    const totalSessions = currentFilteredSessions.length;
    const totalFarmers = currentFilteredSessions.reduce((sum, s) => sum + (s.farmers || 0), 0);
    const totalAcres = currentFilteredSessions.reduce((sum, s) => sum + (s.acres || 0), 0);
    const uniqueCities = [...new Set(currentFilteredSessions.map(s => s.cityName))].length;

    // Update all stat elements
    if (elements.sessionCount) elements.sessionCount.textContent = totalSessions;
    if (elements.farmerCount) elements.farmerCount.textContent = totalFarmers.toLocaleString();
    if (elements.acreCount) elements.acreCount.textContent = totalAcres.toLocaleString();
    if (elements.cityCount) elements.cityCount.textContent = uniqueCities;
    if (elements.totalSessions) elements.totalSessions.textContent = totalSessions;
    if (elements.totalFarmers) elements.totalFarmers.textContent = totalFarmers.toLocaleString();
    if (elements.totalAcres) elements.totalAcres.textContent = totalAcres.toLocaleString();
    if (elements.shownSessions) elements.shownSessions.textContent = Math.min(itemsPerPage, totalSessions);
    if (elements.totalSessionsCount) elements.totalSessionsCount.textContent = totalSessions;
    
    // Update map banner
    if (elements.mapStats) {
        elements.mapStats.textContent = `${totalSessions} Sessions • ${uniqueCities} Regions • ${totalFarmers.toLocaleString()} Farmers`;
    }
}

// INITIALIZE MAP - FIXED VERSION
function initializeMap() {
    console.log('Initializing main map...');
    const mapContainer = document.getElementById('campaignMap');
    if (!mapContainer) {
        console.error('Map container #campaignMap not found!');
        return;
    }

    try {
        // Clear any existing map
        if (map) {
            map.remove();
            map = null;
        }
        
        // Create map centered on Pakistan
        map = L.map('campaignMap').setView([30.3753, 69.3451], 6);

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 12,
            minZoom: 5
        }).addTo(map);

        // Create marker cluster group
        markerCluster = L.markerClusterGroup({
            maxClusterRadius: 50,
            showCoverageOnHover: false,
            spiderfyOnMaxZoom: true
        });
        map.addLayer(markerCluster);

        // Add markers for each session
        updateMapMarkers();

        console.log('Main map initialized successfully');

    } catch (error) {
        console.error('Failed to initialize map:', error);
        showMapError(mapContainer, error);
    }
}

function updateMapMarkers() {
    if (!map || !markerCluster) return;
    
    // Clear existing markers
    markerCluster.clearLayers();
    
    // Add markers for each filtered session
    currentFilteredSessions.forEach(session => {
        if (session.latitude && session.longitude) {
            const marker = L.marker([session.latitude, session.longitude], {
                title: session.sessionNumber
            });
            
            // Create popup content
            const popupContent = `
                <div style="min-width: 200px;">
                    <h4 style="margin:0 0 8px 0; color: #2e7d32;">${session.sessionNumber}</h4>
                    <p style="margin:4px 0;"><strong>Location:</strong> ${session.spot}</p>
                    <p style="margin:4px 0;"><strong>Date:</strong> ${session.date}</p>
                    <p style="margin:4px 0;"><strong>Farmers:</strong> ${session.farmers}</p>
                    <p style="margin:4px 0;"><strong>Facilitator:</strong> ${session.facilitator}</p>
                </div>
            `;
            
            marker.bindPopup(popupContent);
            markerCluster.addLayer(marker);
        }
    });

    // Fit bounds to show all markers if we have sessions
    if (currentFilteredSessions.length > 0) {
        const bounds = L.latLngBounds(currentFilteredSessions.map(s => [s.latitude, s.longitude]));
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

function showMapError(container, error) {
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; background:#f8f9fa; color:#666; padding:20px; text-align:center;">
            <i class="fas fa-map-marked-alt" style="font-size:48px; color:#ccc; margin-bottom:16px;"></i>
            <h3 style="margin-bottom:10px; color:#555;">Map Unavailable</h3>
            <p style="margin-bottom:20px;">${error.message || 'Interactive map could not be loaded.'}</p>
            <button onclick="initializeMap()" class="btn btn-primary" style="padding:8px 16px;">
                <i class="fas fa-redo"></i> Retry Loading Map
            </button>
        </div>
    `;
}

// RENDER GALLERY
function renderGallery() {
    console.log('Rendering gallery...');
    const container = elements.mediaGallery;
    if (!container) return;

    // Filter to only gallery items
    const galleryMedia = mediaItems.filter(item => item.displayIn === 'gallery');
    
    if (galleryMedia.length === 0) {
        container.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:40px; color:#666;">
                <i class="fas fa-images" style="font-size:48px; margin-bottom:16px; color:#ccc;"></i>
                <p>No gallery images available.</p>
            </div>
        `;
        return;
    }

    // Clear and render items
    container.innerHTML = '';
    
    galleryMedia.forEach(media => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.setAttribute('data-city', media.city);
        item.setAttribute('data-type', media.type);
        
        // City-based color for fallback images
        const cityColors = { 
            sukkur: '#2e7d32', 
            dgk: '#ff9800', 
            faisalabad: '#2196f3', 
            gujranwala: '#9c27b0' 
        };
        const color = cityColors[media.city] || '#2e7d32';
        const colorHex = color.replace('#', '');
        
        item.innerHTML = `
            <img src="${media.filename}" alt="${media.caption}" 
                 onerror="this.src='https://via.placeholder.com/400x300/${colorHex}/ffffff?text=${media.city.toUpperCase()}'">
            <div class="gallery-caption">
                <div class="gallery-city">${media.city.toUpperCase()} • Session ${media.sessionId}</div>
                <div class="gallery-title">${media.caption}</div>
                <div class="gallery-meta">
                    <span><i class="fas fa-calendar"></i> ${media.date}</span>
                    <span><i class="fas fa-tag"></i> ${media.type}</span>
                </div>
            </div>
        `;
        
        container.appendChild(item);
    });
}

// RENDER SESSIONS TABLE
function renderSessionsTable() {
    console.log('Rendering sessions table...');
    const tbody = elements.sessionsTableBody;
    if (!tbody) return;

    if (currentFilteredSessions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center; padding:40px; color:#666;">
                    <i class="fas fa-inbox"></i>
                    <p>No session data available.</p>
                </td>
            </tr>
        `;
        return;
    }

    // Clear and add rows
    tbody.innerHTML = '';
    
    // Calculate pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageSessions = currentFilteredSessions.slice(startIndex, endIndex);
    
    pageSessions.forEach(session => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td class="session-number">${session.sessionNumber}</td>
            <td>${session.date}</td>
            <td class="session-city">${session.cityName}</td>
            <td class="session-spot" title="${session.spot}">${session.spot}</td>
            <td>${session.facilitator}</td>
            <td class="session-stats">${session.farmers}</td>
            <td class="session-stats">${session.acres.toLocaleString()}</td>
            <td>${session.focus || 'General Education'}</td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Update pagination controls
    updatePaginationControls();
}

function updatePaginationControls() {
    const totalPages = Math.ceil(currentFilteredSessions.length / itemsPerPage);
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const shownSessions = document.getElementById('shownSessions');
    
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    if (shownSessions) {
        const startIndex = (currentPage - 1) * itemsPerPage + 1;
        const endIndex = Math.min(currentPage * itemsPerPage, currentFilteredSessions.length);
        shownSessions.textContent = `${startIndex}-${endIndex}`;
    }
}

// ANALYTICS CHARTS
function initializeAnalyticsCharts() {
    console.log('Initializing analytics charts...');
    
    // Daily attendance chart
    const attendanceChart = document.getElementById('attendanceChart');
    if (attendanceChart && currentFilteredSessions.length > 0) {
        // Group by date
        const sessionsByDate = currentFilteredSessions.reduce((acc, session) => {
            acc[session.date] = (acc[session.date] || 0) + (session.farmers || 0);
            return acc;
        }, {});
        
        const dates = Object.keys(sessionsByDate).sort();
        const farmers = dates.map(date => sessionsByDate[date]);
        const maxFarmers = Math.max(...farmers);
        
        attendanceChart.innerHTML = dates.slice(0, 10).map((date, index) => {
            const height = maxFarmers > 0 ? (farmers[index] / maxFarmers) * 100 : 0;
            const shortDate = date.split('-').slice(1).join('-'); // Remove year
            
            return `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                    <div style="height: ${height}px; width: 20px; background: #2e7d32; border-radius: 4px 4px 0 0; margin-top: auto;"></div>
                    <div style="margin-top: 5px; font-size: 11px; color: #666;">${shortDate}</div>
                </div>
            `;
        }).join('');
        
        attendanceChart.style.display = 'flex';
        attendanceChart.style.alignItems = 'flex-end';
        attendanceChart.style.gap = '5px';
        attendanceChart.style.height = '150px';
    }
}

// EVENT LISTENERS - FIXED VERSION
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Apply Filters Button - FIXED
    const applyBtn = document.getElementById('applyFilters');
    if (applyBtn) {
        applyBtn.removeEventListener('click', applyFilters); // Remove old if exists
        applyBtn.addEventListener('click', applyFilters);
        console.log('Apply Filters button listener added');
    }
    
    // Reset Filters Button - FIXED
    const resetBtn = document.getElementById('resetFilters');
    if (resetBtn) {
        resetBtn.removeEventListener('click', resetFilters);
        resetBtn.addEventListener('click', resetFilters);
        console.log('Reset Filters button listener added');
    }
    
    // Export Data Button - FIXED
    const exportBtn = document.getElementById('exportData');
    if (exportBtn) {
        exportBtn.removeEventListener('click', exportToCSV);
        exportBtn.addEventListener('click', exportToCSV);
        console.log('Export Data button listener added');
    }
    
    // Refresh Data Button - FIXED
    const refreshBtn = document.getElementById('refreshData');
    if (refreshBtn) {
        refreshBtn.removeEventListener('click', () => location.reload());
        refreshBtn.addEventListener('click', () => location.reload());
        console.log('Refresh Data button listener added');
    }
    
    // City Filter - FIXED
    const cityFilter = document.getElementById('cityFilter');
    if (cityFilter) {
        cityFilter.removeEventListener('change', applyFilters);
        cityFilter.addEventListener('change', applyFilters);
        console.log('City filter listener added');
    }
    
    // Date Filters - FIXED
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    if (dateFrom) {
        dateFrom.removeEventListener('change', applyFilters);
        dateFrom.addEventListener('change', applyFilters);
    }
    if (dateTo) {
        dateTo.removeEventListener('change', applyFilters);
        dateTo.addEventListener('change', applyFilters);
    }
    console.log('Date filter listeners added');
    
    // Search Input - FIXED
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.removeEventListener('input', applyFilters);
        searchInput.addEventListener('input', applyFilters);
        console.log('Search input listener added');
    }
    
    // Gallery Filter Buttons - FIXED
    document.querySelectorAll('.gallery-filter-btn').forEach(btn => {
        btn.removeEventListener('click', handleGalleryFilter);
        btn.addEventListener('click', handleGalleryFilter);
    });
    console.log('Gallery filter button listeners added');
    
    // Pagination Buttons - FIXED
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    
    if (prevPageBtn) {
        prevPageBtn.removeEventListener('click', handlePrevPage);
        prevPageBtn.addEventListener('click', handlePrevPage);
    }
    
    if (nextPageBtn) {
        nextPageBtn.removeEventListener('click', handleNextPage);
        nextPageBtn.addEventListener('click', handleNextPage);
    }
    console.log('Pagination button listeners added');
    
    // Map Controls
    const fitBoundsBtn = document.getElementById('fitBounds');
    if (fitBoundsBtn) {
        fitBoundsBtn.addEventListener('click', fitMapBounds);
    }
    
    const resetMapBtn = document.getElementById('resetMap');
    if (resetMapBtn) {
        resetMapBtn.addEventListener('click', resetMapView);
    }
    
    console.log('All event listeners set up successfully');
}

function handleGalleryFilter() {
    // Update active button
    document.querySelectorAll('.gallery-filter-btn').forEach(b => 
        b.classList.remove('active')
    );
    this.classList.add('active');
    
    // Filter gallery
    const filter = this.getAttribute('data-filter');
    filterGallery(filter);
}

function handlePrevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderSessionsTable();
    }
}

function handleNextPage() {
    const totalPages = Math.ceil(currentFilteredSessions.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderSessionsTable();
    }
}

function fitMapBounds() {
    if (map && currentFilteredSessions.length > 0) {
        const bounds = L.latLngBounds(currentFilteredSessions.map(s => [s.latitude, s.longitude]));
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

function resetMapView() {
    if (map) {
        map.setView([30.3753, 69.3451], 6);
    }
}

// APPLY FILTERS - FIXED VERSION
function applyFilters() {
    console.log('Applying filters...');
    
    // Get filter values
    const cityValue = document.getElementById('cityFilter').value;
    const searchValue = document.getElementById('searchInput').value.toLowerCase();
    const dateFromValue = document.getElementById('dateFrom').value;
    const dateToValue = document.getElementById('dateTo').value;
    
    // Filter sessions
    currentFilteredSessions = allSessions.filter(session => {
        // City filter
        if (cityValue !== 'all' && session.city !== cityValue) return false;
        
        // Search filter
        if (searchValue) {
            const searchable = `${session.sessionNumber} ${session.cityName} ${session.spot} ${session.facilitator} ${session.focus || ''}`.toLowerCase();
            if (!searchable.includes(searchValue)) return false;
        }
        
        // Date filter
        if (dateFromValue && session.date < dateFromValue) return false;
        if (dateToValue && session.date > dateToValue) return false;
        
        return true;
    });
    
    // Reset to first page
    currentPage = 1;
    
    // Update everything
    updateDashboardStats();
    renderSessionsTable();
    updateMapMarkers();
    initializeAnalyticsCharts();
    
    updateStatus(`${currentFilteredSessions.length} sessions found`, 'success');
}

function filterGallery(filter) {
    const galleryItems = document.querySelectorAll('.gallery-item');
    
    galleryItems.forEach(item => {
        const city = item.getAttribute('data-city');
        
        let showItem = false;
        
        switch (filter) {
            case 'all':
                showItem = true;
                break;
            case 'sukkur':
            case 'dgk':
            case 'faisalabad':
            case 'gujranwala':
                showItem = city === filter;
                break;
            default:
                showItem = true;
        }
        
        item.style.display = showItem ? 'block' : 'none';
    });
}

// RESET FILTERS - FIXED
function resetFilters() {
    console.log('Resetting all filters...');
    
    // Reset form values
    document.getElementById('cityFilter').value = 'all';
    document.getElementById('searchInput').value = '';
    document.getElementById('dateFrom').value = '2025-11-24';
    document.getElementById('dateTo').value = '2025-12-12';
    
    // Reset filtered sessions
    currentFilteredSessions = [...allSessions];
    currentPage = 1;
    
    // Update everything
    updateDashboardStats();
    renderSessionsTable();
    updateMapMarkers();
    initializeAnalyticsCharts();
    
    updateStatus('All filters reset', 'success');
}

// EXPORT TO CSV - FIXED
function exportToCSV() {
    if (currentFilteredSessions.length === 0) {
        alert('No data to export. Please adjust your filters.');
        return;
    }
    
    try {
        // Prepare CSV content
        const headers = ['Session ID', 'City', 'Location', 'Date', 'Farmers', 'Acres', 'Facilitator', 'Focus Area'];
        const csvRows = [
            headers.join(','),
            ...currentFilteredSessions.map(session => [
                `"${session.sessionNumber}"`,
                `"${session.cityName}"`,
                `"${session.spot}"`,
                `"${session.date}"`,
                session.farmers || 0,
                session.acres || 0,
                `"${session.facilitator}"`,
                `"${session.focus || ''}"`
            ].join(','))
        ];
        
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        // Create filename
        const filename = `buctril-sessions-export-${new Date().toISOString().slice(0,10)}.csv`;
        
        if (navigator.msSaveBlob) {
            navigator.msSaveBlob(blob, filename);
        } else {
            const url = URL.createObjectURL(blob);
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
        
        updateStatus(`Exported ${currentFilteredSessions.length} sessions to CSV`, 'success');
        
    } catch (error) {
        console.error('Export failed:', error);
        updateStatus('Failed to export data', 'error');
        alert('Failed to export data. Please try again.');
    }
}

// TAB SWITCHING - FIXED VERSION
function initializeTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('#tabContent > section');
    
    tabs.forEach(tab => {
        tab.removeEventListener('click', handleTabClick);
        tab.addEventListener('click', handleTabClick);
    });
    
    console.log('Tab listeners initialized');
}

function handleTabClick() {
    // Update active tab
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    this.classList.add('active');
    
    // Show corresponding content
    const tabId = this.getAttribute('data-tab');
    const tabContents = document.querySelectorAll('#tabContent > section');
    
    tabContents.forEach(content => {
        content.style.display = content.id === tabId + 'Tab' ? 'block' : 'none';
    });
    
    // Special handling for map tab
    if (tabId === 'map' && map) {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }
    
    console.log(`Switched to ${tabId} tab`);
}

// STATUS AND ERROR HANDLING
function updateStatus(message, type = 'info') {
    if (!elements.statusIndicator) return;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        loading: 'fa-spinner fa-spin',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    elements.statusIndicator.className = `status-indicator status-${type}`;
    elements.statusIndicator.innerHTML = `<i class="fas ${icons[type] || 'fa-info-circle'}"></i><span>${message}</span>`;
}

function showError(message) {
    if (elements.errorBanner && elements.errorMessage) {
        elements.errorMessage.textContent = message;
        elements.errorBanner.style.display = 'flex';
    }
}

console.log('AgriVista Dashboard loaded successfully.');
