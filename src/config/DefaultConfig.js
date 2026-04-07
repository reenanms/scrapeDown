export const DEFAULT_CONFIG = {
    profileName: "McGraw Hill Books",
    rootSelector: "iframe",
    subRootSelector: "body",
    nextBtnSelector: "button[id='next-button']",
    stopCondition: {
        selector: "button[id='next-button'][disabled]",
        type: "exists"
    },
    delay: 800,
    titleSelectors: ["h1", "h2", "h3", ".chapter-title"],
    replacements: [
        {
            pattern: "\\[Return to [^\\]]+\\]\\(javascript:void\\(0\\);\\)",
            flags: "g",
            replacement: ""
        },
        {
            pattern: "\\(javascript:void\\(0\\);.*\\)",
            flags: "g",
            replacement: "()"
        }
    ]
};
