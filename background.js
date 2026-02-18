// Reflow - Background Service Worker
// Handles: OpenAI API proxy (via Supabase Edge Function), session management

const CONFIG = {
    PROXY_URL: 'https://fvqlqyiewokyzgmvbzrr.supabase.co/functions/v1/openai-proxy'
};

// ============================================================
// Session Management (persists goal/history across page navigations)
// ============================================================

const sessionMemory = new Map();

function sessionKey(tabId) {
    return `reflow:${tabId}`;
}

async function loadSession(tabId) {
    if (sessionMemory.has(tabId)) return sessionMemory.get(tabId);
    try {
        const obj = await chrome.storage.session.get(sessionKey(tabId));
        const s = obj[sessionKey(tabId)];
        if (s) sessionMemory.set(tabId, s);
        return s || null;
    } catch {
        return null;
    }
}

async function saveSession(session) {
    session.updatedAt = Date.now();
    sessionMemory.set(session.tabId, session);
    try {
        await chrome.storage.session.set({ [sessionKey(session.tabId)]: session });
    } catch (e) {
        console.warn('[Reflow] Failed to persist session:', e);
    }
}

async function clearSession(tabId) {
    sessionMemory.delete(tabId);
    try {
        await chrome.storage.session.remove(sessionKey(tabId));
    } catch {}
}

// Clean up sessions when tabs close
chrome.tabs.onRemoved.addListener((tabId) => { clearSession(tabId); });

// ============================================================
// OpenAI API Proxy
// ============================================================

async function callOpenAI(data) {
    const { messages, maxTokens, reasoningEffort } = data;

    const response = await fetch(CONFIG.PROXY_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messages,
            maxTokens: maxTokens || 800,
            reasoningEffort: reasoningEffort || 'low'
        })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Proxy request failed: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Proxy returned error');
    return result.data;
}

// ============================================================
// GLB Model Fetcher
// ============================================================

async function fetchGLB() {
    const response = await fetch(CONFIG.FOX_MODEL_URL);
    if (!response.ok) throw new Error('Failed to fetch GLB model');
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

// ============================================================
// Message Router
// ============================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const tabId = sender.tab?.id ?? request.tabId;

    // OpenAI API call
    if (request.type === 'OPENAI_REQUEST') {
        callOpenAI(request.data)
            .then(response => sendResponse({ success: true, data: response }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    // Get config
    if (request.type === 'GET_CONFIG') {
        sendResponse({ success: true, data: CONFIG });
        return true;
    }

    // --- Session Management ---

    // Start a new guide session
    if (request.type === 'GUIDE_START') {
        if (!tabId) return sendResponse({ ok: false, error: 'No tabId' });
        const session = {
            tabId,
            goal: request.goal,
            status: 'RUNNING',
            history: [],
            stepCount: 0,
            lastPlan: null,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        saveSession(session).then(() => sendResponse({ ok: true, session }));
        return true;
    }

    // Get current session
    if (request.type === 'GUIDE_GET') {
        if (!tabId) return sendResponse({ ok: false, error: 'No tabId' });
        loadSession(tabId).then(session => sendResponse({ ok: true, session }));
        return true;
    }

    // Update session (partial patch)
    if (request.type === 'GUIDE_UPDATE') {
        if (!tabId) return sendResponse({ ok: false, error: 'No tabId' });
        loadSession(tabId).then(session => {
            if (!session) return sendResponse({ ok: false, error: 'No active session' });
            Object.assign(session, request.patch);
            return saveSession(session).then(() => sendResponse({ ok: true, session }));
        });
        return true;
    }

    // Add history entry
    if (request.type === 'GUIDE_ADD_HISTORY') {
        if (!tabId) return sendResponse({ ok: false, error: 'No tabId' });
        loadSession(tabId).then(session => {
            if (!session) return sendResponse({ ok: false, error: 'No active session' });
            session.history.push(request.entry);
            session.stepCount = session.history.length;
            return saveSession(session).then(() => sendResponse({ ok: true }));
        });
        return true;
    }

    // Patch last history entry (e.g., add DOM diff results)
    if (request.type === 'GUIDE_PATCH_LAST_HISTORY') {
        if (!tabId) return sendResponse({ ok: false, error: 'No tabId' });
        loadSession(tabId).then(session => {
            if (!session || session.history.length === 0) {
                return sendResponse({ ok: false, error: 'No history to patch' });
            }
            const last = session.history[session.history.length - 1];
            Object.assign(last, request.patch);
            return saveSession(session).then(() => sendResponse({ ok: true }));
        });
        return true;
    }

    // End session
    if (request.type === 'GUIDE_END') {
        if (!tabId) return sendResponse({ ok: false, error: 'No tabId' });
        clearSession(tabId).then(() => sendResponse({ ok: true }));
        return true;
    }
});

console.log('[Reflow] Background service worker loaded');
