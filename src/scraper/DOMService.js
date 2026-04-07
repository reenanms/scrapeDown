export class DOMService {
    constructor(config) {
        this.config = config;
    }

    getRoot() {
        const rootSel = (this.config.rootSelector || '').trim();
        const root = document.querySelector(rootSel);

        const subRootSel = (this.config.subRootSelector || '').trim();
        if (!subRootSel) return root;

        if (!root) return null;

        const iframeDoc = root.contentDocument || (root.contentWindow && root.contentWindow.document);
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
        } catch (_) { }
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
                    const wrap = document.createElement('h2');
                    wrap.setAttribute('data-turndown-heading', '1');
                    el.parentNode.insertBefore(wrap, el);
                    wrap.appendChild(el);
                });
            } catch (_) { }
        });
    }

    sanitizeWatermarks(root) {
        if (!root) return;
        const copyCopyright = /copy\s*copyright|©\s*copy|watermark/i;
        root.querySelectorAll('*').forEach((el) => {
            const t = (el.childNodes.length === 1 && el.firstChild.nodeType === 3 && el.textContent) || '';
            if (copyCopyright.test(t)) el.remove();
        });
    }
}
