export class MarkdownService {
    constructor(config) {
        this.config = config;
        this.turndown = this._getTurndownService();
    }

    _getTurndownService() {
        if (typeof TurndownService === 'undefined') {
            console.warn('[ScrapeDown] TurndownService not defined – ensure vendor/turndown.js is loaded');
            return null;
        }
        return new TurndownService({ headingStyle: 'atx' });
    }

    applyReplacements(markdown) {
        if (!this.config || !Array.isArray(this.config.replacements)) return markdown;
        let result = markdown;
        for (const rep of this.config.replacements) {
            if (rep.pattern) {
                try {
                    const re = new RegExp(rep.pattern, rep.flags || 'g');
                    result = result.replace(re, rep.replacement || '');
                } catch (e) {
                    console.warn('[ScrapeDown] Invalid replacement pattern:', rep.pattern, e.message);
                }
            }
        }
        return result;
    }

    convertToMarkdown(element) {
        if (!this.turndown) {
            throw new Error('TurndownService not loaded');
        }
        let markdown = this.turndown.turndown(element);
        return this.applyReplacements(markdown);
    }
}
