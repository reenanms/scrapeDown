'use strict';

const STORAGE_KEYS = { STATE: 'scraper_state', CONFIG: 'scraper_config' };

function reloadActiveTab() {
  return chrome.tabs.query({ active: true, lastFocusedWindow: true }).then((tabs) => {
    if (tabs[0]) chrome.tabs.reload(tabs[0].id);
    return tabs[0];
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SET_ICON') {
    const base = message.running ? 'icons/icon_active' : 'icons/icon';
    chrome.action.setIcon({
      path: { 16: base + '16.png', 48: base + '48.png', 128: base + '128.png' }
    }).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === 'START_SCRAPING') {
    const config = message.config;
    chrome.storage.local.set({
      [STORAGE_KEYS.STATE]: 'running',
      [STORAGE_KEYS.CONFIG]: config
    }).then(() => {
      chrome.action.setIcon({
        path: { 16: 'icons/icon_active16.png', 48: 'icons/icon_active48.png', 128: 'icons/icon_active128.png' }
      }).catch(() => {});
      return reloadActiveTab();
    }).then(() => sendResponse({ ok: true })).catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  if (message.type === 'STOP_SCRAPING') {
    chrome.storage.local.set({ [STORAGE_KEYS.STATE]: 'stopped' }).then(() => {
      chrome.action.setIcon({
        path: { 16: 'icons/icon16.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' }
      }).catch(() => {});
      return reloadActiveTab();
    }).then(() => sendResponse({ ok: true })).catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  sendResponse({});
  return false;
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  const stateChange = changes.scraper_state;
  if (!stateChange) return;
  if (stateChange.newValue === 'running') {
    chrome.action.setIcon({
      path: {
        16: 'icons/icon_active16.png',
        48: 'icons/icon_active48.png',
        128: 'icons/icon_active128.png'
      }
    }).catch(() => {});
  } else if (stateChange.newValue === 'stopped') {
    chrome.action.setIcon({
      path: { 16: 'icons/icon16.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' }
    }).catch(() => {});
  }
});
