// Banner Display System
// Fetches and displays active banners with countdown timers

(function() {
    'use strict';
    
    const API_BASE_URL = window.CONFIG?.API_BASE_URL?.replace('/api', '') || '';
    const DISMISSED_BANNERS_KEY = 'dismissedBanners';
    
    // Get dismissed banners from localStorage
    function getDismissedBanners() {
        try {
            const dismissed = localStorage.getItem(DISMISSED_BANNERS_KEY);
            return dismissed ? JSON.parse(dismissed) : [];
        } catch (error) {
            console.error('Error reading dismissed banners:', error);
            return [];
        }
    }
    
    // Save dismissed banner ID
    function dismissBanner(bannerId) {
        try {
            const dismissed = getDismissedBanners();
            if (!dismissed.includes(bannerId)) {
                dismissed.push(bannerId);
                localStorage.setItem(DISMISSED_BANNERS_KEY, JSON.stringify(dismissed));
            }
        } catch (error) {
            console.error('Error saving dismissed banner:', error);
        }
    }
    
    // Calculate time remaining
    function getTimeRemaining(endDate) {
        const now = new Date();
        const end = new Date(endDate);
        const diff = end - now;
        
        if (diff <= 0) return null;
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        return { days, hours, minutes, seconds, total: diff };
    }
    
    // Format countdown display
    function formatCountdown(timeRemaining) {
        if (!timeRemaining) return '';
        
        const { days, hours, minutes, seconds } = timeRemaining;
        
        let parts = [];
        if (days > 0) parts.push(`${days}d`);
        if (hours > 0 || days > 0) parts.push(`${hours}h`);
        if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
        parts.push(`${seconds}s`);
        
        return parts.join(' ');
    }
    
    // Create banner HTML
    function createBannerElement(banner) {
        const bannerEl = document.createElement('div');
        bannerEl.className = `event-banner ${banner.type}`;
        bannerEl.dataset.bannerId = banner._id;
        
        const timeRemaining = getTimeRemaining(banner.endDate);
        
        let countdownHTML = '';
        if (timeRemaining && timeRemaining.total < 24 * 60 * 60 * 1000) { // Less than 24 hours
            countdownHTML = `
                <div class="banner-countdown" data-end-date="${banner.endDate}">
                    <i class="fa-solid fa-clock"></i>
                    <span class="countdown-text">${formatCountdown(timeRemaining)}</span>
                </div>
            `;
        }
        
        bannerEl.innerHTML = `
            <div class="banner-content">
                <div class="banner-icon">
                    <i class="fa-solid fa-${getBannerIcon(banner.type)}"></i>
                </div>
                <div class="banner-text">
                    <span>${banner.message}</span>
                    ${banner.link ? `<a href="${banner.link}" class="banner-link">${banner.linkText || 'Learn More'} <i class="fa-solid fa-arrow-right"></i></a>` : ''}
                </div>
                ${countdownHTML}
                <button class="banner-close" data-banner-id="${banner._id}" aria-label="Dismiss banner">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>
        `;
        
        return bannerEl;
    }
    
    // Get icon for banner type
    function getBannerIcon(type) {
        const icons = {
            urgent: 'exclamation-triangle',
            important: 'info-circle',
            info: 'info-circle',
            success: 'check-circle'
        };
        return icons[type] || 'info-circle';
    }
    
    // Update countdown timers
    function updateCountdowns() {
        const countdowns = document.querySelectorAll('.banner-countdown');
        
        countdowns.forEach(countdown => {
            const endDate = countdown.dataset.endDate;
            const timeRemaining = getTimeRemaining(endDate);
            
            if (!timeRemaining) {
                // Banner expired, remove it
                const banner = countdown.closest('.event-banner');
                if (banner) {
                    banner.style.animation = 'bannerSlideUp 0.3s ease forwards';
                    setTimeout(() => banner.remove(), 300);
                }
                return;
            }
            
            const countdownText = countdown.querySelector('.countdown-text');
            if (countdownText) {
                countdownText.textContent = formatCountdown(timeRemaining);
            }
        });
    }
    
    // Load and display banners
    async function loadBanners() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/banners?active=true`);
            
            if (!response.ok) {
                console.log('Banner API not available, skipping banners');
                return;
            }
            
            const banners = await response.json();
            const dismissedBanners = getDismissedBanners();
            
            // Filter out dismissed banners
            const activeBanners = banners.filter(banner => !dismissedBanners.includes(banner._id));
            
            if (activeBanners.length === 0) {
                return;
            }
            
            // Get or create banner container
            let container = document.getElementById('banner-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'banner-container';
                
                // Insert after header
                const header = document.querySelector('header');
                if (header && header.nextSibling) {
                    header.parentNode.insertBefore(container, header.nextSibling);
                } else if (header) {
                    header.parentNode.appendChild(container);
                } else {
                    document.body.insertBefore(container, document.body.firstChild);
                }
            }
            
            // Clear existing banners
            container.innerHTML = '';
            
            // Add banners
            activeBanners.forEach(banner => {
                const bannerEl = createBannerElement(banner);
                container.appendChild(bannerEl);
            });
            
            // Add event listeners for dismiss buttons
            container.querySelectorAll('.banner-close').forEach(button => {
                button.addEventListener('click', function() {
                    const bannerId = this.dataset.bannerId;
                    const banner = this.closest('.event-banner');
                    
                    if (banner) {
                        banner.style.animation = 'bannerSlideUp 0.3s ease forwards';
                        setTimeout(() => {
                            banner.remove();
                            dismissBanner(bannerId);
                            
                            // Remove container if no more banners
                            const container = document.getElementById('banner-container');
                            if (container && container.children.length === 0) {
                                container.remove();
                            }
                        }, 300);
                    }
                });
            });
            
            // Start countdown update interval
            setInterval(updateCountdowns, 1000);
            
        } catch (error) {
            console.error('Error loading banners:', error);
        }
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadBanners);
    } else {
        loadBanners();
    }
    
})();
