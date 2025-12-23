// dashboard.js - COMPLETE AND WORKING VERSION
console.log('AgriVista Dashboard initializing...');

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
    
    // Load data and initialize components
    loadAllData();
    setupEventListeners();
    initializeTabs();
});

// LOAD ALL JSON DATA
async function loadAllData() {
    try {
        // Load sessions data
        console.log('Fetching sessions.json...');
        const sessionsResponse = await fetch('sessions.json');
        if (!sessionsResponse.ok) throw new Error(`sessions.json failed: ${sessionsResponse.status}`);
        const sessionsData = await sessionsResponse.json();
        allSessions = sessionsData.sessions || [];
        currentFilteredSessions = [...allSessions];
        console.log(`Loaded ${allSessions.length} sessions`);

        // Load media data
        console.log('Fetching media.json...');
        const mediaResponse = await fetch('media.json');
        if (mediaResponse.ok) {
            const mediaData = await mediaResponse.json();
            mediaItems = mediaData.mediaItems || [];
            console.log(`Loaded ${mediaItems.length} media items`);
        } else {
            console.warn('media.json not found, using fallback');
            mediaItems = createFallbackMedia();
        }

        // UPDATE THE ENTIRE DASHBOARD
        updateDashboardStats();
        initializeMap();
        renderGallery();
        renderSessionsTable();
        
        updateStatus('Dashboard loaded successfully', 'success');
        console.log('Dashboard initialization complete.');

    } catch (error) {
        console.error('Fatal error loading data:', error);
        showError(`Could not load campaign data: ${error.message}. Check console.`);
        updateStatus('Data load failed', 'error');
        
        // Try to show SOMETHING with fallback data
        allSessions = createFallbackSessions();
        currentFilteredSessions = [...allSessions];
        mediaItems = createFallbackMedia();
        updateDashboardStats();
        renderSessionsTable();
    }
}

// CREATE FALLBACK DATA IF FILES MISSING
function createFallbackSessions() {
    console.log('Creating fallback session data');
    return Array.from({ length: 40 }, (_, i) => ({
        id: i + 1,
        sessionNumber: `${["SKR", "DGK", "FSD", "GSM"][Math.floor(i / 10)]}-${(i % 10) + 1}`,
        city: ["sukkur", "dgk", "faisalabad", "gujranwala"][Math.floor(i / 10)],
        cityName: ["Sukkur", "Dera Ghazi Khan", "Faisalabad", "Gujranwala"][Math.floor(i / 10)],
        spot: `Location ${i + 1}`,
        date: "2025-11-24",
        farmers: Math.floor(Math.random() * 50) + 50,
        acres: Math.floor(Math.random() * 500) + 500,
        latitude: 27 + Math.random() * 5,
        longitude: 68 + Math.random() * 5,
        facilitator: `Facilitator ${i + 1}`,
        focus: "Product Education"
    }));
}

function createFallbackMedia() {
    console.log('Creating fallback media data');
    return Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        filename: `https://via.placeholder.com/300x200/2e7d32/ffffff?text=Session+${i + 1}`,
        caption: `Campaign Image ${i + 1}`,
        city: ['sukkur', 'dgk', 'faisalabad', 'gujranwala'][i % 4],
        sessionId: (i % 40) + 1,
        type: ['event', 'demo', 'training'][i % 3],
        displayIn: 'gallery'
    }));
}

// UPDATE ALL STATISTICS
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
    if (elements.shownSessions) elements.shownSessions.textContent = Math.min(10, totalSessions);
    if (elements.totalSessionsCount) elements.totalSessionsCount.textContent = totalSessions;
    
    // Update map banner
    if (elements.mapStats) {
        elements.mapStats.textContent = `${totalSessions} Sessions • ${uniqueCities} Cities • ${totalFarmers.toLocaleString()} Farmers`;
    }
}

// INITIALIZE LEAFLET MAP
function initializeMap() {
    console.log('Initializing map...');
    const mapContainer = document.getElementById('campaignMap');
    if (!mapContainer) {
        console.error('Map container #campaignMap not found!');
        return;
    }

    try {
        // Create map centered on Pakistan
        map = L.map('campaignMap').setView([30.3753, 69.3451], 6);

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 12
        }).addTo(map);

        // Create marker cluster group
        markerCluster = L.markerClusterGroup({
            maxClusterRadius: 50,
            showCoverageOnHover: false
        });
        map.addLayer(markerCluster);

        // Add markers for each session
        currentFilteredSessions.forEach(session => {
            if (session.latitude && session.longitude) {
                const marker = L.marker([session.latitude, session.longitude]);
                
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

        // Fit bounds to show all markers
        if (currentFilteredSessions.length > 0) {
            const bounds = L.latLngBounds(currentFilteredSessions.map(s => [s.latitude, s.longitude]));
            map.fitBounds(bounds, { padding: [50, 50] });
        }

        console.log('Map initialized successfully');

    } catch (error) {
        console.error('Failed to initialize map:', error);
        mapContainer.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; background:#f8f9fa; color:#666; padding:20px; text-align:center;">
                <i class="fas fa-map-marked-alt" style="font-size:48px; color:#ccc; margin-bottom:16px;"></i>
                <p>Interactive map could not be loaded.</p>
                <p style="font-size:0.9em; color:#999;">Technical details: ${error.message}</p>
            </div>
        `;
    }
}

// RENDER MEDIA GALLERY
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
                <p style="font-size:0.9em; color:#999;">Check media.json file</p>
            </div>
        `;
        return;
    }

    // Clear and render items (limit to 12 for performance)
    container.innerHTML = '';
    const itemsToShow = galleryMedia.slice(0, 12);
    
    itemsToShow.forEach(media => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        
        // City-based color for fallback images
        const cityColors = { sukkur: '#2e7d32', dgk: '#ff9800', faisalabad: '#2196f3', gujranwala: '#9c27b0' };
        const color = cityColors[media.city] || '#2e7d32';
        
        item.innerHTML = `
            <img src="${media.filename}" alt="${media.caption}" 
                 onerror="this.src='https://via.placeholder.com/300x200/${color.replace('#', '')}/ffffff?text=${media.city.toUpperCase()}'">
            <div style="padding:16px;">
                <div style="font-weight:bold; color:#2e7d32; font-size:0.85em; margin-bottom:8px; text-transform:uppercase;">
                    ${media.city} • Session ${media.sessionId}
                </div>
                <div style="font-size:0.95em; color:#333; margin-bottom:12px; line-height:1.4;">${media.caption}</div>
                <div style="display:flex; justify-content:space-between; font-size:0.8em; color:#666;">
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
}

// SETUP EVENT LISTENERS FOR FILTERS AND BUTTONS
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Apply Filters Button
    const applyBtn = document.getElementById('applyFilters');
    if (applyBtn) applyBtn.addEventListener('click', applyFilters);
    
    // Reset Filters Button
    const resetBtn = document.getElementById('resetFilters');
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);
    
    // Export Data Button
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
    
    // Search Input (with debounce)
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function(e) {
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
}

// FILTER LOGIC
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
            const searchable = `${session.cityName} ${session.spot} ${session.facilitator} ${session.focus}`.toLowerCase();
            if (!searchable.includes(searchValue)) return false;
        }
        
        // Date filter (basic)
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
            marker.bindPopup(`<b>${session.sessionNumber}</b><br>${session.spot}<br>${session.farmers} farmers`);
            markerCluster.addLayer(marker);
        }
    });
    
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
    if (map) {
        const bounds = L.latLngBounds(allSessions.map(s => [s.latitude, s.longitude]));
        map.fitBounds(bounds, { padding: [50, 50] });
    }
    
    updateStatus('All filters reset', 'success');
}

// EXPORT TO CSV
function exportToCSV() {
    if (currentFilteredSessions.length === 0) {
        alert('No data to export');
        return;
    }
    
    const headers = ['Session ID', 'City', 'Location', 'Date', 'Farmers', 'Acres', 'Facilitator', 'Focus'];
    const csvRows = [
        headers.join(','),
        ...currentFilteredSessions.map(s => [
            s.sessionNumber,
            s.cityName,
            `"${s.spot}"`,
            s.date,
            s.farmers,
            s.acres,
            `"${s.facilitator}"`,
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
        warning: 'fa-exclamation-triangle'
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

console.log('AgriVista Dashboard script loaded.');
