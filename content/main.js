// Fox Pilot - Main Entry Point
// Initializes all modules and wires up events

(function () {
    'use strict';
    const FP = window.FoxPilot;

    async function initialize() {
        console.log('[Reflow] Initializing...');

        try {
            // Initialize UI components
            FP.Highlight.init();
            FP.GuideUI.init();

            // Wire up events
            wireEvents();

            // Start DOM survival watcher (protects against SPA frameworks
            // like WebSquare that rebuild document.body after content scripts load)
            startDomSurvival();

            // Check if there's an active guide session to resume
            await FP.StateMachine.resumeIfActive();

            console.log('[Reflow] Ready!');
        } catch (e) {
            console.error('[Reflow] Initialization failed:', e);
        }
    }

    // Watch for DOM removal and re-attach Fox Pilot elements.
    // Some sites (hometax.go.kr etc.) use SPA frameworks that replace
    // document.body contents AFTER content scripts have already initialized.
    function startDomSurvival() {
        let checkCount = 0;

        const check = () => {
            if (!document.getElementById('fox-pilot-panel')) {
                console.log('[Reflow] DOM elements removed — re-attaching');
                FP.GuideUI.ensureAttached();
                FP.Highlight.ensureAttached();
                FP.FoxCharacter.ensureAttached();
            }
            checkCount++;
            // First 30 checks every 500ms (15s), then every 5s
            const interval = checkCount < 30 ? 500 : 5000;
            setTimeout(check, interval);
        };

        // First check after 500ms
        setTimeout(check, 500);
    }

    function wireEvents() {
        // Guide start
        FP.on('guide:start', async (data) => {
            console.log('[Reflow] Starting session for goal:', data.goal, 'mode:', data.forceMode || 'auto');
            await FP.StateMachine.startSession(data.goal, data.forceMode);
        });

        // Guide cancel
        FP.on('guide:cancel', () => {
            console.log('[Reflow] Guide cancelled');
            FP.StateMachine.cancelGuide();
        });

        // State changes (for debugging)
        FP.on('state:change', ({ from, to }) => {
            console.log(`[Reflow] State: ${from} → ${to}`);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape to cancel guide
            if (e.key === 'Escape') {
                const state = FP.StateMachine.getState();
                if (state !== 'IDLE') {
                    FP.StateMachine.cancelGuide();
                }
            }
        });
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        // Small delay to ensure all content scripts are loaded
        setTimeout(initialize, 100);
    }
})();
