// Reflow - State Machine v3.0 - ChatGPT + No Presets
// Roadmap planning, element registry, DOM diff, OBSERVE, wrong-click, skip system

(function () {
    'use strict';
    const FP = window.FoxPilot;

    // Guide states
    const State = {
        IDLE: 'IDLE',
        ROUTING: 'ROUTING',
        PLANNING: 'PLANNING',
        SHOWING_ACTION: 'SHOWING_ACTION',
        WAITING_USER: 'WAITING_USER',
        DETECTING_CHANGE: 'DETECTING_CHANGE',
        TAB_SWITCHED: 'TAB_SWITCHED',
        COMPLETED: 'COMPLETED',
        BLOCKED: 'BLOCKED',
        ERROR: 'ERROR'
    };

    let currentState = State.IDLE;
    let goal = null;
    let currentMode = null;
    let stepCount = 0;
    let lastPlan = null;
    let clickHandler = null;
    let inputHandler = null;
    let urlCleanup = null;
    let tabCleanup = null;
    let preActionSnapshot = null;
    let roadmap = null;

    function getState() { return currentState; }
    function getMode() { return currentMode; }

    function transition(newState) {
        const oldState = currentState;
        currentState = newState;
        FP.emit('state:change', { from: oldState, to: newState });
    }

    // ========== ELEMENT RESOLUTION ==========
    // Primary: element registry (target_index from LLM)
    // Fallback: selector engine (legacy selector_candidates)

    function resolveTarget(plan) {
        // 0. Custom resolver (bypasses all standard resolution)
        if (plan.customResolver) {
            const el = plan.customResolver();
            if (el && FP.DomExtractor.isVisible(el)) {
                return { element: el, method: 'custom' };
            }
            console.warn('[Reflow] Custom resolver returned no visible element');
        }

        // 1. Try target_index from element registry
        if (plan.target_index != null) {
            const el = FP.DomExtractor.getElementByIndex(plan.target_index);
            if (el && FP.DomExtractor.isVisible(el)) {
                return { element: el, method: 'registry', index: plan.target_index };
            }
            console.warn('[Reflow] Registry miss for index:', plan.target_index);
        }

        // 2. Fallback: selector_candidates (backward compat)
        if (plan.selector_candidates?.length) {
            const resolved = FP.SelectorEngine.resolveElement(plan.selector_candidates);
            if (resolved) {
                return { element: resolved.element, method: 'selector', candidate: resolved.usedCandidate };
            }
        }

        // 3. Last resort: text search from target_text
        const targetText = plan.next_action?.target_text;
        if (targetText) {
            const el = FP.SelectorEngine.findByText(targetText);
            if (el && FP.DomExtractor.isVisible(el)) {
                return { element: el, method: 'text_search' };
            }
        }

        return null;
    }

    // ========== SKIP SYSTEM ==========

    async function handleSkip(reason) {
        FP.Highlight.hide();
        removeClickDetection();

        // Record skip in history so LLM is aware
        await FP.sendMessage({
            type: 'GUIDE_ADD_HISTORY',
            entry: {
                action: 'SKIP',
                reason: reason,
                url: location.href,
                ts: Date.now(),
                outcome: 'skipped'
            }
        });

        // Re-plan from current page state
        await planNext();
    }

    // ========== MAIN FLOW ==========

    async function startSession(newGoal, forceMode) {
        goal = newGoal;
        stepCount = 0;
        lastPlan = null;

        transition(State.ROUTING);
        FP.FoxCharacter.setThinking(true);

        // Route intent via LLM (unless mode is forced)
        FP.GuideUI.showStatus('의도를 분석하고 있어요...', 'thinking');

        if (forceMode) {
            currentMode = forceMode;
        } else {
            const routing = await FP.Planner.routeIntent(newGoal);
            currentMode = routing.mode;
            console.log('[Reflow] Routed to mode:', currentMode, routing.reason);
        }

        // ChatGPT goal scenario matching
        let scenarioHint = null;
        if (FP.ChatGPTKnowledge && FP.ChatGPTKnowledge.matchGoalScenario) {
            const scenario = FP.ChatGPTKnowledge.matchGoalScenario(newGoal);
            if (scenario) {
                console.log('[Reflow] ChatGPT scenario matched:', scenario.id || scenario.name);
                if (scenario.steps_hint) {
                    scenarioHint = scenario.steps_hint;
                }
                // If scenario has a start_url and user is not on it, suggest navigation
                if (scenario.start_url && !location.href.includes(scenario.start_url)) {
                    FP.GuideUI.showStatus(
                        `이 작업은 다른 페이지에서 시작해야 해요: ${scenario.start_url}`,
                        'navigate'
                    );
                    FP.Highlight.showMessage(
                        `먼저 ${scenario.start_url} 페이지로 이동해주세요.`,
                        'NAVIGATE'
                    );
                }
            }
        }

        // Show mode badge
        FP.GuideUI.showModeBadge(currentMode);

        // Save session to background
        await FP.sendMessage({
            type: 'GUIDE_START',
            goal: goal,
            mode: currentMode
        });

        // Set up URL change detection
        urlCleanup = FP.Stability.setupUrlWatcher(handleUrlChange);

        // Set up new tab detection
        tabCleanup = FP.Stability.setupTabDetection(
            handleTabSwitchedAway,
            handleTabReturned
        );

        // Execute based on mode
        switch (currentMode) {
            case FP.Planner.MODES.QA_TEXT:
                await executeQAMode();
                break;
            case FP.Planner.MODES.TUTORIAL_TOUR:
                await executeTourMode();
                break;
            case FP.Planner.MODES.ONBOARDING_EXPLAIN:
                await executeExplainMode();
                break;
            case FP.Planner.MODES.GOAL_GUIDE:
            default:
                // Generate roadmap before first step
                FP.GuideUI.showStatus('전체 계획을 세우고 있어요...', 'thinking');
                const pageState = FP.DomExtractor.extractPageState();
                roadmap = await FP.Planner.generateRoadmap(goal, pageState);

                // Merge ChatGPT scenario steps_hint into roadmap if available
                if (scenarioHint && roadmap) {
                    roadmap.hint = scenarioHint;
                } else if (scenarioHint && !roadmap) {
                    roadmap = { hint: scenarioHint };
                }

                if (roadmap) {
                    // Save roadmap to session for resume
                    await FP.sendMessage({
                        type: 'GUIDE_UPDATE',
                        patch: { roadmap }
                    });
                }
                await planNext();
                break;
        }
    }

    // Legacy alias
    async function startGuide(newGoal) {
        return startSession(newGoal);
    }

    // ========== QA MODE ==========
    async function executeQAMode() {
        transition(State.PLANNING);
        FP.GuideUI.showStatus('답변을 준비하고 있어요...', 'thinking');

        try {
            const pageState = FP.DomExtractor.extractPageState();
            const result = await FP.Planner.executeQA(goal, pageState);

            FP.FoxCharacter.setThinking(false);
            transition(State.COMPLETED);

            FP.GuideUI.showAnswer(result.answer || 'AI가 답변을 생성하지 못했습니다.');
            FP.FoxCharacter.goHome();
            FP.GuideUI.enableInput();
        } catch (error) {
            FP.FoxCharacter.setThinking(false);
            FP.GuideUI.showError(`오류: ${error.message}`);
            transition(State.ERROR);
        }
    }

    // ========== TOUR MODE ==========
    async function executeTourMode() {
        transition(State.PLANNING);
        FP.GuideUI.showStatus('기능을 분석하고 있어요...', 'thinking');

        try {
            const pageState = FP.DomExtractor.extractPageState();
            const result = await FP.Planner.executeTour(goal, pageState);

            FP.FoxCharacter.setThinking(false);
            transition(State.COMPLETED);

            const items = result.tour_items || [];
            FP.GuideUI.showTourCard(items, result.summary);
            FP.FoxCharacter.goHome();
        } catch (error) {
            FP.FoxCharacter.setThinking(false);
            FP.GuideUI.showError(`오류: ${error.message}`);
            transition(State.ERROR);
        }
    }

    // ========== EXPLAIN MODE ==========
    async function executeExplainMode() {
        transition(State.PLANNING);
        FP.GuideUI.showStatus('화면을 분석하고 있어요...', 'thinking');

        try {
            const pageState = FP.DomExtractor.extractPageState();
            const result = await FP.Planner.executeExplain(goal, pageState);

            FP.FoxCharacter.setThinking(false);
            transition(State.COMPLETED);

            FP.GuideUI.showExplanation(
                result.explanations || [],
                result.page_summary
            );
            FP.FoxCharacter.goHome();
        } catch (error) {
            FP.FoxCharacter.setThinking(false);
            FP.GuideUI.showError(`오류: ${error.message}`);
            transition(State.ERROR);
        }
    }

    // ========== GOAL GUIDE MODE ==========

    async function planNext() {
        transition(State.PLANNING);
        FP.FoxCharacter.setThinking(true);

        try {
            const detCompletion = FP.Planner.deterministicCompletion(goal);
            if (detCompletion.done) {
                return handleCompletion('목표를 달성했습니다!');
            }

            const pageState = FP.DomExtractor.extractPageState();

            // Adaptive screenshot
            let screenshot = null;
            if (FP.GuideUI.isScreenshotEnabled() && FP.Planner.shouldCaptureScreenshot(stepCount)) {
                FP.GuideUI.showStatus('페이지를 캡처하고 있어요...', 'thinking');
                screenshot = await FP.DomExtractor.captureScreenshot();
            }

            const sessionResp = await FP.sendMessage({ type: 'GUIDE_GET' });
            const history = sessionResp?.session?.history || [];

            FP.GuideUI.showStatus('다음 단계를 계획하고 있어요...', 'thinking');
            const plan = await FP.Planner.planNextAction(goal, pageState, history, screenshot, roadmap);
            lastPlan = plan;

            FP.FoxCharacter.setThinking(false);
            await handlePlan(plan);

        } catch (error) {
            FP.FoxCharacter.setThinking(false);
            console.error('[Reflow] Planning error:', error);
            FP.GuideUI.showError(`오류가 발생했습니다: ${error.message}`);
            transition(State.ERROR);

            setTimeout(() => {
                if (currentState === State.ERROR && goal) {
                    planNext();
                }
            }, 3000);
        }
    }

    async function handlePlan(plan) {
        if (plan.goal_complete || plan.status === 'COMPLETE') {
            return handleCompletion(plan.next_action?.instruction_ko || '목표를 달성했습니다!');
        }

        if (plan.status === 'BLOCKED') {
            transition(State.BLOCKED);
            FP.GuideUI.showError(plan.next_action?.instruction_ko || '진행할 수 없습니다.');
            FP.Highlight.showMessage(plan.next_action?.instruction_ko || '진행 불가', 'BLOCKED');
            FP.FoxCharacter.goHome();
            return;
        }

        const action = plan.next_action;
        if (!action) {
            FP.GuideUI.showError('AI가 다음 단계를 결정하지 못했습니다.');
            transition(State.ERROR);
            return;
        }

        stepCount++;
        FP.GuideUI.updateProgress(stepCount);

        // Take pre-action snapshot for DOM diff
        // Skip for OBSERVE (no page mutation expected) — saves DOM scan time
        if (action.type !== 'OBSERVE') {
            preActionSnapshot = FP.DomExtractor.takeSnapshot();
        }

        switch (action.type) {
            case 'CLICK':
            case 'REVEAL':
                await handleClickAction(plan);
                break;
            case 'INPUT':
                await handleInputAction(plan);
                break;
            case 'SELECT':
                await handleSelectAction(plan);
                break;
            case 'SCROLL':
                await handleScrollAction(plan);
                break;
            case 'OBSERVE':
                await handleObserveAction(plan);
                break;
            case 'NAVIGATE':
                await handleNavigateAction(plan);
                break;
            case 'WAIT':
                await handleWaitAction(plan);
                break;
            default:
                FP.GuideUI.showStatus(action.instruction_ko, 'info');
                transition(State.SHOWING_ACTION);
        }

        // Record action in history (except OBSERVE — recorded on confirm)
        if (action.type !== 'OBSERVE') {
            await FP.sendMessage({
                type: 'GUIDE_ADD_HISTORY',
                entry: {
                    action: action.type,
                    target: action.target_text || action.instruction_ko,
                    target_index: plan.target_index ?? null,
                    url: location.href,
                    ts: Date.now(),
                    outcome: 'ok'
                }
            });
        }
    }

    // ========== ACTION HANDLERS ==========

    async function handleClickAction(plan) {
        const action = plan.next_action;
        transition(State.SHOWING_ACTION);

        const resolved = resolveTarget(plan);

        if (resolved) {
            const { element } = resolved;
            console.log(`[Reflow] Resolved via ${resolved.method}`, resolved.index ?? '');
            FP.FoxCharacter.moveToElement(element);
            FP.Highlight.show(element, action.instruction_ko, {
                current: stepCount,
                actionType: action.type,
                onSkip: () => handleSkip('user_skip')
            });
            FP.GuideUI.showStep(stepCount, action.instruction_ko, action.type);

            transition(State.WAITING_USER);
            setupClickDetection(element);
        } else {
            FP.Highlight.showMessage(
                `${action.instruction_ko}\n\n💡 찾는 요소: "${action.target_text || '알 수 없음'}"`,
                action.type
            );
            FP.GuideUI.showStep(stepCount, action.instruction_ko, action.type);
            FP.FoxCharacter.goHome();

            transition(State.WAITING_USER);
            setupGenericClickDetection();
        }
    }

    async function handleInputAction(plan) {
        const action = plan.next_action;
        transition(State.SHOWING_ACTION);

        const resolved = resolveTarget(plan);

        if (resolved) {
            const { element } = resolved;
            console.log(`[Reflow] Input resolved via ${resolved.method}`, resolved.index ?? '');
            FP.FoxCharacter.moveToElement(element);

            // Show instruction with input hint — NO auto-fill
            let instruction = action.instruction_ko;
            if (action.input_text) {
                instruction += `\n💡 입력 예시: "${action.input_text}"`;
            }

            FP.Highlight.show(element, instruction, {
                current: stepCount,
                actionType: 'INPUT',
                inputHint: action.input_text || null,
                onConfirm: async () => {
                    // "입력 완료" button pressed
                    removeClickDetection();
                    await handleUserAction();
                },
                onSkip: async () => {
                    removeClickDetection();
                    await handleSkip('user_skip');
                }
            });
            FP.GuideUI.showStep(stepCount, instruction, 'INPUT');

            // Focus only — user types themselves
            element.focus();

            transition(State.WAITING_USER);
            setupInputDetection(element);
        } else {
            FP.Highlight.showMessage(action.instruction_ko, 'INPUT');
            FP.GuideUI.showStep(stepCount, action.instruction_ko, 'INPUT');
            transition(State.WAITING_USER);
            setupGenericClickDetection();
        }
    }

    async function handleSelectAction(plan) {
        await handleInputAction(plan);
    }

    async function handleScrollAction(plan) {
        const action = plan.next_action;
        FP.GuideUI.showStatus(action.instruction_ko, 'info');

        // Show countdown prompt — user can choose manual scroll
        const manualMode = await FP.Highlight.showScrollPrompt(
            action.instruction_ko,
            action.scroll_hint,
            3000
        );

        if (manualMode) {
            // User chose "직접 스크롤할게요" — wait for scroll event
            await waitForUserScroll(300);
        } else {
            // Auto-scroll after countdown
            const scrollAmounts = {
                'DOWN_SMALL': 300,
                'DOWN_MEDIUM': 600,
                'DOWN_LARGE': 1000,
                'UP_SMALL': -300
            };
            const amount = scrollAmounts[action.scroll_hint] || 400;
            window.scrollBy({ top: amount, behavior: 'smooth' });
            await new Promise(r => setTimeout(r, 800));
        }

        FP.Highlight.hide();
        await planNext();
    }

    // Wait for user to scroll at least `minDelta` px
    function waitForUserScroll(minDelta) {
        return new Promise((resolve) => {
            let totalScroll = 0;
            let lastY = window.scrollY;

            const onScroll = () => {
                const delta = Math.abs(window.scrollY - lastY);
                totalScroll += delta;
                lastY = window.scrollY;

                if (totalScroll >= minDelta) {
                    window.removeEventListener('scroll', onScroll);
                    clearTimeout(timeout);
                    resolve();
                }
            };

            window.addEventListener('scroll', onScroll);

            // Safety timeout: 15s max wait
            const timeout = setTimeout(() => {
                window.removeEventListener('scroll', onScroll);
                resolve();
            }, 15000);
        });
    }

    async function handleObserveAction(plan) {
        const action = plan.next_action;
        transition(State.SHOWING_ACTION);

        const resolved = resolveTarget(plan);
        const element = resolved?.element;

        if (element) {
            FP.FoxCharacter.moveToElement(element);
        }

        // Show highlight with "확인했어요" button + Q&A — no click detection needed
        FP.Highlight.show(element, action.instruction_ko, {
            current: stepCount,
            actionType: 'OBSERVE',
            onConfirm: async () => {
                FP.Highlight.hide();
                // Record in history — fire-and-forget for speed
                FP.sendMessage({
                    type: 'GUIDE_ADD_HISTORY',
                    entry: {
                        action: 'OBSERVE',
                        target: action.target_text || action.instruction_ko,
                        url: location.href,
                        ts: Date.now(),
                        outcome: 'confirmed'
                    }
                });
                await planNext();
            },
            onAskQuestion: async (question) => {
                // Call GPT-5-mini via background proxy for follow-up Q&A
                const context = action.instruction_ko;
                const pageTitle = document.title;
                const resp = await FP.sendMessage({
                    type: 'OPENAI_REQUEST',
                    data: {
                        messages: [
                            {
                                role: 'system',
                                content: `You are Reflow, a friendly web guide assistant. The user is currently on "${pageTitle}" and seeing this guide step: "${context}". Answer their follow-up question concisely in Korean (2-3 sentences max). Be helpful and friendly.`
                            },
                            { role: 'user', content: question }
                        ],
                        maxTokens: 300,
                        reasoningEffort: 'low'
                    }
                });
                if (!resp.success) throw new Error(resp.error || 'API call failed');
                return resp.data;
            }
        });
        FP.GuideUI.showStep(stepCount, action.instruction_ko, 'OBSERVE');

        transition(State.WAITING_USER);
        // No click detection setup — only the "확인했어요" button advances
    }

    async function handleNavigateAction(plan) {
        const action = plan.next_action;
        FP.GuideUI.showStatus(action.instruction_ko, 'navigate');
        FP.Highlight.showMessage(action.instruction_ko, 'NAVIGATE');

        if (action.navigate_url) {
            setTimeout(() => {
                window.location.href = action.navigate_url;
            }, 1500);
        }
    }

    async function handleWaitAction(plan) {
        const action = plan.next_action;
        FP.GuideUI.showStatus(action.instruction_ko || '페이지 로딩 중...', 'waiting');
        FP.Highlight.showMessage('페이지가 로딩되고 있어요...', 'WAIT');

        await FP.Stability.waitForStable();
        await planNext();
    }

    // ========== NEW TAB HANDLING ==========

    function handleTabSwitchedAway() {
        if (currentState === State.IDLE || currentState === State.COMPLETED) return;

        transition(State.TAB_SWITCHED);
        removeClickDetection();
        FP.Highlight.hide();
        FP.GuideUI.showStatus('새 탭에서 작업을 계속하세요. 완료 후 이 탭으로 돌아와주세요.', 'navigate');
    }

    function handleTabReturned() {
        if (currentState !== State.TAB_SWITCHED) return;

        FP.GuideUI.showTabReturnConfirm(
            async () => {
                await planNext();
            },
            async () => {
                await planNext();
            }
        );
    }

    // ========== EVENT DETECTION ==========

    function setupClickDetection(targetElement) {
        removeClickDetection();
        let wrongClickCount = 0;

        clickHandler = async (e) => {
            const target = e.target;

            // Ignore clicks on Fox UI elements (buttons inside tooltip, etc.)
            if (FP.DomExtractor.isFoxElement(target)) return;

            const isTarget = target === targetElement ||
                targetElement.contains(target) ||
                target.contains(targetElement);

            const rect = targetElement.getBoundingClientRect();
            const clickInRange = (
                e.clientX >= rect.left - 40 &&
                e.clientX <= rect.right + 40 &&
                e.clientY >= rect.top - 40 &&
                e.clientY <= rect.bottom + 40
            );

            if (isTarget || clickInRange) {
                // Correct click
                removeClickDetection();
                await handleUserAction();
            } else {
                // Wrong click — progressive escalation
                wrongClickCount++;

                if (wrongClickCount === 1) {
                    // 1st: gentle nudge
                    FP.Highlight.showNudge('위에 표시된 곳을 클릭해주세요! 🦊');
                } else if (wrongClickCount === 2) {
                    // 2nd: show skip button
                    FP.Highlight.showNudge('다시 한번 확인해주세요! 건너뛰기도 가능해요.');
                    FP.Highlight.showSkipButton();
                } else if (wrongClickCount >= 3) {
                    // 3rd+: auto-skip — re-plan from current state
                    removeClickDetection();
                    await handleSkip('user_deviated');
                }
            }
        };

        document.addEventListener('click', clickHandler, true);
    }

    function setupGenericClickDetection() {
        removeClickDetection();

        clickHandler = async (e) => {
            const el = e.target.closest('a, button, input, select, textarea, [role="button"]');
            if (el && !FP.DomExtractor.isFoxElement(el)) {
                removeClickDetection();
                await handleUserAction();
            }
        };

        document.addEventListener('click', clickHandler, true);
    }

    function setupInputDetection(inputElement) {
        removeClickDetection();

        inputHandler = async (e) => {
            if (e.type === 'keypress' && e.key === 'Enter') {
                removeClickDetection();
                await handleUserAction();
            }
        };

        const blurHandler = async () => {
            setTimeout(async () => {
                if (currentState === State.WAITING_USER) {
                    removeClickDetection();
                    await handleUserAction();
                }
            }, 500);
        };

        inputElement.addEventListener('keypress', inputHandler);
        inputElement.addEventListener('blur', blurHandler, { once: true });

        clickHandler = async (e) => {
            const btn = e.target.closest('button[type="submit"], input[type="submit"], button');
            if (btn && !FP.DomExtractor.isFoxElement(btn)) {
                removeClickDetection();
                await handleUserAction();
            }
        };
        document.addEventListener('click', clickHandler, true);
    }

    function removeClickDetection() {
        if (clickHandler) {
            document.removeEventListener('click', clickHandler, true);
            clickHandler = null;
        }
        if (inputHandler) {
            inputHandler = null;
        }
    }

    // ========== POST-ACTION ==========

    async function handleUserAction() {
        transition(State.DETECTING_CHANGE);
        FP.Highlight.hide();
        FP.GuideUI.showStatus('변화를 감지하고 있어요...', 'thinking');
        FP.FoxCharacter.setThinking(true);

        const result = await FP.Stability.waitForStable();
        console.log('[Reflow] Stability result:', result);

        // Compute DOM diff if we have a pre-action snapshot
        let diffChanges = null;
        if (preActionSnapshot) {
            const postSnapshot = FP.DomExtractor.takeSnapshot();
            diffChanges = FP.DomExtractor.diffSnapshots(preActionSnapshot, postSnapshot);
            console.log('[Reflow] DOM diff:', diffChanges);
            preActionSnapshot = null;
        }

        // Update last history entry with diff results
        if (diffChanges && diffChanges.length > 0) {
            await FP.sendMessage({
                type: 'GUIDE_PATCH_LAST_HISTORY',
                patch: { diff: diffChanges }
            });
        }

        await planNext();
    }

    async function handleUrlChange(info) {
        console.log('[Reflow] URL changed:', info.oldUrl, '→', info.newUrl);

        // Skip if already handling a user action (prevents double planNext calls
        // when clicking a link triggers both click detection and URL change)
        if (currentState === State.IDLE || currentState === State.COMPLETED || currentState === State.DETECTING_CHANGE) return;

        FP.GuideUI.showStatus('새 페이지 로딩 중...', 'waiting');
        await FP.Stability.waitForStable();

        if (goal && currentMode === FP.Planner.MODES.GOAL_GUIDE) {
            await planNext();
        }
    }

    // ========== COMPLETION & CLEANUP ==========

    function handleCompletion(message) {
        transition(State.COMPLETED);
        removeClickDetection();

        FP.Highlight.hide();
        FP.FoxCharacter.goHome();
        FP.FoxCharacter.setThinking(false);
        FP.GuideUI.showComplete(message);
        FP.Highlight.showMessage(message, 'COMPLETE', {
            autoDismiss: 8000,
            onDismiss: () => {
                FP.GuideUI.enableInput();
            }
        });

        FP.sendMessage({
            type: 'GUIDE_UPDATE',
            patch: { status: 'DONE' }
        });

        goal = null;
    }

    function cancelGuide() {
        transition(State.IDLE);
        removeClickDetection();

        if (urlCleanup) { urlCleanup(); urlCleanup = null; }
        if (tabCleanup) { tabCleanup(); tabCleanup = null; }

        FP.Highlight.hide();
        FP.FoxCharacter.goHome();
        FP.FoxCharacter.setThinking(false);
        FP.GuideUI.resetUI();

        FP.sendMessage({ type: 'GUIDE_END' });

        goal = null;
        stepCount = 0;
        lastPlan = null;
        currentMode = null;
        preActionSnapshot = null;
        roadmap = null;
    }

    async function resumeIfActive() {
        const resp = await FP.sendMessage({ type: 'GUIDE_GET' });
        if (resp?.ok && resp.session && resp.session.status === 'RUNNING') {
            console.log('[Reflow] Resuming guide for goal:', resp.session.goal);
            goal = resp.session.goal;
            stepCount = resp.session.stepCount || 0;
            currentMode = resp.session.mode || FP.Planner.MODES.GOAL_GUIDE;
            roadmap = resp.session.roadmap || null;

            urlCleanup = FP.Stability.setupUrlWatcher(handleUrlChange);
            tabCleanup = FP.Stability.setupTabDetection(
                handleTabSwitchedAway,
                handleTabReturned
            );

            await FP.Stability.waitForStable();

            FP.GuideUI.showStatus('가이드를 재개합니다...', 'info');
            FP.GuideUI.showModeBadge(currentMode);
            await planNext();
        }
    }

    FP.StateMachine = {
        State,
        getState,
        getMode,
        startGuide,
        startSession,
        cancelGuide,
        resumeIfActive,
        planNext
    };

    console.log('[Reflow] StateMachine loaded (v3.0 - ChatGPT + No Presets)');
})();
