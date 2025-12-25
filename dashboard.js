// dashboard.js - COMPLETE FIXED VERSION v5.0 - With Proper Coordinates & Media Handling
console.log('AgriVista Dashboard v5.0 - Fixed Coordinates & Media initializing...');

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
    districtCount: document.getElementById('districtCount'),
    totalSessions: document.getElementById('totalSessions'),
    shownSessions: document.getElementById('shownSessions'),
    totalSessionsCount: document.getElementById('totalSessionsCount'),
    totalFarmersCount: document.getElementById('totalFarmersCount'),
    totalAcresCount: document.getElementById('totalAcresCount'),
    currentPage: document.getElementById('currentPage'),
    totalPages: document.getElementById('totalPages'),
    statusIndicator: document.getElementById('statusIndicator'),
    mapStats: document.getElementById('mapStats'),
    mediaGallery: document.getElementById('mediaGallery'),
    sessionsTableBody: document.getElementById('sessionsTableBody'),
    errorBanner: document.getElementById('errorBanner'),
    errorMessage: document.getElementById('errorMessage'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText')
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM loaded. Starting initialization with fixed coordinates...');
    
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
    
    // Load real data
    loadAllData();
});

// ===== DATA LOADING =====
async function loadAllData() {
    try {
        updateProgress(0, 'Starting data load...');
        updateStatus('Loading campaign data and media...', 'loading');
        
        // Load sessions data from CSV directly
        await loadSessionsFromCSV();
        updateProgress(40, 'CSV data loaded...');
        
        // Load media data WITHOUT validation
        await loadMediaDataSimple();
        updateProgress(70, 'Media data loaded...');
        
        currentFilteredSessions = [...allSessions];
        
        // Initialize components
        updateDashboardStats();
        updateProgress(80, 'Dashboard stats updated...');
        
        // Initialize map
        await initializeMap();
        updateProgress(85, 'Map initialized...');
        
        // Initialize gallery
        renderGallerySimple();
        updateProgress(90, 'Gallery loaded...');
        
        renderSessionsTable();
        updateProgress(95, 'Sessions table ready...');
        
        initializeAnalyticsCharts();
        updateProgress(98, 'Analytics complete...');
        
        // Update media counts in UI
        updateMediaCounts();
        updateProgress(99, 'Media counts updated...');
        
        // Hide loading overlay with fade
        setTimeout(() => {
            if (elements.loadingOverlay) {
                elements.loadingOverlay.style.opacity = '0';
                setTimeout(() => {
                    elements.loadingOverlay.style.display = 'none';
                }, 300);
            }
        }, 500);
        
        updateProgress(100, 'Dashboard ready!');
        updateStatus('Dashboard loaded successfully with proper coordinates', 'success');
        
        console.log(`Loaded ${allSessions.length} sessions and ${mediaItems.length} media items`);
        
        // Initialize lazy loading
        setTimeout(initializeLazyLoading, 1000);
        
    } catch (error) {
        console.error('Fatal error loading data:', error);
        showError(`Data loading error: ${error.message}. Using embedded data as fallback.`);
        
        // Load fallback embedded data
        await loadEmbeddedSessionsData();
        mediaItems = createSimpleMedia();
        
        // Initialize with fallback data
        updateDashboardStats();
        renderSessionsTable();
        await initializeMap();
        renderGallerySimple();
        initializeAnalyticsCharts();
        updateMediaCounts();
        
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = 'none';
        }
    }
}

// ===== FIXED CSV PARSING WITH PROPER COORDINATES =====
async function loadSessionsFromCSV() {
    try {
        console.log('Loading sessions data from CSV...');
        
        const response = await fetch('sum_sheet.csv');
        if (!response.ok) {
            throw new Error('sum_sheet.csv not found');
        }
        
        const csvText = await response.text();
        allSessions = parseCSVData(csvText);
        console.log(`Parsed ${allSessions.length} sessions from CSV`);
        
        // If no sessions found, use JSON fallback
        if (allSessions.length === 0) {
            await loadSessionsFromJSON();
        }
        
    } catch (error) {
        console.error('Error loading from CSV:', error);
        console.log('Falling back to JSON data...');
        await loadSessionsFromJSON();
    }
}

// FIXED: Proper coordinate parsing function
function parseCSVData(csvText) {
    const sessions = [];
    const lines = csvText.split('\n');
    
    for (let i = 2; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('Summary') || line.includes('Total:->')) {
            continue;
        }
        
        const columns = line.split(';');
        if (columns.length < 15) continue;
        
        // FIX 1: Clean the coordinate string
        let coordString = (columns[14] || '').replace(/^"|"$/g, '').replace(/""/g, '"');
        
        let latitude = null;
        let longitude = null;
        
        if (coordString.includes('°')) {
            // FIX 2: Robust Regex for DMS coordinates
            const dmsRegex = /(-?\d+(?:\.\d+)?)°\s*(-?\d+(?:\.\d+)?)'\s*(-?\d+(?:\.\d+)?)?"?\s*([NSEW])/g;
            const matches = [...coordString.matchAll(dmsRegex)];
            
            if (matches.length >= 2) {
                const parseDMS = (m) => {
                    const d = parseFloat(m[1]);
                    const min = parseFloat(m[2]);
                    const s = parseFloat(m[3]) || 0;
                    const dir = m[4];
                    let res = d + (min / 60) + (s / 3600);
                    return (dir === 'S' || dir === 'W') ? -res : res;
                };
                latitude = parseDMS(matches[0]);
                longitude = parseDMS(matches[1]);
            }
        }
        
        // FIX 3: Remove commas from numbers before parsing (e.g., "1,002" -> 1002)
        const cleanInt = (val) => parseInt((val || '0').replace(/,/g, '')) || 0;
        const cleanFloat = (val) => parseFloat((val || '0').replace(/,/g, '').replace('%', '')) || 0;
        
        const farmers = cleanInt(columns[16]);
        const acres = cleanInt(columns[18]);
        const definiteUseRate = cleanFloat(columns[40]);
        
        // FIX 4: Use district coordinates as fallback if coordinates are invalid
        if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
            const districtName = columns[15] || columns[1] || 'Unknown';
            const districtCoords = getDistrictCoordinates(districtName);
            latitude = districtCoords.lat;
            longitude = districtCoords.lng;
            console.log(`Using district coordinates for ${districtName}: ${latitude}, ${longitude}`);
        }
        
        const session = {
            id: sessions.length + 1,
            sessionId: columns[3] || `S${sessions.length + 1}`,
            sessionNumber: columns[3] || `Session ${sessions.length + 1}`,
            city: columns[1] || columns[15] || 'Unknown',
            district: columns[15] || columns[1] || 'Unknown',
            location: columns[2] || 'Unknown',
            spot: columns[2] || 'Unknown',
            date: columns[4] || '2025-01-01',
            day: columns[5] || 'Unknown',
            farmers: farmers,
            wheatFarmers: cleanInt(columns[17]) || farmers,
            acres: acres,
            latitude: latitude,
            longitude: longitude,
            coordinates: coordString,
            facilitator: columns[6] || 'Unknown',
            facilitatorContact: columns[7] || '',
            host: columns[8] || '',
            hostContact: columns[9] || '',
            dealer: columns[10] || '',
            dealerName: columns[11] || '',
            dealerContact: columns[12] || '',
            village: columns[13] || '',
            tehsil: columns[15] || columns[1] || 'Unknown',
            sessionType: 'education',
            awarenessRate: cleanFloat(columns[40]) || 0,
            usedLastYearRate: cleanFloat(columns[41]) || 0,
            definiteUseRate: definiteUseRate,
            maybeRate: cleanFloat(columns[42]) || 0,
            notInterestedRate: cleanFloat(columns[43]) || 0,
            estimatedBuctrilAcres: cleanInt(columns[24]) || acres,
            understandingScore: cleanFloat(columns[50]) || 2.5,
            topReasonUse: columns[51] || 'Have Trust in Bayer',
            topReasonNotUse: columns[52] || '',
            focus: 'Product Education',
            performance: {
                knowBuctril: cleanInt(columns[19]) || 0,
                usedLastYear: cleanInt(columns[20]) || 0,
                willDefinitelyUse: cleanInt(columns[21]) || 0,
                maybe: cleanInt(columns[22]) || 0,
                notInterested: cleanInt(columns[23]) || 0,
                keyInfluencers: cleanInt(columns[44]) || 0,
                planYes: cleanInt(columns[45]) || 0,
                planMaybe: cleanInt(columns[46]) || 0,
                planNo: cleanInt(columns[47]) || 0
            }
        };
        
        sessions.push(session);
    }
    
    console.log(`Parsed ${sessions.length} sessions from CSV`);
    return sessions;
}

// District coordinates fallback
function getDistrictCoordinates(districtName) {
    const districtMap = {
        'Ubaro': { lat: 28.1537, lng: 69.8166 },
        'Dharki': { lat: 28.0328, lng: 69.7041 },
        'Ghotki': { lat: 28.0330, lng: 69.3818 },
        'Jaferabad': { lat: 28.2844, lng: 68.4496 },
        'Ranipur': { lat: 27.2878, lng: 68.5064 },
        'Mehrabpur': { lat: 27.1066, lng: 68.0188 },
        'Dadu': { lat: 26.7319, lng: 67.7750 },
        'Muzaffar Ghar': { lat: 30.0722, lng: 71.1933 },
        'Kot Adu': { lat: 30.4708, lng: 70.9664 },
        'Karor Lal esan': { lat: 31.2233, lng: 70.9511 },
        'Bhakkar': { lat: 31.6253, lng: 71.0656 },
        'Mianwali': { lat: 32.5851, lng: 71.5436 },
        'Sargodha': { lat: 32.0836, lng: 72.6711 },
        'Phalia': { lat: 32.4311, lng: 73.5792 },
        'Chakwal': { lat: 32.9333, lng: 72.8583 },
        'Toba take singh': { lat: 30.9747, lng: 72.4867 },
        'Unknown': { lat: 30.3753, lng: 69.3451 } // Center of Pakistan
    };
    
    return districtMap[districtName] || districtMap['Unknown'];
}

// ===== SIMPLIFIED MEDIA HANDLING =====
async function loadMediaDataSimple() {
    try {
        console.log('Loading media data from media.json...');
        
        const response = await fetch('media.json');
        if (response.ok) {
            const data = await response.json();
            
            if (Array.isArray(data) && data.length > 0) {
                mediaItems = data[0].mediaItems || [];
            } else if (data.mediaItems) {
                mediaItems = data.mediaItems;
            } else if (Array.isArray(data)) {
                mediaItems = data;
            } else {
                mediaItems = [];
            }
            
            console.log(`Loaded ${mediaItems.length} media items from media.json`);
            
            // Ensure all paths are correct
            mediaItems = mediaItems.map(item => {
                if (item.filename && !item.filename.startsWith('gallery/') && 
                    !item.filename.startsWith('http') && 
                    !item.filename.startsWith('assets/')) {
                    item.filename = 'gallery/' + item.filename;
                }
                return item;
            });
            
        } else {
            throw new Error('media.json not found or inaccessible');
        }
    } catch (error) {
        console.error('Error loading media:', error);
        console.log('Creating simple media data...');
        mediaItems = createSimpleMedia();
    }
}

function createSimpleMedia() {
    const media = [];
    
    // Essential brand files
    const essentialFiles = [
        { id: 1, filename: 'gallery/Bayer.png', caption: 'Bayer Corporation Logo', category: 'brand', type: 'logo' },
        { id: 2, filename: 'gallery/Buctril.jpg', caption: 'Buctril Super Herbicide Product', category: 'brand', type: 'product' },
        { id: 3, filename: 'gallery/Interact.gif', caption: 'Interact Solutions Animation', category: 'brand', type: 'animation' },
        { id: 4, filename: 'gallery/poductts.jpg', caption: 'Bayer Agricultural Product Range', category: 'brand', type: 'product-range' },
        { id: 5, filename: 'gallery/bg.mp4', caption: 'Background video for gallery', category: 'brand', type: 'background' },
        { id: 6, filename: 'gallery/placeholder.svg', caption: 'Fallback placeholder', category: 'utility', type: 'placeholder' }
    ];
    
    essentialFiles.forEach(file => media.push(file));
    
    // Session placeholders (simplified)
    for (let i = 1; i <= 40; i++) {
        const districtIndex = Math.floor((i - 1) / 3) % 16;
        const districts = [
            'Ubaro', 'Dharki', 'Ghotki', 'Jaferabad', 'Ranipur', 
            'Mehrabpur', 'Dadu', 'Muzaffar Ghar', 'Kot Adu', 
            'Karor Lal esan', 'Bhakkar', 'Mianwali', 'Sargodha', 
            'Phalia', 'Chakwal', 'Toba take singh'
        ];
        const district = districts[districtIndex];
        
        media.push({
            id: 6 + (i-1)*2 + 1,
            filename: 'gallery/placeholder.svg',
            caption: `Session ${i}: ${district} District Field Session`,
            category: 'session',
            type: 'photo',
            district: district,
            sessionId: i
        });
        
        media.push({
            id: 6 + (i-1)*2 + 2,
            filename: 'gallery/placeholder.svg',
            caption: `Session ${i}: ${district} District Field Demonstration`,
            category: 'session',
            type: 'video',
            district: district,
            sessionId: i
        });
    }
    
    console.log(`Created ${media.length} simple media items`);
    return media;
}

function renderGallerySimple() {
    const container = elements.mediaGallery;
    if (!container) return;

    container.innerHTML = '';
    
    mediaItems.forEach((media, index) => {
        const isVideo = media.filename.endsWith('.mp4') || 
                       media.filename.endsWith('.webm') ||
                       media.type === 'video' ||
                       media.filename.includes('bg.mp4');
        
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.setAttribute('data-index', index);
        item.setAttribute('data-category', media.category || 'other');
        item.setAttribute('data-type', media.type || 'unknown');
        
        let mediaPath = media.filename;
        let actualSrc = mediaPath;
        
        // For bg.mp4, use it directly
        if (mediaPath === 'gallery/bg.mp4') {
            actualSrc = mediaPath;
        } else if (mediaPath === 'gallery/placeholder.svg') {
            actualSrc = 'gallery/placeholder.svg';
        } else {
            // For other files, check if they're likely to exist
            const fileExtension = mediaPath.split('.').pop().toLowerCase();
            const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg'];
            const videoExtensions = ['mp4', 'webm'];
            
            if (isVideo && !videoExtensions.includes(fileExtension)) {
                actualSrc = 'gallery/placeholder.svg';
            } else if (!isVideo && !imageExtensions.includes(fileExtension)) {
                actualSrc = 'gallery/placeholder.svg';
            }
        }
        
        if (isVideo) {
            item.innerHTML = `
                <div class="video-wrapper">
                    ${actualSrc.endsWith('.mp4') ? 
                        `<video muted playsinline preload="metadata" poster="gallery/placeholder.svg">
                            <source src="${actualSrc}" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>` :
                        `<img src="gallery/placeholder.svg" alt="${media.caption}" 
                             style="width:100%; height:180px; object-fit:cover; border-radius:8px;">`
                    }
                    <div class="video-overlay">
                        <i class="fas fa-play-circle"></i>
                    </div>
                    <div class="media-type-badge">
                        <i class="fas fa-video"></i> ${media.type === 'background' ? 'Background' : 'Video'}
                    </div>
                </div>
                <div class="gallery-caption">
                    <div class="gallery-badge ${media.category || 'other'}">${media.category || 'Media'}</div>
                    <div class="gallery-title" title="${media.caption || 'Media Item'}">
                        ${(media.caption || 'Media Item').substring(0, 40)}
                        ${(media.caption || '').length > 40 ? '...' : ''}
                    </div>
                    <div class="gallery-meta">
                        ${media.sessionId ? `<span><i class="fas fa-hashtag"></i> Session ${media.sessionId}</span>` : ''}
                        ${media.district ? `<span><i class="fas fa-map-marker-alt"></i> ${media.district}</span>` : ''}
                        ${media.date ? `<span><i class="fas fa-calendar"></i> ${media.date}</span>` : ''}
                    </div>
                </div>
            `;
        } else {
            item.innerHTML = `
                <img src="${actualSrc}" 
                     alt="${media.caption || 'Campaign image'}"
                     loading="lazy"
                     onerror="this.src='gallery/placeholder.svg'; this.onerror=null;"
                     style="width:100%; height:180px; object-fit:cover; border-radius:8px 8px 0 0;">
                <div class="media-type-badge">
                    <i class="fas fa-image"></i> ${media.type === 'logo' ? 'Logo' : 'Image'}
                </div>
                <div class="gallery-caption">
                    <div class="gallery-badge ${media.category || 'other'}">${media.category || 'Media'}</div>
                    <div class="gallery-title" title="${media.caption || 'Media Item'}">
                        ${(media.caption || 'Media Item').substring(0, 40)}
                        ${(media.caption || '').length > 40 ? '...' : ''}
                    </div>
                    <div class="gallery-meta">
                        ${media.sessionId ? `<span><i class="fas fa-hashtag"></i> Session ${media.sessionId}</span>` : ''}
                        ${media.district ? `<span><i class="fas fa-map-marker-alt"></i> ${media.district}</span>` : ''}
                        ${media.date ? `<span><i class="fas fa-calendar"></i> ${media.date}</span>` : ''}
                    </div>
                </div>
            `;
        }
        
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (actualSrc === 'gallery/placeholder.svg') {
                alert(`Media Preview: ${media.caption}\n\nThis is a placeholder. Actual media files need to be uploaded to the gallery/ folder.`);
            } else if (isVideo && actualSrc.endsWith('.mp4')) {
                // Open video in modal
                openMediaViewer(index);
            } else {
                // Open image in modal
                openMediaViewer(index);
            }
        });
        
        container.appendChild(item);
    });
}

// ===== FIXED MAP FUNCTIONS =====
async function initializeMap() {
    return new Promise((resolve) => {
        try {
            const mapContainer = document.getElementById('campaignMap');
            if (!mapContainer) {
                console.error('Map container not found');
                resolve();
                return;
            }
            
            // Initialize map centered on Pakistan
            map = L.map('campaignMap', {
                center: [30.3753, 69.3451],
                zoom: 6,
                zoomControl: false,
                preferCanvas: true,
                maxBounds: [
                    [23.5, 60],
                    [37, 78]
                ],
                maxBoundsViscosity: 1.0
            });

            // Add tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18,
                minZoom: 5,
                noWrap: true
            }).addTo(map);

            // Add zoom control
            L.control.zoom({ position: 'topright' }).addTo(map);

            // Add scale control
            L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

            // Initialize marker cluster
            markerCluster = L.markerClusterGroup({
                showCoverageOnHover: false,
                zoomToBoundsOnClick: true,
                chunkedLoading: true,
                chunkInterval: 100,
                spiderfyOnMaxZoom: true,
                maxClusterRadius: 80
            });
            map.addLayer(markerCluster);

            // Add markers immediately
            updateMapMarkers();
            
            console.log('Map initialized successfully with marker clusters');
            resolve();

        } catch (error) {
            console.error('Failed to initialize map:', error);
            // Provide fallback
            if (mapContainer) {
                mapContainer.innerHTML = `
                    <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#f0f0f0; border-radius:10px;">
                        <div style="text-align:center; padding:20px;">
                            <i class="fas fa-map-marked-alt" style="font-size:48px; color:#ccc; margin-bottom:15px;"></i>
                            <p style="color:#666; margin-bottom:10px;">Interactive map cannot be loaded</p>
                            <small style="color:#999;">Check internet connection and try refreshing</small>
                        </div>
                    </div>
                `;
            }
            resolve();
        }
    });
}

function updateMapMarkers() {
    if (!map || !markerCluster) {
        console.error('Map or markerCluster not initialized');
        return;
    }
    
    // Clear existing markers
    markerCluster.clearLayers();
    
    if (currentFilteredSessions.length === 0) {
        console.log('No sessions to display on map');
        if (elements.mapStats) {
            elements.mapStats.innerHTML = `
                <i class="fas fa-map-marker-alt"></i>
                No sessions found for current filters
            `;
        }
        return;
    }
    
    console.log(`Adding ${currentFilteredSessions.length} markers to map`);
    
    const markers = [];
    const bounds = L.latLngBounds();
    let validMarkers = 0;
    
    currentFilteredSessions.forEach(session => {
        // FIX: Validate coordinates before creating marker
        if (session.latitude && session.longitude && 
            !isNaN(session.latitude) && !isNaN(session.longitude) &&
            Math.abs(session.latitude) <= 90 && Math.abs(session.longitude) <= 180) {
            
            // Determine marker color based on performance
            let markerColor = '#2e7d32';
            let performanceLevel = 'high';
            
            if (session.definiteUseRate < 70) {
                markerColor = '#f44336';
                performanceLevel = 'low';
            } else if (session.definiteUseRate < 85) {
                markerColor = '#ff9800';
                performanceLevel = 'medium';
            }
            
            // Create custom icon
            const icon = L.divIcon({
                className: 'custom-marker',
                html: `
                    <div class="map-marker" style="
                        background: radial-gradient(circle at 30% 30%, ${markerColor}, ${darkenColor(markerColor, 30)});
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        border: 3px solid white;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.3), 0 0 0 2px ${markerColor}40;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        color: white;
                        font-size: 11px;
                        transition: all 0.2s ease;
                    ">
                        ${session.sessionId ? session.sessionId.replace(/[^0-9]/g, '') : session.id}
                    </div>
                `,
                iconSize: [30, 30],
                iconAnchor: [15, 15],
                popupAnchor: [0, -15]
            });
            
            // Create marker
            const marker = L.marker([session.latitude, session.longitude], {
                title: session.sessionId || `Session ${session.id}`,
                icon: icon,
                riseOnHover: true
            });
            
            // Create popup content
            const popupContent = `
                <div class="map-popup" style="min-width: 280px; max-width: 320px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #eee;">
                        <h4 style="margin:0; color: ${markerColor}; font-weight: 700; font-size: 16px;">
                            ${session.sessionId || `Session ${session.id}`}
                        </h4>
                        <span style="background: ${markerColor}; color: white; padding: 4px 12px; border-radius: 15px; font-size: 12px; font-weight: 600;">
                            ${session.definiteUseRate || 0}% Definite
                        </span>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <p style="margin:6px 0; font-size: 14px;"><strong><i class="fas fa-map-marker-alt" style="color: ${markerColor}; margin-right: 6px;"></i> Location:</strong> ${session.location || session.spot}</p>
                        <p style="margin:6px 0; font-size: 14px;"><strong><i class="fas fa-city" style="color: ${markerColor}; margin-right: 6px;"></i> District:</strong> ${session.district || session.city}</p>
                        <p style="margin:6px 0; font-size: 14px;"><strong><i class="fas fa-calendar" style="color: ${markerColor}; margin-right: 6px;"></i> Date:</strong> ${session.date}</p>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 15px 0;">
                        <div style="background: linear-gradient(135deg, #f8f9fa, #e9ecef); padding: 12px; border-radius: 8px; text-align: center; border-left: 4px solid ${markerColor}80;">
                            <div style="font-size: 20px; font-weight: 800; color: #2e7d32; margin-bottom: 2px;">${session.farmers || 0}</div>
                            <div style="font-size: 11px; color: #666; font-weight: 600;">Farmers</div>
                        </div>
                        <div style="background: linear-gradient(135deg, #f8f9fa, #e9ecef); padding: 12px; border-radius: 8px; text-align: center; border-left: 4px solid ${markerColor}80;">
                            <div style="font-size: 20px; font-weight: 800; color: #2e7d32; margin-bottom: 2px;">${(session.acres || 0).toLocaleString()}</div>
                            <div style="font-size: 11px; color: #666; font-weight: 600;">Acres</div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;">
                        <div style="display: flex; gap: 10px;">
                            <button onclick="showSessionModal(${session.id})" style="
                                flex: 1;
                                background: ${markerColor};
                                color: white;
                                border: none;
                                padding: 10px 15px;
                                border-radius: 6px;
                                cursor: pointer;
                                font-weight: 600;
                                font-size: 13px;
                                transition: all 0.2s;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                gap: 6px;
                            " onmouseover="this.style.opacity='0.9'; this.style.transform='translateY(-1px)'" onmouseout="this.style.opacity='1'; this.style.transform='translateY(0)'">
                                <i class="fas fa-info-circle"></i> View Details
                            </button>
                            <button onclick="filterByDistrict('${session.district || session.city}')" style="
                                background: white;
                                color: ${markerColor};
                                border: 2px solid ${markerColor};
                                padding: 10px 15px;
                                border-radius: 6px;
                                cursor: pointer;
                                font-weight: 600;
                                font-size: 13px;
                                transition: all 0.2s;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                gap: 6px;
                            " onmouseover="this.style.background='${markerColor}10'" onmouseout="this.style.background='white'">
                                <i class="fas fa-filter"></i> Filter
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            marker.bindPopup(popupContent, {
                maxWidth: 320,
                minWidth: 280,
                className: 'map-popup-container',
                autoClose: false,
                closeOnClick: false
            });
            
            marker.on('click', function() {
                this.openPopup();
            });
            
            markers.push(marker);
            bounds.extend([session.latitude, session.longitude]);
            validMarkers++;
        } else {
            console.warn(`Invalid coordinates for session ${session.id}:`, session.latitude, session.longitude);
        }
    });
    
    // Add all markers to cluster
    if (markers.length > 0) {
        markerCluster.addLayers(markers);
        
        // Fit bounds with padding
        if (bounds.isValid()) {
            map.fitBounds(bounds, { 
                padding: [50, 50],
                animate: true,
                duration: 1,
                maxZoom: 10
            });
        }
        
        // Update map stats
        if (elements.mapStats) {
            const totalSessions = currentFilteredSessions.length;
            const totalFarmers = currentFilteredSessions.reduce((sum, s) => sum + (s.farmers || 0), 0);
            const totalAcres = currentFilteredSessions.reduce((sum, s) => sum + (s.acres || 0), 0);
            const uniqueDistricts = [...new Set(currentFilteredSessions.map(s => s.district || s.city))].filter(d => d).length;
            
            elements.mapStats.innerHTML = `
                <i class="fas fa-map-marked-alt" style="margin-right: 8px;"></i>
                <span style="font-weight: 600;">${validMarkers} locations</span> 
                across ${uniqueDistricts} districts • 
                ${totalFarmers.toLocaleString()} farmers • 
                ${totalAcres.toLocaleString()} acres
            `;
        }
        
        console.log(`Added ${markers.length} valid markers to the map`);
    } else {
        console.warn('No valid markers to add to map');
        if (elements.mapStats) {
            elements.mapStats.innerHTML = `
                <i class="fas fa-map-marked-alt"></i>
                No valid coordinates found for current sessions
            `;
        }
    }
}

// ===== DASHBOARD FUNCTIONS =====
function updateDashboardStats() {
    const totalSessions = currentFilteredSessions.length;
    const totalFarmers = currentFilteredSessions.reduce((sum, s) => sum + (s.farmers || 0), 0);
    const totalAcres = currentFilteredSessions.reduce((sum, s) => sum + (s.acres || 0), 0);
    const uniqueDistricts = [...new Set(currentFilteredSessions.map(s => s.district || s.city))].filter(d => d).length;

    if (elements.sessionCount) elements.sessionCount.textContent = totalSessions;
    if (elements.farmerCount) elements.farmerCount.textContent = totalFarmers.toLocaleString();
    if (elements.acreCount) elements.acreCount.textContent = totalAcres.toLocaleString();
    if (elements.districtCount) elements.districtCount.textContent = uniqueDistricts;
    if (elements.totalSessions) elements.totalSessions.textContent = totalSessions;
    if (elements.shownSessions) elements.shownSessions.textContent = Math.min(itemsPerPage, totalSessions);
    if (elements.totalSessionsCount) elements.totalSessionsCount.textContent = totalSessions;
    if (elements.totalFarmersCount) elements.totalFarmersCount.textContent = totalFarmers.toLocaleString();
    if (elements.totalAcresCount) elements.totalAcresCount.textContent = totalAcres.toLocaleString();
    
    const totalPages = Math.ceil(totalSessions / itemsPerPage);
    if (elements.currentPage) elements.currentPage.textContent = currentPage;
    if (elements.totalPages) elements.totalPages.textContent = totalPages;
}

// ===== TABLE AND RENDERING FUNCTIONS =====
function renderSessionsTable() {
    const tbody = elements.sessionsTableBody;
    if (!tbody) return;

    if (currentFilteredSessions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align:center; padding:40px; color:#666;">
                    <i class="fas fa-inbox"></i>
                    <p>No session data available for the current filters.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = '';
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageSessions = currentFilteredSessions.slice(startIndex, endIndex);
    
    pageSessions.forEach(session => {
        const row = document.createElement('tr');
        row.style.cursor = 'pointer';
        row.onclick = () => showSessionModal(session.id);
        
        let performanceClass = 'session-high';
        if (session.definiteUseRate < 70) performanceClass = 'session-low';
        else if (session.definiteUseRate < 85) performanceClass = 'session-medium';
        
        row.innerHTML = `
            <td class="session-number">${session.sessionId || session.sessionNumber}</td>
            <td>${session.date}</td>
            <td class="session-city">${session.district || session.city}</td>
            <td class="session-spot" title="${session.location || session.spot}">${(session.location || session.spot || '').substring(0, 20)}${(session.location || session.spot || '').length > 20 ? '...' : ''}</td>
            <td title="${session.village}">${(session.village || '').substring(0, 15)}${(session.village || '').length > 15 ? '...' : ''}</td>
            <td>${session.facilitator}</td>
            <td class="session-stats">${session.farmers}</td>
            <td class="session-stats">${session.acres.toLocaleString()}</td>
            <td class="${performanceClass}">${session.definiteUseRate || 0}%</td>
            <td>${session.awarenessRate || 0}%</td>
            <td>
                <button class="btn-table" onclick="event.stopPropagation(); showSessionModal(${session.id})">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn-table" onclick="event.stopPropagation(); exportSessionData(${session.id})">
                    <i class="fas fa-download"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    updatePaginationControls();
}

// ===== HELPER FUNCTIONS =====
function updateProgress(percent, message) {
    if (elements.progressFill) {
        elements.progressFill.style.width = percent + '%';
    }
    if (elements.progressText) {
        elements.progressText.textContent = percent + '%';
    }
    if (message) {
        console.log(message);
    }
}

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
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function darkenColor(color, percent) {
    let r = parseInt(color.slice(1, 3), 16);
    let g = parseInt(color.slice(3, 5), 16);
    let b = parseInt(color.slice(5, 7), 16);
    
    r = Math.floor(r * (100 - percent) / 100);
    g = Math.floor(g * (100 - percent) / 100);
    b = Math.floor(b * (100 - percent) / 100);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    document.getElementById('applyFilters')?.addEventListener('click', applyFilters);
    document.getElementById('resetFilters')?.addEventListener('click', resetFilters);
    document.getElementById('exportData')?.addEventListener('click', exportEnhancedData);
    document.getElementById('refreshData')?.addEventListener('click', () => location.reload());
    document.getElementById('shareSummaryBtn')?.addEventListener('click', shareCampaignSummary);
    document.getElementById('cityFilter')?.addEventListener('change', applyFilters);
    document.getElementById('sessionTypeFilter')?.addEventListener('change', applyFilters);
    document.getElementById('dateFrom')?.addEventListener('change', applyFilters);
    document.getElementById('dateTo')?.addEventListener('change', applyFilters);
    document.getElementById('searchInput')?.addEventListener('input', applyFilters);
    
    document.querySelectorAll('.gallery-filter-btn').forEach(btn => {
        btn.addEventListener('click', handleGalleryFilter);
    });
    
    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderSessionsTable();
        }
    });
    
    document.getElementById('nextPage')?.addEventListener('click', () => {
        const totalPages = Math.ceil(currentFilteredSessions.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderSessionsTable();
        }
    });
    
    document.getElementById('fitBounds')?.addEventListener('click', fitMapBounds);
    document.getElementById('resetMap')?.addEventListener('click', resetMapView);
    document.getElementById('exportMap')?.addEventListener('click', captureMap);
}

// ===== FILTER FUNCTIONS =====
function applyFilters() {
    const districtValue = document.getElementById('cityFilter').value;
    const searchValue = document.getElementById('searchInput').value.toLowerCase();
    const dateFromValue = document.getElementById('dateFrom').value;
    const dateToValue = document.getElementById('dateTo').value;
    const sessionTypeValue = document.getElementById('sessionTypeFilter').value;
    
    currentFilteredSessions = allSessions.filter(session => {
        if (districtValue !== 'all' && (session.district || session.city) !== districtValue) return false;
        
        if (searchValue) {
            const searchable = `${session.sessionId || ''} ${session.sessionNumber || ''} ${session.district || ''} ${session.city || ''} ${session.location || ''} ${session.spot || ''} ${session.village || ''} ${session.facilitator || ''} ${session.focus || ''}`.toLowerCase();
            if (!searchable.includes(searchValue)) return false;
        }
        
        if (dateFromValue && session.date < dateFromValue) return false;
        if (dateToValue && session.date > dateToValue) return false;
        
        if (sessionTypeValue !== 'all') {
            if (!session.sessionType || !session.sessionType.toLowerCase().includes(sessionTypeValue.toLowerCase())) return false;
        }
        
        return true;
    });
    
    currentPage = 1;
    
    updateDashboardStats();
    renderSessionsTable();
    updateMapMarkers();
    initializeAnalyticsCharts();
    
    showToast(`Found ${currentFilteredSessions.length} sessions`, 'success');
}

// ===== FALLBACK FUNCTIONS =====
async function loadSessionsFromJSON() {
    try {
        const response = await fetch('sessions.json');
        if (response.ok) {
            const data = await response.json();
            allSessions = data.sessions || [];
            console.log(`Loaded ${allSessions.length} sessions from sessions.json`);
        } else {
            throw new Error('sessions.json not found');
        }
    } catch (error) {
        console.error('Error loading from JSON:', error);
        console.log('Creating embedded sessions data...');
        allSessions = createEmbeddedSessionsFromCSV();
    }
}

async function loadEmbeddedSessionsData() {
    allSessions = createEmbeddedSessions();
}

// ===== OTHER EXISTING FUNCTIONS =====
// Include all other functions from your original code that weren't modified
// such as: initializeTabs, showSessionModal, openMediaViewer, 
// initializeAnalyticsCharts, updatePaginationControls, etc.

// Note: The rest of your functions (initializeTabs, handleGalleryFilter, 
// shareCampaignSummary, exportEnhancedData, etc.) should remain as they were
// in your original code. I've only included the modified functions above.

console.log('AgriVista Dashboard v5.0 Complete Fixed Version loaded successfully.');
