// dashboard.js - ENHANCED VERSION v2.3
console.log('AgriVista Dashboard v2.3 initializing...');

// GLOBAL STATE
let allSessions = [];
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
}

// ===== 1. VISITOR COUNTER =====
function initializeVisitorCounter() {
    // Get existing count from localStorage or start at 0
    visitorCount = localStorage.getItem('wheatCampaignVisitors') || 0;
    visitorCount = parseInt(visitorCount);
    
    // Increment counter (only counts unique sessions)
    if (!sessionStorage.getItem('hasVisited')) {
        visitorCount++;
        localStorage.setItem('wheatCampaignVisitors', visitorCount);
        sessionStorage.setItem('hasVisited', 'true');
    }
    
    // Update counter display
    updateVisitorCounter();
    
    // Update counter every hour to show activity
    setInterval(updateVisitorCounter, 3600000);
}

function updateVisitorCounter() {
    const counterElement = document.getElementById('visitorCounter');
    if (!counterElement) {
        // Create counter element if it doesn't exist
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
            elements.loadingOverlay.classList.remove('hidden');
        } else {
            setTimeout(() => {
                elements.loadingOverlay.classList.add('hidden');
            }, 500);
        }
    }
}

// ===== 3. IMAGE LOADING ANIMATIONS =====
function initializeImageLoading() {
    // This will be implemented in the renderGallery function
}

// ===== 4. FEEDBACK SYSTEM =====
function initializeFeedbackSystem() {
    // Add feedback button to footer
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
    
    // Initialize feedback modal controls
    document.getElementById('feedbackCancel')?.addEventListener('click', hideFeedbackModal);
    document.querySelector('#feedbackModal .modal-close')?.addEventListener('click', hideFeedbackModal);
    document.getElementById('feedbackSubmit')?.addEventListener('click', submitFeedback);
    
    // Form submission
    document.getElementById('feedbackForm')?.addEventListener('submit', function(e) {
        e.preventDefault();
        submitFeedback();
    });
}

function showFeedbackModal() {
    document.getElementById('feedbackModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function hideFeedbackModal() {
    document.getElementById('feedbackModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function submitFeedback() {
    const name = document.getElementById('feedbackName').value.trim();
    const phone = document.getElementById('feedbackPhone').value.trim();
    const email = document.getElementById('feedbackEmail').value.trim();
    const type = document.getElementById('feedbackType').value;
    const message = document.getElementById('feedbackMessage').value.trim();
    
    const contactMethods = Array.from(document.querySelectorAll('input[name="contactMethod"]:checked'))
        .map(cb => cb.value);
    
    if (!name || !message) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    // Prepare feedback data
    const feedback = {
        name,
        phone,
        email,
        type,
        message,
        contactMethods,
        timestamp: new Date().toISOString(),
        pageUrl: window.location.href,
        visitorCount
    };
    
    // Save to localStorage for demo purposes
    try {
        const feedbacks = JSON.parse(localStorage.getItem('campaignFeedbacks') || '[]');
        feedbacks.push(feedback);
        localStorage.setItem('campaignFeedbacks', JSON.stringify(feedbacks));
        
        // Prepare WhatsApp message
        let whatsappMessage = `*New Feedback - Buctril Super Campaign*\n\n`;
        whatsappMessage += `*Name:* ${name}\n`;
        if (phone) whatsappMessage += `*Phone:* ${phone}\n`;
        if (email) whatsappMessage += `*Email:* ${email}\n`;
        whatsappMessage += `*Type:* ${type}\n`;
        whatsappMessage += `*Message:* ${message}\n`;
        whatsappMessage += `*Contact via:* ${contactMethods.join(', ') || 'None specified'}\n`;
        whatsappMessage += `\n_Submitted via AgriVista Dashboard_`;
        
        // Create WhatsApp link
        const whatsappLink = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;
        
        // Show success
        hideFeedbackModal();
        showToast('Feedback submitted successfully!', 'success');
        
        // Offer WhatsApp option
        setTimeout(() => {
            if (confirm('Would you like to share this feedback via WhatsApp?')) {
                window.open(whatsappLink, '_blank');
            }
        }, 1000);
        
        // Clear form
        document.getElementById('feedbackForm').reset();
        
    } catch (error) {
        console.error('Feedback save error:', error);
        showToast('Error saving feedback. Please try again.', 'error');
    }
}

// ===== 5. SOCIAL SHARING =====
function initializeSocialSharing() {
    // Add share button to footer
    const footerLinks = document.querySelector('.footer-links');
    if (footerLinks) {
        const shareLink = document.createElement('a');
        shareLink.href = '#';
        shareLink.id = 'shareDashboardBtn';
        shareLink.innerHTML = '<i class="fas fa-share-alt"></i> Share Dashboard';
        footerLinks.appendChild(shareLink);
        
        shareLink.addEventListener('click', function(e) {
            e.preventDefault();
            showShareModal();
        });
    }
    
    // Initialize share modal
    document.querySelector('#shareModal .modal-close')?.addEventListener('click', hideShareModal);
    document.getElementById('copyUrlBtn')?.addEventListener('click', copyShareUrl);
    
    // Share option buttons
    document.querySelectorAll('.share-option').forEach(button => {
        button.addEventListener('click', function() {
            const platform = this.dataset.platform;
            shareToPlatform(platform);
        });
    });
}

function showShareModal(customText = null, customUrl = null) {
    const shareText = customText || 'Check out the Buctril Super Farmer Education Drive 2025 Dashboard! Track 40 sessions across 17 cities with detailed analytics and media gallery.';
    const shareUrl = customUrl || window.location.href;
    
    // Store for sharing
    window.shareData = { text: shareText, url: shareUrl };
    
    // Update URL field
    document.getElementById('shareUrl').value = shareUrl;
    
    // Show modal
    document.getElementById('shareModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function hideShareModal() {
    document.getElementById('shareModal').style.display = 'none';
    document.body.style.overflow = 'auto';
}

function copyShareUrl() {
    const urlInput = document.getElementById('shareUrl');
    urlInput.select();
    urlInput.setSelectionRange(0, 99999);
    
    try {
        navigator.clipboard.writeText(urlInput.value);
        showToast('Link copied to clipboard!', 'success');
    } catch (err) {
        // Fallback for older browsers
        document.execCommand('copy');
        showToast('Link copied to clipboard!', 'success');
    }
}

function shareToPlatform(platform) {
    const { text, url } = window.shareData || {
        text: 'Check out the Buctril Super Campaign Dashboard!',
        url: window.location.href
    };
    
    let shareUrl;
    
    switch (platform) {
        case 'whatsapp':
            shareUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`;
            break;
        case 'facebook':
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
            break;
        case 'twitter':
            shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
            break;
        case 'linkedin':
            shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
            break;
        case 'email':
            shareUrl = `mailto:?subject=Buctril Super Campaign Dashboard&body=${encodeURIComponent(text + '\n\n' + url)}`;
            break;
        case 'copy':
            copyShareUrl();
            return;
        default:
            return;
    }
    
    if (platform === 'email') {
        window.location.href = shareUrl;
    } else {
        window.open(shareUrl, '_blank', 'width=600,height=400');
    }
    
    hideShareModal();
}

// ===== 6. TOAST NOTIFICATIONS =====
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = type === 'success' ? 'fa-check-circle' : 
                type === 'error' ? 'fa-exclamation-circle' : 
                'fa-info-circle';
    
    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;
    
    document.getElementById('toastContainer').appendChild(toast);
    
    // Show toast
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// ===== CORE DASHBOARD FUNCTIONS =====

// LOAD ALL JSON DATA
async function loadAllData() {
    try {
        updateStatus('Loading sessions data...', 'loading');
        
        // 1. LOAD SESSIONS DATA
        console.log('Loading sessions.json...');
        const sessionsResponse = await fetch('sessions.json');
        if (!sessionsResponse.ok) {
            throw new Error(`Failed to load sessions.json: ${sessionsResponse.status}`);
        }
        const sessionsData = await sessionsResponse.json();
        allSessions = sessionsData.sessions || [];
        currentFilteredSessions = [...allSessions];
        console.log(`Loaded ${allSessions.length} sessions`);
        
        // 2. LOAD MEDIA DATA
        updateStatus('Loading media gallery...', 'loading');
        try {
            const mediaResponse = await fetch('media.json');
            if (mediaResponse.ok) {
                const mediaData = await mediaResponse.json();
                mediaItems = mediaData.mediaItems || [];
                console.log(`Loaded ${mediaItems.length} media items`);
            } else {
                console.warn('media.json not found or error');
                mediaItems = createFallbackMedia();
            }
        } catch (mediaError) {
            console.warn('Media load error:', mediaError);
            mediaItems = createFallbackMedia();
        }

        // 3. UPDATE DASHBOARD
        updateStatus('Rendering dashboard...', 'loading');
        updateDashboardStats();
        initializeMap();
        renderGallery();
        renderSessionsTable();
        
        updateStatus('Dashboard loaded successfully', 'success');
        console.log('Dashboard initialization complete.');
        
        // Hide loading overlay
        showLoading(false);

    } catch (error) {
        console.error('Fatal error loading data:', error);
        showError(`Data load error: ${error.message}. Check console.`);
        updateStatus('Data load failed', 'error');
        
        // Load fallback data
        allSessions = createFallbackSessions();
        currentFilteredSessions = [...allSessions];
        mediaItems = createFallbackMedia();
        updateDashboardStats();
        renderSessionsTable();
        renderGallery();
        showLoading(false);
    }
}

// CREATE FALLBACK SESSIONS
function createFallbackSessions() {
    console.log('Creating fallback session data');
    return Array.from({ length: 40 }, (_, i) => {
        const cities = ['sukkur', 'dgk', 'faisalabad', 'gujranwala'];
        const cityNames = ['Sukkur', 'Dera Ghazi Khan', 'Faisalabad', 'Gujranwala'];
        const cityCodes = ['SKR', 'DGK', 'FSD', 'GSM'];
        const cityIndex = Math.floor(i / 10);
        
        return {
            id: i + 1,
            sessionNumber: `${cityCodes[cityIndex]}-${(i % 10) + 1}`,
            city: cities[cityIndex],
            cityName: cityNames[cityIndex],
            spot: `Location ${i + 1}`,
            date: `2025-11-${24 + (i % 10)}`,
            day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i % 7],
            farmers: Math.floor(Math.random() * 50) + 50,
            acres: Math.floor(Math.random() * 500) + 500,
            latitude: 27 + Math.random() * 5,
            longitude: 68 + Math.random() * 5,
            facilitator: `Facilitator ${i + 1}`,
            focus: ['Product Introduction', 'Application Training', 'Safety Demo', 'Field Practice'][i % 4],
            type: ['education', 'demonstration', 'training', 'field'][i % 4]
        };
    });
}

// CREATE FALLBACK MEDIA
function createFallbackMedia() {
    console.log('Creating fallback media with local paths');
    const cities = ['sukkur', 'dgk', 'faisalabad', 'gujranwala'];
    const types = ['education', 'demonstration', 'training', 'safety'];
    
    return Array.from({ length: 12 }, (_, i) => {
        const city = cities[i % 4];
        const cityColors = { 
            sukkur: '#2e7d32', 
            dgk: '#ff9800', 
            faisalabad: '#2196f3', 
            gujranwala: '#9c27b0' 
        };
        const color = cityColors[city] || '#2e7d32';
        const colorHex = color.replace('#', '');
        
        return {
            id: i + 1,
            filename: `gallery/${(i % 10) + 1}.jpeg`,
            fallback: `https://via.placeholder.com/400x300/${colorHex}/ffffff?text=${city.toUpperCase()}+Session`,
            caption: `Campaign Session ${i + 1}: ${types[i % types.length]}`,
            date: `2025-11-${24 + (i % 10)}`,
            city: city,
            sessionId: (i % 40) + 1,
            type: types[i % types.length],
            displayIn: 'gallery'
        };
    });
}

// UPDATE DASHBOARD STATS
function updateDashboardStats() {
    const totalSessions = currentFilteredSessions.length;
    const totalFarmers = currentFilteredSessions.reduce((sum, s) => sum + (s.farmers || 0), 0);
    const totalAcres = currentFilteredSessions.reduce((sum, s) => sum + (s.acres || 0), 0);
    const uniqueCities = [...new Set(currentFilteredSessions.map(s => s.cityName))].length;

    // Update all stats
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
        elements.mapStats.textContent = `${totalSessions} Sessions • ${uniqueCities} Cities • ${totalFarmers.toLocaleString()} Farmers`;
    }
}

// INITIALIZE MAP
function initializeMap() {
    console.log('Initializing map...');
    const mapContainer = document.getElementById('campaignMap');
    if (!mapContainer) {
        console.error('Map container not found!');
        return;
    }

    try {
        // Create map
        map = L.map('campaignMap').setView([30.3753, 69.3451], 6);

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 12
        }).addTo(map);

        // Create marker cluster
        markerCluster = L.markerClusterGroup({
            maxClusterRadius: 50,
            showCoverageOnHover: false
        });
        map.addLayer(markerCluster);

        // Add markers
        updateMapMarkers();

        console.log('Map initialized successfully');

    } catch (error) {
        console.error('Map error:', error);
        mapContainer.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; background:#f8f9fa; color:#666; padding:20px; text-align:center;">
                <i class="fas fa-map-marked-alt" style="font-size:48px; color:#ccc; margin-bottom:16px;"></i>
                <p>Interactive map loading...</p>
                <button onclick="location.reload()" class="btn btn-primary" style="margin-top:10px;">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
    }
}

// RENDER GALLERY WITH LOADING ANIMATIONS
function renderGallery() {
    console.log('Rendering gallery...');
    const container = elements.mediaGallery;
    if (!container) return;

    // Filter gallery items
    const galleryMedia = mediaItems.filter(item => item.displayIn === 'gallery');
    
    if (galleryMedia.length === 0) {
        container.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:40px; color:#666;">
                <i class="fas fa-images" style="font-size:48px; margin-bottom:16px; color:#ccc;"></i>
                <p>No gallery images available.</p>
                <p style="font-size:0.9em; color:#999;">Check media.json and gallery/ folder</p>
            </div>
        `;
        return;
    }

    // Clear and render
    container.innerHTML = '';
    const itemsToShow = galleryMedia.slice(0, 12); // Limit for performance
    
    itemsToShow.forEach(media => {
        const item = document.createElement('div');
        item.className = 'gallery-item loading';
        item.setAttribute('data-city', media.city);
        item.setAttribute('data-type', media.type);
        
        // City colors for fallback
        const cityColors = { 
            sukkur: '#2e7d32', 
            dgk: '#ff9800', 
            faisalabad: '#2196f3', 
            gujranwala: '#9c27b0' 
        };
        const color = cityColors[media.city] || '#2e7d32';
        const colorHex = color.replace('#', '');
        
        // Use local file with fallback
        const imgSrc = media.filename || media.fallback || 
                      `https://via.placeholder.com/400x300/${colorHex}/ffffff?text=${media.city}`;
        
        item.innerHTML = `
            <div class="image-loading"></div>
            <img src="${imgSrc}" alt="${media.caption}" 
                 onload="this.parentElement.classList.remove('loading'); this.parentElement.classList.add('loaded')"
                 onerror="this.onerror=null; this.src='https://via.placeholder.com/400x300/${colorHex}/ffffff?text=${media.city}'; this.parentElement.classList.remove('loading'); this.parentElement.classList.add('loaded')">
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
    });
}

// RENDER SESSIONS TABLE WITH CLICK HANDLERS
function renderSessionsTable() {
    console.log('Rendering sessions table...');
    const tbody = elements.sessionsTableBody;
    if (!tbody) return;

    if (currentFilteredSessions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align:center; padding:40px; color:#666;">
                    <i class="fas fa-inbox" style="font-size:48px; margin-bottom:16px; color:#ccc; display:block;"></i>
                    <p>No session data available.</p>
                    <p style="font-size:0.9em; color:#999;">Check sessions.json file</p>
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
        row.dataset.sessionId = session.id;
        row.innerHTML = `
            <td class="session-number">${session.sessionNumber || 'N/A'}</td>
            <td>${session.date || 'N/A'}</td>
            <td class="session-city">${session.cityName || 'N/A'}</td>
            <td class="session-spot" title="${session.spot || ''}">${session.spot || 'N/A'}</td>
            <td>${session.facilitator || 'N/A'}</td>
            <td class="session-stats">${session.farmers || 0}</td>
            <td class="session-stats">${(session.acres || 0).toLocaleString()}</td>
            <td>${session.focus || 'General Education'}</td>
        `;
        tbody.appendChild(row);
    });
    
    // Update pagination
    updatePaginationControls();
}

// UPDATE PAGINATION CONTROLS
function updatePaginationControls() {
    const totalPages = Math.ceil(currentFilteredSessions.length / itemsPerPage);
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    
    if (elements.shownSessions) {
        const startIndex = (currentPage - 1) * itemsPerPage + 1;
        const endIndex = Math.min(currentPage * itemsPerPage, currentFilteredSessions.length);
        elements.shownSessions.textContent = `${startIndex}-${endIndex}`;
    }
}

// ===== 7. SESSION DETAIL VIEW =====
function initializeSessionDetails() {
    // Add click handler to table body
    const tableBody = document.getElementById('sessionsTableBody');
    if (tableBody) {
        tableBody.addEventListener('click', function(e) {
            const row = e.target.closest('tr');
            if (row && row.dataset.sessionId) {
                const sessionId = parseInt(row.dataset.sessionId);
                const session = allSessions.find(s => s.id === sessionId);
                if (session) {
                    showSessionDetail(session);
                }
            }
        });
    }
    
    // Initialize session modal controls
    document.getElementById('modalCloseBtn')?.addEventListener('click', hideSessionDetail);
    document.querySelector('#sessionModal .modal-close')?.addEventListener('click', hideSessionDetail);
    document.getElementById('modalShareBtn')?.addEventListener('click', shareSessionDetails);
    
    // Close modal on ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideSessionDetail();
            hideFeedbackModal();
            hideShareModal();
        }
    });
    
    // Close modal on background click
    document.getElementById('sessionModal')?.addEventListener('click', function(e) {
        if (e.target === this) {
            hideSessionDetail();
        }
    });
}

function showSessionDetail(session) {
    console.log('Showing session details:', session);
    
    // Update modal content
    document.getElementById('modalSessionTitle').textContent = `${session.sessionNumber}: ${session.focus}`;
    document.getElementById('modalSessionId').textContent = session.sessionNumber;
    document.getElementById('modalSessionDate').textContent = `${session.date} (${session.day})`;
    document.getElementById('modalSessionCity').textContent = session.cityName;
    document.getElementById('modalSessionLocation').textContent = session.spot;
    document.getElementById('modalSessionFacilitator').textContent = session.facilitator;
    document.getElementById('modalSessionFarmers').textContent = session.farmers;
    document.getElementById('modalSessionAcres').textContent = session.acres.toLocaleString();
    document.getElementById('modalSessionFocus').textContent = session.type;
    
    // Load session media
    loadSessionMedia(session.id);
    
    // Initialize map for this session
    initializeSessionMap(session);
    
    // Show modal
    document.getElementById('sessionModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Store current session for sharing
    window.currentSession = session;
}

function hideSessionDetail() {
    document.getElementById('sessionModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    
    // Clean up map
    if (sessionDetailMap) {
        sessionDetailMap.remove();
        sessionDetailMap = null;
    }
}

function initializeSessionMap(session) {
    const mapContainer = document.getElementById('modalMap');
    if (!mapContainer) return;
    
    // Clear existing content
    mapContainer.innerHTML = '';
    
    if (session.latitude && session.longitude) {
        try {
            // Create mini map
            sessionDetailMap = L.map('modalMap').setView([session.latitude, session.longitude], 12);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap',
                maxZoom: 15
            }).addTo(sessionDetailMap);
            
            // Add marker
            L.marker([session.latitude, session.longitude])
                .bindPopup(`<b>${session.sessionNumber}</b><br>${session.spot}`)
                .addTo(sessionDetailMap)
                .openPopup();
                
        } catch (error) {
            console.error('Map error:', error);
            mapContainer.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#666;">
                    <i class="fas fa-map-marked-alt" style="font-size:48px; opacity:0.3;"></i>
                    <p style="margin-top:10px;">Map unavailable</p>
                </div>
            `;
        }
    } else {
        mapContainer.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#666;">
                <i class="fas fa-map-marked-alt" style="font-size:48px; opacity:0.3;"></i>
                <p style="margin-top:10px;">Location data not available</p>
            </div>
        `;
    }
}

function loadSessionMedia(sessionId) {
    const mediaGallery = document.getElementById('modalMediaGallery');
    if (!mediaGallery) return;
    
    // Filter media for this session
    const sessionMedia = mediaItems.filter(item => 
        item.sessionId === sessionId && item.displayIn === 'gallery'
    );
    
    if (sessionMedia.length === 0) {
        mediaGallery.innerHTML = `
            <div style="text-align:center; padding:20px; color:#666;">
                <i class="fas fa-images" style="font-size:32px; opacity:0.3;"></i>
                <p>No media available for this session</p>
            </div>
        `;
        return;
    }
    
    // Display first 6 media items
    mediaGallery.innerHTML = '';
    const itemsToShow = sessionMedia.slice(0, 6);
    
    itemsToShow.forEach(media => {
        const img = document.createElement('img');
        img.src = media.filename;
        img.alt = media.caption;
        img.title = media.caption;
        img.addEventListener('click', () => {
            // Open image in new tab
            window.open(media.filename, '_blank');
        });
        mediaGallery.appendChild(img);
    });
}

function shareSessionDetails() {
    if (!window.currentSession) return;
    
    const session = window.currentSession;
    const text = `Check out ${session.sessionNumber} from Buctril Super Campaign: ${session.focus} in ${session.cityName} on ${session.date}. ${session.farmers} farmers attended!`;
    const url = window.location.href;
    
    // Open share modal
    showShareModal(text, url);
}

// SETUP EVENT LISTENERS
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Initialize session details
    initializeSessionDetails();
    
    // Apply Filters
    const applyBtn = document.getElementById('applyFilters');
    if (applyBtn) applyBtn.addEventListener('click', applyFilters);
    
    // Reset Filters
    const resetBtn = document.getElementById('resetFilters');
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);
    
    // Export Data
    const exportBtn = document.getElementById('exportData');
    if (exportBtn) exportBtn.addEventListener('click', exportToCSV);
    
    // City Filter
    const cityFilter = document.getElementById('cityFilter');
    if (cityFilter) cityFilter.addEventListener('change', applyFilters);
    
    // Date Filters
    const dateFrom = document.getElementById('dateFrom');
    const dateTo = document.getElementById('dateTo');
    if (dateFrom) dateFrom.addEventListener('change', applyFilters);
    if (dateTo) dateTo.addEventListener('change', applyFilters);
    
    // Search Input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => applyFilters(), 300);
        });
    }
    
    // High Attendance Filter
    const highAttendanceBtn = document.getElementById('filterHighAttendance');
    if (highAttendanceBtn) {
        highAttendanceBtn.addEventListener('click', function() {
            currentFilteredSessions = allSessions.filter(s => s.farmers >= 80);
            currentPage = 1;
            updateDashboardStats();
            renderSessionsTable();
            updateMapMarkers();
            updateStatus(`${currentFilteredSessions.length} high-attendance sessions`, 'success');
        });
    }
    
    // Recent Filter
    const recentBtn = document.getElementById('filterRecent');
    if (recentBtn) {
        recentBtn.addEventListener('click', function() {
            const today = new Date();
            const lastWeek = new Date(today);
            lastWeek.setDate(today.getDate() - 7);
            
            document.getElementById('dateFrom').value = lastWeek.toISOString().split('T')[0];
            document.getElementById('dateTo').value = today.toISOString().split('T')[0];
            applyFilters();
        });
    }
    
    // Refresh Data
    const refreshBtn = document.getElementById('refreshData');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => location.reload());
    }
    
    // Pagination buttons
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
}

// APPLY FILTERS
function applyFilters() {
    console.log('Applying filters...');
    const cityValue = document.getElementById('cityFilter').value;
    const searchValue = document.getElementById('searchInput').value.toLowerCase();
    const dateFromValue = document.getElementById('dateFrom').value;
    const dateToValue = document.getElementById('dateTo').value;
    
    currentFilteredSessions = allSessions.filter(session => {
        // City filter
        if (cityValue !== 'all' && session.city !== cityValue) return false;
        
        // Search filter
        if (searchValue) {
            const searchable = `${session.sessionNumber || ''} ${session.cityName || ''} ${session.spot || ''} ${session.facilitator || ''} ${session.focus || ''}`.toLowerCase();
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
    
    updateStatus(`${currentFilteredSessions.length} sessions found`, 'success');
}

// UPDATE MAP MARKERS
function updateMapMarkers() {
    if (!markerCluster || !map) return;
    
    markerCluster.clearLayers();
    
    currentFilteredSessions.forEach(session => {
        if (session.latitude && session.longitude) {
            const marker = L.marker([session.latitude, session.longitude]);
            
            const popupContent = `
                <div style="min-width: 200px;">
                    <h4 style="margin:0 0 8px 0; color: #2e7d32;">${session.sessionNumber || 'Session'}</h4>
                    <p style="margin:4px 0;"><strong>Location:</strong> ${session.spot || 'N/A'}</p>
                    <p style="margin:4px 0;"><strong>Date:</strong> ${session.date || 'N/A'}</p>
                    <p style="margin:4px 0;"><strong>Farmers:</strong> ${session.farmers || 0}</p>
                    <p style="margin:4px 0;"><strong>Facilitator:</strong> ${session.facilitator || 'N/A'}</p>
                </div>
            `;
            
            marker.bindPopup(popupContent);
            markerCluster.addLayer(marker);
        }
    });
    
    // Fit bounds if we have markers
    if (currentFilteredSessions.length > 0 && currentFilteredSessions[0].latitude) {
        const bounds = L.latLngBounds(currentFilteredSessions.map(s => [s.latitude, s.longitude]));
        map.fitBounds(bounds, { padding: [50, 50] });
    }
    
    // Update map stats
    if (elements.mapStats) {
        const uniqueCities = [...new Set(currentFilteredSessions.map(s => s.cityName))].length;
        const totalFarmers = currentFilteredSessions.reduce((sum, s) => sum + (s.farmers || 0), 0);
        elements.mapStats.textContent = `${currentFilteredSessions.length} Sessions • ${uniqueCities} Cities • ${totalFarmers.toLocaleString()} Farmers`;
    }
}

// RESET FILTERS
function resetFilters() {
    console.log('Resetting filters...');
    
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
    
    // Reset map view
    if (map && allSessions.length > 0 && allSessions[0].latitude) {
        const bounds = L.latLngBounds(allSessions.map(s => [s.latitude, s.longitude]));
        map.fitBounds(bounds, { padding: [50, 50] });
    }
    
    updateStatus('All filters reset', 'success');
}

// EXPORT TO CSV
function exportToCSV() {
    if (currentFilteredSessions.length === 0) {
        showToast('No data to export. Please adjust your filters.', 'error');
        return;
    }
    
    try {
        const headers = ['Session ID', 'City', 'Location', 'Date', 'Farmers', 'Acres', 'Facilitator', 'Focus'];
        const csvRows = [
            headers.join(','),
            ...currentFilteredSessions.map(s => [
                s.sessionNumber || '',
                s.cityName || '',
                `"${s.spot || ''}"`,
                s.date || '',
                s.farmers || 0,
                s.acres || 0,
                `"${s.facilitator || ''}"`,
                `"${s.focus || ''}"`
            ].join(','))
        ];
        
        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = `agrivista-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast(`Exported ${currentFilteredSessions.length} sessions to CSV`, 'success');
        updateStatus(`Exported ${currentFilteredSessions.length} sessions`, 'success');
    } catch (error) {
        console.error('Export failed:', error);
        showToast('Failed to export data. Please try again.', 'error');
    }
}

// TAB SWITCHING
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
                setTimeout(() => map.invalidateSize(), 100);
            }
        });
    });
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

console.log('AgriVista Dashboard v2.3 enhanced version loaded.');
