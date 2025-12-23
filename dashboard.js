// dashboard.js - COMPLETE WORKING VERSION
console.log('AgriVista Dashboard v2.4 initializing...');

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
    
    // Hide loading overlay after 2 seconds
    setTimeout(() => {
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = 'none';
        }
    }, 2000);
    
    updateStatus('Loading dashboard data...', 'loading');
    
    // Hide error banner at start
    if (elements.errorBanner) elements.errorBanner.style.display = 'none';
    
    // Set date max to today
    const today = new Date().toISOString().split('T')[0];
    const dateTo = document.getElementById('dateTo');
    if (dateTo) {
        dateTo.max = today;
        dateTo.value = '2025-12-12';
    }
    
    // Load data and initialize
    loadAllData();
    setupEventListeners();
    initializeTabs();
});

// LOAD ALL DATA
async function loadAllData() {
    try {
        updateStatus('Loading sessions data...', 'loading');
        
        // Load sessions data
        const sessionsResponse = await fetch('sessions.json');
        if (!sessionsResponse.ok) throw new Error(`Failed to load sessions.json: ${sessionsResponse.status}`);
        const sessionsData = await sessionsResponse.json();
        allSessions = sessionsData.sessions || [];
        currentFilteredSessions = [...allSessions];
        console.log(`Loaded ${allSessions.length} sessions`);

        // Load media data
        updateStatus('Loading media data...', 'loading');
        try {
            const mediaResponse = await fetch('media.json');
            if (mediaResponse.ok) {
                const mediaData = await mediaResponse.json();
                mediaItems = mediaData.mediaItems || [];
                console.log(`Loaded ${mediaItems.length} media items`);
            } else {
                console.warn('media.json not found, using fallback');
                mediaItems = createFallbackMedia();
            }
        } catch (mediaError) {
            console.warn('Failed to load media data:', mediaError);
            mediaItems = createFallbackMedia();
        }

        // UPDATE THE ENTIRE DASHBOARD
        updateStatus('Initializing dashboard...', 'loading');
        updateDashboardStats();
        initializeMap();
        renderGallery();
        renderSessionsTable();
        initializeAnalyticsCharts();
        
        updateStatus('Dashboard loaded successfully', 'success');
        console.log('Dashboard initialization complete.');

    } catch (error) {
        console.error('Fatal error loading data:', error);
        showError(`Could not load campaign data: ${error.message}. Using sample data.`);
        updateStatus('Using sample data', 'warning');
        
        // Load fallback data
        loadFallbackData();
    }
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

function loadFallbackData() {
    console.log('Loading fallback session data');
    
    // Create fallback data
    allSessions = Array.from({ length: 40 }, (_, i) => {
        const cityIndex = Math.floor(i / 10);
        const cities = [
            { code: 'SKR', name: 'Sukkur', lat: 27.7132, lng: 68.8482 },
            { code: 'DGK', name: 'Dera Ghazi Khan', lat: 30.0489, lng: 70.6402 },
            { code: 'FSD', name: 'Faisalabad', lat: 31.4504, lng: 73.1350 },
            { code: 'GSM', name: 'Gujranwala', lat: 32.1877, lng: 74.1945 }
        ];
        const city = cities[cityIndex];
        
        return {
            id: i + 1,
            sessionNumber: `${city.code}-${(i % 10) + 1}`,
            city: city.code.toLowerCase(),
            cityName: city.name,
            spot: `Location ${i + 1}`,
            date: `2025-11-${24 + (i % 19)}`,
            day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i % 7],
            farmers: Math.floor(Math.random() * 50) + 50,
            acres: Math.floor(Math.random() * 500) + 500,
            latitude: city.lat + (Math.random() * 0.5 - 0.25),
            longitude: city.lng + (Math.random() * 0.5 - 0.25),
            facilitator: `Facilitator ${i + 1}`,
            focus: ['Product Introduction', 'Application Techniques', 'Safety Measures', 'Field Demonstration'][i % 4],
            type: ['education', 'demonstration', 'training', 'field'][i % 4]
        };
    });
    
    currentFilteredSessions = [...allSessions];
    mediaItems = createFallbackMedia();
    
    // Update dashboard with fallback data
    updateDashboardStats();
    renderSessionsTable();
    initializeMap();
    renderGallery();
    initializeAnalyticsCharts();
}

// UPDATE DASHBOARD STATS
function updateDashboardStats() {
    const totalSessions = currentFilteredSessions.length;
    const totalFarmers = currentFilteredSessions.reduce((sum, s) => sum + (s.farmers || 0), 0);
    const totalAcres = currentFilteredSessions.reduce((sum, s) => sum + (s.acres || 0), 0);
    const uniqueCities = [...new Set(currentFilteredSessions.map(s => s.cityName))].length;

    // Update all stat elements
    elements.sessionCount.textContent = totalSessions;
    elements.farmerCount.textContent = totalFarmers.toLocaleString();
    elements.acreCount.textContent = totalAcres.toLocaleString();
    elements.cityCount.textContent = uniqueCities;
    elements.totalSessions.textContent = totalSessions;
    elements.totalFarmers.textContent = totalFarmers.toLocaleString();
    elements.totalAcres.textContent = totalAcres.toLocaleString();
    elements.shownSessions.textContent = Math.min(itemsPerPage, totalSessions);
    elements.totalSessionsCount.textContent = totalSessions;
    
    // Update map banner
    if (elements.mapStats) {
        elements.mapStats.textContent = `${totalSessions} Sessions • ${uniqueCities} Regions • ${totalFarmers.toLocaleString()} Farmers`;
    }
}

// INITIALIZE MAP
function initializeMap() {
    console.log('Initializing main map...');
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
            <p style="margin-bottom:20px;">Interactive map could not be loaded.</p>
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
        // Simple bar chart
        const maxFarmers = Math.max(...currentFilteredSessions.map(s => s.farmers));
        
        attendanceChart.innerHTML = currentFilteredSessions.slice(0, 10).map(session => {
            const height = maxFarmers > 0 ? (session.farmers / maxFarmers) * 100 : 0;
            
            return `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                    <div style="height: ${height}px; width: 20px; background: #2e7d32; border-radius: 4px 4px 0 0; margin-top: auto;"></div>
                    <div style="margin-top: 5px; font-size: 11px; color: #666;">${session.sessionNumber}</div>
                </div>
            `;
        }).join('');
        
        attendanceChart.style.display = 'flex';
        attendanceChart.style.alignItems = 'flex-end';
        attendanceChart.style.gap = '5px';
        attendanceChart.style.height = '150px';
    }
}

// EVENT LISTENERS
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
    
    // Refresh Data Button
    const refreshBtn = document.getElementById('refreshData');
    if (refreshBtn) refreshBtn.addEventListener('click', () => location.reload());
    
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
        searchInput.addEventListener('input', applyFilters);
    }
    
    // Gallery Filter Buttons
    document.querySelectorAll('.gallery-filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // Update active button
            document.querySelectorAll('.gallery-filter-btn').forEach(b => 
                b.classList.remove('active')
            );
            this.classList.add('active');
            
            // Filter gallery
            const filter = this.getAttribute('data-filter');
            filterGallery(filter);
        });
    });
    
    // Pagination Buttons
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', function() {
            if (currentPage > 1) {
                currentPage--;
                renderSessionsTable();
            }
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', function() {
            const totalPages = Math.ceil(currentFilteredSessions.length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderSessionsTable();
            }
        });
    }
}

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
        const filename = `agrivista-export.csv`;
        
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
        
        alert(`Exported ${currentFilteredSessions.length} sessions to CSV`);
        
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
                setTimeout(() => {
                    map.invalidateSize();
                }, 100);
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

console.log('AgriVista Dashboard loaded successfully.');
