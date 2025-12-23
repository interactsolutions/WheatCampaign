// dashboard.js - COMPLETE UPDATED VERSION v2.4
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

// ===== 4. ADVANCED ANALYTICS =====
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

// ===== 5. FEEDBACK SYSTEM =====
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
    
    document.getElementById('feedbackCancel')?.addEventListener('click', hideFeedbackModal);
    document.querySelector('#feedbackModal .modal-close')?.addEventListener('click', hideFeedbackModal);
    document
