// Fox Pilot - Selector Engine
// Generates resilient CSS selectors and resolves elements from selector candidates

(function () {
    'use strict';
    const FP = window.FoxPilot;

    function cssEscape(val) {
        if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(val);
        return val.replace(/([^\w-])/g, '\\$1');
    }

    // Build multiple selector candidates for an element, ordered by reliability
    function buildCandidates(el) {
        const out = [];
        const h = el;
        const tag = el.tagName.toLowerCase();
        const id = (h.id || '').trim();
        const txt = (h.innerText || h.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
        const role = h.getAttribute('role') || '';
        const aria = h.getAttribute('aria-label') || '';
        const name = h.name || h.getAttribute('name') || '';
        const placeholder = h.getAttribute('placeholder') || '';

        // 1. ID selector (highest reliability)
        if (id && !/^\d+$/.test(id) && !id.includes(':')) {
            out.push({ strategy: 'css', value: `#${cssEscape(id)}`, score: 0.98 });
        }

        // 2. data-testid / data-test / data-qa
        for (const attr of ['data-testid', 'data-test', 'data-qa', 'data-cy']) {
            const v = h.getAttribute(attr);
            if (v) out.push({ strategy: 'css', value: `[${attr}="${cssEscape(v)}"]`, score: 0.95 });
        }

        // 3. aria-label
        if (aria) {
            out.push({ strategy: 'css', value: `${tag}[aria-label="${cssEscape(aria)}"]`, score: 0.90 });
        }

        // 4. name attribute
        if (name) {
            out.push({ strategy: 'css', value: `${tag}[name="${cssEscape(name)}"]`, score: 0.86 });
        }

        // 5. placeholder
        if (placeholder) {
            out.push({ strategy: 'css', value: `${tag}[placeholder="${cssEscape(placeholder)}"]`, score: 0.82 });
        }

        // 6. role + text
        if (role && txt) {
            out.push({ strategy: 'role_text', value: `${role}::${txt}`, score: 0.78 });
        }

        // 7. Text content only
        if (txt && txt.length >= 2) {
            out.push({ strategy: 'text', value: txt, score: 0.72 });
        }

        // 8. Tag + class fallback
        const classes = (h.className || '').toString().split(/\s+/)
            .filter(c => c && !/^\d/.test(c) && c.length < 40)
            .slice(0, 2);
        if (classes.length > 0) {
            const sel = `${tag}.${classes.map(c => cssEscape(c)).join('.')}`;
            out.push({ strategy: 'css', value: sel, score: 0.60 });
        }

        return out.slice(0, 5);
    }

    // Resolve an element from selector candidates (tries each in order)
    function resolveElement(candidates) {
        if (!candidates || candidates.length === 0) return null;

        for (const candidate of candidates) {
            try {
                let el = null;

                if (candidate.strategy === 'css') {
                    // Use querySelectorAll to find FIRST VISIBLE match
                    // (some sites duplicate elements for responsive layouts)
                    const allMatches = document.querySelectorAll(candidate.value);
                    for (const match of allMatches) {
                        if (FP.DomExtractor && FP.DomExtractor.isVisible(match)) {
                            el = match;
                            break;
                        }
                    }
                    if (!el) el = allMatches[0] || null;
                } else if (candidate.strategy === 'xpath') {
                    const result = document.evaluate(
                        candidate.value, document, null,
                        XPathResult.FIRST_ORDERED_NODE_TYPE, null
                    );
                    el = result.singleNodeValue;
                } else if (candidate.strategy === 'text') {
                    el = findByText(candidate.value);
                } else if (candidate.strategy === 'role_text') {
                    const [role, text] = candidate.value.split('::');
                    el = findByRoleAndText(role, text);
                }

                if (el && FP.DomExtractor && FP.DomExtractor.isVisible(el)) {
                    return { element: el, usedCandidate: candidate };
                }
            } catch (e) {
                // Selector syntax error, try next
                continue;
            }
        }

        return null;
    }

    // Find element by visible text content
    function findByText(target) {
        const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
        const t = norm(target);
        if (!t) return null;

        const interactiveSelector = 'button, a, [role="button"], input[type="button"], input[type="submit"], summary, label, li, span, div';
        const candidates = document.querySelectorAll(interactiveSelector);

        // Prefer exact match first
        for (const el of candidates) {
            const elText = norm(el.innerText || el.textContent || '');
            if (elText === t) return el;
        }

        // Then partial match (shortest containing element)
        let best = null;
        let bestLen = Infinity;
        for (const el of candidates) {
            const elText = norm(el.innerText || el.textContent || '');
            if (elText.includes(t) && elText.length < bestLen) {
                best = el;
                bestLen = elText.length;
            }
        }

        return best;
    }

    // Find element by role and text combination
    function findByRoleAndText(role, text) {
        const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();
        const t = norm(text);
        const selector = role ? `[role="${role}"]` : '*';
        const candidates = document.querySelectorAll(selector);

        for (const el of candidates) {
            const elText = norm(el.innerText || el.textContent || '');
            if (elText.includes(t)) return el;
        }
        return null;
    }

    FP.SelectorEngine = {
        buildCandidates,
        resolveElement,
        findByText,
        findByRoleAndText,
        cssEscape
    };

    console.log('[Reflow] SelectorEngine loaded');
})();
