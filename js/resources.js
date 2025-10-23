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
        sheet: 'fa-file-excel',
        slide: 'fa-file-powerpoint',
        video: 'fa-file-video',
        link: 'fa-up-right-from-square',
        file: 'fa-file'
    };

    const detectIcon = (url, title) => {
        const t = (title || '').toLowerCase();
        const u = (url || '').toLowerCase();
        if (u.endsWith('.pdf') || t.includes('pdf')) return ICONS.pdf;
        if (u.includes('docs.google.com/document')) return ICONS.doc;
        if (u.includes('docs.google.com/spreadsheets')) return ICONS.sheet;
        if (u.includes('docs.google.com/presentation')) return ICONS.slide;
        if (u.includes('dropbox') || u.endsWith('.mp4') || t.includes('record')) return ICONS.video;
        if (u.startsWith('http')) return ICONS.link;
        return ICONS.file;
    };

    const buildTreeFromLegacy = (data) => ({
        name: 'Resources',
        type: 'folder',
        children: [
            { name: 'Notes', type: 'folder', children: (data.notes || []).map(x => ({ name: x.title, type: 'file', url: x.url })) },
            { name: 'Slides', type: 'folder', children: (data.slides || []).map(x => ({ name: x.title, type: 'file', url: x.url })) },
            { name: 'Recordings', type: 'folder', children: (data.recordings || []).map(x => ({ name: x.title, type: 'file', url: x.url })) },
            { name: 'External Links', type: 'folder', children: (data.external_links || []).map(x => ({ name: x.title, type: 'file', url: x.url })) }
        ]
    });

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
        const parts = ['Home', ...currentPath];
        breadcrumb.innerHTML = parts.map((p, idx) => {
            if (idx === 0) {
                return `<button class="crumb" data-index="0"><i class="fa-solid fa-house"></i> Home</button>`;
            }
            return `<button class="crumb" data-index="${idx}">${p}</button>`;
        }).join('<span class="crumb-sep">/</span>');

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
        // filters (only apply to files)
        const subj = (filterSubject && filterSubject.value) || '';
        const sem = (filterSemester && filterSemester.value) || '';
        const ftype = (filterType && filterType.value) || '';
        items = items.filter(ch => {
            if (ch.type === 'folder') return true;
            if (subj && (!ch.tags || ch.tags.subject !== subj)) return false;
            if (sem && (!ch.tags || ch.tags.semester !== sem)) return false;
            if (ftype) {
                const icon = detectIcon(ch.url, ch.name);
                const map = { 'PDF':'fa-file-pdf', 'Doc':'fa-file-word', 'Sheet':'fa-file-excel', 'Slide':'fa-file-powerpoint', 'Video':'fa-file-video', 'Link':'fa-up-right-from-square' };
                if (map[ftype] !== icon) return false;
            }
            return true;
        });

        explorer.classList.toggle('resource-grid', viewMode === 'grid');
        explorer.classList.toggle('resource-list', viewMode === 'list');
        explorer.innerHTML = '';

        if (items.length === 0) {
            explorer.innerHTML = `<div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>No items here.</p></div>`;
            return;
        }

        // Folders first, then files
        items.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });

        items.forEach((item, idx) => {
            if (item.type === 'folder') {
                const el = document.createElement('button');
                el.className = 'resource-item folder';
                el.setAttribute('role', 'listitem');
                el.innerHTML = `
                    <div class="icon"><i class="fa-solid ${ICONS.folder}"></i></div>
                    <div class="meta">
                        <div class="name">${item.name}</div>
                        <div class="sub">Folder</div>
                    </div>
                `;
                el.addEventListener('click', () => {
                    currentPath = [...currentPath, item.name];
                    render();
                });
                explorer.appendChild(el);
            } else {
                const icon = detectIcon(item.url, item.name);
                const a = document.createElement('a');
                a.className = 'resource-item file';
                a.setAttribute('role', 'listitem');
                a.href = item.url;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                const subj = item.tags?.subject ? `<span class="badge" style="margin-left:6px;">${item.tags.subject}</span>` : '';
                const sem = item.tags?.semester ? `<span class="badge" style="margin-left:6px;">${item.tags.semester}</span>` : '';
        const ext = (item.name.split('.').pop() || '').toUpperCase();
                a.innerHTML = `
                    <div class="icon"><i class="fa-solid ${icon}"></i></div>
                    <div class="meta">
                        <div class="name">${item.name}</div>
            <div class="sub">File <span class="badge" data-kind="ext-${ext}" style="margin-left:6px;">${ext}</span>${subj}${sem}</div>
                    </div>
                `;
                explorer.appendChild(a);
            }
        });
    };

    const render = () => {
        renderBreadcrumb();
        renderExplorer();
    };

    // View toggle
    const updateViewButtons = () => {
        viewGridBtn.setAttribute('aria-pressed', (viewMode === 'grid').toString());
        viewListBtn.setAttribute('aria-pressed', (viewMode === 'list').toString());
    };
    viewGridBtn.addEventListener('click', () => {
        viewMode = 'grid';
        localStorage.setItem('resourceView', viewMode);
        updateViewButtons();
        renderExplorer();
    });
    viewListBtn.addEventListener('click', () => {
        viewMode = 'list';
        localStorage.setItem('resourceView', viewMode);
        updateViewButtons();
        renderExplorer();
    });

    // Search
    searchInput.addEventListener('input', () => {
        renderExplorer();
    });

    // Load data and bootstrap
    fetch('data/resources.json')
        .then(r => r.json())
        .then(data => {
            // If already hierarchical (has name/type/children), use as-is; else adapt
            if (data && data.type === 'folder' && Array.isArray(data.children)) {
                fullTree = data;
            } else {
                fullTree = buildTreeFromLegacy(data || {});
            }
            // Initialize UI state
            updateViewButtons();
        // populate filters from tree (collect distinct)
        const allFiles = [];
        const walk = (n) => { if (n.type === 'file') allFiles.push(n); (n.children||[]).forEach(walk); };
        walk(fullTree);
        const subjects = [...new Set(allFiles.map(f => f.tags?.subject).filter(Boolean))].sort();
        const semesters = [...new Set(allFiles.map(f => f.tags?.semester).filter(Boolean))].sort();
        if (filterSubject) filterSubject.innerHTML = ['<option value="">All Subjects</option>', ...subjects.map(s => `<option>${s}</option>`)].join('');
        if (filterSemester) filterSemester.innerHTML = ['<option value="">All Semesters</option>', ...semesters.map(s => `<option>${s}</option>`)].join('');
        render();
        })
        .catch(err => {
            console.error('Failed to load resources:', err);
            explorer.innerHTML = `<div class="empty-state"><i class=\"fa-solid fa-triangle-exclamation\"></i><p>Could not load resources.</p></div>`;
        });

    // filters change handlers
    if (filterSubject) filterSubject.addEventListener('change', renderExplorer);
    if (filterSemester) filterSemester.addEventListener('change', renderExplorer);
    if (filterType) filterType.addEventListener('change', renderExplorer);
});
