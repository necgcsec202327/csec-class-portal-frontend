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

    // Load existing data
    fetch('../data/announcements.json')
        .then(response => response.json())
        .then(data => {
            announcementsData = data;
            renderAnnouncements();
        });

    fetch('../data/events.json')
        .then(response => response.json())
        .then(data => {
            eventsData = data;
            renderEvents();
        });
    
    fetch('../data/resources.json')
        .then(response => response.json())
        .then(data => {
            // Normalize to hierarchical tree
            if (data && data.type === 'folder' && Array.isArray(data.children)) {
                resourceTree = addIdsToTree(data);
            } else {
                resourceTree = legacyToTree(data || {});
            }
            renderResources();
        })
        .catch(() => {
            // start with empty tree
            resourceTree = { id: uid(), name: 'Resources', type: 'folder', children: [] };
            renderResources();
        });

    fetch('../data/timetable.json')
        .then(response => response.json())
        .then(data => {
            timetableData = Object.assign({ url: '', type: 'image' }, data || {});
            renderTimetable();
        })
        .catch(() => renderTimetable());

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
        // Toolbar + breadcrumb + controls
        resourcesEditor.innerHTML = `
            <div class="resource-toolbar">
                <div class="left-actions" style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button id="res-new-folder" class="button-secondary"><i class="fa-solid fa-folder-plus"></i> New Folder</button>
                    <label class="button-secondary" style="cursor:pointer;">
                        <input type="file" id="res-upload" style="display:none;" multiple>
                        <i class="fa-solid fa-upload"></i> Upload Files
                    </label>
                    <button id="res-new-link" class="button-secondary"><i class="fa-solid fa-link"></i> New Link</button>
                    <span style="width:1px; height:28px; background:var(--border-color);"></span>
                    <label style="display:flex; align-items:center; gap:6px;">
                        <input type="checkbox" id="res-select-all" /> Select all
                    </label>
                    <button id="res-bulk-move" class="button-secondary" disabled><i class="fa-solid fa-folder-open"></i> Move Selected</button>
                    <button id="res-bulk-delete" class="button-danger" disabled><i class="fa-solid fa-trash"></i> Delete Selected</button>
                </div>
                <div class="view-toggle">
                    <button id="res-view-grid" class="button-secondary" aria-pressed="${viewModeResources==='grid'}"><i class="fa-solid fa-border-all"></i></button>
                    <button id="res-view-list" class="button-secondary" aria-pressed="${viewModeResources==='list'}"><i class="fa-solid fa-list"></i></button>
                </div>
            </div>
            <div id="res-breadcrumb" class="breadcrumb" aria-label="Folder breadcrumb"></div>
            <div id="res-dropzone" class="card" style="padding:0;">
                <div id="res-list" class="${viewModeResources==='grid' ? 'resource-grid' : 'resource-list'}" style="padding:16px;" tabindex="0" role="list"></div>
            </div>
            <p style="margin-top:8px; color: var(--text-color-soft); font-size: 0.9rem;">Tip: Drag files here from your computer to upload. Drag items onto folders to move.</p>

            <!-- Move dialog -->
            <div id="move-modal" class="modal" aria-hidden="true" aria-labelledby="move-modal-title" role="dialog">
                <div class="modal-content" role="document">
                    <h2 id="move-modal-title">Move to</h2>
                    <label for="move-target">Select destination folder</label>
                    <select id="move-target" style="width:100%; margin-top:8px;"></select>
                    <div class="modal-actions">
                        <button id="move-confirm" class="button-primary">Move</button>
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

        // Current items
        const node = getNodeAtPath(resourceTree, currentResourcePath);
        const items = [...(node.children || [])].sort((a,b) => (a.type===b.type? a.name.localeCompare(b.name) : (a.type==='folder'?-1:1)));

        if (items.length === 0) {
            listEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-folder-open"></i><p>No items here.</p></div>`;
        } else {
            listEl.innerHTML = '';
            items.forEach((item, idx) => {
                if (item.type === 'folder') {
                    const el = document.createElement('div');
                    el.className = 'resource-item folder';
                    el.setAttribute('draggable', 'true');
                    el.setAttribute('role', 'listitem');
                    el.setAttribute('tabindex', idx === 0 ? '0' : '-1');
                    el.dataset.id = item.id;
                    el.innerHTML = `
                        <input type="checkbox" class="res-select" aria-label="Select ${item.name}" ${selection.has(item.id)?'checked':''} />
                        <div class="icon"><i class="fa-solid fa-folder"></i></div>
                        <div class="meta">
                            <div class="name" contenteditable="false">${item.name}</div>
                            <div class="sub">Folder</div>
                        </div>
                        <div class="actions" style="margin-left:auto; display:flex; gap:6px;">
                            <button class="button-secondary res-rename" title="Rename"><i class="fa-solid fa-pen"></i></button>
                            <button class="button-secondary res-delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    `;
                    el.addEventListener('dblclick', () => { currentResourcePath = [...currentResourcePath, item.name]; renderResources(); });
                    el.querySelector('.res-select').addEventListener('click', (ev) => { ev.stopPropagation(); toggleSelect(item.id, ev.currentTarget.checked); });
                    // drag
                    el.addEventListener('dragstart', (ev) => { ev.dataTransfer.setData('text/plain', item.id); ev.dataTransfer.effectAllowed = 'move'; });
                    el.addEventListener('dragover', (ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; });
                    el.addEventListener('drop', (ev) => {
                        ev.preventDefault();
                        const dragId = ev.dataTransfer.getData('text/plain');
                        moveItemIntoFolder(dragId, item.id);
                    });
                    listEl.appendChild(el);
                } else {
                    const el = document.createElement('div');
                    el.className = 'resource-item file';
                    el.setAttribute('draggable', 'true');
                    el.setAttribute('role', 'listitem');
                    el.setAttribute('tabindex', idx === 0 ? '0' : '-1');
                    el.dataset.id = item.id;
                    const ext = (item.name.split('.').pop() || '').toUpperCase();
                    el.innerHTML = `
                        <input type="checkbox" class="res-select" aria-label="Select ${item.name}" ${selection.has(item.id)?'checked':''} />
                        <div class="icon"><i class="fa-solid fa-file"></i></div>
                        <div class="meta">
                            <div class="name" contenteditable="false">${item.name}</div>
                            <div class="sub">File <span class="badge" style="margin-left:6px;">${ext}</span>
                                <span class="badge" style="margin-left:6px;">${item.tags?.subject || 'Subject'}</span>
                                <span class="badge" style="margin-left:6px;">${item.tags?.semester || 'Semester'}</span>
                            </div>
                        </div>
                        <div class="actions" style="margin-left:auto; display:flex; gap:6px;">
                            <a class="button-secondary" href="${item.url}" target="_blank" rel="noopener" title="Open"><i class="fa-solid fa-up-right-from-square"></i></a>
                            <button class="button-secondary res-rename" title="Rename"><i class="fa-solid fa-pen"></i></button>
                            <button class="button-secondary res-delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
                        </div>
                        <div class="tags" style="display:flex; gap:6px; width:100%; margin-top:8px;">
                            <input class="tag-subject" type="text" placeholder="Subject" value="${item.tags?.subject || ''}" style="flex:1; padding:6px 8px; border:1px solid var(--border-color); border-radius:6px; background:var(--card-bg); color:var(--text-color);" />
                            <input class="tag-semester" type="text" placeholder="Semester" value="${item.tags?.semester || ''}" style="flex:1; padding:6px 8px; border:1px solid var(--border-color); border-radius:6px; background:var(--card-bg); color:var(--text-color);" />
                        </div>
                    `;
                    el.querySelector('.res-select').addEventListener('click', (ev) => { ev.stopPropagation(); toggleSelect(item.id, ev.currentTarget.checked); });
                    el.addEventListener('dragstart', (ev) => { ev.dataTransfer.setData('text/plain', item.id); ev.dataTransfer.effectAllowed = 'move'; });
                    // tag edits
                    el.querySelector('.tag-subject').addEventListener('change', (ev) => { item.tags = item.tags || {}; item.tags.subject = ev.target.value.trim(); });
                    el.querySelector('.tag-semester').addEventListener('change', (ev) => { item.tags = item.tags || {}; item.tags.semester = ev.target.value.trim(); });
                    listEl.appendChild(el);
                }
            });
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

        // Item actions (rename/delete)
        listEl.addEventListener('click', (e) => {
            const row = e.target.closest('.resource-item');
            if (!row) return;
            const id = row.dataset.id;
            if (e.target.closest('.res-rename')) {
                const { node } = findNodeById(resourceTree, id) || {};
                if (!node) return;
                // Toggle inline rename
                const nameEl = row.querySelector('.name');
                nameEl.setAttribute('contenteditable', 'true');
                nameEl.focus();
                const commit = () => {
                    nameEl.setAttribute('contenteditable', 'false');
                    const newName = nameEl.textContent.trim();
                    if (!newName || newName === node.name) { nameEl.textContent = node.name; return; }
                    const parent = findNodeById(resourceTree, id).parent;
                    const unique = ensureUniqueName(newName, (parent?.children || []).filter(n => n.id !== id));
                    node.name = unique;
                    renderResources();
                };
                nameEl.addEventListener('blur', commit, { once: true });
                nameEl.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); commit(); } });
            }
            if (e.target.closest('.res-delete')) {
                showConfirmationModal(() => {
                    const found = findNodeById(resourceTree, id);
                    if (!found || !found.parent) return;
                    found.parent.children = found.parent.children.filter(ch => ch.id !== id);
                    renderResources();
                });
            }
        });

        // Select all + bulk buttons state
        const selectAll = resourcesEditor.querySelector('#res-select-all');
        const bulkMoveBtn = resourcesEditor.querySelector('#res-bulk-move');
        const bulkDeleteBtn = resourcesEditor.querySelector('#res-bulk-delete');

        const refreshBulkState = () => {
            const hasSel = selection.size > 0;
            bulkMoveBtn.disabled = !hasSel;
            bulkDeleteBtn.disabled = !hasSel;
            // set selectAll based on current folder items
            const node = getNodeAtPath(resourceTree, currentResourcePath);
            const ids = new Set((node.children||[]).map(n => n.id));
            const allChecked = (node.children||[]).length > 0 && [...ids].every(id => selection.has(id));
            selectAll.checked = allChecked;
        };
        refreshBulkState();

        selectAll.addEventListener('change', (e) => {
            const node = getNodeAtPath(resourceTree, currentResourcePath);
            (node.children || []).forEach(n => { if (e.target.checked) selection.add(n.id); else selection.delete(n.id); });
            renderResources();
        });

        bulkDeleteBtn.addEventListener('click', () => {
            if (selection.size === 0) return;
            showConfirmationModal(() => {
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
            });
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
        // View toggle
        resourcesEditor.querySelector('#res-view-grid').addEventListener('click', () => {
            viewModeResources = 'grid';
            localStorage.setItem('adminResourceView', viewModeResources);
            renderResources();
        });
        resourcesEditor.querySelector('#res-view-list').addEventListener('click', () => {
            viewModeResources = 'list';
            localStorage.setItem('adminResourceView', viewModeResources);
            renderResources();
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
    document.getElementById('save-announcements').addEventListener('click', () => {
        downloadJSON(announcementsData, 'announcements.json');
    });

    document.getElementById('save-events').addEventListener('click', () => {
        downloadJSON(eventsData, 'events.json');
    });

    document.getElementById('save-resources').addEventListener('click', () => {
        // Save hierarchical tree (strip runtime-only ids for cleanliness)
        const clean = JSON.parse(JSON.stringify(resourceTree));
        const stripIds = (n) => { delete n.id; if (n.children) n.children.forEach(stripIds); };
        stripIds(clean);
        downloadJSON(clean, 'resources.json');
    });

    document.getElementById('save-timetable').addEventListener('click', () => {
        downloadJSON(timetableData, 'timetable.json');
    });

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

    // Logout
    document.getElementById('logout-button').addEventListener('click', () => {
        sessionStorage.removeItem('isAdmin');
        window.location.href = 'login.html';
    });
});
