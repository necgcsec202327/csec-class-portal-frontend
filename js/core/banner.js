document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('banner-container');
  if (!container) return;

  if (!(window.CONFIG && window.API)) return; // config not loaded yet

  try {
    const banners = await window.API.get(window.CONFIG.ENDPOINTS.BANNERS || '/banners?active=true');
    const items = Array.isArray(banners) ? banners : (banners?.items || []);
    if (!items.length) return;

    // Sort by priority desc and filter active
    const now = new Date();
    const active = items.filter(b => b.isActive && new Date(b.startDate) <= now && now <= new Date(b.endDate))
                        .sort((a,b)=> (b.priority||0) - (a.priority||0));
    if (!active.length) return;

    // Render first banner (could expand to carousel)
    const b = active[0];
    const typeClass = `banner-${b.type || 'info'}`;
    container.innerHTML = `
      <div class="site-banner ${typeClass}">
        <div class="container banner-inner">
          <div class="banner-message">${b.message}</div>
          <div class="banner-actions">
            ${b.link ? `<a href="${b.link}" class="button-secondary">${b.linkText || 'Learn more'}</a>` : ''}
            <button class="button-secondary" id="dismiss-banner" aria-label="Dismiss banner"><i class="fa-solid fa-xmark"></i></button>
          </div>
        </div>
      </div>
    `;

    const dismissBtn = document.getElementById('dismiss-banner');
    if (dismissBtn) dismissBtn.addEventListener('click', () => container.innerHTML = '');
  } catch (e) {
    // Silently ignore banner errors
    console.warn('Banner load failed:', e);
  }
});
