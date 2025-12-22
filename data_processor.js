// AgriVista Dashboard - Buttril Super Field Activations
// Build: 2025-12-22

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

// Sample campaign data (in real app, this would come from sessions.json)
const sampleCampaignData = {
    totalSessions: 40,
    totalFarmers: 2908,
    totalAcres: 44256,
    sessions: [
        { id: 1, city: 'sukkur', spot: 'Spot 1', date: '2025-11-24', farmers: 85, acres: 1200 },
        { id: 2, city: 'sukkur', spot: 'Spot 2', date: '2025-11-25', farmers: 92, acres: 1350 },
        { id: 3, city: 'dgk', spot: 'Spot 1', date: '2025-11-26', farmers: 78, acres: 1100 },
        { id: 4, city: 'faisalabad', spot: 'Spot 1', date: '2025-11-27', farmers: 105, acres: 1600 },
        { id: 5, city: 'gujranwala', spot: 'Spot 1', date: '5', farmers: 88, acres: 1250 },
    ],
    metrics: {
        definiteIntent: 90,
        awareness: 84,
        clarity: 60
    }
};

// Sample media data (in real app, this would come from media.json)
const sampleMediaData = [
    { id: 1, url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&h=300&fit=crop', caption: 'Farmer Education Session' },
    { id: 2, url: 'https://images.unsplash.com/photo-1560493676-04071c5f467b?w-400&h=300&fit=crop', caption: 'Field Demonstration' },
    { id: 3, url: 'https://images.unsplash.com/photo-1505253668822-42074d58a7c6?w=400&h=300&fit=crop', caption: 'Product Distribution' },
    { id: 4, url: 'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=400&h=300&fit=crop', caption: 'Group Discussion' },
    { id: 5, url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&h=300&fit=crop', caption: 'Crop Inspection' },
    { id: 6, url: 'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=400&h=300&fit=crop', caption: 'Training Workshop' }
];

// Main initialization function
document.addEventListener('DOMContentLoaded', function() {
    console.log('AgriVista Dashboard initializing...');
    
    try {
        // Initialize dashboard
        initDashboard();
        
        // Set up event listeners
        setupEventListeners();
        
        // Load data
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
    
    // Set default date range (past 30 days)
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 30);
    document.getElementById('dateFrom').value = dateFrom.toISOString().split('T')[0];
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

// Load data from JSON files or use sample data
function loadData() {
    console.log('Loading campaign data...');
    
    // In a real application, you would fetch from actual JSON files:
    // fetch('sessions.json').then(...)
    // fetch('media.json').then(...)
    
    // For now, use sample data
    campaignData = sampleCampaignData;
    mediaData = sampleMediaData;
    
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
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        
        // Add city markers
        addCityMarkers();
        
        console.log('Map initialized successfully');
    } catch (error) {
        console.error('Error initializing map:', error);
        showError(`Map failed to load: ${error.message}`);
        
        // Show placeholder if map fails
        document.getElementById('campaignMap').innerHTML = `
            <div style="padding: 40px; text-align: center; color: #666;">
                <i class="fas fa-map-marked-alt" style="font-size: 48px; margin-bottom: 20px;"></i>
                <h3>Map Unavailable</h3>
                <p>Failed to load map. Please check your internet connection.</p>
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
    
    // Add marker for each city
    Object.keys(cityCoordinates).forEach(cityKey => {
        const city = cityCoordinates[cityKey];
        
        // Calculate sessions for this city
        const citySessions = campaignData.sessions.filter(s => s.city === cityKey);
        const sessionCount = citySessions.length;
        const farmerCount = citySessions.reduce((sum, session) => sum + session.farmers, 0);
        
        // Create popup content
        const popupContent = `
            <div style="padding: 10px;">
                <h4 style="margin: 0 0 10px 0;">${city.name}</h4>
                <p><strong>Sessions:</strong> ${sessionCount}</p>
                <p><strong>Farmers Reached:</strong> ${farmerCount}</p>
                <p><strong>Coordinates:</strong> ${city.lat.toFixed(4)}, ${city.lng.toFixed(4)}</p>
            </div>
        `;
        
        // Create and add marker
        const marker = L.marker([city.lat, city.lng])
            .addTo(map)
            .bindPopup(popupContent);
        
        markers.push(marker);
    });
    
    // Fit map to show all markers
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

// UPDATE MAP BANNER FUNCTION (This was missing!)
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
        banner.textContent = `${sessionCount} Sessions • ${cityCount} Cities • ${farmerCount.toLocaleString()} Farmers`;
        
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
    
    // Update summary stats
    document.getElementById('sessionCount').textContent = campaignData.totalSessions.toLocaleString();
    document.getElementById('farmerCount').textContent = campaignData.totalFarmers.toLocaleString();
    document.getElementById('acreCount').textContent = campaignData.totalAcres.toLocaleString();
    
    // Update overview cards
    document.getElementById('totalSessions').textContent = campaignData.totalSessions;
    document.getElementById('totalFarmers').textContent = campaignData.totalFarmers.toLocaleString();
    document.getElementById('totalAcres').textContent = campaignData.totalAcres.toLocaleString();
    
    // Update metrics
    document.querySelectorAll('.metric-card .metric-value')[0].textContent = `${campaignData.metrics.definiteIntent}%`;
    document.querySelectorAll('.metric-card .metric-value')[1].textContent = `${campaignData.metrics.awareness}%`;
    document.querySelectorAll('.metric-card .metric-value')[2].textContent = `${campaignData.metrics.clarity}%`;
    
    // Update map banner
    updateMapBanner();
    
    // Load gallery if on gallery tab
    if (document.getElementById('galleryTab').style.display !== 'none') {
        loadGallery();
    }
    
    console.log('Dashboard updated successfully');
}

// Apply filters based on user selection
function applyFilters() {
    console.log('Applying filters...');
    
    const cityFilter = document.getElementById('cityFilter').value;
    const spotFilter = document.getElementById('spotFilter').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const searchQuery = document.getElementById('searchInput').value.toLowerCase();
    
    // Update selection summary
    const summaryText = `${cityFilter === 'all' ? 'All cities' : cityFilter} → ${spotFilter === 'all' ? 'All spots' : spotFilter}`;
    document.querySelector('.selection-summary h3').innerHTML = `<i class="fas fa-filter"></i> Selection: ${summaryText}`;
    
    // Update status
    updateStatus('success', 'Filters applied successfully');
    
    console.log(`Filters applied: City=${cityFilter}, Spot=${spotFilter}, Date=${dateFrom} to ${dateTo}`);
}

// Reset all filters to default
function resetFilters() {
    console.log('Resetting filters...');
    
    document.getElementById('cityFilter').value = 'all';
    document.getElementById('spotFilter').value = 'all';
    
    // Reset to default date range
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 30);
    document.getElementById('dateFrom').value = dateFrom.toISOString().split('T')[0];
    document.getElementById('dateTo').value = new Date().toISOString().split('T')[0];
    
    document.getElementById('searchInput').value = '';
    
    // Reset selection summary
    document.querySelector('.selection-summary h3').innerHTML = `<i class="fas fa-filter"></i> Selection Summary`;
    
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
    const tabContents = ['snapshotTab', 'analyticsTab', 'mapTab', 'galleryTab', 'sessionsTab'];
    tabContents.forEach(contentId => {
        const element = document.getElementById(contentId);
        if (element) {
            element.style.display = contentId === tabId + 'Tab' ? 'block' : 'none';
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
                }, 300);
            }
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
            <div class="loading">
                <i class="fas fa-images"></i>
                <p>No media available</p>
            </div>
        `;
        return;
    }
    
    // Create gallery items
    let galleryHTML = '';
    
    mediaData.forEach(media => {
        galleryHTML += `
            <div class="gallery-item">
                <img src="${media.url}" alt="${media.caption}" 
                     onerror="this.src='https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&h=300&fit=crop'">
                <div style="padding: 15px; background: white;">
                    <p style="font-weight: 600; margin: 0;">${media.caption}</p>
                </div>
            </div>
        `;
    });
    
    galleryContainer.innerHTML = galleryHTML;
    console.log(`Gallery loaded with ${mediaData.length} items`);
}

// Export data to CSV
function exportToCSV() {
    console.log('Exporting to CSV...');
    
    if (!campaignData || !campaignData.sessions) {
        alert('No data available to export');
        return;
    }
    
    // Create CSV content
    let csvContent = "Session ID,City,Spot,Date,Farmers,Acres\n";
    
    campaignData.sessions.forEach(session => {
        csvContent += `${session.id},${session.city},${session.spot},${session.date},${session.farmers},${session.acres}\n`;
    });
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.setAttribute('download', `agrivista_export_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Update status
    updateStatus('success', 'CSV exported successfully');
    
    console.log('CSV export completed');
}

// Update status indicator
function updateStatus(type, message) {
    const indicator = document.getElementById('statusIndicator');
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
    
    text.textContent = message;
    
    // Log status change
    console.log(`Status: ${type} - ${message}`);
}

// Show error message
function showError(message) {
    console.error('Dashboard Error:', message);
    
    const errorBanner = document.getElementById('errorBanner');
    const errorMessage = document.getElementById('errorMessage');
    
    errorMessage.textContent = message;
    errorBanner.style.display = 'flex';
    
    updateStatus('error', 'Error detected');
}

// Handle media upload errors (for future implementation)
function handleMediaUploadError(error) {
    console.error('Media upload error:', error);
    showError(`Media failed to load: ${error.message}`);
}

// Initialize everything when page loads
window.onload = function() {
    console.log('AgriVista Dashboard loaded');
    // Everything is already initialized by DOMContentLoaded
};
