// data_processor.js - Main JavaScript for AgriVista Dashboard
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
    
    try {
        // Load external data files
        Promise.all([
            fetch('sessions.json').then(r => r.json()),
            fetch('media.json').then(r => r.json())
        ])
        .then(([sessionsData, mediaItemsData]) => {
            campaignData = sessionsData;
            mediaData = mediaItemsData;
            allSessions = campaignData.sessions;
            currentFilteredSessions = [...allSessions];
            
            // Initialize all components
            initializeDashboard();
            initializeMap();
            initializeGallery();
            updateAllStats();
            setupEventListeners();
            addHeaderBranding();
            
            // Update status
            document.getElementById('statusIndicator').className = 'status-indicator status-success';
            document.getElementById('statusIndicator').innerHTML = '<i class="fas fa-check-circle"></i><span>Dashboard Loaded Successfully</span>';
            
            console.log('Dashboard initialized with', allSessions.length, 'sessions');
        })
        .catch(error => {
            console.error('Error loading data:', error);
            showError('Failed to load data files. Using fallback data.');
            loadFallbackData();
        });
        
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Initialization failed: ' + error.message);
    }
});

// Fallback data if files fail to load
function loadFallbackData() {
    // Simplified fallback data
    campaignData = {
        sessions: [],
        cities: []
    };
    mediaData = { mediaItems: [] };
    initializeDashboard();
    document.getElementById('statusIndicator').className = 'status-indicator status-error';
    document.getElementById('statusIndicator').innerHTML = '<i class="fas fa-exclamation-circle"></i><span>Using Fallback Data</span>';
}

// Show error message
function showError(message) {
    document.getElementById('errorBanner').style.display = 'flex';
    document.getElementById('errorMessage').textContent = message;
}

// Initialize dashboard components
function initializeDashboard() {
    console.log('Initializing dashboard components...');
    
    // Set date range max to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dateTo').max = today;
    
    // Populate city filter dropdown
    const cityFilter = document.getElementById('cityFilter');
    cityFilter.innerHTML = '<option value="all">All Cities</option>';
    
    if (campaignData.cities && campaignData.cities.length > 0) {
        campaignData.cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city.code ? city.code.toLowerCase() : city.name.toLowerCase();
            option.textContent = city.name + (city.code ? ` (${city.code})` : '');
            cityFilter.appendChild(option);
        });
    }
    
    // Initialize tabs
    initializeTabs();
}

// Initialize tabs
function initializeTabs() {
    const tabs = document.querySelectorAll('.tab');
    if (tabs.length === 0) return;
    
    // Set first tab as active
    tabs[0].classList.add('active');
    
    // Show default tab content
    const defaultTab = tabs[0].getAttribute('data-tab');
    document.getElementById(defaultTab + 'Tab').style.display = 'block';
    
    // Add tab switching
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // Show corresponding section
            const tabId = this.getAttribute('data-tab');
            const allSections = document.querySelectorAll('#tabContent > section');
            allSections.forEach(section => {
                section.style.display = section.id === tabId + 'Tab' ? 'block' : 'none';
            });
            
            // Resize map if needed
            if (tabId === 'map' && map) {
                setTimeout(() => {
                    map.invalidateSize();
                }, 100);
            }
        });
    });
}

// Initialize Leaflet map
function initializeMap() {
    console.log('Initializing map...');
    
    try {
        // Create map centered on Pakistan
        map = L.map('campaignMap').setView([30.3753, 69.3451], 6);
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 12,
            minZoom: 5
        }).addTo(map);
        
        // Add markers if we have city data
        if (campaignData.cities && campaignData.cities.length > 0) {
            campaignData.cities.forEach(city => {
                if (city.latitude && city.longitude) {
                    const icon = L.divIcon({
                        className: 'city-marker',
                        html: `<div style="
                            background: #2e7d32;
                            color: white;
                            padding: 8px 12px;
                            border-radius: 4px;
                            font-weight: bold;
                            border: 2px solid white;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                            font-size: 14px;
                        ">
                            ${city.name}
                        </div>`,
                        iconSize: [100, 40],
                        iconAnchor: [50, 20]
                    });
                    
                    const marker = L.marker([city.latitude, city.longitude], { icon: icon })
                        .addTo(map)
                        .bindPopup(`
                            <div style="min-width: 200px;">
                                <h4 style="margin: 0 0 10px 0; color: #2e7d32;">${city.name}</h4>
                                <p style="margin: 5px 0;"><strong>Sessions:</strong> ${city.sessions || 0}</p>
                                <p style="margin: 5px 0;"><strong>Farmers:</strong> ${(city.farmers || 0).toLocaleString()}</p>
                                <p style="margin: 5px 0;"><strong>Acres:</strong> ${(city.acres || 0).toLocaleString()}</p>
                            </div>
                        `);
                    
                    markers.push(marker);
                }
            });
        }
        
        // Add session markers
        addSessionMarkers(currentFilteredSessions);
        
        // Update map banner
        updateMapBanner();
        
    } catch (error) {
        console.error('Error initializing map:', error);
        document.getElementById('campaignMap').innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100%; background: #f8f9fa; color: #666;">
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-map-marked-alt" style="font-size: 48px; color: #ccc; margin-bottom: 10px;"></i>
                    <p>Map visualization not available</p>
                    <p style="font-size: 12px; color: #999;">${error.message}</p>
                </div>
            </div>
        `;
    }
}

// Add session markers to map
function addSessionMarkers(sessions) {
    if (!map) return;
    
    // Clear existing session markers
    markers.forEach(marker => {
        if (marker.options.icon && marker.options.icon.options.className === 'session-marker') {
            map.removeLayer(marker);
        }
    });
    
    // Filter markers array to keep only city markers
    markers = markers.filter(marker => 
        !marker.options.icon || marker.options.icon.options.className !== 'session-marker'
    );
    
    // Add session markers (limit for performance)
    const sessionsToShow = sessions.slice(0, 40);
    
    sessionsToShow.forEach(session => {
        if (session.latitude && session.longitude) {
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
                    <div style="min-width: 220px;">
                        <h4 style="margin: 0 0 8px 0; color: #2e7d32; font-size: 16px;">${session.sessionNumber || 'Session'}</h4>
                        <p style="margin: 4px 0;"><strong>Location:</strong> ${session.spot || 'Unknown'}</p>
                        <p style="margin: 4px 0;"><strong>Date:</strong> ${session.date || 'Unknown'}</p>
                        <p style="margin: 4px 0;"><strong>Farmers:</strong> ${session.farmers || 0}</p>
                        <p style="margin: 4px 0;"><strong>Facilitator:</strong> ${session.facilitator || 'Unknown'}</p>
                    </div>
                `);
            
            markers.push(marker);
        }
    });
}

// Update map banner statistics
function updateMapBanner() {
    const totalSessions = currentFilteredSessions.length;
    const uniqueCities = [...new Set(currentFilteredSessions.map(s => s.cityName))].length;
    const totalFarmers = currentFilteredSessions.reduce((sum, session) => sum + (session.farmers || 0), 0);
    
    document.getElementById('mapStats').textContent = 
        `${totalSessions} Sessions • ${uniqueCities} Cities • ${totalFarmers.toLocaleString()} Farmers`;
}

// Initialize gallery
function initializeGallery() {
    const galleryContainer = document.getElementById('mediaGallery');
    if (!galleryContainer) return;
    
    // Clear loading message
    galleryContainer.innerHTML = '';
    
    // Filter gallery images only
    const galleryImages = mediaData.mediaItems ? 
        mediaData.mediaItems.filter(item => item.displayIn === "gallery") : [];
    
    if (galleryImages.length === 0) {
        galleryContainer.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #666;">
                <i class="fas fa-images" style="font-size: 48px; margin-bottom: 10px; color: #ccc;"></i>
                <p>No gallery images available</p>
                <p style="font-size: 12px; color: #999;">Add images to media.json</p>
            </div>
        `;
        return;
    }
    
    // Create gallery items
    galleryImages.forEach(media => {
        const galleryItem = document.createElement('div');
        galleryItem.className = 'gallery-item';
        
        // Create image element
        const img = document.createElement('img');
        img.src = media.filename;
        img.alt = media.caption;
        img.loading = 'lazy';
        img.onerror = function() {
            // Fallback if image fails to load
            const cityColors = {
                'sukkur': '#2e7d32',
                'dgk': '#ff9800',
                'faisalabad': '#2196f3',
                'gujranwala': '#9c27b0'
            };
            const color = cityColors[media.city] || '#2e7d32';
            const colorHex = color.replace('#', '');
            this.src = `https://via.placeholder.com/300x180/${colorHex}/ffffff?text=${encodeURIComponent(media.type.toUpperCase())}`;
            this.onerror = null; // Prevent infinite loop
        };
        
        const captionDiv = document.createElement('div');
        captionDiv.style.padding = '12px';
        captionDiv.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 4px; color: #2e7d32; font-size: 12px; text-transform: uppercase;">
                ${media.city || 'Unknown'} • Session ${media.sessionId || ''}
            </div>
            <div style="font-size: 14px; color: #666; margin-bottom: 6px; line-height: 1.4;">${media.caption || ''}</div>
            <div style="font-size: 12px; color: #999; display: flex; justify-content: space-between;">
                <span><i class="fas fa-calendar"></i> ${media.date || ''}</span>
                <span><i class="fas fa-tag"></i> ${media.type || ''}</span>
            </div>
        `;
        
        galleryItem.appendChild(img);
        galleryItem.appendChild(captionDiv);
        galleryContainer.appendChild(galleryItem);
    });
}

// Update all statistics
function updateAllStats() {
    if (!campaignData || !currentFilteredSessions) return;
    
    const totalSessions = currentFilteredSessions.length;
    const totalFarmers = currentFilteredSessions.reduce((sum, session) => sum + (session.farmers || 0), 0);
    const totalAcres = currentFilteredSessions.reduce((sum, session) => sum + (session.acres || 0), 0);
    const uniqueCities = [...new Set(currentFilteredSessions.map(s => s.cityName))].length;
    
    // Update summary stats
    document.getElementById('sessionCount').textContent = totalSessions;
    document.getElementById('farmerCount').textContent = totalFarmers.toLocaleString();
    document.getElementById('acreCount').textContent = totalAcres.toLocaleString();
    
    // Update overview stats
    document.getElementById('totalSessions').textContent = totalSessions;
    document.getElementById('totalFarmers').textContent = totalFarmers.toLocaleString();
    document.getElementById('totalAcres').textContent = totalAcres.toLocaleString();
    
    // Update status indicator
    document.getElementById('statusIndicator').innerHTML = 
        `<i class="fas fa-filter"></i><span>${totalSessions} sessions • ${uniqueCities} cities</span>`;
    
    // Update map banner
    updateMapBanner();
}

// Setup event listeners
function setupEventListeners() {
    // Search button
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) searchBtn.addEventListener('click', applyFilters);
    
    // Export CSV button
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportToCSV);
    
    // Reset button
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);
    
    // Search input (live search)
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            if (e.target.value.length > 2 || e.target.value.length === 0) {
                applyFilters();
            }
        });
    }
    
    // City filter
    const cityFilter = document.getElementById('cityFilter');
    if (cityFilter) cityFilter.addEventListener('change', applyFilters);
    
    // Date filters
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    if (dateFrom) dateFrom.addEventListener('change', applyFilters);
    if (dateTo) dateTo.addEventListener('change', applyFilters);
}

// Apply filters
function applyFilters() {
    const cityFilter = document.getElementById('cityFilter').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const searchQuery = document.getElementById('searchInput').value.toLowerCase();
    
    // Filter sessions
    currentFilteredSessions = allSessions.filter(session => {
        // City filter
        if (cityFilter !== 'all') {
            const cityMatch = session.city ? session.city.toLowerCase() === cityFilter : false;
            if (!cityMatch) return false;
        }
        
        // Date filter
        if (session.date && session.date !== 'Unknown') {
            const sessionDate = new Date(session.date);
            const fromDate = new Date(dateFrom);
            const toDate = new Date(dateTo);
            
            if (isNaN(sessionDate.getTime())) return true; // Skip invalid dates
            
            if (dateFrom && sessionDate < fromDate) return false;
            if (dateTo && sessionDate > toDate) return false;
        }
        
        // Search filter
        if (searchQuery) {
            const searchIn = `${session.cityName || ''} ${session.spot || ''} ${session.facilitator || ''}`.toLowerCase();
            if (!searchIn.includes(searchQuery)) return false;
        }
        
        return true;
    });
    
    updateAllStats();
    addSessionMarkers(currentFilteredSessions);
}

// Reset filters
function resetFilters() {
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
    const originalHTML = statusIndicator.innerHTML;
    statusIndicator.className = 'status-indicator status-success';
    statusIndicator.innerHTML = '<i class="fas fa-check-circle"></i><span>Filters Reset</span>';
    
    setTimeout(() => {
        statusIndicator.innerHTML = originalHTML;
    }, 2000);
}

// Export to CSV
function exportToCSV() {
    if (!currentFilteredSessions || currentFilteredSessions.length === 0) {
        alert('No data to export');
        return;
    }
    
    const headers = ['Session ID', 'City', 'Spot', 'Date', 'Farmers', 'Acres', 'Facilitator'];
    const csvRows = [
        headers.join(','),
        ...currentFilteredSessions.map(session => [
            session.sessionNumber || '',
            session.cityName || '',
            `"${session.spot || ''}"`,
            session.date || '',
            session.farmers || 0,
            session.acres || 0,
            `"${session.facilitator || ''}"`
        ].join(','))
    ];
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.href = url;
    a.download = `agrivista-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Add header branding
function addHeaderBranding() {
    const header = document.querySelector('.header');
    if (header && !document.querySelector('.brand-logos')) {
        const brandingHTML = `
            <div class="brand-logos" style="
                position: absolute;
                top: 20px;
                right: 20px;
                display: flex;
                gap: 15px;
                align-items: center;
                z-index: 1;
            ">
                <img src="assets/Bayer.png" alt="Bayer" style="height: 40px; background: white; padding: 5px; border-radius: 4px;">
                <img src="assets/Buctril.jpg" alt="Buttril Super" style="height: 40px; background: white; padding: 5px; border-radius: 4px;">
            </div>
        `;
        header.insertAdjacentHTML('beforeend', brandingHTML);
    }
}

console.log('AgriVista Dashboard - Ready');
