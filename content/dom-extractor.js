// Reflow - DOM Extractor v3.0
// Element registry, rich context, page meta, help text detection, ChatGPT-optimized

(function () {
    'use strict';
    const FP = window.FoxPilot;

    const INTERACTIVE_SELECTOR = [
        'a[href]', 'button', 'input', 'select', 'textarea',
        '[role="button"]', '[role="link"]', '[role="tab"]', '[role="menuitem"]',
        '[role="checkbox"]', '[role="radio"]', '[role="switch"]',
        '[onclick]', '[tabindex]:not([tabindex="-1"])',
        'summary', 'label[for]'
    ].join(', ');

    // Fox Pilot's own UI containers (to exclude from extraction)
    const FOX_CLASSES = ['fox-pilot-', 'foxpilot-'];

    // ========== ELEMENT REGISTRY ==========
    // Maps idx -> actual DOM element for guaranteed resolution
    let elementRegistry = new Map();
    let lastExtraction = null;

    function getElementByIndex(idx) {
        return elementRegistry.get(idx) || null;
    }

    function getLastExtraction() {
        return lastExtraction;
    }

    // ========== HELPERS ==========

    function isFoxElement(el) {
        let node = el;
        while (node && node !== document.body) {
            if (node.className && typeof node.className === 'string') {
                for (const cls of FOX_CLASSES) {
                    if (node.className.includes(cls)) return true;
                }
            }
            if (node.id && node.id.startsWith('fox-pilot')) return true;
            node = node.parentElement;
        }
        return false;
    }

    function isVisible(el) {
        if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.opacity === '0') return false;
        return true;
    }

    function isInViewport(el) {
        const rect = el.getBoundingClientRect();
        return (
            rect.top < window.innerHeight + 200 &&
            rect.bottom > -200 &&
            rect.left < window.innerWidth + 200 &&
            rect.right > -200
        );
    }

    function getLabel(el, maxLen = 80) {
        const attrs = ['aria-label', 'placeholder', 'title', 'alt', 'name'];
        for (const attr of attrs) {
            const val = el.getAttribute(attr);
            if (val && val.trim()) return val.trim().slice(0, maxLen);
        }
        const text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
        return text.slice(0, maxLen) || null;
    }

    function getInputValue(el) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
            return (el.value || '').slice(0, 50) || null;
        }
        return null;
    }

    // ========== PREDICTED ACTION ==========
    // Infer what will happen when this element is interacted with

    function predictAction(el) {
        const tag = el.tagName.toLowerCase();

        // Links with href
        if (tag === 'a' && el.href) {
            const isSameOrigin = el.origin === location.origin;
            const isAnchor = el.href.includes('#');
            if (isAnchor) return 'scroll_to_section';
            if (!isSameOrigin) return 'navigate_external';
            return 'navigate';
        }

        // Submit buttons
        if (el.type === 'submit' || (tag === 'button' && el.closest('form'))) {
            return 'submit_form';
        }

        // Expandable elements
        if (el.getAttribute('aria-expanded') !== null) {
            return el.getAttribute('aria-expanded') === 'true' ? 'collapse' : 'expand';
        }
        if (el.getAttribute('aria-haspopup')) {
            return 'open_popup';
        }

        // Tabs
        if (el.getAttribute('role') === 'tab') return 'switch_tab';
        if (el.getAttribute('role') === 'menuitem') return 'menu_action';

        // Checkboxes / radios / switches
        if (el.type === 'checkbox' || el.getAttribute('role') === 'checkbox') return 'toggle';
        if (el.type === 'radio' || el.getAttribute('role') === 'radio') return 'select_option';
        if (el.getAttribute('role') === 'switch') return 'toggle';

        // Input fields
        if (tag === 'input' || tag === 'textarea') return 'text_input';
        if (tag === 'select') return 'dropdown_select';

        // Summary (details/summary)
        if (tag === 'summary') return 'expand';

        // Generic clickable
        if (tag === 'button' || el.getAttribute('role') === 'button') return 'action';

        return 'click';
    }

    // ========== ARIA STATE EXTRACTION ==========

    function getAriaState(el) {
        const state = {};
        const ariaAttrs = [
            'aria-expanded', 'aria-selected', 'aria-checked',
            'aria-pressed', 'aria-hidden', 'aria-disabled',
            'aria-required', 'aria-invalid', 'aria-haspopup',
            'aria-current'
        ];
        for (const attr of ariaAttrs) {
            const val = el.getAttribute(attr);
            if (val !== null) {
                // Shorten key: aria-expanded -> expanded
                state[attr.replace('aria-', '')] = val;
            }
        }
        return Object.keys(state).length > 0 ? state : null;
    }

    // ========== FORM CONTEXT ==========

    function getFormContext(el) {
        const form = el.closest('form');
        if (!form) return null;

        // Find the label for this element
        let label = null;
        if (el.id) {
            const labelEl = form.querySelector(`label[for="${el.id}"]`);
            if (labelEl) label = labelEl.textContent.trim().slice(0, 60);
        }
        if (!label && el.labels && el.labels.length > 0) {
            label = el.labels[0].textContent.trim().slice(0, 60);
        }

        return {
            formName: form.name || form.getAttribute('aria-label') || null,
            formAction: form.action ? new URL(form.action, location.href).pathname : null,
            label: label,
            required: el.required || el.getAttribute('aria-required') === 'true',
            pattern: el.pattern || null,
            autocomplete: el.autocomplete || null
        };
    }

    // ========== LANDMARK DETECTION ==========

    function findLandmark(el) {
        const landmarkMap = {
            'HEADER': 'banner', 'NAV': 'navigation', 'MAIN': 'main',
            'ASIDE': 'complementary', 'FOOTER': 'contentinfo',
            'SECTION': 'region', 'FORM': 'form'
        };
        let node = el;
        while (node && node !== document.body) {
            const role = node.getAttribute('role');
            if (role && ['banner', 'navigation', 'main', 'complementary',
                'contentinfo', 'search', 'form', 'region'].includes(role)) {
                return role;
            }
            if (landmarkMap[node.tagName]) {
                return landmarkMap[node.tagName];
            }
            node = node.parentElement;
        }
        return null;
    }

    // ========== PAGE STRUCTURE ==========

    function extractPageStructure() {
        // Heading hierarchy
        const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
            .filter(h => isVisible(h))
            .slice(0, 15)
            .map(h => ({
                level: parseInt(h.tagName[1]),
                text: h.textContent.trim().replace(/\s+/g, ' ').slice(0, 80)
            }));

        // Landmarks
        const landmarkEls = document.querySelectorAll(
            'header, nav, main, aside, footer, [role="banner"], [role="navigation"], ' +
            '[role="main"], [role="complementary"], [role="contentinfo"], [role="search"]'
        );
        const landmarks = [...landmarkEls]
            .filter(el => isVisible(el))
            .slice(0, 10)
            .map(el => ({
                role: el.getAttribute('role') || findLandmark(el) || el.tagName.toLowerCase(),
                label: el.getAttribute('aria-label') || null
            }));

        // Active modals/dialogs
        const dialogs = [...document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"]')]
            .filter(el => isVisible(el))
            .map(el => ({
                label: el.getAttribute('aria-label') || el.querySelector('h1,h2,h3')?.textContent?.trim()?.slice(0, 60) || 'dialog'
            }));

        // Error messages
        const errors = [...document.querySelectorAll('[role="alert"], .error, .alert-danger, [class*="error-message"]')]
            .filter(el => isVisible(el) && el.textContent.trim())
            .slice(0, 3)
            .map(el => el.textContent.trim().slice(0, 100));

        return { headings, landmarks, dialogs, errors };
    }

    // ========== HELP TEXT DETECTION ==========
    // Finds contextual help/hint text associated with an element

    function getHelpText(el) {
        const hints = [];

        // 1. aria-describedby
        const describedBy = el.getAttribute('aria-describedby');
        if (describedBy) {
            for (const id of describedBy.split(/\s+/)) {
                const descEl = document.getElementById(id);
                if (descEl) {
                    const text = descEl.textContent.trim().slice(0, 100);
                    if (text) hints.push(text);
                }
            }
        }

        // 2. Adjacent help/hint text (sibling or parent's child)
        const parent = el.parentElement;
        if (parent) {
            const helpEl = parent.querySelector(
                '.help-text, .hint, .form-text, [class*="help-block"], [class*="hint"], small.text-muted'
            );
            if (helpEl && helpEl !== el) {
                const text = helpEl.textContent.trim().slice(0, 100);
                if (text && !hints.includes(text)) hints.push(text);
            }
        }

        // 3. title attribute (if not already used as label)
        const title = el.getAttribute('title');
        const ariaLabel = el.getAttribute('aria-label');
        if (title && title !== ariaLabel && title !== el.textContent?.trim()) {
            if (!hints.includes(title)) hints.push(title.slice(0, 80));
        }

        return hints.length > 0 ? hints.join(' | ').slice(0, 150) : null;
    }

    // ========== PAGE META CONTEXT ==========
    // Extracts site-level metadata that helps LLM understand the page

    function extractPageMeta() {
        const meta = {};

        // Meta description
        const descEl = document.querySelector('meta[name="description"]');
        if (descEl?.content) meta.description = descEl.content.trim().slice(0, 200);

        // Open Graph
        const ogTitle = document.querySelector('meta[property="og:title"]');
        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogTitle?.content) meta.og_title = ogTitle.content.trim().slice(0, 100);
        if (ogDesc?.content && !meta.description) meta.description = ogDesc.content.trim().slice(0, 200);

        // Breadcrumbs
        const bcEl = document.querySelector(
            '[aria-label*="breadcrumb" i], [class*="breadcrumb" i], nav.breadcrumb, ol.breadcrumb'
        );
        if (bcEl) {
            const items = [...bcEl.querySelectorAll('a, span, li')]
                .map(el => el.textContent.trim())
                .filter(t => t && t.length > 0 && t.length < 50);
            // Deduplicate adjacent duplicates from nested elements
            const deduped = items.filter((t, i) => i === 0 || t !== items[i - 1]);
            if (deduped.length > 1) meta.breadcrumb = deduped.slice(0, 6);
        }

        // JSON-LD structured data
        const jsonLdEl = document.querySelector('script[type="application/ld+json"]');
        if (jsonLdEl) {
            try {
                const data = JSON.parse(jsonLdEl.textContent);
                const item = Array.isArray(data) ? data[0] : data;
                if (item['@type']) meta.schema_type = item['@type'];
                if (item.name) meta.schema_name = item.name.slice(0, 80);
            } catch {}
        }

        // Primary navigation (site menu overview)
        const mainNav = document.querySelector(
            'nav[aria-label*="main" i], nav[aria-label*="주" i], nav[aria-label*="메뉴" i], header nav'
        );
        if (mainNav) {
            const navLinks = [...mainNav.querySelectorAll(':scope > ul > li > a, :scope > a, :scope > ul > li > button')]
                .filter(a => isVisible(a))
                .slice(0, 8)
                .map(a => (a.textContent || '').trim().slice(0, 30))
                .filter(t => t);
            if (navLinks.length > 1) meta.site_sections = navLinks;
        }

        return Object.keys(meta).length > 0 ? meta : null;
    }

    // ========== MAIN EXTRACTION ==========

    function extractPageState(maxNodes = 60) {
        // Reset element registry
        elementRegistry = new Map();

        const elements = document.querySelectorAll(INTERACTIVE_SELECTOR);
        const viewportNodes = [];
        const offscreenNodes = [];
        const MAX_OFFSCREEN = 10;

        for (const el of elements) {
            if (viewportNodes.length + Math.min(offscreenNodes.length, MAX_OFFSCREEN) >= maxNodes) break;
            if (isFoxElement(el)) continue;
            if (!isVisible(el)) continue;

            const rect = el.getBoundingClientRect();
            const tag = el.tagName.toLowerCase();
            const label = getLabel(el);
            const inVP = isInViewport(el);

            const node = {
                idx: 0, // assigned after sort
                tag,
                role: el.getAttribute('role') || undefined,
                type: el.getAttribute('type') || undefined,
                text: label,
                name: el.getAttribute('name') || undefined,
                placeholder: el.getAttribute('placeholder') || undefined,
                href: tag === 'a' ? (el.getAttribute('href') || '').slice(0, 120) : undefined,
                value: getInputValue(el),
                enabled: !el.disabled && !el.getAttribute('aria-disabled'),
                in_viewport: inVP,
                predicted_action: predictAction(el),
                aria: getAriaState(el),
                form: getFormContext(el),
                landmark: findLandmark(el),
                help: getHelpText(el),
                _element: el // temporary, removed before sending
            };

            if (inVP) {
                viewportNodes.push({ node, y: rect.top });
            } else if (offscreenNodes.length < MAX_OFFSCREEN) {
                offscreenNodes.push({ node, y: rect.top });
            }
        }

        // Sort by vertical position, viewport first
        viewportNodes.sort((a, b) => a.y - b.y);
        offscreenNodes.sort((a, b) => a.y - b.y);
        const allNodes = [...viewportNodes, ...offscreenNodes];

        // Assign sequential indices and register elements
        const nodes = allNodes.map((item, i) => {
            item.node.idx = i;
            elementRegistry.set(i, item.node._element);
            delete item.node._element;
            return item.node;
        });

        // Detect potential success messages
        const bodyText = (document.body.innerText || '').slice(0, 3000);
        const successPatterns = /완료|성공|등록되었|처리되었|저장되었|success|done|completed|saved|registered/gi;
        const successMatches = bodyText.match(successPatterns) || [];

        // Page structure + meta
        const structure = extractPageStructure();
        const meta = extractPageMeta();

        lastExtraction = {
            url: location.href,
            title: document.title,
            lang: document.documentElement.lang || 'unknown',
            loading: document.readyState !== 'complete',
            viewport: { w: window.innerWidth, h: window.innerHeight },
            interactive_elements: nodes,
            structure: structure,
            meta: meta,
            success_text_candidates: [...new Set(successMatches)].slice(0, 5)
        };

        return lastExtraction;
    }

    // ========== DOM SNAPSHOT FOR DIFF ==========

    function takeSnapshot() {
        const inputs = {};
        document.querySelectorAll('input, textarea, select').forEach(el => {
            const key = el.id || el.name || el.getAttribute('aria-label');
            if (key) inputs[key] = el.value;
        });

        return {
            url: location.href,
            title: document.title,
            inputs,
            visibleText: (document.body.innerText || '').slice(0, 2000),
            alertCount: document.querySelectorAll('[role="alert"]').length,
            dialogOpen: !!document.querySelector('dialog[open], [role="dialog"]'),
            ts: Date.now()
        };
    }

    function diffSnapshots(before, after) {
        const changes = [];

        if (before.url !== after.url) {
            changes.push(`URL changed: ${before.url} → ${after.url}`);
        }
        if (before.title !== after.title) {
            changes.push(`Title changed: "${before.title}" → "${after.title}"`);
        }
        if (before.dialogOpen !== after.dialogOpen) {
            changes.push(after.dialogOpen ? 'Dialog opened' : 'Dialog closed');
        }
        if (after.alertCount > before.alertCount) {
            changes.push('New alert/notification appeared');
        }

        // Check input value changes
        for (const [key, val] of Object.entries(after.inputs)) {
            if (before.inputs[key] !== val) {
                changes.push(`Input "${key}" changed`);
            }
        }

        // Check for new text (success/error messages)
        const newText = after.visibleText.slice(0, 500);
        const oldText = before.visibleText.slice(0, 500);
        if (newText !== oldText) {
            const successHit = /완료|성공|등록|처리|저장|success|done|saved/i.test(newText);
            const errorHit = /오류|에러|실패|error|fail|invalid/i.test(newText);
            if (successHit) changes.push('Success message detected');
            if (errorHit) changes.push('Error message detected');
            if (!successHit && !errorHit && Math.abs(newText.length - oldText.length) > 200) {
                changes.push('Significant content change');
            }
        }

        return changes.length > 0 ? changes : ['No significant change detected'];
    }

    // ========== SCREENSHOT ==========

    async function captureScreenshot() {
        if (typeof html2canvas === 'undefined') return null;
        try {
            const canvas = await html2canvas(document.body, {
                scale: 0.4,
                logging: false,
                useCORS: true,
                ignoreElements: (el) => {
                    if (el.id && el.id.startsWith('fox-pilot')) return true;
                    if (el.className && typeof el.className === 'string' && el.className.includes('fox-pilot')) return true;
                    return false;
                },
                onclone: (doc) => {
                    doc.querySelectorAll('*').forEach(el => {
                        try {
                            const computed = getComputedStyle(el);
                            ['color', 'backgroundColor', 'borderColor'].forEach(prop => {
                                const value = computed[prop];
                                if (value && /\b(lab|lch|oklch|oklab)\s*\(/i.test(value)) {
                                    el.style[prop] = prop === 'backgroundColor' ? '#ffffff' : '#333333';
                                }
                            });
                        } catch {}
                    });
                }
            });
            return canvas.toDataURL('image/jpeg', 0.5);
        } catch (e) {
            console.warn('[Reflow] Screenshot capture failed:', e);
            return null;
        }
    }

    FP.DomExtractor = {
        extractPageState,
        extractPageMeta,
        captureScreenshot,
        getElementByIndex,
        getLastExtraction,
        takeSnapshot,
        diffSnapshots,
        isVisible,
        isFoxElement,
        getLabel,
        getHelpText
    };

    console.log('[Reflow] DomExtractor loaded (v3.0 - ChatGPT Optimized)');
})();
