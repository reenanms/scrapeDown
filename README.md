# Universal Book Scraper

Chrome Extension (Manifest V3) for configurable book scraping with profile support and HTML-to-Markdown conversion using Turndown (ATX-style headings).

## Setup

1. **Install dependency (for Turndown):**
   ```bash
   npm install
   ```
   This copies `turndown.browser.umd.js` into `vendor/turndown.js` (postinstall script).

2. **Load in Chrome:**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select this folder

3. **Optional – toolbar icons:**
   - Add `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png` for the default state.
   - Add `icons/icon_active16.png`, `icons/icon_active48.png`, `icons/icon_active128.png` (e.g. green) for the "running" state.

## Usage

1. Open the extension popup.
2. Choose **Scraping Profile** (default: "McGraw Hill") or **Create New...** and paste your JSON config.
3. Edit the config in the textarea if needed.
4. Click **Start**, then open the book reader page and stay on it.
5. The content script will: scrape → save Markdown to storage → click Next → reload and repeat until the stop condition.
6. Click **Stop** to end.

Scraped content is stored in `chrome.storage.local` under `scraper_full_book_content`. Use **Copy book** in the popup to copy the full Markdown to the clipboard.

### If it doesn't work

1. **Use a normal web page** – Content scripts do not run on `chrome://`, `edge://`, or the Chrome Web Store. Your book must be on an `http://` or `https://` URL.
2. **Correct tab** – Before clicking Start, the **active tab** (the one you're looking at) must be the book reader page. Open the book page, then click the extension icon, then Start.
3. **Check the console** – On the **book page** (not the popup), open DevTools (F12) → Console. Look for messages starting with `[Universal Book Scraper]`. You should see `Init: state= running` after reload. If you see `TurndownService not defined`, the Turndown script didn't load (re-run `npm install` and ensure `vendor/turndown.js` exists).
4. **Match the selectors** – The default "McGraw Hill" config uses `div[role='main'], #reader-content, .content-container` and `button[aria-label='Next'], .next-button`. If your book site uses different class/IDs, use **Create New...** and paste a config that matches your page (inspect the page to find the right selectors).

## Config JSON structure

- `profileName` – Display name.
- `rootSelector` – Main container selector (e.g. `#reader-content`).
- `titleSelectors` – Optional list of selectors to treat as headings (wrapped in `<h>` before conversion).
- `nextBtnSelector` – "Next" button selector.
- `stopCondition` – `{ "selector": "...", "type": "exists" }` to stop when that element exists.
- `delay` – Milliseconds to wait after load / before next step (default 3000).
