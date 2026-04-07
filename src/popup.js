import { ProfileManager } from './config/ProfileManager';
import { StorageService } from './core/StorageService';
import { MessagingService } from './core/MessagingService';
import { DEFAULT_CONFIG } from './config/DefaultConfig';

const STORAGE_KEYS = { STATE: 'scraper_state' };

const select = document.getElementById('profileSelect');
const textarea = document.getElementById('configJson');
const pageLimitInput = document.getElementById('pageLimit');
const btnAction = document.getElementById('btnAction');
const btnSaveProfile = document.getElementById('btnSaveProfile');
const btnExport = document.getElementById('btnExport');
const statusEl = document.getElementById('status');
const statusDot = document.getElementById('statusDot');

function showStatus(msg, isRunning) {
  statusEl.textContent = msg;
  if (statusDot) {
    statusDot.className = 'status-dot ' + (isRunning ? 'running' : '');
  }
}

function rebuildProfileSelect(profiles, activeId) {
  const ids = Object.keys(profiles);
  select.innerHTML = '';

  const defaultOpt = document.createElement('option');
  defaultOpt.value = '__default__';
  defaultOpt.textContent = 'McGraw Hill Books';
  select.appendChild(defaultOpt);

  const newOpt = document.createElement('option');
  newOpt.value = '__new__';
  newOpt.textContent = 'Create New...';
  select.appendChild(newOpt);

  ids.forEach((id) => {
    if (id === '__default__' || id === '__new__') return;
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = profiles[id].profileName || id;
    select.appendChild(opt);
  });
  select.value = activeId;
}

function getCurrentConfigFromTextarea() {
  const raw = textarea.value.trim();
  let baseConfig = { ...DEFAULT_CONFIG };
  if (raw) {
    const parsed = ProfileManager.parseConfigJson(raw);
    if (!parsed.ok) return parsed;
    baseConfig = parsed.config;
  }
  const pageLimitVal = pageLimitInput.value.trim();
  if (pageLimitVal && !isNaN(Number(pageLimitVal))) {
    baseConfig.pageLimit = Number(pageLimitVal);
  } else {
    delete baseConfig.pageLimit;
  }
  return { ok: true, config: baseConfig };
}

function applyConfigToTextarea(config) {
  textarea.value = JSON.stringify(config, null, 2);
}

async function onProfileChange() {
  const id = select.value;
  btnSaveProfile.style.display = id === '__new__' ? 'block' : 'none';

  if (id === '__new__') {
    textarea.value = '';
    textarea.placeholder = 'Paste your profile JSON here. Use "Save as profile" to keep it.';
    return;
  }
  if (id === '__default__') {
    applyConfigToTextarea(DEFAULT_CONFIG);
    return;
  }

  const { profiles } = await ProfileManager.loadProfiles();
  if (profiles[id]) {
    applyConfigToTextarea(profiles[id]);
  }
}

async function saveCurrentAsNewProfile() {
  const result = getCurrentConfigFromTextarea();
  if (!result.ok) {
    showStatus('Invalid JSON: ' + result.error, false);
    return;
  }
  const name = result.config.profileName || 'New Profile';
  const id = await ProfileManager.saveNewProfile(result.config);

  const { profiles } = await ProfileManager.loadProfiles();
  rebuildProfileSelect(profiles, id);
  applyConfigToTextarea(result.config);
  showStatus('Saved as "' + name + '"', false);
}

function startScraping() {
  const result = getCurrentConfigFromTextarea();
  if (!result.ok) {
    showStatus('Invalid JSON: ' + result.error, false);
    return;
  }
  showStatus('Starting…', true);
  btnAction.disabled = true;

  MessagingService.sendMessage({ type: 'START_SCRAPING', config: result.config })
    .then((response) => {
      if (response && !response.ok) {
        showStatus(response.error ? 'Error: ' + response.error : 'Start failed.', false);
      } else {
        showStatus('Reloading book tab – scraping will start automatically.', true);
      }
      refreshUI();
    })
    .catch((err) => {
      showStatus('Error: ' + err.message, false);
      refreshUI();
    });
}

function stopScraping() {
  btnAction.disabled = true;
  MessagingService.sendMessage({ type: 'STOP_SCRAPING' })
    .then(() => {
      showStatus('Stopped.', false);
      refreshUI();
    })
    .catch((err) => {
      showStatus('Error: ' + err.message, false);
      refreshUI();
    });
}

async function refreshUI() {
  const data = await StorageService.get([STORAGE_KEYS.STATE]);
  const running = data[STORAGE_KEYS.STATE] === 'running';

  if (running) {
    btnAction.textContent = 'Stop Capture';
    btnAction.classList.remove('btn-primary');
    btnAction.classList.add('btn-danger');
  } else {
    btnAction.textContent = 'Start Capture';
    btnAction.classList.remove('btn-danger');
    btnAction.classList.add('btn-primary');
  }

  btnAction.disabled = false;
  btnExport.disabled = running;
  if (running) {
    showStatus('Scraping is running. Use Stop to end.', true);
  } else {
    showStatus('Ready to scrape.', false);
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.url) return;
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
      showStatus('This tab cannot be scraped. Open your book page in this tab, then click Start.', false);
    }
  });
}

async function exportBook() {
  console.log('[ScrapeDown] exportBook clicked');
  const data = await StorageService.get(['scraper_full_book_content']);
  const text = data.scraper_full_book_content || '';
  if (!text) {
    showStatus('No scraped content yet. Run the scraper first.', false);
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showStatus('Copied ' + text.length + ' characters to clipboard.', false);
  } catch (e) {
    showStatus('Could not copy. Try opening DevTools and check storage.', false);
  }
}

async function toggleScraping() {
  console.log('[ScrapeDown] toggleScraping clicked');
  const data = await StorageService.get([STORAGE_KEYS.STATE]);
  const running = data[STORAGE_KEYS.STATE] === 'running';
  if (running) {
    stopScraping();
  } else {
    startScraping();
  }
}

select.addEventListener('change', onProfileChange);
btnAction.addEventListener('click', toggleScraping);
btnSaveProfile.addEventListener('click', saveCurrentAsNewProfile);
btnExport.addEventListener('click', exportBook);

StorageService.onChange((changes) => {
  if (changes[STORAGE_KEYS.STATE]) refreshUI();
});

ProfileManager.initDefaults().then(async ({ profiles, activeId }) => {
  rebuildProfileSelect(profiles, activeId);
  await onProfileChange();
  refreshUI();
});
