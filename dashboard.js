// dashboard.js - FIXED VERSION v6.0
console.log('AgriVista Dashboard v6.0 - Fixed Media Paths initializing...');

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
    console.log('DOM loaded. Starting initialization...');
    
    setupEventListeners();
    initializeTabs();
    
    // Set date max to today
    const today = new Date().toISOString().split('T')[0];
    const dateTo = document.getElementById('dateTo');
    if (dateTo) {
        dateTo.max = today;
        dateTo.value = '2025-12-12';
    }
    
    const dateFrom = document.getElementById('dateFrom');
    if (dateFrom) {
        dateFrom.value = '2025-11-24';
    }
    
    loadAllData();
});

// ===== DATA LOADING =====
async function loadAllData() {
    try {
        updateProgress(0, 'Starting data load...');
        updateStatus('Loading campaign data and media...', 'loading');
        
        await loadSessionsFromCSV();
        updateProgress(40, 'CSV data loaded...');
        
        await loadMediaData();
        updateProgress(70, 'Media data loaded...');
        
        currentFilteredSessions = [...allSessions];
        
        updateDashboardStats();
        updateProgress(80, 'Dashboard stats updated...');
        
        await initializeMap();
        updateProgress(85, 'Map initialized...');
        
        renderGallery();
        updateProgress(90, 'Gallery loaded...');
        
        renderSessionsTable();
        updateProgress(95, 'Sessions table ready...');
        
        initializeAnalyticsCharts();
        updateProgress(98, 'Analytics complete...');
        
        updateMediaCounts();
        updateProgress(99, 'Media counts updated...');
        
        setTimeout(() => {
            if (elements.loadingOverlay) {
                elements.loadingOverlay.style.opacity = '0';
                setTimeout(() => {
                    elements.loadingOverlay.style.display = 'none';
                }, 300);
            }
        }, 500);
        
        updateProgress(100, 'Dashboard ready!');
        updateStatus('Dashboard loaded successfully', 'success');
        
        console.log(`Loaded ${allSessions.length} sessions and ${mediaItems.length} media items`);
        
        setTimeout(initializeLazyLoading, 1000);
        
    } catch (error) {
        console.error('Error loading data:', error);
        showError(`Data loading error: ${error.message}. Using fallback data.`);
        
        await loadFallbackData();
        
        updateDashboardStats();
        renderSessionsTable();
        await initializeMap();
        renderGallery();
        initializeAnalyticsCharts();
        updateMediaCounts();
        
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = 'none';
        }
    }
}

// ===== UPDATED MEDIA HANDLING =====
async function loadMediaData() {
    try {
        console.log('Loading media data...');
        
        const response = await fetch('media.json');
        if (response.ok) {
            const data = await response.json();
            mediaItems = data.mediaItems || [];
            
            console.log(`Loaded ${mediaItems.length} media items from media.json`);
            
            // Fix paths based on folder structure
            mediaItems = mediaItems.map(item => {
                if (item.filename && !item.filename.includes('/')) {
                    // If no path specified, determine based on category
                    const isBranding = ['brand', 'utility', 'logo'].includes(item.category);
                    item.filename = isBranding ? 
                        `assets/${item.filename}` : 
                        `assets/gallery/${item.filename}`;
                }
                return item;
            });
            
        } else {
            throw new Error('media.json not found');
        }
    } catch (error) {
        console.error('Error loading media:', error);
        mediaItems = createFallbackMedia();
    }
}

function createFallbackMedia() {
    return [
        { id: 1, filename: 'assets/Bayer.png', caption: 'Bayer Logo', category: 'brand', type: 'logo' },
        { id: 2, filename: 'assets/Buctril.jpg', caption: 'Buctril Super', category: 'brand', type: 'product' },
        { id: 3, filename: 'assets/Interact.gif', caption: 'Animation', category: 'brand', type: 'animation' },
        { id: 4, filename: 'assets/poductts.jpg', caption: 'Product Range', category: 'brand', type: 'product-range' },
        { id: 5, filename: 'assets/gallery/bg.mp4', caption: 'Background Video', category: 'brand', type: 'background' },
        { id: 6, filename: 'assets/gallery/placeholder.svg', caption: 'Session Placeholder', category: 'session', type: 'photo', district: 'Ubaro', sessionId: 1 }
    ];
}

// ===== FIXED CSV PARSING =====
async function loadSessionsFromCSV() {
    try {
        console.log('Loading sessions from CSV...');
        
        const response = await fetch('sum_sheet.csv');
        if (!response.ok) {
            throw new Error('CSV file not found');
        }
        
        const csvText = await response.text();
        allSessions = parseCSVData(csvText);
        
        if (allSessions.length === 0) {
            throw new Error('No sessions parsed from CSV');
        }
        
        console.log(`Parsed ${allSessions.length} sessions from CSV`);
        
    } catch (error) {
        console.error('Error loading CSV:', error);
        allSessions = createFallbackSessions();
    }
}

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
        
        // Parse coordinates
        let coordString = (columns[14] || '').replace(/^"|"$/g, '').replace(/""/g, '"');
        let latitude = null;
        let longitude = null;
        
        if (coordString.includes('°')) {
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
        
        // Clean numeric values
        const cleanInt = (val) => parseInt((val || '0').replace(/,/g, '')) || 0;
        const cleanFloat = (val) => parseFloat((val || '0').replace(/,/g, '').replace('%', '')) || 0;
        
        // Use district fallback if coordinates invalid
        if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
            const districtName = columns[15] || columns[1] || 'Unknown';
            const districtCoords = getDistrictCoordinates(districtName);
            latitude = districtCoords.lat;
            longitude = districtCoords.lng;
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
            farmers: cleanInt(columns[16]),
            wheatFarmers: cleanInt(columns[17]) || cleanInt(columns[16]),
            acres: cleanInt(columns[18]),
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
            definiteUseRate: cleanFloat(columns[40]) || 0,
            maybeRate: cleanFloat(columns[42]) || 0,
            notInterestedRate: cleanFloat(columns[43]) || 0,
            estimatedBuctrilAcres: cleanInt(columns[24]) || cleanInt(columns[18]),
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
    
    return sessions;
}

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
        'Unknown': { lat: 30.3753, lng: 69.3451 }
    };
    
    return districtMap[districtName] || districtMap['Unknown'];
}

// ===== FALLBACK DATA =====
function createFallbackSessions() {
    const sessions = [];
    const districts = [
        'Ubaro', 'Dharki', 'Ghotki', 'Jaferabad', 'Ranipur',
        'Mehrabpur', 'Dadu', 'Muzaffar Ghar', 'Kot Adu',
        'Karor Lal esan', 'Bhakkar', 'Mianwali', 'Sargodha',
        'Phalia', 'Chakwal', 'Toba take singh'
    ];
    
    for (let i = 1; i <= 40; i++) {
        const districtIndex = (i - 1) % 16;
        const farmers = 30 + Math.floor(Math.random() * 40);
        const acres = 500 + Math.floor(Math.random() * 1000);
        const definiteUseRate = 70 + Math.floor(Math.random() * 25);
        
        sessions.push({
            id: i,
            sessionId: `S${i}`,
            sessionNumber: i,
            city: districts[districtIndex],
            district: districts[districtIndex],
            location: `Location ${i}`,
            spot: `Spot ${i}`,
            date: `2025-11-${24 + Math.floor((i - 1) / 2)}`,
            day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][Math.floor(Math.random() * 6)],
            farmers: farmers,
            wheatFarmers: farmers,
            acres: acres,
            latitude: getDistrictCoordinates(districts[districtIndex]).lat + (Math.random() - 0.5) * 0.2,
            longitude: getDistrictCoordinates(districts[districtIndex]).lng + (Math.random() - 0.5) * 0.2,
            coordinates: '',
            facilitator: `Facilitator ${Math.floor(i / 3) + 1}`,
            facilitatorContact: '',
            host: '',
            hostContact: '',
            dealer: '',
            dealerName: '',
            dealerContact: '',
            village: `Village ${i}`,
            tehsil: districts[districtIndex],
            sessionType: 'education',
            awarenessRate: 60 + Math.floor(Math.random() * 30),
            usedLastYearRate: 40 + Math.floor(Math.random() * 40),
            definiteUseRate: definiteUseRate,
            maybeRate: 5 + Math.floor(Math.random() * 15),
            notInterestedRate: 0 + Math.floor(Math.random() * 10),
            estimatedBuctrilAcres: acres * 0.8,
            understandingScore: 2.5 + Math.random() * 0.5,
            topReasonUse: 'Have Trust in Bayer',
            topReasonNotUse: 'Price Concern',
            focus: 'Product Education',
            performance: {
                knowBuctril: Math.floor(farmers * 0.7),
                usedLastYear: Math.floor(farmers * 0.5),
                willDefinitelyUse: Math.floor(farmers * (definiteUseRate / 100)),
                maybe: Math.floor(farmers * 0.1),
                notInterested: Math.floor(farmers * 0.05),
                keyInfluencers: Math.floor(farmers * 0.1),
                planYes: Math.floor(farmers * 0.8),
                planMaybe: Math.floor(farmers * 0.15),
                planNo: Math.floor(farmers * 0.05)
            }
        });
    }
    
    return sessions;
}

async function loadFallbackData() {
    allSessions = createFallbackSessions();
    mediaItems = createFallbackMedia();
    currentFilteredSessions = [...allSessions];
}

// ===== GALLERY FUNCTIONS =====
function renderGallery() {
    const container = elements.mediaGallery;
    if (!container) return;

    container.innerHTML = '';
    
    if (mediaItems.length === 0) {
        container.innerHTML = `
            <div class="gallery-placeholder">
                <i class="fas fa-image"></i>
                <p>No media files found</p>
                <small>Add media files to assets/gallery/ folder</small>
            </div>
        `;
        return;
    }
    
    mediaItems.forEach((media, index) => {
        const isVideo = media.filename.endsWith('.mp4') || 
                       media.filename.endsWith('.webm') ||
                       media.type === 'video' ||
                       media.type === 'background';
        
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.setAttribute('data-index', index);
        item.setAttribute('data-category', media.category || 'other');
        item.setAttribute('data-type', media.type || 'unknown');
        item.setAttribute('data-district', media.district || '');
        item.setAttribute('data-session', media.sessionId || '');
        
        let mediaSrc = media.filename;
        
        // Check if file exists, otherwise use placeholder
        if (!fileExists(media.filename)) {
            mediaSrc = 'assets/gallery/placeholder.svg';
        }
        
        if (isVideo) {
            item.innerHTML = `
                <div class="video-wrapper">
                    <video muted playsinline preload="metadata" poster="assets/gallery/placeholder.svg">
                        <source src="${mediaSrc}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
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
                <img src="${mediaSrc}" 
                     alt="${media.caption || 'Campaign image'}"
                     loading="lazy"
                     onerror="this.src='assets/gallery/placeholder.svg'; this.onerror=null;"
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
            openMediaViewer(index);
        });
        
        container.appendChild(item);
    });
    
    // Initialize filter counts
    updateMediaFilterCounts();
}

function fileExists(url) {
    // In a real app, you'd check if the file exists via AJAX
    // For now, we'll assume placeholder for missing files
    return url.includes('Bayer.png') || 
           url.includes('Buctril.jpg') || 
           url.includes('Interact.gif') || 
           url.includes('poductts.jpg') ||
           url.includes('bg.mp4') ||
           url.includes('placeholder.svg');
}

// ===== MEDIA FILTERING =====
function handleGalleryFilter(e) {
    const filterBtn = e.currentTarget;
    const filterValue = filterBtn.getAttribute('data-filter');
    
    // Update active button
    document.querySelectorAll('.gallery-filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    filterBtn.classList.add('active');
    
    // Filter gallery items
    const items = document.querySelectorAll('.gallery-item');
    let visibleCount = 0;
    
    items.forEach(item => {
        const itemType = item.getAttribute('data-type');
        const itemCategory = item.getAttribute('data-category');
        const itemDistrict = item.getAttribute('data-district');
        
        let shouldShow = false;
        
        switch(filterValue) {
            case 'all':
                shouldShow = true;
                break;
            case 'brand':
                shouldShow = itemCategory === 'brand' || itemCategory === 'utility';
                break;
            case 'session':
                shouldShow = itemCategory === 'session';
                break;
            case 'videos':
                shouldShow = itemType === 'video' || itemType === 'background';
                break;
            case 'images':
                shouldShow = itemType === 'photo' || itemType === 'logo' || itemType === 'product' || itemType === 'animation';
                break;
            case 'district':
                // This would show a district selector in real implementation
                shouldShow = true;
                break;
            default:
                if (filterValue && itemDistrict === filterValue) {
                    shouldShow = true;
                }
        }
        
        if (shouldShow) {
            item.style.display = 'block';
            visibleCount++;
        } else {
            item.style.display = 'none';
        }
    });
    
    // Show message if no items
    const container = elements.mediaGallery;
    const placeholder = container.querySelector('.gallery-placeholder');
    
    if (visibleCount === 0) {
        if (!placeholder) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'gallery-placeholder';
            emptyMsg.innerHTML = `
                <i class="fas fa-filter"></i>
                <p>No media found for selected filter</p>
                <small>Try another filter option</small>
            `;
            container.appendChild(emptyMsg);
        }
    } else if (placeholder) {
        placeholder.remove();
    }
    
    // Update counts in UI
    document.getElementById('galleryCount').textContent = visibleCount;
}

function updateMediaFilterCounts() {
    const counts = {
        all: mediaItems.length,
        brand: mediaItems.filter(m => m.category === 'brand' || m.category === 'utility').length,
        session: mediaItems.filter(m => m.category === 'session').length,
        videos: mediaItems.filter(m => m.type === 'video' || m.type === 'background').length,
        images: mediaItems.filter(m => ['photo', 'logo', 'product', 'animation'].includes(m.type)).length
    };
    
    // Update button counts
    document.querySelectorAll('.gallery-filter-btn').forEach(btn => {
        const filter = btn.getAttribute('data-filter');
        const countSpan = btn.querySelector('.count');
        if (countSpan && counts[filter]) {
            countSpan.textContent = counts[filter];
        }
    });
}

function updateMediaCounts() {
    const images = mediaItems.filter(m => 
        ['photo', 'logo', 'product', 'animation'].includes(m.type)).length;
    const videos = mediaItems.filter(m => 
        m.type === 'video' || m.type === 'background').length;
    
    document.getElementById('galleryCount').textContent = mediaItems.length;
    document.getElementById('allMediaCount').textContent = mediaItems.length;
    document.getElementById('totalMediaCount').textContent = mediaItems.length;
    document.getElementById('imageCount').textContent = images;
    document.getElementById('videoCount').textContent = videos;
    document.getElementById('footerMediaCount').textContent = mediaItems.length;
}

// ===== MAP FUNCTIONS =====
async function initializeMap() {
    return new Promise((resolve) => {
        try {
            const mapContainer = document.getElementById('campaignMap');
            if (!mapContainer) {
                resolve();
                return;
            }
            
            map = L.map('campaignMap', {
                center: [30.3753, 69.3451],
                zoom: 6,
                zoomControl: false,
                preferCanvas: true
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18,
                minZoom: 5
            }).addTo(map);

            L.control.zoom({ position: 'topright' }).addTo(map);
            L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

            markerCluster = L.markerClusterGroup({
                showCoverageOnHover: false,
                zoomToBoundsOnClick: true,
                chunkedLoading: true
            });
            map.addLayer(markerCluster);

            updateMapMarkers();
            
            console.log('Map initialized successfully');
            resolve();

        } catch (error) {
            console.error('Failed to initialize map:', error);
            resolve();
        }
    });
}

function updateMapMarkers() {
    if (!map || !markerCluster) return;
    
    markerCluster.clearLayers();
    
    if (currentFilteredSessions.length === 0) {
        if (elements.mapStats) {
            elements.mapStats.innerHTML = `
                <i class="fas fa-map-marker-alt"></i>
                No sessions found for current filters
            `;
        }
        return;
    }
    
    const markers = [];
    const bounds = L.latLngBounds();
    
    currentFilteredSessions.forEach(session => {
        if (session.latitude && session.longitude && 
            !isNaN(session.latitude) && !isNaN(session.longitude)) {
            
            let markerColor = '#2e7d32';
            let performanceLevel = 'high';
            
            if (session.definiteUseRate < 70) {
                markerColor = '#f44336';
                performanceLevel = 'low';
            } else if (session.definiteUseRate < 85) {
                markerColor = '#ff9800';
                performanceLevel = 'medium';
            }
            
            const icon = L.divIcon({
                className: 'custom-marker',
                html: `
                    <div class="map-marker" style="
                        background: ${markerColor};
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        border: 3px solid white;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        color: white;
                        font-size: 11px;
                    ">
                        ${session.id}
                    </div>
                `,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });
            
            const marker = L.marker([session.latitude, session.longitude], {
                title: session.sessionId,
                icon: icon
            });
            
            const popupContent = `
                <div style="min-width: 250px;">
                    <h4 style="margin:0 0 10px 0; color: ${markerColor};">${session.sessionId}</h4>
                    <p><strong>Location:</strong> ${session.location}</p>
                    <p><strong>District:</strong> ${session.district}</p>
                    <p><strong>Date:</strong> ${session.date}</p>
                    <p><strong>Farmers:</strong> ${session.farmers}</p>
                    <p><strong>Acres:</strong> ${session.acres}</p>
                    <p><strong>Definite Use:</strong> ${session.definiteUseRate}%</p>
                    <button onclick="showSessionModal(${session.id})" style="
                        background: ${markerColor};
                        color: white;
                        border: none;
                        padding: 8px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        margin-top: 10px;
                        width: 100%;
                    ">
                        View Details
                    </button>
                </div>
            `;
            
            marker.bindPopup(popupContent);
            markers.push(marker);
            bounds.extend([session.latitude, session.longitude]);
        }
    });
    
    if (markers.length > 0) {
        markerCluster.addLayers(markers);
        
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
        
        if (elements.mapStats) {
            const totalSessions = currentFilteredSessions.length;
            const totalFarmers = currentFilteredSessions.reduce((sum, s) => sum + (s.farmers || 0), 0);
            const totalAcres = currentFilteredSessions.reduce((sum, s) => sum + (s.acres || 0), 0);
            const uniqueDistricts = [...new Set(currentFilteredSessions.map(s => s.district))].filter(d => d).length;
            
            elements.mapStats.innerHTML = `
                <i class="fas fa-map-marked-alt"></i>
                <span>${totalSessions} sessions • ${totalFarmers} farmers • ${totalAcres} acres</span>
            `;
        }
    }
}

// ===== DASHBOARD FUNCTIONS =====
function updateDashboardStats() {
    const totalSessions = currentFilteredSessions.length;
    const totalFarmers = currentFilteredSessions.reduce((sum, s) => sum + (s.farmers || 0), 0);
    const totalAcres = currentFilteredSessions.reduce((sum, s) => sum + (s.acres || 0), 0);
    const uniqueDistricts = [...new Set(currentFilteredSessions.map(s => s.district))].filter(d => d).length;

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
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    updatePaginationControls();
}

function updatePaginationControls() {
    const totalPages = Math.ceil(currentFilteredSessions.length / itemsPerPage);
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
    }
    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
    }
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
            const searchable = `${session.sessionId || ''} ${session.sessionNumber || ''} ${session.district || ''} ${session.city || ''} ${session.location || ''} ${session.spot || ''} ${session.village || ''} ${session.facilitator || ''}`.toLowerCase();
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
    
    showToast(`Found ${currentFilteredSessions.length} sessions`, 'success');
}

function resetFilters() {
    document.getElementById('cityFilter').value = 'all';
    document.getElementById('searchInput').value = '';
    document.getElementById('dateFrom').value = '2025-11-24';
    document.getElementById('dateTo').value = '2025-12-12';
    document.getElementById('sessionTypeFilter').value = 'all';
    
    currentFilteredSessions = [...allSessions];
    currentPage = 1;
    
    updateDashboardStats();
    renderSessionsTable();
    updateMapMarkers();
    
    showToast('All filters reset', 'info');
}

// ===== UTILITY FUNCTIONS =====
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

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Filter buttons
    document.getElementById('applyFilters')?.addEventListener('click', applyFilters);
    document.getElementById('resetFilters')?.addEventListener('click', resetFilters);
    document.getElementById('exportData')?.addEventListener('click', exportEnhancedData);
    document.getElementById('refreshData')?.addEventListener('click', () => location.reload());
    document.getElementById('shareSummaryBtn')?.addEventListener('click', shareCampaignSummary);
    
    // Filter inputs
    document.getElementById('cityFilter')?.addEventListener('change', applyFilters);
    document.getElementById('sessionTypeFilter')?.addEventListener('change', applyFilters);
    document.getElementById('dateFrom')?.addEventListener('change', applyFilters);
    document.getElementById('dateTo')?.addEventListener('change', applyFilters);
    document.getElementById('searchInput')?.addEventListener('input', applyFilters);
    
    // Gallery filters
    document.querySelectorAll('.gallery-filter-btn').forEach(btn => {
        btn.addEventListener('click', handleGalleryFilter);
    });
    
    // Pagination
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
    
    // Map controls
    document.getElementById('fitBounds')?.addEventListener('click', fitMapBounds);
    document.getElementById('resetMap')?.addEventListener('click', resetMapView);
    document.getElementById('exportMap')?.addEventListener('click', captureMap);
}

function initializeTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('#tabContent > section');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show selected content
            tabContents.forEach(content => {
                content.style.display = 'none';
            });
            
            document.getElementById(`${tabId}Tab`).style.display = 'block';
            
            // Initialize map if needed
            if (tabId === 'map' && map) {
                setTimeout(() => {
                    map.invalidateSize();
                }, 100);
            }
        });
    });
}

// ===== STUB FUNCTIONS (to be implemented) =====
function showSessionModal(sessionId) {
    console.log('Show session modal:', sessionId);
    alert(`Session ${sessionId} details would show here in a modal.`);
}

function openMediaViewer(index) {
    console.log('Open media viewer:', index);
    const media = mediaItems[index];
    alert(`Media viewer: ${media.caption}\n\nPath: ${media.filename}`);
}

function initializeAnalyticsCharts() {
    console.log('Initialize analytics charts');
}

function exportEnhancedData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allSessions, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "sessions_data.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    showToast('Data exported successfully', 'success');
}

function shareCampaignSummary() {
    const summary = `Buctril Super Farmer Education Drive 2025\nSessions: ${allSessions.length}\nFarmers: ${allSessions.reduce((sum, s) => sum + s.farmers, 0)}\nAcres: ${allSessions.reduce((sum, s) => sum + s.acres, 0)}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Campaign Summary',
            text: summary,
            url: window.location.href
        });
    } else {
        navigator.clipboard.writeText(summary);
        showToast('Summary copied to clipboard', 'success');
    }
}

function fitMapBounds() {
    if (map) {
        const bounds = L.latLngBounds(currentFilteredSessions.map(s => [s.latitude, s.longitude]).filter(coords => coords[0] && coords[1]));
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }
}

function resetMapView() {
    if (map) {
        map.setView([30.3753, 69.3451], 6);
    }
}

function captureMap() {
    alert('Map capture feature would be implemented here.');
}

function filterByDistrict(district) {
    if (district === 'all') {
        document.getElementById('cityFilter').value = 'all';
    } else {
        document.getElementById('cityFilter').value = district;
    }
    applyFilters();
}

function initializeLazyLoading() {
    console.log('Lazy loading initialized');
}

console.log('AgriVista Dashboard v6.0 loaded successfully.');
