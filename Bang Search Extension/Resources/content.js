// content.js
(function() {
    'use strict';

    // Cross-browser API shim for Safari/Firefox/Chrome
    if (typeof window.browser === 'undefined' && typeof window.chrome !== 'undefined') {
        window.browser = {
            storage: chrome.storage,
            runtime: {
                sendMessage: (...args) => chrome.runtime.sendMessage(...args),
                onMessage: chrome.runtime.onMessage
            }
        };
    }

    let defaultShortcuts = {};
    let shortcuts = {};

    // Load shortcuts via background (avoids fetch/caching issues)
    async function loadShortcuts() {
        defaultShortcuts = {};
        try {
            const res = await browser.runtime.sendMessage({ action: 'getShortcutsFromJson' });
            defaultShortcuts = res && res.shortcuts ? res.shortcuts : {};
        } catch (e) {
            defaultShortcuts = {};
        }
        shortcuts = { ...defaultShortcuts };
    }

    function buildSearchUrl(base, term) {
        // Support placeholders and smart fallback for q=
        if (base.includes('{q}')) {
            return base.replace('{q}', encodeURIComponent(term));
        }
        if (base.includes('%s')) {
            return base.replace('%s', encodeURIComponent(term));
        }
        if (base.endsWith('=')) {
            return base + encodeURIComponent(term);
        }
        if (base.includes('?')) {
            return base + (base.endsWith('?') ? '' : (base.includes('=') ? '' : '&q=')) + (base.includes('=') ? '' : encodeURIComponent(term));
        }
        return base + '?q=' + encodeURIComponent(term);
    }

    // Function to handle search redirection
    function handleSearchShortcut(query) {
        const trimmedQuery = query.trim();
        
        // Check if query starts with a shortcut
        for (const [shortcut, url] of Object.entries(shortcuts)) {
            if (trimmedQuery.startsWith(shortcut + ' ')) {
                const searchTerm = trimmedQuery.substring(shortcut.length + 1).trim();
                if (searchTerm) {
                    const targetUrl = buildSearchUrl(url, searchTerm);
                    // Prefer opening via background (new tab) for reliability and site CSPs
                    try {
                        if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
                            browser.runtime.sendMessage({ action: 'openSearch', url: targetUrl });
                            return true;
                        }
                    } catch (e) {}
                    // Fallback
                    window.location.assign(targetUrl);
                    return true;
                }
            }
        }
        return false;
    }

    // Function to find search inputs
    function findSearchInputs() {
        const searchSelectors = [
            'input[type="search"]',
            'input[name="q"]',
            'input[name="query"]',
            'input[name="search"]',
            'input[placeholder*="search" i]',
            'input[placeholder*="Search" i]',
            '.search-input',
            '#search',
            '#q',
            'input[aria-label*="search" i]',
            'input[title*="search" i]'
        ];

        const inputs = [];
        searchSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(input => {
                inputs.push(input);
            });
        });

        return inputs;
    }

    // Function to monitor search inputs
    function monitorSearchInputs() {
        const inputs = findSearchInputs();
        
        inputs.forEach(input => {
            if (input.dataset.bangSearchListener) return;
            input.dataset.bangSearchListener = 'true';

            // Handle Enter key
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    const query = this.value;
                    if (handleSearchShortcut(query)) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                    }
                }
            }, true);

            // Handle input events for real-time feedback
            input.addEventListener('input', function(e) {
                const query = this.value.trim();
                const hasShortcut = Object.keys(shortcuts).some(shortcut => 
                    query.startsWith(shortcut + ' ')
                );
                
                if (hasShortcut) {
                    this.style.background = '#e3f2fd';
                    this.style.borderColor = '#1976d2';
                } else {
                    this.style.background = '';
                    this.style.borderColor = '';
                }
            });
        });

        // Monitor form submissions
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            if (form.dataset.bangSearchListener) return;
            form.dataset.bangSearchListener = 'true';

            form.addEventListener('submit', function(e) {
                const searchInput = form.querySelector([
                    'input[type="search"]',
                    'input[name="q"]',
                    'input[name="query"]',
                    'input[name="search"]'
                ].join(', '));
                
                if (searchInput) {
                    const query = searchInput.value;
                    if (handleSearchShortcut(query)) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                    }
                }
            }, true);
        });
    }

    // Initialize monitoring
    function init() {
        monitorSearchInputs();
        
        // Global fallback: capture Enter on focused input/textarea even if not detected earlier
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                const el = document.activeElement;
                if (!el) return;
                const tag = el.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') {
                    const type = (el.getAttribute('type') || '').toLowerCase();
                    if (tag === 'TEXTAREA' || type === 'text' || type === 'search' || type === '') {
                        const query = el.value || '';
                        if (handleSearchShortcut(query)) {
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                        }
                    }
                }
            }
        }, true);
        
        // Re-monitor when new content is added (for SPAs)
        const observer = new MutationObserver(function(mutations) {
            let shouldRecheck = false;
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.matches('input') || node.querySelector('input')) {
                                shouldRecheck = true;
                                break;
                            }
                        }
                    }
                }
            });
            
            if (shouldRecheck) {
                setTimeout(monitorSearchInputs, 100);
            }
        });

        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }

    // Start when DOM is ready (after shortcuts loaded)
    (async function start() {
        await loadShortcuts();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    })();

    // Listen for storage changes
    if (typeof browser !== 'undefined') {
        if (browser.storage && browser.storage.onChanged) {
            browser.storage.onChanged.addListener(function(changes, namespace) {
                // No-op now that we load from JSON file
            });
        }
        if (browser.runtime && browser.runtime.onMessage) {
            browser.runtime.onMessage.addListener(function(request) {
                if (request && request.action === 'shortcutsUpdated') {
                    // Reload from JSON
                    loadShortcuts();
                }
            });
        }
    }

})();