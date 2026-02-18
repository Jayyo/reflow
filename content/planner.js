// Reflow - LLM Planner v3.0 - ChatGPT Specialist
// Roadmap planning, dynamic reasoning, element indexing, rich context, page meta

(function () {
    'use strict';
    const FP = window.FoxPilot;

    // ========== MODE DEFINITIONS ==========
    const MODES = {
        GOAL_GUIDE: 'GOAL_GUIDE',
        TUTORIAL_TOUR: 'TUTORIAL_TOUR',
        ONBOARDING_EXPLAIN: 'ONBOARDING_EXPLAIN',
        QA_TEXT: 'QA_TEXT'
    };

    const MODE_CONFIG = {
        GOAL_GUIDE:          { maxTokens: 600, maxElements: 50, label: 'Guide' },
        TUTORIAL_TOUR:       { maxTokens: 500, maxElements: 40, label: 'Tour' },
        ONBOARDING_EXPLAIN:  { maxTokens: 400, maxElements: 50, label: 'Explain' },
        QA_TEXT:             { maxTokens: 300, maxElements: 20, label: 'Q&A' }
    };

    // ========== ROUTER PROMPT ==========
    const ROUTER_PROMPT = `You are a user-intent classifier for a web navigation assistant specialized for ChatGPT (chatgpt.com).
Given the user's input and current page URL/title, classify the intent into exactly ONE mode.

The site is ChatGPT by OpenAI — an AI chat interface where users converse with language models, manage conversations, configure settings, create custom GPTs, and more.

Modes:
- GOAL_GUIDE: User wants to accomplish a specific task (start a new chat, change model, create a GPT, upload a file, enable plugins, adjust settings, share a conversation). Keywords: "하고 싶어", "바꾸고", "만들고", "GPT 만들기", "모델 변경", "설정", "업로드", "공유", "해줘", "하려면"
- TUTORIAL_TOUR: User wants to learn about ChatGPT's features or get an overview. Keywords: "처음", "사용법", "둘러보기", "기능", "뭐가 있어", "어떤 기능", "ChatGPT 뭐야"
- ONBOARDING_EXPLAIN: User wants explanations of visible UI elements. Keywords: "이게 뭐야", "각각", "설명해", "무슨 버튼", "이 화면", "사이드바", "모델 선택"
- QA_TEXT: User asks a short question that can be answered with text only. Keywords: "어떻게", "왜", "몇", "언제", "차이", "GPT-4o랑 뭐가 달라", short questions

Return ONLY JSON: {"mode": "GOAL_GUIDE"|"TUTORIAL_TOUR"|"ONBOARDING_EXPLAIN"|"QA_TEXT", "reason": "brief"}`;

    // ========== MODE-SPECIFIC SYSTEM PROMPTS ==========

    const GUIDE_PROMPT = `You are "Reflow Planner", a one-step web navigation planner specialized for ChatGPT (chatgpt.com).
Return ONLY one JSON object. No markdown, no code fences, no extra text.

Primary language: Korean (ko-KR). User-facing instructions must be in Korean.
Your job: given a goal + current page state + action history, produce exactly ONE next atomic action.

ChatGPT Site Knowledge:
- This is ChatGPT by OpenAI at chatgpt.com.
- The UI uses data-testid selectors extensively (e.g. data-testid="send-button", data-testid="model-selector", data-testid="conversation-turn-N").
- Key UI patterns:
  * Model selector dropdown at the top of a new chat to pick GPT-4o, o1, etc.
  * Sidebar (left panel) with conversation history, searchable, collapsible.
  * "New chat" button at the top of the sidebar.
  * Settings dialog accessible from profile icon (bottom-left) → Settings.
  * GPT Editor (for creating custom GPTs) with "Create" and "Configure" tabs.
  * Message input textarea at the bottom with send button and attachment button.
  * Conversation turns rendered as alternating user/assistant messages.
  * File upload via the attachment (paperclip) button or drag-and-drop.
  * "Share" button in the top-right of a conversation to share a link.
- Elements often have aria-label attributes describing their function.

IMPORTANT: For INPUT actions, do NOT provide input_text with actual values to auto-fill.
Instead, describe what the user should type in instruction_ko. The user will type it themselves.

Hard rules:
1) Plan only ONE step at a time.
2) Each element in ELEMENTS has a bracketed index like [3]. Use target_index to reference it.
3) predicted_action tells you what the element does — use it to pick the right action type.
4) Check aria states (expanded, checked, selected) to avoid redundant actions.
5) If target is hidden (in_viewport=false, or inside collapsed section), choose SCROLL or REVEAL first.
6) If user is on the wrong page, choose NAVIGATE with clear URL.
7) If the goal is impossible (auth required, unavailable), choose BLOCKED with reason.
8) If the goal is achieved (check page structure, success signals, history), set goal_complete=true.
9) Be robust to dynamic pages (SPA/modals). If loading, choose WAIT.
10) Keep output compact. No explanation outside JSON.
11) Prefer data-testid selectors when identifying ChatGPT elements for reliability.

Context you receive:
- SITE_CONTEXT: ChatGPT-specific context about the current page state (if available).
- ROADMAP: rough step-by-step plan for the entire goal. Follow it loosely — adapt if page state differs.
- META: page description, breadcrumbs, site sections — helps you understand where the user is.
- ELEMENTS: each has [idx] tag "text" with:
  - →action — predicted interaction result (navigate, submit_form, expand, toggle, text_input, etc.)
  - aria:{...} — current ARIA state (expanded, checked, selected, pressed, etc.)
  - form:{label, required} — form field context with help text if available
  - in:landmark — which page region (navigation, main, banner, etc.)
  - help:"..." — site's own help/hint text for this element
  - OFF — element is outside viewport

Action types:
- CLICK: click an element (use target_index)
- INPUT: focus a field, tell user what to type (use target_index, provide input_text as hint)
- SELECT: select dropdown option (use target_index, provide input_text as option)
- SCROLL: scroll to reveal content (provide scroll_hint, no target_index needed)
- REVEAL: expand collapsed section (use target_index)
- OBSERVE: highlight element for user to see, no interaction needed (use target_index)
  Use when: showing results, confirming state, pointing out info.
- NAVIGATE: go to different URL (provide navigate_url, no target_index needed)
- WAIT: page loading, retry
- NONE: goal complete
- BLOCKED: cannot proceed

JSON Schema:
{
  "status": "IN_PROGRESS" | "COMPLETE" | "WRONG_PAGE" | "BLOCKED",
  "goal_complete": boolean,
  "confidence": number (0.0-1.0),
  "reason_short": "brief explanation",
  "next_action": {
    "type": "CLICK" | "INPUT" | "SELECT" | "SCROLL" | "REVEAL" | "OBSERVE" | "NAVIGATE" | "WAIT" | "NONE" | "BLOCKED",
    "instruction_ko": "Korean instruction for user (max 200 chars)",
    "input_text": "hint for user (INPUT/SELECT only, display only)",
    "navigate_url": "URL (NAVIGATE only)",
    "scroll_hint": "DOWN_SMALL" | "DOWN_MEDIUM" | "DOWN_LARGE" | "UP_SMALL",
    "target_text": "visible text fallback"
  },
  "target_index": number | null
}`;

    const TOUR_PROMPT = `You are "Reflow Tour Guide". Given a page's interactive elements,
create a feature tour highlighting the most important UI sections.

Return ONLY JSON. No markdown, no code fences.
{
  "tour_items": [
    {
      "title": "Feature name in Korean",
      "description": "1-2 sentence Korean explanation of what this feature does",
      "target_text": "visible text of the UI element",
      "selector_candidates": [{"strategy": "css"|"text", "value": "...", "score": 0.9}]
    }
  ],
  "summary": "Brief Korean summary of the page/site (max 100 chars)"
}
Max 6 tour items. Focus on the most useful features. Order by importance.`;

    const EXPLAIN_PROMPT = `You are "Reflow Explainer". Given a page's interactive elements,
explain what each major section/element does WITHOUT suggesting any actions.

Return ONLY JSON. No markdown, no code fences.
{
  "explanations": [
    {
      "element_text": "visible text or label of the element",
      "explanation_ko": "Korean explanation of what this element does (1 sentence)",
      "category": "navigation" | "input" | "action" | "display" | "settings"
    }
  ],
  "page_summary": "Brief Korean summary of the page purpose (max 150 chars)"
}
Max 8 explanations. Group similar elements. Focus on what's visible.`;

    const QA_PROMPT = `You are "Reflow Q&A". Answer the user's question about this web page concisely in Korean.
Use the page state and elements to give accurate, helpful answers.

Return ONLY JSON:
{
  "answer": "Korean answer text (max 300 chars)",
  "related_elements": ["element text 1", "element text 2"],
  "confidence": 0.0-1.0
}
Keep answers short and directly relevant to the page context.`;

    // ========== ROADMAP PLANNER ==========
    // Generates a rough multi-step plan at session start

    const ROADMAP_PROMPT = `You are "Reflow Roadmap Planner", specialized for ChatGPT (chatgpt.com).
Given a user's goal and the current page state, generate a brief step-by-step roadmap.
Return ONLY JSON. No markdown, no code fences.

You have deep knowledge of ChatGPT's UI:
- Sidebar with conversation history, "New chat" button, search
- Model selector dropdown (GPT-4o, o1, etc.)
- Message input area with send/attachment buttons
- Settings dialog (profile icon → Settings)
- GPT Editor with Create/Configure tabs for building custom GPTs
- Share conversation functionality
- File upload via attachment button or drag-and-drop

{
  "steps": ["step 1 in Korean (max 40 chars)", "step 2", ...],
  "complexity": "simple" | "medium" | "complex"
}

Rules:
- Max 8 steps. Be concise.
- complexity: simple (1-3 clicks, single page), medium (form filling, 2-3 pages), complex (multi-form, conditional flow, auth)
- Each step describes WHAT to do, not HOW (e.g. "모델 선택" not "모델 선택 드롭다운을 찾아서 클릭하고 선택")
- Consider the page's current state — skip steps already done.
- If the goal is ambiguous, interpret it as the most common user intent on ChatGPT.`;

    async function generateRoadmap(goal, pageState) {
        // Compact page summary for roadmap generation
        const elSummary = (pageState.interactive_elements || [])
            .slice(0, 30)
            .map(el => `${el.tag} "${el.text || ''}"`)
            .join(', ');

        const metaDesc = pageState.meta?.description || '';
        const breadcrumb = pageState.meta?.breadcrumb?.join(' > ') || '';
        const sections = pageState.meta?.site_sections?.join(', ') || '';

        const messages = [
            { role: 'system', content: ROADMAP_PROMPT },
            {
                role: 'user',
                content: `Goal: ${goal}\nPage: ${pageState.title} (${pageState.url})\n${metaDesc ? `About: ${metaDesc}\n` : ''}${breadcrumb ? `Path: ${breadcrumb}\n` : ''}${sections ? `Sections: ${sections}\n` : ''}Elements: ${elSummary}`
            }
        ];

        try {
            const response = await FP.sendMessage({
                type: 'OPENAI_REQUEST',
                data: { messages, maxTokens: 250, reasoningEffort: 'low' }
            });

            if (!response.success) return null;
            const parsed = parseActionResponse(response.data);
            if (parsed.steps?.length > 0) {
                console.log('[Reflow] Roadmap generated:', parsed);
                return parsed;
            }
        } catch (e) {
            console.warn('[Reflow] Roadmap generation failed:', e);
        }
        return null;
    }

    // ========== DYNAMIC REASONING ==========
    // Adjusts reasoning_effort based on page complexity

    function estimateComplexity(pageState, history, roadmap) {
        let score = 0;

        // Element count indicates page complexity
        const elCount = pageState.interactive_elements?.length || 0;
        if (elCount > 40) score += 2;
        else if (elCount > 20) score += 1;

        // Forms with multiple required fields
        const reqFields = (pageState.interactive_elements || [])
            .filter(el => el.form?.required).length;
        if (reqFields > 3) score += 2;
        else if (reqFields > 0) score += 1;

        // Errors on page — needs careful handling
        if (pageState.structure?.errors?.length > 0) score += 2;

        // Dialog open — modal context
        if (pageState.structure?.dialogs?.length > 0) score += 1;

        // History has skips or deviations
        const recentSkips = (history || []).slice(-3)
            .filter(h => h.outcome === 'skipped').length;
        if (recentSkips > 0) score += 2;

        // Roadmap says complex
        if (roadmap?.complexity === 'complex') score += 1;

        // low (0-2), medium (3+)
        return score >= 3 ? 'medium' : 'low';
    }

    // ========== ADAPTIVE SCREENSHOT ==========
    let _stepCount = 0;
    let _lastScreenshotUrl = '';

    function shouldCaptureScreenshot(stepCount) {
        const urlChanged = location.href !== _lastScreenshotUrl;
        // First step, every 5 steps, or URL change
        const should = (stepCount === 0) || (stepCount % 5 === 0) || urlChanged;
        if (should) {
            _lastScreenshotUrl = location.href;
        }
        return should;
    }

    // ========== ROUTER ==========
    async function routeIntent(userInput) {
        const messages = [
            { role: 'system', content: ROUTER_PROMPT },
            { role: 'user', content: `Input: "${userInput}"\nPage: ${document.title} (${location.href})` }
        ];

        try {
            const response = await FP.sendMessage({
                type: 'OPENAI_REQUEST',
                data: {
                    messages,
                    maxTokens: 100,
                    reasoningEffort: 'low'
                }
            });

            if (!response.success) {
                return { mode: MODES.GOAL_GUIDE, reason: 'fallback' };
            }

            const parsed = parseActionResponse(response.data);
            if (parsed.mode && MODES[parsed.mode]) {
                return parsed;
            }
            return { mode: MODES.GOAL_GUIDE, reason: 'parse_fallback' };
        } catch (e) {
            console.warn('[Reflow] Router failed, defaulting to GOAL_GUIDE:', e);
            return { mode: MODES.GOAL_GUIDE, reason: 'error_fallback' };
        }
    }

    // ========== BUILD USER MESSAGE ==========
    function buildUserMessage(goal, pageState, history, screenshot, mode, roadmap) {
        const config = MODE_CONFIG[mode] || MODE_CONFIG.GOAL_GUIDE;
        const maxEls = config.maxElements;

        // ChatGPT site context injection
        let siteContextStr = '';
        if (FP.ChatGPTKnowledge && typeof FP.ChatGPTKnowledge.generateSiteContext === 'function') {
            try {
                const ctx = FP.ChatGPTKnowledge.generateSiteContext();
                if (ctx) {
                    siteContextStr = `SITE_CONTEXT:\n${ctx}\n`;
                }
            } catch (e) {
                console.warn('[Reflow] ChatGPT site context generation failed:', e);
            }
        }

        // Compress interactive elements with rich context
        const compressedElements = (pageState.interactive_elements || [])
            .slice(0, maxEls)
            .map(el => {
                const parts = [el.tag];
                if (el.text) parts.push(`"${el.text}"`);
                if (el.role) parts.push(`r=${el.role}`);
                if (el.type) parts.push(`t=${el.type}`);
                if (el.name) parts.push(`n=${el.name}`);
                if (el.placeholder) parts.push(`ph="${el.placeholder}"`);
                if (el.href) parts.push(`→${el.href.slice(0, 60)}`);
                if (el.value) parts.push(`v="${el.value}"`);
                if (!el.enabled) parts.push('DIS');
                if (!el.in_viewport) parts.push('OFF');
                // Predicted action
                if (el.predicted_action) parts.push(`→${el.predicted_action}`);
                // ARIA states (compact)
                if (el.aria) {
                    const ariaStr = Object.entries(el.aria)
                        .map(([k, v]) => `${k}=${v}`).join(',');
                    parts.push(`aria:{${ariaStr}}`);
                }
                // Form context (compact)
                if (el.form) {
                    const fc = [];
                    if (el.form.label) fc.push(`lbl="${el.form.label}"`);
                    if (el.form.required) fc.push('req');
                    if (fc.length) parts.push(`form:{${fc.join(',')}}`);
                }
                // Landmark
                if (el.landmark) parts.push(`in:${el.landmark}`);
                // Help text from site
                if (el.help) parts.push(`help:"${el.help}"`);
                return `[${el.idx}] ${parts.join('|')}`;
            })
            .join('\n');

        // Compress history (include diff results)
        const historyStr = history.length > 0
            ? history.slice(-8).map((h, i) => {
                let entry = `${i + 1}.[${h.outcome}]${h.action}→${h.target || '?'}`;
                if (h.diff && h.diff.length > 0) {
                    entry += ` (${h.diff.join('; ')})`;
                }
                return entry;
            }).join('\n')
            : 'None.';

        // Page structure summary
        const struct = pageState.structure;
        let structStr = '';
        if (struct) {
            const parts = [];
            if (struct.headings?.length) {
                parts.push('H:' + struct.headings.map(h => `${'#'.repeat(h.level)}${h.text}`).join(' | '));
            }
            if (struct.landmarks?.length) {
                parts.push('LM:' + struct.landmarks.map(l => l.label ? `${l.role}(${l.label})` : l.role).join(','));
            }
            if (struct.dialogs?.length) {
                parts.push('DIALOG:' + struct.dialogs.map(d => d.label).join(','));
            }
            if (struct.errors?.length) {
                parts.push('ERRORS:' + struct.errors.join(' | '));
            }
            if (parts.length) structStr = '\nSTRUCTURE: ' + parts.join(' | ');
        }

        // Page meta summary
        const meta = pageState.meta;
        let metaStr = '';
        if (meta) {
            const mp = [];
            if (meta.description) mp.push(`desc:"${meta.description.slice(0, 120)}"`);
            if (meta.breadcrumb?.length) mp.push(`path:${meta.breadcrumb.join(' > ')}`);
            if (meta.site_sections?.length) mp.push(`nav:[${meta.site_sections.join(',')}]`);
            if (meta.schema_type) mp.push(`type:${meta.schema_type}`);
            if (mp.length) metaStr = '\nMETA: ' + mp.join(' | ');
        }

        // Roadmap context
        let roadmapStr = '';
        if (roadmap?.steps?.length) {
            roadmapStr = '\nROADMAP: ' + roadmap.steps.map((s, i) => `${i + 1}.${s}`).join(' → ');
        }

        const content = [];
        content.push({
            type: 'text',
            text: `${siteContextStr}GOAL: ${goal}
PAGE: ${pageState.title} (${pageState.url})
VP: ${pageState.viewport.w}x${pageState.viewport.h} | LOAD: ${pageState.loading}
${pageState.success_text_candidates?.length ? `SIGNALS: ${pageState.success_text_candidates.join(',')}` : ''}${metaStr}${structStr}${roadmapStr}
ELEMENTS:\n${compressedElements}
HISTORY:\n${historyStr}
Respond with JSON.`
        });

        if (screenshot) {
            content.push({
                type: 'image_url',
                image_url: { url: screenshot, detail: 'low' }
            });
        }

        return content;
    }

    // ========== MODE-SPECIFIC EXECUTORS ==========

    // GOAL_GUIDE mode: step-by-step navigation with dynamic reasoning
    async function executeGuide(goal, pageState, history, screenshot, roadmap) {
        const userContent = buildUserMessage(goal, pageState, history, screenshot, MODES.GOAL_GUIDE, roadmap);
        const reasoning = estimateComplexity(pageState, history, roadmap);
        console.log('[Reflow] Reasoning effort:', reasoning);

        const messages = [
            { role: 'system', content: GUIDE_PROMPT },
            { role: 'user', content: userContent }
        ];

        const response = await FP.sendMessage({
            type: 'OPENAI_REQUEST',
            data: {
                messages,
                maxTokens: MODE_CONFIG.GOAL_GUIDE.maxTokens,
                reasoningEffort: reasoning
            }
        });

        if (!response.success) throw new Error(response.error || 'LLM request failed');
        return parseActionResponse(response.data);
    }

    // TUTORIAL_TOUR mode: feature overview cards
    async function executeTour(goal, pageState) {
        const elements = (pageState.interactive_elements || [])
            .slice(0, 40)
            .map(el => `[${el.idx}] ${el.tag} "${el.text || ''}" ${el.role || ''}`).join('\n');

        const messages = [
            { role: 'system', content: TOUR_PROMPT },
            { role: 'user', content: `Page: ${pageState.title} (${pageState.url})\nGoal: ${goal}\nElements:\n${elements}` }
        ];

        const response = await FP.sendMessage({
            type: 'OPENAI_REQUEST',
            data: { messages, maxTokens: MODE_CONFIG.TUTORIAL_TOUR.maxTokens, reasoningEffort: 'low' }
        });

        if (!response.success) throw new Error(response.error || 'LLM request failed');
        return parseActionResponse(response.data);
    }

    // ONBOARDING_EXPLAIN mode: element descriptions
    async function executeExplain(goal, pageState) {
        const elements = (pageState.interactive_elements || [])
            .slice(0, 50)
            .map(el => `[${el.idx}] ${el.tag} "${el.text || ''}" ${el.role || ''} ${el.type || ''}`).join('\n');

        const messages = [
            { role: 'system', content: EXPLAIN_PROMPT },
            { role: 'user', content: `Page: ${pageState.title} (${pageState.url})\nQuestion: ${goal}\nElements:\n${elements}` }
        ];

        const response = await FP.sendMessage({
            type: 'OPENAI_REQUEST',
            data: { messages, maxTokens: MODE_CONFIG.ONBOARDING_EXPLAIN.maxTokens, reasoningEffort: 'low' }
        });

        if (!response.success) throw new Error(response.error || 'LLM request failed');
        return parseActionResponse(response.data);
    }

    // QA_TEXT mode: text answer only
    async function executeQA(goal, pageState) {
        const elements = (pageState.interactive_elements || [])
            .slice(0, 20)
            .map(el => `${el.tag} "${el.text || ''}" ${el.type || ''}`).join('\n');

        const messages = [
            { role: 'system', content: QA_PROMPT },
            { role: 'user', content: `Page: ${pageState.title} (${pageState.url})\nQuestion: ${goal}\nElements:\n${elements}` }
        ];

        const response = await FP.sendMessage({
            type: 'OPENAI_REQUEST',
            data: { messages, maxTokens: MODE_CONFIG.QA_TEXT.maxTokens, reasoningEffort: 'low' }
        });

        if (!response.success) throw new Error(response.error || 'LLM request failed');
        return parseActionResponse(response.data);
    }

    // ========== ORIGINAL planNextAction (for GOAL_GUIDE compatibility) ==========
    async function planNextAction(goal, pageState, history, screenshot, roadmap) {
        return executeGuide(goal, pageState, history, screenshot, roadmap);
    }

    // ========== PARSE RESPONSE ==========
    function parseActionResponse(raw) {
        try {
            return JSON.parse(raw);
        } catch {}

        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch {}
        }

        console.error('[Reflow] Failed to parse LLM response:', raw);
        return {
            status: 'BLOCKED',
            goal_complete: false,
            confidence: 0,
            reason_short: 'Failed to parse AI response',
            next_action: {
                type: 'BLOCKED',
                instruction_ko: 'AI 응답을 처리할 수 없습니다. 다시 시도해주세요.'
            },
            target_index: null
        };
    }

    // ========== DETERMINISTIC COMPLETION ==========
    function deterministicCompletion(goal) {
        const reasons = [];
        let score = 0;

        const url = location.href.toLowerCase();
        const body = (document.body.innerText || '').slice(0, 5000).toLowerCase();

        if (/완료|success|done|complete|finish|confirm/i.test(url)) {
            score += 0.25;
            reasons.push('url_hint');
        }
        if (/완료|성공적으로|등록되었습니다|처리되었습니다|저장되었습니다|정상적으로/i.test(body)) {
            score += 0.40;
            reasons.push('success_text_ko');
        }
        if (/successfully|has been saved|has been registered|completed/i.test(body)) {
            score += 0.35;
            reasons.push('success_text_en');
        }

        const toast = document.querySelector('[role="alert"], .toast, .snackbar, [class*="toast"], [class*="notification"]');
        if (toast) {
            const toastText = (toast.innerText || '').toLowerCase();
            if (/완료|성공|저장|등록|success|saved|done/i.test(toastText)) {
                score += 0.30;
                reasons.push('toast_success');
            }
        }

        return { done: score >= 0.65, score: Math.min(score, 1), reasons };
    }

    FP.Planner = {
        MODES,
        MODE_CONFIG,
        planNextAction,
        routeIntent,
        generateRoadmap,
        estimateComplexity,
        executeGuide,
        executeTour,
        executeExplain,
        executeQA,
        shouldCaptureScreenshot,
        parseActionResponse,
        deterministicCompletion,
        buildUserMessage
    };

    console.log('[Reflow] Planner loaded (v3.0 - ChatGPT Specialist)');
})();
