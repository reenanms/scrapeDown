# ScrapeDown

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
   The required icons are included in the `icons/` directory.

## Usage

1. Open the extension popup.
2. Choose a **Scraping Profile** from the dropdown. You can also select "Create New..." to define your own.
3. (Optional) Set a **Page Limit** to automatically stop after a certain number of pages.
4. (Optional) Edit the **Configuration JSON** directly in the textarea for one-time adjustments.
5. Make sure the active browser tab is on the first page of the book you want to scrape.
6. Click **Start**. The tab will reload, and scraping will begin.
7. The extension will automatically scrape content, click the "Next" button, and repeat.
8. Click **Stop** at any time to end the process.
9. Once stopped, click **Copy book** to copy all scraped content in Markdown format to your clipboard.

Scraped content is stored in `chrome.storage.local` under `scraper_full_book_content`. Use **Copy book** in the popup to copy the full Markdown to the clipboard.

### If it doesn't work

1. **Use a normal web page** – Content scripts do not run on `chrome://`, `edge://`, or the Chrome Web Store. Your book must be on an `http://` or `https://` URL.
2. **Correct tab** – Before clicking Start, the **active tab** (the one you're looking at) must be the book reader page. Open the book page, then click the extension icon, then Start.
3. **Check the console** – On the **book page** (not the popup), open DevTools (F12) → Console. Look for messages starting with `[ScrapeDown]`. You should see `Init: state= running` after reload. If you see `TurndownService not defined`, the Turndown script didn't load (re-run `npm install` and ensure `vendor/turndown.js` exists).
4. **Match the selectors** – The default "McGraw Hill Books" config is just an example. If your book site uses different class/IDs for its content and navigation, you must create a new profile with the correct CSS selectors for your page. Use your browser's developer tools (F12) to inspect the page and find the right selectors.

## Configuration Details

Each scraping profile is a JSON object that tells ScrapeDown how to find and process content.

- `profileName` (String): A user-friendly name for the profile that appears in the dropdown menu.
- `rootSelector` (String): A CSS selector to identify the main content container. This can be a comma-separated list of selectors (e.g., `div.main, #content, article`). The first one found is used.
- `subRootSelector` (String, Optional): Use this if the `rootSelector` points to an `<iframe>`. This selector will be used to find the content *inside* the iframe's document (e.g., `body`).
- `titleSelectors` (Array of Strings, Optional): A list of CSS selectors for elements that should be converted into Markdown headings (e.g., `h1`, `h2`). This helps to preserve the book's structure.
- `replacements` (Array of Objects, Optional): Used to clean the HTML *before* it's converted to Markdown. Each object defines a regular expression find-and-replace operation.
    -   `pattern`: The regular expression pattern (as a string, so backslashes must be escaped).
    -   `flags`: Regex flags, like `"g"` for global search (optional).
    -   `replacement`: The string to replace the matched pattern with.
- `nextBtnSelector` (String): The CSS selector for the "Next Page" button. This can be a comma-separated list. The first visible button that matches will be clicked.
- `stopCondition` (Object): Defines when the scraper should automatically stop.
    -   `selector`: A CSS selector for an element that indicates the end (e.g., a disabled "Next" button).
    -   `type`: The condition type. Currently, only `"exists"` is supported, which stops the process if the `selector` is found.
- `delay` (Number, Optional): The time in milliseconds to wait on each page before scraping. This is useful for pages that load content dynamically. Defaults to `3000` (3 seconds).
- `pageLimit` (Number, Optional): Set in the UI, not in the JSON. This runtime setting stops the scraper after a specified number of pages have been processed.
