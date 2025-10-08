document.addEventListener('DOMContentLoaded', () => {
    const explorer = document.getElementById('resource-explorer');
    const breadcrumb = document.getElementById('resource-breadcrumb');
    const searchInput = document.getElementById('resource-search-input');
    const filterSubject = document.getElementById('filter-subject');
    const filterSemester = document.getElementById('filter-semester');
    const filterType = document.getElementById('filter-type');
    const viewGridBtn = document.getElementById('view-grid');
    const viewListBtn = document.getElementById('view-list');

    let currentPath = []; // array of folder names
    let fullTree = null;
    let viewMode = localStorage.getItem('resourceView') || 'grid';

    const ICONS = {
        folder: 'fa-folder',
        pdf: 'fa-file-pdf',
        doc: 'fa-file-word',
        docx: 'fa-file-word',
        ppt: 'fa-file-powerpoint',
        pptx: 'fa-file-powerpoint',
        xls: 'fa-file-excel',
        xlsx: 'fa-file-excel',
        jpg: 'fa-file-image',
        jpeg: 'fa-file-image',
        png: 'fa-file-image',
        gif: 'fa-file-image',
        mp4: 'fa-file-video',
        avi: 'fa-file-video',
        mov: 'fa-file-video',
        txt: 'fa-file-text',
        zip: 'fa-file-zipper',
        rar: 'fa-file-zipper',
        link: 'fa-up-right-from-square',
        file: 'fa-file'
    };

    const detectIcon = (name, url) => {
        const fileName = (name || '').toLowerCase();
        const fileUrl = (url || '').toLowerCase();
        
        // Check by file extension
        const ext = fileName.split('.').pop();
        if (ICONS[ext]) return ICONS[ext];
        
        // Check by URL patterns
        if (fileUrl.includes('docs.google.com/document')) return ICONS.doc;
        if (fileUrl.includes('docs.google.com/spreadsheets')) return ICONS.xls;
        if (fileUrl.includes('docs.google.com/presentation')) return ICONS.ppt;
        if (fileUrl.startsWith('http')) return ICONS.link;
        
        // Check by data URL
        if (fileUrl.startsWith('data:application/pdf')) return ICONS.pdf;
        if (fileUrl.startsWith('data:image/')) return ICONS.jpg;
        if (fileUrl.startsWith('data:application/vnd.openxmlformats-officedocument.presentationml.presentation')) return ICONS.pptx;
        if (fileUrl.startsWith('data:application/vnd.openxmlformats-officedocument.wordprocessingml.document')) return ICONS.docx;
        if (fileUrl.startsWith('data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) return ICONS.xlsx;
        
        return ICONS.file;
    };

    const getFileSize = (dataUrl) => {
        if (!dataUrl || !dataUrl.startsWith('data:')) return '';
        try {
            const base64 = dataUrl.split(',')[1];
            const bytes = (base64.length * 3) / 4;
            if (bytes < 1024) return `${Math.round(bytes)} B`;
            if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
            return `${Math.round(bytes / (1024 * 1024) * 10) / 10} MB`;
        } catch (e) {
            return '';
        }
    };

    const downloadFile = (item) => {
        if (!item.url || !item.url.startsWith('data:')) {
            // External URL - open in new tab
            window.open(item.url, '_blank');
            return;
        }

        // Base64 data - create download
        try {
            const link = document.createElement('a');
            link.href = item.url;
            link.download = item.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error('Download failed:', e);
            alert('Failed to download file');
        }
    };

    // Navigate in tree structure
    const getNodeAtPath = (tree, pathArr) => {
        let node = tree;
        for (const segment of pathArr) {
            if (!node.children) return node;
            const next = node.children.find(ch => ch.type === 'folder' && ch.name === segment);
            if (!next) return node;
            node = next;
        }
        return node;
    };

    const renderBreadcrumb = () => {
        const parts = ['Resources', ...currentPath];
        breadcrumb.innerHTML = parts.map((p, idx) => {
            if (idx === 0) {
                return `<button class="crumb" data-index="0"><i class="fa-solid fa-house"></i> ${p}</button>`;
            }
            return `<button class="crumb" data-index="${idx}">${p}</button>`;
        }).join('<span class="crumb-sep"> / </span>');

        breadcrumb.querySelectorAll('.crumb').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetIndex = parseInt(e.currentTarget.getAttribute('data-index'));
                currentPath = currentPath.slice(0, targetIndex);
                render();
            });
        });
    };

    const renderExplorer = () => {
        const node = getNodeAtPath(fullTree, currentPath);
        const term = (searchInput.value || '').toLowerCase();
        let items = (node.children || []).filter(ch => ch.name.toLowerCase().includes(term));

        // Apply filters
        const ftype = (filterType && filterType.value) || '';
        items = items.filter(ch => {
            if (ch.type === 'folder') return true;
            if (ftype) {
                const ext = (ch.name.split('.').pop() || '').toUpperCase();
                if (ftype.toUpperCase() !== ext) return false;
            }
            return true;
        });

        explorer.classList.toggle('resource-grid', viewMode === 'grid');
        explorer.classList.toggle('resource-list', viewMode === 'list');
        explorer.innerHTML = '';

        if (items.length === 0) {
            explorer.innerHTML = `<div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>No items found.</p></div>`;
            return;
        }

        // Sort: folders first, then files alphabetically
        items.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });

        items.forEach((item) => {
            if (item.type === 'folder') {
                const el = document.createElement('button');
                el.className = 'resource-item folder';
                el.setAttribute('role', 'listitem');
                el.innerHTML = `
                    <div class="icon"><i class="fa-solid ${ICONS.folder}"></i></div>
                    <div class="meta">
                        <div class="name">${item.name}</div>
                        <div class="sub">Folder • ${(item.children || []).length} items</div>
                    </div>
                `;
                el.addEventListener('click', () => {
                    currentPath = [...currentPath, item.name];
                    render();
                });
                explorer.appendChild(el);
            } else {
                const icon = detectIcon(item.name, item.url);
                const ext = (item.name.split('.').pop() || '').toUpperCase();
                const size = getFileSize(item.url);
                
                const el = document.createElement('div');
                el.className = 'resource-item file';
                el.setAttribute('role', 'listitem');
                
                el.innerHTML = `
                    <div class="icon"><i class="fa-solid ${icon}"></i></div>
                    <div class="meta">
                        <div class="name">${item.name}</div>
                        <div class="sub">
                            ${ext} File
                            ${size ? ` • ${size}` : ''}
                        </div>
                    </div>
                    <div class="actions">
                        <button class="download-btn" title="Download">
                            <i class="fa-solid fa-download"></i>
                        </button>
                    </div>
                `;

                // Add download functionality
                const downloadBtn = el.querySelector('.download-btn');
                downloadBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    downloadFile(item);
                });

                // Make whole item clickable for download
                el.addEventListener('click', () => {
                    downloadFile(item);
                });

                explorer.appendChild(el);
            }
        });
    };

    const render = () => {
        renderBreadcrumb();
        renderExplorer();
    };

    // View toggle handlers
    const updateViewButtons = () => {
        if (viewGridBtn) viewGridBtn.setAttribute('aria-pressed', (viewMode === 'grid').toString());
        if (viewListBtn) viewListBtn.setAttribute('aria-pressed', (viewMode === 'list').toString());
    };

    if (viewGridBtn) {
        viewGridBtn.addEventListener('click', () => {
            viewMode = 'grid';
            localStorage.setItem('resourceView', viewMode);
            updateViewButtons();
            renderExplorer();
        });
    }

    if (viewListBtn) {
        viewListBtn.addEventListener('click', () => {
            viewMode = 'list';
            localStorage.setItem('resourceView', viewMode);
            updateViewButtons();
            renderExplorer();
        });
    }

    // Search handler
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderExplorer();
        });
    }

    // Load resources data
    window.API.get(window.CONFIG.ENDPOINTS.RESOURCES, 'resources.json')
        .then(data => {
            console.log('Resources data loaded:', data);
            
            if (data && data.type === 'folder' && Array.isArray(data.children)) {
                // New hierarchical format
                fullTree = data;
            } else if (data && typeof data === 'object') {
                // Legacy format - convert to hierarchical
                fullTree = {
                    name: 'Resources',
                    type: 'folder',
                    children: [
                        { name: 'Notes', type: 'folder', children: (data.notes || []).map(x => ({ name: x.title, type: 'file', url: x.url })) },
                        { name: 'Slides', type: 'folder', children: (data.slides || []).map(x => ({ name: x.title, type: 'file', url: x.url })) },
                        { name: 'Recordings', type: 'folder', children: (data.recordings || []).map(x => ({ name: x.title, type: 'file', url: x.url })) },
                        { name: 'External Links', type: 'folder', children: (data.external_links || []).map(x => ({ name: x.title, type: 'file', url: x.url })) }
                    ]
                };
            } else {
                // Empty state
                fullTree = {
                    name: 'Resources',
                    type: 'folder',
                    children: []
                };
            }

            // Initialize UI
            updateViewButtons();
            
            // Populate file type filter
            if (filterType) {
                const allFiles = [];
                const walk = (node) => {
                    if (node.type === 'file') allFiles.push(node);
                    (node.children || []).forEach(walk);
                };
                walk(fullTree);
                
                const extensions = [...new Set(allFiles.map(f => (f.name.split('.').pop() || '').toUpperCase()).filter(Boolean))].sort();
                filterType.innerHTML = ['<option value="">All Types</option>', ...extensions.map(ext => `<option value="${ext}">${ext}</option>`)].join('');
            }

            render();
        })
        .catch(err => {
            console.error('Failed to load resources:', err);
            explorer.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Could not load resources. Please try again later.</p></div>`;
        });

    // Filter change handlers
    if (filterType) filterType.addEventListener('change', renderExplorer);
    if (filterSubject) filterSubject.addEventListener('change', renderExplorer);
    if (filterSemester) filterSemester.addEventListener('change', renderExplorer);
});
