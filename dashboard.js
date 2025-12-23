// dashboard.js - FIXED VERSION FOR LOCAL FILES
console.log('AgriVista Dashboard v2.2 initializing...');

// GLOBAL STATE
let allSessions = [];
let currentFilteredSessions = [];
let mediaItems = [];
let map;
let markerCluster;

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
    errorMessage: document.getElementById('errorMessage')
};

// INITIALIZE EVERYTHING
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM loaded. Starting initialization...');
    updateStatus('Loading dashboard data...', 'loading');
    
    // Hide error banner at start
    if (elements.errorBanner) elements.errorBanner.style.display = 'none';
    
    // Set date max to today
    const today = new Date().toISOString().split('T')[0];
    const dateTo = document.getElementById('dateTo');
    if (dateTo) {
        dateTo.max = today;
        dateTo.value = '2025-12-12'; // Campaign end date
    }
    
    // Load data and initialize
    loadAllData();
    setupEventListeners();
    initializeTabs();
});

// LOAD ALL JSON DATA - FIXED FOR LOCAL FILES
async function loadAllData() {
    try {
        updateStatus('Loading sessions data...', 'loading');
        
        // 1. LOAD SESSIONS DATA
        console.log('Loading sessions.json...');
        const sessionsResponse = await fetch('sessions.json');
        if (!sessionsResponse.ok) {
            throw new Error(`Failed to load sessions.json: ${sessionsResponse.status}`);
        }
        const sessionsData = await sessionsResponse.json();
        allSessions = sessionsData.sessions || [];
        currentFilteredSessions = [...allSessions];
        console.log(`Loaded ${allSessions.length} sessions`);
        
        // 2. LOAD MEDIA DATA
        updateStatus('Loading media gallery...', 'loading');
        try {
            const mediaResponse = await fetch('media.json');
            if (mediaResponse.ok) {
                const mediaData = await mediaResponse.json();
                mediaItems = mediaData.mediaItems || [];
                console.log(`Loaded ${mediaItems.length} media items`);
            } else {
                console.warn('media.json not found or error');
                mediaItems = createFallbackMedia();
            }
        } catch (mediaError) {
            console.warn('Media load error:', mediaError);
            mediaItems = createFallbackMedia();
        }

        // 3. UPDATE DASHBOARD
        updateStatus('Rendering dashboard...', 'loading');
        updateDashboardStats();
        initializeMap();
        renderGallery();
        renderSessionsTable();
        
        updateStatus('Dashboard loaded successfully', 'success');
        console.log('Dashboard initialization complete.');

    } catch (error) {
        console.error('Fatal error loading data:', error);
        showError(`Data load error: ${error.message}. Check console.`);
        updateStatus('Data load failed', 'error');
        
        // Load fallback data
        allSessions = createFallbackSessions();
        currentFilteredSessions = [...allSessions];
        mediaItems = createFallbackMedia();
        updateDashboardStats();
        renderSessionsTable();
        renderGallery();
    }
}

// CREATE FALLBACK SESSIONS
function createFallbackSessions() {
    console.log('Creating fallback session data');
    return Array.from({ length: 40 }, (_, i) => {
        const cities = ['sukkur', 'dgk', 'faisalabad', 'gujranwala'];
        const cityNames = ['Sukkur', 'Dera Ghazi Khan', 'Faisalabad', 'Gujranwala'];
        const cityCodes = ['SKR', 'DGK', 'FSD', 'GSM'];
        const cityIndex = Math.floor(i / 10);
        
        return {
            id: i + 1,
            sessionNumber: `${cityCodes[cityIndex]}-${(i % 10) + 1}`,
            city: cities[cityIndex],
            cityName: cityNames[cityIndex],
            spot: `Location ${i + 1}`,
            date: `2025-11-${24 + (i % 10)}`,
            day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i % 7],
            farmers: Math.floor(Math.random() * 50) + 50,
            acres: Math.floor(Math.random() * 500) + 500,
            latitude: 27 + Math.random() * 5,
            longitude: 68 + Math.random() * 5,
            facilitator: `Facilitator ${i + 1}`,
            focus: ['Product Introduction', 'Application Training', 'Safety Demo', 'Field Practice'][i % 4],
            type: ['education', 'demonstration', 'training', 'field'][i % 4]
        };
    });
}

// CREATE FALLBACK MEDIA - USES LOCAL FILE PATHS
function createFallbackMedia() {
    console.log('Creating fallback media with local paths');
    const cities = ['sukkur', 'dgk', 'faisalabad', 'gujranwala'];
    const types = ['education', 'demonstration', 'training', 'safety'];
    
    return Array.from({ length: 12 }, (_, i) => {
        const city = cities[i % 4];
        const cityColors = { 
            sukkur: '#2e7d32', 
            dgk: '#ff9800', 
            faisalabad: '#2196f3', 
            gujranwala: '#9c27b0' 
        };
        const color = cityColors[city] || '#2e7d32';
        const colorHex = color.replace('#', '');
        
        return {
            id: i + 1,
            filename: `gallery/${(i % 10) + 1}.jpeg`, // Try local path first
            fallback: `https://via.placeholder.com/400x300/${colorHex}/ffffff?text=${city.toUpperCase()}+Session`,
            caption: `Campaign Session ${i + 1}: ${types[i % types.length]}`,
            date: `2025-11-${24 + (i % 10)}`,
            city: city,
            sessionId: (i % 40) + 1,
            type: types[i % types.length],
            displayIn: 'gallery'
        };
    });
}

// UPDATE DASHBOARD STATS
function updateDashboardStats() {
    const totalSessions = currentFilteredSessions.length;
    const totalFarmers = currentFilteredSessions.reduce((sum, s) => sum + (s.farmers || 0), 0);
    const totalAcres = currentFilteredSessions.reduce((sum, s) => sum + (s.acres || 0), 0);
    const uniqueCities = [...new Set(currentFilteredSessions.map(s => s.cityName))].length;

    // Update all stats
    if (elements.sessionCount) elements.sessionCount.textContent = totalSessions;
    if (elements.farmerCount) elements.farmerCount.textContent = totalFarmers.toLocaleString();
    if (elements.acreCount) elements.acreCount.textContent = totalAcres.toLocaleString();
    if (elements.cityCount) elements.cityCount.textContent = uniqueCities;
    if (elements.totalSessions) elements.totalSessions.textContent = totalSessions;
    if (elements.totalFarmers) elements.totalFarmers.textContent = totalFarmers.toLocaleString();
    if (elements.totalAcres) elements.totalAcres.textContent = totalAcres.toLocaleString();
    if (elements.shownSessions) elements.shownSessions.textContent = Math.min(10, totalSessions);
    if (elements.totalSessionsCount) elements.totalSessionsCount.textContent = totalSessions;
    
    // Update map banner
    if (elements.mapStats) {
        elements.mapStats.textContent = `${totalSessions} Sessions • ${uniqueCities} Cities • ${totalFarmers.toLocaleString()} Farmers`;
    }
}

// INITIALIZE MAP
function initializeMap() {
    console.log('Initializing map...');
    const mapContainer = document.getElementById('campaignMap');
    if (!mapContainer) {
        console.error('Map container not found!');
        return;
    }

    try {
        // Create map
        map = L.map('campaignMap').setView([30.3753, 69.3451], 6);

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 12
        }).addTo(map);

        // Create marker cluster
        markerCluster = L.markerClusterGroup({
            maxClusterRadius: 50,
            showCoverageOnHover: false
        });
        map.addLayer(markerCluster);

        // Add markers
        updateMapMarkers();

        console.log('Map initialized successfully');

    } catch (error) {
        console.error('Map error:', error);
        mapContainer.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; background:#f8f9fa; color:#666; padding:20px; text-align:center;">
                <i class="fas fa-map-marked-alt" style="font-size:48px; color:#ccc; margin-bottom:16px;"></i>
                <p>Interactive map loading...</p>
                <button onclick="location.reload()" class="btn btn-primary" style="margin-top:10px;">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
    }
}

// RENDER GALLERY - FIXED FOR LOCAL FILES
function renderGallery() {
    console.log('Rendering gallery...');
    const container = elements.mediaGallery;
    if (!container) return;

    // Filter gallery items
    const galleryMedia = mediaItems.filter(item => item.displayIn === 'gallery');
    
    if (galleryMedia.length === 0) {
        container.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:40px; color:#666;">
                <i class="fas fa-images" style="font-size:48px; margin-bottom:16px; color:#ccc;"></i>
                <p>No gallery images available.</p>
                <p style="font-size:0.9em; color:#999;">Check media.json and gallery/ folder</p>
            </div>
        `;
        return;
    }

    // Clear and render
    container.innerHTML = '';
    const itemsToShow = galleryMedia.slice(0, 12); // Limit for performance
    
    itemsToShow.forEach(media => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.setAttribute('data-city', media.city);
        item.setAttribute('data-type', media.type);
        
        // City colors for fallback
        const cityColors = { 
            sukkur: '#2e7d32', 
            dgk: '#ff9800', 
            faisalabad: '#2196f3', 
            gujranwala: '#9c27b0' 
        };
        const color = cityColors[media.city] || '#2e7d32';
        const colorHex = color.replace('#', '');
        
        // Use local file with fallback
        const imgSrc = media.filename || media.fallback || 
                      `https://via.placeholder.com/400x300/${colorHex}/ffffff?text=${media.city}`;
        
        item.innerHTML = `
            <img src="${imgSrc}" alt="${media.caption}" 
                 onerror="this.onerror=null; this.src='https://via.placeholder.com/400x300/${colorHex}/ffffff?text=${media.city}'">
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
                    <i class="fas fa-inbox" style="font-size:48px; margin-bottom:16px; color:#ccc; display:block;"></i>
                    <p>No session data available.</p>
                    <p style="font-size:0.9em; color:#999;">Check sessions.json file</p>
                </td>
            </tr>
        `;
        return;
    }

    // Clear and add rows
    tbody.innerHTML = '';
    currentFilteredSessions.forEach(session => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="session-number">${session.sessionNumber || 'N/A'}</td>
            <td>${session.date || 'N/A'}</td>
            <td class="session-city">${session.cityName || 'N/A'}</td>
            <td class="session-spot" title="${session.spot || ''}">${session.spot || 'N/A'}</td>
            <td>${session.facilitator || 'N/A'}</td>
            <td class="session-stats">${session.farmers || 0}</td>
            <td class="session-stats">${(session.acres || 0).toLocaleString()}</td>
            <td>${session.focus || 'General Education'}</td>
        `;
        tbody.appendChild(row);
    });
}

// SETUP EVENT LISTENERS
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Apply Filters
    const applyBtn = document.getElementById('applyFilters');
    if (applyBtn) applyBtn.addEventListener('click', applyFilters);
    
    // Reset Filters
    const resetBtn = document.getElementById('resetFilters');
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);
    
    // Export Data
    const exportBtn = document.getElementById('exportData');
    if (exportBtn) exportBtn.addEventListener('click', exportToCSV);
    
    // City Filter
    const cityFilter = document.getElementById('cityFilter');
    if (cityFilter) cityFilter.addEventListener('change', applyFilters);
    
    // Date Filters
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    if (dateFrom) dateFrom.addEventListener('change', applyFilters);
    if (dateTo) dateTo.addEventListener('change', applyFilters);
    
    // Search Input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => applyFilters(), 300);
        });
    }
    
    // High Attendance Filter
    const highAttendanceBtn = document.getElementById('filterHighAttendance');
    if (highAttendanceBtn) {
        highAttendanceBtn.addEventListener('click', function() {
            currentFilteredSessions = allSessions.filter(s => s.farmers >= 80);
            updateDashboardStats();
            renderSessionsTable();
            updateMapMarkers();
            updateStatus(`${currentFilteredSessions.length} high-attendance sessions`, 'success');
        });
    }
    
    // Recent Filter
    const recentBtn = document.getElementById('filterRecent');
    if (recentBtn) {
        recentBtn.addEventListener('click', function() {
            const today = new Date();
            const lastWeek = new Date(today);
            lastWeek.setDate(today.getDate() - 7);
            
            document.getElementById('dateFrom').value = lastWeek.toISOString().split('T')[0];
            document.getElementById('dateTo').value = today.toISOString().split('T')[0];
            applyFilters();
        });
    }
    
    // Refresh Data
    const refreshBtn = document.getElementById('refreshData');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => location.reload());
    }
}

// APPLY FILTERS
function applyFilters() {
    console.log('Applying filters...');
    const cityValue = document.getElementById('cityFilter').value;
    const searchValue = document.getElementById('searchInput').value.toLowerCase();
    const dateFromValue = document.getElementById('dateFrom').value;
    const dateToValue = document.getElementById('dateTo').value;
    
    currentFilteredSessions = allSessions.filter(session => {
        // City filter
        if (cityValue !== 'all' && session.city !== cityValue) return false;
        
        // Search filter
        if (searchValue) {
            const searchable = `${session.sessionNumber || ''} ${session.cityName || ''} ${session.spot || ''} ${session.facilitator || ''} ${session.focus || ''}`.toLowerCase();
            if (!searchable.includes(searchValue)) return false;
        }
        
        // Date filter
        if (dateFromValue && session.date < dateFromValue) return false;
        if (dateToValue && session.date > dateToValue) return false;
        
        return true;
    });
    
    // Update everything
    updateDashboardStats();
    renderSessionsTable();
    updateMapMarkers();
    
    updateStatus(`${currentFilteredSessions.length} sessions found`, 'success');
}

// UPDATE MAP MARKERS
function updateMapMarkers() {
    if (!markerCluster || !map) return;
    
    markerCluster.clearLayers();
    
    currentFilteredSessions.forEach(session => {
        if (session.latitude && session.longitude) {
            const marker = L.marker([session.latitude, session.longitude]);
            
            const popupContent = `
                <div style="min-width: 200px;">
                    <h4 style="margin:0 0 8px 0; color: #2e7d32;">${session.sessionNumber || 'Session'}</h4>
                    <p style="margin:4px 0;"><strong>Location:</strong> ${session.spot || 'N/A'}</p>
                    <p style="margin:4px 0;"><strong>Date:</strong> ${session.date || 'N/A'}</p>
                    <p style="margin:4px 0;"><strong>Farmers:</strong> ${session.farmers || 0}</p>
                    <p style="margin:4px 0;"><strong>Facilitator:</strong> ${session.facilitator || 'N/A'}</p>
                </div>
            `;
            
            marker.bindPopup(popupContent);
            markerCluster.addLayer(marker);
        }
    });
    
    // Fit bounds if we have markers
    if (currentFilteredSessions.length > 0 && currentFilteredSessions[0].latitude) {
        const bounds = L.latLngBounds(currentFilteredSessions.map(s => [s.latitude, s.longitude]));
        map.fitBounds(bounds, { padding: [50, 50] });
    }
    
    // Update map stats
    if (elements.mapStats) {
        const uniqueCities = [...new Set(currentFilteredSessions.map(s => s.cityName))].length;
        const totalFarmers = currentFilteredSessions.reduce((sum, s) => sum + (s.farmers || 0), 0);
        elements.mapStats.textContent = `${currentFilteredSessions.length} Sessions • ${uniqueCities} Cities • ${totalFarmers.toLocaleString()} Farmers`;
    }
}

// RESET FILTERS
function resetFilters() {
    console.log('Resetting filters...');
    
    // Reset form values
    document.getElementById('cityFilter').value = 'all';
    document.getElementById('searchInput').value = '';
    document.getElementById('dateFrom').value = '2025-11-24';
    document.getElementById('dateTo').value = '2025-12-12';
    
    // Reset filtered sessions
    currentFilteredSessions = [...allSessions];
    
    // Update everything
    updateDashboardStats();
    renderSessionsTable();
    updateMapMarkers();
    
    // Reset map view
    if (map && allSessions.length > 0 && allSessions[0].latitude) {
        const bounds = L.latLngBounds(allSessions.map(s => [s.latitude, s.longitude]));
        map.fitBounds(bounds, { padding: [50, 50] });
    }
    
    updateStatus('All filters reset', 'success');
}

// EXPORT TO CSV
function exportToCSV() {
    if (currentFilteredSessions.length === 0) {
        alert('No data to export. Please adjust your filters.');
        return;
    }
    
    try {
        const headers = ['Session ID', 'City', 'Location', 'Date', 'Farmers', 'Acres', 'Facilitator', 'Focus'];
        const csvRows = [
            headers.join(','),
            ...currentFilteredSessions.map(s => [
                s.sessionNumber || '',
                s.cityName || '',
                `"${s.spot || ''}"`,
                s.date || '',
                s.farmers || 0,
                s.acres || 0,
                `"${s.facilitator || ''}"`,
                `"${s.focus || ''}"`
            ].join(','))
        ];
        
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = `agrivista-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        updateStatus(`Exported ${currentFilteredSessions.length} sessions`, 'success');
    } catch (error) {
        console.error('Export failed:', error);
        alert('Failed to export data. Please try again.');
    }
}

// TAB SWITCHING
function initializeTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('#tabContent > section');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Show corresponding content
            const tabId = this.getAttribute('data-tab');
            tabContents.forEach(content => {
                content.style.display = content.id === tabId + 'Tab' ? 'block' : 'none';
            });
            
            // Special handling for map tab
            if (tabId === 'map' && map) {
                setTimeout(() => map.invalidateSize(), 100);
            }
        });
    });
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

console.log('AgriVista Dashboard v2.2 loaded.');
