// API Configuration for Class Portal
// This configuration supports multiple deployment scenarios:
// 1. Development: Uses localhost backend
// 2. Production: Uses deployed backend URL
// 3. Runtime override: Can be configured via localStorage or URL params

(function() {
    // Default configuration
    const DEFAULT_CONFIG = {
        // Update this URL when you deploy your backend to Render
        API_BASE_URL: 'http://localhost:4000/api', // Change to your Render backend URL in production
        
        // Fallback to local JSON files if API is unavailable
        // Set to false to enforce API-only mode
        USE_FALLBACK: false,
        
        // API endpoints
        ENDPOINTS: {
            AUTH: '/auth/login',
            ANNOUNCEMENTS: '/announcements',
            EVENTS: '/events',
            RESOURCES: '/resources',
            TIMETABLE: '/timetable',
            BANNERS: '/banners?active=true',
            HEALTH: '/health'
        }
    };

    // Runtime configuration override
    function getRuntimeConfig() {
        const config = { ...DEFAULT_CONFIG };
        
        // Check URL parameters for API override
        const urlParams = new URLSearchParams(window.location.search);
        const apiUrl = urlParams.get('api');
        if (apiUrl) {
            config.API_BASE_URL = apiUrl;
            // Store in localStorage for persistence
            localStorage.setItem('API_BASE_URL_OVERRIDE', apiUrl);
        }
        
        // Check localStorage for stored override
        const storedApiUrl = localStorage.getItem('API_BASE_URL_OVERRIDE');
        if (storedApiUrl && !apiUrl) {
            config.API_BASE_URL = storedApiUrl;
        }
        
        // Production environment detection
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            // Updated with your actual Render backend URL
            config.API_BASE_URL = 'https://csec-class-portal-backend.onrender.com/api';
        }
        
        return config;
    }

    // Create global configuration
    window.CONFIG = getRuntimeConfig();
    
    // Utility functions for API calls
    window.API = {
        // Get full URL for endpoint
        url(endpoint) {
            return window.CONFIG.API_BASE_URL + endpoint;
        },
        
        // Make authenticated API call
        async call(endpoint, options = {}) {
            const token = localStorage.getItem('authToken');
            const headers = {
                'Content-Type': 'application/json',
                ...options.headers
            };
            
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }
            const url = this.url(endpoint);
            const method = (options.method || 'GET').toUpperCase();
            try {
                console.debug('[API]', method, url);
            } catch {}

            const response = await fetch(url, {
                ...options,
                headers
            });
            
            if (!response.ok) {
                throw new Error(`API call failed: ${response.status} ${response.statusText}`);
            }
            
            return response.json();
        },
        
        // Fallback to local JSON files
        async fallback(jsonFile) {
            if (!window.CONFIG.USE_FALLBACK) {
                throw new Error('API unavailable and fallback disabled');
            }
            
            const response = await fetch(`data/${jsonFile}`);
            if (!response.ok) {
                throw new Error(`Fallback failed: Could not load ${jsonFile}`);
            }
            return response.json();
        },
        
        // API call with fallback
        async get(endpoint, jsonFile) {
            try {
                return await this.call(endpoint);
            } catch (error) {
                console.warn(`API call to ${endpoint} failed, trying fallback:`, error);
                if (jsonFile) {
                    return await this.fallback(jsonFile);
                }
                throw error;
            }
        }
    };
    
    // Debug information
    console.log('Class Portal API Configuration:', window.CONFIG);
    
})();
