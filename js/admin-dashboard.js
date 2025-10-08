document.addEventListener('DOMContentLoaded', () => {
    if (sessionStorage.getItem('isAdmin') !== 'true') {
        window.location.href = 'login.html';
        return;
    }

    const announcementsEditor = document.getElementById('announcements-editor');
    const eventsEditor = document.getElementById('events-editor');
    const resourcesEditor = document.getElementById('resources-editor');
    const confirmationModal = document.getElementById('confirmation-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

    let deleteCallback = null;

    let announcementsData = [];
    let eventsData = [];
    let resourceTree = null; // hierarchical tree for resources editor
    let timetableData = { url: '', type: 'image' };

    // Tab functionality
    const tabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const saveButtons = {
        announcements: document.getElementById('save-announcements'),
        events: document.getElementById('save-events'),
        resources: document.getElementById('save-resources'),
        timetable: document.getElementById('save-timetable')
    };

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            tabContents.forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(target).classList.add('active');

            // Show the correct save button
            Object.values(saveButtons).forEach(button => button.style.display = 'none');
            if (saveButtons[target]) {
                saveButtons[target].style.display = 'inline-flex';
            }
        });
    });

    // Trigger click on the first tab to initialize view
    tabs[0].click();

    // Load existing data using API
    async function loadData() {
        try {
            // Load announcements
            try {
                const announcements = await window.API.get(window.CONFIG.ENDPOINTS.ANNOUNCEMENTS, 'announcements.json');
                announcementsData = announcements || [];
                renderAnnouncements();
            } catch (error) {
                console.error('Failed to load announcements:', error);
                showStatus('Failed to load announcements', 'error');
                announcementsData = [];
                renderAnnouncements();
            }

            // Load events
            try {
                const events = await window.API.get(window.CONFIG.ENDPOINTS.EVENTS, 'events.json');
                eventsData = events || [];
                renderEvents();
            } catch (error) {
                console.error('Failed to load events:', error);
                showStatus('Failed to load events', 'error');
                eventsData = [];
                renderEvents();
            }

            // Load resources
            try {
                const resources = await window.API.get(window.CONFIG.ENDPOINTS.RESOURCES, 'resources.json');
                if (resources && resources.type === 'folder' && Array.isArray(resources.children)) {
                    resourceTree = addIdsToTree(resources);
                } else {
                    resourceTree = legacyToTree(resources || {});
                }
                renderResources();
            } catch (error) {
                console.error('Failed to load resources:', error);
                resourceTree = { id: uid(), name: 'Resources', type: 'folder', children: [] };
                renderResources();
            }

            // Load timetable
            try {
                const timetable = await window.API.get(window.CONFIG.ENDPOINTS.TIMETABLE, 'timetable.json');
                timetableData = Object.assign({ url: '', type: 'image' }, timetable || {});
                renderTimetable();
            } catch (error) {
                console.error('Failed to load timetable:', error);
                renderTimetable();
            }

        } catch (error) {
            console.error('Error loading data:', error);
            showStatus('Failed to load data from server', 'error');
        }
    }

    // Initialize data loading
    loadData();

    function renderAnnouncements() {
        announcementsEditor.innerHTML = '';
        announcementsData.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'item card';
            div.innerHTML = `
                <div class="item-header">
                    <input type="text" value="${item.title}" data-field="title" data-index="${index}" placeholder="Title">
                    <input type="date" value="${item.date}" data-field="date" data-index="${index}">
                </div>
                <textarea data-field="description" data-index="${index}" placeholder="Description">${item.description}</textarea>
                <div class="item-actions">
                    <button class="delete-announcement button-danger" data-index="${index}"><i class="fa-solid fa-trash"></i> Delete</button>
                </div>
            `;
            announcementsEditor.appendChild(div);
        });
    }

    function renderEvents() {
        eventsEditor.innerHTML = '';
        eventsData.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = 'item card';
            div.innerHTML = `
                <div class="item-header">
                    <input type="text" value="${item.title}" data-field="title" data-index="${index}" placeholder="Title">
                    <input type="date" value="${item.date}" data-field="date" data-index="${index}">
                </div>
                <textarea data-field="description" data-index="${index}" placeholder="Description">${item.description}</textarea>
                <input type="text" value="${item.form_url || ''}" data-field="form_url" data-index="${index}" placeholder="Google Form URL">
                <div class="item-actions">
                    <button class="delete-event button-danger" data-index="${index}"><i class="fa-solid fa-trash"></i> Delete</button>
                </div>
            `;
            eventsEditor.appendChild(div);
        });
    }

    // ===== Resources (Drive-like) =====
    let currentResourcePath = []; // array of folder names relative to root
    let viewModeResources = localStorage.getItem('adminResourceView') || 'grid';
    let selection = new Set(); // selected item ids for bulk ops

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
        const cat = (label, arr) => ({ id: uid(), name: label, type: 'folder', children: (arr || []).map(x => ({ id: uid(), name: x.title, type: 'file', url: x.url })) });
        if (legacy && Object.keys(legacy).length) {
            root.children.push(cat('Notes', legacy.notes));
            root.children.push(cat('Slides', legacy.slides));
            root.children.push(cat('Recordings', legacy.recordings));
            root.children.push(cat('External Links', legacy.external_links));
        }
        return root;
    }

    function getNodeAtPath(tree, pathArr) {
        let node = tree;
        for (const segment of pathArr) {
            if (!node.children) return node;
            const next = node.children.find(ch => ch.type === 'folder' && ch.name === segment);
            if (!next) return node;
            node = next;
        }
        return node;
    }

    function findNodeById(node, id, parent = null) {
        if (node.id === id) return { node, parent };
        if (node.type === 'folder' && node.children) {
            for (const ch of node.children) {
                const res = findNodeById(ch, id, node);
                if (res) return res;
            }
        }
        return null;
    }

    function ensureUniqueName(name, siblings) {
        let base = name;
        let n = 0;
        const exists = (nm) => siblings.some(x => x.name === nm);
        let final = base;
        while (exists(final)) {
            n += 1;
            final = `${base} (${n})`;
        }
        return final;
    }

    function renderResources() {
        // Clean admin interface with better organization
        const node = getNodeAtPath(resourceTree, currentResourcePath);
        const items = [...(node.children || [])].sort((a,b) => (a.type===b.type? a.name.localeCompare(b.name) : (a.type==='folder'?-1:1)));
        
        // Count stats
        const folderCount = items.filter(i => i.type === 'folder').length;
        const fileCount = items.filter(i => i.type === 'file').length;
        const selectedCount = selection.size;
        
        resourcesEditor.innerHTML = `
            <!-- Header with title and stats -->
            <div class="admin-resources-header">
                <div class="admin-resources-title">
                    <i class="fa-solid fa-folder-tree"></i>
                    <span>Resource Management</span>
                </div>
                <div class="admin-resources-stats">
                    <div class="stat-item">
                        <i class="fa-solid fa-folder"></i>
                        <span>${folderCount} folders</span>
                    </div>
                    <div class="stat-item">
                        <i class="fa-solid fa-file"></i>
                        <span>${fileCount} files</span>
                    </div>
                    ${selectedCount > 0 ? `<div class="stat-item" style="color: var(--primary-color); font-weight: 500;">
                        <i class="fa-solid fa-check-circle"></i>
                        <span>${selectedCount} selected</span>
                    </div>` : ''}
                </div>
            </div>

            <!-- Toolbar with actions -->
            <div class="admin-resources-toolbar">
                <div class="admin-toolbar-left">
                    <button id="res-new-folder" class="button-secondary">
                        <i class="fa-solid fa-folder-plus"></i> New Folder
                    </button>
                    <label class="button-secondary" style="cursor:pointer;">
                        <input type="file" id="res-upload" style="display:none;" multiple>
                        <i class="fa-solid fa-upload"></i> Upload Files
                    </label>
                    <button id="res-new-link" class="button-secondary">
                        <i class="fa-solid fa-link"></i> Add Link
                    </button>
                    
                    <div class="admin-toolbar-separator"></div>
                    
                    <label style="display:flex; align-items:center; gap:6px; font-size: 0.875rem;">
                        <input type="checkbox" id="res-select-all" class="admin-resource-checkbox" /> 
                        Select all
                    </label>
                </div>
                
                <div class="admin-toolbar-right">
                    <div class="admin-bulk-actions ${selectedCount === 0 ? 'hidden' : ''}">
                        <span>${selectedCount} selected</span>
                        <button id="res-bulk-move" class="button-secondary" style="margin-left: 8px;">
                            <i class="fa-solid fa-arrows-alt"></i> Move
                        </button>
                        <button id="res-bulk-delete" class="button-danger">
                            <i class="fa-solid fa-trash"></i> Delete
                        </button>
                    </div>
                    
                    <div class="view-toggle">
                        <button id="res-view-list" class="button-secondary" title="List view" aria-pressed="${viewModeResources==='list'}">
                            <i class="fa-solid fa-list"></i>
                        </button>
                        <button id="res-view-grid" class="button-secondary" title="Grid view" aria-pressed="${viewModeResources==='grid'}">
                            <i class="fa-solid fa-border-all"></i>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Content area -->
            <div class="admin-resources-content">
                <div id="res-breadcrumb" class="admin-resources-breadcrumb" aria-label="Folder breadcrumb"></div>
                <div id="res-dropzone" class="admin-resources-list" tabindex="0" role="list">
                    <div id="res-list"></div>
                </div>
            </div>
            
            <div style="margin-top:12px; padding:12px; background: var(--bg-color); border-radius: 8px; color: var(--text-color-soft); font-size: 0.875rem; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-info-circle"></i>
                <span>Drag files here to upload, or drag items onto folders to move them. Double-click folders to navigate.</span>
            </div>

            <!-- Move dialog -->
            <div id="move-modal" class="modal" aria-hidden="true" aria-labelledby="move-modal-title" role="dialog">
                <div class="modal-content" role="document">
                    <h2 id="move-modal-title">Move Selected Items</h2>
                    <label for="move-target">Choose destination folder:</label>
                    <select id="move-target" style="width:100%; margin-top:8px; padding: 8px; border-radius: 6px; border: 1px solid var(--border-color);"></select>
                    <div class="modal-actions">
                        <button id="move-confirm" class="button-primary">Move Items</button>
                        <button id="move-cancel" class="button-secondary">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        const breadcrumbEl = resourcesEditor.querySelector('#res-breadcrumb');
        const listEl = resourcesEditor.querySelector('#res-list');
        const dropzone = resourcesEditor.querySelector('#res-dropzone');

        // Breadcrumb
        const parts = ['Home', ...currentResourcePath];
        breadcrumbEl.innerHTML = parts.map((p, idx) => {
            if (idx === 0) return `<button class="crumb" data-index="0"><i class="fa-solid fa-house"></i> Home</button>`;
            return `<button class="crumb" data-index="${idx}">${p}</button>`;
        }).join('<span class="crumb-sep">/</span>');
        breadcrumbEl.querySelectorAll('.crumb').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.getAttribute('data-index'));
                currentResourcePath = currentResourcePath.slice(0, idx);
                renderResources();
            });
        });

        // Render items with new clean design
        if (items.length === 0) {
            listEl.innerHTML = `
                <div class="admin-empty-state">
                    <i class="fa-solid fa-folder-open"></i>
                    <h3>No items here</h3>
                    <p>This folder is empty. Upload files or create new folders to get started.</p>
                </div>
            `;
        } else {
            listEl.innerHTML = '';
            items.forEach((item, idx) => {
                const el = document.createElement('div');
                el.className = `admin-resource-item ${item.type} ${selection.has(item.id) ? 'selected' : ''}`;
                el.setAttribute('draggable', 'true');
                el.setAttribute('role', 'listitem');
                el.setAttribute('tabindex', idx === 0 ? '0' : '-1');
                el.dataset.id = item.id;
                
                if (item.type === 'folder') {
                    el.innerHTML = `
                        <input type="checkbox" class="admin-resource-checkbox res-select" 
                               aria-label="Select ${item.name}" ${selection.has(item.id)?'checked':''} />
                        <div class="admin-resource-icon">
                            <i class="fa-solid fa-folder" style="color: #3b82f6;"></i>
                        </div>
                        <div class="admin-resource-meta">
                            <div class="admin-resource-name name" contenteditable="false">${item.name}</div>
                            <div class="admin-resource-details">
                                <span>Folder</span>
                                <span>•</span>
                                <span>${(item.children || []).length} items</span>
                            </div>
                        </div>
                        <div class="admin-resource-actions">
                            <button class="admin-action-btn res-rename" title="Rename">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="admin-action-btn danger res-delete" title="Delete">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    `;
                    el.addEventListener('dblclick', () => { 
                        currentResourcePath = [...currentResourcePath, item.name]; 
                        renderResources(); 
                    });
                } else {
                    const ext = (item.name.split('.').pop() || '').toUpperCase();
                    const fileIcon = getFileIcon(item.name);
                    const fileSize = item.url && item.url.startsWith('data:') ? 
                        formatFileSize(Math.round(item.url.length * 0.75)) : '';
                    
                    el.innerHTML = `
                        <input type="checkbox" class="admin-resource-checkbox res-select" 
                               aria-label="Select ${item.name}" ${selection.has(item.id)?'checked':''} />
                        <div class="admin-resource-icon">
                            <i class="${fileIcon}" style="color: ${getFileColor(ext)};"></i>
                        </div>
                        <div class="admin-resource-meta">
                            <div class="admin-resource-name name" contenteditable="false">${item.name}</div>
                            <div class="admin-resource-details">
                                <span class="admin-resource-tag">${ext || 'FILE'}</span>
                                ${item.tags?.subject ? `<span class="admin-resource-tag">📚 ${item.tags.subject}</span>` : ''}
                                ${item.tags?.semester ? `<span class="admin-resource-tag">📅 ${item.tags.semester}</span>` : ''}
                                ${fileSize ? `<span>${fileSize}</span>` : ''}
                            </div>
                            <div class="admin-tag-editor" style="display: none;">
                                <input class="admin-tag-input tag-subject" type="text" 
                                       placeholder="Subject" value="${item.tags?.subject || ''}" />
                                <input class="admin-tag-input tag-semester" type="text" 
                                       placeholder="Semester" value="${item.tags?.semester || ''}" />
                            </div>
                        </div>
                        <div class="admin-resource-actions">
                            <a class="admin-action-btn" href="${item.url}" target="_blank" 
                               rel="noopener" title="Open file">
                                <i class="fa-solid fa-external-link-alt"></i>
                            </a>
                            <button class="admin-action-btn res-edit-tags" title="Edit tags">
                                <i class="fa-solid fa-tags"></i>
                            </button>
                            <button class="admin-action-btn res-rename" title="Rename">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="admin-action-btn danger res-delete" title="Delete">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    `;
                    
                    // Tag editing functionality
                    const tagEditor = el.querySelector('.admin-tag-editor');
                    const editTagsBtn = el.querySelector('.res-edit-tags');
                    const subjectInput = el.querySelector('.tag-subject');
                    const semesterInput = el.querySelector('.tag-semester');
                    
                    editTagsBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const isVisible = tagEditor.style.display !== 'none';
                        tagEditor.style.display = isVisible ? 'none' : 'flex';
                        if (!isVisible) subjectInput.focus();
                    });
                    
                    [subjectInput, semesterInput].forEach(input => {
                        input.addEventListener('change', (ev) => {
                            item.tags = item.tags || {};
                            const field = input.classList.contains('tag-subject') ? 'subject' : 'semester';
                            item.tags[field] = ev.target.value.trim();
                            renderResources(); // Refresh to show updated tags
                        });
                        input.addEventListener('keydown', (ev) => {
                            if (ev.key === 'Enter') {
                                ev.preventDefault();
                                tagEditor.style.display = 'none';
                            }
                        });
                    });
                }
                
                // Common event handlers
                el.querySelector('.res-select').addEventListener('click', (ev) => { 
                    ev.stopPropagation(); 
                    toggleSelect(item.id, ev.currentTarget.checked);
                    renderResources(); // Refresh to update selection state
                });
                
                // Drag and drop
                el.addEventListener('dragstart', (ev) => { 
                    ev.dataTransfer.setData('text/plain', item.id); 
                    ev.dataTransfer.effectAllowed = 'move'; 
                });
                
                if (item.type === 'folder') {
                    el.addEventListener('dragover', (ev) => { 
                        ev.preventDefault(); 
                        ev.dataTransfer.dropEffect = 'move'; 
                        el.style.background = 'rgba(59, 130, 246, 0.2)';
                    });
                    el.addEventListener('dragleave', () => {
                        el.style.background = '';
                    });
                    el.addEventListener('drop', (ev) => {
                        ev.preventDefault();
                        el.style.background = '';
                        const dragId = ev.dataTransfer.getData('text/plain');
                        moveItemIntoFolder(dragId, item.id);
                    });
                }
                
                listEl.appendChild(el);
            });
        }
        
        // Helper functions for file icons and colors
        function getFileIcon(filename) {
            const ext = filename.split('.').pop()?.toLowerCase() || '';
            const iconMap = {
                'pdf': 'fa-solid fa-file-pdf',
                'doc': 'fa-solid fa-file-word', 'docx': 'fa-solid fa-file-word',
                'xls': 'fa-solid fa-file-excel', 'xlsx': 'fa-solid fa-file-excel',
                'ppt': 'fa-solid fa-file-powerpoint', 'pptx': 'fa-solid fa-file-powerpoint',
                'jpg': 'fa-solid fa-file-image', 'jpeg': 'fa-solid fa-file-image', 
                'png': 'fa-solid fa-file-image', 'gif': 'fa-solid fa-file-image',
                'mp4': 'fa-solid fa-file-video', 'avi': 'fa-solid fa-file-video',
                'zip': 'fa-solid fa-file-zipper', 'rar': 'fa-solid fa-file-zipper',
                'txt': 'fa-solid fa-file-lines', 'md': 'fa-solid fa-file-lines'
            };
            return iconMap[ext] || 'fa-solid fa-file';
        }
        
        function getFileColor(ext) {
            const colorMap = {
                'PDF': '#dc2626', 'DOC': '#2563eb', 'DOCX': '#2563eb',
                'XLS': '#059669', 'XLSX': '#059669',
                'PPT': '#ea580c', 'PPTX': '#ea580c',
                'JPG': '#7c3aed', 'JPEG': '#7c3aed', 'PNG': '#7c3aed', 'GIF': '#7c3aed',
                'MP4': '#db2777', 'AVI': '#db2777',
                'ZIP': '#6b7280', 'RAR': '#6b7280',
                'TXT': '#374151', 'MD': '#374151'
            };
            return colorMap[ext] || '#6b7280';
        }
        
        function formatFileSize(bytes) {
            if (!bytes) return '';
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(1024));
            return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
        }

        // Drop files into current folder
        ;['dragover','drop'].forEach(evt => dropzone.addEventListener(evt, (ev) => {
            if (evt === 'dragover') { ev.preventDefault(); return; }
            ev.preventDefault();
            const files = ev.dataTransfer.files;
            if (files && files.length) {
                handleUploadFiles(Array.from(files));
            }
        }));

        // Toolbar actions
        resourcesEditor.querySelector('#res-new-folder').addEventListener('click', () => {
            const name = prompt('Folder name');
            if (!name) return;
            const parent = getNodeAtPath(resourceTree, currentResourcePath);
            parent.children = parent.children || [];
            const unique = ensureUniqueName(name.trim(), parent.children);
            parent.children.push({ id: uid(), name: unique, type: 'folder', children: [] });
            renderResources();
        });

        resourcesEditor.querySelector('#res-upload').addEventListener('change', (e) => {
            const files = Array.from(e.target.files || []);
            if (files.length) handleUploadFiles(files);
            e.target.value = '';
        });

        resourcesEditor.querySelector('#res-new-link').addEventListener('click', () => {
            const name = prompt('Link name');
            if (!name) return;
            const url = prompt('URL (https://...)');
            if (!url) return;
            const parent = getNodeAtPath(resourceTree, currentResourcePath);
            parent.children = parent.children || [];
            const unique = ensureUniqueName(name.trim(), parent.children);
            parent.children.push({ id: uid(), name: unique, type: 'file', url: url.trim() });
            renderResources();
        });

        // Enhanced item actions with better UX
        listEl.addEventListener('click', (e) => {
            const row = e.target.closest('.admin-resource-item');
            if (!row) return;
            const id = row.dataset.id;
            
            if (e.target.closest('.res-rename')) {
                e.stopPropagation();
                const { node } = findNodeById(resourceTree, id) || {};
                if (!node) return;
                
                // Toggle inline rename with better styling
                const nameEl = row.querySelector('.admin-resource-name');
                const originalName = node.name;
                
                nameEl.setAttribute('contenteditable', 'true');
                nameEl.style.background = 'var(--card-bg)';
                nameEl.style.border = '2px solid var(--primary-color)';
                nameEl.style.borderRadius = '4px';
                nameEl.style.padding = '4px 8px';
                nameEl.focus();
                
                // Select all text for easy editing
                const range = document.createRange();
                range.selectNodeContents(nameEl);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
                
                const commit = () => {
                    nameEl.setAttribute('contenteditable', 'false');
                    nameEl.style.background = '';
                    nameEl.style.border = '';
                    nameEl.style.borderRadius = '';
                    nameEl.style.padding = '';
                    
                    const newName = nameEl.textContent.trim();
                    if (!newName || newName === originalName) { 
                        nameEl.textContent = originalName; 
                        return; 
                    }
                    
                    const parent = findNodeById(resourceTree, id).parent;
                    const unique = ensureUniqueName(newName, (parent?.children || []).filter(n => n.id !== id));
                    node.name = unique;
                    renderResources();
                };
                
                const cancel = () => {
                    nameEl.setAttribute('contenteditable', 'false');
                    nameEl.style.background = '';
                    nameEl.style.border = '';
                    nameEl.style.borderRadius = '';
                    nameEl.style.padding = '';
                    nameEl.textContent = originalName;
                };
                
                nameEl.addEventListener('blur', commit, { once: true });
                nameEl.addEventListener('keydown', (ev) => { 
                    if (ev.key === 'Enter') { 
                        ev.preventDefault(); 
                        commit(); 
                    } else if (ev.key === 'Escape') {
                        ev.preventDefault();
                        cancel();
                    }
                });
            }
            
            if (e.target.closest('.res-delete')) {
                e.stopPropagation();
                const { node } = findNodeById(resourceTree, id) || {};
                if (!node) return;
                
                const itemType = node.type === 'folder' ? 'folder' : 'file';
                const itemCount = node.type === 'folder' && node.children ? ` (${node.children.length} items)` : '';
                const message = `Are you sure you want to delete this ${itemType} "${node.name}"${itemCount}?`;
                
                if (confirm(message)) {
                    const found = findNodeById(resourceTree, id);
                    if (!found || !found.parent) return;
                    found.parent.children = found.parent.children.filter(ch => ch.id !== id);
                    renderResources();
                }
            }
        });

        // Enhanced bulk actions with better UX
        const selectAll = resourcesEditor.querySelector('#res-select-all');
        const bulkMoveBtn = resourcesEditor.querySelector('#res-bulk-move');
        const bulkDeleteBtn = resourcesEditor.querySelector('#res-bulk-delete');
        const bulkActions = resourcesEditor.querySelector('.admin-bulk-actions');

        const refreshBulkState = () => {
            const hasSel = selection.size > 0;
            
            // Update bulk actions visibility
            if (hasSel) {
                bulkActions.classList.remove('hidden');
                bulkActions.querySelector('span').textContent = `${selection.size} selected`;
            } else {
                bulkActions.classList.add('hidden');
            }
            
            // Update select all checkbox
            const currentNode = getNodeAtPath(resourceTree, currentResourcePath);
            const currentIds = new Set((currentNode.children||[]).map(n => n.id));
            const allChecked = (currentNode.children||[]).length > 0 && [...currentIds].every(id => selection.has(id));
            const someChecked = [...currentIds].some(id => selection.has(id));
            
            selectAll.checked = allChecked;
            selectAll.indeterminate = someChecked && !allChecked;
        };
        refreshBulkState();

        selectAll.addEventListener('change', (e) => {
            const currentNode = getNodeAtPath(resourceTree, currentResourcePath);
            (currentNode.children || []).forEach(n => { 
                if (e.target.checked) selection.add(n.id); 
                else selection.delete(n.id); 
            });
            renderResources();
        });

        bulkDeleteBtn.addEventListener('click', () => {
            if (selection.size === 0) return;
            const count = selection.size;
            const message = count === 1 ? 
                'Are you sure you want to delete this item?' : 
                `Are you sure you want to delete these ${count} items?`;
            
            if (confirm(message)) {
                // remove selected from their parents
                const toRemove = new Set(selection);
                const removeRec = (node) => {
                    if (node.children) {
                        node.children = node.children.filter(ch => !toRemove.has(ch.id));
                        node.children.forEach(removeRec);
                    }
                };
                removeRec(resourceTree);
                selection.clear();
                renderResources();
            }
        });

        bulkMoveBtn.addEventListener('click', () => {
            if (selection.size === 0) return;
            openMoveModal([...selection]);
        });

        // Keyboard navigation
        let focusIndex = 0;
        const focusables = Array.from(listEl.querySelectorAll('.resource-item'));
        const setFocus = (idx) => {
            if (focusables.length === 0) return;
            focusIndex = Math.max(0, Math.min(idx, focusables.length - 1));
            focusables.forEach((el, i) => el.setAttribute('tabindex', i === focusIndex ? '0' : '-1'));
            focusables[focusIndex].focus();
        };
        listEl.addEventListener('keydown', (ev) => {
            if (['ArrowDown','ArrowRight'].includes(ev.key)) { ev.preventDefault(); setFocus(focusIndex + 1); }
            if (['ArrowUp','ArrowLeft'].includes(ev.key)) { ev.preventDefault(); setFocus(focusIndex - 1); }
            if (ev.key === 'Enter') {
                const el = focusables[focusIndex];
                if (!el) return;
                const id = el.dataset.id;
                const { node } = findNodeById(resourceTree, id) || {};
                if (!node) return;
                if (node.type === 'folder') { currentResourcePath = [...currentResourcePath, node.name]; renderResources(); }
                else { const a = el.querySelector('a'); if (a) a.click(); }
            }
            if (ev.key === ' ') {
                ev.preventDefault();
                const el = focusables[focusIndex];
                if (!el) return;
                const id = el.dataset.id;
                const checked = selection.has(id);
                toggleSelect(id, !checked);
                // toggle checkbox visual
                const cb = el.querySelector('.res-select');
                if (cb) cb.checked = !checked;
                refreshBulkState();
            }
            if (ev.key === 'Delete') {
                if (selection.size === 0 && focusables[focusIndex]) selection.add(focusables[focusIndex].dataset.id);
                bulkDeleteBtn.click();
            }
            if (ev.key.toLowerCase() === 'm') { // move
                if (selection.size === 0 && focusables[focusIndex]) selection.add(focusables[focusIndex].dataset.id);
                bulkMoveBtn.click();
            }
        });
        // initialize initial focus
        setFocus(0);


    function toggleSelect(id, on) {
        if (on) selection.add(id); else selection.delete(id);
        // do not re-render here; allow caller to manage
    }
        // Enhanced view toggle with visual feedback
        const viewGridBtn = resourcesEditor.querySelector('#res-view-grid');
        const viewListBtn = resourcesEditor.querySelector('#res-view-list');
        
        // Update button states
        const updateViewButtons = () => {
            viewGridBtn.setAttribute('aria-pressed', viewModeResources === 'grid');
            viewListBtn.setAttribute('aria-pressed', viewModeResources === 'list');
            
            if (viewModeResources === 'grid') {
                viewGridBtn.style.background = 'var(--primary-color)';
                viewGridBtn.style.color = 'white';
                viewListBtn.style.background = '';
                viewListBtn.style.color = '';
                listEl.className = 'resource-grid';
            } else {
                viewListBtn.style.background = 'var(--primary-color)';
                viewListBtn.style.color = 'white';
                viewGridBtn.style.background = '';
                viewGridBtn.style.color = '';
                listEl.className = 'resource-list';
            }
        };
        updateViewButtons();
        
        viewGridBtn.addEventListener('click', () => {
            viewModeResources = 'grid';
            localStorage.setItem('adminResourceView', viewModeResources);
            updateViewButtons();
        });
        
        viewListBtn.addEventListener('click', () => {
            viewModeResources = 'list';
            localStorage.setItem('adminResourceView', viewModeResources);
            updateViewButtons();
        });
    }

    function handleUploadFiles(files) {
        const parent = getNodeAtPath(resourceTree, currentResourcePath);
        parent.children = parent.children || [];
        const readers = files.map(file => new Promise((resolve) => {
            const r = new FileReader();
            r.onload = () => resolve({ file, dataUrl: r.result });
            r.readAsDataURL(file);
        }));
        Promise.all(readers).then(results => {
            for (const { file, dataUrl } of results) {
                const unique = ensureUniqueName(file.name, parent.children);
                parent.children.push({ id: uid(), name: unique, type: 'file', url: dataUrl });
            }
            renderResources();
        });
    }

    function isDescendant(possibleParent, child) {
        if (possibleParent === child) return true;
        if (possibleParent.type !== 'folder' || !possibleParent.children) return false;
        return possibleParent.children.some(ch => isDescendant(ch, child));
    }

    function moveItemIntoFolder(itemId, targetFolderId) {
        const foundItem = findNodeById(resourceTree, itemId);
        const foundTarget = findNodeById(resourceTree, targetFolderId);
        if (!foundItem || !foundTarget) return;
        const { node: itemNode, parent: itemParent } = foundItem;
        const { node: targetNode } = foundTarget;
        if (targetNode.type !== 'folder') return;
        // prevent moving folder into itself/descendant
        if (itemNode.type === 'folder' && isDescendant(itemNode, targetNode)) return;
        // remove from old parent
        if (itemParent) {
            itemParent.children = itemParent.children.filter(ch => ch.id !== itemNode.id);
        }
        // ensure unique name within target
        targetNode.children = targetNode.children || [];
        itemNode.name = ensureUniqueName(itemNode.name, targetNode.children);
        targetNode.children.push(itemNode);
        renderResources();
    }

    function openMoveModal(ids) {
        const modal = document.getElementById('move-modal');
        const targetSelect = modal.querySelector('#move-target');
        // build folder options
        const folders = [];
        const walk = (node, path=[]) => {
            if (node.type === 'folder') {
                folders.push({ id: node.id, path: path.join('/') || 'Home' });
                (node.children||[]).forEach(ch => walk(ch, [...path, ch.name]));
            }
        };
        walk(resourceTree, []);
        targetSelect.innerHTML = folders.map(f => `<option value="${f.id}">${f.path}</option>`).join('');
    const show = () => { modal.style.display = 'block'; modal.setAttribute('aria-hidden', 'false'); targetSelect.focus(); };
        const hide = () => { modal.style.display = 'none'; modal.setAttribute('aria-hidden', 'true'); };
        show();
        const onConfirm = () => {
            const destId = targetSelect.value;
            ids.forEach(id => moveItemIntoFolder(id, destId));
            selection.clear();
            hide();
        };
        const onCancel = () => { hide(); };
        modal.querySelector('#move-confirm').onclick = onConfirm;
        modal.querySelector('#move-cancel').onclick = onCancel;
        modal.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); hide(); } });
    }

    function renderTimetable() {
        const editor = document.getElementById('timetable-editor');
        editor.innerHTML = `
            <div class="item card">
                <label style="display:block; margin-bottom:8px; font-weight:600;">Upload Timetable (Image or PDF)</label>
                <input type="file" id="timetable-file" accept="image/*,application/pdf">
                <div style="margin:12px 0; color: var(--text-color-soft); font-size: 0.9rem;">or paste a public link:</div>
                <input type="text" id="timetable-url" placeholder="https://.../timetable.pdf or .png/.jpg" value="${timetableData.url || ''}">
                <div style="margin-top:10px; display:flex; gap:12px; align-items:center;">
                    <label for="timetable-type"><strong>Type:</strong></label>
                    <select id="timetable-type">
                        <option value="image" ${timetableData.type === 'image' ? 'selected' : ''}>Image</option>
                        <option value="pdf" ${timetableData.type === 'pdf' ? 'selected' : ''}>PDF</option>
                    </select>
                </div>
                <div id="timetable-preview" style="margin-top:16px;"></div>
            </div>
        `;

        const urlInput = editor.querySelector('#timetable-url');
        const typeSelect = editor.querySelector('#timetable-type');
        const fileInput = editor.querySelector('#timetable-file');
        const preview = editor.querySelector('#timetable-preview');

        const updatePreview = () => {
            preview.innerHTML = '';
            const url = timetableData.url;
            if (!url) return;
            if (timetableData.type === 'pdf' || (url.toLowerCase().endsWith('.pdf'))) {
                const iframe = document.createElement('iframe');
                iframe.src = url;
                iframe.style.width = '100%';
                iframe.style.height = '400px';
                iframe.style.border = '1px solid var(--border-color)';
                preview.appendChild(iframe);
            } else {
                const img = document.createElement('img');
                img.src = url;
                img.alt = 'Timetable preview';
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                img.style.display = 'block';
                img.style.border = '1px solid var(--border-color)';
                img.style.borderRadius = '8px';
                preview.appendChild(img);
            }
        };

        // initial preview
        updatePreview();

        editor.addEventListener('change', (e) => {
            if (e.target.id === 'timetable-url') {
                timetableData.url = e.target.value;
                updatePreview();
            }
            if (e.target.id === 'timetable-type') {
                timetableData.type = e.target.value;
                updatePreview();
            }
        });

        fileInput.addEventListener('change', () => {
            const file = fileInput.files && fileInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result;
                timetableData.url = result;
                if (file.type.startsWith('image/')) {
                    timetableData.type = 'image';
                } else if (file.type === 'application/pdf') {
                    timetableData.type = 'pdf';
                }
                // reflect in controls
                urlInput.value = timetableData.url;
                typeSelect.value = timetableData.type;
                updatePreview();
            };
            reader.readAsDataURL(file);
        });
    }

    // Add new items
    document.getElementById('add-announcement').addEventListener('click', () => {
        announcementsData.unshift({ title: 'New Announcement', date: new Date().toISOString().split('T')[0], description: '' });
        renderAnnouncements();
    });

    document.getElementById('add-event').addEventListener('click', () => {
        eventsData.unshift({ title: 'New Event', date: new Date().toISOString().split('T')[0], description: '', form_url: '' });
        renderEvents();
    });

    // (old resources list add button removed in Drive-like UI)

    // Update data on input change
    announcementsEditor.addEventListener('change', (e) => {
        const index = e.target.dataset.index;
        const field = e.target.dataset.field;
        announcementsData[index][field] = e.target.value;
    });

    eventsEditor.addEventListener('change', (e) => {
        const index = e.target.dataset.index;
        const field = e.target.dataset.field;
        eventsData[index][field] = e.target.value;
    });

    // (legacy input change handler removed; Drive-like UI manages state directly)
    
    // Delete items with confirmation
    function showConfirmationModal(callback) {
        deleteCallback = callback;
        confirmationModal.style.display = 'block';
    }

    confirmDeleteBtn.addEventListener('click', () => {
        if (deleteCallback) {
            deleteCallback();
        }
        confirmationModal.style.display = 'none';
        deleteCallback = null;
    });

    cancelDeleteBtn.addEventListener('click', () => {
        confirmationModal.style.display = 'none';
        deleteCallback = null;
    });

    // Global ESC to close any open modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const openModals = Array.from(document.querySelectorAll('.modal')).filter(m => getComputedStyle(m).display !== 'none');
            openModals.forEach(m => m.style.display = 'none');
        }
    });

    announcementsEditor.addEventListener('click', (e) => {
        if (e.target.closest('.delete-announcement')) {
            const index = e.target.closest('.delete-announcement').dataset.index;
            showConfirmationModal(() => {
                announcementsData.splice(index, 1);
                renderAnnouncements();
            });
        }
    });

    eventsEditor.addEventListener('click', (e) => {
        if (e.target.closest('.delete-event')) {
            const index = e.target.closest('.delete-event').dataset.index;
            showConfirmationModal(() => {
                eventsData.splice(index, 1);
                renderEvents();
            });
        }
    });

    resourcesEditor.addEventListener('click', (e) => {
        if (e.target.closest('.delete-resource')) {
            const index = e.target.closest('.delete-resource').dataset.index;
            const category = e.target.closest('.delete-resource').dataset.category;
            showConfirmationModal(() => {
                resourcesData[category].splice(index, 1);
                renderResources();
            });
        }
    });

    // Save and download
    // ===== SAVE TO API (Instead of downloading JSON) =====
    
    // Status message helper
    const showStatus = (message, type = 'info') => {
        // Remove existing status messages
        document.querySelectorAll('.status-message').forEach(el => el.remove());
        
        const statusEl = document.createElement('div');
        statusEl.className = `status-message status-${type}`;
        statusEl.textContent = message;
        statusEl.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            padding: 12px 20px; border-radius: 6px; color: white;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        `;
        document.body.appendChild(statusEl);
        
        setTimeout(() => statusEl.remove(), 3000);
    };

    async function saveAnnouncements() {
        try {
            showStatus('Saving announcements...', 'info');
            await window.API.call(window.CONFIG.ENDPOINTS.ANNOUNCEMENTS, {
                method: 'PUT',
                body: JSON.stringify({ items: announcementsData })
            });
            showStatus('Announcements saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving announcements:', error);
            showStatus('Failed to save announcements', 'error');
        }
    }

    async function saveEvents() {
        try {
            showStatus('Saving events...', 'info');
            await window.API.call(window.CONFIG.ENDPOINTS.EVENTS, {
                method: 'PUT',
                body: JSON.stringify({ items: eventsData })
            });
            showStatus('Events saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving events:', error);
            showStatus('Failed to save events', 'error');
        }
    }

    async function saveResources() {
        try {
            showStatus('Saving resources...', 'info');
            // Clean the tree (remove IDs) before sending
            const clean = JSON.parse(JSON.stringify(resourceTree));
            const stripIds = (n) => { delete n.id; if (n.children) n.children.forEach(stripIds); };
            stripIds(clean);
            
            console.log('🌳 Frontend: Saving resources tree:', clean);
            console.log('🌳 Tree structure check:', {
                hasName: !!clean.name,
                type: clean.type,
                hasChildren: Array.isArray(clean.children),
                childrenCount: clean.children?.length || 0
            });
            
            await window.API.call(window.CONFIG.ENDPOINTS.RESOURCES, {
                method: 'PUT',
                body: JSON.stringify(clean)
            });
            showStatus('Resources saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving resources:', error);
            console.error('Error details:', error.message);
            showStatus('Failed to save resources', 'error');
        }
    }

    async function saveTimetable() {
        try {
            showStatus('Saving timetable...', 'info');
            await window.API.call(window.CONFIG.ENDPOINTS.TIMETABLE, {
                method: 'PUT',
                body: JSON.stringify(timetableData)
            });
            showStatus('Timetable saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving timetable:', error);
            showStatus('Failed to save timetable', 'error');
        }
    }

    document.getElementById('save-announcements').addEventListener('click', saveAnnouncements);
    document.getElementById('save-events').addEventListener('click', saveEvents);
    document.getElementById('save-resources').addEventListener('click', saveResources);
    document.getElementById('save-timetable').addEventListener('click', saveTimetable);

    // Logout
    document.getElementById('logout-button').addEventListener('click', () => {
        sessionStorage.removeItem('isAdmin');
        window.location.href = 'login.html';
    });
});
