// data_processor.js - Main JavaScript for AgriVista Dashboard
// Complete implementation with data processing and visualization

console.log('AgriVista Dashboard Data Processor loading...');

// Global variables
let campaignData = null;
let mediaData = null;
let map = null;
let markers = [];
let currentFilteredSessions = [];
let allSessions = [];

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing AgriVista Dashboard...');
    
    // Load data first
    Promise.all([
        fetch('sessions.json').then(response => response.json()),
        fetch('media.json').then(response => response.json())
    ])
    .then(([sessionsData, mediaDataResponse]) => {
        campaignData = sessionsData;
        mediaData = mediaDataResponse;
        allSessions = campaignData.sessions;
        currentFilteredSessions = [...allSessions];
        
        // Initialize dashboard
        initializeDashboard();
        initializeMap();
        initializeGallery();
        updateAllStats();
        setupEventListeners();
        
        // Update status indicator
        document.getElementById('statusIndicator').className = 'status-indicator status-success';
        document.getElementById('statusIndicator').innerHTML = '<i class="fas fa-check-circle"></i><span>Data Loaded Successfully</span>';
        
        console.log('Dashboard initialized with', allSessions.length, 'sessions across', campaignData.cities.length, 'cities');
    })
    .catch(error => {
        console.error('Error loading data:', error);
        document.getElementById('errorBanner').style.display = 'flex';
        document.getElementById('errorMessage').textContent = 'Failed to load data files: ' + error.message;
        document.getElementById('statusIndicator').className = 'status-indicator status-error';
        document.getElementById('statusIndicator').innerHTML = '<i class="fas fa-exclamation-circle"></i><span>Data Load Failed</span>';
    });
});

// Initialize dashboard components
function initializeDashboard() {
    console.log('Initializing dashboard components...');
    
    // Set date range max to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dateTo').max = today;
    
    // Populate city filter dropdown with actual cities
    const cityFilter = document.getElementById('cityFilter');
    cityFilter.innerHTML = '<option value="all">All Cities</option>';
    
    campaignData.cities.forEach(city => {
        const option = document.createElement('option');
        option.value = city.code.toLowerCase();
        option.textContent = `${city.name} (${city.code})`;
        cityFilter.appendChild(option);
    });
}

// Initialize Leaflet map
function initializeMap() {
    console.log('Initializing map...');
    
    // Create map centered on Pakistan
    map = L.map('campaignMap').setView([30.3753, 69.3451], 6);
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 12,
        minZoom: 5
    }).addTo(map);
    
    // Add markers for each city
    campaignData.cities.forEach(city => {
        const citySessions = allSessions.filter(s => s.cityName === city.name);
        const totalFarmers = citySessions.reduce((sum, session) => sum + session.farmers, 0);
        const totalAcres = citySessions.reduce((sum, session) => sum + session.acres, 0);
        
        // Create custom icon
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="
                background: linear-gradient(135deg, #2e7d32, #1b5e20);
                color: white;
                padding: 8px 12px;
                border-radius: 20px;
                font-weight: bold;
                border: 3px solid white;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                min-width: 60px;
                text-align: center;
            ">
                <div style="font-size: 14px;">${city.code}</div>
                <div style="font-size: 10px; opacity: 0.9;">${city.sessions} sessions</div>
            </div>`,
            iconSize: [60, 40],
            iconAnchor: [30, 20]
        });
        
        // Create marker
        const marker = L.marker([city.latitude, city.longitude], { icon: icon })
            .addTo(map)
            .bindPopup(`
                <div style="min-width: 200px;">
                    <h3 style="margin: 0 0 5px 0; color: #2e7d32;">${city.name}</h3>
                    <p style="margin: 5px 0;"><strong>Sessions:</strong> ${city.sessions}</p>
                    <p style="margin: 5px 0;"><strong>Farmers Reached:</strong> ${city.farmers.toLocaleString()}</p>
                    <p style="margin: 5px 0;"><strong>Acres Covered:</strong> ${city.acres.toLocaleString()}</p>
                    <p style="margin: 5px 0;"><strong>Avg per Session:</strong> ${Math.round(city.farmers/city.sessions)} farmers</p>
                </div>
            `);
        
        markers.push(marker);
    });
    
    // Add session markers
    addSessionMarkers(allSessions);
    
    // Update map banner
    updateMapBanner();
}

// Add session markers to map
function addSessionMarkers(sessions) {
    // Clear existing markers except city markers
    markers.forEach(marker => {
        if (!marker._icon || !marker._icon.className.includes('custom-marker')) {
            map.removeLayer(marker);
        }
    });
    
    // Filter markers array to keep only city markers
    markers = markers.filter(marker => marker._icon && marker._icon.className.includes('custom-marker'));
    
    // Add session markers
    sessions.forEach(session => {
        const icon = L.divIcon({
            className: 'session-marker',
            html: `<div style="
                background: #ff9800;
                color: white;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: bold;
                border: 2px solid white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                cursor: pointer;
            ">
                <i class="fas fa-users"></i>
            </div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
        
        const marker = L.marker([session.latitude, session.longitude], { icon: icon })
            .addTo(map)
            .bindPopup(`
                <div style="min-width: 200px;">
                    <h4 style="margin: 0 0 5px 0; color: #2e7d32;">${session.sessionNumber}</h4>
                    <p style="margin: 3px 0;"><strong>Location:</strong> ${session.spot}, ${session.cityName}</p>
                    <p style="margin: 3px 0;"><strong>Date:</strong> ${session.date} (${session.day})</p>
                    <p style="margin: 3px 0;"><strong>Farmers:</strong> ${session.farmers}</p>
                    <p style="margin: 3px 0;"><strong>Acres:</strong> ${session.acres.toLocaleString()}</p>
                    <p style="margin: 3px 0;"><strong>Facilitator:</strong> ${session.facilitator}</p>
                    <p style="margin: 3px 0;"><strong>Focus:</strong> ${session.focus}</p>
                </div>
            `);
        
        markers.push(marker);
    });
}

// Update map banner statistics
function updateMapBanner() {
    const totalSessions = currentFilteredSessions.length;
    const uniqueCities = [...new Set(currentFilteredSessions.map(s => s.cityName))];
    const totalFarmers = currentFilteredSessions.reduce((sum, session) => sum + session.farmers, 0);
    
    document.getElementById('mapStats').textContent = 
        `${totalSessions} Sessions • ${uniqueCities.length} Cities • ${totalFarmers.toLocaleString()} Farmers`;
}

// Initialize gallery
function initializeGallery() {
    const galleryContainer = document.getElementById('mediaGallery');
    
    if (!galleryContainer) return;
    
    // Clear loading message
    galleryContainer.innerHTML = '';
    
    // Filter gallery images only (displayIn: "gallery")
    const galleryImages = mediaData.mediaItems.filter(item => item.displayIn === "gallery");
    
    // Create gallery items
    galleryImages.forEach(media => {
        const galleryItem = document.createElement('div');
        galleryItem.className = 'gallery-item';
        
        // Determine image source - using placeholders since actual images might not exist
        const imgSrc = `https://via.placeholder.com/300x200/2e7d32/ffffff?text=${encodeURIComponent(media.caption.substring(0, 30))}`;
        
        galleryItem.innerHTML = `
            <img src="${imgSrc}" alt="${media.caption}" loading="lazy">
            <div style="padding: 15px;">
                <div style="font-weight: bold; margin-bottom: 5px; color: #2e7d32;">${media.city.toUpperCase()}</div>
                <div style="font-size: 14px; color: #666;">${media.caption}</div>
                <div style="font-size: 12px; color: #999; margin-top: 8px;">
                    <i class="fas fa-calendar"></i> ${media.date} • 
                    <i class="fas fa-map-marker-alt"></i> Session ${media.sessionId}
                </div>
            </div>
        `;
        
        galleryContainer.appendChild(galleryItem);
    });
    
    // Add gallery filters
    const gallerySection = document.getElementById('galleryTab');
    if (gallerySection && !document.querySelector('.gallery-filters')) {
        const filtersHtml = `
            <div class="gallery-filters">
                <button class="gallery-filter-btn active" data-filter="all">All Media</button>
                <button class="gallery-filter-btn" data-filter="sukkur">Sukkur</button>
                <button class="gallery-filter-btn" data-filter="dgk">Dera Ghazi Khan</button>
                <button class="gallery-filter-btn" data-filter="faisalabad">Faisalabad</button>
                <button class="gallery-filter-btn" data-filter="gujranwala">Gujranwala</button>
                <button class="gallery-filter-btn" data-filter="demonstration">Demonstrations</button>
                <button class="gallery-filter-btn" data-filter="training">Training</button>
            </div>
        `;
        
        gallerySection.querySelector('p').insertAdjacentHTML('afterend', filtersHtml);
        
        // Add filter event listeners
        document.querySelectorAll('.gallery-filter-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.gallery-filter-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                const filter = this.getAttribute('data-filter');
                filterGallery(filter);
            });
        });
    }
}

// Filter gallery items
function filterGallery(filter) {
    const galleryItems = document.querySelectorAll('.gallery-item');
    
    galleryItems.forEach(item => {
        const city = item.querySelector('div').textContent.toLowerCase();
        const caption = item.querySelector('div:nth-child(2)').textContent.toLowerCase();
        
        let showItem = false;
        
        if (filter === 'all') {
            showItem = true;
        } else if (['sukkur', 'dgk', 'faisalabad', 'gujranwala'].includes(filter)) {
            showItem = city.includes(filter);
        } else {
            showItem = caption.includes(filter);
        }
        
        item.style.display = showItem ? 'block' : 'none';
    });
}

// Update all statistics
function updateAllStats() {
    console.log('Updating statistics...');
    
    const totalSessions = currentFilteredSessions.length;
    const totalFarmers = currentFilteredSessions.reduce((sum, session) => sum + session.farmers, 0);
    const totalAcres = currentFilteredSessions.reduce((sum, session) => sum + session.acres, 0);
    const uniqueCities = [...new Set(currentFilteredSessions.map(s => s.cityName))];
    
    // Update summary stats
    document.getElementById('sessionCount').textContent = totalSessions;
    document.getElementById('farmerCount').textContent = totalFarmers.toLocaleString();
    document.getElementById('acreCount').textContent = totalAcres.toLocaleString();
    
    // Update overview stats
    document.getElementById('totalSessions').textContent = totalSessions;
    document.getElementById('totalFarmers').textContent = totalFarmers.toLocaleString();
    document.getElementById('totalAcres').textContent = totalAcres.toLocaleString();
    
    // Update campaign metrics
    if (campaignData.metrics) {
        document.querySelectorAll('.metric-value')[0].textContent = `${campaignData.metrics.definiteIntent}%`;
        document.querySelectorAll('.metric-value')[1].textContent = `${campaignData.metrics.awareness}%`;
        document.querySelectorAll('.metric-value')[2].textContent = `${campaignData.metrics.clarity}%`;
    }
    
    // Update city progress bars
    updateCityProgress();
    
    // Update map
    updateMapBanner();
    
    // Update selection summary
    document.getElementById('statusIndicator').innerHTML = 
        `<i class="fas fa-filter"></i><span>Showing ${totalSessions} sessions from ${uniqueCities.length} cities</span>`;
}

// Update city progress bars
function updateCityProgress() {
    // Group sessions by city
    const cityStats = {};
    
    currentFilteredSessions.forEach(session => {
        if (!cityStats[session.cityName]) {
            cityStats[session.cityName] = {
                sessions: 0,
                farmers: 0,
                acres: 0
            };
        }
        cityStats[session.cityName].sessions++;
        cityStats[session.cityName].farmers += session.farmers;
        cityStats[session.cityName].acres += session.acres;
    });
    
    // Update progress bars
    document.querySelectorAll('.city-item').forEach(item => {
        const cityName = item.querySelector('.city-header span:first-child').textContent.split('(')[0].trim();
        const stats = cityStats[cityName] || { sessions: 0, farmers: 0, acres: 0 };
        
        // Update farmers count
        const farmerSpan = item.querySelector('.city-header span:last-child');
        if (farmerSpan) {
            farmerSpan.textContent = `${stats.farmers} farmers`;
        }
        
        // Update session badge
        const badge = item.querySelector('.city-badge');
        if (badge) {
            badge.textContent = `${stats.sessions} sessions`;
        }
        
        // Update progress bar width based on percentage of total farmers
        const totalFarmers = currentFilteredSessions.reduce((sum, s) => sum + s.farmers, 0);
        const percentage = totalFarmers > 0 ? Math.round((stats.farmers / totalFarmers) * 100) : 0;
        
        const progressFill = item.querySelector('.progress-fill');
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
    });
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Search button
    document.getElementById('searchBtn').addEventListener('click', applyFilters);
    
    // Export CSV button
    document.getElementById('exportBtn').addEventListener('click', exportToCSV);
    
    // Reset button
    document.getElementById('resetBtn').addEventListener('click', resetFilters);
    
    // Search input (live search)
    document.getElementById('searchInput').addEventListener('input', function(e) {
        if (e.target.value.length > 2 || e.target.value.length === 0) {
            applyFilters();
        }
    });
    
    // City and spot filters
    document.getElementById('cityFilter').addEventListener('change', applyFilters);
    document.getElementById('spotFilter').addEventListener('change', applyFilters);
    
    // Date filters
    document.getElementById('dateFrom').addEventListener('change', applyFilters);
    document.getElementById('dateTo').addEventListener('change', applyFilters);
    
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            // Update active tab
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Show corresponding section
            const tabId = this.getAttribute('data-tab');
            const allSections = document.querySelectorAll('#tabContent > section');
            allSections.forEach(section => {
                section.style.display = section.id === tabId + 'Tab' ? 'block' : 'none';
            });
            
            // Special handling for map tab
            if (tabId === 'map' && map) {
                setTimeout(() => {
                    map.invalidateSize();
                }, 100);
            }
            
            // Special handling for analytics tab
            if (tabId === 'analytics') {
                showAnalyticsTab();
            }
        });
    });
}

// Apply filters
function applyFilters() {
    console.log('Applying filters...');
    
    const cityFilter = document.getElementById('cityFilter').value;
    const spotFilter = document.getElementById('spotFilter').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const searchQuery = document.getElementById('searchInput').value.toLowerCase();
    
    // Filter sessions
    currentFilteredSessions = allSessions.filter(session => {
        // City filter
        if (cityFilter !== 'all' && session.city !== cityFilter) {
            return false;
        }
        
        // Spot filter
        if (spotFilter !== 'all') {
            // Simple spot filtering logic
            const isMajor = session.farmers > 80;
            const isRural = session.farmers < 70;
            
            if (spotFilter === 'major' && !isMajor) return false;
            if (spotFilter === 'rural' && !isRural) return false;
            if (spotFilter === 'secondary' && (isMajor || isRural)) return false;
        }
        
        // Date filter
        const sessionDate = new Date(session.date);
        const fromDate = new Date(dateFrom);
        const toDate = new Date(dateTo);
        
        if (sessionDate < fromDate || sessionDate > toDate) {
            return false;
        }
        
        // Search filter
        if (searchQuery) {
            const searchIn = `${session.cityName} ${session.spot} ${session.facilitator} ${session.focus} ${session.sessionNumber}`.toLowerCase();
            if (!searchIn.includes(searchQuery)) {
                return false;
            }
        }
        
        return true;
    });
    
    // Update stats and map
    updateAllStats();
    addSessionMarkers(currentFilteredSessions);
}

// Reset filters
function resetFilters() {
    console.log('Resetting filters...');
    
    document.getElementById('cityFilter').value = 'all';
    document.getElementById('spotFilter').value = 'all';
    document.getElementById('dateFrom').value = '2025-11-24';
    document.getElementById('dateTo').value = '2025-12-12';
    document.getElementById('searchInput').value = '';
    
    currentFilteredSessions = [...allSessions];
    updateAllStats();
    addSessionMarkers(currentFilteredSessions);
    
    // Show success message
    const statusIndicator = document.getElementById('statusIndicator');
    statusIndicator.className = 'status-indicator status-success';
    statusIndicator.innerHTML = '<i class="fas fa-check-circle"></i><span>Filters Reset</span>';
    
    setTimeout(() => {
        statusIndicator.innerHTML = '<i class="fas fa-filter"></i><span>Showing all sessions</span>';
    }, 2000);
}

// Export to CSV
function exportToCSV() {
    if (currentFilteredSessions.length === 0) {
        alert('No data to export');
        return;
    }
    
    const headers = ['Session ID', 'City', 'Spot', 'Date', 'Day', 'Farmers', 'Acres', 'Facilitator', 'Focus'];
    
    const csvRows = [
        headers.join(','),
        ...currentFilteredSessions.map(session => [
            session.sessionNumber,
            session.cityName,
            `"${session.spot}"`,
            session.date,
            session.day,
            session.farmers,
            session.acres,
            `"${session.facilitator}"`,
            `"${session.focus}"`
        ].join(','))
    ];
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.href = url;
    a.download = `agrivista-sessions-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    // Show export success
    const statusIndicator = document.getElementById('statusIndicator');
    const originalHTML = statusIndicator.innerHTML;
    statusIndicator.className = 'status-indicator status-success';
    statusIndicator.innerHTML = '<i class="fas fa-file-export"></i><span>Export Complete</span>';
    
    setTimeout(() => {
        statusIndicator.innerHTML = originalHTML;
    }, 2000);
}

// Show analytics tab (to be implemented)
function showAnalyticsTab() {
    const analyticsTab = document.getElementById('analyticsTab');
    if (!analyticsTab) {
        // Create analytics tab if it doesn't exist
        const tabContent = document.getElementById('tabContent');
        
        const analyticsHtml = `
            <section class="campaign-section" id="analyticsTab" style="display: block;">
                <h2><i class="fas fa-chart-bar"></i> Campaign Analytics</h2>
                <p>Detailed performance metrics and trends</p>
                
                <div class="chart-container">
                    <h3>Sessions by City</h3>
                    <div id="cityChart" style="height: 300px; width: 100%;"></div>
                </div>
                
                <div class="chart-container">
                    <h3>Farmers Reached Over Time</h3>
                    <div id="timelineChart" style="height: 300px; width: 100%;"></div>
                </div>
                
                <div class="chart-container">
                    <h3>Top Facilitators by Reach</h3>
                    <table class="sessions-table">
                        <thead>
                            <tr>
                                <th>Facilitator</th>
                                <th>Sessions</th>
                                <th>Farmers</th>
                                <th>Avg per Session</th>
                            </tr>
                        </thead>
                        <tbody id="facilitatorTable">
                            <!-- Will be populated dynamically -->
                        </tbody>
                    </table>
                </div>
            </section>
        `;
        
        tabContent.insertAdjacentHTML('beforeend', analyticsHtml);
        
        // Populate analytics data
        updateAnalytics();
    } else {
        analyticsTab.style.display = 'block';
        updateAnalytics();
    }
}

// Update analytics data
function updateAnalytics() {
    // Group by city
    const cityData = {};
    currentFilteredSessions.forEach(session => {
        if (!cityData[session.cityName]) {
            cityData[session.cityName] = { sessions: 0, farmers: 0, acres: 0 };
        }
        cityData[session.cityName].sessions++;
        cityData[session.cityName].farmers += session.farmers;
        cityData[session.cityName].acres += session.acres;
    });
    
    // Group by facilitator
    const facilitatorData = {};
    currentFilteredSessions.forEach(session => {
        if (!facilitatorData[session.facilitator]) {
            facilitatorData[session.facilitator] = { sessions: 0, farmers: 0 };
        }
        facilitatorData[session.facilitator].sessions++;
        facilitatorData[session.facilitator].farmers += session.farmers;
    });
    
    // Sort facilitators by farmers reached
    const topFacilitators = Object.entries(facilitatorData)
        .map(([name, data]) => ({
            name,
            sessions: data.sessions,
            farmers: data.farmers,
            average: Math.round(data.farmers / data.sessions)
        }))
        .sort((a, b) => b.farmers - a.farmers)
        .slice(0, 10);
    
    // Update facilitator table
    const tableBody = document.getElementById('facilitatorTable');
    if (tableBody) {
        tableBody.innerHTML = topFacilitators.map(f => `
            <tr>
                <td>${f.name}</td>
                <td>${f.sessions}</td>
                <td>${f.farmers}</td>
                <td>${f.average}</td>
            </tr>
        `).join('');
    }
    
    // Create simple bar chart for city data (using CSS)
    const cityChart = document.getElementById('cityChart');
    if (cityChart) {
        const cities = Object.keys(cityData);
        const maxSessions = Math.max(...Object.values(cityData).map(d => d.sessions));
        
        cityChart.innerHTML = `
            <div style="display: flex; align-items: flex-end; height: 250px; gap: 20px; padding: 20px;">
                ${cities.map(city => {
                    const height = (cityData[city].sessions / maxSessions) * 200;
                    return `
                        <div style="flex: 1; display: flex; flex-direction: column; align-items: center;">
                            <div style="
                                width: 100%;
                                height: ${height}px;
                                background: linear-gradient(to top, #2e7d32, #4caf50);
                                border-radius: 5px 5px 0 0;
                                position: relative;
                            ">
                                <div style="
                                    position: absolute;
                                    top: -25px;
                                    left: 0;
                                    right: 0;
                                    text-align: center;
                                    font-weight: bold;
                                    color: #2e7d32;
                                ">${cityData[city].sessions}</div>
                            </div>
                            <div style="margin-top: 10px; font-weight: bold; color: #666;">${city}</div>
                            <div style="font-size: 12px; color: #999;">${cityData[city].farmers} farmers</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
}

// Add background video functionality
function addBackgroundVideo() {
    const videoHTML = `
        <video id="backgroundVideo" autoplay muted loop playsinline>
            <source src="assets/bg.mp4" type="video/mp4">
            Your browser does not support the video tag.
        </video>
    `;
    
    document.body.insertAdjacentHTML('afterbegin', videoHTML);
    
    // Try to play video
    const video = document.getElementById('backgroundVideo');
    if (video) {
        video.play().catch(e => {
            console.log('Video autoplay prevented:', e);
            // Fallback to showing poster image
            video.style.display = 'none';
        });
    }
}

// Add header branding
function addHeaderBranding() {
    const header = document.querySelector('.header');
    if (header) {
        const brandingHTML = `
            <div style="position: absolute; top: 20px; right: 20px; display: flex; gap: 15px; align-items: center; z-index: 1;">
                <img src="assets/Bayer.png" alt="Bayer" style="height: 40px;">
                <img src="assets/Buctril.jpg" alt="Buttril Super" style="height: 40px; border-radius: 5px;">
            </div>
        `;
        header.insertAdjacentHTML('beforeend', brandingHTML);
    }
}

// Initialize enhanced features
function initializeEnhancedFeatures() {
    // Add background video
    addBackgroundVideo();
    
    // Add header branding
    addHeaderBranding();
    
    // Add CSS for new features
    const style = document.createElement('style');
    style.textContent = `
        .gallery-filters {
            display: flex;
            gap: 15px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        
        .gallery-filter-btn {
            padding: 8px 16px;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.3s;
            font-size: 14px;
        }
        
        .gallery-filter-btn.active {
            background: #2e7d32;
            color: white;
            border-color: #2e7d32;
        }
        
        .gallery-filter-btn:hover:not(.active) {
            background: #e9ecef;
        }
        
        .gallery-item {
            position: relative;
            overflow: hidden;
        }
        
        .gallery-item img {
            transition: transform 0.5s ease;
            width: 100%;
            height: 200px;
            object-fit: cover;
        }
        
        .gallery-item:hover img {
            transform: scale(1.05);
        }
        
        #backgroundVideo {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            z-index: -1;
            opacity: 0.1;
        }
        
        .session-marker {
            background: none !important;
            border: none !important;
        }
    `;
    document.head.appendChild(style);
}

// Initialize everything when DOM is loaded
window.addEventListener('DOMContentLoaded', function() {
    // Call initializeEnhancedFeatures after a short delay
    setTimeout(initializeEnhancedFeatures, 500);
});

// Global error handling
window.addEventListener('error', function(e) {
    console.error('Dashboard error:', e.message, e.filename, e.lineno);
    
    // Show error banner for specific errors
    if (e.message.includes('updateMapBanner') || e.message.includes('dashboard')) {
        document.getElementById('errorBanner').style.display = 'flex';
        document.getElementById('errorMessage').textContent = e.message;
        
        const statusIndicator = document.getElementById('statusIndicator');
        if (statusIndicator) {
            statusIndicator.className = 'status-indicator status-error';
            statusIndicator.innerHTML = '<i class="fas fa-exclamation-circle"></i><span>Script Error Detected</span>';
        }
    }
});

console.log('AgriVista Data Processor loaded successfully');
