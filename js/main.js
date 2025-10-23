document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const currentTheme = localStorage.getItem('theme');
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    // Mark active nav link
    const markActiveNav = () => {
        const path = location.pathname.split('/').pop() || 'index.html';
        document.querySelectorAll('.nav-links a').forEach(a => {
            const href = a.getAttribute('href');
            if (href === path) {
                a.setAttribute('aria-current', 'page');
                a.classList.add('active');
            } else {
                a.removeAttribute('aria-current');
                a.classList.remove('active');
            }
        });
    };
    markActiveNav();

    if (currentTheme) {
        document.documentElement.setAttribute('data-theme', currentTheme);
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            let theme = document.documentElement.getAttribute('data-theme');
            if (theme === 'dark') {
                theme = 'light';
            } else {
                theme = 'dark';
            }
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
        });
    }

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            const expanded = hamburger.getAttribute('aria-expanded') === 'true';
            hamburger.setAttribute('aria-expanded', (!expanded).toString());
            navLinks.classList.toggle('active');
        });
    }

    // Modal logic
    const modal = document.getElementById('announcement-modal');
    if (modal) {
        const modalTitle = document.getElementById('modal-title');
        const modalDate = document.getElementById('modal-date');
        const modalDescription = document.getElementById('modal-description');
        const closeButton = modal.querySelector('.close-button');

        if(closeButton) {
            closeButton.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }

        window.addEventListener('click', (event) => {
            if (event.target == modal) {
                modal.style.display = 'none';
            }
        });
    }


    // Utility functions
    const showEmptyState = (container, message, icon) => {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid ${icon}"></i>
                <p>${message}</p>
            </div>
        `;
    };

    const showSkeletonLoader = (container, count) => {
        let skeletons = '';
        for (let i = 0; i < count; i++) {
            skeletons += `
                <div class="skeleton-card">
                    <div class="skeleton skeleton-title"></div>
                    <div class="skeleton skeleton-text"></div>
                    <div class="skeleton skeleton-text"></div>
                </div>
            `;
        }
        container.innerHTML = skeletons;
    };

    // Load announcements on the homepage
    const announcementsList = document.getElementById('announcements-list');
    if (announcementsList) {
        showSkeletonLoader(announcementsList, 3);
        fetch('data/announcements.json')
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                announcementsList.innerHTML = '';
                if (data.length === 0) {
                    showEmptyState(announcementsList, 'No announcements yet.', 'fa-bell-slash');
                    return;
                }
                const now = Date.now();
                const isNew = (item) => {
                    // Prefer createdAt if present, else fallback to date (YYYY-MM-DD)
                    let ts = 0;
                    if (item.createdAt) {
                        ts = Date.parse(item.createdAt);
                    } else if (item.date) {
                        ts = Date.parse(item.date);
                    }
                    return ts && (now - ts) <= 72 * 60 * 60 * 1000;
                };

                data.slice(0, 3).forEach((announcement, index) => {
                    const card = document.createElement('div');
                    card.className = 'card announcement-card';
                    card.style.animationDelay = `${index * 0.1}s`;
                    card.innerHTML = `
                        <h3>${announcement.title} ${isNew(announcement) ? '<span class="badge badge-new">New</span>' : ''}</h3>
                        <p class="date">${announcement.date}</p>
                        <p>${announcement.description.substring(0, 100)}...</p>
                    `;
                    card.addEventListener('click', () => {
                        const modal = document.getElementById('announcement-modal');
                        document.getElementById('modal-title').textContent = announcement.title;
                        document.getElementById('modal-date').textContent = announcement.date;
                        document.getElementById('modal-description').textContent = announcement.description;
                        modal.style.display = 'block';
                    });
                    announcementsList.appendChild(card);
                });
            })
            .catch(error => {
                console.error('Error fetching announcements:', error);
                showEmptyState(announcementsList, 'Could not load announcements.', 'fa-circle-exclamation');
            });
    }
});
