// Fox Pilot - Element Highlight & Tooltip v1.2
// Visual overlay system with interactive buttons per action type

(function () {
    'use strict';
    const FP = window.FoxPilot;

    let highlightOverlay = null;
    let tooltipEl = null;
    let scrollObserver = null;
    let trackingElement = null;
    let trackingRAF = null;

    function init() {
        // Create highlight overlay
        highlightOverlay = document.createElement('div');
        highlightOverlay.id = 'fox-pilot-highlight';
        highlightOverlay.style.display = 'none';
        document.body.appendChild(highlightOverlay);

        // Create tooltip
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'fox-pilot-tooltip';
        tooltipEl.style.display = 'none';
        document.body.appendChild(tooltipEl);
    }

    // Helper: create a styled button for tooltip
    function createButton(label, type, onClick) {
        const btn = document.createElement('button');
        btn.className = type === 'confirm'
            ? 'fox-pilot-tooltip-btn-confirm'
            : 'fox-pilot-tooltip-btn-skip';
        btn.textContent = label;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (onClick) onClick();
        });
        return btn;
    }

    // Show highlight around a target element
    // stepInfo: { current, actionType, onConfirm?, onSkip?, inputHint? }
    function show(element, instruction, stepInfo) {
        if (!highlightOverlay) init();
        trackingElement = element;

        // Scroll element into view if needed
        if (element && !isElementInViewport(element)) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Start position tracking
        if (element) {
            updatePosition();
            startTracking();
        }

        // Clear tooltip
        while (tooltipEl.firstChild) tooltipEl.removeChild(tooltipEl.firstChild);
        tooltipEl.classList.remove('fox-pilot-tooltip-interactive');

        // Clear highlight observe class
        highlightOverlay.classList.remove('fox-pilot-highlight-observe');

        // OBSERVE mode: low-urgency highlight style
        if (stepInfo?.actionType === 'OBSERVE') {
            highlightOverlay.classList.add('fox-pilot-highlight-observe');
        }

        // Step header row (step badge + cancel button)
        if (stepInfo) {
            const headerRow = document.createElement('div');
            headerRow.className = 'fox-pilot-tooltip-header';

            const stepBadge = document.createElement('span');
            stepBadge.className = 'fox-pilot-tooltip-step';
            stepBadge.textContent = `STEP ${stepInfo.current}`;
            headerRow.appendChild(stepBadge);

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'fox-pilot-tooltip-cancel';
            cancelBtn.textContent = '✕';
            cancelBtn.title = '가이드 중단 (Esc)';
            cancelBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                window.FoxPilot.emit('guide:cancel');
            });
            headerRow.appendChild(cancelBtn);

            tooltipEl.appendChild(headerRow);
            tooltipEl.classList.add('fox-pilot-tooltip-interactive');
        }

        // Instruction text
        const instrText = document.createElement('div');
        instrText.className = 'fox-pilot-tooltip-text';
        instrText.textContent = instruction;
        tooltipEl.appendChild(instrText);

        // Action hint (only for types without buttons that say it already)
        const actionType = stepInfo?.actionType;
        if (actionType === 'CLICK' || actionType === 'REVEAL') {
            const hint = document.createElement('div');
            hint.className = 'fox-pilot-tooltip-hint';
            hint.textContent = '👆 클릭해주세요';
            tooltipEl.appendChild(hint);
        } else if (actionType === 'INPUT' && !stepInfo?.onConfirm) {
            const hint = document.createElement('div');
            hint.className = 'fox-pilot-tooltip-hint';
            hint.textContent = '⌨️ 입력해주세요';
            tooltipEl.appendChild(hint);
        }

        // Button area
        const btnArea = document.createElement('div');
        btnArea.className = 'fox-pilot-tooltip-buttons';

        if (actionType === 'OBSERVE') {
            // "질문하기" button for follow-up Q&A
            if (stepInfo.onAskQuestion) {
                const askBtn = createButton('💬 질문하기', 'skip', () => {
                    showQAInput(tooltipEl, stepInfo.onAskQuestion);
                });
                btnArea.appendChild(askBtn);
            }
            const confirmBtn = createButton('확인했어요 →', 'confirm', stepInfo.onConfirm);
            btnArea.appendChild(confirmBtn);
        } else if (actionType === 'INPUT' && stepInfo?.onConfirm) {
            const doneBtn = createButton('입력 완료', 'confirm', stepInfo.onConfirm);
            btnArea.appendChild(doneBtn);
            if (stepInfo.onSkip) {
                const skipBtn = createButton('건너뛰기', 'skip', stepInfo.onSkip);
                btnArea.appendChild(skipBtn);
            }
        } else if (actionType === 'CLICK' || actionType === 'REVEAL') {
            // Skip button hidden initially — shown after wrong-clicks
            if (stepInfo?.onSkip) {
                const skipBtn = createButton('건너뛰기', 'skip', stepInfo.onSkip);
                skipBtn.style.display = 'none';
                skipBtn.id = 'fox-pilot-skip-btn';
                btnArea.appendChild(skipBtn);
            }
        }

        if (btnArea.children.length > 0) {
            tooltipEl.appendChild(btnArea);
            tooltipEl.classList.add('fox-pilot-tooltip-interactive');
        }

        highlightOverlay.style.display = element ? 'block' : 'none';
        tooltipEl.style.display = 'block';

        // Animate in
        requestAnimationFrame(() => {
            if (element) {
                highlightOverlay.classList.add('fox-pilot-highlight-active');
            }
            tooltipEl.classList.add('fox-pilot-tooltip-active');
        });
    }

    // Show nudge message (wrong-click feedback)
    function showNudge(message) {
        if (!tooltipEl) return;

        // Remove any existing nudge
        const existing = tooltipEl.querySelector('.fox-pilot-nudge');
        if (existing) existing.remove();

        const nudge = document.createElement('div');
        nudge.className = 'fox-pilot-nudge';
        nudge.textContent = message;

        // Insert before buttons area
        const btnArea = tooltipEl.querySelector('.fox-pilot-tooltip-buttons');
        if (btnArea) {
            tooltipEl.insertBefore(nudge, btnArea);
        } else {
            tooltipEl.appendChild(nudge);
        }
    }

    // Show hidden skip button (after 2 wrong clicks)
    function showSkipButton() {
        const skipBtn = document.getElementById('fox-pilot-skip-btn');
        if (skipBtn) {
            skipBtn.style.display = '';
            // Make sure tooltip is interactive
            if (tooltipEl) {
                tooltipEl.classList.add('fox-pilot-tooltip-interactive');
            }
        }
    }

    // Show scroll prompt with countdown — returns Promise<boolean> (true = manual mode)
    function showScrollPrompt(instruction, scrollHint, countdownMs) {
        return new Promise((resolve) => {
            if (!tooltipEl) init();
            hide();

            while (tooltipEl.firstChild) tooltipEl.removeChild(tooltipEl.firstChild);
            tooltipEl.classList.remove('fox-pilot-tooltip-interactive');

            // Icon
            const icon = document.createElement('div');
            icon.className = 'fox-pilot-tooltip-icon';
            icon.textContent = '⬇️';
            tooltipEl.appendChild(icon);

            // Instruction
            const text = document.createElement('div');
            text.className = 'fox-pilot-tooltip-text';
            text.textContent = instruction;
            tooltipEl.appendChild(text);

            // Countdown display
            const countdown = document.createElement('div');
            countdown.className = 'fox-pilot-countdown';
            let remaining = Math.ceil(countdownMs / 1000);
            countdown.textContent = remaining;
            tooltipEl.appendChild(countdown);

            // "직접 스크롤할게요" button
            const btnArea = document.createElement('div');
            btnArea.className = 'fox-pilot-tooltip-buttons';
            const manualBtn = createButton('직접 스크롤할게요', 'skip', () => {
                clearInterval(timer);
                resolved = true;
                resolve(true);
            });
            btnArea.appendChild(manualBtn);
            tooltipEl.appendChild(btnArea);
            tooltipEl.classList.add('fox-pilot-tooltip-interactive');

            // Position center
            tooltipEl.style.display = 'block';
            tooltipEl.style.left = '50%';
            tooltipEl.style.top = '30%';
            tooltipEl.style.transform = 'translate(-50%, -50%)';
            tooltipEl.classList.add('fox-pilot-tooltip-active');

            highlightOverlay.style.display = 'none';

            let resolved = false;
            const timer = setInterval(() => {
                remaining--;
                if (remaining <= 0) {
                    clearInterval(timer);
                    if (!resolved) {
                        resolved = true;
                        resolve(false); // auto-scroll
                    }
                } else {
                    countdown.textContent = remaining;
                }
            }, 1000);
        });
    }

    // Show a non-element message (scroll hint, navigation, etc.)
    // opts: { autoDismiss?: number (ms), onDismiss?: Function }
    function showMessage(message, type, opts) {
        if (!tooltipEl) init();
        hide();

        while (tooltipEl.firstChild) tooltipEl.removeChild(tooltipEl.firstChild);
        tooltipEl.classList.remove('fox-pilot-tooltip-interactive');

        const icon = document.createElement('div');
        icon.className = 'fox-pilot-tooltip-icon';
        const icons = {
            'SCROLL': '⬇️',
            'NAVIGATE': '🌐',
            'WAIT': '⏳',
            'BLOCKED': '🚫',
            'COMPLETE': '🎉',
            'INPUT': '⌨️',
            'OBSERVE': '👀'
        };
        icon.textContent = icons[type] || 'ℹ️';
        tooltipEl.appendChild(icon);

        const text = document.createElement('div');
        text.className = 'fox-pilot-tooltip-text';
        text.textContent = message;
        tooltipEl.appendChild(text);

        // Close button for dismissible messages (COMPLETE, BLOCKED)
        if (type === 'COMPLETE' || type === 'BLOCKED' || opts?.autoDismiss) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'fox-pilot-tooltip-btn-confirm';
            closeBtn.textContent = '닫기';
            closeBtn.style.marginTop = '10px';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                hide();
                if (opts?.onDismiss) opts.onDismiss();
            });
            tooltipEl.appendChild(closeBtn);
            tooltipEl.classList.add('fox-pilot-tooltip-interactive');
        }

        // Position in center of viewport
        tooltipEl.style.display = 'block';
        tooltipEl.style.left = '50%';
        tooltipEl.style.top = '30%';
        tooltipEl.style.transform = 'translate(-50%, -50%)';
        tooltipEl.classList.add('fox-pilot-tooltip-active');

        highlightOverlay.style.display = 'none';

        // Auto-dismiss after timeout
        if (opts?.autoDismiss) {
            setTimeout(() => {
                if (tooltipEl && tooltipEl.style.display !== 'none') {
                    hide();
                    if (opts?.onDismiss) opts.onDismiss();
                }
            }, opts.autoDismiss);
        }
    }

    // Show Q&A input area inside tooltip
    function showQAInput(container, onAsk) {
        // Remove existing Q&A area if any
        const existing = container.querySelector('.fox-pilot-qa-area');
        if (existing) { existing.remove(); return; } // toggle off

        const qaArea = document.createElement('div');
        qaArea.className = 'fox-pilot-qa-area';

        const inputRow = document.createElement('div');
        inputRow.className = 'fox-pilot-qa-input-row';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'fox-pilot-qa-input';
        input.placeholder = '궁금한 점을 물어보세요...';

        const sendBtn = document.createElement('button');
        sendBtn.className = 'fox-pilot-tooltip-btn-confirm';
        sendBtn.textContent = '전송';

        inputRow.appendChild(input);
        inputRow.appendChild(sendBtn);
        qaArea.appendChild(inputRow);

        const responseArea = document.createElement('div');
        responseArea.className = 'fox-pilot-qa-response';
        responseArea.style.display = 'none';
        qaArea.appendChild(responseArea);

        // Insert before buttons area
        const btnArea = container.querySelector('.fox-pilot-tooltip-buttons');
        if (btnArea) {
            container.insertBefore(qaArea, btnArea);
        } else {
            container.appendChild(qaArea);
        }

        // Focus input
        setTimeout(() => input.focus(), 100);

        const doSend = async () => {
            const question = input.value.trim();
            if (!question) return;

            input.disabled = true;
            sendBtn.disabled = true;
            sendBtn.textContent = '...';
            responseArea.style.display = 'block';
            responseArea.textContent = '답변을 생성하고 있어요...';
            responseArea.className = 'fox-pilot-qa-response fox-pilot-qa-loading';

            try {
                const answer = await onAsk(question);
                responseArea.textContent = answer;
                responseArea.className = 'fox-pilot-qa-response';
            } catch (e) {
                responseArea.textContent = '답변을 가져올 수 없었어요: ' + e.message;
                responseArea.className = 'fox-pilot-qa-response fox-pilot-qa-error';
            }

            input.disabled = false;
            input.value = '';
            sendBtn.disabled = false;
            sendBtn.textContent = '전송';
        };

        sendBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            doSend();
        });
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.stopPropagation();
                e.preventDefault();
                doSend();
            }
        });
    }

    // Hide highlight and tooltip
    function hide() {
        stopTracking();
        trackingElement = null;

        if (highlightOverlay) {
            highlightOverlay.classList.remove('fox-pilot-highlight-active', 'fox-pilot-highlight-observe');
            highlightOverlay.style.display = 'none';
        }
        if (tooltipEl) {
            tooltipEl.classList.remove('fox-pilot-tooltip-active', 'fox-pilot-tooltip-interactive');
            tooltipEl.style.display = 'none';
            tooltipEl.style.transform = '';
        }
    }

    // Check if a rect overlaps with the Fox Pilot panel
    function wouldOverlapPanel(left, top, width, height) {
        const panel = document.getElementById('fox-pilot-panel');
        if (!panel) return false;
        const pr = panel.getBoundingClientRect();
        return !(left + width < pr.left || left > pr.right ||
                 top + height < pr.top || top > pr.bottom);
    }

    // Update highlight position to follow element (with panel avoidance)
    function updatePosition() {
        if (!trackingElement || !highlightOverlay) return;

        const rect = trackingElement.getBoundingClientRect();
        const pad = 6;

        highlightOverlay.style.left = (rect.left - pad) + 'px';
        highlightOverlay.style.top = (rect.top - pad) + 'px';
        highlightOverlay.style.width = (rect.width + pad * 2) + 'px';
        highlightOverlay.style.height = (rect.height + pad * 2) + 'px';

        // Position tooltip with panel avoidance
        if (tooltipEl && tooltipEl.style.display !== 'none') {
            const tooltipHeight = tooltipEl.offsetHeight || 80;
            const tooltipWidth = 320;
            const spaceAbove = rect.top;
            const spaceBelow = window.innerHeight - rect.bottom;

            const candidates = [];

            // Above
            if (spaceAbove > tooltipHeight + 20) {
                candidates.push({
                    left: Math.max(10, Math.min(rect.left, window.innerWidth - tooltipWidth)),
                    top: rect.top - tooltipHeight - 12
                });
            }

            // Below
            if (spaceBelow > tooltipHeight + 20) {
                candidates.push({
                    left: Math.max(10, Math.min(rect.left, window.innerWidth - tooltipWidth)),
                    top: rect.bottom + 12
                });
            }

            // Left side
            if (rect.left > tooltipWidth + 20) {
                candidates.push({
                    left: rect.left - tooltipWidth - 12,
                    top: Math.max(10, rect.top)
                });
            }

            // Right side
            candidates.push({
                left: Math.min(rect.right + 12, window.innerWidth - tooltipWidth),
                top: Math.max(10, rect.top)
            });

            let chosen = candidates[0];
            for (const pos of candidates) {
                if (!wouldOverlapPanel(pos.left, pos.top, tooltipWidth, tooltipHeight)) {
                    chosen = pos;
                    break;
                }
            }

            tooltipEl.style.left = chosen.left + 'px';
            tooltipEl.style.top = chosen.top + 'px';
            tooltipEl.style.transform = '';
        }
    }

    function startTracking() {
        stopTracking();
        const track = () => {
            updatePosition();
            trackingRAF = requestAnimationFrame(track);
        };
        trackingRAF = requestAnimationFrame(track);
    }

    function stopTracking() {
        if (trackingRAF) {
            cancelAnimationFrame(trackingRAF);
            trackingRAF = null;
        }
    }

    function isElementInViewport(el) {
        const rect = el.getBoundingClientRect();
        return (
            rect.top >= -50 &&
            rect.left >= -50 &&
            rect.bottom <= window.innerHeight + 50 &&
            rect.right <= window.innerWidth + 50
        );
    }

    // Re-attach elements if removed from DOM (e.g. by SPA frameworks like WebSquare)
    function ensureAttached() {
        if (!highlightOverlay || !tooltipEl) { init(); return; }
        if (!document.body.contains(highlightOverlay)) {
            document.body.appendChild(highlightOverlay);
        }
        if (!document.body.contains(tooltipEl)) {
            document.body.appendChild(tooltipEl);
        }
    }

    FP.Highlight = {
        init,
        show,
        showMessage,
        showNudge,
        showSkipButton,
        showScrollPrompt,
        hide,
        updatePosition,
        isElementInViewport,
        ensureAttached
    };

    console.log('[Reflow] Highlight loaded (v1.2 - Interactive buttons)');
})();
