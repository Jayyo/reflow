// Reflow - Shared Namespace
// All content script modules register here

window.FoxPilot = window.FoxPilot || {
    // Module references (populated by each module)
    DomExtractor: null,
    SelectorEngine: null,
    Stability: null,
    Highlight: null,
    Planner: null,
    // Fox character removed - stub to prevent errors
    FoxCharacter: {
        init: async () => {},
        setThinking: () => {},
        moveToElement: () => {},
        goHome: () => {},
        ensureAttached: () => {}
    },
    GuideUI: null,
    StateMachine: null,
    ChatGPTKnowledge: null,

    // Shared state
    state: {
        goal: null,
        guideActive: false,
        currentStep: null,
        stepHistory: [],
        foxReady: false
    },

    // Event bus for inter-module communication
    _listeners: {},

    on(event, fn) {
        if (!this._listeners[event]) this._listeners[event] = [];
        this._listeners[event].push(fn);
    },

    off(event, fn) {
        if (!this._listeners[event]) return;
        this._listeners[event] = this._listeners[event].filter(f => f !== fn);
    },

    emit(event, data) {
        const fns = this._listeners[event] || [];
        for (const fn of fns) {
            try { fn(data); } catch (e) { console.error(`[Reflow] Event handler error (${event}):`, e); }
        }
    },

    // Utility: send message to background service worker
    async sendMessage(msg) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(msg, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn('[Reflow] sendMessage error:', chrome.runtime.lastError.message);
                    resolve({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    resolve(response);
                }
            });
        });
    }
};

console.log('[Reflow] Namespace initialized');
