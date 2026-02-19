(function () {
  'use strict';

  const STORAGE_KEYS = {
    PROFILES: 'scraper_profiles',
    ACTIVE_PROFILE_ID: 'scraper_active_profile_id',
    STATE: 'scraper_state',
    CONFIG: 'scraper_config'
  };

  // Default McGraw Hill config (hardcoded as requested)
  const DEFAULT_CONFIG = {
    profileName: "McGraw Hill Books",
    rootSelector: "iframe",
    subRootSelector: "body",
    nextBtnSelector: "button[id='next-button']",
    stopCondition: {
      selector: "button[id='next-button'][disabled]",
      type: "exists"
    },
    delay: 500
  };

  // Optional: full structure with titleSelectors for compatibility
  const DEFAULT_CONFIG_FULL = {
    ...DEFAULT_CONFIG,
    titleSelectors: ["h1", "h2", "h3", ".chapter-title"],
    // Example: Remove "Return to Figure" links
    replacements: [
      {
        pattern: "\\[Return to [^\\]]+\\.\\]\\(javascript:void\\(0\\);\\)",
        flags: "g",
        replacement: ""
      }
    ]
  };

  const select = document.getElementById('profileSelect');
  const textarea = document.getElementById('configJson');
  const pageLimitInput = document.getElementById('pageLimit');
  const btnStart = document.getElementById('btnStart');
  const btnStop = document.getElementById('btnStop');
  const btnSaveProfile = document.getElementById('btnSaveProfile');
  const btnExport = document.getElementById('btnExport');
  const statusEl = document.getElementById('status');

  function showStatus(msg, isRunning) {
    statusEl.textContent = msg;
    statusEl.className = 'status ' + (isRunning ? 'running' : 'stopped');
  }

  function getDefaultConfigJson() {
    return JSON.stringify(DEFAULT_CONFIG_FULL, null, 2);
  }

  function parseConfigJson(raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.profileName) parsed.profileName = 'Unnamed';
      if (parsed.delay == null) parsed.delay = 3000;
      if (!parsed.stopCondition) parsed.stopCondition = { selector: "button[disabled]", type: "exists" };
      return { ok: true, config: parsed };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  function loadProfiles() {
    return chrome.storage.local.get([STORAGE_KEYS.PROFILES, STORAGE_KEYS.ACTIVE_PROFILE_ID]).then((data) => {
      const profiles = data[STORAGE_KEYS.PROFILES] || {};
      const activeId = data[STORAGE_KEYS.ACTIVE_PROFILE_ID] || '__default__';
      return { profiles, activeId };
    });
  }

  function saveProfiles(profiles, activeId) {
    return chrome.storage.local.set({
      [STORAGE_KEYS.PROFILES]: profiles,
      [STORAGE_KEYS.ACTIVE_PROFILE_ID]: activeId
    });
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
    let baseConfig = { ...DEFAULT_CONFIG_FULL };
    if (raw) {
      const parsed = parseConfigJson(raw);
      if (!parsed.ok) return parsed;
      baseConfig = parsed.config;
    }
    // Add pageLimit from input if set
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

  function onProfileChange() {
    const id = select.value;
    btnSaveProfile.style.display = id === '__new__' ? 'block' : 'none';
    if (id === '__new__') {
      textarea.value = '';
      textarea.placeholder = 'Paste your profile JSON here. Use "Save as profile" to keep it.';
      return;
    }
    if (id === '__default__') {
      applyConfigToTextarea(DEFAULT_CONFIG_FULL);
      return;
    }
    loadProfiles().then(({ profiles }) => {
      if (profiles[id]) applyConfigToTextarea(profiles[id]);
    });
  }

  function saveCurrentAsNewProfile() {
    const result = getCurrentConfigFromTextarea();
    if (!result.ok) {
      showStatus('Invalid JSON: ' + result.error, false);
      return;
    }
    const name = result.config.profileName || 'New Profile';
    const id = 'custom_' + Date.now();
    loadProfiles().then(({ profiles, activeId }) => {
      profiles[id] = result.config;
      return saveProfiles(profiles, id).then(() => {
        rebuildProfileSelect(profiles, id);
        applyConfigToTextarea(result.config);
        showStatus('Saved as "' + name + '"', false);
      });
    });
  }

  function startScraping() {
    console.log('startScraping: called');

    const result = getCurrentConfigFromTextarea();
    if (!result.ok) {
      showStatus('Invalid JSON: ' + result.error, false);
      return;
    }
    showStatus('Starting…', true);
    btnStart.disabled = true;
    chrome.runtime.sendMessage({ type: 'START_SCRAPING', config: result.config }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('Error: ' + chrome.runtime.lastError.message, false);
        refreshUI();
        return;
      }
      if (response && !response.ok) {
        showStatus(response.error ? 'Error: ' + response.error : 'Start failed.', false);
        refreshUI();
        return;
      }
      showStatus('Reloading book tab – scraping will start automatically.', true);
      refreshUI();
    });
  }

  function stopScraping() {
    btnStop.disabled = true;
    chrome.runtime.sendMessage({ type: 'STOP_SCRAPING' }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('Error: ' + chrome.runtime.lastError.message, false);
        refreshUI();
        return;
      }
      showStatus('Stopped.', false);
      refreshUI();
    });
  }

  function refreshUI() {
    chrome.storage.local.get([STORAGE_KEYS.STATE]).then((data) => {
      const running = data[STORAGE_KEYS.STATE] === 'running';
      btnStart.disabled = running;
      btnStop.disabled = !running;
      btnExport.disabled = running;
      if (running) showStatus('Scraping is running. Use Stop to end.', true);
    });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.url) return;
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
        showStatus('This tab cannot be scraped. Open your book page in this tab, then click Start.', false);
      }
    });
  }

  function exportBook() {
    chrome.storage.local.get(['scraper_full_book_content'], (data) => {
      const text = data.scraper_full_book_content || '';
      if (!text) {
        showStatus('No scraped content yet. Run the scraper first.', false);
        return;
      }
      navigator.clipboard.writeText(text).then(() => {
        showStatus('Copied ' + text.length + ' characters to clipboard.', false);
      }).catch(() => {
        showStatus('Could not copy. Try opening DevTools and check storage.', false);
      });
    });
  }

  select.addEventListener('change', onProfileChange);
  btnStart.addEventListener('click', startScraping);
  btnStop.addEventListener('click', stopScraping);
  btnSaveProfile.addEventListener('click', saveCurrentAsNewProfile);
  btnExport.addEventListener('click', exportBook);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STORAGE_KEYS.STATE]) {
      refreshUI();
    }
  });

  loadProfiles().then(({ profiles, activeId }) => {
    if (!profiles.__default__) {
      profiles.__default__ = DEFAULT_CONFIG_FULL;
      saveProfiles(profiles, activeId).then(() => rebuildProfileSelect(profiles, activeId));
    } else {
      rebuildProfileSelect(profiles, activeId);
    }
    if (activeId === '__default__') applyConfigToTextarea(DEFAULT_CONFIG_FULL);
    else if (activeId !== '__new__' && profiles[activeId]) applyConfigToTextarea(profiles[activeId]);
    refreshUI();
  });
})();
