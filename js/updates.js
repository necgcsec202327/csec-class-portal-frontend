document.addEventListener('DOMContentLoaded', () => {
    const allAnnouncementsList = document.getElementById('all-announcements-list');
    const searchBar = document.getElementById('search-bar');
    let allAnnouncements = [];

    const showEmptyState = (container, message, icon) => {
        container.innerHTML = `<div class="empty-state"><i class="fa-solid ${icon}"></i><p>${message}</p></div>`;
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

    showSkeletonLoader(allAnnouncementsList, 5);

    fetch('data/announcements.json')
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            allAnnouncements = data;
            if (data.length === 0) {
                showEmptyState(allAnnouncementsList, 'No announcements yet.', 'fa-bell-slash');
            } else {
                displayAnnouncements(allAnnouncements);
            }
        })
        .catch(error => {
            console.error('Error fetching announcements:', error);
            showEmptyState(allAnnouncementsList, 'Could not load announcements.', 'fa-circle-exclamation');
        });

    function displayAnnouncements(announcements) {
        allAnnouncementsList.innerHTML = '';
        if (announcements.length === 0) {
            showEmptyState(allAnnouncementsList, 'No announcements match your search.', 'fa-magnifying-glass');
            return;
        }
        announcements.forEach((announcement, index) => {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.animationDelay = `${index * 0.05}s`;
            card.innerHTML = `
                <h3>${announcement.title}</h3>
                <p class="date">${announcement.date}</p>
                <p>${announcement.description}</p>
            `;
            allAnnouncementsList.appendChild(card);
        });
    }

    searchBar.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredAnnouncements = allAnnouncements.filter(announcement => {
            return announcement.title.toLowerCase().includes(searchTerm) ||
                   announcement.description.toLowerCase().includes(searchTerm);
        });
        displayAnnouncements(filteredAnnouncements);
    });
});
