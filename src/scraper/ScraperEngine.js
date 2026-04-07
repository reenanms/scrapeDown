import { DOMService } from './DOMService';
import { MarkdownService } from './MarkdownService';
import { StorageService } from '../core/StorageService';
import { MessagingService } from '../core/MessagingService';

const STORAGE_KEYS = {
    STATE: 'scraper_state',
    CONFIG: 'scraper_config',
    FULL_BOOK: 'scraper_full_book_content',
    SESSION_PAGE_COUNT: 'scraper_session_page_count'
};

export class ScraperEngine {
    constructor() {
        this.state = 'stopped';
        this.config = null;
    }

    log(...args) {
        console.log('[ScrapeDown]', ...args);
    }

    warn(...args) {
        console.warn('[ScrapeDown]', ...args);
    }

    async init() {
        try {
            const data = await StorageService.get([STORAGE_KEYS.STATE, STORAGE_KEYS.CONFIG]);
            this.state = data[STORAGE_KEYS.STATE] || 'stopped';
            this.config = data[STORAGE_KEYS.CONFIG] || null;

            this.log('Init: state=', this.state);
            if (this.state === 'running' && this.config) {
                const delay = 1500;
                this.log('Running in', delay, 'ms...');
                setTimeout(() => this.runLoop(), delay);
            }
        } catch (err) {
            this.warn('Init error:', err);
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
        this.log('Appending scraped content, length:', markdown.length);
        const data = await StorageService.get([STORAGE_KEYS.FULL_BOOK]);
        const existing = data[STORAGE_KEYS.FULL_BOOK] || '';
        const sep = existing ? '\n\n---\n\n' : '';
        const next = existing + sep + markdown;
        await StorageService.set({ [STORAGE_KEYS.FULL_BOOK]: next });
    }

    async stopScraping() {
        await StorageService.set({ [STORAGE_KEYS.STATE]: 'stopped' });
        await MessagingService.sendMessage({ type: 'SET_ICON', running: false }).catch(() => { });
    }

    stopConditionMet(sessionCount) {
        if (typeof this.config.pageLimit === 'number' && this.config.pageLimit > 0) {
            if (sessionCount >= this.config.pageLimit) {
                this.log('Page limit reached:', this.config.pageLimit);
                return true;
            }
        }
        const stop = this.config.stopCondition;
        if (!stop || stop.type !== 'exists') return false;

        try {
            const domService = new DOMService(this.config);
            const root = domService.getRoot() || document;
            return !!root.querySelector(stop.selector);
        } catch (_) {
            return false;
        }
    }

    async runLoop() {
        if (this.state !== 'running')
            return;

        if (!this.config) {
            this.warn('Config is empty. Stopping.');
            await this.stopScraping();
            return;
        }

        this.log('runLoop: config profile=', this.config.profileName);
        const delay = Math.max(500, Number(this.config.delay) || 3000);

        const domService = new DOMService(this.config);
        const root = domService.getRoot();

        if (!root) {
            this.log('Root not found for selector. Stopping.');
            await this.stopScraping();
            return;
        }

        const clone = root.cloneNode(true);
        domService.ensureTitleTags(clone);
        domService.sanitizeWatermarks(clone);

        const markdownService = new MarkdownService(this.config);
        let markdown = null;
        try {
            markdown = markdownService.convertToMarkdown(clone);
        } catch (e) {
            this.warn('Markdown conversion failed:', e);
        }

        if (!markdown) {
            this.log('Markdown is empty. Stopping.');
            await this.stopScraping();
            return;
        }

        const pageCount = await this.getSessionPageCount();
        await this.setSessionPageCount(pageCount + 1);
        await this.appendAndPersist(markdown);

        const updatedCount = await this.getSessionPageCount();
        if (this.stopConditionMet(updatedCount)) {
            this.log('Stop condition met. Stopping.');
            await this.stopScraping();
            return;
        }

        const clicked = domService.clickNext();
        if (!clicked) {
            this.log('No next button found. Stopping.');
            await this.stopScraping();
            return;
        }

        this.log('Continuing in', delay, 'ms');
        setTimeout(() => this.runLoop(), delay);
    }
}
