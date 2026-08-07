import {
  adminSignIn, adminSignOut, onAdminAuthChanged, isCurrentUserAdmin,
  fetchAllReportsAdmin, computeStats, adminSetStatus, adminUpdateReport,
  adminCreateReport, adminDeletePermanently, uploadReportImage,
  getCategoryIcon, escapeHtml, showToast
} from './foundly-data.js';

let currentTab = 'all';
let currentEditId = null;
let pendingImageUrl = null;
let allItems = [];

// ─── Auth flow ──────────────────────────────────────────────
function showGate(id) {
  ['loginGate', 'notAdminGate', 'adminContent'].forEach(s => {
    document.getElementById(s).style.display = s === id ? (s === 'adminContent' ? 'block' : 'flex') : 'none';
  });
}

onAdminAuthChanged(async (user) => {
  if (!user) {
    showGate('loginGate');
    return;
  }
  const isAdmin = await isCurrentUserAdmin(user);
  if (!isAdmin) {
    showGate('notAdminGate');
    return;
  }
  document.getElementById('adminEmailLabel').textContent = user.email;
  showGate('adminContent');
  reloadAdminData();
});

document.getElementById('gateForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('gateEmail').value;
  const password = document.getElementById('gatePassword').value;
  const btn = document.getElementById('gateSubmitBtn');
  const errorEl = document.getElementById('gateError');
  errorEl.style.display = 'none';
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing in...';

  try {
    await adminSignIn(email, password);
    // onAdminAuthChanged handles the rest
  } catch (err) {
    errorEl.textContent = 'Sign-in failed. Check your email and password.';
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-right-to-bracket"></i> Sign In';
  }
});

function handleSignOut() {
  adminSignOut().then(() => window.location.href = 'index.html');
}

function handleSignOutAndReload() {
  adminSignOut().then(() => window.location.reload());
}

// ─── Data loading ────────────────────────────────────────────
async function reloadAdminData() {
  const tbody = document.getElementById('adminTableBody');
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:48px;color:var(--gray)">
    <i class="fas fa-spinner fa-spin" style="font-size:24px;display:block;margin-bottom:12px"></i>Loading reports…
  </td></tr>`;
  try {
    allItems = await fetchAllReportsAdmin();
    renderStats();
    renderTable();
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:48px;color:var(--danger)">
      Couldn't load reports. ${escapeHtml(err.message || '')}
    </td></tr>`;
  }
}

function renderStats() {
  const s = computeStats(allItems);
  document.getElementById('statTotal').textContent = s.total;
  document.getElementById('statActiveCount').textContent = s.active;
  document.getElementById('statFoundCount').textContent = s.found;
  document.getElementById('statResolvedCount').textContent = s.resolved;
  document.getElementById('statDeletedCount').textContent = s.deleted;
}

function getFilteredAdminItems() {
  let items = allItems;
  if (currentTab !== 'all') items = items.filter(i => i.status === currentTab);

  const type = document.getElementById('adminTypeFilter')?.value || 'all';
  if (type !== 'all') items = items.filter(i => i.type === type);

  const cat = document.getElementById('adminCategoryFilter')?.value || '';
  if (cat) items = items.filter(i => i.category === cat);

  const term = (document.getElementById('adminSearchInput')?.value || '').toLowerCase().trim();
  if (term) items = items.filter(i =>
    i.title.toLowerCase().includes(term) ||
    i.description.toLowerCase().includes(term) ||
    i.location.toLowerCase().includes(term)
  );
  return items;
}

function applyAdminFilters() { renderTable(); }

function setTab(tab, el) {
  currentTab = tab;
  document.querySelectorAll('#statusTabs .pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  renderTable();
}

function filterFromStatCard(tab, type) {
  currentTab = tab;
  document.getElementById('adminTypeFilter').value = type || 'all';
  document.querySelectorAll('#statusTabs .pill').forEach(p => p.classList.toggle('active', p.dataset.tab === tab));
  renderTable();
  document.querySelector('.admin-table-wrapper').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function formatDate(item) {
  const ms = item.createdAt?.toMillis ? item.createdAt.toMillis() : (item.createdAt?.seconds ? item.createdAt.seconds * 1000 : null);
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderTable() {
  const items = getFilteredAdminItems();
  const tbody = document.getElementById('adminTableBody');
  document.getElementById('adminResultCount').textContent = items.length;

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:48px;color:var(--gray)">
      <i class="fas fa-box-open" style="font-size:32px;display:block;margin-bottom:12px"></i>
      No items match your filters.
    </td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(buildAdminRow).join('');
}

function buildAdminRow(item) {
  const icon = getCategoryIcon(item.category);
  const badgeClass = item.type === 'lost' ? 'badge-lost' : 'badge-found';
  const badgeText = item.type === 'lost' ? 'Lost' : 'Found';
  const status = item.status || 'active';
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
  const thumb = item.imageUrl ? `<img src="${item.imageUrl}" alt="">` : `<i class="fas fa-${icon}"></i>`;

  let menuItems = `<button onclick="openItemModal('edit', '${item.id}')"><i class="fas fa-pen"></i> Edit</button>`;

  if (status === 'deleted') {
    menuItems += `<button class="success-item" onclick="restoreRow('${item.id}')"><i class="fas fa-rotate-left"></i> Restore</button>`;
    menuItems += `<hr>`;
    menuItems += `<button class="danger-item" onclick="permanentlyDeleteRow('${item.id}')"><i class="fas fa-trash-can"></i> Delete Permanently</button>`;
  } else {
    if (status !== 'resolved') {
      menuItems += `<button class="success-item" onclick="resolveRow('${item.id}')"><i class="fas fa-handshake"></i> Mark Resolved</button>`;
    }
    menuItems += `<hr>`;
    menuItems += `<button class="danger-item" onclick="deleteRow('${item.id}')"><i class="fas fa-trash"></i> Delete</button>`;
  }

  return `
    <tr data-id="${item.id}">
      <td><div class="admin-thumb">${thumb}</div></td>
      <td>
        <div class="admin-item-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
        <div class="admin-item-sub"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(item.location)}</div>
      </td>
      <td><span class="card-badge ${badgeClass}" style="position:static;display:inline-block">${badgeText}</span></td>
      <td>${capitalize(item.category)}</td>
      <td>${formatDate(item)}</td>
      <td><span class="status-pill status-${status}">${statusLabel}</span></td>
      <td class="admin-actions">
        <div class="dropdown">
          <button class="dropdown-toggle" onclick="toggleActionsMenu(event, '${item.id}')" title="Actions">
            <i class="fas fa-ellipsis-vertical"></i>
          </button>
          <div class="dropdown-menu" id="menu-${item.id}">${menuItems}</div>
        </div>
      </td>
    </tr>`;
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

// ─── Actions dropdown ────────────────────────────────────────
function closeAllActionMenus(except) {
  document.querySelectorAll('.dropdown-menu.open').forEach(m => {
    if (m !== except) m.classList.remove('open');
  });
}

function toggleActionsMenu(event, id) {
  event.stopPropagation();
  const menu = document.getElementById(`menu-${id}`);
  const wasOpen = menu.classList.contains('open');
  closeAllActionMenus();
  if (!wasOpen) menu.classList.add('open');
}

document.addEventListener('click', () => closeAllActionMenus());

// ─── Row actions ─────────────────────────────────────────────
async function withRowAction(id, status, successMsg, toastType) {
  try {
    await adminSetStatus(id, status);
    showToast(successMsg, toastType);
    await reloadAdminData();
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Action failed.', 'error');
  }
}

const resolveRow = (id) => withRowAction(id, 'resolved', 'Marked as resolved', 'success');
const restoreRow = (id) => withRowAction(id, 'active', 'Item restored', 'success');

function deleteRow(id) {
  if (!confirm('Move this item to Deleted? You can restore it later.')) return;
  withRowAction(id, 'deleted', 'Item deleted', '');
}

async function permanentlyDeleteRow(id) {
  if (!confirm('Permanently delete this item? This cannot be undone.')) return;
  try {
    await adminDeletePermanently(id);
    showToast('Item permanently deleted', 'error');
    await reloadAdminData();
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Delete failed.', 'error');
  }
}

// ─── Create / Edit modal ─────────────────────────────────────
function openItemModal(mode, id) {
  currentEditId = mode === 'edit' ? id : null;
  pendingImageUrl = null;

  const form = document.getElementById('adminItemForm');
  form.reset();
  document.getElementById('adminFileUploadText').textContent = 'Click to upload or drag and drop';
  document.getElementById('adminCurrentImagePreview').style.display = 'none';

  if (mode === 'edit') {
    const item = allItems.find(i => i.id === id);
    if (!item) return;
    document.getElementById('adminModalTitle').textContent = 'Edit Item';
    document.getElementById('adminSubmitBtnText').textContent = 'Save Changes';
    document.getElementById('adminItemId').value = item.id;
    document.getElementById('adminItemType').value = item.type;
    document.getElementById('adminItemStatus').value = item.status || 'active';
    document.getElementById('adminItemTitle').value = item.title;
    document.getElementById('adminItemCategory').value = item.category;
    document.getElementById('adminItemLocation').value = item.location;
    document.getElementById('adminItemDescription').value = item.description;
    document.getElementById('adminItemEmail').value = item.contact;
    if (item.imageUrl) {
      const preview = document.getElementById('adminCurrentImagePreview');
      preview.src = item.imageUrl;
      preview.style.display = 'block';
    }
  } else {
    document.getElementById('adminModalTitle').textContent = 'Add New Item';
    document.getElementById('adminSubmitBtnText').textContent = 'Add Item';
    document.getElementById('adminItemId').value = '';
    document.getElementById('adminItemStatus').value = 'active';
  }

  document.getElementById('adminItemModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeItemModal() {
  document.getElementById('adminItemModal').classList.remove('active');
  document.body.style.overflow = 'auto';
  currentEditId = null;
  pendingImageUrl = null;
}

document.getElementById('adminItemImage').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  document.getElementById('adminFileUploadText').innerHTML = `<i class="fas fa-spinner fa-spin"></i> Uploading...`;
  try {
    pendingImageUrl = await uploadReportImage(file);
    document.getElementById('adminFileUploadText').innerHTML =
      `<i class="fas fa-check-circle" style="color:#10b981"></i> ${escapeHtml(file.name)}`;
  } catch (err) {
    console.error(err);
    showToast('Error uploading image.', 'error');
    document.getElementById('adminFileUploadText').textContent = 'Click to upload or drag and drop';
  }
});

async function submitItemForm(event) {
  event.preventDefault();
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const original = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  const fields = {
    type: document.getElementById('adminItemType').value,
    status: document.getElementById('adminItemStatus').value,
    title: document.getElementById('adminItemTitle').value.trim(),
    category: document.getElementById('adminItemCategory').value,
    location: document.getElementById('adminItemLocation').value.trim(),
    description: document.getElementById('adminItemDescription').value.trim(),
    contact: document.getElementById('adminItemEmail').value.trim()
  };
  if (pendingImageUrl) fields.imageUrl = pendingImageUrl;

  try {
    if (currentEditId) {
      await adminUpdateReport(currentEditId, fields);
      showToast('✅ Item updated', 'success');
    } else {
      await adminCreateReport(fields);
      showToast('✅ Item created', 'success');
    }
    closeItemModal();
    await reloadAdminData();
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Error saving item. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = original;
  }
}

document.addEventListener('click', function (e) {
  const modal = document.getElementById('adminItemModal');
  if (modal && e.target === modal) closeItemModal();
});

Object.assign(window, {
  handleSignOut, handleSignOutAndReload, reloadAdminData,
  applyAdminFilters, setTab, filterFromStatCard,
  resolveRow, restoreRow, deleteRow, permanentlyDeleteRow,
  openItemModal, closeItemModal, submitItemForm, toggleActionsMenu
});
