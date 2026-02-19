'use strict';

const LOG_PREFIX = '[Universal Book Scraper]';

const STORAGE_KEYS = {
  STATE: 'scraper_state',
  CONFIG: 'scraper_config',
  FULL_BOOK: 'scraper_full_book_content',
  PAGE_INDEX: 'scraper_page_index'
};

function log() {
  console.log.apply(console, [LOG_PREFIX].concat(Array.prototype.slice.call(arguments)));
}
function warn() {
  console.warn.apply(console, [LOG_PREFIX].concat(Array.prototype.slice.call(arguments)));
}

function getTurndownService() {
  if (typeof TurndownService === 'undefined') {
    warn('TurndownService not defined – ensure vendor/turndown.js is loaded before content.js');
    return null;
  }
  return new TurndownService({ headingStyle: 'atx' });
}

function getConfig() {
  return chrome.storage.local.get([STORAGE_KEYS.CONFIG]).then((data) => data[STORAGE_KEYS.CONFIG] || null);
}

function getState() {
  return chrome.storage.local.get([STORAGE_KEYS.STATE]).then((data) => data[STORAGE_KEYS.STATE] || 'stopped');
}

function ensureTitleTags(root, titleSelectors) {
  if (!titleSelectors || !root) return;
  const selectors = titleSelectors.filter(Boolean);
  if (selectors.length === 0) return;
  selectors.forEach((sel) => {
    try {
      root.querySelectorAll(sel).forEach((el) => {
        const tag = el.tagName && el.tagName.match(/^H([1-6])$/i);
        if (tag) return;
        const level = 2;
        const wrap = document.createElement('h' + level);
        wrap.setAttribute('data-turndown-heading', '1');
        el.parentNode.insertBefore(wrap, el);
        wrap.appendChild(el);
      });
    } catch (_) {}
  });
}

function sanitizeWatermarks(root) {
  if (!root) return;
  const text = root.textContent || '';
  const copyCopyright = /copy\s*copyright|©\s*copy|watermark/i;
  root.querySelectorAll('*').forEach((el) => {
    const t = (el.childNodes.length === 1 && el.firstChild.nodeType === 3 && el.textContent) || '';
    if (copyCopyright.test(t)) el.remove();
  });
}

function getRoot(config) {
  log('Looking for root selector:', config.rootSelector);
  const rootSel = (config.rootSelector || '').trim();
  const root = document.querySelector(rootSel);

  const subRootSel = (config.subRootSelector || '').trim();
  if (!subRootSel)
     return root;

  log('Looking getting sub-root content from:', root);
  const iframeDoc = root.contentDocument || root.contentWindow.document;
  log('Looking for sub-root selector:', subRootSel);
  const subRoot = iframeDoc.querySelector(subRootSel);
  return subRoot;

 
}

function scrapePage(config) {
  const root = getRoot(config);
  if (!root) {
    log('Root not found for selector');
    return Promise.resolve({ ok: false, markdown: '', reason: 'root not found' });
  }

  log('Scraping root found, length:', root.innerText ? root.innerText.length : 0);

  const clone = root.cloneNode(true);
  ensureTitleTags(clone, config.titleSelectors);
  sanitizeWatermarks(clone);

  const turndown = getTurndownService();
  if (!turndown) {
    warn('TurndownService not loaded – check extension console for errors');
    return Promise.resolve({ ok: false, markdown: '', reason: 'TurndownService not loaded' });
  }

  let markdown = '';
  try {
    markdown = turndown.turndown(clone);
  } catch (e) {
    return Promise.resolve({ ok: false, markdown: '', reason: String(e.message) });
  }
  return Promise.resolve({ ok: true, markdown });
}

function stopConditionMet(config) {
  const stop = config.stopCondition;
  if (!stop || stop.type !== 'exists')
    return false;
  
  try {
    log('Checking stop condition selector:', stop.selector);
    return !!document.querySelector(stop.selector);
  } catch (_) {
    log('Invalid stop condition selector:', stop.selector);
    return false;
  }
}

function clickNext(config) {
  const sel = config.nextBtnSelector;
  if (!sel) return false;
  try {
    const btn = document.querySelector(sel);
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
  } catch (_) {}
  return false;
}

function appendAndPersist(markdown) {
  log('Appending scraped content, length:', markdown.length);
  return chrome.storage.local.get([STORAGE_KEYS.FULL_BOOK]).then((data) => {
    const existing = data[STORAGE_KEYS.FULL_BOOK] || '';
    const sep = existing ? '\n\n---\n\n' : '';
    const next = existing + sep + markdown;
    return chrome.storage.local.set({ [STORAGE_KEYS.FULL_BOOK]: next });
  });
}

function runLoop() {
  getState().then((state) => {
    if (state !== 'running') {
      log('runLoop: state is', state, '- exiting');
      return;
    }
    getConfig().then((config) => {
      if (!config) {
        warn('runLoop: no config in storage');
        return;
      }
      log('runLoop: config profile=', config.profileName);
      const delay = Math.max(500, Number(config.delay) || 3000);

      if (stopConditionMet(config)) {
        log('Stop condition met – stopping');
        chrome.storage.local.set({ [STORAGE_KEYS.STATE]: 'stopped' });
        chrome.runtime.sendMessage({ type: 'SET_ICON', running: false }).catch(() => {});
        return;
      }

      scrapePage(config).then((result) => {
        if (!result.ok) {
          log('Scrape failed:', result.reason, '- retrying in', delay, 'ms');
          setTimeout(runLoop, delay);
          return;
        }
        log('Scraped', result.markdown ? result.markdown.length : 0, 'chars');
        if (result.markdown) {
          appendAndPersist(result.markdown).then(() => {
            const clicked = clickNext(config);
            log('Next button clicked:', clicked);
            if (clicked) {
              log('Reloading in', delay, 'ms');
              setTimeout(() => location.reload(), delay);
            } else {
              log('No next button – stopping');
              chrome.storage.local.set({ [STORAGE_KEYS.STATE]: 'stopped' });
              chrome.runtime.sendMessage({ type: 'SET_ICON', running: false }).catch(() => {});
            }
          });
        } else {
          const clicked = clickNext(config);
          if (clicked) setTimeout(() => location.reload(), delay);
          else {
            chrome.storage.local.set({ [STORAGE_KEYS.STATE]: 'stopped' });
            chrome.runtime.sendMessage({ type: 'SET_ICON', running: false }).catch(() => {});
          }
        }
      });
    });
  });
}

function init() {
  try {
    getState().then((state) => {
      log('Init: state=', state);
      if (state === 'running') {
        const delay = 1500;
        log('Running in', delay, 'ms...');
        setTimeout(runLoop, delay);
      }
    }).catch((err) => {
      warn('Init error:', err);
    });
  } catch (e) {
    warn('Init failed:', e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
