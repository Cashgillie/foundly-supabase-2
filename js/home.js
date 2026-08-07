import {
  fetchActiveReports, filterAndSort, renderItems, showToast,
  openReportModal, closeModal, openDetailModal, closeDetailModal,
  openEditLinkModal, closeEditLinkModal, submitReportForm
} from './foundly-data.js';

const HOME_PREVIEW = 6;
let currentFilter = 'all';
let currentCategory = 'all';
let showingAll = false;
let allActiveItems = [];

async function loadItems() {
  allActiveItems = await fetchActiveReports();
  updateHeroStats();
  refreshGrid();
}

function updateHeroStats() {
  document.getElementById('statActive').textContent = allActiveItems.length;
}

function getFiltered() {
  let items = allActiveItems;
  if (currentFilter !== 'all') items = items.filter(i => i.type === currentFilter);
  const term = document.getElementById('searchInput')?.value || '';
  const cat = currentCategory !== 'all' ? currentCategory : (document.getElementById('drpdwn')?.value || '');
  return filterAndSort(items, { category: cat, searchTerm: term });
}

function refreshGrid() {
  const filtered = getFiltered();
  const toShow = showingAll ? filtered : filtered.slice(0, HOME_PREVIEW);
  renderItems(toShow);

  const viewAllLink = document.querySelector('.section-header a');
  if (viewAllLink) {
    if (showingAll) {
      viewAllLink.innerHTML = 'Show less <i class="fas fa-arrow-up"></i>';
    } else {
      const remaining = filtered.length - HOME_PREVIEW;
      viewAllLink.innerHTML = remaining > 0
        ? `View all (${filtered.length}) <i class="fas fa-arrow-right"></i>`
        : 'View all <i class="fas fa-arrow-right"></i>';
    }
  }
}

function showAllItems() {
  showingAll = !showingAll;
  refreshGrid();
  if (!showingAll) window.scrollTo({ top: document.querySelector('.section-header').offsetTop - 80, behavior: 'smooth' });
}

function applyFilters() { showingAll = false; refreshGrid(); }

function filterByType(type, el) {
  currentFilter = type;
  currentCategory = 'all';
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  showingAll = false;
  refreshGrid();
}

function filterByCategory(cat, el) {
  currentCategory = cat;
  currentFilter = 'all';
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  showingAll = false;
  refreshGrid();
}

async function submitReport(event) {
  event.preventDefault();
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const originalHTML = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

  try {
    const imageFile = document.getElementById('itemImage')?.files[0] || null;
    const result = await submitReportForm({
      type: document.getElementById('itemType').value,
      category: document.getElementById('itemCategory').value,
      title: document.getElementById('itemTitle').value,
      description: document.getElementById('itemDescription').value,
      location: document.getElementById('itemLocation').value,
      contact: document.getElementById('itemEmail').value,
      imageFile
    });

    closeModal();
    showToast('✅ Item reported successfully!', 'success');
    openEditLinkModal(result.editLink, document.getElementById('itemEmail').value);
    await loadItems();
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Error saving item. Please try again.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHTML;
  }
}

function copyEditLink() {
  const input = document.getElementById('editLinkInput');
  input.select();
  navigator.clipboard?.writeText(input.value).then(
    () => showToast('Link copied!', 'success'),
    () => document.execCommand('copy')
  );
}

// ── FAQ ───────────────────────────────────────────────────
const FAQS = [
  { q: 'Is Foundly free to use?', a: 'Yes! Foundly is completely free for everyone. We are funded by optional donations from the community and select partnerships. There are no hidden charges.' },
  { q: 'Do I need an account to post?', a: 'No account is needed. Simply fill in the report form with your item details and contact email. Your listing goes live immediately.' },
  { q: 'How long do listings stay up?', a: 'Listings stay live until you mark them resolved or delete them using your private edit link.' },
  { q: 'What if I don\'t recognise the person claiming my item?', a: 'Ask them to describe distinctive features of the item before meeting — ideally something you deliberately left out of the public post. Meet in a public, busy location and bring a friend if you feel unsure.' },
  { q: 'Can I report an item anonymously?', a: 'You must provide a contact email so the other party can reach you, but your email is only visible to people who open the item and click "Contact" — it\'s not shown on the card itself.' },
  { q: 'What categories of items can I report?', a: 'Phones, electronics, pets, bags, keys, wallets, jewelry, and other. If your item doesn\'t fit a category, use "Other" and describe it clearly.' },
  { q: 'Can I edit or delete my listing?', a: 'Yes — right after you submit a report, you\'ll get a private edit link. Save it! That link lets you update details, mark the item resolved, or delete the listing at any time, with no account needed.' },
  { q: 'What should I do if I find a pet?', a: 'Post immediately with a photo. Also check the pet for a microchip at a local vet, and report to local animal control. Time is critical with pets.' },
];

function buildFAQ() {
  const container = document.getElementById('faqList');
  if (!container) return;
  container.innerHTML = FAQS.map((f, i) => `
    <div class="faq-item">
      <div class="faq-question" onclick="toggleFAQ(${i}, this)">
        <span>${f.q}</span>
        <i class="fas fa-chevron-down"></i>
      </div>
      <div class="faq-answer" id="faq-ans-${i}">${f.a}</div>
    </div>
  `).join('');
}

function toggleFAQ(idx, el) {
  const ans = document.getElementById(`faq-ans-${idx}`);
  const isOpen = ans.classList.contains('open');
  document.querySelectorAll('.faq-answer').forEach(a => a.classList.remove('open'));
  document.querySelectorAll('.faq-question').forEach(q => q.classList.remove('open'));
  if (!isOpen) {
    ans.classList.add('open');
    el.classList.add('open');
  }
}

// ── Contact form (static — no backend endpoint wired up yet) ──
function submitContact(e) {
  e.preventDefault();
  showToast('Message sent! We\'ll get back to you within 24 hours.', 'success');
  e.target.reset();
}

// Expose handlers used by inline onclick/onsubmit attributes
Object.assign(window, {
  openReportModal, closeModal, openDetailModal, closeDetailModal,
  applyFilters, filterByType, filterByCategory, showAllItems,
  submitReport, closeEditLinkModal, copyEditLink,
  toggleFAQ, submitContact
});

document.addEventListener('DOMContentLoaded', () => {
  loadItems();
  buildFAQ();
  document.getElementById('searchInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') applyFilters();
  });
});
