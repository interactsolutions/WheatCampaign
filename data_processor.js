/* Gallery Improvements */
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
}

.gallery-item:hover img {
    transform: scale(1.05);
}

.gallery-item::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(to top, rgba(0,0,0,0.3), transparent);
    opacity: 0;
    transition: opacity 0.3s ease;
}

.gallery-item:hover::after {
    opacity: 1;
}

/* Background video styles */
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
