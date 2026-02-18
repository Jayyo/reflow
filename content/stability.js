// Fox Pilot - DOM Stability Detection
// Detects when page has settled after user action (DOM mutations, URL changes, loading)

(function () {
    'use strict';
    const FP = window.FoxPilot;

    const TIMING = {
        initialDelay: 150,     // Wait before starting observation
        quietMs: 800,          // How long DOM must be quiet
        maxWaitMs: 7000,       // Max wait before declaring stable
        hardTimeoutMs: 12000,  // Absolute max wait
        tickInterval: 120      // Check interval
    };

    // Detect loading UI elements
    function hasLoadingUI() {
        return !!document.querySelector(
            '[aria-busy="true"], .spinner, .loading, .skeleton, ' +
            '[class*="skeleton"], [class*="shimmer"], [class*="loader"], ' +
            '[class*="progress"], .MuiCircularProgress-root, .MuiLinearProgress-root'
        );
    }

    // Wait for DOM to stabilize after an action
    async function waitForStable() {
        await new Promise(r => setTimeout(r, TIMING.initialDelay));

        const start = Date.now();
        let lastMutation = Date.now();
        const urlAtStart = location.href;

        const obs = new MutationObserver(() => {
            lastMutation = Date.now();
        });

        obs.observe(document.documentElement, {
            subtree: true,
            childList: true,
            attributes: true,
            characterData: false,
            attributeFilter: ['class', 'style', 'hidden', 'aria-expanded', 'aria-busy', 'disabled', 'aria-hidden']
        });

        return new Promise((resolve) => {
            const tick = () => {
                const now = Date.now();
                const elapsed = now - start;
                const quiet = now - lastMutation >= TIMING.quietMs;
                const loading = hasLoadingUI() || document.readyState !== 'complete';
                const urlChanged = location.href !== urlAtStart;

                // Stable: quiet period reached and no loading indicators
                if (quiet && !loading) {
                    obs.disconnect();
                    return resolve({ status: 'stable', urlChanged, elapsed });
                }

                // URL changed and quiet
                if (urlChanged && quiet) {
                    obs.disconnect();
                    return resolve({ status: 'navigated', urlChanged: true, elapsed });
                }

                // Max wait reached but quiet
                if (elapsed > TIMING.maxWaitMs && quiet) {
                    obs.disconnect();
                    return resolve({ status: 'stable', urlChanged, elapsed });
                }

                // Hard timeout
                if (elapsed > TIMING.hardTimeoutMs) {
                    obs.disconnect();
                    return resolve({ status: 'timeout', urlChanged, elapsed });
                }

                setTimeout(tick, TIMING.tickInterval);
            };
            tick();
        });
    }

    // Set up URL change detection (for SPAs)
    function setupUrlWatcher(callback) {
        let lastUrl = location.href;

        // Hook History API
        const origPush = history.pushState;
        const origReplace = history.replaceState;

        history.pushState = function (...args) {
            origPush.apply(this, args);
            checkUrlChange();
        };

        history.replaceState = function (...args) {
            origReplace.apply(this, args);
            checkUrlChange();
        };

        window.addEventListener('popstate', checkUrlChange);
        window.addEventListener('hashchange', checkUrlChange);

        function checkUrlChange() {
            const currentUrl = location.href;
            if (currentUrl !== lastUrl) {
                const oldUrl = lastUrl;
                lastUrl = currentUrl;
                callback({ oldUrl, newUrl: currentUrl });
            }
        }

        return () => {
            history.pushState = origPush;
            history.replaceState = origReplace;
            window.removeEventListener('popstate', checkUrlChange);
            window.removeEventListener('hashchange', checkUrlChange);
        };
    }

    // ========== NEW TAB DETECTION ==========

    function setupTabDetection(onSwitchAway, onReturn) {
        let newTabOpened = false;

        // Hook window.open to detect new tabs
        const origOpen = window.open;
        window.open = function (...args) {
            newTabOpened = true;
            return origOpen.apply(this, args);
        };

        // Also detect target="_blank" link clicks
        const linkClickHandler = (e) => {
            const link = e.target.closest('a[target="_blank"]');
            if (link) {
                newTabOpened = true;
            }
        };
        document.addEventListener('click', linkClickHandler, true);

        // Detect visibility changes
        const visibilityHandler = () => {
            if (document.hidden && newTabOpened) {
                onSwitchAway();
            }
            if (!document.hidden && newTabOpened) {
                newTabOpened = false;
                onReturn();
            }
        };
        document.addEventListener('visibilitychange', visibilityHandler);

        // Cleanup function
        return () => {
            window.open = origOpen;
            document.removeEventListener('click', linkClickHandler, true);
            document.removeEventListener('visibilitychange', visibilityHandler);
        };
    }

    FP.Stability = {
        waitForStable,
        setupUrlWatcher,
        setupTabDetection,
        hasLoadingUI,
        TIMING
    };

    console.log('[Reflow] Stability loaded (v1.1 - Tab Detection)');
})();
