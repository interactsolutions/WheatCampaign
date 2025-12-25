// dashboard.js v2.0 - Professional Layout with Brand Separation
console.log('AgriVista Dashboard v2.0 - Professional Layout initializing...');

// GLOBAL STATE
let allSessions = [];
let currentFilteredSessions = [];
let mediaItems = [];
let brandItems = [];
let sessionMediaItems = [];
let map;
let markerCluster;
let currentPage = 1;
const itemsPerPage = 10;

// CAMPAIGN TOTALS
let campaignTotals = {
    totalSessions: 0,
    totalFarmers: 0,
    totalAcres: 0,
    totalDistricts: 0
};

// DOM ELEMENTS
const elements = {
    sessionCount: document.getElementById('sessionCount'),
    farmerCount: document.getElementById('farmerCount'),
    acreCount: document.getElementById('acreCount'),
    districtCount: document.getElementById('districtCount'),
    currentPage: document.getElementById('currentPage'),
    totalPages: document.getElementById('totalPages'),
    mapStats: document.getElementById('mapStats'),
    mediaGallery: document.getElementById('mediaGallery'),
    sessionsTableBody: document.getElementById('sessionsTableBody'),
    imageCount: document.getElementById('imageCount'),
    videoCount: document.getElementById('videoCount'),
    totalMediaCount: document.getElementById('totalMediaCount'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    headerBrandVideos: document.getElementById('header-brand-videos'),
    footerBrandImages: document.getElementById('footer-brand-images')
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded. Starting initialization...');
    
    setupEventListeners();
    
    // Set date max to today
    const today = new Date().toISOString().split('T')[0];
    const dateTo = document.getElementById('dateTo');
    if (dateTo) dateTo.max = today;
    
    loadAllData();
});

// ===== DATA LOADING =====
async function loadAllData() {
    try {
        updateProgress(0, 'Starting data load...');
        
        await loadSessionsFromJSON();
        updateProgress(30, 'Session data loaded...');
        
        await loadMediaData();
        updateProgress(60, 'Media data loaded...');
        
        // Separate brand items and session media
        separateBrandAndSessionMedia();
        updateProgress(70, 'Media separated...');
        
        // Populate brand assets
        populateBrandRows();
        updateProgress(75, 'Brand assets populated...');
        
        currentFilteredSessions = [...allSessions];
        
        updateDashboardStats();
        updateProgress(80, 'Dashboard stats updated...');
        
        await initializeMap();
        updateProgress(85, 'Map initialized...');
        
        renderGallery();
        updateProgress(90, 'Gallery loaded...');
        
        renderSessionsTable();
        updateProgress(95, 'Sessions table ready...');
        
        setTimeout(() => {
            if (elements.loadingOverlay) {
                elements.loadingOverlay.style.opacity = '0';
                setTimeout(() => {
                    elements.loadingOverlay.style.display = 'none';
                }, 300);
            }
        }, 500);
        
        updateProgress(100, 'Dashboard ready!');
        console.log(`Loaded ${allSessions.length} sessions and ${mediaItems.length} media items`);
        
    } catch (error) {
        console.error('Error loading data:', error);
        showError(`Data loading error: ${error.message}. Using fallback data.`);
        
        await loadFallbackData();
        
        updateDashboardStats();
        renderSessionsTable();
        await initializeMap();
        renderGallery();
        
        if (elements.loadingOverlay) {
            elements.loadingOverlay.style.display = 'none';
        }
    }
}

// ===== SEPARATE BRAND AND SESSION MEDIA =====
function separateBrandAndSessionMedia() {
    if (!mediaItems || mediaItems.length === 0) return;
    
    // Clear existing arrays
    brandItems = [];
    sessionMediaItems = [];
    
    mediaItems.forEach(item => {
        if (item.category === 'brand') {
            brandItems.push(item);
        } else {
            sessionMediaItems.push(item);
        }
    });
    
    console.log(`Separated ${brandItems.length} brand items and ${sessionMediaItems.length} session media items`);
}

// ===== POPULATE BRAND ROWS =====
function populateBrandRows() {
    if (!elements.headerBrandVideos || !elements.footerBrandImages) {
        console.warn('Brand row containers not found');
        return;
    }
    
    // Clear existing content
    elements.headerBrandVideos.innerHTML = '';
    elements.footerBrandImages.innerHTML = '';
    
    // Process brand items
    brandItems.forEach(item => {
        const ext = item.filename.split('.').pop().toLowerCase();
        const isVideo = ext === 'mp4' || ext === 'gif' || 
                       item.type === 'video' || item.type === 'animation';
        const isImage = ext === 'jpg' || ext === 'jpeg' || ext === 'png' || 
                       item.type === 'logo' || item.type === 'product';
        
        // Skip background video
        if (item.filename.includes('bg.mp4')) return;
        
        if (isVideo && elements.headerBrandVideos) {
            // Create video element for header
            const video = document.createElement('video');
            video.src = item.filename;
            video.autoplay = true;
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', '');
            video.className = 'brand-video';
            
            const wrapper = document.createElement('div');
            wrapper.className = 'brand-asset';
            wrapper.appendChild(video);
            elements.headerBrandVideos.appendChild(wrapper);
            
        } else if (isImage && elements.footerBrandImages) {
            // Create image element for footer
            const img = document.createElement('img');
            img.src = item.filename;
            img.alt = item.caption || 'Brand Logo';
            img.className = 'brand-image';
            img.loading = 'lazy';
            
            const wrapper = document.createElement('div');
            wrapper.className = 'brand-asset';
            wrapper.appendChild(img);
            elements.footerBrandImages.appendChild(wrapper);
        }
    });
    
    // If no brand videos in header, show a message
    if (elements.headerBrandVideos.children.length === 0) {
        elements.headerBrandVideos.innerHTML = '<p class="brand-placeholder">Brand assets will appear here</p>';
    }
    
    // If no brand images in footer, show a message
    if (elements.footerBrandImages.children.length === 0) {
        elements.footerBrandImages.innerHTML = '<p class="brand-placeholder">Brand logos will appear here</p>';
    }
}

// ===== RENDER GALLERY (SESSION MEDIA ONLY) =====
function renderGallery() {
    const container = elements.mediaGallery;
    if (!container) return;
    
    container.innerHTML = '';
    
    if (sessionMediaItems.length === 0) {
        container.innerHTML = `
            <div class="gallery-placeholder">
                <i class="fas fa-image"></i>
                <p>No session media files found</p>
                <small>Session media files will appear here</small>
            </div>
        `;
        updateMediaCounts();
        return;
    }
    
    const placeholder = 'assets/placeholder.svg';
    
    sessionMediaItems.forEach((media, index) => {
        const isVideo = media.filename.endsWith('.mp4') || media.type === 'video';
        
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.setAttribute('data-index', index);
        item.setAttribute('data-type', media.type || 'unknown');
        item.setAttribute('data-category', 'session');
        
        if (isVideo) {
            item.innerHTML = `
                <div class="video-wrapper">
                    <video muted playsinline preload="metadata">
                        <source src="${media.filename}" type="video/mp4">
                    </video>
                    <div class="video-overlay">
                        <i class="fas fa-play-circle"></i>
                    </div>
                </div>
                <div class="gallery-caption">
                    <div class="gallery-badge">Session ${media.sessionId || ''}</div>
                    <div class="gallery-title">${media.caption || 'Session Media'}</div>
                    ${media.district ? `<div class="gallery-meta"><i class="fas fa-map-marker-alt"></i> ${media.district}</div>` : ''}
                </div>
            `;
        } else {
            item.innerHTML = `
                <img src="${media.filename}" 
                     alt="${media.caption || 'Session Photo'}"
                     loading="lazy"
                     onerror="this.src='${placeholder}'">
                <div class="gallery-caption">
                    <div class="gallery-badge">Session ${media.sessionId || ''}</div>
                    <div class="gallery-title">${media.caption || 'Session Photo'}</div>
                    ${media.district ? `<div class="gallery-meta"><i class="fas fa-map-marker-alt"></i> ${media.district}</div>` : ''}
                </div>
            `;
        }
        
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            openMediaViewer(index);
        });
        
        container.appendChild(item);
    });
    
    updateMediaCounts();
}

// ===== UPDATE MEDIA COUNTS =====
function updateMediaCounts() {
    if (sessionMediaItems.length === 0) return;
    
    const images = sessionMediaItems.filter(m => 
        !m.filename.endsWith('.mp4') && 
        m.type !== 'video' && 
        m.type !== 'animation'
    ).length;
    
    const videos = sessionMediaItems.filter(m => 
        m.filename.endsWith('.mp4') || 
        m.type === 'video'
    ).length;
    
    if (elements.imageCount) elements.imageCount.textContent = images;
    if (elements.videoCount) elements.videoCount.textContent = videos;
    if (elements.totalMediaCount) elements.totalMediaCount.textContent = sessionMediaItems.length;
}

// ===== SESSION DATA FUNCTIONS (from your original code) =====
async function loadSessionsFromJSON() {
    try {
        const response = await fetch('sessions.json');
        if (!response.ok) throw new Error('sessions.json not found');
        
        const jsonData = await response.json();
        
        campaignTotals = {
            totalSessions: jsonData.totalSessions || 0,
            totalFarmers: jsonData.totalFarmers || 0,
            totalAcres: jsonData.totalAcres || 0,
            totalDistricts: jsonData.totalDistricts || 0
        };
        
        allSessions = jsonData.sessions.map(session => {
            const performance = session.performance || {};
            const farmers = session.farmers || 0;
            
            const awarenessRate = performance.awarenessRate || 
                                (farmers > 0 ? Math.round((performance.knowBuctril || 0) / farmers * 100) : 0);
            const definiteUseRate = performance.definiteUseRate || 
                                  (farmers > 0 ? Math.round((performance.willDefinitelyUse || 0) / farmers * 100) : 0);
            
            return {
                id: session.id,
                sessionId: session.sessionId,
                sessionNumber: session.sessionNumber || session.id,
                district: session.district || 'Unknown',
                location: session.location || 'Unknown',
                date: session.date,
                farmers: farmers,
                acres: session.acres || 0,
                latitude: session.latitude,
                longitude: session.longitude,
                facilitator: session.facilitator || 'Unknown',
                village: session.village || '',
                definiteUseRate: definiteUseRate,
                awarenessRate: awarenessRate
            };
        });
        
        if (allSessions.length === 0) throw new Error('No sessions parsed from JSON');
        
        console.log(`Parsed ${allSessions.length} sessions from JSON`);
        
    } catch (error) {
        console.error('Error loading JSON:', error);
        allSessions = createFallbackSessions();
        campaignTotals = {
            totalSessions: allSessions.length,
            totalFarmers: allSessions.reduce((sum, s) => sum + s.farmers, 0),
            totalAcres: allSessions.reduce((sum, s) => sum + s.acres, 0),
            totalDistricts: new Set(allSessions.map(s => s.district)).size
        };
    }
}

async function loadMediaData() {
    try {
        const response = await fetch('media.json');
        if (response.ok) {
            const data = await response.json();
            const basePath = data.mediaBasePath || 'assets/';
            const items = data.mediaItems || [];
            
            mediaItems = items.map(item => ({
                ...item,
                filename: basePath + item.filename
            }));
            
            console.log(`Loaded ${mediaItems.length} media items`);
            
        } else {
            throw new Error('media.json not found');
        }
    } catch (error) {
        console.error('Error loading media:', error);
        mediaItems = createFallbackMedia();
    }
}

function createFallbackSessions() {
    const districts = [
        'Ubaro', 'Dharki', 'Ghotki', 'Jaferabad', 'Ranipur',
        'Mehrabpur', 'Dadu', 'Muzaffar Ghar', 'Kot Adu',
        'Karor Lal esan', 'Bhakkar', 'Mianwali', 'Sargodha',
        'Phalia', 'Chakwal', 'Toba take singh'
    ];
    
    return Array.from({ length: 40 }, (_, i) => ({
        id: i + 1,
        sessionId: `S${i + 1}`,
        sessionNumber: i + 1,
        district: districts[i % 16],
        location: `Location ${i + 1}`,
        date: `2025-11-${24 + Math.floor(i / 2)}`,
        farmers: 30 + Math.floor(Math.random() * 40),
        acres: 500 + Math.floor(Math.random() * 1000),
        latitude: 28.1537 + (Math.random() - 0.5) * 2,
        longitude: 69.8166 + (Math.random() - 0.5) * 2,
        facilitator: `Facilitator ${Math.floor(i / 3) + 1}`,
        village: `Village ${i + 1}`,
        definiteUseRate: 70 + Math.floor(Math.random() * 25),
        awarenessRate: 60 + Math.floor(Math.random() * 30)
    }));
}

function createFallbackMedia() {
    const basePath = 'assets/';
    return [
        // Brand items
        { 
            id: 1, 
            filename: basePath + 'Interact.gif', 
            caption: 'Interact Solutions Animation', 
            category: 'brand', 
            type: 'animation' 
        },
        { 
            id: 2, 
            filename: basePath + 'Bayer.png', 
            caption: 'Bayer Logo', 
            category: 'brand', 
            type: 'logo' 
        },
        { 
            id: 3, 
            filename: basePath + 'Buctril.jpg', 
            caption: 'Buctril Super', 
            category: 'brand', 
            type: 'product' 
        },
        { 
            id: 4, 
            filename: basePath + 'poductts.jpg', 
            caption: 'Product Range', 
            category: 'brand', 
            type: 'product-range' 
        },
        { 
            id: 5, 
            filename: basePath + 'gallery/bg.mp4', 
            caption: 'Background Video', 
            category: 'brand', 
            type: 'background' 
        },
        // Session items (sample)
        { 
            id: 6, 
            filename: basePath + 'gallery/session1.jpg', 
            caption: 'Field Session in Ghotki', 
            category: 'session', 
            type: 'photo',
            sessionId: 'S1',
            district: 'Ghotki'
        },
        { 
            id: 7, 
            filename: basePath + 'gallery/session2.mp4', 
            caption: 'Training Session', 
            category: 'session', 
            type: 'video',
            sessionId: 'S2',
            district: 'Ubaro'
        }
    ];
}

async function loadFallbackData() {
    allSessions = createFallbackSessions();
    mediaItems = createFallbackMedia();
    separateBrandAndSessionMedia();
    currentFilteredSessions = [...allSessions];
    campaignTotals = {
        totalSessions: allSessions.length,
        totalFarmers: allSessions.reduce((sum, s) => sum + s.farmers, 0),
        totalAcres: allSessions.reduce((sum, s) => sum + s.acres, 0),
        totalDistricts: new Set(allSessions.map(s => s.district)).size
    };
}

// ===== UPDATE DASHBOARD STATS =====
function updateDashboardStats() {
    const totalSessions = campaignTotals.totalSessions;
    const totalFarmers = campaignTotals.totalFarmers;
    const totalAcres = campaignTotals.totalAcres;
    
    const filteredSessions = currentFilteredSessions.length;
    const filteredFarmers = currentFilteredSessions.reduce((sum, s) => sum + (s.farmers || 0), 0);
    const filteredAcres = currentFilteredSessions.reduce((sum, s) => sum + (s.acres || 0), 0);
    const uniqueDistricts = [...new Set(currentFilteredSessions.map(s => s.district))].filter(d => d).length;

    if (elements.sessionCount) elements.sessionCount.textContent = totalSessions;
    if (elements.farmerCount) elements.farmerCount.textContent = totalFarmers.toLocaleString();
    if (elements.acreCount) elements.acreCount.textContent = totalAcres.toLocaleString();
    if (elements.districtCount) elements.districtCount.textContent = uniqueDistricts;
    
    const totalPages = Math.ceil(filteredSessions / itemsPerPage);
    if (elements.currentPage) elements.currentPage.textContent = currentPage;
    if (elements.totalPages) elements.totalPages.textContent = totalPages;
}

// ===== RENDER SESSIONS TABLE =====
function renderSessionsTable() {
    const tbody = elements.sessionsTableBody;
    if (!tbody) return;

    if (currentFilteredSessions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align:center; padding:40px; color:#666;">
                    <i class="fas fa-inbox"></i>
                    <p>No session data available for the current filters.</p>
                </td>
            </tr>
        `;
        updatePaginationControls();
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
        
        row.innerHTML = `
            <td class="session-number">${session.sessionId || session.sessionNumber}</td>
            <td>${session.date}</td>
            <td class="session-district">${session.district}</td>
            <td title="${session.location}">${(session.location || '').substring(0, 25)}${(session.location || '').length > 25 ? '...' : ''}</td>
            <td>${session.facilitator}</td>
            <td class="session-stats">${session.farmers}</td>
            <td class="session-stats">${session.acres.toLocaleString()}</td>
            <td style="color: ${getPerformanceColor(session.definiteUseRate)}; font-weight: 600;">${session.definiteUseRate || 0}%</td>
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

function getPerformanceColor(rate) {
    if (rate >= 85) return '#2e7d32';
    if (rate >= 70) return '#ff9800';
    return '#f44336';
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
                zoomControl: false
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }).addTo(map);

            L.control.zoom({ position: 'topright' }).addTo(map);

            markerCluster = L.markerClusterGroup();
            map.addLayer(markerCluster);

            updateMapMarkers();
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
            elements.mapStats.innerHTML = `<i class="fas fa-map-marker-alt"></i> No sessions found for current filters`;
        }
        return;
    }
    
    const markers = [];
    const bounds = L.latLngBounds();
    
    currentFilteredSessions.forEach(session => {
        if (session.latitude && session.longitude) {
            const markerColor = getPerformanceColor(session.definiteUseRate);
            
            const icon = L.divIcon({
                className: 'custom-marker',
                html: `
                    <div style="
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
                        ${session.sessionNumber}
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
                <div style="min-width: 200px;">
                    <h4 style="margin:0 0 10px 0; color: ${markerColor};">${session.sessionId}</h4>
                    <p><strong>District:</strong> ${session.district}</p>
                    <p><strong>Date:</strong> ${session.date}</p>
                    <p><strong>Farmers:</strong> ${session.farmers}</p>
                    <p><strong>Definite Use:</strong> ${session.definiteUseRate}%</p>
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
            
            elements.mapStats.innerHTML = `
                <i class="fas fa-map-marked-alt"></i>
                <span>${totalSessions} sessions • ${totalFarmers} farmers</span>
            `;
        }
    }
}

// ===== UTILITY FUNCTIONS =====
function updateProgress(percent, message) {
    if (elements.progressFill) {
        elements.progressFill.style.width = percent + '%';
    }
    if (elements.progressText) {
        elements.progressText.textContent = percent + '%';
    }
    console.log(message);
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

function showError(message) {
    console.error(message);
    // You could add a toast notification here
}

// ===== FILTER FUNCTIONS =====
function applyFilters() {
    const districtValue = document.getElementById('cityFilter').value;
    const searchValue = document.getElementById('searchInput').value.toLowerCase();
    const dateFromValue = document.getElementById('dateFrom').value;
    const dateToValue = document.getElementById('dateTo').value;
    
    currentFilteredSessions = allSessions.filter(session => {
        if (districtValue !== 'all' && session.district !== districtValue) return false;
        
        if (searchValue) {
            const searchable = `${session.sessionId || ''} ${session.district || ''} ${session.location || ''} ${session.facilitator || ''} ${session.village || ''}`.toLowerCase();
            if (!searchable.includes(searchValue)) return false;
        }
        
        if (dateFromValue && session.date < dateFromValue) return false;
        if (dateToValue && session.date > dateToValue) return false;
        
        return true;
    });
    
    currentPage = 1;
    
    updateDashboardStats();
    renderSessionsTable();
    updateMapMarkers();
    
    // Show notification
    alert(`Found ${currentFilteredSessions.length} sessions`);
}

function resetFilters() {
    document.getElementById('cityFilter').value = 'all';
    document.getElementById('searchInput').value = '';
    document.getElementById('dateFrom').value = '2025-11-24';
    document.getElementById('dateTo').value = '2025-12-12';
    
    currentFilteredSessions = [...allSessions];
    currentPage = 1;
    
    updateDashboardStats();
    renderSessionsTable();
    updateMapMarkers();
    
    alert('All filters reset');
}

// ===== GALLERY FILTERS =====
function setupGalleryFilters() {
    document.querySelectorAll('.gallery-filter-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            const filterBtn = e.currentTarget;
            const filterValue = filterBtn.getAttribute('data-filter');
            
            // Update active button
            document.querySelectorAll('.gallery-filter-btn').forEach(b => {
                b.classList.remove('active');
            });
            filterBtn.classList.add('active');
            
            // Filter gallery items
            const items = document.querySelectorAll('.gallery-item');
            let visibleCount = 0;
            
            items.forEach(item => {
                const itemType = item.getAttribute('data-type');
                let shouldShow = false;
                
                switch(filterValue) {
                    case 'all':
                        shouldShow = true;
                        break;
                    case 'session':
                        shouldShow = itemType === 'photo' || itemType === 'session';
                        break;
                    case 'field':
                        shouldShow = item.getAttribute('data-category') === 'field';
                        break;
                    case 'presentation':
                        shouldShow = itemType === 'presentation';
                        break;
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
        });
    });
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Filter buttons
    document.getElementById('applyFilters')?.addEventListener('click', applyFilters);
    document.getElementById('resetFilters')?.addEventListener('click', resetFilters);
    document.getElementById('exportData')?.addEventListener('click', exportData);
    
    // Filter inputs
    document.getElementById('cityFilter')?.addEventListener('change', applyFilters);
    document.getElementById('dateFrom')?.addEventListener('change', applyFilters);
    document.getElementById('dateTo')?.addEventListener('change', applyFilters);
    document.getElementById('searchInput')?.addEventListener('input', applyFilters);
    
    // Gallery filters
    setupGalleryFilters();
    
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
    
    // Footer links
    document.getElementById('helpSupport')?.addEventListener('click', (e) => {
        e.preventDefault();
        alert('Help & Support:\n\nEmail: support@interactsolutions.com\nPhone: +92 300 123 4567');
    });
    
    document.getElementById('exportInsights')?.addEventListener('click', (e) => {
        e.preventDefault();
        exportData();
    });
}

// ===== STUB FUNCTIONS =====
function showSessionModal(sessionId) {
    console.log('Show session modal:', sessionId);
    alert(`Session ${sessionId} details would show here in a modal.`);
}

function openMediaViewer(index) {
    const media = sessionMediaItems[index];
    alert(`Opening media viewer for: ${media.caption || 'Session Media'}`);
}

function exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allSessions, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "buctril_sessions_data.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    alert('Data exported successfully!');
}

function fitMapBounds() {
    if (map && currentFilteredSessions.length > 0) {
        const bounds = L.latLngBounds(
            currentFilteredSessions
                .filter(s => s.latitude && s.longitude)
                .map(s => [s.latitude, s.longitude])
        );
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

console.log('AgriVista Dashboard v2.0 - Professional Layout loaded successfully.');
