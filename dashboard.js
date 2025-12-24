// dashboard.js - ENHANCED VERSION
console.log('AgriVista Dashboard v2.5 - Enhanced initializing...');

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
    
    // Add share summary button
    addShareSummaryButton();
    
    // Load data
    loadAllData();
});

// ADD SHARE SUMMARY BUTTON
function addShareSummaryButton() {
    const buttonGroup = document.querySelector('.button-group');
    if (buttonGroup) {
        const shareSummaryBtn = document.createElement('button');
        shareSummaryBtn.className = 'btn btn-secondary';
        shareSummaryBtn.id = 'shareSummaryBtn';
        shareSummaryBtn.innerHTML = '<i class="fas fa-share-alt"></i> Share Summary';
        shareSummaryBtn.addEventListener('click', shareCampaignSummary);
        buttonGroup.appendChild(shareSummaryBtn);
    }
}

// OPTIMIZED DATA LOADING
async function loadAllData() {
    try {
        updateStatus('Loading dashboard data...', 'loading');
        
        // Use Promise.all for parallel loading
        const [sessionsData, mediaData] = await Promise.allSettled([
            fetchData('sessions.json'),
            fetchData('media.json')
        ]);
        
        // Handle sessions data
        if (sessionsData.status === 'fulfilled') {
            allSessions = sessionsData.value.sessions || [];
            console.log(`Loaded ${allSessions.length} sessions`);
        } else {
            console.warn('Using embedded sessions data');
            await loadEmbeddedSessionsData();
        }
        
        // Handle media data
        if (mediaData.status === 'fulfilled') {
            mediaItems = mediaData.value.mediaItems || [];
            console.log(`Loaded ${mediaItems.length} media items`);
            
            // Preload critical images
            preloadCriticalImages();
        } else {
            console.warn('Using fallback media data');
            mediaItems = createFallbackMedia();
        }
        
        currentFilteredSessions = [...allSessions];
        
        // Initialize components sequentially for better UX
        updateDashboardStats();
        
        // Initialize map first (critical for user)
        await initializeMap();
        
        // Initialize other components
        renderGallery();
        renderSessionsTable();
        initializeAnalyticsCharts();
        
        // Hide loading overlay with fade
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                elements.loadingOverlay.style.display = 'none';
            }, 300);
        }
        
        updateStatus('Dashboard loaded successfully', 'success');
        
        // Lazy load remaining media
        setTimeout(lazyLoadMedia, 1000);
        
        console.log('Dashboard initialization complete.');
        
    } catch (error) {
        console.error('Fatal error loading data:', error);
        showError(`Data loading error: ${error.message}. Using fallback data.`);
        
        // Fallback data loading
        await loadEmbeddedSessionsData();
        mediaItems = createFallbackMedia();
        
        // Initialize with fallback data
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

// OPTIMIZED DATA FETCHING
async function fetchData(url) {
    const response = await fetch(url, {
        cache: 'no-cache',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    
    return response.json();
}

// EMBEDDED SESSIONS DATA
async function loadEmbeddedSessionsData() {
    console.log('Loading embedded session data...');
    
    // Create embedded sessions data from provided JSON
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

// PRELOAD CRITICAL IMAGES
function preloadCriticalImages() {
    const criticalImages = [
        'assets/Bayer.png',
        'assets/Buctril.jpg',
        'gallery/1.jpeg',
        'gallery/16.jpeg',
        'gallery/27.jpeg',
        'gallery/35.jpeg'
    ];
    
    criticalImages.forEach(src => {
        const img = new Image();
        img.src = src;
        img.fetchPriority = 'high';
    });
}

// LAZY LOAD MEDIA
function lazyLoadMedia() {
    const images = document.querySelectorAll('img[data-src]');
    
    if (images.length === 0) return;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.add('loaded');
                observer.unobserve(img);
            }
        });
    }, {
        rootMargin: '50px',
        threshold: 0.1
    });
    
    images.forEach(img => observer.observe(img));
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
        elements.mapStats.innerHTML = `
            <i class="fas fa-map-marker-alt"></i>
            ${totalSessions} Sessions • ${uniqueCities} Regions • ${totalFarmers.toLocaleString()} Farmers
        `;
    }
}

// ENHANCED MAP INITIALIZATION
function initializeMap() {
    console.log('Initializing main map...');
    const mapContainer = document.getElementById('campaignMap');
    if (!mapContainer) {
        console.error('Map container #campaignMap not found!');
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        try {
            // Create map centered on Pakistan with optimized settings
            map = L.map('campaignMap', {
                center: [30.3753, 69.3451],
                zoom: 6,
                zoomControl: false,
                preferCanvas: true,
                fadeAnimation: false,
                markerZoomAnimation: false
            });

            // Add optimized tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap',
                maxZoom: 12,
                minZoom: 5,
                updateWhenIdle: true
            }).addTo(map);

            // Add zoom control
            L.control.zoom({ position: 'topright' }).addTo(map);

            // Create optimized marker cluster group
            markerCluster = L.markerClusterGroup({
                maxClusterRadius: 60,
                showCoverageOnHover: false,
                spiderfyOnMaxZoom: true,
                disableClusteringAtZoom: 10,
                animateAddingMarkers: false
            });
            map.addLayer(markerCluster);

            // Add markers for each session
            updateMapMarkers();
            
            // Add legend
            addMapLegend();

            console.log('Main map initialized successfully');
            resolve();

        } catch (error) {
            console.error('Failed to initialize map:', error);
            showMapError(mapContainer, error);
            resolve();
        }
    });
}

// ADD MAP LEGEND
function addMapLegend() {
    const legend = L.control({ position: 'bottomright' });

    legend.onAdd = function () {
        const div = L.DomUtil.create('div', 'info legend');
        div.style.backgroundColor = 'white';
        div.style.padding = '10px';
        div.style.borderRadius = '5px';
        div.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        div.innerHTML = `
            <h4 style="margin: 0 0 10px 0; font-size: 14px;">
                <i class="fas fa-map-pin"></i> Session Types
            </h4>
            <div style="display: grid; grid-template-columns: 1fr; gap: 5px; font-size: 12px;">
                <div><i class="fas fa-circle" style="color: #2e7d32;"></i> Education/Training</div>
                <div><i class="fas fa-circle" style="color: #ff9800;"></i> Demonstration</div>
                <div><i class="fas fa-circle" style="color: #2196f3;"></i> Field Session</div>
                <div><i class="fas fa-circle" style="color: #9c27b0;"></i> Other Activities</div>
            </div>
        `;
        return div;
    };

    if (map) {
        legend.addTo(map);
    }
}

// UPDATE MAP MARKERS
function updateMapMarkers() {
    if (!map || !markerCluster) return;
    
    // Clear existing markers
    markerCluster.clearLayers();
    
    // Batch markers for better performance
    const markerBatch = [];
    
    currentFilteredSessions.forEach(session => {
        if (session.latitude && session.longitude) {
            // Determine marker color based on session type
            let markerColor = '#2e7d32'; // Default green for education
            if (session.type?.includes('demonstration')) markerColor = '#ff9800';
            if (session.type?.includes('field')) markerColor = '#2196f3';
            if (['launch', 'commercial', 'expert'].includes(session.type)) markerColor = '#9c27b0';
            
            // Create custom icon
            const icon = L.divIcon({
                className: 'custom-marker',
                html: `<div style="background-color: ${markerColor}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 3px rgba(0,0,0,0.5);"></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });
            
            const marker = L.marker([session.latitude, session.longitude], {
                title: session.sessionNumber,
                icon: icon
            });
            
            // Create optimized popup content
            const popupContent = `
                <div style="min-width: 200px; max-width: 300px;">
                    <h4 style="margin:0 0 8px 0; color: ${markerColor};">${session.sessionNumber}</h4>
                    <p style="margin:4px 0;"><strong>Location:</strong> ${session.spot}</p>
                    <p style="margin:4px 0;"><strong>Date:</strong> ${session.date}</p>
                    <p style="margin:4px 0;"><strong>Farmers:</strong> ${session.farmers}</p>
                    <p style="margin:4px 0;"><strong>Acres:</strong> ${session.acres?.toLocaleString() || 0}</p>
                    <p style="margin:4px 0;"><strong>Type:</strong> ${session.type || 'General'}</p>
                    <p style="margin:4px 0;"><strong>Facilitator:</strong> ${session.facilitator}</p>
                    <button onclick="showSessionModal(${session.id})" style="margin-top: 8px; background: ${markerColor}; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        <i class="fas fa-info-circle"></i> View Details
                    </button>
                </div>
            `;
            
            marker.bindPopup(popupContent, {
                maxWidth: 300,
                minWidth: 200
            });
            
            markerBatch.push(marker);
        }
    });
    
    // Add all markers at once
    markerCluster.addLayers(markerBatch);

    // Fit bounds with animation if we have sessions
    if (currentFilteredSessions.length > 0) {
        const bounds = L.latLngBounds(currentFilteredSessions.map(s => [s.latitude, s.longitude]));
        map.fitBounds(bounds, { 
            padding: [50, 50],
            animate: true,
            duration: 1
        });
    }
}

// SHOW MAP ERROR
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

// ENHANCED GALLERY RENDERING
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
    
    // Show first 12 items immediately, lazy load rest
    const initialItems = galleryMedia.slice(0, 12);
    const lazyItems = galleryMedia.slice(12);
    
    initialItems.forEach((media, index) => {
        createGalleryItem(media, container, false);
        
        // Preload next few images
        if (index < 4 && lazyItems[index]) {
            const img = new Image();
            img.src = lazyItems[index].filename;
        }
    });
    
    // Lazy load remaining items
    if (lazyItems.length > 0) {
        const placeholder = document.createElement('div');
        placeholder.id = 'galleryLoader';
        placeholder.style.gridColumn = '1 / -1';
        placeholder.style.textAlign = 'center';
        placeholder.style.padding = '20px';
        placeholder.innerHTML = `
            <button id="loadMoreGallery" class="btn btn-outline">
                <i class="fas fa-plus"></i> Load ${lazyItems.length} More Images
            </button>
        `;
        container.appendChild(placeholder);
        
        document.getElementById('loadMoreGallery').addEventListener('click', () => {
            lazyItems.forEach(media => createGalleryItem(media, container, true));
            placeholder.remove();
        });
    }
}

// CREATE GALLERY ITEM
function createGalleryItem(media, container, lazyLoad = false) {
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
    
    const placeholderSVG = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZmZmIi8+PC9zdmc+';
    
    item.innerHTML = `
        <img src="${lazyLoad ? placeholderSVG : media.filename}"
             ${lazyLoad ? `data-src="${media.filename}"` : ''}
             alt="${media.caption}"
             loading="${lazyLoad ? 'lazy' : 'eager'}"
             onerror="this.src='https://via.placeholder.com/400x300/${colorHex}/ffffff?text=${media.city.toUpperCase()}'"
             ${lazyLoad ? 'class="lazy"' : 'class="loaded"'}>
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
        row.style.cursor = 'pointer';
        row.onclick = () => showSessionModal(session.id);
        
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

// ENHANCED ANALYTICS CHARTS
function initializeAnalyticsCharts() {
    console.log('Initializing analytics charts...');
    
    // 1. Daily attendance chart
    updateAttendanceChart();
    
    // 2. City distribution
    updateCityDistribution();
    
    // 3. Session type distribution
    updateSessionTypeChart();
    
    // 4. Performance metrics
    updatePerformanceMetrics();
}

function updateAttendanceChart() {
    const attendanceChart = document.getElementById('attendanceChart');
    if (!attendanceChart || currentFilteredSessions.length === 0) return;
    
    // Group by date with aggregation
    const sessionsByDate = currentFilteredSessions.reduce((acc, session) => {
        if (!acc[session.date]) {
            acc[session.date] = {
                farmers: 0,
                sessions: 0,
                acres: 0
            };
        }
        acc[session.date].farmers += session.farmers || 0;
        acc[session.date].sessions += 1;
        acc[session.date].acres += session.acres || 0;
        return acc;
    }, {});
    
    const dates = Object.keys(sessionsByDate).sort();
    const farmers = dates.map(date => sessionsByDate[date].farmers);
    const maxFarmers = Math.max(...farmers, 1);
    const totalSessions = dates.reduce((sum, date) => sum + sessionsByDate[date].sessions, 0);
    
    // Create responsive chart
    attendanceChart.innerHTML = dates.map((date, index) => {
        const height = (farmers[index] / maxFarmers) * 100;
        const shortDate = date.split('-').slice(1).join('-');
        const tooltip = `
            Date: ${date}<br>
            Sessions: ${sessionsByDate[date].sessions}<br>
            Farmers: ${farmers[index]}<br>
            Acres: ${sessionsByDate[date].acres.toLocaleString()}
        `;
        
        return `
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; position: relative;">
                <div class="chart-bar" 
                     style="height: ${height}px; width: 20px; background: linear-gradient(to top, #2e7d32, #4caf50); border-radius: 4px 4px 0 0; margin-top: auto; cursor: pointer;"
                     title="${tooltip}"
                     onclick="filterByDate('${date}')">
                </div>
                <div style="margin-top: 5px; font-size: 11px; color: #666; transform: rotate(-45deg); transform-origin: left top; white-space: nowrap;">${shortDate}</div>
            </div>
        `;
    }).join('');
    
    // Add chart description
    const chartNote = attendanceChart.nextElementSibling;
    if (chartNote) {
        chartNote.innerHTML = `
            <i class="fas fa-info-circle"></i> 
            Showing ${dates.length} days, ${totalSessions} sessions, ${farmers.reduce((a, b) => a + b, 0).toLocaleString()} total farmers.
            Click bars for details.
        `;
    }
}

function updateCityDistribution() {
    const cityDistribution = document.getElementById('cityDistribution');
    if (!cityDistribution) return;
    
    const cityStats = currentFilteredSessions.reduce((acc, session) => {
        if (!acc[session.city]) {
            acc[session.city] = {
                name: session.cityName || session.city,
                sessions: 0,
                farmers: 0,
                acres: 0
            };
        }
        acc[session.city].sessions += 1;
        acc[session.city].farmers += session.farmers || 0;
        acc[session.city].acres += session.acres || 0;
        return acc;
    }, {});
    
    const cities = Object.keys(cityStats);
    cityDistribution.innerHTML = cities.length;
    
    // Update distribution subtext
    const distributionSubtext = cityDistribution.closest('.distribution-center')?.querySelector('.distribution-subtext');
    if (distributionSubtext && cities.length > 0) {
        const topCity = cities.reduce((a, b) => cityStats[a].farmers > cityStats[b].farmers ? a : b);
        distributionSubtext.innerHTML = `
            Top city: <strong>${cityStats[topCity].name}</strong> 
            (${cityStats[topCity].sessions} sessions, ${cityStats[topCity].farmers.toLocaleString()} farmers)
        `;
    }
}

function updateSessionTypeChart() {
    let sessionTypeChart = document.getElementById('sessionTypeChart');
    if (!sessionTypeChart && currentFilteredSessions.length > 0) {
        // Create session type chart container if it doesn't exist
        const analyticsGrid = document.querySelector('.analytics-grid');
        if (analyticsGrid) {
            analyticsGrid.innerHTML += `
                <div class="analytics-card">
                    <h3><i class="fas fa-chart-pie"></i> Session Types</h3>
                    <div id="sessionTypeChart" class="chart-container"></div>
                    <div class="chart-note">
                        <i class="fas fa-info-circle"></i> Distribution of session focus areas
                    </div>
                </div>
            `;
            sessionTypeChart = document.getElementById('sessionTypeChart');
        }
    }
    
    if (sessionTypeChart && currentFilteredSessions.length > 0) {
        const typeStats = currentFilteredSessions.reduce((acc, session) => {
            const type = session.type || 'other';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});
        
        const types = Object.keys(typeStats);
        const maxCount = Math.max(...Object.values(typeStats));
        
        sessionTypeChart.innerHTML = types.map(type => {
            const height = (typeStats[type] / maxCount) * 100;
            const width = 100 / types.length;
            
            return `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                    <div style="height: ${height}px; width: ${width}%; background: linear-gradient(to top, #ff9800, #ffb74d); border-radius: 4px 4px 0 0; margin-top: auto;" 
                         title="${type}: ${typeStats[type]} sessions"></div>
                    <div style="margin-top: 5px; font-size: 10px; color: #666; text-align: center; width: 100%; overflow: hidden; text-overflow: ellipsis;">${type}</div>
                </div>
            `;
        }).join('');
    }
}

function updatePerformanceMetrics() {
    // These would come from sessions.json in a real implementation
    const metrics = {
        'Definite Intent': 89,
        'Brand Loyalty': 77,
        'Retention': 85,
        'Adoption': 89
    };
    
    const performanceCards = document.querySelectorAll('.performance-card');
    Object.keys(metrics).forEach((metric, index) => {
        if (performanceCards[index]) {
            performanceCards[index].querySelector('.performance-value').textContent = `${metrics[metric]}%`;
            performanceCards[index].querySelector('.performance-label').textContent = metric;
        }
    });
}

// EVENT LISTENERS
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Apply Filters Button
    const applyBtn = document.getElementById('applyFilters');
    if (applyBtn) {
        applyBtn.removeEventListener('click', applyFilters);
        applyBtn.addEventListener('click', applyFilters);
        console.log('Apply Filters button listener added');
    }
    
    // Reset Filters Button
    const resetBtn = document.getElementById('resetFilters');
    if (resetBtn) {
        resetBtn.removeEventListener('click', resetFilters);
        resetBtn.addEventListener('click', resetFilters);
        console.log('Reset Filters button listener added');
    }
    
    // Export Data Button
    const exportBtn = document.getElementById('exportData');
    if (exportBtn) {
        exportBtn.removeEventListener('click', exportToCSV);
        exportBtn.addEventListener('click', exportEnhancedData);
        console.log('Export Data button listener added');
    }
    
    // Refresh Data Button
    const refreshBtn = document.getElementById('refreshData');
    if (refreshBtn) {
        refreshBtn.removeEventListener('click', () => location.reload());
        refreshBtn.addEventListener('click', () => location.reload());
        console.log('Refresh Data button listener added');
    }
    
    // City Filter
    const cityFilter = document.getElementById('cityFilter');
    if (cityFilter) {
        cityFilter.removeEventListener('change', applyFilters);
        cityFilter.addEventListener('change', applyFilters);
        console.log('City filter listener added');
    }
    
    // Date Filters
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
    
    // Search Input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.removeEventListener('input', applyFilters);
        searchInput.addEventListener('input', applyFilters);
        console.log('Search input listener added');
    }
    
    // Gallery Filter Buttons
    document.querySelectorAll('.gallery-filter-btn').forEach(btn => {
        btn.removeEventListener('click', handleGalleryFilter);
        btn.addEventListener('click', handleGalleryFilter);
    });
    console.log('Gallery filter button listeners added');
    
    // Pagination Buttons
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
    
    // Add quick filter handlers for overview cards
    document.querySelectorAll('.overview-card').forEach((card, index) => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
            const cities = ['all', 'sukkur', 'dgk', 'faisalabad'];
            filterByCity(cities[index]);
        });
    });
    
    console.log('All event listeners set up successfully');
}

// FILTER FUNCTIONS
function applyFilters() {
    console.log('Applying filters...');
    
    // Get filter values
    const cityValue = document.getElementById('cityFilter').value;
    const searchValue = document.getElementById('searchInput').value.toLowerCase();
    const dateFromValue = document.getElementById('dateFrom').value;
    const dateToValue = document.getElementById('dateTo').value;
    
    // Filter sessions
    const startTime = performance.now();
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
    
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    showToast(`Found ${currentFilteredSessions.length} sessions in ${duration}ms`, 'success');
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
    
    showToast('All filters reset', 'success');
}

function filterByDate(date) {
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    
    if (dateFrom && dateTo) {
        dateFrom.value = date;
        dateTo.value = date;
        applyFilters();
    }
}

function filterByCity(city) {
    const cityFilter = document.getElementById('cityFilter');
    if (cityFilter) {
        cityFilter.value = city;
        applyFilters();
        
        // Switch to map tab
        document.querySelector('[data-tab="map"]').click();
    }
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

// EXPORT FUNCTIONS
function exportEnhancedData() {
    if (currentFilteredSessions.length === 0) {
        showToast('No data to export. Please adjust your filters.', 'warning');
        return;
    }
    
    try {
        // Prepare enhanced CSV with more fields
        const headers = [
            'Session ID', 'City', 'City Name', 'Location', 
            'Date', 'Day', 'Farmers', 'Acres', 'Latitude', 
            'Longitude', 'Facilitator', 'Focus Area', 'Session Type'
        ];
        
        const csvRows = [
            headers.join(','),
            ...currentFilteredSessions.map(session => [
                `"${session.sessionNumber}"`,
                `"${session.city}"`,
                `"${session.cityName}"`,
                `"${session.spot}"`,
                `"${session.date}"`,
                `"${session.day}"`,
                session.farmers || 0,
                session.acres || 0,
                session.latitude || '',
                session.longitude || '',
                `"${session.facilitator}"`,
                `"${session.focus || ''}"`,
                `"${session.type || ''}"`
            ].join(','))
        ];
        
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        // Create filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `buctril-sessions-${timestamp}.csv`;
        
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
        
        showToast(`Exported ${currentFilteredSessions.length} sessions to ${filename}`, 'success');
        
    } catch (error) {
        console.error('Export failed:', error);
        showToast('Failed to export data', 'error');
    }
}

// LEGACY EXPORT FUNCTION (for compatibility)
function exportToCSV() {
    exportEnhancedData();
}

// TAB SWITCHING
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
    
    // Special handling for gallery tab
    if (tabId === 'gallery') {
        setTimeout(lazyLoadMedia, 100);
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

// TOAST NOTIFICATIONS
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after duration
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// CAMPAIGN SUMMARY FUNCTIONS
function generateCampaignSummary() {
    const summary = {
        totalSessions: currentFilteredSessions.length,
        totalFarmers: currentFilteredSessions.reduce((sum, s) => sum + (s.farmers || 0), 0),
        totalAcres: currentFilteredSessions.reduce((sum, s) => sum + (s.acres || 0), 0),
        uniqueCities: [...new Set(currentFilteredSessions.map(s => s.cityName))].length,
        dateRange: {
            start: currentFilteredSessions.reduce((min, s) => s.date < min ? s.date : min, '9999-99-99'),
            end: currentFilteredSessions.reduce((max, s) => s.date > max ? s.date : max, '0000-00-00')
        },
        topFacilitators: getTopFacilitators(5),
        popularSessionTypes: getPopularSessionTypes()
    };
    
    return summary;
}

function getTopFacilitators(limit = 5) {
    const facilitatorStats = currentFilteredSessions.reduce((acc, session) => {
        acc[session.facilitator] = (acc[session.facilitator] || 0) + 1;
        return acc;
    }, {});
    
    return Object.entries(facilitatorStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name, count]) => ({ name, sessions: count }));
}

function getPopularSessionTypes() {
    const typeStats = currentFilteredSessions.reduce((acc, session) => {
        const type = session.type || 'other';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
    }, {});
    
    return Object.entries(typeStats)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({ type, count }));
}

function shareCampaignSummary() {
    const summary = generateCampaignSummary();
    const text = `
🎯 Buctril Super Farmer Education Drive 2025 Summary:
    
• ${summary.totalSessions} training sessions conducted
• ${summary.totalFarmers.toLocaleString()} farmers engaged
• ${summary.totalAcres.toLocaleString()} acres covered
• Across ${summary.uniqueCities} cities
• Date range: ${summary.dateRange.start} to ${summary.dateRange.end}
    
Top facilitators: ${summary.topFacilitators.map(f => f.name).join(', ')}
    
View interactive dashboard: https://interactsolutions.github.io/WheatCampaign/
    `.trim();
    
    // Try to copy to clipboard
    navigator.clipboard.writeText(text).then(() => {
        showToast('Campaign summary copied to clipboard!', 'success');
    }).catch(() => {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Campaign summary copied to clipboard!', 'success');
    });
}

// SESSION MODAL (Placeholder - implement as needed)
function showSessionModal(sessionId) {
    const session = allSessions.find(s => s.id === sessionId);
    if (!session) return;
    
    showToast(`Viewing session ${session.sessionNumber}`, 'info');
    // Implement modal display logic here
}

console.log('AgriVista Dashboard Enhanced loaded successfully.');
