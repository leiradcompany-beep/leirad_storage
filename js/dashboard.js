// frontend/js/dashboard.js

// 1. Session & State Integrity
const user = (() => {
    try {
        return JSON.parse(localStorage.getItem('user'));
    } catch (e) {
        return null;
    }
})();

if (!user) window.location.href = 'login.html';

// Global Dashboard State
let currentFolderId = null;
let breadcrumbPath = [{ id: null, name: 'Root Hub' }];
let isTrashView = false;
let selectedFiles = new Set();
let selectedFolders = new Set();
let currentShareItem = null;
let currentRenameItem = null;

// DOM Cache
const dom = {
    fileList: () => document.getElementById('fileList'),
    fileInput: () => document.getElementById('fileInput'),
    dropZone: () => document.getElementById('dropZone'),
    userInfo: () => document.getElementById('userInfo'),
    mainActions: () => document.getElementById('mainActions'),
    bulkActions: () => document.getElementById('bulkActions'),
    selectedCount: () => document.getElementById('selectedCountText'),
    breadcrumbs: () => document.getElementById('breadcrumbs'),
    navFiles: () => document.getElementById('navAllFiles'),
    navTrash: () => document.getElementById('navTrash')
};

// 2. Initialization Sequence
document.addEventListener('DOMContentLoaded', () => {
    if (dom.userInfo()) {
        dom.userInfo().textContent = `Logged in as: ${user.username}`;
    }

    // Drag and Drop Listeners
    const zone = dom.dropZone();
    if (zone) {
        zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('drag-over'); };
        zone.ondragleave = () => zone.classList.remove('drag-over');
        zone.ondrop = (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            handleUpload(e.dataTransfer.files);
        };
    }

    // Input Listeners
    if (dom.fileInput()) {
        dom.fileInput().onchange = () => handleUpload(dom.fileInput().files);
    }

    loadFiles();
});

// 3. Core Loader
async function loadFiles(silent = false) {
    selectedFiles.clear();
    selectedFolders.clear();
    updateSelectionUI();

    const list = dom.fileList();
    if (!list) return;

    if (!silent) {
        list.innerHTML = `
            <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 0;">
                <i class="fas fa-circle-notch fa-spin" style="font-size: 2.5rem; color: var(--primary); margin-bottom: 1.5rem;"></i>
                <p style="color: var(--text-muted); font-size: 1.1rem; font-weight: 500;">Syncing your workspace...</p>
            </div>
        `;
    }

    try {
        const trashParam = isTrashView ? '&trash=true' : '';
        const [folders, files, allFiles] = await Promise.all([
            api.get(`folders.php?parent_id=${currentFolderId || ''}${trashParam}`),
            api.get(`files.php?folder_id=${currentFolderId || ''}${trashParam}`),
            api.get('files.php?all=true')
        ]);

        renderItems(folders || [], files || []);
        updateBreadcrumbs();
        updateStorageStats(allFiles || []);
    } catch (err) {
        console.error('Loader error:', err);
        list.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 2rem;">
                <i class="fas fa-triangle-exclamation" style="font-size: 3rem; color: var(--error); margin-bottom: 1rem;"></i>
                <p style="color: var(--text-main); font-weight: 600;">Connectivity Interrupted</p>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.5rem;">${err.message}</p>
                <button onclick="loadFiles()" class="btn btn-primary" style="margin-top: 1.5rem; padding: 0.5rem 1rem;">Re-establish Link</button>
            </div>
        `;
    }
}

// 4. Navigation Logic
function showTrash() {
    isTrashView = true;
    if (dom.mainActions()) dom.mainActions().style.display = 'none';
    if (dom.navFiles()) dom.navFiles().classList.remove('active');
    if (dom.navTrash()) dom.navTrash().classList.add('active');

    breadcrumbPath = [{ id: 'trash', name: 'Trash Archive' }];
    currentFolderId = null;
    loadFiles();
}

function navigateToRoot() {
    isTrashView = false;
    if (dom.mainActions()) dom.mainActions().style.display = 'flex';
    if (dom.navTrash()) dom.navTrash().classList.remove('active');
    if (dom.navFiles()) dom.navFiles().classList.add('active');

    breadcrumbPath = [{ id: null, name: 'Root Hub' }];
    currentFolderId = null;
    loadFiles();
}

function navigateToFolder(id, name) {
    if (isTrashView) return;
    currentFolderId = id;
    breadcrumbPath.push({ id, name });
    loadFiles();
}

function navigateToBreadcrumb(index) {
    const folder = breadcrumbPath[index];
    if (folder.id === 'trash') return showTrash();

    breadcrumbPath = breadcrumbPath.slice(0, index + 1);
    currentFolderId = folder.id;
    isTrashView = false;

    if (dom.mainActions()) dom.mainActions().style.display = 'flex';
    if (dom.navTrash()) dom.navTrash().classList.remove('active');
    if (dom.navFiles()) dom.navFiles().classList.add('active');

    loadFiles();
}

function updateBreadcrumbs() {
    const container = dom.breadcrumbs();
    if (!container) return;

    container.innerHTML = breadcrumbPath.map((folder, index) => {
        const isLast = index === breadcrumbPath.length - 1;
        return `
            <span onclick="navigateToBreadcrumb(${index})" class="breadcrumb-item ${isLast ? 'breadcrumb-current' : ''}" style="cursor: pointer;">
                ${folder.name}
            </span>
            ${!isLast ? '<i class="fas fa-chevron-right" style="font-size: 0.7rem; color: var(--text-muted); opacity: 0.5;"></i>' : ''}
        `;
    }).join('');
}

// 5. Item Rendering
function renderItems(folders, files) {
    const list = dom.fileList();
    const selectAll = document.getElementById('selectAllItems');
    if (selectAll) selectAll.checked = false;

    if (folders.length === 0 && files.length === 0) {
        list.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <i class="fa-solid fa-folder-open"></i>
                <h3>${isTrashView ? 'Trash Archive Empty' : 'Empty Hub'}</h3>
                <p>${isTrashView ? 'Your secure deletion queue is clear.' : 'Start protecting your assets by uploading or dragging them here.'}</p>
            </div>
        `;
        return;
    }

    let html = '';
    folders.forEach(f => html += createItemHTML(f, 'folder'));
    files.forEach(f => html += createItemHTML(f, 'file'));
    list.innerHTML = html;
}

function createItemHTML(item, type) {
    const id = item.id;
    const displayName = type === 'folder' ? item.name : item.original_name;
    const isSelected = type === 'folder' ? selectedFolders.has(id) : selectedFiles.has(id);

    const iconClass = type === 'folder' ? 'fa-folder' : 'fa-file-lines';
    const iconColor = type === 'folder' ? 'var(--folder-color)' : 'var(--primary-light)';
    const meta = type === 'folder' ? 'Collection' : formatSize(item.file_size);

    // Escape name for JS string
    const escapedName = displayName.replace(/'/g, "\\'");

    return `
        <div class="file-item ${isSelected ? 'selected' : ''}" data-id="${id}" data-type="${type}" data-name="${escapedName}"
             onclick="${type === 'folder' ? `navigateToFolder(${id}, '${escapedName}')` : ''}">
            <div style="position: absolute; top: 1.25rem; left: 1.25rem; z-index: 10;">
                <label class="custom-checkbox" onclick="event.stopPropagation()">
                    <input type="checkbox" onchange="toggleItemSelection(this, ${id}, '${type}')" ${isSelected ? 'checked' : ''}>
                    <span class="checkmark"></span>
                </label>
            </div>
            
            <div class="file-icon" style="background: rgba(255, 255, 255, 0.03); color: ${iconColor};">
                <i class="fas ${iconClass}"></i>
            </div>
            
            <div class="file-name" title="${displayName}">${displayName}</div>
            <div class="file-meta">${meta} ${isTrashView ? '<span style="color:var(--error);">(Deleted)</span>' : ''}</div>

            <div class="dropdown-dots" onclick="event.stopPropagation(); showItemActions(event, ${id}, '${type}', '${escapedName}')">
                <i class="fas fa-ellipsis-v"></i>
            </div>
        </div>
    `;
}

// 6. Action Handlers
function showItemActions(event, id, type, name) {
    // Standard actions based on view
    if (isTrashView) {
        // Restore/Delete Permanent feel
        const items = [
            { label: 'Restore Item', icon: 'fa-rotate-left', action: () => type === 'folder' ? restoreFolder(id) : restoreFile(id) },
            { label: 'Security Wipe', icon: 'fa-trash-can', action: () => type === 'folder' ? deleteFolder(id) : deleteFile(id), danger: true }
        ];
        renderActionMenu(event, items);
    } else {
        const items = [
            { label: 'Share Access', icon: 'fa-share-nodes', action: () => openShareModal(id, type) },
            { label: 'Rename Item', icon: 'fa-pen-to-square', action: () => openRenameModal(id, name, type) },
            { label: 'Delete Item', icon: 'fa-trash-can', action: () => type === 'folder' ? deleteFolder(id) : deleteFile(id), danger: true }
        ];
        renderActionMenu(event, items);
    }
}

function renderActionMenu(event, items) {
    // Remove existing
    const existing = document.getElementById('contextMenu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'contextMenu';
    menu.style.cssText = `
        position: fixed;
        left: ${event.clientX}px;
        top: ${event.clientY}px;
        background: var(--bg-surface);
        backdrop-filter: blur(20px);
        border: 1px solid var(--glass-border);
        border-radius: 16px;
        padding: 0.5rem;
        z-index: 2000;
        box-shadow: 0 10px 30px rgba(0,0,0,0.4);
        min-width: 180px;
        animation: fadeIn 0.2s ease;
    `;

    items.forEach(item => {
        const btn = document.createElement('button');
        btn.innerHTML = `<i class="fas ${item.icon}"></i> ${item.label}`;
        btn.style.cssText = `
            width: 100%;
            padding: 0.75rem 1rem;
            background: transparent;
            border: none;
            color: ${item.danger ? 'var(--error)' : 'var(--text-main)'};
            text-align: left;
            border-radius: 10px;
            cursor: pointer;
            font-size: 0.85rem;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            transition: background 0.2s;
        `;
        btn.onmouseover = () => btn.style.background = 'rgba(255,255,255,0.05)';
        btn.onmouseout = () => btn.style.background = 'transparent';
        btn.onclick = () => {
            menu.remove();
            item.action();
        };
        menu.appendChild(btn);
    });

    document.body.appendChild(menu);

    // Global click to close
    const closeMenu = () => {
        menu.remove();
        document.removeEventListener('click', closeMenu);
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 10);
}

// 7. Selection Logic
function toggleItemSelection(checkbox, id, type) {
    const card = checkbox.closest('.file-item');
    if (!card) return;

    if (checkbox.checked) {
        card.classList.add('selected');
        if (type === 'file') selectedFiles.add(id);
        else selectedFolders.add(id);
    } else {
        card.classList.remove('selected');
        if (type === 'file') selectedFiles.delete(id);
        else selectedFolders.delete(id);
    }
    updateSelectionUI();
}

function updateSelectionUI() {
    const total = selectedFiles.size + selectedFolders.size;
    const bulk = dom.bulkActions();
    const count = dom.selectedCount();

    if (total > 0) {
        if (bulk) bulk.style.display = 'flex';
        if (count) count.textContent = `${total} ITEM${total > 1 ? 'S' : ''}`;
    } else {
        if (bulk) bulk.style.display = 'none';
        const selectAll = document.getElementById('selectAllItems');
        if (selectAll) selectAll.checked = false;
    }
}

function toggleSelectAll(checked) {
    const checkboxes = dom.fileList().querySelectorAll('.file-item input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = checked;
        const card = cb.closest('.file-item');
        const id = parseInt(card.dataset.id);
        const type = card.dataset.type;

        if (checked) {
            card.classList.add('selected');
            if (type === 'file') selectedFiles.add(id);
            else selectedFolders.add(id);
        } else {
            card.classList.remove('selected');
            if (type === 'file') selectedFiles.delete(id);
            else selectedFolders.delete(id);
        }
    });
    updateSelectionUI();
}

// 8. Bulk Actions
async function bulkDelete() {
    const total = selectedFiles.size + selectedFolders.size;
    if (total === 0) return;

    openDeleteModal(
        'Mass Protocol Initiated',
        isTrashView ? `Permanently eliminate ${total} item(s) from the archive?` : `Move ${total} item(s) to the retrieval queue (Trash)?`,
        isTrashView,
        async (isPermanent) => {
            try {
                // Files
                if (selectedFiles.size > 0) {
                    await api.delete('files.php', {
                        file_ids: Array.from(selectedFiles),
                        permanent: isPermanent
                    });
                }
                // Folders
                if (selectedFolders.size > 0) {
                    await api.delete('folders.php', {
                        folder_ids: Array.from(selectedFolders),
                        permanent: isPermanent
                    });
                }

                selectedFiles.clear();
                selectedFolders.clear();
                updateSelectionUI();
                loadFiles(true);
                Toast.success('Security wipe complete.');
            } catch (err) {
                Toast.error(err.message);
            }
        }
    );
}

// 9. Folder Operations
function openFolderModal() {
    const modal = document.getElementById('folderModal');
    if (modal) {
        modal.classList.add('active');
        document.getElementById('folderNameInput').value = '';
        document.getElementById('folderDescriptionInput').value = '';
        document.getElementById('folderNameInput').focus();
    }
}

function closeFolderModal() {
    const modal = document.getElementById('folderModal');
    if (modal) modal.classList.remove('active');
}

async function createNewFolder() {
    const btn = document.querySelector('#folderModal .btn-primary');
    const name = document.getElementById('folderNameInput').value.trim();
    if (!name) return;

    UiUtils.setBtnLoading(btn, true);
    try {
        await api.post('folders.php', { name, parent_id: currentFolderId });
        closeFolderModal();
        loadFiles(true);
        Toast.success('Collection initialized.');
    } catch (err) {
        Toast.error(err.message);
    } finally {
        UiUtils.setBtnLoading(btn, false);
    }
}

// 10. File Operations
async function deleteFile(id) {
    openDeleteModal(
        'Delete Asset',
        isTrashView ? 'This will permanently erase the asset.' : 'Transfer to retrieving archive?',
        isTrashView,
        async (isPermanent) => {
            try {
                await api.delete('files.php', { file_id: id, permanent: isPermanent });
                loadFiles(true);
                Toast.success('Asset removed.');
            } catch (err) {
                Toast.error(err.message);
            }
        }
    );
}

async function restoreFile(id) {
    try {
        await api.post('files.php', { file_id: id, action: 'restore' });
        loadFiles(true);
        Toast.success('Asset restored.');
    } catch (err) {
        Toast.error(err.message);
    }
}

async function deleteFolder(id) {
    openDeleteModal(
        'Delete Collection',
        isTrashView ? 'Permantly erase this collection and all items within?' : 'Transfer collection to retrieval archive?',
        isTrashView,
        async (isPermanent) => {
            try {
                await api.delete('folders.php', { folder_id: id, permanent: isPermanent });
                loadFiles(true);
                Toast.success('Collection removed.');
            } catch (err) {
                Toast.error(err.message);
            }
        }
    );
}

async function restoreFolder(id) {
    try {
        await api.post('folders.php', { folder_id: id, action: 'restore' });
        loadFiles(true);
        Toast.success('Collection restored.');
    } catch (err) {
        Toast.error(err.message);
    }
}

// 11. Modal Helpers (Rename/Share)
function openRenameModal(id, currentName, type) {
    currentRenameItem = { id, type };
    const modal = document.getElementById('renameModal');
    if (modal) {
        modal.classList.add('active');
        const input = document.getElementById('renameInput');
        input.value = currentName;
        input.focus();
        input.select();
    }
}

function closeRenameModal() {
    const modal = document.getElementById('renameModal');
    if (modal) modal.classList.remove('active');
    currentRenameItem = null;
}

async function submitRename() {
    const btn = document.getElementById('renameSubmitBtn');
    const newName = document.getElementById('renameInput').value.trim();
    if (!newName || !currentRenameItem) return;

    UiUtils.setBtnLoading(btn, true);
    try {
        await api.post('rename.php', {
            id: currentRenameItem.id,
            name: newName,
            type: currentRenameItem.type
        });
        closeRenameModal();
        loadFiles(true);
        Toast.success('Designation updated.');
    } catch (err) {
        Toast.error(err.message);
    } finally {
        UiUtils.setBtnLoading(btn, false);
    }
}

function openShareModal(id, type) {
    currentShareItem = { id, type };
    const modal = document.getElementById('shareModal');
    if (modal) {
        modal.classList.add('active');
        document.getElementById('shareLinkContainer').style.display = 'none';
        document.getElementById('qrcode').innerHTML = '';
        // Reset form
        document.getElementById('shareExpiry').value = 'none';
        document.getElementById('customExpiryContainer').style.display = 'none';

        const pwdEl = document.getElementById('sharePassword');
        if (pwdEl) pwdEl.value = '';

        const noteEl = document.getElementById('shareNote');
        if (noteEl) { noteEl.value = ''; }
        const counter = document.getElementById('noteCharCount');
        if (counter) counter.textContent = '0';
        // Wire up char counter
        if (noteEl && counter) {
            noteEl.oninput = () => {
                const len = noteEl.value.length;
                counter.textContent = len;
                counter.style.color = len > 450 ? 'var(--error)' : '';
                if (len > 500) noteEl.value = noteEl.value.substring(0, 500);
            };
        }
    }
}

function closeShareModal() {
    const modal = document.getElementById('shareModal');
    if (modal) modal.classList.remove('active');
    currentShareItem = null;
}

function toggleCustomExpiry(value) {
    const container = document.getElementById('customExpiryContainer');
    if (container) container.style.display = value === 'custom' ? 'block' : 'none';
}

async function generateShareLink() {
    if (!currentShareItem) {
        Toast.error('No item selected to share.');
        return;
    }

    const btn = document.querySelector('#shareModal .btn-primary');
    const expirySelect = document.getElementById('shareExpiry');
    let expiry = expirySelect.value;

    if (expiry === 'custom') {
        const val = parseInt(document.getElementById('customExpiryValue').value, 10);
        const unit = document.getElementById('customExpiryUnit').value; // 'minutes' | 'hours' | 'days'
        if (!val || val < 1) {
            Toast.warn('Please enter a valid duration.');
            return;
        }
        expiry = `${val}${unit}`;
    }

    // Collect note (optional)
    const noteEl = document.getElementById('shareNote');
    const note = noteEl ? noteEl.value.trim() : '';

    // Collect password (optional)
    const pwdEl = document.getElementById('sharePassword');
    const password = pwdEl ? pwdEl.value : '';

    UiUtils.setBtnLoading(btn, true, 'Generating...');
    try {
        const response = await api.post('share.php', {
            id: currentShareItem.id,
            type: currentShareItem.type,
            expiry,
            password: password,
            note: note || null
        });

        if (!response.share_token) {
            throw new Error('No share token received from server.');
        }

        // Build share URL mapped to the backend API hosting domain
        const shareUrl = `${API_BASE.replace('/api/', '/s/')}${response.share_token}`;
        document.getElementById('shareLinkInput').value = shareUrl;
        document.getElementById('shareLinkContainer').style.display = 'block';

        const qrcodeContainer = document.getElementById('qrcode');
        qrcodeContainer.innerHTML = '';
        if (typeof QRCode !== 'undefined') {
            new QRCode(qrcodeContainer, { text: shareUrl, width: 140, height: 140 });
        }

        Toast.success('Secure share link generated successfully.');
    } catch (err) {
        Toast.error(err.message || 'Failed to generate share link.');
    } finally {
        UiUtils.setBtnLoading(btn, false);
    }
}

function copyShareLink() {
    const input = document.getElementById('shareLinkInput');
    input.select();
    document.execCommand('copy');
    Toast.success('Copied to clipboard.');
}

// 12. Upload Pipeline
async function handleUpload(files) {
    if (!files || files.length === 0) return;

    // Check if we have a queue modal
    openUploadSelectionModal(files);
}

function openUploadSelectionModal(files) {
    const modal = document.getElementById('uploadSelectionModal');
    const list = document.getElementById('selectedFilesList');
    if (!modal || !list) return;

    list.innerHTML = '';
    Array.from(files).forEach(file => {
        const item = document.createElement('div');
        item.style.cssText = 'display: flex; align-items: center; gap: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.03); border-radius: 12px; margin-bottom: 0.5rem; border: 1px solid var(--glass-border);';
        item.innerHTML = `
            <i class="fas fa-file-arrow-up" style="color: var(--primary); font-size: 1.1rem;"></i>
            <div style="flex: 1; overflow: hidden;">
                <div style="font-size: 0.85rem; font-weight: 600; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${file.name}</div>
                <div style="font-size: 0.7rem; color: var(--text-muted);">${formatSize(file.size)}</div>
            </div>
        `;
        list.appendChild(item);
    });

    modal.classList.add('active');
    document.getElementById('startUploadBtn').onclick = () => {
        modal.classList.remove('active');
        processUploadQueue(files);
    };
}

function closeUploadSelectionModal() {
    const modal = document.getElementById('uploadSelectionModal');
    if (modal) modal.classList.remove('active');
}

// 13. High-Performance Sequential Upload Pipeline
async function processUploadQueue(files) {
    const total = files.length;
    let completed = 0;
    const concurrencyLimit = 1;
    const fileArray = Array.from(files);

    Toast.info(`Initiating sequential sync for ${total} item(s)...`);

    let currentIndex = 0;
    let activeConflicts = Promise.resolve(); // Serial lock for conflict UI

    const uploadWorker = async () => {
        while (currentIndex < fileArray.length) {
            const file = fileArray[currentIndex++];

            const attemptUpload = async (resolution = null) => {
                const fd = new FormData();
                fd.append('file', file);
                if (currentFolderId) fd.append('folder_id', currentFolderId);
                if (resolution) fd.append('resolution', resolution);

                try {
                    return await api.upload('upload.php', fd);
                } catch (err) {
                    if (err.status === 409) return { conflict: true, name: file.name };
                    throw err;
                }
            };

            try {
                let result = await attemptUpload();

                if (result && result.conflict) {
                    // Lock the UI for this specific conflict resolution
                    await (activeConflicts = activeConflicts.then(async () => {
                        const resolution = await showConflictModal(file.name);
                        if (resolution !== 'skip') {
                            await attemptUpload(resolution);
                            completed++;
                        }
                    }));
                } else {
                    completed++;
                }
            } catch (e) {
                console.error(`Upload error [${file.name}]:`, e);
                Toast.error(`Transfer failed: ${file.name}`);
            }
        }
    };

    // Initialize parallel threads
    const threads = [];
    for (let i = 0; i < Math.min(concurrencyLimit, fileArray.length); i++) {
        threads.push(uploadWorker());
    }

    await Promise.all(threads);

    if (completed > 0) {
        Toast.success(`Vault synchronized: ${completed} items secured.`);
        loadFiles(true);
    }
}

// 13. Utilities
function updateStorageStats(files) {
    const used = files.reduce((acc, f) => acc + parseInt(f.file_size), 0);
    const limit = 5 * 1024 * 1024 * 1024;
    const percent = Math.min((used / limit) * 100, 100);

    const bar = document.getElementById('storageBar');
    const badge = document.getElementById('storagePercentageBadge');
    const usedText = document.getElementById('storageUsedText');

    if (bar) bar.style.width = `${percent}%`;
    if (usedText) usedText.textContent = formatSize(used);
    if (badge) {
        badge.textContent = `${Math.round(percent)}% USED`;
        badge.style.color = percent > 90 ? 'var(--error)' : (percent > 70 ? 'var(--accent)' : 'var(--primary-light)');
    }
}

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function logout() {
    openConfirmModal(
        'Identity Clearance',
        'Securely sign out? Local session tokens will be purged.',
        async () => {
            try { await api.post('logout.php'); } catch (e) { }
            localStorage.clear();
            window.location.href = 'login.html';
        }
    );
}

// Helper for conflict modal promise
function showConflictModal(filename) {
    return new Promise(resolve => {
        const modal = document.getElementById('conflictModal');
        const msg = document.getElementById('conflictMessage');
        if (!modal) return resolve('skip');

        msg.innerHTML = `Asset <strong>"${filename}"</strong> already exists. Choose strategy:`;
        modal.classList.add('active');

        document.getElementById('replaceBtn').onclick = () => { modal.classList.remove('active'); resolve('replace'); };
        document.getElementById('duplicateBtn').onclick = () => { modal.classList.remove('active'); resolve('duplicate'); };
        document.getElementById('cancelBtn').onclick = () => { modal.classList.remove('active'); resolve('skip'); };
    });
}

// Confirmation generic logic
function openConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('deleteModal');
    if (!modal) return;

    document.getElementById('deleteTitle').textContent = title;
    document.getElementById('deleteMessage').textContent = message;

    const check = document.getElementById('permanentDeleteCheck');
    if (check) check.closest('.form-group').style.display = 'none';

    const confirmBtn = document.getElementById('deleteConfirmBtn');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

    newBtn.onclick = async () => {
        await onConfirm();
        modal.classList.remove('active');
    };
    modal.classList.add('active');
}

function openDeleteModal(title, message, isTrashItem, onConfirm) {
    const modal = document.getElementById('deleteModal');
    if (!modal) return;

    document.getElementById('deleteTitle').textContent = title;
    document.getElementById('deleteMessage').textContent = message;

    const check = document.getElementById('permanentDeleteCheck');
    if (check) {
        check.closest('.form-group').style.display = isTrashItem ? 'none' : 'block';
        check.checked = isTrashItem;
    }

    const confirmBtn = document.getElementById('deleteConfirmBtn');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

    newBtn.onclick = async () => {
        await onConfirm(check ? check.checked : isTrashItem);
        modal.classList.remove('active');
    };
    modal.classList.add('active');
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    if (modal) modal.classList.remove('active');
}

function closeConflictModal() {
    const modal = document.getElementById('conflictModal');
    if (modal) modal.classList.remove('active');
}
