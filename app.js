// app.js

const STORAGE_KEY = 'student_planner.classes.v1';
const PROFILE_KEY = 'course_companion.profile.v1';
const HUMAN_VERSION = '8.18.25';

function loadClasses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to parse storage, resetting.', e);
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

function saveClasses(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      studentId: (parsed.studentId || '').toString(),
      studentEmail: (parsed.studentEmail || '').toString()
    };
  } catch (e) {
    console.warn('Failed to parse profile; resetting.', e);
    localStorage.removeItem(PROFILE_KEY);
    return { studentId: '', studentEmail: '' };
  }
}

function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify({
    studentId: (profile.studentId || '').toString(),
    studentEmail: (profile.studentEmail || '').toString()
  }));
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

let state = {
  classes: loadClasses(),
  query: ''
};

// Elements
const form = document.getElementById('class-form');
const idInput = document.getElementById('class-id');
const nameInput = document.getElementById('class-name');
const sectionInput = document.getElementById('section');
const daysTimesInput = document.getElementById('days-times');
const locationInput = document.getElementById('location');
const notesInput = document.getElementById('notes');
const clearBtn = document.getElementById('clear-btn');
const addNewBtn = document.getElementById('add-new-btn');
const searchInput = document.getElementById('search');
const exportBtn = document.getElementById('export-btn');
const importInput = document.getElementById('import-input');
const listEl = document.getElementById('class-list');
const emptyStateEl = document.getElementById('empty-state');
const installBtn = document.getElementById('install-btn');
const updateBanner = document.getElementById('update-banner');
const reloadBtn = document.getElementById('reload-btn');
const checkUpdatesBtn = document.getElementById('check-updates-btn');
const deleteAllBtn = document.getElementById('delete-all-btn');
// Profile elems
const studentIdInput = document.getElementById('student-id');
const studentEmailInput = document.getElementById('student-email');
const languageToggle = document.getElementById('language-toggle');
const iosHintEl = document.getElementById('ios-install-hint');
// Settings / a11y / version
const toggleAccents = document.getElementById('toggle-accents');
const updateStatusLive = document.getElementById('update-status-live');
const whatsNew = document.getElementById('whats-new');
const whatsNewDismiss = document.getElementById('whats-new-dismiss');
const appVersionEl = document.getElementById('app-version');

// i18n helper
function t(key) {
  try {
    return (translations?.[currentLanguage]?.[key]) ?? key;
  } catch {
    return key;
  }
}

// Announce a message via aria-live region (polite)
function announce(msg) {
  if (!updateStatusLive) return;
  updateStatusLive.textContent = msg || '';
  // Clear after a short delay to prevent repeated announcements
  setTimeout(() => { if (updateStatusLive.textContent === msg) updateStatusLive.textContent = ''; }, 4000);
}


function setBusy(isBusy) {
  listEl.setAttribute('aria-busy', isBusy ? 'true' : 'false');
}

function clearForm() {
  form.reset();
  idInput.value = '';
  nameInput.focus();
}

function validate() {
  if (!nameInput.value.trim()) {
    nameInput.focus();
    return false;
  }
  return true;
}

function toItemFromForm() {
  return {
    id: idInput.value || uid(),
    name: nameInput.value.trim(),
    section: sectionInput.value.trim(),
    daysTimes: daysTimesInput.value.trim(),
    location: locationInput.value.trim(),
    notes: notesInput.value.trim(),
  };
}

function fillForm(item) {
  idInput.value = item.id;
  nameInput.value = item.name || '';
  sectionInput.value = item.section || '';
  daysTimesInput.value = item.daysTimes || '';
  locationInput.value = item.location || '';
  notesInput.value = item.notes || '';
  nameInput.focus();
}

function upsertItem(item) {
  const idx = state.classes.findIndex(c => c.id === item.id);
  if (idx >= 0) {
    state.classes[idx] = item;
  } else {
    state.classes.push(item);
  }
  saveClasses(state.classes);
  renderList();
}

function deleteItem(id) {
  state.classes = state.classes.filter(c => c.id !== id);
  saveClasses(state.classes);
  renderList();
}

function moveItem(id, direction) {
  const idx = state.classes.findIndex(c => c.id === id);
  if (idx < 0) return;
  const newIdx = idx + direction;
  if (newIdx < 0 || newIdx >= state.classes.length) return;
  const [item] = state.classes.splice(idx, 1);
  state.classes.splice(newIdx, 0, item);
  saveClasses(state.classes);
  renderList();
}

function getFilteredClasses() {
  const q = state.query.trim().toLowerCase();
  if (!q) return state.classes;
  return state.classes.filter((c) => {
    return [c.name, c.section, c.daysTimes, c.location, c.notes]
      .filter(Boolean)
      .some((v) => v.toLowerCase().includes(q));
  });
}

// Destructive: Delete Everything (local data + caches + SW) with confirmation
if (deleteAllBtn) {
  deleteAllBtn.addEventListener('click', async () => {
    const message = t('deleteEverythingConfirm');
    const ok = confirm(message);
    if (!ok) return;
    try {
      // Try to fetch latest SW before clearing (best effort)
      try { (await navigator.serviceWorker.getRegistration())?.update(); } catch {}

      // Clear storages
      try { localStorage.clear(); } catch {}
      try { sessionStorage.clear(); } catch {}

      // Unregister all service workers
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      } catch {}

      // Delete all caches
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      } catch {}

      // Force reload with cache-busting to pull freshest version
      const url = new URL(window.location.href);
      url.searchParams.set('reset', Date.now().toString());
      window.location.replace(url.toString());
    } catch (e) {
      console.warn('Delete everything failed', e);
      // Attempt a basic reload regardless
      window.location.reload();
    }
  });
}

function renderList() {
  setBusy(true);
  listEl.innerHTML = '';

  const items = getFilteredClasses();

  if (!items.length) {
    emptyStateEl.style.display = 'block';
    setBusy(false);
    return;
  }
  emptyStateEl.style.display = 'none';

  for (const item of items) {
    const li = document.createElement('li');
    li.className = 'list-item';
    li.setAttribute('data-id', item.id);

    // Apply deterministic accent color per item (accessible: only used as accent)
    const { accent, accentWeak } = accentFromString(item.id || item.name || '');
    li.style.setProperty('--accent', accent);
    li.style.setProperty('--accent-weak', accentWeak);

    const title = document.createElement('div');
    title.className = 'item-title';
    title.textContent = [
      item.name,
      item.section ? `(${t('section')} ${item.section})` : ''
    ].filter(Boolean).join(' ');

    const meta = document.createElement('div');
    meta.className = 'item-meta';
    meta.textContent = [item.daysTimes, item.location].filter(Boolean).join(' • ');

    const notes = document.createElement('div');
    if (item.notes) {
      notes.className = 'item-notes';
      notes.textContent = item.notes;
    }

    const actions = document.createElement('div');
    actions.className = 'item-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'btn';
    editBtn.type = 'button';
    editBtn.textContent = t('edit');
    editBtn.addEventListener('click', () => fillForm(item));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn';
    delBtn.type = 'button';
    delBtn.textContent = t('delete');
    delBtn.addEventListener('click', () => {
      if (confirm(t('confirmDelete'))) deleteItem(item.id);
    });

    const upBtn = document.createElement('button');
    upBtn.className = 'btn';
    upBtn.type = 'button';
    upBtn.textContent = t('moveUp');
    upBtn.addEventListener('click', () => moveItem(item.id, -1));

    const downBtn = document.createElement('button');
    downBtn.className = 'btn';
    downBtn.type = 'button';
    downBtn.textContent = t('moveDown');
    downBtn.addEventListener('click', () => moveItem(item.id, +1));

    actions.append(editBtn, delBtn, upBtn, downBtn);

    li.append(title, meta);
    if (item.notes) li.append(notes);
    li.append(actions);

    listEl.appendChild(li);
  }

  setBusy(false);
}

// Deterministic accent color generator based on a string seed
function accentFromString(seed) {
  let h = 2166136261 >>> 0; // FNV-1a base
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const hue = h % 360; // 0-359
  // High saturation, medium lightness for vivid accent; weak version has alpha
  const accent = `hsl(${hue}, 85%, 52%)`;
  const accentWeak = `hsla(${hue}, 85%, 52%, 0.14)`;
  return { accent, accentWeak };
}

// Export / Import
function exportData() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    classes: state.classes
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = `student-planner-backup-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const arr = parsed && Array.isArray(parsed.classes) ? parsed.classes : (Array.isArray(parsed) ? parsed : null);
      if (!arr) throw new Error('Invalid format');
      if (!confirm(t('importReplaceConfirm'))) return;
      // Basic validation and normalization
      const cleaned = arr.map((c) => ({
        id: c.id || uid(),
        name: (c.name || '').toString(),
        section: (c.section || '').toString(),
        daysTimes: (c.daysTimes || '').toString(),
        location: (c.location || '').toString(),
        notes: (c.notes || '').toString()
      })).filter(c => c.name.trim());
      state.classes = cleaned;
      saveClasses(state.classes);
      renderList();
      alert(t('importComplete'));
    } catch (e) {
      alert(t('importFailed'));
      console.error(e);
    } finally {
      importInput.value = '';
    }
  };
  reader.readAsText(file);
}

// Form events
form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validate()) return;
  const item = toItemFromForm();
  upsertItem(item);
  // Ensure the new/edited item is visible even if a search filter was active
  if (searchInput && state.query) {
    state.query = '';
    searchInput.value = '';
    renderList();
  }
  console.log('[Classes] Saved', item);
  clearForm();
});

clearBtn.addEventListener('click', clearForm);
addNewBtn.addEventListener('click', clearForm);

// Search events (debounced)
let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.query = searchInput.value || '';
    renderList();
  }, 120);
});

// Export / Import events
exportBtn.addEventListener('click', exportData);
importInput.addEventListener('change', (e) => importData(e.target.files[0]));

// Initial render
renderList();

// Language switcher
let currentLanguage = localStorage.getItem('language') || 'en';

function setLanguage(lang) {
  currentLanguage = lang;
  localStorage.setItem('language', lang);
  document.documentElement.lang = lang;

  document.querySelectorAll('[data-key]').forEach(element => {
    const key = element.getAttribute('data-key');
    if (translations[lang] && translations[lang][key]) {
      if (element.placeholder) {
        element.placeholder = translations[lang][key];
      } else {
        element.textContent = translations[lang][key];
      }
    }
  });

  languageToggle.textContent = lang === 'en' ? 'Español' : 'English';
  // Re-render dynamic content that isn't data-key driven
  renderList();
}

languageToggle.addEventListener('click', () => {
  const newLang = currentLanguage === 'en' ? 'es' : 'en';
  setLanguage(newLang);
});

// Set initial language
setLanguage(currentLanguage);

// Initialize and persist profile
const profileState = loadProfile();
if (studentIdInput) studentIdInput.value = profileState.studentId || '';
if (studentEmailInput) studentEmailInput.value = profileState.studentEmail || '';

let profileTimer;
function scheduleProfileSave() {
  clearTimeout(profileTimer);
  profileTimer = setTimeout(() => {
    const next = {
      studentId: (studentIdInput?.value || '').trim(),
      studentEmail: (studentEmailInput?.value || '').trim()
    };
    saveProfile(next);
  }, 300);
}

studentIdInput?.addEventListener('input', scheduleProfileSave);
studentEmailInput?.addEventListener('input', scheduleProfileSave);

// PWA: register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').then((reg) => {
      // If there's already a waiting SW, show banner
      if (reg.waiting) {
        showUpdateBanner(reg.waiting);
      }

      // Listen for new updates
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            // A new version is installed and waiting
            showUpdateBanner(reg.waiting || sw);
          }
        });
      });

      // Ask the active SW for its version so we can show it in the footer
      requestVersionFromSW(reg);
    }).catch(err => {
      console.warn('SW registration failed', err);
    });
  });
}

// Update flow: show banner and reload when user accepts
let reloadingDueToSW = false;
function showUpdateBanner(waitingWorker) {
  if (!updateBanner || !reloadBtn || !waitingWorker) return;
  updateBanner.hidden = false;
  reloadBtn.onclick = () => {
    try {
      // Tell the waiting SW to activate immediately
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } catch (e) {}
  };
}

// When the new SW takes control, reload once to get fresh assets
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (reloadingDueToSW) return;
  reloadingDueToSW = true;
  try { sessionStorage.setItem('showWhatsNew', '1'); } catch {}
  window.location.reload();
});

// Manual check for updates
if (checkUpdatesBtn) {
  checkUpdatesBtn.addEventListener('click', async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        const msg = t('upToDate');
        alert(msg);
        announce(msg);
        return;
      }
      // Trigger browser to check for updates
      await reg.update();

      // If there's a waiting worker after update, show the banner
      if (reg.waiting) {
        showUpdateBanner(reg.waiting);
        return;
      }

      // If an update is installing, wait for it to become installed
      const sw = reg.installing;
      if (sw) {
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(reg.waiting || sw);
          }
        });
        return;
      }

      // Slight delay to allow any async state to settle
      setTimeout(() => {
        if (reg.waiting) {
          showUpdateBanner(reg.waiting);
        } else {
          const msg = t('upToDate');
          alert(msg);
          announce(msg);
        }
      }, 400);
    } catch (e) {
      console.warn('Update check failed', e);
      const msg = t('upToDate');
      alert(msg);
      announce(msg);
    }
  });
}

// PWA: custom install prompt
let deferredPrompt = null;

function isIos() {
  return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
}

function setupInstallButton() {
  if (!installBtn) return;

  // 1. Check if already standalone, if so, do nothing.
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isStandalone) {
    installBtn.hidden = true;
    if (iosHintEl) iosHintEl.hidden = true;
    return;
  }

  // 2. Check for iOS Safari
  if (isIos()) {
    // On iOS, the 'beforeinstallprompt' event is not supported.
    // We just show the button and explain how to 'Add to Home Screen'.
    installBtn.hidden = false;
    if (iosHintEl) iosHintEl.hidden = false;
    installBtn.addEventListener('click', () => {
      alert(t('installIosHint'));
    });
    return;
  }

  // 3. Standard PWA prompt for other browsers (e.g., Chrome on Android)
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false; // Show the button if the browser supports the prompt.
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    try {
      installBtn.disabled = true;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      // The 'appinstalled' event will hide the button if successful.
    } catch (err) {
      console.warn('Install prompt error:', err);
    } finally {
      installBtn.disabled = false;
      deferredPrompt = null;
      // Hide it anyway, as the prompt can only be used once.
      installBtn.hidden = true;
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installBtn.hidden = true;
    if (iosHintEl) iosHintEl.hidden = true;
  });
}

window.addEventListener('DOMContentLoaded', setupInstallButton);
console.log('app.js module loaded');

// Settings: Color accents toggle (persist in localStorage)
const ACCENTS_KEY = 'ui.accentsEnabled.v1';
function applyAccentsPref(enabled) {
  document.body.classList.toggle('no-accents', !enabled);
}

function initSettings() {
  let enabled = true;
  try {
    const raw = localStorage.getItem(ACCENTS_KEY);
    enabled = raw == null ? true : raw === 'true';
  } catch {}
  applyAccentsPref(enabled);
  if (toggleAccents) toggleAccents.checked = enabled;
  toggleAccents?.addEventListener('change', () => {
    const next = !!toggleAccents.checked;
    applyAccentsPref(next);
    try { localStorage.setItem(ACCENTS_KEY, String(next)); } catch {}
  });
}

// What's New: show after an update-driven reload
function initWhatsNew() {
  let shouldShow = false;
  try { shouldShow = sessionStorage.getItem('showWhatsNew') === '1'; } catch {}
  if (!shouldShow || !whatsNew) return;
  whatsNew.hidden = false;
  whatsNewDismiss?.addEventListener('click', () => {
    whatsNew.hidden = true;
  }, { once: true });
  try { sessionStorage.removeItem('showWhatsNew'); } catch {}
}

// Version indicator: ask SW for version and update footer
function requestVersionFromSW(reg) {
  try {
    const target = reg?.active || navigator.serviceWorker?.controller;
    target?.postMessage({ type: 'GET_VERSION' });
  } catch {}
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (!event?.data) return;
    if (event.data.type === 'VERSION') {
      if (appVersionEl) appVersionEl.title = event.data.version || '';
    }
  });
}

// Initialize settings and post-update UI when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  initSettings();
  initWhatsNew();
  if (appVersionEl) appVersionEl.textContent = HUMAN_VERSION;
});
