// Global variables for admin dashboard
let announcementsData = [];
let eventsData = [];
let resourceTree = null;
let resourcePath = [];
let timetableData = { url: '', type: 'image' };

// API Base URL - use config or fallback
const API_BASE_URL = window.CONFIG?.API_BASE_URL?.replace('/api', '') || 'http://localhost:4000';

// Debug: Log configuration on load
console.log('🔧 Admin Dashboard Configuration:', {
    API_BASE_URL,
    fullConfig: window.CONFIG,
    authToken: sessionStorage.getItem('authToken') ? '✅ Present' : '❌ Missing',
    isAdmin: sessionStorage.getItem('isAdmin')
});

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (sessionStorage.getItem('isAdmin') !== 'true') {
        window.location.href = 'login.html';
        return;
    }

    // Modern navigation system
    const navLinks = document.querySelectorAll('.nav-link');
    const tabContents = document.querySelectorAll('.tab-content');

    // Navigation functionality
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.dataset.tab;

            // Update active nav link
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Update active content
            tabContents.forEach(content => content.classList.remove('active'));
            const targetContent = document.getElementById(target);
            if (targetContent) {
                targetContent.classList.add('active');
            }

            // Update URL hash
            window.location.hash = target;
        });
    });

    // Initialize with dashboard or hash
    const initialTab = window.location.hash.slice(1) || 'dashboard';
    const initialLink = document.querySelector(`[data-tab="${initialTab}"]`);
    if (initialLink) {
        initialLink.click();
    } else {
        const dashboardLink = document.querySelector('[data-tab="dashboard"]');
        if (dashboardLink) dashboardLink.click();
    }

    // Load existing data and update dashboard
    loadData();

    // Utility functions
    function uid() {
        return 'r_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }

    function addIdsToTree(node) {
        if (!node.id) node.id = uid();
        if (node.type === 'folder' && Array.isArray(node.children)) {
            node.children = node.children.map(addIdsToTree);
        }
        return node;
    }

    function legacyToTree(legacy) {
        const root = { id: uid(), name: 'Resources', type: 'folder', children: [] };
        const cat = (label, arr) => ({
            id: uid(),
            name: label,
            type: 'folder',
            children: (arr || []).map(x => ({
                id: uid(),
                name: x.title,
                type: 'file',
                url: x.url
            }))
        });
        if (legacy && Object.keys(legacy).length) {
            root.children.push(cat('Notes', legacy.notes));
            root.children.push(cat('Slides', legacy.slides));
            root.children.push(cat('Recordings', legacy.recordings));
            root.children.push(cat('External Links', legacy.external_links));
        }
        return root;
    }

    function countResources(node) {
        if (!node) return 0;
        let count = 0;
        if (node.type === 'file') count = 1;
        if (node.children) {
            count += node.children.reduce((sum, child) => sum + countResources(child), 0);
        }
        return count;
    }

    // Quick action handlers (API-only)
    document.querySelectorAll('.action-card').forEach(card => {
        card.addEventListener('click', async () => {
            const action = card.getAttribute('data-action');
            if (action === 'announcements') {
                const link = document.querySelector('[data-tab="announcements"]');
                if (link) link.click();
                const btn = document.getElementById('add-announcement');
                if (btn) btn.click();
            } else if (action === 'events') {
                const link = document.querySelector('[data-tab="events"]');
                if (link) link.click();
                const btn = document.getElementById('add-event');
                if (btn) btn.click();
            } else if (action === 'resources') {
                const link = document.querySelector('[data-tab="resources"]');
                if (link) link.click();
            }
        });
    });

    // Dashboard stats update
    function updateDashboardStats() {
        const announcementsCount = document.getElementById('announcements-count');
        const eventsCount = document.getElementById('events-count');
        const resourcesCount = document.getElementById('resources-count');
        const lastUpdated = document.getElementById('last-updated');

        if (announcementsCount) announcementsCount.textContent = announcementsData.length;
        if (eventsCount) eventsCount.textContent = eventsData.length;
        if (resourcesCount) resourcesCount.textContent = countResources(resourceTree);
        if (lastUpdated) lastUpdated.textContent = new Date().toLocaleDateString();
    }

    // Load all data from backend APIs (API-only)
    async function loadData() {
        try {
            // Announcements
            try {
                const resp = await fetch(`${API_BASE_URL}/api/announcements`);
                if (resp.ok) announcementsData = await resp.json();
                else announcementsData = [];
            } catch { announcementsData = []; }

            // Events
            try {
                const resp = await fetch(`${API_BASE_URL}/api/events`);
                if (resp.ok) eventsData = await resp.json();
                else eventsData = [];
            } catch { eventsData = []; }

            // Resources
            try {
                const resp = await fetch(`${API_BASE_URL}/api/resources`);
                if (resp.ok) {
                    const data = await resp.json();
                    if (data && data.type === 'folder' && Array.isArray(data.children)) {
                        resourceTree = addIdsToTree(data);
                    } else {
                        resourceTree = legacyToTree(data || {});
                    }
                } else {
                    resourceTree = { id: uid(), name: 'Resources', type: 'folder', children: [] };
                }
            } catch { resourceTree = { id: uid(), name: 'Resources', type: 'folder', children: [] }; }

            // Timetable
            try {
                const resp = await fetch(`${API_BASE_URL}/api/timetable`);
                if (resp.ok) {
                    const data = await resp.json();
                    timetableData = Object.assign({ url: '', type: 'image' }, data || {});
                } else {
                    timetableData = { url: '', type: 'image' };
                }
            } catch { timetableData = { url: '', type: 'image' }; }

            // Update dashboard and render sections
            updateDashboardStats();
            renderAnnouncements();
            renderEvents();
            renderResources();
            renderTimetable();

        } catch (error) {
            console.error('Error loading data:', error);
            showToast('Error loading data', 'error');
        }
    }

    // Render functions
    function renderAnnouncements() {
        const announcementsEditor = document.getElementById('announcements-editor');
        if (!announcementsEditor) return;

        announcementsEditor.innerHTML = '';

        if (announcementsData.length === 0) {
            announcementsEditor.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 48px; color: var(--text-color-soft);">
                    <i class="fa-solid fa-bullhorn" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <h3>No announcements yet</h3>
                    <p>Create your first announcement to get started</p>
                </div>
            `;
            return;
        }

        announcementsData.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'admin-item-card';
            div.innerHTML = `
                <div class="admin-item-header">
                    <div class="admin-form-group" style="flex: 2; margin: 0;">
                        <label class="admin-form-label">Title</label>
                        <input type="text" class="admin-form-input" value="${item.title}" data-field="title" data-index="${index}" placeholder="Announcement title">
                    </div>
                    <div class="admin-form-group" style="flex: 1; margin: 0;">
                        <label class="admin-form-label">Date</label>
                        <input type="date" class="admin-form-input" value="${item.date}" data-field="date" data-index="${index}">
                    </div>
                </div>
                <div class="admin-form-group">
                    <label class="admin-form-label">Description</label>
                    <textarea class="admin-form-textarea" data-field="description" data-index="${index}" placeholder="Announcement description">${item.description}</textarea>
                </div>
                <div class="admin-item-actions">
                    <span class="status-badge published">Published</span>
                    <button class="action-btn delete delete-announcement" data-index="${index}" title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
            announcementsEditor.appendChild(div);
        });
    }

    function renderEvents() {
        const eventsEditor = document.getElementById('events-editor');
        if (!eventsEditor) return;

        eventsEditor.innerHTML = '';

        if (eventsData.length === 0) {
            eventsEditor.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 48px; color: var(--text-color-soft);">
                    <i class="fa-solid fa-calendar-days" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <h3>No events scheduled</h3>
                    <p>Create your first event to get started</p>
                </div>
            `;
            return;
        }

        eventsData.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'admin-item-card';
            div.innerHTML = `
                <div class="admin-item-header">
                    <div class="admin-form-group" style="flex: 2; margin: 0;">
                        <label class="admin-form-label">Event Title</label>
                        <input type="text" class="admin-form-input" value="${item.title}" data-field="title" data-index="${index}" placeholder="Event title">
                    </div>
                    <div class="admin-form-group" style="flex: 1; margin: 0;">
                        <label class="admin-form-label">Date</label>
                        <input type="date" class="admin-form-input" value="${item.date}" data-field="date" data-index="${index}">
                    </div>
                </div>
                <div class="admin-form-group">
                    <label class="admin-form-label">Description</label>
                    <textarea class="admin-form-textarea" data-field="description" data-index="${index}" placeholder="Event description">${item.description}</textarea>
                </div>
                <div class="admin-form-group">
                    <label class="admin-form-label">Registration Form URL (Optional)</label>
                    <input type="url" class="admin-form-input" value="${item.form_url || ''}" data-field="form_url" data-index="${index}" placeholder="https://forms.google.com/...">
                </div>
                <div class="admin-item-actions">
                    <span class="status-badge published">Published</span>
                    <button class="action-btn delete delete-event" data-index="${index}" title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
            eventsEditor.appendChild(div);
        });
    }

    function renderResources() {
        const editor = document.getElementById('resources-editor');
        if (!editor) return;

        const node = getNodeAtPathAdmin(resourceTree, resourcePath);

        editor.innerHTML = `
            <div class="admin-item-card">
                <div class="page-header" style="margin-top:0;">
                    <div>
                        <h1>Resources</h1>
                        <p>Google Drive–style editor. Folders first, then files. Total: ${countResources(resourceTree)} files</p>
                    </div>
                    <div class="page-actions">
                        <button id="res-add-folder" class="button-secondary"><i class="fa-solid fa-folder-plus"></i> New Folder</button>
                        <button id="res-add-file" class="button-secondary"><i class="fa-solid fa-file-circle-plus"></i> New File</button>
                        <button id="res-save" class="button-primary"><i class="fa-solid fa-floppy-disk"></i> Save</button>
                    </div>
                </div>

                <div id="res-breadcrumb" style="margin-bottom: 12px;"></div>

                <div id="res-list" class="resource-grid" role="list"></div>
            </div>
        `;

        renderResourceBreadcrumb();
        renderResourceList(node);

        document.getElementById('res-add-folder').addEventListener('click', () => {
            const name = prompt('Folder name');
            if (!name) return;
            const target = getNodeAtPathAdmin(resourceTree, resourcePath);
            target.children = target.children || [];
            target.children.push({ id: uid(), name, type: 'folder', children: [] });
            renderResources();
        });

        document.getElementById('res-add-file').addEventListener('click', () => {
            const name = prompt('File name (e.g., Notes Chapter 1.pdf)');
            if (!name) return;
            const url = prompt('File URL (Google Drive/Docs/Link)');
            if (!url) return;
            const target = getNodeAtPathAdmin(resourceTree, resourcePath);
            target.children = target.children || [];
            target.children.push({ id: uid(), name, type: 'file', url });
            renderResources();
        });

        document.getElementById('res-save').addEventListener('click', async () => {
            try {
                const payload = stripIds(resourceTree);
                console.log('💾 Saving resources to DB (inline)...', { fileCount: countResources(resourceTree) });
                const resp = await fetch(`${API_BASE_URL}/api/resources`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`
                    },
                    body: JSON.stringify(payload)
                });
                const respText = await resp.text();
                console.log('📥 Response status:', resp.status, 'Body:', respText);
                if (!resp.ok) throw new Error(`Failed to save resources: ${resp.status} ${respText}`);
                showToast('Resources saved successfully', 'success');
                updateDashboardStats();
            } catch (err) {
                console.error('❌ Save resources failed (inline):', err);
                showToast(err.message || 'Save failed', 'error');
            }
        });
    }

    function renderResourceBreadcrumb() {
        const bc = document.getElementById('res-breadcrumb');
        if (!bc) return;
        const parts = ['Resources', ...resourcePath];
        bc.innerHTML = parts.map((p, idx) => `<button class="crumb" data-idx="${idx}">${idx===0?'\u003ci class=\\"fa-solid fa-house\\"\u003e\u003c/i\u003e':''} ${p}</button>`).join('<span class="crumb-sep"> / </span>');
        bc.querySelectorAll('.crumb').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const i = parseInt(e.currentTarget.getAttribute('data-idx'));
                resourcePath = resourcePath.slice(0, Math.max(0, i));
                renderResources();
            });
        });
    }

    function renderResourceList(node) {
        const list = document.getElementById('res-list');
        if (!list) return;
        const items = [...(node.children||[])];
        items.sort((a,b)=> (a.type===b.type ? a.name.localeCompare(b.name) : (a.type==='folder'?-1:1)));
        list.innerHTML = '';
        if (items.length === 0) {
            list.innerHTML = `<div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>No items here. Use New Folder or New File.</p></div>`;
            return;
        }
        items.forEach((it, idx) => {
            const el = document.createElement('div');
            el.className = 'resource-item ' + (it.type==='folder'?'folder':'file');
            el.setAttribute('role','listitem');
            el.innerHTML = `
                <div class="icon"><i class="fa-solid ${it.type==='folder'?'fa-folder':'fa-file'}"></i></div>
                <div class="meta">
                    <div class="name" title="${it.name}">${it.name}</div>
                    <div class="sub">${it.type==='folder'?'Folder':'File'}</div>
                </div>
                <div class="admin-item-actions">
                    <button class="action-btn" data-act="rename" title="Rename"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn delete" data-act="delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            if (it.type === 'folder') {
                el.addEventListener('dblclick', () => {
                    resourcePath = [...resourcePath, it.name];
                    renderResources();
                });
            } else if (it.type === 'file' && it.url) {
                el.addEventListener('dblclick', () => window.open(it.url, '_blank'));
            }
            el.querySelector('[data-act="rename"]').addEventListener('click', () => {
                const name = prompt('New name', it.name);
                if (!name) return;
                it.name = name;
                renderResources();
            });
            el.querySelector('[data-act="delete"]').addEventListener('click', () => {
                if (!confirm(`Delete ${it.name}?`)) return;
                const target = getNodeAtPathAdmin(resourceTree, resourcePath);
                target.children.splice(idx,1);
                renderResources();
            });
            list.appendChild(el);
        });
    }

    function getNodeAtPathAdmin(tree, pathArr) {
        let node = tree;
        for (const segment of pathArr) {
            if (!node.children) return node;
            const next = node.children.find(ch => ch.type==='folder' && ch.name===segment);
            if (!next) return node;
            node = next;
        }
        return node;
    }

    function stripIds(node) {
        if (!node) return node;
        if (node.type === 'folder') {
            return { name: node.name, type: 'folder', children: (node.children||[]).map(stripIds) };
        }
        return { name: node.name, type: 'file', url: node.url };
    }

    function renderTimetable() {
        const timetableEditor = document.getElementById('timetable-editor');
        if (!timetableEditor) return;

        timetableEditor.innerHTML = `
            <div class="admin-item-card">
                <div class="admin-form-group">
                    <label class="admin-form-label">Timetable URL</label>
                    <input type="url" class="admin-form-input" value="${timetableData.url || ''}" 
                           placeholder="https://example.com/timetable.pdf" id="timetable-url">
                </div>
                <div class="admin-form-group">
                    <label class="admin-form-label">Type</label>
                    <select class="admin-form-select" id="timetable-type">
                        <option value="image" ${timetableData.type === 'image' ? 'selected' : ''}>Image</option>
                        <option value="pdf" ${timetableData.type === 'pdf' ? 'selected' : ''}>PDF</option>
                    </select>
                </div>
                ${timetableData.url ? `
                    <div class="admin-form-group">
                        <label class="admin-form-label">Preview</label>
                        <div style="border: 1px solid var(--border-color); border-radius: 8px; padding: 16px;">
                            ${timetableData.type === 'pdf' ?
                    `<iframe src="${timetableData.url}" style="width: 100%; height: 300px; border: none;"></iframe>` :
                    `<img src="${timetableData.url}" style="max-width: 100%; height: auto;" alt="Timetable preview">`
                }
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        // Add event listeners for timetable form
        const urlInput = document.getElementById('timetable-url');
        const typeSelect = document.getElementById('timetable-type');

        if (urlInput) {
            urlInput.addEventListener('change', (e) => {
                timetableData.url = e.target.value;
                renderTimetable();
            });
        }

        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                timetableData.type = e.target.value;
                renderTimetable();
            });
        }
    }

    // ============================================
    // BANNER MANAGEMENT
    // ============================================
    
    let bannersData = [];
    let editingBannerId = null;
    
    // Load banners from API
    async function loadBanners() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/banners`);
            if (response.ok) {
                bannersData = await response.json();
                renderBanners();
                showToast('Banners loaded successfully');
            }
        } catch (error) {
            console.error('Error loading banners:', error);
            showToast('Failed to load banners', 'error');
        }
    }
    
    // Render banners table
    function renderBanners() {
        const tbody = document.getElementById('banners-table-body');
        if (!tbody) return;
        
        if (bannersData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px;">
                        <i class="fa-solid fa-rectangle-ad" style="font-size: 48px; color: var(--text-secondary); margin-bottom: 16px;"></i>
                        <p>No banners yet. Create your first banner!</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = bannersData.map(banner => {
            const startDate = new Date(banner.startDate);
            const endDate = new Date(banner.endDate);
            const now = new Date();
            
            let statusBadge = '';
            if (!banner.isActive) {
                statusBadge = '<span class="status-badge inactive">Inactive</span>';
            } else if (now < startDate) {
                statusBadge = '<span class="status-badge scheduled">Scheduled</span>';
            } else if (now > endDate) {
                statusBadge = '<span class="status-badge expired">Expired</span>';
            } else {
                statusBadge = '<span class="status-badge active">Active</span>';
            }
            
            const typeBadge = `<span class="banner-type-badge ${banner.type}">${banner.type}</span>`;
            
            return `
                <tr>
                    <td>${typeBadge}</td>
                    <td>
                        <div class="banner-message-preview">${banner.message}</div>
                        ${banner.link ? `<small><i class="fa-solid fa-link"></i> ${banner.linkText}</small>` : ''}
                    </td>
                    <td>
                        <small>
                            <strong>Start:</strong> ${startDate.toLocaleString()}<br>
                            <strong>End:</strong> ${endDate.toLocaleString()}
                        </small>
                    </td>
                    <td>${banner.priority}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <div class="action-buttons">
                            <button onclick="editBanner('${banner._id}')" class="icon-button" title="Edit">
                                <i class="fa-solid fa-edit"></i>
                            </button>
                            <button onclick="toggleBannerStatus('${banner._id}')" class="icon-button" title="${banner.isActive ? 'Deactivate' : 'Activate'}">
                                <i class="fa-solid fa-${banner.isActive ? 'eye-slash' : 'eye'}"></i>
                            </button>
                            <button onclick="deleteBanner('${banner._id}')" class="icon-button danger" title="Delete">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    // Show/hide banner form
    function showBannerForm(isEdit = false) {
        const form = document.getElementById('banner-form');
        const formTitle = document.getElementById('banner-form-title');
        if (form) {
            form.style.display = 'block';
            formTitle.textContent = isEdit ? 'Edit Banner' : 'New Banner';
            form.scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    function hideBannerForm() {
        const form = document.getElementById('banner-form');
        const formElement = document.getElementById('banner-form-element');
        if (form) form.style.display = 'none';
        if (formElement) formElement.reset();
        editingBannerId = null;
    }
    
    // Edit banner
    window.editBanner = async function(bannerId) {
        const banner = bannersData.find(b => b._id === bannerId);
        if (!banner) return;
        
        editingBannerId = bannerId;
        
        // Populate form
        document.getElementById('banner-id').value = banner._id;
        document.getElementById('banner-type').value = banner.type;
        document.getElementById('banner-message').value = banner.message;
        document.getElementById('banner-link').value = banner.link || '';
        document.getElementById('banner-link-text').value = banner.linkText || 'Learn More';
        
        // Format dates for datetime-local input
        const startDate = new Date(banner.startDate);
        const endDate = new Date(banner.endDate);
        document.getElementById('banner-start-date').value = formatDateTimeLocal(startDate);
        document.getElementById('banner-end-date').value = formatDateTimeLocal(endDate);
        
        document.getElementById('banner-priority').value = banner.priority;
        document.getElementById('banner-active').checked = banner.isActive;
        
        showBannerForm(true);
    };
    
    // Delete banner
    window.deleteBanner = async function(bannerId) {
        if (!confirm('Are you sure you want to delete this banner?')) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/banners/${bannerId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`
                }
            });
            
            if (response.ok) {
                showToast('Banner deleted successfully');
                loadBanners();
            } else {
                throw new Error('Failed to delete banner');
            }
        } catch (error) {
            console.error('Error deleting banner:', error);
            showToast('Failed to delete banner', 'error');
        }
    };
    
    // Toggle banner status
    window.toggleBannerStatus = async function(bannerId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/banners/${bannerId}/toggle`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`
                }
            });
            
            if (response.ok) {
                showToast('Banner status updated');
                loadBanners();
            } else {
                throw new Error('Failed to toggle banner status');
            }
        } catch (error) {
            console.error('Error toggling banner:', error);
            showToast('Failed to update banner status', 'error');
        }
    };
    
    // Format date for datetime-local input
    function formatDateTimeLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    
    // Banner form handlers
    const addBannerBtn = document.getElementById('add-banner');
    const refreshBannersBtn = document.getElementById('refresh-banners');
    const cancelBannerBtn = document.getElementById('cancel-banner');
    const bannerForm = document.getElementById('banner-form-element');
    
    if (addBannerBtn) {
        addBannerBtn.addEventListener('click', () => {
            hideBannerForm();
            showBannerForm(false);
            
            // Set default dates
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 7);
            
            document.getElementById('banner-start-date').value = formatDateTimeLocal(now);
            document.getElementById('banner-end-date').value = formatDateTimeLocal(tomorrow);
        });
    }
    
    if (refreshBannersBtn) {
        refreshBannersBtn.addEventListener('click', () => {
            loadBanners();
        });
    }
    
    if (cancelBannerBtn) {
        cancelBannerBtn.addEventListener('click', () => {
            hideBannerForm();
        });
    }
    
    if (bannerForm) {
        bannerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const bannerData = {
                type: document.getElementById('banner-type').value,
                message: document.getElementById('banner-message').value,
                link: document.getElementById('banner-link').value,
                linkText: document.getElementById('banner-link-text').value,
                startDate: new Date(document.getElementById('banner-start-date').value).toISOString(),
                endDate: new Date(document.getElementById('banner-end-date').value).toISOString(),
                priority: parseInt(document.getElementById('banner-priority').value),
                isActive: document.getElementById('banner-active').checked
            };
            
            // Validate dates
            if (new Date(bannerData.startDate) >= new Date(bannerData.endDate)) {
                showToast('End date must be after start date', 'error');
                return;
            }
            
            try {
                const url = editingBannerId 
                    ? `${API_BASE_URL}/api/banners/${editingBannerId}`
                    : `${API_BASE_URL}/api/banners`;
                
                const method = editingBannerId ? 'PUT' : 'POST';
                
                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`
                    },
                    body: JSON.stringify(bannerData)
                });
                
                if (response.ok) {
                    showToast(`Banner ${editingBannerId ? 'updated' : 'created'} successfully`);
                    hideBannerForm();
                    loadBanners();
                } else {
                    throw new Error('Failed to save banner');
                }
            } catch (error) {
                console.error('Error saving banner:', error);
                showToast('Failed to save banner', 'error');
            }
        });
    }
    
    // Load banners when tab is opened
    const bannersTab = document.querySelector('[data-tab="banners"]');
    if (bannersTab) {
        bannersTab.addEventListener('click', () => {
            if (bannersData.length === 0) {
                loadBanners();
            }
        });
    }

    // Toast notification system
    function showToast(message, type = 'success', title = '') {
        const toastContainer = document.querySelector('.toast-container') || createToastContainer();

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icon = type === 'success' ? 'check' : type === 'error' ? 'times' : 'exclamation';
        const toastTitle = title || (type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Info');

        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fa-solid fa-${icon}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${toastTitle}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;

        toastContainer.appendChild(toast);

        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);

        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function createToastContainer() {
        const container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    }

    function downloadJSON(data, filename) {
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Event handlers for form changes
    document.addEventListener('change', (e) => {
        const target = e.target;
        const index = target.dataset.index;
        const field = target.dataset.field;

        if (index !== undefined && field) {
            if (target.closest('#announcements-editor')) {
                if (announcementsData[index]) {
                    announcementsData[index][field] = target.value;
                }
            } else if (target.closest('#events-editor')) {
                if (eventsData[index]) {
                    eventsData[index][field] = target.value;
                }
            }
        }
    });

    // Add new items
    const addAnnouncementBtn = document.getElementById('add-announcement');
    if (addAnnouncementBtn) {
        addAnnouncementBtn.addEventListener('click', () => {
            announcementsData.unshift({
                title: 'New Announcement',
                date: new Date().toISOString().split('T')[0],
                description: ''
            });
            renderAnnouncements();
            updateDashboardStats();
            showToast('New announcement created');
        });
    }

    const addEventBtn = document.getElementById('add-event');
    if (addEventBtn) {
        addEventBtn.addEventListener('click', () => {
            eventsData.unshift({
                title: 'New Event',
                date: new Date().toISOString().split('T')[0],
                description: '',
                form_url: ''
            });
            renderEvents();
            updateDashboardStats();
            showToast('New event created');
        });
    }

    // Delete handlers
    document.addEventListener('click', (e) => {
        if (e.target.closest('.delete-announcement')) {
            const index = e.target.closest('.delete-announcement').dataset.index;
            if (confirm('Are you sure you want to delete this announcement?')) {
                announcementsData.splice(index, 1);
                renderAnnouncements();
                updateDashboardStats();
                showToast('Announcement deleted');
            }
        }

        if (e.target.closest('.delete-event')) {
            const index = e.target.closest('.delete-event').dataset.index;
            if (confirm('Are you sure you want to delete this event?')) {
                eventsData.splice(index, 1);
                renderEvents();
                updateDashboardStats();
                showToast('Event deleted');
            }
        }
    });

    // Save/Export handlers (export still available locally if needed)
    const saveAnnouncementsBtn = document.getElementById('save-announcements');
    if (saveAnnouncementsBtn) {
        saveAnnouncementsBtn.addEventListener('click', async () => {
            try {
                console.log('💾 Saving announcements to DB...', { count: announcementsData.length });
                const resp = await fetch(`${API_BASE_URL}/api/announcements`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`
                    },
                    body: JSON.stringify({ items: announcementsData })
                });
                const respText = await resp.text();
                console.log('📥 Response status:', resp.status, 'Body:', respText);
                if (!resp.ok) throw new Error(`Failed to save announcements: ${resp.status} ${respText}`);
                showToast('Announcements saved to DB');
                updateDashboardStats();
            } catch (e) {
                console.error('❌ Save announcements failed:', e);
                showToast(`Save failed: ${e.message}`, 'error');
            }
        });
    }

    const saveEventsBtn = document.getElementById('save-events');
    if (saveEventsBtn) {
        saveEventsBtn.addEventListener('click', async () => {
            try {
                console.log('💾 Saving events to DB...', { count: eventsData.length });
                const resp = await fetch(`${API_BASE_URL}/api/events`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`
                    },
                    body: JSON.stringify({ items: eventsData })
                });
                const respText = await resp.text();
                console.log('📥 Response status:', resp.status, 'Body:', respText);
                if (!resp.ok) throw new Error(`Failed to save events: ${resp.status} ${respText}`);
                showToast('Events saved to DB');
                updateDashboardStats();
            } catch (e) {
                console.error('❌ Save events failed:', e);
                showToast(`Save failed: ${e.message}`, 'error');
            }
        });
    }

    const saveResourcesBtn = document.getElementById('save-resources');
    if (saveResourcesBtn) {
        saveResourcesBtn.addEventListener('click', async () => {
            try {
                const payload = stripIds(resourceTree);
                console.log('💾 Saving resources to DB...', { fileCount: countResources(resourceTree) });
                const resp = await fetch(`${API_BASE_URL}/api/resources`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`
                    },
                    body: JSON.stringify(payload)
                });
                const respText = await resp.text();
                console.log('📥 Response status:', resp.status, 'Body:', respText);
                if (!resp.ok) throw new Error(`Failed to save resources: ${resp.status} ${respText}`);
                showToast('Resources saved to DB');
                updateDashboardStats();
            } catch (e) {
                console.error('❌ Save resources failed:', e);
                showToast(`Save failed: ${e.message}`, 'error');
            }
        });
    }

    const saveTimetableBtn = document.getElementById('save-timetable');
    if (saveTimetableBtn) {
        saveTimetableBtn.addEventListener('click', async () => {
            try {
                console.log('💾 Saving timetable to DB...', timetableData);
                const resp = await fetch(`${API_BASE_URL}/api/timetable`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionStorage.getItem('authToken')}`
                    },
                    body: JSON.stringify(timetableData)
                });
                const respText = await resp.text();
                console.log('📥 Response status:', resp.status, 'Body:', respText);
                if (!resp.ok) throw new Error(`Failed to save timetable: ${resp.status} ${respText}`);
                showToast('Timetable saved to DB');
                updateDashboardStats();
            } catch (e) {
                console.error('❌ Save timetable failed:', e);
                showToast(`Save failed: ${e.message}`, 'error');
            }
        });
    }

    // Quick action handlers
    document.addEventListener('click', (e) => {
        const actionCard = e.target.closest('.action-card');
        if (actionCard) {
            const action = actionCard.dataset.action;
            const navLink = document.querySelector(`[data-tab="${action}"]`);
            if (navLink) {
                navLink.click();
                // Trigger add action after navigation
                setTimeout(() => {
                    if (action === 'announcements') {
                        document.getElementById('add-announcement')?.click();
                    } else if (action === 'events') {
                        document.getElementById('add-event')?.click();
                    }
                }, 100);
            }
        }
    });

    // Logout handler
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to logout?')) {
                sessionStorage.removeItem('isAdmin');
                window.location.href = 'login.html';
            }
        });
    }

    // Mobile navigation for admin dashboard
    const mobileNavToggle = document.getElementById('admin-mobile-toggle');
    const adminSidebar = document.getElementById('admin-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    if (mobileNavToggle && adminSidebar && sidebarOverlay) {
        mobileNavToggle.addEventListener('click', () => {
            adminSidebar.classList.toggle('active');
            sidebarOverlay.classList.toggle('active');
            document.body.style.overflow = adminSidebar.classList.contains('active') ? 'hidden' : '';
        });

        sidebarOverlay.addEventListener('click', () => {
            adminSidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
            document.body.style.overflow = '';
        });

        // Close sidebar when clicking nav links on mobile
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 767) {
                    adminSidebar.classList.remove('active');
                    sidebarOverlay.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth > 767) {
                adminSidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    }
});
