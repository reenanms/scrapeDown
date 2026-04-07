(() => {
  // src/core/StorageService.js
  var StorageService = class {
    /**
     * Get an item or multiple items from local storage.
     * @param {string|string[]} keys 
     * @returns {Promise<Object>}
     */
    static async get(keys) {
      return chrome.storage.local.get(keys);
    }
    /**
     * Set items to local storage.
     * @param {Object} items 
     * @returns {Promise<void>}
     */
    static async set(items) {
      return chrome.storage.local.set(items);
    }
    /**
     * Listen for changes on local storage.
     * @param {Function} callback 
     */
    static onChange(callback) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === "local") {
          callback(changes);
        }
      });
    }
  };

  // src/config/DefaultConfig.js
  var DEFAULT_CONFIG = {
    profileName: "McGraw Hill Books",
    rootSelector: "iframe",
    subRootSelector: "body",
    nextBtnSelector: "button[id='next-button']",
    stopCondition: {
      selector: "button[id='next-button'][disabled]",
      type: "exists"
    },
    delay: 800,
    titleSelectors: ["h1", "h2", "h3", ".chapter-title"],
    replacements: [
      {
        pattern: "\\[Return to [^\\]]+\\]\\(javascript:void\\(0\\);\\)",
        flags: "g",
        replacement: ""
      },
      {
        pattern: "\\(javascript:void\\(0\\);.*\\)",
        flags: "g",
        replacement: "()"
      }
    ]
  };

  // src/config/ProfileManager.js
  var STORAGE_KEYS = {
    PROFILES: "scraper_profiles",
    ACTIVE_PROFILE_ID: "scraper_active_profile_id"
  };
  var ProfileManager = class {
    static async loadProfiles() {
      const data = await StorageService.get([STORAGE_KEYS.PROFILES, STORAGE_KEYS.ACTIVE_PROFILE_ID]);
      const profiles = data[STORAGE_KEYS.PROFILES] || {};
      const activeId = data[STORAGE_KEYS.ACTIVE_PROFILE_ID] || "__default__";
      return { profiles, activeId };
    }
    static async saveProfiles(profiles, activeId) {
      await StorageService.set({
        [STORAGE_KEYS.PROFILES]: profiles,
        [STORAGE_KEYS.ACTIVE_PROFILE_ID]: activeId
      });
    }
    static async saveNewProfile(configData) {
      const { profiles, activeId } = await this.loadProfiles();
      const id = "custom_" + Date.now();
      profiles[id] = configData;
      await this.saveProfiles(profiles, id);
      return id;
    }
    static parseConfigJson(raw) {
      try {
        const parsed = JSON.parse(raw);
        if (!parsed.profileName) parsed.profileName = "Unnamed";
        if (parsed.delay == null) parsed.delay = 3e3;
        if (!parsed.stopCondition) parsed.stopCondition = { selector: "button[disabled]", type: "exists" };
        return { ok: true, config: parsed };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }
    static async initDefaults() {
      const { profiles, activeId } = await this.loadProfiles();
      if (!profiles.__default__) {
        profiles.__default__ = DEFAULT_CONFIG;
        await this.saveProfiles(profiles, activeId);
      }
      return { profiles, activeId };
    }
  };

  // src/core/MessagingService.js
  var MessagingService = class {
    /**
     * Sends a message to the background or popup.
     * @param {Object} message 
     * @returns {Promise<Object>}
     */
    static sendMessage(message) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });
    }
    /**
     * Adds a listener for messages.
     * @param {Function} callback 
     */
    static addListener(callback) {
      chrome.runtime.onMessage.addListener(callback);
    }
  };

  // src/popup.js
  var STORAGE_KEYS2 = { STATE: "scraper_state" };
  var select = document.getElementById("profileSelect");
  var textarea = document.getElementById("configJson");
  var pageLimitInput = document.getElementById("pageLimit");
  var btnStart = document.getElementById("btnStart");
  var btnStop = document.getElementById("btnStop");
  var btnSaveProfile = document.getElementById("btnSaveProfile");
  var btnExport = document.getElementById("btnExport");
  var statusEl = document.getElementById("status");
  function showStatus(msg, isRunning) {
    statusEl.textContent = msg;
    statusEl.className = "status " + (isRunning ? "running" : "stopped");
  }
  function rebuildProfileSelect(profiles, activeId) {
    const ids = Object.keys(profiles);
    select.innerHTML = "";
    const defaultOpt = document.createElement("option");
    defaultOpt.value = "__default__";
    defaultOpt.textContent = "McGraw Hill Books";
    select.appendChild(defaultOpt);
    const newOpt = document.createElement("option");
    newOpt.value = "__new__";
    newOpt.textContent = "Create New...";
    select.appendChild(newOpt);
    ids.forEach((id) => {
      if (id === "__default__" || id === "__new__") return;
      const opt = document.createElement("option");
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
    btnSaveProfile.style.display = id === "__new__" ? "block" : "none";
    if (id === "__new__") {
      textarea.value = "";
      textarea.placeholder = 'Paste your profile JSON here. Use "Save as profile" to keep it.';
      return;
    }
    if (id === "__default__") {
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
      showStatus("Invalid JSON: " + result.error, false);
      return;
    }
    const name = result.config.profileName || "New Profile";
    const id = await ProfileManager.saveNewProfile(result.config);
    const { profiles } = await ProfileManager.loadProfiles();
    rebuildProfileSelect(profiles, id);
    applyConfigToTextarea(result.config);
    showStatus('Saved as "' + name + '"', false);
  }
  function startScraping() {
    const result = getCurrentConfigFromTextarea();
    if (!result.ok) {
      showStatus("Invalid JSON: " + result.error, false);
      return;
    }
    showStatus("Starting\u2026", true);
    btnStart.disabled = true;
    MessagingService.sendMessage({ type: "START_SCRAPING", config: result.config }).then((response) => {
      if (response && !response.ok) {
        showStatus(response.error ? "Error: " + response.error : "Start failed.", false);
      } else {
        showStatus("Reloading book tab \u2013 scraping will start automatically.", true);
      }
      refreshUI();
    }).catch((err) => {
      showStatus("Error: " + err.message, false);
      refreshUI();
    });
  }
  function stopScraping() {
    btnStop.disabled = true;
    MessagingService.sendMessage({ type: "STOP_SCRAPING" }).then(() => {
      showStatus("Stopped.", false);
      refreshUI();
    }).catch((err) => {
      showStatus("Error: " + err.message, false);
      refreshUI();
    });
  }
  async function refreshUI() {
    const data = await StorageService.get([STORAGE_KEYS2.STATE]);
    const running = data[STORAGE_KEYS2.STATE] === "running";
    btnStart.disabled = running;
    btnStop.disabled = !running;
    btnExport.disabled = running;
    if (running) {
      showStatus("Scraping is running. Use Stop to end.", true);
    }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab || !tab.url) return;
      if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:")) {
        showStatus("This tab cannot be scraped. Open your book page in this tab, then click Start.", false);
      }
    });
  }
  async function exportBook() {
    const data = await StorageService.get(["scraper_full_book_content"]);
    const text = data.scraper_full_book_content || "";
    if (!text) {
      showStatus("No scraped content yet. Run the scraper first.", false);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showStatus("Copied " + text.length + " characters to clipboard.", false);
    } catch (e) {
      showStatus("Could not copy. Try opening DevTools and check storage.", false);
    }
  }
  select.addEventListener("change", onProfileChange);
  btnStart.addEventListener("click", startScraping);
  btnStop.addEventListener("click", stopScraping);
  btnSaveProfile.addEventListener("click", saveCurrentAsNewProfile);
  btnExport.addEventListener("click", exportBook);
  StorageService.onChange((changes) => {
    if (changes[STORAGE_KEYS2.STATE]) refreshUI();
  });
  ProfileManager.initDefaults().then(({ profiles, activeId }) => {
    rebuildProfileSelect(profiles, activeId);
    if (activeId === "__default__") {
      applyConfigToTextarea(DEFAULT_CONFIG);
    } else if (activeId !== "__new__" && profiles[activeId]) {
      applyConfigToTextarea(profiles[activeId]);
    }
    refreshUI();
  });
})();
