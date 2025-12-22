// dashboard.js - Alias file for data_processor.js
// This file redirects to the main JavaScript file

console.log('AgriVista Dashboard loading...');

// Simple redirect to the main JavaScript file
try {
    // Check if data_processor.js is already loaded
    if (typeof initializeDashboard === 'undefined') {
        // Load the main script
        const script = document.createElement('script');
        script.src = 'data_processor.js';
        script.async = true;
        document.head.appendChild(script);
    }
} catch (error) {
    console.error('Error loading dashboard:', error);
}
