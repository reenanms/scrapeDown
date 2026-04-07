import { DOMService } from '../src/scraper/DOMService';

describe('DOMService', () => {
    let domService;

    beforeEach(() => {
        document.body.innerHTML = '';
        // Mock config
        domService = new DOMService({
            rootSelector: '#root',
            nextBtnSelector: '#next',
            titleSelectors: ['h1', '.title']
        });
    });

    test('getRoot returns the root element', () => {
        const div = document.createElement('div');
        div.id = 'root';
        document.body.appendChild(div);

        expect(domService.getRoot()).toBe(div);
    });

    test('getRoot returns null if element not found', () => {
        expect(domService.getRoot()).toBeNull();
    });

    test('getButton finds the button in the provided roots', () => {
        const root1 = document.createElement('div');
        const root2 = document.createElement('div');
        const btn = document.createElement('button');
        btn.id = 'next';
        root2.appendChild(btn);

        const result = domService.getButton([root1, root2], '#next');
        expect(result).toBe(btn);
    });

    test('clickNext clicks the button and returns true', () => {
        const root = document.createElement('div');
        root.id = 'root';
        const btn = document.createElement('button');
        btn.id = 'next';

        let clicked = false;
        btn.addEventListener('click', () => { clicked = true; });

        document.body.appendChild(root);
        document.body.appendChild(btn); // Button outside root

        const result = domService.clickNext();
        expect(result).toBe(true);
        expect(clicked).toBe(true);
    });

    test('ensureTitleTags wraps configured elements with h2 data-turndown-heading=1', () => {
        const root = document.createElement('div');
        const h1 = document.createElement('h1');
        h1.textContent = 'Chapter 1';

        const divTitle = document.createElement('div');
        divTitle.className = 'title';
        divTitle.textContent = 'Chapter 2';

        root.appendChild(h1);
        root.appendChild(divTitle);

        domService.ensureTitleTags(root);

        // h1 shouldn't be wrapped since it's already a heading
        expect(root.querySelector('h1')).toBe(h1);
        expect(h1.parentElement).toBe(root);

        // .title should be wrapped with h2
        const h2Wrap = root.querySelector('h2');
        expect(h2Wrap).toBeDefined();
        expect(h2Wrap.getAttribute('data-turndown-heading')).toBe('1');
        expect(h2Wrap.firstElementChild).toBe(divTitle);
    });

    test('sanitizeWatermarks removes elements containing watermark text', () => {
        const root = document.createElement('div');
        const span1 = document.createElement('span');
        span1.textContent = 'Visible content';

        const span2 = document.createElement('span');
        span2.textContent = '© Copyright 2026';

        root.appendChild(span1);
        root.appendChild(span2);

        domService.sanitizeWatermarks(root);

        expect(root.contains(span1)).toBe(true);
        expect(root.contains(span2)).toBe(false);
    });
});
