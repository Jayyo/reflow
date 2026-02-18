// Reflow - Guide UI v2.0
// Minimalistic goal input panel with glassmorphism design

(function () {
    'use strict';
    const FP = window.FoxPilot;

    let panel = null;
    let goalInput = null;
    let statusBar = null;
    let progressBar = null;
    let modeBadge = null;
    let contentArea = null;
    let cancelBtn = null;
    let isMinimized = false;

    function init() {
        createPanel();
        console.log('[Reflow] GuideUI initialized (v2.0)');
    }

    function createPanel() {
        panel = document.createElement('div');
        panel.id = 'fox-pilot-panel';
        panel.style.opacity = '0.85';

        // Header
        const header = document.createElement('div');
        header.className = 'fox-pilot-panel-header';

        const logoWrap = document.createElement('div');
        logoWrap.className = 'fox-pilot-logo-wrap';

        const logoImg = document.createElement('img');
        logoImg.className = 'fox-pilot-logo-img';
        logoImg.src = chrome.runtime.getURL('assets/logo.png');
        logoImg.alt = 'Reflow';
        logoWrap.appendChild(logoImg);

        const logoText = document.createElement('span');
        logoText.className = 'fox-pilot-logo';
        logoText.textContent = 'Reflow';
        logoWrap.appendChild(logoText);

        header.appendChild(logoWrap);

        // Mode badge (hidden initially)
        modeBadge = document.createElement('span');
        modeBadge.className = 'fox-pilot-mode-badge';
        modeBadge.style.display = 'none';
        header.appendChild(modeBadge);

        const controls = document.createElement('div');
        controls.className = 'fox-pilot-controls';

        // Opacity control
        const opacityBtn = document.createElement('button');
        opacityBtn.className = 'fox-pilot-btn-icon';
        opacityBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
        opacityBtn.title = 'Opacity';
        opacityBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleOpacitySlider();
        });
        controls.appendChild(opacityBtn);

        const minimizeBtn = document.createElement('button');
        minimizeBtn.className = 'fox-pilot-btn-icon';
        minimizeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg>';
        minimizeBtn.title = 'Minimize';
        minimizeBtn.addEventListener('click', toggleMinimize);
        controls.appendChild(minimizeBtn);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'fox-pilot-btn-icon fox-pilot-btn-close';
        closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
        closeBtn.title = 'Close';
        closeBtn.addEventListener('click', () => FP.emit('guide:cancel'));
        controls.appendChild(closeBtn);

        header.appendChild(controls);
        panel.appendChild(header);

        // Body
        const body = document.createElement('div');
        body.className = 'fox-pilot-panel-body';

        // Goal input area - textarea for auto-expand
        const inputGroup = document.createElement('div');
        inputGroup.className = 'fox-pilot-input-group';

        goalInput = document.createElement('textarea');
        goalInput.id = 'fox-pilot-goal-input';
        goalInput.className = 'fox-pilot-goal-input';
        goalInput.placeholder = 'What would you like to do?';
        goalInput.rows = 1;
        goalInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitGoal();
            }
        });
        // Auto-expand on input
        goalInput.addEventListener('input', () => {
            goalInput.style.height = 'auto';
            goalInput.style.height = Math.min(goalInput.scrollHeight, 120) + 'px';
        });
        inputGroup.appendChild(goalInput);

        const submitBtn = document.createElement('button');
        submitBtn.className = 'fox-pilot-submit-btn';
        submitBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
        submitBtn.addEventListener('click', submitGoal);
        inputGroup.appendChild(submitBtn);

        body.appendChild(inputGroup);

        // Status area
        statusBar = document.createElement('div');
        statusBar.className = 'fox-pilot-status';
        statusBar.style.display = 'none';
        body.appendChild(statusBar);

        // Progress bar
        progressBar = document.createElement('div');
        progressBar.className = 'fox-pilot-progress';
        progressBar.style.display = 'none';
        const progressFill = document.createElement('div');
        progressFill.className = 'fox-pilot-progress-fill';
        progressBar.appendChild(progressFill);
        body.appendChild(progressBar);

        // Cancel button (hidden until guide is active)
        cancelBtn = document.createElement('button');
        cancelBtn.className = 'fox-pilot-cancel-btn';
        cancelBtn.textContent = 'Stop';
        cancelBtn.style.display = 'none';
        cancelBtn.addEventListener('click', () => FP.emit('guide:cancel'));
        body.appendChild(cancelBtn);

        // Dynamic content area (for Q&A, tour, explain)
        contentArea = document.createElement('div');
        contentArea.className = 'fox-pilot-content-area';
        contentArea.style.display = 'none';
        body.appendChild(contentArea);

        panel.appendChild(body);
        document.body.appendChild(panel);

        makeDraggable(panel, header);
    }

    function submitGoal() {
        const goal = goalInput.value.trim();
        if (!goal) {
            goalInput.classList.add('fox-pilot-input-shake');
            setTimeout(() => goalInput.classList.remove('fox-pilot-input-shake'), 500);
            return;
        }
        goalInput.disabled = true;
        FP.emit('guide:start', { goal });
    }

    // ========== MODE BADGE ==========
    function showModeBadge(mode) {
        if (!modeBadge) return;
        const labels = {
            GOAL_GUIDE: 'Guide',
            QA_TEXT: 'Q&A',
            TUTORIAL_TOUR: 'Tour',
            ONBOARDING_EXPLAIN: 'Explain'
        };
        modeBadge.textContent = labels[mode] || mode;
        modeBadge.style.display = 'inline-block';
        modeBadge.className = `fox-pilot-mode-badge fox-pilot-mode-${mode.toLowerCase()}`;
    }

    // ========== Q&A ANSWER BUBBLE ==========
    function showAnswer(text) {
        clearContentArea();
        contentArea.style.display = 'block';

        const bubble = document.createElement('div');
        bubble.className = 'fox-pilot-qa-bubble';

        const icon = document.createElement('span');
        icon.className = 'fox-pilot-qa-icon';
        const iconImg = document.createElement('img');
        iconImg.src = chrome.runtime.getURL('assets/logo.png');
        iconImg.style.cssText = 'width: 20px; height: 20px; object-fit: contain;';
        icon.appendChild(iconImg);
        bubble.appendChild(icon);

        const answer = document.createElement('div');
        answer.className = 'fox-pilot-qa-text';
        answer.textContent = text;
        bubble.appendChild(answer);

        contentArea.appendChild(bubble);

        if (statusBar) statusBar.style.display = 'none';
        if (progressBar) progressBar.style.display = 'none';
    }

    // ========== TOUR CARDS ==========
    function showTourCard(items, summary) {
        clearContentArea();
        contentArea.style.display = 'block';

        if (summary) {
            const summaryEl = document.createElement('div');
            summaryEl.className = 'fox-pilot-tour-summary';
            summaryEl.textContent = summary;
            contentArea.appendChild(summaryEl);
        }

        if (!items.length) {
            const empty = document.createElement('div');
            empty.className = 'fox-pilot-qa-text';
            empty.textContent = 'No features found to analyze.';
            contentArea.appendChild(empty);
            return;
        }

        let currentIndex = 0;

        const cardContainer = document.createElement('div');
        cardContainer.className = 'fox-pilot-tour-card';

        const counter = document.createElement('div');
        counter.className = 'fox-pilot-tour-counter';

        const cardTitle = document.createElement('div');
        cardTitle.className = 'fox-pilot-tour-title';

        const cardDesc = document.createElement('div');
        cardDesc.className = 'fox-pilot-tour-desc';

        const navRow = document.createElement('div');
        navRow.className = 'fox-pilot-tour-nav';

        const prevBtn = document.createElement('button');
        prevBtn.className = 'fox-pilot-tour-btn';
        prevBtn.textContent = 'Prev';
        prevBtn.addEventListener('click', () => {
            if (currentIndex > 0) { currentIndex--; renderCard(); }
        });

        const nextBtn = document.createElement('button');
        nextBtn.className = 'fox-pilot-tour-btn fox-pilot-tour-btn-primary';
        nextBtn.textContent = 'Next';
        nextBtn.addEventListener('click', () => {
            if (currentIndex < items.length - 1) { currentIndex++; renderCard(); }
        });

        navRow.appendChild(prevBtn);
        navRow.appendChild(nextBtn);

        cardContainer.appendChild(counter);
        cardContainer.appendChild(cardTitle);
        cardContainer.appendChild(cardDesc);
        cardContainer.appendChild(navRow);
        contentArea.appendChild(cardContainer);

        function renderCard() {
            const item = items[currentIndex];
            counter.textContent = `${currentIndex + 1} / ${items.length}`;
            cardTitle.textContent = item.title;
            cardDesc.textContent = item.description;
            prevBtn.disabled = currentIndex === 0;
            nextBtn.disabled = currentIndex === items.length - 1;

            if (item.selector_candidates?.length && FP.SelectorEngine) {
                const resolved = FP.SelectorEngine.resolveElement(item.selector_candidates);
                if (resolved) {
                    FP.Highlight.show(resolved.element, item.title, {
                        current: currentIndex + 1,
                        actionType: 'TOUR'
                    });
                    FP.FoxCharacter.moveToElement(resolved.element);
                }
            }
        }

        renderCard();

        if (statusBar) statusBar.style.display = 'none';
        if (progressBar) progressBar.style.display = 'none';
    }

    // ========== EXPLANATION PANEL ==========
    function showExplanation(explanations, pageSummary) {
        clearContentArea();
        contentArea.style.display = 'block';

        if (pageSummary) {
            const summary = document.createElement('div');
            summary.className = 'fox-pilot-explain-summary';
            summary.textContent = pageSummary;
            contentArea.appendChild(summary);
        }

        if (!explanations.length) {
            const empty = document.createElement('div');
            empty.className = 'fox-pilot-qa-text';
            empty.textContent = 'No elements to explain.';
            contentArea.appendChild(empty);
            return;
        }

        const panelEl = document.createElement('div');
        panelEl.className = 'fox-pilot-explain-panel';

        explanations.forEach(exp => {
            const item = document.createElement('div');
            item.className = 'fox-pilot-explain-item';

            const label = document.createElement('div');
            label.className = 'fox-pilot-explain-label';
            label.textContent = exp.element_text;
            item.appendChild(label);

            const desc = document.createElement('div');
            desc.className = 'fox-pilot-explain-desc';
            desc.textContent = exp.explanation_ko;
            item.appendChild(desc);

            panelEl.appendChild(item);
        });

        contentArea.appendChild(panelEl);

        if (statusBar) statusBar.style.display = 'none';
        if (progressBar) progressBar.style.display = 'none';
    }

    // ========== TAB RETURN CONFIRMATION ==========
    function showTabReturnConfirm(onComplete, onRetry) {
        clearContentArea();
        contentArea.style.display = 'block';

        const container = document.createElement('div');
        container.className = 'fox-pilot-tab-confirm';

        const msg = document.createElement('div');
        msg.className = 'fox-pilot-tab-confirm-text';
        msg.textContent = 'Done with the new tab?';
        container.appendChild(msg);

        const btnRow = document.createElement('div');
        btnRow.className = 'fox-pilot-tab-confirm-btns';

        const yesBtn = document.createElement('button');
        yesBtn.className = 'fox-pilot-tour-btn fox-pilot-tour-btn-primary';
        yesBtn.textContent = 'Yes, done';
        yesBtn.addEventListener('click', () => {
            clearContentArea();
            contentArea.style.display = 'none';
            onComplete();
        });

        const noBtn = document.createElement('button');
        noBtn.className = 'fox-pilot-tour-btn';
        noBtn.textContent = 'Continue';
        noBtn.addEventListener('click', () => {
            clearContentArea();
            contentArea.style.display = 'none';
            onRetry();
        });

        btnRow.appendChild(yesBtn);
        btnRow.appendChild(noBtn);
        container.appendChild(btnRow);

        contentArea.appendChild(container);
    }

    // ========== HELPERS ==========

    function clearContentArea() {
        if (contentArea) {
            while (contentArea.firstChild) contentArea.removeChild(contentArea.firstChild);
        }
    }

    function showStatus(message, type) {
        if (!statusBar) return;
        if (contentArea) contentArea.style.display = 'none';

        statusBar.style.display = 'block';
        while (statusBar.firstChild) statusBar.removeChild(statusBar.firstChild);

        const dot = document.createElement('span');
        dot.className = `fox-pilot-status-dot fox-pilot-dot-${type}`;
        statusBar.appendChild(dot);

        const text = document.createElement('span');
        text.className = 'fox-pilot-status-text';
        text.textContent = message;
        statusBar.appendChild(text);

        statusBar.className = `fox-pilot-status fox-pilot-status-${type}`;

        if (cancelBtn && type !== 'success' && type !== 'error') {
            cancelBtn.style.display = 'block';
        }
    }

    function showStep(stepNum, instruction, actionType) {
        showStatus(`Step ${stepNum}: ${instruction}`, actionType === 'INPUT' ? 'input' : 'action');
    }

    function showComplete(message) {
        showStatus(message || 'Done!', 'success');
        enableInput();
        if (progressBar) progressBar.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';
    }

    function showError(message) {
        showStatus(message, 'error');
        enableInput();
        if (cancelBtn) cancelBtn.style.display = 'none';
    }

    function enableInput() {
        if (goalInput) {
            goalInput.disabled = false;
            goalInput.value = '';
            goalInput.style.height = 'auto';
        }
    }

    function updateProgress(stepCount) {
        if (!progressBar) return;
        progressBar.style.display = 'block';
        const fill = progressBar.querySelector('.fox-pilot-progress-fill');
        if (fill) {
            const pct = Math.min((stepCount / 15) * 100, 95);
            fill.style.width = pct + '%';
        }
    }

    function resetUI() {
        enableInput();
        if (statusBar) statusBar.style.display = 'none';
        if (progressBar) {
            progressBar.style.display = 'none';
            const fill = progressBar.querySelector('.fox-pilot-progress-fill');
            if (fill) fill.style.width = '0%';
        }
        if (modeBadge) modeBadge.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';
        clearContentArea();
        if (contentArea) contentArea.style.display = 'none';
    }

    function toggleMinimize() {
        isMinimized = !isMinimized;
        const body = panel.querySelector('.fox-pilot-panel-body');
        if (body) {
            body.style.display = isMinimized ? 'none' : 'block';
        }
        panel.classList.toggle('fox-pilot-minimized', isMinimized);
    }

    function toggleOpacitySlider() {
        let slider = panel.querySelector('.fox-pilot-opacity-slider');
        if (slider) {
            slider.remove();
            return;
        }

        slider = document.createElement('div');
        slider.className = 'fox-pilot-opacity-slider';

        const range = document.createElement('input');
        range.type = 'range';
        range.min = '20';
        range.max = '100';
        range.value = String(Math.round((parseFloat(panel.style.opacity) || 0.85) * 100));
        range.className = 'fox-pilot-opacity-range';
        range.addEventListener('input', (e) => {
            const val = parseInt(e.target.value) / 100;
            panel.style.opacity = val;
            valDisplay.textContent = e.target.value + '%';
        });
        slider.appendChild(range);

        const valDisplay = document.createElement('span');
        valDisplay.className = 'fox-pilot-opacity-value';
        valDisplay.textContent = range.value + '%';
        slider.appendChild(valDisplay);

        const header = panel.querySelector('.fox-pilot-panel-header');
        if (header.nextSibling) {
            panel.insertBefore(slider, header.nextSibling);
        } else {
            panel.appendChild(slider);
        }
    }

    function isScreenshotEnabled() {
        // Screenshot always enabled (toggle removed for clean UI)
        return true;
    }

    function makeDraggable(el, handle) {
        let isDragging = false;
        let startX, startY, elX, elY;

        handle.style.cursor = 'grab';

        handle.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = el.getBoundingClientRect();
            elX = rect.left;
            elY = rect.top;
            handle.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            el.style.left = (elX + dx) + 'px';
            el.style.top = (elY + dy) + 'px';
            el.style.right = 'auto';
            el.style.bottom = 'auto';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            handle.style.cursor = 'grab';
        });
    }

    function destroy() {
        if (panel) panel.remove();
        panel = null;
    }

    function ensureAttached() {
        if (!panel) { init(); return; }
        if (!document.body.contains(panel)) {
            document.body.appendChild(panel);
        }
    }

    FP.GuideUI = {
        init,
        showStatus,
        showStep,
        showComplete,
        showError,
        showModeBadge,
        showAnswer,
        showTourCard,
        showExplanation,
        showTabReturnConfirm,
        enableInput,
        updateProgress,
        resetUI,
        isScreenshotEnabled,
        destroy,
        ensureAttached
    };

    console.log('[Reflow] GuideUI loaded (v2.0 - Minimalistic redesign)');
})();
