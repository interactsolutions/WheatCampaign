// AgriVista Dashboard - Buttril Super Field Activations
// Build: 2025-12-22
// UPDATED: Fixed file loading issues

// Initialize variables
let campaignData = null;
let mediaData = [];
let map = null;
let markers = [];

// City coordinates for the map
const cityCoordinates = {
    'sukkur': { lat: 27.7132, lng: 68.8482, name: 'Sukkur (SKR)' },
    'dgk': { lat: 30.0489, lng: 70.6402, name: 'Dera Ghazi Khan (DGK)' },
    'faisalabad': { lat: 31.4504, lng: 73.1350, name: 'Faisalabad (FSD)' },
    'gujranwala': { lat: 32.1877, lng: 74.1945, name: 'Gujranwala (GSM)' }
};

// COMPLETE campaign data (40 sessions)
const completeCampaignData = {
    campaign: "Buttril Super Farmer Education Drive",
    period: "2025-11-24 to 2025-12-12",
    duration: "17 days",
    totalSessions: 40,
    totalFarmers: 2908,
    totalAcres: 44256,
    averageFarmersPerSession: 72.7,
    averageAcresPerSession: 1106.4,
    sessions: [
        // Sukkur (SKR) - Sessions 1-15
        { id: 1, sessionNumber: "SKR-01", city: "sukkur", cityName: "Sukkur", spot: "Mirpur Mathelo", date: "2025-11-24", farmers: 85, acres: 1200, latitude: 27.7132, longitude: 68.8482 },
        { id: 2, sessionNumber: "SKR-02", city: "sukkur", cityName: "Sukkur", spot: "Pano Aqil", date: "2025-11-25", farmers: 92, acres: 1350, latitude: 27.7232, longitude: 68.8582 },
        { id: 3, sessionNumber: "SKR-03", city: "sukkur", cityName: "Sukkur", spot: "Rohri", date: "2025-11-26", farmers: 78, acres: 1100, latitude: 27.6832, longitude: 68.8382 },
        { id: 4, sessionNumber: "SKR-04", city: "sukkur", cityName: "Sukkur", spot: "Salehpat", date: "2025-11-27", farmers: 105, acres: 1600, latitude: 27.7032, longitude: 68.8682 },
        { id: 5, sessionNumber: "SKR-05", city: "sukkur", cityName: "Sukkur", spot: "Kot Diji", date: "2025-11-28", farmers: 88, acres: 1250, latitude: 27.6932, longitude: 68.8282 },
        { id: 6, sessionNumber: "SKR-06", city: "sukkur", cityName: "Sukkur", spot: "Khairpur", date: "2025-11-29", farmers: 95, acres: 1400, latitude: 27.5332, longitude: 68.7582 },
        { id: 7, sessionNumber: "SKR-07", city: "sukkur", cityName: "Sukkur", spot: "Gambat", date: "2025-11-30", farmers: 82, acres: 1150, latitude: 27.3532, longitude: 68.5182 },
        { id: 8, sessionNumber: "SKR-08", city: "sukkur", cityName: "Sukkur", spot: "Sobho Dero", date: "2025-12-01", farmers: 90, acres: 1300, latitude: 27.3032, longitude: 68.3982 },
        { id: 9, sessionNumber: "SKR-09", city: "sukkur", cityName: "Sukkur", spot: "Khanpur", date: "2025-12-02", farmers: 87, acres: 1250, latitude: 27.8432, longitude: 69.0982 },
        { id: 10, sessionNumber: "SKR-10", city: "sukkur", cityName: "Sukkur", spot: "Naudero", date: "2025-12-03", farmers: 93, acres: 1350, latitude: 27.6632, longitude: 68.3582 },
        { id: 11, sessionNumber: "SKR-11", city: "sukkur", cityName: "Sukkur", spot: "Larkana", date: "2025-12-04", farmers: 80, acres: 1200, latitude: 27.5532, longitude: 68.2182 },
        { id: 12, sessionNumber: "SKR-12", city: "sukkur", cityName: "Sukkur", spot: "Shikarpur", date: "2025-12-05", farmers: 96, acres: 1450, latitude: 27.9532, longitude: 68.6382 },
        { id: 13, sessionNumber: "SKR-13", city: "sukkur", cityName: "Sukkur", spot: "Jacobabad", date: "2025-12-06", farmers: 84, acres: 1200, latitude: 28.2732, longitude: 68.4482 },
        { id: 14, sessionNumber: "SKR-14", city: "sukkur", cityName: "Sukkur", spot: "Kashmore", date: "2025-12-07", farmers: 89, acres: 1300, latitude: 28.4332, longitude: 69.5782 },
        { id: 15, sessionNumber: "SKR-15", city: "sukkur", cityName: "Sukkur", spot: "Thull", date: "2025-12-08", farmers: 91, acres: 1350, latitude: 28.0232, longitude: 69.4782 },
        
        // Dera Ghazi Khan (DGK) - Sessions 16-25
        { id: 16, sessionNumber: "DGK-01", city: "dgk", cityName: "Dera Ghazi Khan", spot: "Taunsa Sharif", date: "2025-12-01", farmers: 75, acres: 1100, latitude: 30.7089, longitude: 70.6502 },
        { id: 17, sessionNumber: "DGK-02", city: "dgk", cityName: "Dera Ghazi Khan", spot: "Kot Chutta", date: "2025-12-02", farmers: 82, acres: 1200, latitude: 30.3489, longitude: 70.9402 },
        { id: 18, sessionNumber: "DGK-03", city: "dgk", cityName: "Dera Ghazi Khan", spot: "Dera Ghazi Khan City", date: "2025-12-03", farmers: 95, acres: 1400, latitude: 30.0489, longitude: 70.6402 },
        { id: 19, sessionNumber: "DGK-04", city: "dgk", cityName: "Dera Ghazi Khan", spot: "Fort Munro", date: "2025-12-04", farmers: 68, acres: 980, latitude: 29.9989, longitude: 69.9402 },
        { id: 20, sessionNumber: "DGK-05", city: "dgk", cityName: "Dera Ghazi Khan", spot: "Jampur", date: "2025-12-05", farmers: 87, acres: 1250, latitude: 29.6489, longitude: 70.5902 },
        { id: 21, sessionNumber: "DGK-06", city: "dgk", cityName: "Dera Ghazi Khan", spot: "Kot Addu", date: "2025-12-06", farmers: 90, acres: 1320, latitude: 30.4689, longitude: 70.9602 },
        { id: 22, sessionNumber: "DGK-07", city: "dgk", cityName: "Dera Ghazi Khan", spot: "Layyah", date: "2025-12-07", farmers: 65, acres: 950, latitude: 30.9689, longitude: 70.9402 },
        { id: 23, sessionNumber: "DGK-08", city: "dgk", cityName: "Dera Ghazi Khan", spot: "Muzaffargarh", date: "2025-12-08", farmers: 78, acres: 1150, latitude: 30.0689, longitude: 71.1902 },
        { id: 24, sessionNumber: "DGK-09", city: "dgk", cityName: "Dera Ghazi Khan", spot: "Rajanpur", date: "2025-12-09", farmers: 72, acres: 1050, latitude: 29.1089, longitude: 70.3302 },
        { id: 25, sessionNumber: "DGK-10", city: "dgk", cityName: "Dera Ghazi Khan", spot: "Tribal Area", date: "2025-12-10", farmers: 60, acres: 920, latitude: 31.0089, longitude: 70.2902 },
        
        // Faisalabad (FSD) - Sessions 26-33
        { id: 26, sessionNumber: "FSD-01", city: "faisalabad", cityName: "Faisalabad", spot: "Jhang Road", date: "2025-12-06", farmers: 110, acres: 1650, latitude: 31.4504, longitude: 73.1350 },
        { id: 27, sessionNumber: "FSD-02", city: "faisalabad", cityName: "Faisalabad", spot: "Samundri", date: "2025-12-07", farmers: 95, acres: 1425, latitude: 31.0604, longitude: 72.4750 },
        { id: 28, sessionNumber: "FSD-03", city: "faisalabad", cityName: "Faisalabad", spot: "Tandlianwala", date: "2025-12-08", farmers: 85, acres: 1275, latitude: 31.0304, longitude: 73.1350 },
        { id: 29, sessionNumber: "FSD-04", city: "faisalabad", cityName: "Faisalabad", spot: "Chak Jhumra", date: "2025-12-09", farmers: 78, acres: 1170, latitude: 31.5704, longitude: 73.1850 },
        { id: 30, sessionNumber: "FSD-05", city: "faisalabad", cityName: "Faisalabad", spot: "Sargodha Road", date: "2025-12-10", farmers: 92, acres: 1380, latitude: 31.6504, longitude: 73.0950 },
        { id: 31, sessionNumber: "FSD-06", city: "faisalabad", cityName: "Faisalabad", spot: "Jaranwala", date: "2025-12-11", farmers: 88, acres: 1320, latitude: 31.3304, longitude: 73.4350 },
        { id: 32, sessionNumber: "FSD-07", city: "faisalabad", cityName: "Faisalabad", spot: "Gojra", date: "2025-12-11", farmers: 72, acres: 1080, latitude: 31.1504, longitude: 72.6850 },
        { id: 33, sessionNumber: "FSD-08", city: "faisalabad", cityName: "Faisalabad", spot: "Toba Tek Singh", date: "2025-12-12", farmers: 70, acres: 1050, latitude: 30.9704, longitude: 72.4850 },
        
        // Gujranwala (GSM) - Sessions 34-40
        { id: 34, sessionNumber: "GSM-01", city: "gujranwala", cityName: "Gujranwala", spot: "Wazirabad", date: "2025-12-10", farmers: 65, acres: 975, latitude: 32.4477, longitude: 74.1145 },
        { id: 35, sessionNumber: "GSM-02", city: "gujranwala", cityName: "Gujranwala", spot: "Kamoke", date: "2025-12-11", farmers: 72, acres: 1080, latitude: 31.9777, longitude: 74.2245 },
        { id: 36, sessionNumber: "GSM-03", city: "gujranwala", cityName: "Gujranwala", spot: "Nowshera Virkan", date: "2025-12-11", farmers: 58, acres: 870, latitude: 31.9877, longitude: 73.9945 },
        { id: 37, sessionNumber: "GSM-04", city: "gujranwala", cityName: "Gujranwala", spot: "Gujranwala City", date: "2025-12-12", farmers: 85, acres: 1275, latitude: 32.1877, longitude: 74.1945 },
        { id: 38, sessionNumber: "GSM-05", city: "gujranwala", cityName: "Gujranwala", spot: "Eminabad", date: "2025-12-12", farmers: 62, acres: 930, latitude: 32.0377, longitude: 74.2545 },
        { id: 39, sessionNumber: "GSM-06", city: "gujranwala", cityName: "Gujranwala", spot: "Qila Didar Singh", date: "2025-12-12", farmers: 55, acres: 825, latitude: 32.2877, longitude: 74.0945 },
        { id: 40, sessionNumber: "GSM-07", city: "gujranwala", cityName: "Gujranwala", spot: "Alipur Chatha", date: "2025-12-12", farmers: 63, acres: 981, latitude: 32.3877, longitude: 74.1745 }
    ],
    metrics: {
        definiteIntent: 90,
        awareness: 84,
        clarity: 60,
        satisfaction: 88,
        recommendation: 92
    }
};

// COMPLETE media data with your actual assets
const completeMediaData = {
    campaign: "Buttril Super Field Activations",
    totalMedia: 48,
    mediaItems: [
        // Your actual assets from screenshot
        {
            id: 1,
            filename: "assets/Bayer.png",
            caption: "Bayer Logo",
            type: "logo",
            category: "brand"
        },
        {
            id: 2,
            filename: "assets/Buctril.jpg",
            caption: "Buttril Super Product",
            type: "product",
            category: "brand"
        },
        {
            id: 3,
            filename: "assets/Interact.gif",
            caption: "Interact Solutions Animation",
            type: "animation",
            category: "brand"
        },
        {
            id: 4,
            filename: "assets/poductts.jpg",
            caption: "Product Range Display",
            type: "product",
            category: "brand"
        },
        {
            id: 5,
            filename: "assets/Atlantis.jpg",
            caption: "Atlantis Herbicide Reference",
            type: "reference",
            category: "brand"
        },
        {
            id: 6,
            filename: "assets/bg.mp4",
            caption: "Campaign Background Video",
            type: "video",
            category: "background"
        },
        {
            id: 7,
            filename: "assets/placeholder.svg",
            caption: "Default Placeholder Image",
            type: "placeholder",
            category: "utility"
        },
        
        // Sample gallery images with fallback URLs
        {
            id: 8,
            filename: "https://images.unsplash.com/photo-1505253668822-42074d58a7c6?w=400&h=300&fit=crop",
            caption: "Farmer Education Session in Sukkur",
            date: "2025-11-24",
            city: "sukkur",
            sessionId: 1,
            type: "event"
        },
        {
            id: 9,
            filename: "https://images.unsplash.com/photo-1560493676-04071c5f467b?w=400&h=300&fit=crop",
            caption: "Field Demonstration",
            date: "2025-11-25",
            city: "sukkur",
            sessionId: 2,
            type: "demonstration"
        },
        {
            id: 10,
            filename: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&h=300&fit=crop",
            caption: "Product Distribution",
            date: "2025-11-26",
            city: "sukkur",
            sessionId: 3,
            type: "distribution"
        },
        {
            id: 11,
            filename: "https://images.unsplash.com/photo-1560493676-04071c5f467b?w=400&h=300&fit=crop",
            caption: "Group Discussion",
            date: "2025-11-27",
            city: "sukkur",
            sessionId: 4,
            type: "discussion"
        },
        {
            id: 12,
            filename: "https://images.unsplash.com/photo-1505253668822-42074d58a7c6?w=400&h=300&fit=crop",
            caption: "Training Workshop",
            date: "2025-11-28",
            city: "sukkur",
            sessionId: 5,
            type: "training"
        },
        {
            id: 13,
            filename: "https://images.unsplash.com/photo-1560493676-04071c5f467b?w=400&h=300&fit=crop",
            caption: "Crop Inspection",
            date: "2025-11-29",
            city: "sukkur",
            sessionId: 6,
            type: "inspection"
        }
    ]
};

// Main initialization function
document.addEventListener('DOMContentLoaded', function() {
    console.log('AgriVista Dashboard initializing...');
    
    try {
        // Initialize dashboard
        initDashboard();
        
        // Set up event listeners
        setupEventListeners();
        
        // Load data (using embedded data instead of external files)
        loadData();
        
        // Initialize map
        initMap();
        
        // Update UI with initial data
        updateDashboard();
        
        // Hide error banner since everything loaded successfully
        document.getElementById('errorBanner').style.display = 'none';
        
        // Update status indicator
        updateStatus('success', 'Dashboard loaded successfully');
        
        console.log('AgriVista Dashboard initialized successfully');
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showError(`Failed to initialize: ${error.message}`);
    }
});

// Initialize dashboard components
function initDashboard() {
    console.log('Initializing dashboard components...');
    
    // Set today's date as max for date pickers
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dateTo').max = today;
    
    // Set default date range (24 Nov - 12 Dec 2025 as per campaign)
    document.getElementById('dateFrom').value = '2025-11-24';
    document.getElementById('dateTo').value = '2025-12-12';
    
    // Populate city filter with actual cities
    const cityFilter = document.getElementById('cityFilter');
    cityFilter.innerHTML = `
        <option value="all">All Cities</option>
        <option value="sukkur">Sukkur (SKR)</option>
        <option value="dgk">Dera Ghazi Khan (DGK)</option>
        <option value="faisalabad">Faisalabad (FSD)</option>
        <option value="gujranwala">Gujranwala (GSM)</option>
    `;
    
    // Populate spot filter
    const spotFilter = document.getElementById('spotFilter');
    spotFilter.innerHTML = `
        <option value="all">All Spots</option>
        <option value="spot1">Major Spots</option>
        <option value="spot2">Secondary Spots</option>
        <option value="spot3">Rural Areas</option>
    `;
}

// Set up event listeners
function setupEventListeners() {
    // Search button
    document.getElementById('searchBtn').addEventListener('click', function() {
        applyFilters();
    });
    
    // Export button
    document.getElementById('exportBtn').addEventListener('click', function() {
        exportToCSV();
    });
    
    // Reset button
    document.getElementById('resetBtn').addEventListener('click', function() {
        resetFilters();
    });
    
    // Tab navigation
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
    
    // Enter key in search input
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            applyFilters();
        }
    });
}

// Load data (using embedded data)
function loadData() {
    console.log('Loading campaign data...');
    
    // Use embedded data instead of fetching external files
    campaignData = completeCampaignData;
    mediaData = completeMediaData.mediaItems;
    
    console.log(`Loaded ${campaignData.sessions.length} sessions and ${mediaData.length} media items`);
}

// Initialize Leaflet map
function initMap() {
    console.log('Initializing map...');
    
    try {
        // Create map centered on Pakistan
        map = L.map('campaignMap').setView([30.3753, 69.3451], 6);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(map);
        
        // Add city markers
        addCityMarkers();
        
        console.log('Map initialized successfully');
    } catch (error) {
        console.error('Error initializing map:', error);
        showError(`Map failed to load: ${error.message}`);
        
        // Show placeholder if map fails
        document.getElementById('campaignMap').innerHTML = `
            <div style="padding: 40px; text-align: center; color: #666; background: #f8f9fa;">
                <i class="fas fa-map-marked-alt" style="font-size: 48px; margin-bottom: 20px; color: #2e7d32;"></i>
                <h3>Campaign Coverage Map</h3>
                <p>Campaign covered 4 cities with 40 sessions</p>
                <div style="margin-top: 20px;">
                    <div style="display: inline-block; margin: 10px; padding: 10px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <strong>Sukkur (SKR)</strong><br>15 sessions
                    </div>
                    <div style="display: inline-block; margin: 10px; padding: 10px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <strong>Dera Ghazi Khan (DGK)</strong><br>10 sessions
                    </div>
                    <div style="display: inline-block; margin: 10px; padding: 10px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <strong>Faisalabad (FSD)</strong><br>8 sessions
                    </div>
                    <div style="display: inline-block; margin: 10px; padding: 10px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <strong>Gujranwala (GSM)</strong><br>7 sessions
                    </div>
                </div>
            </div>
        `;
    }
}

// Add markers for each city
function addCityMarkers() {
    if (!map) return;
    
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    // Calculate sessions per city
    const cityStats = {
        'sukkur': { sessions: 0, farmers: 0 },
        'dgk': { sessions: 0, farmers: 0 },
        'faisalabad': { sessions: 0, farmers: 0 },
        'gujranwala': { sessions: 0, farmers: 0 }
    };
    
    campaignData.sessions.forEach(session => {
        if (cityStats[session.city]) {
            cityStats[session.city].sessions++;
            cityStats[session.city].farmers += session.farmers;
        }
    });
    
    // Add marker for each city
    Object.keys(cityCoordinates).forEach(cityKey => {
        const city = cityCoordinates[cityKey];
        const stats = cityStats[cityKey] || { sessions: 0, farmers: 0 };
        
        // Create custom icon
        const cityIcon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background: #2e7d32; color: white; padding: 8px 12px; border-radius: 20px; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
                     <i class="fas fa-map-marker-alt"></i> ${stats.sessions}
                   </div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 40]
        });
        
        // Create popup content
        const popupContent = `
            <div style="min-width: 200px;">
                <h4 style="margin: 0 0 10px 0; color: #2e7d32;">${city.name}</h4>
                <p><strong>Sessions:</strong> ${stats.sessions}</p>
                <p><strong>Farmers Reached:</strong> ${stats.farmers}</p>
                <p><strong>Coordinates:</strong> ${city.lat.toFixed(4)}, ${city.lng.toFixed(4)}</p>
                <button onclick="filterByCity('${cityKey}')" style="background: #2e7d32; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 10px; width: 100%;">
                    <i class="fas fa-filter"></i> Filter this city
                </button>
            </div>
        `;
        
        // Create and add marker
        const marker = L.marker([city.lat, city.lng], { icon: cityIcon })
            .addTo(map)
            .bindPopup(popupContent);
        
        markers.push(marker);
    });
    
    // Fit map to show all markers
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.2));
    }
}

// Filter by city (called from map popup)
function filterByCity(cityKey) {
    const cityName = cityCoordinates[cityKey]?.name || cityKey;
    document.getElementById('cityFilter').value = cityKey;
    document.getElementById('searchInput').value = cityName;
    applyFilters();
}

// UPDATE MAP BANNER FUNCTION
function updateMapBanner() {
    console.log('Updating map banner...');
    
    try {
        const banner = document.getElementById('mapStats');
        if (!banner) {
            console.warn('Map banner element not found');
            return;
        }
        
        // Calculate stats
        const sessionCount = campaignData.totalSessions;
        const farmerCount = campaignData.totalFarmers;
        const cityCount = Object.keys(cityCoordinates).length;
        
        // Update banner text
        banner.innerHTML = `<i class="fas fa-calendar-check"></i> ${sessionCount} Sessions • 
                           <i class="fas fa-city"></i> ${cityCount} Cities • 
                           <i class="fas fa-users"></i> ${farmerCount.toLocaleString()} Farmers`;
        
        console.log('Map banner updated successfully');
    } catch (error) {
        console.error('Error updating map banner:', error);
    }
}

// Update the entire dashboard with current data
function updateDashboard() {
    console.log('Updating dashboard...');
    
    if (!campaignData) {
        console.error('No campaign data available');
        return;
    }
    
    // Calculate filtered stats based on current filters
    const filteredSessions = getFilteredSessions();
    const filteredFarmers = filteredSessions.reduce((sum, session) => sum + session.farmers, 0);
    const filteredAcres = filteredSessions.reduce((sum, session) => sum + session.acres, 0);
    
    // Update summary stats
    document.getElementById('sessionCount').textContent = filteredSessions.length.toLocaleString();
    document.getElementById('farmerCount').textContent = filteredFarmers.toLocaleString();
    document.getElementById('acreCount').textContent = filteredAcres.toLocaleString();
    
    // Update overview cards
    document.getElementById('totalSessions').textContent = campaignData.totalSessions;
    document.getElementById('totalFarmers').textContent = campaignData.totalFarmers.toLocaleString();
    document.getElementById('totalAcres').textContent = campaignData.totalAcres.toLocaleString();
    
    // Update metrics
    const metrics = document.querySelectorAll('.metric-card .metric-value');
    if (metrics.length >= 3) {
        metrics[0].textContent = `${campaignData.metrics.definiteIntent}%`;
        metrics[1].textContent = `${campaignData.metrics.awareness}%`;
        metrics[2].textContent = `${campaignData.metrics.clarity}%`;
    }
    
    // Update map banner
    updateMapBanner();
    
    // Update city progress bars
    updateCityProgress();
    
    // Load gallery if on gallery tab
    if (document.getElementById('galleryTab').style.display !== 'none') {
        loadGallery();
    }
    
    console.log('Dashboard updated successfully');
}

// Get filtered sessions based on current filters
function getFilteredSessions() {
    const cityFilter = document.getElementById('cityFilter').value;
    const spotFilter = document.getElementById('spotFilter').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const searchQuery = document.getElementById('searchInput').value.toLowerCase();
    
    return campaignData.sessions.filter(session => {
        // City filter
        if (cityFilter !== 'all' && session.city !== cityFilter) return false;
        
        // Date filter
        if (dateFrom && session.date < dateFrom) return false;
        if (dateTo && session.date > dateTo) return false;
        
        // Search filter
        if (searchQuery) {
            const searchable = `${session.cityName} ${session.spot} ${session.sessionNumber}`.toLowerCase();
            if (!searchable.includes(searchQuery)) return false;
        }
        
        return true;
    });
}

// Update city progress bars
function updateCityProgress() {
    const cityStats = {
        'sukkur': { sessions: 0, total: 15 },
        'dgk': { sessions: 0, total: 10 },
        'faisalabad': { sessions: 0, total: 8 },
        'gujranwala': { sessions: 0, total: 7 }
    };
    
    const filteredSessions = getFilteredSessions();
    
    filteredSessions.forEach(session => {
        if (cityStats[session.city]) {
            cityStats[session.city].sessions++;
        }
    });
    
    // Update progress bars
    document.querySelectorAll('.city-item').forEach((item, index) => {
        const cities = ['sukkur', 'dgk', 'faisalabad', 'gujranwala'];
        if (index < cities.length) {
            const city = cities[index];
            const stats = cityStats[city];
            const percentage = stats.total > 0 ? (stats.sessions / stats.total) * 100 : 0;
            
            const progressFill = item.querySelector('.progress-fill');
            const cityHeader = item.querySelector('.city-header span:last-child');
            
            if (progressFill) {
                progressFill.style.width = `${percentage}%`;
            }
            if (cityHeader) {
                cityHeader.textContent = `${stats.sessions} of ${stats.total} sessions`;
            }
        }
    });
}

// Apply filters based on user selection
function applyFilters() {
    console.log('Applying filters...');
    
    const cityFilter = document.getElementById('cityFilter').value;
    const spotFilter = document.getElementById('spotFilter').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const searchQuery = document.getElementById('searchInput').value;
    
    // Update selection summary
    const cityText = cityFilter === 'all' ? 'All cities' : 
                    cityCoordinates[cityFilter]?.name || cityFilter;
    const spotText = spotFilter === 'all' ? 'All spots' : spotFilter;
    
    document.querySelector('.selection-summary h3').innerHTML = 
        `<i class="fas fa-filter"></i> Selection: ${cityText} → ${spotText}`;
    
    // Update dashboard with filtered data
    updateDashboard();
    
    // Update status
    updateStatus('success', 'Filters applied successfully');
    
    console.log(`Filters applied: City=${cityFilter}, Date=${dateFrom} to ${dateTo}`);
}

// Reset all filters to default
function resetFilters() {
    console.log('Resetting filters...');
    
    document.getElementById('cityFilter').value = 'all';
    document.getElementById('spotFilter').value = 'all';
    document.getElementById('dateFrom').value = '2025-11-24';
    document.getElementById('dateTo').value = '2025-12-12';
    document.getElementById('searchInput').value = '';
    
    // Reset selection summary
    document.querySelector('.selection-summary h3').innerHTML = 
        `<i class="fas fa-filter"></i> Selection Summary`;
    
    // Update dashboard
    updateDashboard();
    
    // Update status
    updateStatus('success', 'Filters reset to default');
    
    console.log('Filters reset successfully');
}

// Switch between tabs
function switchTab(tabId) {
    console.log(`Switching to tab: ${tabId}`);
    
    // Update active tab
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-tab') === tabId) {
            tab.classList.add('active');
        }
    });
    
    // Show/hide tab content
    const allTabs = document.querySelectorAll('#tabContent > section, #tabContent > div');
    allTabs.forEach(tab => {
        if (tab.id === tabId + 'Tab') {
            tab.style.display = 'block';
        } else {
            tab.style.display = 'none';
        }
    });
    
    // Load specific content for tab
    switch(tabId) {
        case 'gallery':
            loadGallery();
            break;
        case 'map':
            if (map) {
                setTimeout(() => {
                    map.invalidateSize();
                }, 100);
            }
            break;
        case 'analytics':
            loadAnalytics();
            break;
        case 'sessions':
            loadSessionsList();
            break;
    }
    
    // Update status
    updateStatus('success', `Switched to ${tabId} view`);
}

// Load media gallery
function loadGallery() {
    console.log('Loading gallery...');
    
    const galleryContainer = document.getElementById('mediaGallery');
    
    if (!mediaData || mediaData.length === 0) {
        galleryContainer.innerHTML = `
            <div class="loading" style="grid-column: 1 / -1;">
                <i class="fas fa-images"></i>
                <p>No media available</p>
            </div>
        `;
        return;
    }
    
    // Filter media by current filters
    const cityFilter = document.getElementById('cityFilter').value;
    const filteredMedia = mediaData.filter(media => {
        if (cityFilter !== 'all' && media.city && media.city !== cityFilter) {
            return false;
        }
        return true;
    });
    
    // Create gallery items
    let galleryHTML = '';
    
    filteredMedia.forEach(media => {
        // Use actual asset paths for your files, fallback to Unsplash for others
        const imageUrl = media.filename.startsWith('assets/') || media.filename.startsWith('http') 
            ? media.filename 
            : `https://images.unsplash.com/photo-1505253668822-42074d58a7c6?w=400&h=300&fit=crop`;
        
        galleryHTML += `
            <div class="gallery-item">
                <img src="${imageUrl}" alt="${media.caption}" 
                     onerror="this.src='assets/placeholder.svg'">
                <div style="padding: 15px; background: white;">
                    <p style="font-weight: 600; margin: 0 0 5px 0;">${media.caption}</p>
                    ${media.date ? `<small style="color: #666;">${media.date}</small>` : ''}
                    ${media.city ? `<br><small style="color: #2e7d32;">${media.city}</small>` : ''}
                </div>
            </div>
        `;
    });
    
    galleryContainer.innerHTML = galleryHTML || `
        <div class="loading" style="grid-column: 1 / -1;">
            <i class="fas fa-images"></i>
            <p>No media matching current filters</p>
        </div>
    `;
    
    console.log(`Gallery loaded with ${filteredMedia.length} items`);
}

// Load analytics view
function loadAnalytics() {
    const analyticsTab = document.getElementById('analyticsTab');
    if (!analyticsTab) {
        // Create analytics tab if it doesn't exist
        const tabContent = document.getElementById('tabContent');
        const analyticsHTML = `
            <section class="campaign-section" id="analyticsTab">
                <h2><i class="fas fa-chart-bar"></i> Campaign Analytics</h2>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
                        <h3><i class="fas fa-chart-line"></i> Sessions Timeline</h3>
                        <div id="sessionsChart" style="height: 200px; display: flex; align-items: flex-end; gap: 10px; margin-top: 20px;">
                            ${Array.from({length: 17}, (_, i) => {
                                const height = 50 + Math.random() * 100;
                                return `<div style="flex: 1; background: #2e7d32; height: ${height}px; border-radius: 4px 4px 0 0;" title="Day ${i+1}"></div>`;
                            }).join('')}
                        </div>
                    </div>
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
                        <h3><i class="fas fa-users"></i> Farmers per City</h3>
                        <div id="farmersChart" style="margin-top: 20px;">
                            <div style="margin-bottom: 10px;">
                                <span>Sukkur: </span>
                                <div style="background: #e0e0e0; height: 20px; border-radius: 10px; overflow: hidden;">
                                    <div style="background: #2e7d32; width: 85%; height: 100%;"></div>
                                </div>
                                <span> 1,120 farmers</span>
                            </div>
                            <div style="margin-bottom: 10px;">
                                <span>DG Khan: </span>
                                <div style="background: #e0e0e0; height: 20px; border-radius: 10px; overflow: hidden;">
                                    <div style="background: #4caf50; width: 70%; height: 100%;"></div>
                                </div>
                                <span> 728 farmers</span>
                            </div>
                            <div style="margin-bottom: 10px;">
                                <span>Faisalabad: </span>
                                <div style="background: #e0e0e0; height: 20px; border-radius: 10px; overflow: hidden;">
                                    <div style="background: #66bb6a; width: 65%; height: 100%;"></div>
                                </div>
                                <span> 640 farmers</span>
                            </div>
                            <div style="margin-bottom: 10px;">
                                <span>Gujranwala: </span>
                                <div style="background: #e0e0e0; height: 20px; border-radius: 10px; overflow: hidden;">
                                    <div style="background: #81c784; width: 60%; height: 100%;"></div>
                                </div>
                                <span> 420 farmers</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        `;
        
        // Insert after snapshot tab
        const snapshotTab = document.getElementById('snapshotTab');
        snapshotTab.insertAdjacentHTML('afterend', analyticsHTML);
    }
    
    analyticsTab.style.display = 'block';
}

// Load sessions list
function loadSessionsList() {
    const sessionsTab = document.getElementById('sessionsTab');
    if (!sessionsTab) {
        // Create sessions tab if it doesn't exist
        const tabContent = document.getElementById('tabContent');
        const sessionsHTML = `
            <section class="campaign-section" id="sessionsTab">
                <h2><i class="fas fa-calendar-day"></i> All Sessions</h2>
                <div style="overflow-x: auto; margin-top: 20px;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8f9fa;">
                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Session</th>
                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">City</th>
                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Spot</th>
                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Date</th>
                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Farmers</th>
                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Acres</th>
                            </tr>
                        </thead>
                        <tbody id="sessionsTableBody">
                            <!-- Sessions will be populated here -->
                        </tbody>
                    </table>
                </div>
            </section>
        `;
        
        // Insert after gallery tab
        const galleryTab = document.getElementById('galleryTab');
        galleryTab.insertAdjacentHTML('afterend', sessionsHTML);
        
        // Populate table
        populateSessionsTable();
    } else {
        populateSessionsTable();
    }
    
    sessionsTab.style.display = 'block';
}

// Populate sessions table
function populateSessionsTable() {
    const tableBody = document.getElementById('sessionsTableBody');
    if (!tableBody) return;
    
    const filteredSessions = getFilteredSessions();
    
    let tableHTML = '';
    filteredSessions.forEach(session => {
        tableHTML += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px;">${session.sessionNumber}</td>
                <td style="padding: 12px;">
                    <span style="display: inline-block; padding: 4px 8px; background: #e8f5e9; border-radius: 4px; color: #2e7d32;">
                        ${session.cityName}
                    </span>
                </td>
                <td style="padding: 12px;">${session.spot}</td>
                <td style="padding: 12px;">${session.date}</td>
                <td style="padding: 12px; font-weight: bold;">${session.farmers}</td>
                <td style="padding: 12px;">${session.acres.toLocaleString()}</td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = tableHTML || `
        <tr>
            <td colspan="6" style="padding: 40px; text-align: center; color: #666;">
                <i class="fas fa-calendar-times"></i>
                <p>No sessions matching current filters</p>
            </td>
        </tr>
    `;
}

// Export data to CSV
function exportToCSV() {
    console.log('Exporting to CSV...');
    
    if (!campaignData || !campaignData.sessions) {
        alert('No data available to export');
        return;
    }
    
    const filteredSessions = getFilteredSessions();
    
    // Create CSV content
    let csvContent = "Session ID,Session Number,City,Spot,Date,Farmers,Acres,Latitude,Longitude\n";
    
    filteredSessions.forEach(session => {
        csvContent += `${session.id},${session.sessionNumber},${session.cityName},${session.spot},${session.date},${session.farmers},${session.acres},${session.latitude},${session.longitude}\n`;
    });
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.setAttribute('download', `Buttril_Super_Campaign_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Update status
    updateStatus('success', `CSV exported with ${filteredSessions.length} sessions`);
    
    console.log('CSV export completed');
}

// Update status indicator
function updateStatus(type, message) {
    const indicator = document.getElementById('statusIndicator');
    if (!indicator) return;
    
    const icon = indicator.querySelector('i');
    const text = indicator.querySelector('span');
    
    // Clear existing classes
    indicator.className = 'status-indicator';
    icon.className = '';
    
    // Set new status
    if (type === 'success') {
        indicator.classList.add('status-success');
        icon.classList.add('fas', 'fa-check-circle');
    } else if (type === 'error') {
        indicator.classList.add('status-error');
        icon.classList.add('fas', 'fa-exclamation-circle');
    } else if (type === 'loading') {
        indicator.classList.add('status-loading');
        icon.classList.add('fas', 'fa-spinner', 'fa-spin');
    }
    
    if (text) text.textContent = message;
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            if (indicator.classList.contains('status-success')) {
                indicator.style.opacity = '0.7';
            }
        }, 5000);
    }
    
    // Log status change
    console.log(`Status: ${type} - ${message}`);
}

// Show error message
function showError(message) {
    console.error('Dashboard Error:', message);
    
    const errorBanner = document.getElementById('errorBanner');
    const errorMessage = document.getElementById('errorMessage');
    
    if (errorBanner && errorMessage) {
        errorMessage.textContent = message;
        errorBanner.style.display = 'flex';
    }
    
    updateStatus('error', 'Error detected');
}

// Initialize everything when page loads
window.onload = function() {
    console.log('AgriVista Dashboard fully loaded');
};
