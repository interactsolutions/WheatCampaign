function safeRenderGallery() {
    try {
        const container = elements.mediaGallery;
        if (!container) return;

        // Filter to only gallery items (use correct filter logic)
        const galleryMedia = mediaItems.filter(item => {
            // Check if displayIn exists and includes 'gallery'
            if (item.displayIn && Array.isArray(item.displayIn)) {
                return item.displayIn.includes('gallery');
            }
            return item.displayIn === 'gallery' || 
                   item.category === 'session' || 
                   item.category === 'additional';
        });
        
        // Update gallery count in UI
        updateGalleryCounts(galleryMedia.length);
        
        if (galleryMedia.length === 0) {
            container.innerHTML = `
                <div class="gallery-placeholder">
                    <i class="fas fa-images" style="font-size: 48px; margin-bottom: 16px; color: #ccc;"></i>
                    <p>No gallery media found. Please upload media files to the gallery folder.</p>
                    <small>Expected files: 1.jpeg through 40.jpeg and 1.mp4 through 40.mp4</small>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        
        galleryMedia.forEach((media, index) => {
            const isVideo = media.filename.toLowerCase().endsWith('.mp4') || 
                           media.filename.toLowerCase().endsWith('.webm') ||
                           media.type === 'video';
            const isImage = media.filename.toLowerCase().endsWith('.jpeg') || 
                           media.filename.toLowerCase().endsWith('.jpg') ||
                           media.filename.toLowerCase().endsWith('.png') ||
                           media.type === 'image' || media.type === 'photo';
            
            const item = document.createElement('div');
            item.className = 'gallery-item';
            item.setAttribute('data-id', media.id);
            item.setAttribute('data-index', index);
            
            // Use HTTPS and ensure correct path
            let mediaPath = media.filename;
            if (!mediaPath.startsWith('http')) {
                // Ensure it starts with gallery/ if not already
                if (!mediaPath.startsWith('gallery/') && !mediaPath.startsWith('./')) {
                    mediaPath = 'gallery/' + mediaPath;
                }
            }
            
            // Create the media element
            if (isVideo) {
                item.innerHTML = `
                    <div class="video-wrapper">
                        <video muted playsinline preload="metadata">
                            <source src="${mediaPath}" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>
                        <div class="video-overlay">
                            <i class="fas fa-play-circle"></i>
                        </div>
                    </div>
                    <div class="gallery-caption">
                        <div class="gallery-session">${media.sessionId || ''}</div>
                        <div class="gallery-title">${media.caption || 'Media Item'}</div>
                        <div class="gallery-meta">
                            <span><i class="fas fa-map-marker-alt"></i> ${media.district || ''}</span>
                            <span><i class="fas fa-calendar"></i> ${media.date || ''}</span>
                        </div>
                    </div>
                `;
            } else if (isImage) {
                item.innerHTML = `
                    <img data-src="${mediaPath}" 
                         src="gallery/placeholder.svg"
                         alt="${media.caption || 'Campaign image'}"
                         loading="lazy"
                         onerror="this.src='gallery/placeholder.svg'; this.onerror=null;">
                    <div class="gallery-caption">
                        <div class="gallery-session">${media.sessionId || ''}</div>
                        <div class="gallery-title">${media.caption || 'Media Item'}</div>
                        <div class="gallery-meta">
                            <span><i class="fas fa-map-marker-alt"></i> ${media.district || ''}</span>
                            <span><i class="fas fa-calendar"></i> ${media.date || ''}</span>
                        </div>
                    </div>
                `;
            } else {
                // Fallback for other file types
                item.innerHTML = `
                    <div class="file-placeholder">
                        <i class="fas fa-file"></i>
                        <p>${media.filename.split('/').pop()}</p>
                    </div>
                    <div class="gallery-caption">
                        <div class="gallery-title">${media.caption}</div>
                    </div>
                `;
            }
            
            item.addEventListener('click', () => openMediaViewer(index));
            container.appendChild(item);
        });
        
        // Initialize lazy loading
        initializeLazyLoading();
        
    } catch (error) {
        console.error('Gallery rendering failed:', error);
        if (elements.mediaGallery) {
            elements.mediaGallery.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Gallery failed to load: ${error.message}</p>
                    <button onclick="safeRenderGallery()" class="btn btn-small">Retry</button>
                </div>
            `;
        }
    }
}

function updateGalleryCounts(galleryCount) {
    // Update tab and button counts
    const galleryTab = document.querySelector('[data-tab="gallery"]');
    if (galleryTab) {
        galleryTab.innerHTML = `<i class="fas fa-images"></i> Media Gallery (${galleryCount})`;
    }
    
    const allMediaBtn = document.querySelector('.gallery-filter-btn[data-filter="all"]');
    if (allMediaBtn) {
        allMediaBtn.innerHTML = `<i class="fas fa-th"></i> All Media (${galleryCount})`;
    }
}
