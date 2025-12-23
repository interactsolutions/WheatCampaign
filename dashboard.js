// dashboard.js - COMPLETE WORKING VERSION v2.4
console.log('AgriVista Dashboard v2.4 initializing...');

// GLOBAL STATE
let allSessions = [];
let campaignData = {};
let currentFilteredSessions = [];
let mediaItems = [];
let map;
let markerCluster;
let visitorCount = 0;
let sessionDetailMap = null;
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
    showLoading(true);
    updateStatus('Loading dashboard data...', 'loading');
    
    // Hide error banner at start
    if (elements.errorBanner) elements.errorBanner.style.display = 'none';
    
    // Set date max to today
    const today = new Date().toISOString().split('T')[0];
    const dateTo = document.getElementById('dateTo');
    if (dateTo) {
        dateTo.max = today;
        dateTo.value = '2025-12-12'; // Campaign end date
    }
    
    // Load data and initialize
    loadAllData();
    setupEventListeners();
    initializeTabs();
    initializeEnhancedFeatures();
});

// ===== ENHANCED FEATURES INITIALIZATION =====
function initializeEnhancedFeatures() {
    console.log('Initializing enhanced features...');
    
    // Initialize visitor counter
    initializeVisitorCounter();
    
    // Initialize feedback system
    initializeFeedbackSystem();
    
    // Initialize social sharing
    initializeSocialSharing();
    
    // Initialize image loading animations
    initializeImageLoading();
    
    // Initialize advanced analytics
    initializeAdvancedAnalytics();
}

// ===== 1. VISITOR COUNTER =====
function initializeVisitorCounter() {
    visitorCount = localStorage.getItem('wheatCampaignVisitors') || 0;
    visitorCount = parseInt(visitorCount);
    
    if (!sessionStorage.getItem('hasVisited')) {
        visitorCount++;
        localStorage.setItem('wheatCampaignVisitors', visitorCount);
        sessionStorage.setItem('hasVisited', 'true');
    }
    
    updateVisitorCounter();
    setInterval(updateVisitorCounter, 3600000);
}

function updateVisitorCounter() {
    const counterElement = document.getElementById('visitorCounter');
    if (!counterElement) {
        const headerSubtitle = document.querySelector('.header-subtitle');
        if (headerSubtitle) {
            const counter = document.createElement('div');
            counter.id = 'visitorCounter';
            counter.className = 'visitor-counter';
            counter.innerHTML = `<i class="fas fa-eye"></i> ${visitorCount.toLocaleString()} Visitors`;
            headerSubtitle.appendChild(counter);
        }
    } else {
        counterElement.innerHTML = `<i class="fas fa-eye"></i> ${visitorCount.toLocaleString()} Visitors`;
    }
}

// ===== 2. LOADING MANAGEMENT =====
function showLoading(show) {
    if (elements.loadingOverlay) {
        if (show) {
            elements.loadingOverlay.style.display = 'flex';
        } else {
            setTimeout(() => {
                elements.loadingOverlay.style.display = 'none';
            }, 500);
        }
    }
}

// ===== 3. FEEDBACK SYSTEM =====
function initializeFeedbackSystem() {
    const footerLinks = document.querySelector('.footer-links');
    if (footerLinks) {
        const feedbackLink = document.createElement('a');
        feedbackLink.href = '#';
        feedbackLink.id = 'feedbackBtn';
        feedbackLink.innerHTML = '<i class="fas fa-comment-alt"></i> Share Feedback';
        footerLinks.appendChild(feedbackLink);
        
        feedbackLink.addEventListener('click', function(e) {
            e.preventDefault();
            showFeedbackModal();
        });
    }
    
    // Setup feedback modal handlers
    document.getElementById('feedbackCancel')?.addEventListener('click', hideFeedbackModal);
    document.querySelector('#feedbackModal .modal-close')?.addEventListener('click', hideFeedbackModal);
    document.getElementById('feedbackSubmit')?.addEventListener('click', submitFeedback);
}

function showFeedbackModal() {
    const modal = document.getElementById('feedbackModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function hideFeedbackModal() {
    const modal = document.getElementById('feedbackModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

function submitFeedback() {
    const name = document.getElementById('feedbackName').value;
    const email = document.getElementById('feedbackEmail').value;
    const message = document.getElementById('feedbackMessage').value;
    
    if (!name || !message) {
        alert('Please fill in all required fields');
        return;
    }
    
    // In a real app, this would send to a server
    console.log('Feedback submitted:', { name, email, message });
    
    // Show success message
    showToast('Thank you for your feedback!', 'success');
    
    // Reset form and close modal
    document.getElementById('feedbackForm').reset();
    hideFeedbackModal();
}

// ===== 4. SOCIAL SHARING =====
function initializeSocialSharing() {
    const shareBtn = document.getElementById('modalShareBtn');
    if (shareBtn) {
        shareBtn.addEventListener('click', showShareModal);
    }
    
    // Setup share button handlers
    document.querySelectorAll('.share-option').forEach(button => {
        button.addEventListener('click', function() {
            const platform = this.dataset.platform;
            shareToPlatform(platform);
        });
    });
}

function showShareModal() {
    const modal = document.getElementById('shareModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function shareToPlatform(platform) {
    const url = window.location.href;
    const title = 'AgriVista Dashboard - Buctril Super Farmer Education Drive 2025';
    const text = 'Check out this interactive dashboard tracking the Buctril Super Farmer Education Campaign';
    
    switch(platform) {
        case 'whatsapp':
            window.open(`https://wa.me/?text=${encodeURIComponent(title + ': ' + url)}`, '_blank');
            break;
        case 'facebook':
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
            break;
        case 'twitter':
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
            break;
        case 'linkedin':
            window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
            break;
        case 'email':
            window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text + ': ' + url)}`, '_blank');
            break;
        case 'copy':
            navigator.clipboard.writeText(url).then(() => {
                showToast('Link copied to clipboard!', 'success');
            });
            break;
    }
}

// ===== 5. IMAGE LOADING =====
function initializeImageLoading() {
    // Lazy loading for gallery images
    const images = document.querySelectorAll('.gallery-item img');
    images.forEach(img => {
        img.loading = 'lazy';
    });
}

// ===== 6. ADVANCED ANALYTICS =====
function initializeAdvancedAnalytics() {
    setTimeout(() => {
        if (campaignData && campaignData.farmerSegmentation) {
            updateAdvancedAnalytics();
        }
    }, 1000);
}

function updateAdvancedAnalytics() {
    const data = campaignData;
    
    // Update understanding scores
    if (data.understandingScores) {
        const scoresContainer = document.getElementById('understandingScores');
        if (scoresContainer) {
            scoresContainer.innerHTML = `
                <div class="scores-grid">
                    <div class="score-card">
                        <div class="score-value">${data.understandingScores.yieldLoss || 0}</div>
                        <div class="score-label">Yield Loss Understanding</div>
                    </div>
                    <div class="score-card">
                        <div class="score-value">${data.understandingScores.goldenPeriod || 0}</div>
                        <div class="score-label">Golden Period</div>
                    </div>
                    <div class="score-card">
                        <div class="score-value">${data.understandingScores.buctrilBroadleaf || 0}</div>
                        <div class="score-label">Buctril Broadleaf</div>
                    </div>
                    <div class="score-card">
                        <div class="score-value">${data.understandingScores.buctrilAtlantis || 0}</div>
                        <div class="score-label">Buctril+Atlantis</div>
                    </div>
                    <div class="score-card">
                        <div class="score-value">${data.understandingScores.safetyPPE || 0}</div>
                        <div class="score-label">Safety PPE</div>
                    </div>
                    <div class="score-card highlight">
                        <div class="score-value">${data.understandingScores.averageScore || 0}</div>
                        <div class="score-label">Average Score</div>
                    </div>
                </div>
            `;
        }
    }
    
    // Update farmer segmentation
    if (data.farmerSegmentation) {
        const seg = data.farmerSegmentation;
        const total = seg.willDefinitelyUse + seg.maybe + seg.notInterested;
        const segmentationContainer = document.getElementById('farmerSegmentation');
        if (segmentationContainer) {
            segmentationContainer.innerHTML = `
                <div class="segmentation-chart">
                    <div class="segmentation-bar">
                        <div class="segment definite" style="width: ${(seg.willDefinitelyUse / total) * 100}%">
                            <span>Definite: ${seg.willDefinitelyUse} (${Math.round((seg.willDefinitelyUse / total) * 100)}%)</span>
                        </div>
                        <div class="segment maybe" style="width: ${(seg.maybe / total) * 100}%">
                            <span>Maybe: ${seg.maybe} (${Math.round((seg.maybe / total) * 100)}%)</span>
                        </div>
                        <div class="segment not-interested" style="width: ${(seg.notInterested / total) * 100}%">
                            <span>Not Interested: ${seg.notInterested} (${Math.round((seg.notInterested / total) * 100)}%)</span>
                        </div>
                    </div>
                    <div class="segmentation-stats">
                        <div class="seg-stat">
                            <div class="seg-number">${seg.knowBuctril || 0}</div>
                            <div class="seg-label">Know Buctril</div>
                        </div>
                        <div class="seg-stat">
                            <div class="seg-number">${seg.usedLastYear || 0}</div>
                            <div class="seg-label">Used Last Year</div>
                        </div>
                        <div class="seg-stat">
                            <div class="seg-number">${seg.estimatedBuctrilAcres || 0}</div>
                            <div class="seg-label">Est. Buctril Acres</div>
                        </div>
                    </div>
                </div>
            `;
        }
    }
}

// ===== LOAD ALL DATA =====
async function loadAllData() {
    try {
        updateStatus('Loading sessions data...', 'loading');
        
        // Load sessions data
        const sessionsResponse = await fetch('sessions.json');
        if (!sessionsResponse.ok) throw new Error(`Failed to load sessions.json: ${sessionsResponse.status}`);
        campaignData = await sessionsResponse.json();
        allSessions = campaignData.sessions || [];
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
        showLoading(false);
        console.log('Dashboard initialization complete.');

    } catch (error) {
        console.error('Fatal error loading data:', error);
        showError(`Could not load campaign data: ${error.message}. Using sample data.`);
        updateStatus('Using sample data', 'warning');
        
        // Load fallback data
        loadFallbackData();
        showLoading(false);
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

// ===== UPDATE DASHBOARD STATS =====
function updateDashboardStats() {
    const totalSessions = currentFilteredSessions.length;
    const totalFarmers = currentFilteredSessions.reduce((sum, s) => sum + (s.farmers || 0), 0);
    const totalAcres = currentFilteredSessions.reduce((sum, s) => sum + (s.acres || 0), 0);
    const uniqueCities = [...new Set(currentFilteredSessions.map(s => s.cityName))].length;

    // Update all stat elements
    const elementsToUpdate = [
        { el: elements.sessionCount, value: totalSessions },
        { el: elements.farmerCount, value: totalFarmers.toLocaleString() },
        { el: elements.acreCount, value: totalAcres.toLocaleString() },
        { el: elements.cityCount, value: uniqueCities },
        { el: elements.totalSessions, value: totalSessions },
        { el: elements.totalFarmers, value: totalFarmers.toLocaleString() },
        { el: elements.totalAcres, value: totalAcres.toLocaleString() },
        { el: elements.shownSessions, value: Math.min(itemsPerPage, totalSessions) },
        { el: elements.totalSessionsCount, value: totalSessions }
    ];
    
    elementsToUpdate.forEach(({ el, value }) => {
        if (el) el.textContent = value;
    });
    
    // Update map banner
    if (elements.mapStats) {
        elements.mapStats.textContent = `${totalSessions} Sessions • ${uniqueCities} Regions • ${totalFarmers.toLocaleString()} Farmers`;
    }
}

// ===== INITIALIZE MAP =====
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
                    <button onclick="showSessionDetail(${session.id})" style="
                        background: #2e7d32;
                        color: white;
                        border: none;
                        padding: 6px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        margin-top: 8px;
                        font-size: 12px;
                    ">
                        View Details
                    </button>
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
            <button onclick="location.reload()" class="btn btn-primary">
                <i class="fas fa-redo"></i> Reload Page
            </button>
        </div>
    `;
}

// ===== RENDER GALLERY =====
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
                 onerror="this.src='https://via.placeholder.com/400x300/${colorHex}/ffffff?text=${media.city.toUpperCase()}'"
                 loading="lazy">
            <div class="gallery-caption">
                <div class="gallery-city">${media.city.toUpperCase()} • Session ${media.sessionId}</div>
                <div class="gallery-title">${media.caption}</div>
                <div class="gallery-meta">
                    <span><i class="fas fa-calendar"></i> ${media.date}</span>
                    <span><i class="fas fa-tag"></i> ${media.type}</span>
                </div>
            </div>
        `;
        
        // Add click handler for image modal
        item.addEventListener('click', () => showImageModal(media));
        
        container.appendChild(item);
    });
}

function showImageModal(media) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'image-modal';
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
        <button class="modal-close" style="
            position: absolute;
            top: 20px;
            right: 20px;
            background: none;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
            padding: 10px;
            z-index: 10000;
        ">
            <i class="fas fa-times"></i>
        </button>
        <div class="modal-content" style="
            max-width: 90%;
            max-height: 80%;
            display: flex;
            flex-direction: column;
            align-items: center;
        ">
            <img src="${media.filename}" alt="${media.caption}" style="
                max-width: 100%;
                max-height: 70vh;
                object-fit: contain;
                border-radius: 8px;
                margin-bottom: 20px;
            ">
            <div class="modal-caption" style="
                color: white;
                text-align: center;
                max-width: 600px;
                padding: 0 20px;
            ">
                <h3 style="margin-bottom: 10px; color: white;">${media.caption}</h3>
                <div style="color: #ccc; font-size: 14px;">
                    <div><strong>City:</strong> ${media.city}</div>
                    <div><strong>Session:</strong> ${media.sessionId}</div>
                    <div><strong>Date:</strong> ${media.date}</div>
                    <div><strong>Type:</strong> ${media.type}</div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal on button click
    modal.querySelector('.modal-close').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // Close modal on ESC key
    const closeModal = (e) => {
        if (e.key === 'Escape') {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', closeModal);
        }
    };
    document.addEventListener('keydown', closeModal);
    
    // Close modal on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
            document.removeEventListener('keydown', closeModal);
        }
    });
}

// ===== RENDER SESSIONS TABLE =====
function renderSessionsTable() {
    console.log('Rendering sessions table...');
    const tbody = elements.sessionsTableBody;
    if (!tbody) return;

    if (currentFilteredSessions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="loading-cell">
                    <div class="loading">
                        <i class="fas fa-inbox"></i>
                        <p>No session data available.</p>
                    </div>
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
        
        // Determine attendance class
        let attendanceClass = '';
        if (session.farmers >= 80) attendanceClass = 'high-attendance';
        else if (session.farmers >= 60) attendanceClass = 'medium-attendance';
        
        if (attendanceClass) row.classList.add(attendanceClass);
        
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
        
        // Add click handler to show session details
        row.addEventListener('click', function() {
            showSessionDetail(session.id);
        });
        
        tbody.appendChild(row);
    });
    
    // Update pagination controls
    updatePaginationControls();
}

function showSessionDetail(sessionId) {
    const session = allSessions.find(s => s.id === sessionId);
    if (!session) return;
    
    // Update modal content
    document.getElementById('modalSessionTitle').textContent = session.sessionNumber;
    document.getElementById('modalSessionId').textContent = session.sessionNumber;
    document.getElementById('modalSessionDate').textContent = `${session.date} (${session.day})`;
    document.getElementById('modalSessionCity').textContent = session.cityName;
    document.getElementById('modalSessionLocation').textContent = session.spot;
    document.getElementById('modalSessionFacilitator').textContent = session.facilitator;
    document.getElementById('modalSessionFarmers').textContent = session.farmers;
    document.getElementById('modalSessionAcres').textContent = session.acres.toLocaleString();
    document.getElementById('modalSessionFocus').textContent = session.focus;
    
    // Load session media
    const sessionMedia = mediaItems.filter(item => item.sessionId === sessionId);
    const mediaGallery = document.getElementById('modalMediaGallery');
    mediaGallery.innerHTML = sessionMedia.length > 0 
        ? sessionMedia.map(media => `
            <div class="media-item">
                <img src="${media.filename}" alt="${media.caption}">
                <div class="media-caption">${media.caption}</div>
            </div>
        `).join('')
        : '<p>No media available for this session</p>';
    
    // Show modal
    const modal = document.getElementById('sessionModal');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// ===== PAGINATION CONTROLS =====
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
    
    // Update total sessions count
    if (elements.totalSessionsCount) {
        elements.totalSessionsCount.textContent = currentFilteredSessions.length;
    }
}

// ===== ANALYTICS CHARTS =====
function initializeAnalyticsCharts() {
    console.log('Initializing analytics charts...');
    
    // Daily attendance chart
    const attendanceChart = document.getElementById('attendanceChart');
    if (attendanceChart && currentFilteredSessions.length > 0) {
        // Group sessions by date
        const dailyData = {};
        currentFilteredSessions.forEach(session => {
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
            const height = maxFarmers > 0 ? (data.farmers / maxFarmers) * 150 : 0;
            const dateStr = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            return `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%;">
                    <div style="
                        height: ${height}px; 
                        width: 30px; 
                        background: linear-gradient(to top, #2e7d32, #4caf50); 
                        border-radius: 4px 4px 0 0; 
                        position: relative;
                        margin-top: auto;
                    ">
                        <div style="
                            position: absolute; 
                            top: -25px; 
                            left: 0; 
                            right: 0; 
                            font-weight: bold; 
                            color: #2e7d32; 
                            font-size: 12px; 
                            text-align: center;
                        ">
                            ${data.farmers}
                        </div>
                    </div>
                    <div style="
                        margin-top: 10px; 
                        font-size: 11px; 
                        color: #666; 
                        white-space: nowrap;
                        transform: rotate(-45deg);
                        transform-origin: left top;
                    ">
                        ${dateStr}
                    </div>
                </div>
            `;
        }).join('');
        
        // Add container styling
        attendanceChart.style.display = 'flex';
        attendanceChart.style.alignItems = 'flex-end';
        attendanceChart.style.gap = '8px';
        attendanceChart.style.padding = '15px';
        attendanceChart.style.height = '200px';
        attendanceChart.style.borderBottom = '1px solid #eee';
    }
    
    // Update city distribution
    const cityDistribution = document.getElementById('cityDistribution');
    if (cityDistribution) {
        const cities = [...new Set(currentFilteredSessions.map(s => s.cityName))];
        cityDistribution.textContent = cities.length;
    }
}

// ===== EVENT LISTENERS =====
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
    
    // Search Input (with debounce)
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => applyFilters(), 300);
        });
    }
    
    // Attendance Range Slider
    const attendanceRange = document.getElementById('attendanceRange');
    if (attendanceRange) {
        attendanceRange.addEventListener('input', function() {
            const value = this.value;
            document.getElementById('rangeValue').textContent = value === '0' ? 'All farmers' : `${value}+ farmers`;
        });
        attendanceRange.addEventListener('change', applyFilters);
    }
    
    // Map Filter Checkboxes
    document.querySelectorAll('.map-filter').forEach(checkbox => {
        checkbox.addEventListener('change', applyFilters);
    });
    
    // Fit Bounds Button
    const fitBoundsBtn = document.getElementById('fitBounds');
    if (fitBoundsBtn) {
        fitBoundsBtn.addEventListener('click', function() {
            if (currentFilteredSessions.length > 0 && map) {
                const bounds = L.latLngBounds(currentFilteredSessions.map(s => [s.latitude, s.longitude]));
                map.fitBounds(bounds, { padding: [50, 50] });
            }
        });
    }
    
    // Reset Map Button
    const resetMapBtn = document.getElementById('resetMap');
    if (resetMapBtn) {
        resetMapBtn.addEventListener('click', function() {
            if (map) {
                map.setView([30.3753, 69.3451], 6);
            }
        });
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
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    });
    
    // Modal close on background click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    });
    
    // ESC key to close modals
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            });
        }
    });
}

// ===== FILTER FUNCTIONS =====
function applyFilters() {
    console.log('Applying filters...');
    
    // Get filter values
    const cityValue = document.getElementById('cityFilter').value;
    const searchValue = document.getElementById('searchInput').value.toLowerCase();
    const dateFromValue = document.getElementById('dateFrom').value;
    const dateToValue = document.getElementById('dateTo').value;
    const attendanceRange = document.getElementById('attendanceRange')?.value || 0;
    
    // Get map filter checkboxes
    const mapFilters = Array.from(document.querySelectorAll('.map-filter:checked'))
        .map(cb => cb.value);
    
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
        
        // Attendance filter
        if (attendanceRange > 0 && session.farmers < parseInt(attendanceRange)) return false;
        
        // Map type filter
        if (mapFilters.length > 0 && !mapFilters.includes(session.type)) return false;
        
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
    let visibleCount = 0;
    
    galleryItems.forEach(item => {
        const city = item.getAttribute('data-city');
        const type = item.getAttribute('data-type');
        
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
        if (showItem) visibleCount++;
    });
    
    // Show message if no items match filter
    const galleryContainer = document.getElementById('mediaGallery');
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
        if (existingMessage) existingMessage.remove();
        
        noResults.className = 'no-results-message';
        galleryContainer.appendChild(noResults);
    } else {
        // Remove any existing no-results message
        const existingMessage = galleryContainer.querySelector('.no-results-message');
        if (existingMessage) existingMessage.remove();
    }
}

function resetFilters() {
    console.log('Resetting all filters...');
    
    // Reset form values
    document.getElementById('cityFilter').value = 'all';
    document.getElementById('searchInput').value = '';
    document.getElementById('dateFrom').value = '2025-11-24';
    document.getElementById('dateTo').value = '2025-12-12';
    
    // Reset range slider
    const attendanceRange = document.getElementById('attendanceRange');
    if (attendanceRange) {
        attendanceRange.value = 0;
        document.getElementById('rangeValue').textContent = 'All farmers';
    }
    
    // Reset map checkboxes
    document.querySelectorAll('.map-filter').forEach(checkbox => {
        checkbox.checked = true;
    });
    
    // Reset gallery filter
    document.querySelectorAll('.gallery-filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-filter') === 'all') {
            btn.classList.add('active');
        }
    });
    
    // Reset filtered sessions
    currentFilteredSessions = [...allSessions];
    currentPage = 1;
    
    // Update everything
    updateDashboardStats();
    renderSessionsTable();
    updateMapMarkers();
    initializeAnalyticsCharts();
    filterGallery('all');
    
    // Reset map view
    if (map) {
        map.setView([30.3753, 69.3451], 6);
    }
    
    updateStatus('All filters reset', 'success');
}

// ===== EXPORT TO CSV =====
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
        
        // Create filename with timestamp
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `agrivista-export-${timestamp}.csv`;
        
        if (navigator.msSaveBlob) { // IE 10+
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
        
        showToast(`Exported ${currentFilteredSessions.length} sessions to CSV`, 'success');
        
    } catch (error) {
        console.error('Export failed:', error);
        alert('Failed to export data. Please try again.');
    }
}

// ===== TAB SWITCHING =====
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
                    if (currentFilteredSessions.length > 0) {
                        const bounds = L.latLngBounds(currentFilteredSessions.map(s => [s.latitude, s.longitude]));
                        map.fitBounds(bounds, { padding: [50, 50] });
                    }
                }, 100);
            }
        });
    });
}

// ===== UTILITY FUNCTIONS =====
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

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Remove toast after 3 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// Make functions globally available for map popups
window.showSessionDetail = showSessionDetail;

console.log('AgriVista Dashboard v2.4 loaded successfully.');
