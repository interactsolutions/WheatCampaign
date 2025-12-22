// dashboard.js - Main JavaScript for AgriVista Dashboard
console.log('AgriVista Dashboard v2.0 loading...');

// Global application state
const AppState = {
    campaignData: null,
    mediaData: null,
    map: null,
    markerCluster: null,
    sessions: [],
    filteredSessions: [],
    currentGalleryFilter: 'all',
    currentPage: 1,
    itemsPerPage: 10,
    markers: [],
    cityBounds: {},
    initialized: false
};

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing AgriVista Dashboard...');
    
    // Initialize status
    updateStatus('Loading dashboard data...', 'loading');
    
    // Load all data and initialize components
    loadDashboardData();
    
    // Setup event listeners
    setupEventListeners();
});

// Load all dashboard data
async function loadDashboardData() {
    try {
        updateStatus('Loading campaign data...', 'loading');
        
        // Load sessions data
        const sessionsResponse = await fetch('sessions.json');
        if (!sessionsResponse.ok) throw new Error(`Failed to load sessions: ${sessionsResponse.status}`);
        
        AppState.campaignData = await sessionsResponse.json();
        AppState.sessions = AppState.campaignData.sessions || [];
        AppState.filteredSessions = [...AppState.sessions];
        
        // Load media data
        try {
            const mediaResponse = await fetch('media.json');
            if (mediaResponse.ok) {
                AppState.mediaData = await mediaResponse.json();
            } else {
                console.warn('Media data not available, using fallback');
                AppState.mediaData = createFallbackMediaData();
            }
        } catch (mediaError) {
            console.warn('Failed to load media data:', mediaError);
            AppState.mediaData = createFallbackMediaData();
        }
        
        // Initialize all components
        initializeDashboard();
        initializeMap();
        initializeGallery();
        initializeSessionsTable();
        updateDashboardStats();
        
        // Set initialized flag
        AppState.initialized = true;
        
        updateStatus('Dashboard loaded successfully', 'success');
        console.log('Dashboard initialized with:', {
            sessions: AppState.sessions.length,
            cities: AppState.campaignData.cities?.length || 0,
            media: AppState.mediaData.mediaItems?.length || 0
        });
        
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        showError(`Data loading failed: ${error.message}`);
        updateStatus('Data loading failed', 'error');
        
        // Try to load fallback data
        loadFallbackData();
    }
}

// Create fallback media data
function createFallbackMediaData() {
    return {
        campaign: "Buttril Super Field Activations",
        totalMedia: 48,
        mediaItems: Array.from({length: 48}, (_, i) => ({
            id: i + 1,
            filename: `gallery/${(i % 40) + 1}.jpeg`,
            caption: `Campaign session ${(i % 40) + 1}`,
            date: "2025-11-24",
            city: ["sukkur", "dgk", "faisalabad", "gujranwala"][Math.floor(Math.random() * 4)],
            sessionId: (i % 40) + 1,
            type: ["event", "demonstration", "field", "training"][Math.floor(Math.random() * 4)],
            displayIn: "gallery"
        })),
        lastUpdated: "2025-12-22"
    };
}

// Load fallback data when primary fails
function loadFallbackData() {
    console.log('Loading fallback data...');
    
    // Create minimal fallback data
    AppState.campaignData = {
        campaign: "Buttril Super Field Activations",
        totalSessions: 40,
        totalFarmers: 2908,
        totalAcres: 44256,
        cities: [
            { code: "SKR", name: "Sukkur", sessions: 15, farmers: 1120, acres: 16800 },
            { code: "DGK", name: "Dera Ghazi Khan", sessions: 10, farmers: 728, acres: 10920 },
            { code: "FSD", name: "Faisalabad", sessions: 8, farmers: 640, acres: 9600 },
            { code: "GSM", name: "Gujranwala", sessions: 7, farmers: 420, acres: 6936 }
        ],
        sessions: Array.from({length: 40}, (_, i) => ({
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
            facilitator: `Facilitator ${i + 1}`
        }))
    };
    
    AppState.sessions = AppState.campaignData.sessions;
    AppState.filteredSessions = [...AppState.sessions];
    AppState.mediaData = createFallbackMediaData();
    
    // Initialize with fallback data
    initializeDashboard();
    updateDashboardStats();
    updateStatus('Using fallback data - Check internet connection', 'error');
}

// Initialize dashboard components
function initializeDashboard() {
    console.log('Initializing dashboard components...');
    
    // Update page title with campaign name
    if (AppState.campaignData?.campaign) {
        document.title = `AgriVista - ${AppState.campaignData.campaign}`;
    }
    
    // Set date range limits
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dateTo').max = today;
    
    // Populate city filter
    const cityFilter = document.getElementById('cityFilter');
    if (AppState.campaignData?.cities) {
        cityFilter.innerHTML = '<option value="all">All Cities</option>' +
            AppState.campaignData.cities.map(city => 
                `<option value="${city.code.toLowerCase()}">${city.name} (${city.code}) - ${city.sessions} sessions</option>`
            ).join('');
    }
    
    // Initialize analytics charts
    initializeAnalyticsCharts();
    
    console.log('Dashboard components initialized');
}

// Initialize Leaflet map
function initializeMap() {
    console.log('Initializing interactive map...');
    
    try {
        // Create map centered on Pakistan
        AppState.map = L.map('campaignMap').setView([30.3753, 69.3451], 6);
        
        // Add tile layer with proper attribution
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 12,
            minZoom: 5,
            detectRetina: true
        }).addTo(AppState.map);
        
        // Create marker cluster group
        AppState.markerCluster = L.markerClusterGroup({
            maxClusterRadius: 80,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: true,
            zoomToBoundsOnClick: true,
            iconCreateFunction: function(cluster) {
                const count = cluster.getChildCount();
                let size = 'small';
                if (count > 20) size = 'large';
                else if (count > 10) size = 'medium';
                
                return L.divIcon({
                    html: `<div><span>${count}</span></div>`,
                    className: `marker-cluster marker-cluster-${size}`,
                    iconSize: L.point(40, 40)
                });
            }
        }).addTo(AppState.map);
        
        // Add city markers
        if (AppState.campaignData?.cities) {
            AppState.campaignData.cities.forEach(city => {
                if (city.latitude && city.longitude) {
                    const cityIcon = L.divIcon({
                        className: 'city-marker',
                        html: `
                            <div style="
                                background: linear-gradient(135deg, #2e7d32, #1b5e20);
                                color: white;
                                padding: 10px 15px;
                                border-radius: 20px;
                                font-weight: bold;
                                border: 3px solid white;
                                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                                font-size: 14px;
                                text-align: center;
                                min-width: 80px;
                            ">
                                <div>${city.code}</div>
                                <div style="font-size: 11px; opacity: 0.9;">${city.sessions} sessions</div>
                            </div>
                        `,
                        iconSize: [100, 50],
                        iconAnchor: [50, 25]
                    });
                    
                    const marker = L.marker([city.latitude, city.longitude], { icon: cityIcon })
                        .addTo(AppState.map)
                        .bindPopup(createCityPopup(city));
                    
                    AppState.markers.push(marker);
                    
                    // Store city bounds for navigation
                    AppState.cityBounds[city.code.toLowerCase()] = {
                        lat: city.latitude,
                        lng: city.longitude,
                        sessions: city.sessions
                    };
                }
            });
        }
        
        // Add session markers
        updateMapMarkers();
        
        // Fit bounds to show all markers
        if (AppState.sessions.length > 0) {
            const bounds = L.latLngBounds(AppState.sessions.map(s => [s.latitude, s.longitude]));
            AppState.map.fitBounds(bounds, { padding: [50, 50] });
        }
        
        // Add map controls
        addMapControls();
        
        console.log('Map initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize map:', error);
        document.getElementById('campaignMap').innerHTML = `
            <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; background: #f8f9fa; color: #666; padding: 20px;">
                <i class="fas fa-map-marked-alt" style="font-size: 64px; color: #ccc; margin-bottom: 20px;"></i>
                <h3 style="margin-bottom: 10px;">Map Unavailable</h3>
                <p style="text-align: center; max-width: 400px; margin-bottom: 20px;">
                    Unable to load the interactive map. This could be due to network issues or missing map data.
                </p>
                <button onclick="initializeMap()" class="btn btn-primary" style="margin-top: 10px;">
                    <i class="fas fa-redo"></i> Retry Loading Map
                </button>
            </div>
        `;
    }
}

// Create city popup content
function createCityPopup(city) {
    return `
        <div style="min-width: 250px;">
            <div style="background: linear-gradient(135deg, #2e7d32, #1b5e20); color: white; padding: 15px; border-radius: 8px 8px 0 0; margin: -10px -10px 10px -10px;">
                <h3 style="margin: 0; font-size: 18px;">${city.name}</h3>
                <div style="font-size: 14px; opacity: 0.9;">${city.code} Region</div>
            </div>
            <div style="padding: 5px 0;">
                <div style="display: flex; justify-content: space-between; margin: 8px 0;">
                    <span style="font-weight: 600; color: #555;">Sessions:</span>
                    <span style="color: #2e7d32; font-weight: 700;">${city.sessions}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin: 8px 0;">
                    <span style="font-weight: 600; color: #555;">Farmers:</span>
                    <span style="color: #2e7d32; font-weight: 700;">${city.farmers.toLocaleString()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin: 8px 0;">
                    <span style="font-weight: 600; color: #555;">Acres:</span>
                    <span style="color: #2e7d32; font-weight: 700;">${city.acres.toLocaleString()}</span>
                </div>
            </div>
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee;">
                <button onclick="zoomToCity('${city.code.toLowerCase()}')" 
                        style="width: 100%; padding: 8px; background: #2e7d32; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">
                    <i class="fas fa-search-location"></i> Zoom to Region
                </button>
            </div>
        </div>
    `;
}

// Update map markers based on filtered sessions
function updateMapMarkers() {
    if (!AppState.map || !AppState.markerCluster) return;
    
    // Clear existing markers from cluster
    AppState.markerCluster.clearLayers();
    
    // Add filtered session markers
    AppState.filteredSessions.forEach(session => {
        if (session.latitude && session.longitude) {
            const marker = L.marker([session.latitude, session.longitude], {
                title: session.sessionNumber
            });
            
            // Create custom popup
            marker.bindPopup(createSessionPopup(session));
            
            // Add to cluster
            AppState.markerCluster.addLayer(marker);
        }
    });
    
    // Update map stats
    updateMapStats();
}

// Create session popup content
function createSessionPopup(session) {
    return `
        <div style="min-width: 280px;">
            <div style="background: linear-gradient(135deg, #2e7d32, #1b5e20); color: white; padding: 15px; border-radius: 8px 8px 0 0; margin: -10px -10px 10px -10px;">
                <h4 style="margin: 0; font-size: 16px;">${session.sessionNumber}</h4>
                <div style="font-size: 12px; opacity: 0.9;">${session.cityName}</div>
            </div>
            <div style="padding: 5px 0;">
                <div style="margin: 8px 0;">
                    <div style="font-weight: 600; color: #555; font-size: 12px;">Location</div>
                    <div style="color: #333; margin-top: 2px;">${session.spot || 'Not specified'}</div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0;">
                    <div>
                        <div style="font-weight: 600; color: #555; font-size: 12px;">Date</div>
                        <div style="color: #333; margin-top: 2px;">${session.date || 'Unknown'}</div>
                    </div>
                    <div>
                        <div style="font-weight: 600; color: #555; font-size: 12px;">Day</div>
                        <div style="color: #333; margin-top: 2px;">${session.day || 'Unknown'}</div>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0;">
                    <div>
                        <div style="font-weight: 600; color: #555; font-size: 12px;">Farmers</div>
                        <div style="color: #2e7d32; font-weight: 700; margin-top: 2px;">${session.farmers || 0}</div>
                    </div>
                    <div>
                        <div style="font-weight: 600; color: #555; font-size: 12px;">Acres</div>
                        <div style="color: #2e7d32; font-weight: 700; margin-top: 2px;">${(session.acres || 0).toLocaleString()}</div>
                    </div>
                </div>
                <div style="margin: 8px 0;">
                    <div style="font-weight: 600; color: #555; font-size: 12px;">Facilitator</div>
                    <div style="color: #333; margin-top: 2px;">${session.facilitator || 'Not specified'}</div>
                </div>
                ${session.focus ? `
                <div style="margin: 8px 0;">
                    <div style="font-weight: 600; color: #555; font-size: 12px;">Focus Area</div>
                    <div style="color: #333; margin-top: 2px; font-size: 13px;">${session.focus}</div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

// Add map controls
function addMapControls() {
    // Add fit bounds control
    const fitBoundsControl = L.control({ position: 'topright' });
    fitBoundsControl.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        div.innerHTML = `
            <a href="#" title="Fit to sessions" style="
                display: flex; align-items: center; justify-content: center; 
                width: 32px; height: 32px; background: white; border-radius: 4px;
                box-shadow: 0 1px 5px rgba(0,0,0,0.4); color: #2e7d32; font-size: 18px;
            ">
                <i class="fas fa-expand-alt"></i>
            </a>
        `;
        div.onclick = function(e) {
            e.preventDefault();
            if (AppState.filteredSessions.length > 0) {
                const bounds = L.latLngBounds(AppState.filteredSessions.map(s => [s.latitude, s.longitude]));
                AppState.map.fitBounds(bounds, { padding: [50, 50] });
            }
        };
        return div;
    };
    fitBoundsControl.addTo(AppState.map);
    
    // Add legend
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function(map) {
        const div = L.DomUtil.create('div', 'map-legend leaflet-control');
        div.style.background = 'rgba(255, 255, 255, 0.9)';
        div.style.padding = '10px';
        div.style.borderRadius = '5px';
        div.style.boxShadow = '0 1px 5px rgba(0,0,0,0.2)';
        div.style.fontSize = '12px';
        
        div.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px; color: #2e7d32;">Map Legend</div>
            <div style="display: flex; align-items: center; margin: 5px 0;">
                <div style="width: 12px; height: 12px; background: #2e7d32; border-radius: 50%; margin-right: 8px;"></div>
                <span>City Center</span>
            </div>
            <div style="display: flex; align-items: center; margin: 5px 0;">
                <div style="width: 12px; height: 12px; background: #ff9800; border-radius: 50%; margin-right: 8px;"></div>
                <span>Session Location</span>
            </div>
            <div style="display: flex; align-items: center; margin: 5px 0;">
                <div style="width: 20px; height: 20px; background: #4caf50; border-radius: 50%; margin-right: 8px; 
                          display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold;">
                    #
                </div>
                <span>Cluster of Sessions</span>
            </div>
        `;
        return div;
    };
    legend.addTo(AppState.map);
}

// Update map statistics
function updateMapStats() {
    const totalSessions = AppState.filteredSessions.length;
    const uniqueCities = [...new Set(AppState.filteredSessions.map(s => s.cityName))].length;
    const totalFarmers = AppState.filteredSessions.reduce((sum, session) => sum + (session.farmers || 0), 0);
    const totalAcres = AppState.filteredSessions.reduce((sum, session) => sum + (session.acres || 0), 0);
    
    document.getElementById('mapStats').textContent = 
        `${totalSessions} Sessions • ${uniqueCities} Cities • ${totalFarmers.toLocaleString()} Farmers • ${totalAcres.toLocaleString()} Acres`;
}

// Initialize gallery
function initializeGallery() {
    console.log('Initializing media gallery...');
    
    const galleryContainer = document.getElementById('mediaGallery');
    if (!galleryContainer) return;
    
    // Clear loading message
    galleryContainer.innerHTML = '';
    
    // Filter gallery items
    const galleryItems = AppState.mediaData?.mediaItems?.filter(item => 
        item.displayIn === 'gallery'
    ) || [];
    
    if (galleryItems.length === 0) {
        galleryContainer.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #666;">
                <i class="fas fa-images" style="font-size: 64px; margin-bottom: 20px; color: #ccc;"></i>
                <h3 style="margin-bottom: 10px; color: #555;">No Gallery Images Available</h3>
                <p style="max-width: 400px; margin: 0 auto 20px; line-height: 1.6;">
                    The media gallery is currently empty. Add images to the media.json file or check your data connection.
                </p>
                <button onclick="initializeGallery()" class="btn btn-primary">
                    <i class="fas fa-redo"></i> Retry Loading Gallery
                </button>
            </div>
        `;
        return;
    }
    
    // Display gallery items
    displayGalleryItems(galleryItems.slice(0, 12));
    
    // Show load more button if there are more items
    if (galleryItems.length > 12) {
        document.getElementById('loadMoreGallery').style.display = 'inline-flex';
        document.getElementById('loadMoreGallery').onclick = function() {
            loadMoreGalleryItems(galleryItems);
        };
    }
}

// Display gallery items
function displayGalleryItems(items) {
    const galleryContainer = document.getElementById('mediaGallery');
    
    items.forEach(media => {
        const galleryItem = createGalleryItem(media);
        galleryContainer.appendChild(galleryItem);
    });
}

// Create a gallery item element
function createGalleryItem(media) {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.setAttribute('data-city', media.city);
    item.setAttribute('data-type', media.type);
    item.setAttribute('data-session', media.sessionId);
    
    // City color mapping
    const cityColors = {
        'sukkur': '#2e7d32',
        'dgk': '#ff9800',
        'faisalabad': '#2196f3',
        'gujranwala': '#9c27b0'
    };
    const color = cityColors[media.city] || '#2e7d32';
    
    // Create image with fallback
    const img = document.createElement('img');
    img.src = media.filename;
    img.alt = media.caption;
    img.loading = 'lazy';
    img.onerror = function() {
        // Fallback to placeholder
        const colorHex = color.replace('#', '');
        this.src = `https://via.placeholder.com/400x300/${colorHex}/ffffff?text=${encodeURIComponent(media.type.toUpperCase())}`;
        this.onerror = null; // Prevent infinite loop
    };
    
    // Caption div
    const captionDiv = document.createElement('div');
    captionDiv.className = 'gallery-caption';
    captionDiv.innerHTML = `
        <div class="gallery-city" style="background: linear-gradient(135deg, ${color}, ${color}dd);">
            ${media.city.toUpperCase()} • Session ${media.sessionId}
        </div>
        <div class="gallery-title">${media.caption}</div>
        <div class="gallery-meta">
            <span><i class="fas fa-calendar"></i> ${media.date}</span>
            <span><i class="fas fa-tag"></i> ${media.type}</span>
        </div>
    `;
    
    item.appendChild(img);
    item.appendChild(captionDiv);
    
    // Click handler for gallery item
    item.addEventListener('click', function() {
        showImageModal(media);
    });
    
    return item;
}

// Load more gallery items
function loadMoreGalleryItems(allItems) {
    const galleryContainer = document.getElementById('mediaGallery');
    const currentCount = galleryContainer.children.length;
    const nextItems = allItems.slice(currentCount, currentCount + 12);
    
    displayGalleryItems(nextItems);
    
    // Hide load more button if all items are loaded
    if (currentCount + nextItems.length >= allItems.length) {
        document.getElementById('loadMoreGallery').style.display = 'none';
    }
}

// Show image modal
function showImageModal(media) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('imageModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'imageModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
        `;
        
        modal.innerHTML = `
            <div style="position: absolute; top: 20px; right: 20px;">
                <button id="closeModal" style="
                    background: none;
                    border: none;
                    color: white;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 10px;
                ">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div id="modalContent" style="
                max-width: 90%;
                max-height: 80%;
                display: flex;
                flex-direction: column;
                align-items: center;
            ">
                <img id="modalImage" style="
                    max-width: 100%;
                    max-height: 70vh;
                    object-fit: contain;
                    border-radius: 8px;
                    margin-bottom: 20px;
                ">
                <div id="modalCaption" style="
                    color: white;
                    text-align: center;
                    max-width: 600px;
                    padding: 0 20px;
                "></div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close modal on click
        document.getElementById('closeModal').onclick = function() {
            modal.style.display = 'none';
        };
        
        // Close on ESC key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && modal.style.display !== 'none') {
                modal.style.display = 'none';
            }
        });
    }
    
    // Update modal content
    document.getElementById('modalImage').src = media.filename;
    document.getElementById('modalImage').alt = media.caption;
    document.getElementById('modalCaption').innerHTML = `
        <h3 style="margin-bottom: 10px; color: white;">${media.caption}</h3>
        <div style="color: #ccc; font-size: 14px;">
            <div><strong>City:</strong> ${media.city}</div>
            <div><strong>Session:</strong> ${media.sessionId}</div>
            <div><strong>Date:</strong> ${media.date}</div>
            <div><strong>Type:</strong> ${media.type}</div>
        </div>
    `;
    
    // Show modal
    modal.style.display = 'flex';
}

// Initialize sessions table
function initializeSessionsTable() {
    console.log('Initializing sessions table...');
    
    const tableBody = document.getElementById('sessionsTableBody');
    if (!tableBody) return;
    
    // Clear loading message
    tableBody.innerHTML = '';
    
    // Display first page
    displaySessionsPage(1);
    
    // Update pagination controls
    updatePaginationControls();
}

// Display sessions for a specific page
function displaySessionsPage(page) {
    const tableBody = document.getElementById('sessionsTableBody');
    if (!tableBody) return;
    
    AppState.currentPage = page;
    
    // Calculate start and end indices
    const startIndex = (page - 1) * AppState.itemsPerPage;
    const endIndex = startIndex + AppState.itemsPerPage;
    const pageSessions = AppState.filteredSessions.slice(startIndex, endIndex);
    
    // Clear table
    tableBody.innerHTML = '';
    
    if (pageSessions.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: #666;">
                    <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 15px; color: #ccc; display: block;"></i>
                    <h3 style="margin-bottom: 10px;">No Sessions Found</h3>
                    <p>Try adjusting your filters or search criteria.</p>
                </td>
            </tr>
        `;
        return;
    }
    
    // Add sessions to table
    pageSessions.forEach(session => {
        const row = document.createElement('tr');
        
        // Determine row class based on farmers count
        const farmers = session.farmers || 0;
        let rowClass = '';
        if (farmers > 80) rowClass = 'high-attendance';
        else if (farmers > 50) rowClass = 'medium-attendance';
        
        row.className = rowClass;
        row.innerHTML = `
            <td class="session-number">${session.sessionNumber}</td>
            <td>${session.date}</td>
            <td class="session-city">${session.cityName}</td>
            <td class="session-spot" title="${session.spot}">${session.spot}</td>
            <td>${session.facilitator}</td>
            <td class="session-stats">${farmers}</td>
            <td class="session-stats">${(session.acres || 0).toLocaleString()}</td>
            <td>${session.focus || 'General Education'}</td>
        `;
        
        // Add click handler to zoom to location
        row.addEventListener('click', function() {
            if (session.latitude && session.longitude) {
                AppState.map.setView([session.latitude, session.longitude], 10);
                
                // Open popup
                AppState.markerCluster.eachLayer(function(layer) {
                    if (layer.getLatLng().lat === session.latitude && 
                        layer.getLatLng().lng === session.longitude) {
                        layer.openPopup();
                    }
                });
                
                // Switch to map tab
                document.querySelector('[data-tab="map"]').click();
            }
        });
        
        tableBody.appendChild(row);
    });
    
    // Update shown sessions count
    document.getElementById('shownSessions').textContent = 
        Math.min(endIndex, AppState.filteredSessions.length);
    document.getElementById('totalSessionsCount').textContent = 
        AppState.filteredSessions.length;
}

// Update pagination controls
function updatePaginationControls() {
    const totalPages = Math.ceil(AppState.filteredSessions.length / AppState.itemsPerPage);
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    prevBtn.disabled = AppState.currentPage <= 1;
    nextBtn.disabled = AppState.currentPage >= totalPages;
    
    // Update button event handlers
    prevBtn.onclick = function() {
        if (AppState.currentPage > 1) {
            displaySessionsPage(AppState.currentPage - 1);
            updatePaginationControls();
        }
    };
    
    nextBtn.onclick = function() {
        if (AppState.currentPage < totalPages) {
            displaySessionsPage(AppState.currentPage + 1);
            updatePaginationControls();
        }
    };
}

// Initialize analytics charts
function initializeAnalyticsCharts() {
    console.log('Initializing analytics charts...');
    
    // Daily attendance chart
    const attendanceChart = document.getElementById('attendanceChart');
    if (attendanceChart && AppState.sessions.length > 0) {
        // Group sessions by date
        const dailyData = {};
        AppState.sessions.forEach(session => {
            const date = session.date;
            if (!dailyData[date]) dailyData[date] = { farmers: 0, sessions: 0 };
            dailyData[date].farmers += session.farmers || 0;
            dailyData[date].sessions += 1;
        });
        
        // Get dates and sort
        const dates = Object.keys(dailyData).sort();
        const maxFarmers = Math.max(...Object.values(dailyData).map(d => d.farmers));
        
        // Create bars
        attendanceChart.innerHTML = dates.map(date => {
            const data = dailyData[date];
            const height = (data.farmers / maxFarmers) * 150;
            return `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                    <div style="height: ${height}px; width: 30px; 
                                background: linear-gradient(to top, #2e7d32, #4caf50); 
                                border-radius: 4px 4px 0 0; position: relative;">
                        <div style="position: absolute; top: -25px; left: 0; right: 0; 
                                    font-weight: bold; color: #2e7d32; font-size: 12px; text-align: center;">
                            ${data.farmers}
                        </div>
                    </div>
                    <div style="margin-top: 10px; font-size: 11px; color: #666; transform: rotate(-45deg); 
                                transform-origin: left top; white-space: nowrap;">
                        ${date.split('-').slice(1).join('-')}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Regional distribution chart
    const regionalChart = document.getElementById('regionalChart');
    if (regionalChart && AppState.campaignData?.cities) {
        const cities = AppState.campaignData.cities;
        const totalSessions = cities.reduce((sum, city) => sum + city.sessions, 0);
        
        regionalChart.innerHTML = `
            <div style="display: flex; flex-wrap: wrap; gap: 20px; justify-content: center;">
                ${cities.map(city => {
                    const percentage = Math.round((city.sessions / totalSessions) * 100);
                    return `
                        <div style="text-align: center;">
                            <div style="font-size: 32px; font-weight: 800; color: #2e7d32;">${percentage}%</div>
                            <div style="font-weight: 600; color: #333; margin-top: 5px;">${city.code}</div>
                            <div style="font-size: 12px; color: #666;">${city.sessions} sessions</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
}

// Update dashboard statistics
function updateDashboardStats() {
    if (!AppState.campaignData) return;
    
    const totalSessions = AppState.filteredSessions.length;
    const totalFarmers = AppState.filteredSessions.reduce((sum, session) => sum + (session.farmers || 0), 0);
    const totalAcres = AppState.filteredSessions.reduce((sum, session) => sum + (session.acres || 0), 0);
    const uniqueCities = [...new Set(AppState.filteredSessions.map(s => s.cityName))].length;
    
    // Update main stats
    document.getElementById('sessionCount').textContent = totalSessions;
    document.getElementById('farmerCount').textContent = totalFarmers.toLocaleString();
    document.getElementById('acreCount').textContent = totalAcres.toLocaleString();
    document.getElementById('cityCount').textContent = uniqueCities;
    
    // Update overview stats
    document.getElementById('totalSessions').textContent = totalSessions;
    document.getElementById('totalFarmers').textContent = totalFarmers.toLocaleString();
    document.getElementById('totalAcres').textContent = totalAcres.toLocaleString();
    
    // Update status indicator
    updateStatus(`${totalSessions} sessions filtered • ${uniqueCities} cities`, 'success');
}

// Update status indicator
function updateStatus(message, type = 'info') {
    const indicator = document.getElementById('statusIndicator');
    if (!indicator) return;
    
    let icon = 'fa-info-circle';
    let className = 'status-indicator';
    
    switch (type) {
        case 'success':
            icon = 'fa-check-circle';
            className += ' status-success';
            break;
        case 'error':
            icon = 'fa-exclamation-circle';
            className += ' status-error';
            break;
        case 'loading':
            icon = 'fa-spinner fa-spin';
            className += ' status-loading';
            break;
        case 'warning':
            icon = 'fa-exclamation-triangle';
            className += ' status-warning';
            break;
    }
    
    indicator.className = className;
    indicator.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
}

// Show error message
function showError(message) {
    const errorBanner = document.getElementById('errorBanner');
    const errorMessage = document.getElementById('errorMessage');
    
    if (errorBanner && errorMessage) {
        errorMessage.textContent = message;
        errorBanner.style.display = 'flex';
    }
    
    console.error('Dashboard Error:', message);
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Apply filters button
    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    
    // Export data button
    document.getElementById('exportData').addEventListener('click', exportData);
    
    // Reset filters button
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
    
    // Refresh data button
    document.getElementById('refreshData').addEventListener('click', refreshData);
    
    // Quick filter buttons
    document.getElementById('filterMajor').addEventListener('click', () => {
        document.getElementById('searchInput').value = 'major';
        applyFilters();
    });
    
    document.getElementById('filterRecent').addEventListener('click', () => {
        const today = new Date();
        const lastWeek = new Date(today);
        lastWeek.setDate(today.getDate() - 7);
        
        document.getElementById('dateFrom').value = lastWeek.toISOString().split('T')[0];
        document.getElementById('dateTo').value = today.toISOString().split('T')[0];
        applyFilters();
    });
    
    // Search input (with debounce)
    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', function(e) {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (e.target.value.length >= 2 || e.target.value.length === 0) {
                applyFilters();
            }
        }, 300);
    });
    
    // City filter
    document.getElementById('cityFilter').addEventListener('change', applyFilters);
    
    // Date filters
    document.getElementById('dateFrom').addEventListener('change', applyFilters);
    document.getElementById('dateTo').addEventListener('change', applyFilters);
    
    // Gallery filter buttons
    document.querySelectorAll('.gallery-filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // Update active button
            document.querySelectorAll('.gallery-filter-btn').forEach(b => 
                b.classList.remove('active')
            );
            this.classList.add('active');
            
            // Filter gallery
            const filter = this.getAttribute('data-filter');
            AppState.currentGalleryFilter = filter;
            filterGallery(filter);
        });
    });
    
    // Attendance range slider
    const attendanceRange = document.getElementById('attendanceRange');
    const rangeValue = document.getElementById('rangeValue');
    if (attendanceRange && rangeValue) {
        attendanceRange.addEventListener('input', function() {
            const value = this.value;
            rangeValue.textContent = value === '0' ? 'All farmers' : `${value}+ farmers`;
        });
        
        attendanceRange.addEventListener('change', applyFilters);
    }
    
    // Map filter checkboxes
    document.querySelectorAll('.map-filter').forEach(checkbox => {
        checkbox.addEventListener('change', applyFilters);
    });
    
    // Fit bounds button
    document.getElementById('fitBounds')?.addEventListener('click', function() {
        if (AppState.filteredSessions.length > 0 && AppState.map) {
            const bounds = L.latLngBounds(AppState.filteredSessions.map(s => [s.latitude, s.longitude]));
            AppState.map.fitBounds(bounds, { padding: [50, 50] });
        }
    });
    
    // Reset map button
    document.getElementById('resetMap')?.addEventListener('click', function() {
        if (AppState.map) {
            AppState.map.setView([30.3753, 69.3451], 6);
        }
    });
    
    console.log('Event listeners setup complete');
}

// Apply filters
function applyFilters() {
    console.log('Applying filters...');
    
    // Get filter values
    const cityFilter = document.getElementById('cityFilter').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();
    const attendanceRange = document.getElementById('attendanceRange')?.value || 0;
    
    // Filter sessions
    AppState.filteredSessions = AppState.sessions.filter(session => {
        // City filter
        if (cityFilter !== 'all' && session.city !== cityFilter) {
            return false;
        }
        
        // Date filter
        if (session.date && session.date !== 'Unknown') {
            const sessionDate = new Date(session.date);
            const fromDate = dateFrom ? new Date(dateFrom) : null;
            const toDate = dateTo ? new Date(dateTo) : null;
            
            if (fromDate && sessionDate < fromDate) return false;
            if (toDate && sessionDate > toDate) return false;
        }
        
        // Search filter
        if (searchQuery) {
            const searchText = `${session.sessionNumber} ${session.cityName} ${session.spot} ${session.facilitator} ${session.focus}`.toLowerCase();
            if (!searchText.includes(searchQuery)) return false;
        }
        
        // Attendance filter
        if (attendanceRange > 0 && session.farmers < parseInt(attendanceRange)) {
            return false;
        }
        
        // Map type filters (simplified)
        const typeFilters = document.querySelectorAll('.map-filter:checked');
        if (typeFilters.length > 0) {
            // This is a simplified implementation
            // In a real app, you would filter by session type
        }
        
        return true;
    });
    
    // Update all components
    updateDashboardStats();
    updateMapMarkers();
    displaySessionsPage(1);
    updatePaginationControls();
    filterGallery(AppState.currentGalleryFilter);
    
    console.log(`Filtered to ${AppState.filteredSessions.length} sessions`);
}

// Filter gallery
function filterGallery(filter) {
    const galleryItems = document.querySelectorAll('.gallery-item');
    const galleryContainer = document.getElementById('mediaGallery');
    
    let visibleCount = 0;
    
    galleryItems.forEach(item => {
        const city = item.getAttribute('data-city');
        const type = item.getAttribute('data-type');
        const sessionId = item.getAttribute('data-session');
        
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
            case 'videos':
                showItem = type.includes('video') || type.includes('demonstration');
                break;
            case 'demonstrations':
                showItem = type.includes('demonstration') || type.includes('field');
                break;
            default:
                showItem = true;
        }
        
        item.style.display = showItem ? 'block' : 'none';
        if (showItem) visibleCount++;
    });
    
    // Show message if no items match filter
    if (visibleCount === 0 && galleryContainer) {
        const noResults = document.createElement('div');
        noResults.style.gridColumn = '1 / -1';
        noResults.style.textAlign = 'center';
        noResults.style.padding = '40px';
        noResults.style.color = '#666';
        noResults.innerHTML = `
            <i class="fas fa-search" style="font-size: 48px; margin-bottom: 15px; color: #ccc;"></i>
            <h3 style="margin-bottom: 10px;">No Matching Images</h3>
            <p>No gallery items match the current filter: <strong>${filter}</strong></p>
        `;
        
        // Check if message already exists
        const existingMessage = galleryContainer.querySelector('.no-results-message');
        if (existingMessage) {
            existingMessage.remove();
        }
        
        noResults.className = 'no-results-message';
        galleryContainer.appendChild(noResults);
    } else {
        // Remove any existing no-results message
        const existingMessage = galleryContainer.querySelector('.no-results-message');
        if (existingMessage) {
            existingMessage.remove();
        }
    }
}

// Export data to CSV
function exportData() {
    if (AppState.filteredSessions.length === 0) {
        alert('No data to export. Please adjust your filters.');
        return;
    }
    
    try {
        // Prepare CSV content
        const headers = ['Session ID', 'City', 'Location', 'Date', 'Farmers', 'Acres', 'Facilitator', 'Focus Area'];
        const csvRows = [
            headers.join(','),
            ...AppState.filteredSessions.map(session => [
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
        
        // Create filename with timestamp
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `agrivista-export-${timestamp}.csv`;
        
        if (navigator.msSaveBlob) { // IE 10+
            navigator.msSaveBlob(blob, filename);
        } else {
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        
        updateStatus(`Exported ${AppState.filteredSessions.length} sessions to CSV`, 'success');
        
    } catch (error) {
        console.error('Export failed:', error);
        showError('Failed to export data. Please try again.');
    }
}

// Reset all filters
function resetFilters() {
    console.log('Resetting all filters...');
    
    // Reset form values
    document.getElementById('cityFilter').value = 'all';
    document.getElementById('dateFrom').value = '2025-11-24';
    document.getElementById('dateTo').value = '2025-12-12';
    document.getElementById('searchInput').value = '';
    
    // Reset range slider
    const attendanceRange = document.getElementById('attendanceRange');
    if (attendanceRange) {
        attendanceRange.value = 0;
        document.getElementById('rangeValue').textContent = 'All farmers';
    }
    
    // Reset gallery filter
    document.querySelectorAll('.gallery-filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-filter') === 'all') {
            btn.classList.add('active');
        }
    });
    
    // Reset map filters
    document.querySelectorAll('.map-filter').forEach(checkbox => {
        checkbox.checked = true;
    });
    
    // Apply reset
    AppState.filteredSessions = [...AppState.sessions];
    AppState.currentGalleryFilter = 'all';
    AppState.currentPage = 1;
    
    // Update components
    updateDashboardStats();
    updateMapMarkers();
    displaySessionsPage(1);
    updatePaginationControls();
    filterGallery('all');
    
    // Reset map view
    if (AppState.map) {
        AppState.map.setView([30.3753, 69.3451], 6);
    }
    
    updateStatus('All filters reset successfully', 'success');
}

// Refresh data
function refreshData() {
    console.log('Refreshing dashboard data...');
    
    updateStatus('Refreshing data...', 'loading');
    
    // Reload data
    loadDashboardData().then(() => {
        updateStatus('Data refreshed successfully', 'success');
    }).catch(error => {
        console.error('Refresh failed:', error);
        updateStatus('Refresh failed', 'error');
    });
}

// Zoom to city on map
function zoomToCity(cityCode) {
    if (AppState.cityBounds[cityCode] && AppState.map) {
        const city = AppState.cityBounds[cityCode];
        AppState.map.setView([city.lat, city.lng], 8);
    }
}

// Tab switching functionality
document.addEventListener('DOMContentLoaded', function() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('#tabContent > section');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Show corresponding content
            tabContents.forEach(content => {
                content.style.display = content.id === tabId + 'Tab' ? 'block' : 'none';
            });
            
            // Special handling for map tab
            if (tabId === 'map' && AppState.map) {
                setTimeout(() => {
                    AppState.map.invalidateSize();
                }, 100);
            }
            
            // Special handling for analytics tab
            if (tabId === 'analytics') {
                initializeAnalyticsCharts();
            }
        });
    });
});

// Initialize when page loads
console.log('AgriVista Dashboard v2.0 - Ready to initialize');
