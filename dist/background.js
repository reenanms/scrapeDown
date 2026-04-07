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

  // src/background.js
  var STORAGE_KEYS = { STATE: "scraper_state", CONFIG: "scraper_config" };
  async function reloadActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tabs[0]) await chrome.tabs.reload(tabs[0].id);
    return tabs[0];
  }
  async function setIconState(running) {
    const base = running ? "icons/icon_active" : "icons/icon";
    try {
      await chrome.action.setIcon({
        path: { 16: `${base}16.png`, 48: `${base}48.png`, 128: `${base}128.png` }
      });
    } catch (e) {
    }
  }
  MessagingService.addListener((message, _sender, sendResponse) => {
    if (message.type === "SET_ICON") {
      setIconState(message.running).then(() => sendResponse({ ok: true }));
      return true;
    }
    if (message.type === "START_SCRAPING") {
      (async () => {
        try {
          await StorageService.set({
            [STORAGE_KEYS.STATE]: "running",
            [STORAGE_KEYS.CONFIG]: message.config,
            scraper_full_book_content: "",
            scraper_session_page_count: 0
          });
          await setIconState(true);
          await reloadActiveTab();
          sendResponse({ ok: true });
        } catch (err) {
          sendResponse({ ok: false, error: String(err) });
        }
      })();
      return true;
    }
    if (message.type === "STOP_SCRAPING") {
      (async () => {
        try {
          await StorageService.set({ [STORAGE_KEYS.STATE]: "stopped" });
          await setIconState(false);
          await reloadActiveTab();
          sendResponse({ ok: true });
        } catch (err) {
          sendResponse({ ok: false, error: String(err) });
        }
      })();
      return true;
    }
    sendResponse({});
    return false;
  });
  StorageService.onChange(async (changes) => {
    const stateChange = changes[STORAGE_KEYS.STATE];
    if (!stateChange) return;
    await setIconState(stateChange.newValue === "running");
  });
})();
