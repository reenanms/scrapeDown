(() => {
  // scraper/DOMService.js
  var DOMService = class {
    constructor(config) {
      this.config = config;
    }
    getRoot() {
      const rootSel = (this.config.rootSelector || "").trim();
      const root = document.querySelector(rootSel);
      const subRootSel = (this.config.subRootSelector || "").trim();
      if (!subRootSel) return root;
      if (!root) return null;
      const iframeDoc = root.contentDocument || root.contentWindow && root.contentWindow.document;
      if (!iframeDoc) return null;
      return iframeDoc.querySelector(subRootSel);
    }
    getButton(listRoots, sel) {
      for (const root of listRoots) {
        if (root) {
          const btn = root.querySelector(sel);
          if (btn) return btn;
        }
      }
      return null;
    }
    clickNext() {
      const sel = this.config.nextBtnSelector;
      if (!sel) return false;
      try {
        const root = this.getRoot();
        const btn = this.getButton([root, document], sel);
        if (btn && !btn.disabled) {
          btn.click();
          return true;
        }
      } catch (_) {
      }
      return false;
    }
    ensureTitleTags(root) {
      const titleSelectors = this.config.titleSelectors;
      if (!titleSelectors || !root) return;
      const selectors = titleSelectors.filter(Boolean);
      if (selectors.length === 0) return;
      selectors.forEach((sel) => {
        try {
          root.querySelectorAll(sel).forEach((el) => {
            const tag = el.tagName && el.tagName.match(/^H([1-6])$/i);
            if (tag) return;
            const wrap = document.createElement("h2");
            wrap.setAttribute("data-turndown-heading", "1");
            el.parentNode.insertBefore(wrap, el);
            wrap.appendChild(el);
          });
        } catch (_) {
        }
      });
    }
    sanitizeWatermarks(root) {
      if (!root) return;
      const copyCopyright = /copy\s*copyright|©\s*copy|watermark/i;
      root.querySelectorAll("*").forEach((el) => {
        const t = el.childNodes.length === 1 && el.firstChild.nodeType === 3 && el.textContent || "";
        if (copyCopyright.test(t)) el.remove();
      });
    }
  };

  // scraper/MarkdownService.js
  var MarkdownService = class {
    constructor(config) {
      this.config = config;
      this.turndown = this._getTurndownService();
    }
    _getTurndownService() {
      if (typeof TurndownService === "undefined") {
        console.warn("[ScrapeDown] TurndownService not defined \u2013 ensure vendor/turndown.js is loaded");
        return null;
      }
      return new TurndownService({ headingStyle: "atx" });
    }
    applyReplacements(markdown) {
      if (!this.config || !Array.isArray(this.config.replacements)) return markdown;
      let result = markdown;
      for (const rep of this.config.replacements) {
        if (rep.pattern) {
          try {
            const re = new RegExp(rep.pattern, rep.flags || "g");
            result = result.replace(re, rep.replacement || "");
          } catch (e) {
            console.warn("[ScrapeDown] Invalid replacement pattern:", rep.pattern, e.message);
          }
        }
      }
      return result;
    }
    convertToMarkdown(element) {
      if (!this.turndown) {
        throw new Error("TurndownService not loaded");
      }
      let markdown = this.turndown.turndown(element);
      return this.applyReplacements(markdown);
    }
  };

  // core/StorageService.js
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

  // core/MessagingService.js
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

  // scraper/ScraperEngine.js
  var STORAGE_KEYS = {
    STATE: "scraper_state",
    CONFIG: "scraper_config",
    FULL_BOOK: "scraper_full_book_content",
    SESSION_PAGE_COUNT: "scraper_session_page_count"
  };
  var ScraperEngine = class {
    constructor() {
      this.state = "stopped";
      this.config = null;
    }
    log(...args) {
      console.log("[ScrapeDown]", ...args);
    }
    warn(...args) {
      console.warn("[ScrapeDown]", ...args);
    }
    async init() {
      try {
        const data = await StorageService.get([STORAGE_KEYS.STATE, STORAGE_KEYS.CONFIG]);
        this.state = data[STORAGE_KEYS.STATE] || "stopped";
        this.config = data[STORAGE_KEYS.CONFIG] || null;
        this.log("Init: state=", this.state);
        if (this.state === "running" && this.config) {
          const delay = 1500;
          this.log("Running in", delay, "ms...");
          setTimeout(() => this.runLoop(), delay);
        }
      } catch (err) {
        this.warn("Init error:", err);
      }
    }
    async getSessionPageCount() {
      const data = await StorageService.get([STORAGE_KEYS.SESSION_PAGE_COUNT]);
      return Number(data[STORAGE_KEYS.SESSION_PAGE_COUNT]) || 0;
    }
    async setSessionPageCount(val) {
      await StorageService.set({ [STORAGE_KEYS.SESSION_PAGE_COUNT]: val });
    }
    async appendAndPersist(markdown) {
      this.log("Appending scraped content, length:", markdown.length);
      const data = await StorageService.get([STORAGE_KEYS.FULL_BOOK]);
      const existing = data[STORAGE_KEYS.FULL_BOOK] || "";
      const sep = existing ? "\n\n---\n\n" : "";
      const next = existing + sep + markdown;
      await StorageService.set({ [STORAGE_KEYS.FULL_BOOK]: next });
    }
    async stopScraping() {
      await StorageService.set({ [STORAGE_KEYS.STATE]: "stopped" });
      await MessagingService.sendMessage({ type: "SET_ICON", running: false }).catch(() => {
      });
    }
    stopConditionMet(sessionCount) {
      if (typeof this.config.pageLimit === "number" && this.config.pageLimit > 0) {
        if (sessionCount >= this.config.pageLimit) {
          this.log("Page limit reached:", this.config.pageLimit);
          return true;
        }
      }
      const stop = this.config.stopCondition;
      if (!stop || stop.type !== "exists") return false;
      try {
        const domService = new DOMService(this.config);
        const root = domService.getRoot() || document;
        return !!root.querySelector(stop.selector);
      } catch (_) {
        return false;
      }
    }
    async runLoop() {
      if (this.state !== "running") return;
      if (!this.config) return;
      this.log("runLoop: config profile=", this.config.profileName);
      const delay = Math.max(500, Number(this.config.delay) || 3e3);
      const domService = new DOMService(this.config);
      const root = domService.getRoot();
      if (!root) {
        this.log("Root not found for selector, retrying...");
        setTimeout(() => this.runLoop(), delay);
        return;
      }
      const clone = root.cloneNode(true);
      domService.ensureTitleTags(clone);
      domService.sanitizeWatermarks(clone);
      const markdownService = new MarkdownService(this.config);
      let markdown = "";
      try {
        markdown = markdownService.convertToMarkdown(clone);
      } catch (e) {
        this.warn("Markdown conversion failed:", e);
        setTimeout(() => this.runLoop(), delay);
        return;
      }
      if (markdown) {
        const pageCount = await this.getSessionPageCount();
        await this.setSessionPageCount(pageCount + 1);
        await this.appendAndPersist(markdown);
        const updatedCount = await this.getSessionPageCount();
        if (this.stopConditionMet(updatedCount)) {
          this.log("Stop condition met \u2013 stopping");
          await this.stopScraping();
          return;
        }
      }
      const clicked = domService.clickNext();
      this.log("Next button clicked:", clicked);
      if (clicked) {
        this.log("Continuing in", delay, "ms");
        setTimeout(() => this.runLoop(), delay);
      } else {
        this.log("No next button \u2013 stopping");
        await this.stopScraping();
      }
    }
  };

  // content.js
  function init() {
    const engine = new ScraperEngine();
    engine.init();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
