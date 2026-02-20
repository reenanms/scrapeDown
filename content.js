// Apply text replacements to markdown using config.replacements
function applyReplacements(markdown, config) {
  if (!config || !Array.isArray(config.replacements)) return markdown;
  let result = markdown;
  for (const rep of config.replacements) {
    if (rep.pattern) {
      try {
        const re = new RegExp(rep.pattern, rep.flags || 'g');
        result = result.replace(re, rep.replacement || '');
      } catch (e) {
        warn('Invalid replacement pattern:', rep.pattern, e.message);
      }
    }
  }
  return result;
}
'use strict';

const LOG_PREFIX = '[ScrapeDown]';

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

const SESSION_PAGE_COUNT_KEY = 'scraper_session_page_count';
async function getSessionPageCount() {
  const data = await chrome.storage.local.get([SESSION_PAGE_COUNT_KEY]);
  return Number(data[SESSION_PAGE_COUNT_KEY]) || 0;
}

async function setSessionPageCount(val) {
  await chrome.storage.local.set({ [SESSION_PAGE_COUNT_KEY]: val });
}

function getTurndownService() {
  if (typeof TurndownService === 'undefined') {
    warn('TurndownService not defined – ensure vendor/turndown.js is loaded before content.js');
    return null;
  }
  return new TurndownService({ headingStyle: 'atx' });
}

async function getConfig() {
  const data = await chrome.storage.local.get([STORAGE_KEYS.CONFIG]);
  return data[STORAGE_KEYS.CONFIG] || null;
}

async function getState() {
  const data = await chrome.storage.local.get([STORAGE_KEYS.STATE]);
  return data[STORAGE_KEYS.STATE] || 'stopped';
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

async function scrapePage(config) {
  const root = getRoot(config);
  if (!root) {
    log('Root not found for selector');
    return { ok: false, markdown: '', reason: 'root not found' };
  }

  log('Scraping root found, length:', root.innerText ? root.innerText.length : 0);

  const clone = root.cloneNode(true);
  ensureTitleTags(clone, config.titleSelectors);
  sanitizeWatermarks(clone);

  const turndown = getTurndownService();
  if (!turndown) {
    warn('TurndownService not loaded – check extension console for errors');
    return { ok: false, markdown: '', reason: 'TurndownService not loaded' };
  }

  let markdown = '';
  try {
    markdown = turndown.turndown(clone);
    // Apply replacements if configured
    markdown = applyReplacements(markdown, config);
  } catch (e) {
    return { ok: false, markdown: '', reason: String(e.message) };
  }
  return { ok: true, markdown };
}


function stopConditionMet(config) {
  // Stop if pageLimit is set and reached (relative to session start)
  // Accept sessionPageCount as an argument for reload persistence
  let sessionCount = arguments.length > 1 ? arguments[1] : 0;
  if (typeof config.pageLimit === 'number' && config.pageLimit > 0) {
    if (sessionCount >= config.pageLimit) {
      log('Page limit reached:', config.pageLimit);
      return true;
    }
  }
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

async function appendAndPersist(markdown) {
  log('Appending scraped content, length:', markdown.length);
  const data = await chrome.storage.local.get([STORAGE_KEYS.FULL_BOOK]);
  const existing = data[STORAGE_KEYS.FULL_BOOK] || '';
  const sep = existing ? '\n\n---\n\n' : '';
  const next = existing + sep + markdown;
  await chrome.storage.local.set({ [STORAGE_KEYS.FULL_BOOK]: next });
}

async function runLoop() {
  const state = await getState();
  if (state !== 'running') {
    log('runLoop: state is', state, '- exiting');
    return;
  }
  const config = await getConfig();
  if (!config) {
    warn('runLoop: no config in storage');
    return;
  }
  log('runLoop: config profile=', config.profileName);
  const delay = Math.max(500, Number(config.delay) || 3000);

  const sessionPageCount = await getSessionPageCount();
  const result = await scrapePage(config);
  if (!result.ok) {
    log('Scrape failed:', result.reason, '- retrying in', delay, 'ms');
    setTimeout(runLoop, delay);
    return;
  }
  log('Scraped', result.markdown ? result.markdown.length : 0, 'chars');
  if (result.markdown) {
    await setSessionPageCount(sessionPageCount + 1);
    await appendAndPersist(result.markdown);
    const updatedCount = await getSessionPageCount();
    // Check stop condition AFTER saving the current page
    if (stopConditionMet(config, updatedCount)) {
      log('Stop condition met – stopping');
      await chrome.storage.local.set({ [STORAGE_KEYS.STATE]: 'stopped' });
      await chrome.runtime.sendMessage({ type: 'SET_ICON', running: false }).catch(() => {});
      return;
    }
    const clicked = clickNext(config);
    log('Next button clicked:', clicked);
    if (clicked) {
      log('Reloading in', delay, 'ms');
      setTimeout(() => location.reload(), delay);
    } else {
      log('No next button – stopping');
      await chrome.storage.local.set({ [STORAGE_KEYS.STATE]: 'stopped' });
      await chrome.runtime.sendMessage({ type: 'SET_ICON', running: false }).catch(() => {});
    }
  } else {
    const clicked = clickNext(config);
    if (clicked) setTimeout(() => location.reload(), delay);
    else {
      await chrome.storage.local.set({ [STORAGE_KEYS.STATE]: 'stopped' });
      await chrome.runtime.sendMessage({ type: 'SET_ICON', running: false }).catch(() => {});
    }
  }
}

async function init() {
  try {
    const state = await getState();
    log('Init: state=', state);
    if (state === 'running') {
      const delay = 1500;
      log('Running in', delay, 'ms...');
      setTimeout(runLoop, delay);
    }
  } catch (err) {
    warn('Init error:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
