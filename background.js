'use strict';

const STORAGE_KEYS = { STATE: 'scraper_state', CONFIG: 'scraper_config' };

async function reloadActiveTab() {
  return (async () => {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tabs[0]) await chrome.tabs.reload(tabs[0].id);
    return tabs[0];
  })();
}

chrome.runtime.onMessage.addListener(async (message, _sender, sendResponse) => {
  if (message.type === 'SET_ICON') {
    const base = message.running ? 'icons/icon_active' : 'icons/icon';
    (async () => {
      try {
        await chrome.action.setIcon({
          path: { 16: base + '16.png', 48: base + '48.png', 128: base + '128.png' }
        });
        sendResponse({ ok: true });
      } catch {
        sendResponse({ ok: true });
      }
    })();
    return true;
  }
  if (message.type === 'START_SCRAPING') {
    const config = message.config;
    // Clear previous book content before starting
    (async () => {
      try {
        await chrome.storage.local.set({
          [STORAGE_KEYS.STATE]: 'running',
          [STORAGE_KEYS.CONFIG]: config,
          scraper_full_book_content: '',
          scraper_session_page_count: 0
        });
        try {
          await chrome.action.setIcon({
            path: { 16: 'icons/icon_active16.png', 48: 'icons/icon_active48.png', 128: 'icons/icon_active128.png' }
          });
        } catch {}
        await reloadActiveTab();
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ ok: false, error: String(err) });
      }
    })();
    return true;
  }
  if (message.type === 'STOP_SCRAPING') {
    (async () => {
      try {
        await chrome.storage.local.set({ [STORAGE_KEYS.STATE]: 'stopped' });
        try {
          await chrome.action.setIcon({
            path: { 16: 'icons/icon16.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' }
          });
        } catch {}
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

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== 'local') return;
  const stateChange = changes.scraper_state;
  if (!stateChange) return;
  (async () => {
    try {
      if (stateChange.newValue === 'running') {
        await chrome.action.setIcon({
          path: {
            16: 'icons/icon_active16.png',
            48: 'icons/icon_active48.png',
            128: 'icons/icon_active128.png'
          }
        });
      } else if (stateChange.newValue === 'stopped') {
        await chrome.action.setIcon({
          path: { 16: 'icons/icon16.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' }
        });
      }
    } catch {}
  })();
});
