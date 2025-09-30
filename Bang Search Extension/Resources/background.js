// background.js
// Safari Web Extension background script

// Cross-browser API shim
if (typeof self.browser === 'undefined' && typeof self.chrome !== 'undefined') {
    self.browser = {
        storage: chrome.storage,
        tabs: chrome.tabs,
        contextMenus: chrome.contextMenus,
        runtime: chrome.runtime
    };
}

// Initialize default shortcuts on install
browser.runtime.onInstalled.addListener(function(details) {
    if (details.reason === 'install') {
        console.log('Bang Search extension installed');
        
        // Initialize empty custom shortcuts
        browser.storage.sync.set({
            customShortcuts: {}
        });
    }
    // Warm cache of shortcuts.json
    try {
        fetch(browser.runtime.getURL('shortcuts.json'))
          .then(r => r.json())
          .then(json => {
            self.__bangShortcuts = json;
          })
          .catch(() => {});
    } catch (e) {}
});

// Handle messages from content script or popup
browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('Background received message:', request);
    
    if (request.action === 'getShortcuts') {
        browser.storage.sync.get(['customShortcuts']).then(result => {
            sendResponse({ shortcuts: result.customShortcuts || {} });
        });
        return true; // Keep message channel open for async response
    }
    
    if (request.action === 'setShortcuts') {
        browser.storage.sync.set({ customShortcuts: request.shortcuts }).then(() => {
            sendResponse({ success: true });
            try {
                browser.tabs.query({}).then(tabs => {
                    tabs.forEach(t => {
                        if (t.id) {
                            browser.tabs.sendMessage(t.id, { action: 'shortcutsUpdated' }).catch(() => {});
                        }
                    });
                });
            } catch (e) {}
        });
        return true;
    }

    if (request.action === 'openSearch' && request.url) {
        try {
            browser.tabs.create({ url: request.url });
            sendResponse({ success: true });
        } catch (e) {
            sendResponse({ success: false, error: String(e) });
        }
        return true;
    }

    if (request.action === 'getShortcutsFromJson') {
        const reply = (data) => sendResponse({ shortcuts: data || {} });
        if (self.__bangShortcuts) {
            reply(self.__bangShortcuts);
            return true;
        }
        try {
            fetch(browser.runtime.getURL('shortcuts.json'))
              .then(r => r.json())
              .then(json => {
                self.__bangShortcuts = json;
                reply(json);
              })
              .catch(() => reply({}));
        } catch (e) {
            reply({});
        }
        return true;
    }
});

// Optional: Handle tab updates for additional functionality
browser.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url) {
        // Extension content script is automatically injected via manifest
        // This listener can be used for additional functionality if needed
    }
});

// Optional: Context menu integration
browser.contextMenus.create({
    id: "bangSearch",
    title: "Search with Bang shortcuts",
    contexts: ["selection"]
});

browser.contextMenus.onClicked.addListener(function(info, tab) {
    if (info.menuItemId === "bangSearch" && info.selectionText) {
        const selection = info.selectionText.trim();
        const bangPattern = /^!\w+/;

        const doRedirect = (shortcuts) => {
            const parts = selection.split(/\s+/);
            const bang = parts.shift();
            const term = parts.join(' ').trim();
            if (!bang || !term) return;

            const allShortcuts = Object.assign({}, shortcuts || {});

            const base = allShortcuts[bang];
            if (!base) return;

            const url = (function build(base, term) {
                if (base.includes('{q}')) return base.replace('{q}', encodeURIComponent(term));
                if (base.includes('%s')) return base.replace('%s', encodeURIComponent(term));
                if (base.endsWith('=')) return base + encodeURIComponent(term);
                if (base.includes('?')) return base + (base.endsWith('?') ? '' : (base.includes('=') ? '' : '&q=')) + (base.includes('=') ? '' : encodeURIComponent(term));
                return base + '?q=' + encodeURIComponent(term);
            })(base, term);
            browser.tabs.create({ url });
        };

        if (bangPattern.test(selection)) {
            // Load from packaged JSON
            fetch(browser.runtime.getURL('shortcuts.json'))
                .then(r => r.json())
                .then(json => doRedirect(json))
                .catch(() => doRedirect({}));
        }
    }
});