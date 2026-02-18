// Reflow - ChatGPT Site Knowledge Base v2.0
// Comprehensive map of ChatGPT UI structure, verified selectors, and navigation paths
// All data-testid and aria-label values verified via Playwright analysis on 2026-02-19

(function () {
    'use strict';
    const FP = window.FoxPilot;

    // ========== VERIFIED DATA-TESTID SELECTORS ==========
    // These are actual data-testid attributes found in ChatGPT's DOM

    const TESTIDS = {
        // --- Global / Sidebar ---
        'model-switcher-dropdown-button': 'Model selector button (top banner)',
        'accounts-profile-button': 'Profile menu button (sidebar bottom)',
        'create-new-chat-button': 'New chat link (sidebar)',
        'sidebar-item-library': 'Images sidebar link',
        'close-sidebar-button': 'Close sidebar button',
        'apps-button': 'Apps sidebar link',
        'deep-research-sidebar-item': 'Deep research sidebar link',
        'explore-gpts-button': 'GPT store sidebar link',
        'chat-search': 'Chat search (Ctrl+K)',

        // --- Chat conversation ---
        'share-chat-button': 'Share chat button (top banner)',
        'conversation-options-button': 'Chat options menu (top banner)',
        'copy-turn-action-button': 'Copy message button',
        'good-response-turn-action-button': 'Thumbs up / good response',
        'bad-response-turn-action-button': 'Thumbs down / bad response',
        'history-item-N-options': 'Chat history item options (N=index)',
        'composer-plus-btn': 'File upload / attachment button',
        'send-button': 'Send message button',
        'stop-button': 'Stop generation button',

        // --- Settings ---
        'settings-menu-item': 'Settings menu item in profile dropdown',
        'close-button': 'Close dialog/modal button',

        // --- Images page ---
        'image-prompt-textarea': 'Image generation prompt input',
        'image-gallery-item': 'Image in gallery',
        'download-image-button': 'Download generated image'
    };

    // ========== VERIFIED ARIA-LABEL SELECTORS ==========
    const ARIA_LABELS = {
        // Korean labels (default when language is Korean)
        '사이드바 열기': 'Open sidebar',
        '사이드바 닫기': 'Close sidebar',
        '프로필 메뉴 열기': 'Open profile menu',
        '모델 선택기, 현재 모델은 5.2': 'Model selector (model name may vary)',
        '공유하기': 'Share button',
        '대화 옵션 열기': 'Chat/conversation options',
        '복사': 'Copy message',
        '메시지 편집': 'Edit message',
        '좋은 응답': 'Good response (thumbs up)',
        '별로인 응답': 'Bad response (thumbs down)',
        '모델 바꾸기': 'Switch model (in message actions)',
        '더 많은 액션': 'More actions (in message actions)',
        '출처': 'Sources (web search citations)',
        '파일 추가 및 기타': 'Add file / attachment',
        '음성 입력 버튼': 'Voice input',
        'Voice 시작': 'Start voice conversation',
        '프롬프트 보내기': 'Send prompt',
        '그룹 채팅 시작': 'Start group chat',
        '임시 채팅 켜기': 'Toggle temporary chat',
        '그룹 채팅 옵션 열기': 'Group chat options',
        '콘텐츠로 건너뛰기': 'Skip to content',
        '홈': 'Home button (sidebar top)',
        '닫기': 'Close (settings dialog)',

        // English fallback labels
        'sidebar': 'Sidebar toggle',
        'Send': 'Send button',
        'voice': 'Voice input',
        'Share': 'Share'
    };

    // ========== CHATGPT SITE MAP ==========
    const SITE_MAP = {
        home: {
            url: '/',
            description: 'ChatGPT home — start new conversations',
            key_elements: {
                chat_input: '[id="prompt-textarea"], textarea[placeholder*="물어보세요"], textarea[placeholder*="Ask"]',
                send_button: 'button[data-testid="send-button"], button[aria-label*="보내기"], button[aria-label*="Send"]',
                model_selector: 'button[data-testid="model-switcher-dropdown-button"]',
                sidebar_toggle: 'button[aria-label*="사이드바"]',
                new_chat: 'a[data-testid="create-new-chat-button"]',
                profile_menu: '[data-testid="accounts-profile-button"]',
                file_upload: 'button[data-testid="composer-plus-btn"]',
                voice_input: 'button[aria-label*="음성 입력"]',
                voice_start: 'button[aria-label="Voice 시작"]',
                temp_chat: 'button[aria-label*="임시 채팅"]',
                group_chat_start: 'button[aria-label*="그룹 채팅 시작"]',
                search_chats: '[data-testid="chat-search"], [aria-label*="채팅 검색"]'
            }
        },
        chat: {
            url: '/c/:id',
            description: 'Active chat conversation',
            key_elements: {
                chat_input: '[id="prompt-textarea"], textarea',
                send_button: 'button[data-testid="send-button"], button[aria-label*="보내기"]',
                stop_button: 'button[data-testid="stop-button"]',
                model_selector: 'button[data-testid="model-switcher-dropdown-button"]',
                share_button: 'button[data-testid="share-chat-button"]',
                conversation_options: 'button[data-testid="conversation-options-button"]',
                copy_message: 'button[data-testid="copy-turn-action-button"]',
                edit_message: 'button[aria-label="메시지 편집"]',
                good_response: 'button[data-testid="good-response-turn-action-button"]',
                bad_response: 'button[data-testid="bad-response-turn-action-button"]',
                switch_model: 'button[aria-label="모델 바꾸기"]',
                more_actions: 'button[aria-label="더 많은 액션"]',
                sources: 'button[aria-label="출처"]',
                file_upload: 'button[data-testid="composer-plus-btn"]',
                voice_input: 'button[aria-label*="음성 입력"]',
                profile_menu: '[data-testid="accounts-profile-button"]',
                // Message structure
                user_messages: '[data-message-author-role="user"]',
                assistant_messages: '[data-message-author-role="assistant"]',
                prose_content: '.markdown.prose',
                code_blocks: 'pre code',
                disclaimer: '[class*="text-token-text-secondary"]'
            }
        },
        gpt_editor: {
            url: '/gpts/editor',
            description: 'Create or edit a custom GPT',
            key_elements: {
                create_tab: 'radio[value="create"], label:has-text("만들기")',
                configure_tab: 'radio[value="configure"], label:has-text("구성")',
                gpt_name: 'input[placeholder*="GPT 이름"], input[placeholder*="GPT name"]',
                gpt_description: 'input[placeholder*="짧은 설명"], input[placeholder*="short description"]',
                gpt_instructions: 'textarea[placeholder*="용도"], textarea[placeholder*="purpose"]',
                conversation_starters: 'input[placeholder]',  // in starters section
                knowledge_upload: 'button:has-text("파일 업로드"), button:has-text("Upload files")',
                web_search_checkbox: 'input[type="checkbox"]:near-text("웹 검색")',
                canvas_checkbox: 'input[type="checkbox"]:near-text("캔버스")',
                image_gen_checkbox: 'input[type="checkbox"]:near-text("이미지 생성")',
                code_interpreter_checkbox: 'input[type="checkbox"]:near-text("코드 인터프리터")',
                create_action_button: 'button:has-text("새 작업 만들기")',
                save_button: 'button:has-text("만들기"), button:has-text("Create"), button:has-text("저장"), button:has-text("Save")',
                update_button: 'button:has-text("업데이트"), button:has-text("Update")',
                preview_button: 'button:has-text("미리 보기"), button:has-text("Preview")',
                model_dropdown: 'select, combobox',
                profile_icon_upload: 'button:has-text("Choose File")',
                preview_input: 'textarea[placeholder*="물어보세요"]',
                model_button: 'button:has-text("모델")'
            }
        },
        gpts: {
            url: '/gpts',
            description: 'GPT store — browse and discover GPTs',
            key_elements: {
                search_input: 'input[placeholder*="검색"], input[placeholder*="Search"]',
                gpt_cards: 'a[href^="/g/"]',
                explore_button: '[data-testid="explore-gpts-button"]'
            }
        },
        images: {
            url: '/images',
            description: 'Image generation with DALL-E',
            key_elements: {
                prompt_input: 'textarea[placeholder*="이미지를 설명"], textarea[placeholder*="Describe"]',
                send_button: 'button[aria-label*="보내기"], button[data-testid="send-button"]',
                file_upload: 'button[data-testid="composer-plus-btn"], button[aria-label*="파일"]',
                voice_input: 'button[aria-label*="음성 입력"]',
                gallery_items: 'button:has-text("나 추가하기")',
                image_title: 'h1:has-text("이미지")'
            }
        },
        deep_research: {
            url: '/deep-research',
            description: 'Deep research mode for comprehensive analysis',
            key_elements: {
                prompt_input: 'textarea[placeholder*="물어보세요"], textarea',
                send_button: 'button[data-testid="send-button"], button[aria-label*="보내기"]',
                file_upload: 'button[data-testid="composer-plus-btn"]'
            }
        },
        codex: {
            url: '/codex',
            description: 'Codex — code generation assistant',
            key_elements: {
                prompt_input: 'textarea',
                send_button: 'button[data-testid="send-button"]'
            }
        },
        apps: {
            url: '/apps',
            description: 'Connected apps and integrations',
            key_elements: {
                apps_list: '.apps-grid, [data-testid="apps-list"]'
            }
        },
        project: {
            url: '/g/g-p-:id/project',
            description: 'Project workspace for organized conversations',
            key_elements: {
                project_files: 'button:has-text("파일"), button:has-text("Files")',
                project_instructions: 'textarea[placeholder*="지침"]',
                project_chats: '.project-chat-list'
            }
        },
        group_chat: {
            url: '/gg/:id',
            description: 'Group chat with multiple participants',
            key_elements: {
                input: 'textarea',
                member_avatars: 'img[alt]',
                options_button: 'button[aria-label="그룹 채팅 옵션 열기"]'
            }
        },
        settings: {
            url: '/#settings',
            description: 'ChatGPT settings dialog',
            tabs: ['일반', '알림', '개인 맞춤 설정', '앱', '일정', '데이터 제어', '보안', '자녀 보호', '계정'],
            open_via: 'Profile menu → 설정',
            key_elements: {
                close_button: 'button[data-testid="close-button"], button[aria-label="닫기"]',
                tab_list: '[role="tablist"]',
                tab_items: '[role="tab"]',
                // General tab
                theme_select: 'combobox:near-text("보기")',
                accent_color: 'combobox:near-text("강조 컬러")',
                language_select: 'combobox:near-text("언어")',
                speech_language: 'combobox:near-text("발화 언어")',
                voice_select: 'combobox:near-text("음성")',
                voice_play: 'button:has-text("재생")',
                detached_voice: '[role="switch"][aria-label*="분리 Voice"]',
                extra_models: '[role="switch"][aria-label*="추가 모델"]',
                // Data controls tab
                export_data: 'button:has-text("내보내기"), button:has-text("Export")',
                delete_all_chats: 'button:has-text("모든 채팅 삭제"), button:has-text("Delete all")'
            }
        }
    };

    // ========== MODEL OPTIONS ==========
    const MODELS = {
        auto: 'Auto — 난이도에 따라 생각하는 시간 자동 조정',
        instant: 'Instant — 즉시 대답',
        thinking: 'Thinking — 좋은 답변을 위해 더 오래 생각',
        legacy: '레거시 모델 (GPT-4o, etc.)'
    };

    // ========== SIDEBAR ==========
    const SIDEBAR_ITEMS = [
        { label: '새 채팅', testid: 'create-new-chat-button', shortcut: 'Ctrl+Shift+O', url: '/' },
        { label: '채팅 검색', shortcut: 'Ctrl+K' },
        { label: '이미지', testid: 'sidebar-item-library', url: '/images' },
        { label: '앱', testid: 'apps-button', url: '/apps' },
        { label: '심층 리서치', testid: 'deep-research-sidebar-item', url: '/deep-research' },
        { label: 'Codex', url: '/codex' },
        { label: 'GPT', collapsible: true },
        { label: 'GPT 탐색', testid: 'explore-gpts-button', url: '/gpts' },
        { label: '프로젝트', collapsible: true },
        { label: '그룹 채팅', collapsible: true },
        { label: '내 채팅', collapsible: true }
    ];

    const SIDEBAR_SECTIONS = SIDEBAR_ITEMS.map(s => s.label);

    const PROFILE_MENU = [
        { label: '플랜 업그레이드', icon: true },
        { label: '개인 맞춤 설정', icon: true },
        { label: '설정', testid: 'settings-menu-item', icon: true },
        { label: '도움말', icon: true },
        { label: '로그아웃', icon: true }
    ];

    // ========== CHAT MESSAGE ACTION BUTTONS ==========
    // Buttons that appear on hover over each message
    const MESSAGE_ACTIONS = {
        user: [
            { label: '복사', testid: 'copy-turn-action-button' },
            { label: '메시지 편집', ariaLabel: '메시지 편집' }
        ],
        assistant: [
            { label: '복사', testid: 'copy-turn-action-button' },
            { label: '좋은 응답', testid: 'good-response-turn-action-button' },
            { label: '별로인 응답', testid: 'bad-response-turn-action-button' },
            { label: '공유하기', ariaLabel: '공유하기' },
            { label: '모델 바꾸기', ariaLabel: '모델 바꾸기' },
            { label: '더 많은 액션', ariaLabel: '더 많은 액션' },
            { label: '출처', ariaLabel: '출처' }
        ]
    };

    // ========== COMMON USER GOALS ==========
    const COMMON_GOALS = {
        create_gpt: {
            keywords: ['gpt 만들', 'gpt 생성', 'custom gpt', 'gpt create', 'gpt 만드는', '나만의 gpt', '커스텀 gpt'],
            start_url: '/gpts/editor',
            steps_hint: ['GPT 에디터 페이지 이동', '구성(Configure) 탭 선택', 'GPT 이름 입력', '설명(Description) 입력', '지침(Instructions) 작성', '기능 체크(웹검색/이미지생성 등)', '만들기(Create) 버튼 클릭']
        },
        change_model: {
            keywords: ['모델 변경', '모델 바꾸', 'change model', 'thinking 모드', '인스턴트', 'auto 모드', '모델 선택'],
            steps_hint: ['상단 모델 선택기(ChatGPT 5.2) 클릭', '원하는 모델 선택 (Auto/Instant/Thinking)']
        },
        settings: {
            keywords: ['설정', 'settings', '다크모드', 'dark mode', '테마', 'theme', '언어 변경', '음성 변경', '보기 모드'],
            steps_hint: ['좌측 하단 프로필 메뉴 클릭', '설정 메뉴 클릭', '원하는 탭 선택', '설정 변경']
        },
        image_gen: {
            keywords: ['이미지 생성', 'dall-e', '그림 그려', 'generate image', '이미지 만들', '사진 만들'],
            start_url: '/images',
            steps_hint: ['사이드바에서 이미지 클릭 (또는 /images 이동)', '프롬프트 입력란에 원하는 이미지 설명', '보내기 버튼 클릭', '결과 이미지 확인']
        },
        deep_research: {
            keywords: ['심층 리서치', 'deep research', '깊은 연구', '조사해줘', '리서치'],
            start_url: '/deep-research',
            steps_hint: ['사이드바에서 심층 리서치 클릭', '연구 주제 입력', '결과 대기 (수 분 소요)']
        },
        share_chat: {
            keywords: ['채팅 공유', 'share chat', '대화 공유', '링크 공유', '공유하기'],
            steps_hint: ['공유할 채팅 열기', '상단 공유하기 버튼 클릭', '공유 링크 복사']
        },
        memory: {
            keywords: ['메모리', 'memory', '기억', '저장된 정보', '맞춤 지침', 'custom instructions'],
            steps_hint: ['프로필 메뉴 클릭', '개인 맞춤 설정 클릭', '메모리/맞춤 지침 관리']
        },
        upload_file: {
            keywords: ['파일 업로드', 'upload file', '파일 첨부', '문서 분석', '이미지 분석', 'pdf 분석'],
            steps_hint: ['채팅 입력란 왼쪽의 + 버튼(파일 추가) 클릭', '파일 선택 또는 드래그', '프롬프트 입력 후 전송']
        },
        create_project: {
            keywords: ['프로젝트 만들', 'create project', '프로젝트 생성', '새 프로젝트'],
            steps_hint: ['사이드바에서 프로젝트 섹션 확장', '새 프로젝트 클릭', '프로젝트 이름/설정 입력']
        },
        voice: {
            keywords: ['음성 대화', 'voice', '말하기', '음성 입력', '보이스', '음성 모드'],
            steps_hint: ['채팅 입력란 우측의 Voice 시작 버튼 클릭', '마이크 접근 권한 허용', '음성으로 대화']
        },
        codex: {
            keywords: ['코덱스', 'codex', '코드 생성', '코드 작성'],
            start_url: '/codex',
            steps_hint: ['사이드바에서 Codex 클릭', '코드 관련 질문 입력', '결과 확인']
        },
        group_chat: {
            keywords: ['그룹 채팅', 'group chat', '그룹 대화', '같이 대화'],
            steps_hint: ['상단 그룹 채팅 시작 버튼 클릭', '참여자 초대', '대화 시작']
        },
        temp_chat: {
            keywords: ['임시 채팅', 'temporary chat', '기록 안남', '비공개 채팅'],
            steps_hint: ['상단 임시 채팅 켜기 버튼 클릭', '임시 모드에서 대화 (기록 미저장)']
        }
    };

    // ========== CSS CLASS PATTERNS ==========
    // ChatGPT uses Tailwind CSS with token-based color system
    const CSS_PATTERNS = {
        message_author: '[data-message-author-role]',
        prose_content: '.markdown.prose',
        code_block: 'pre > div > code, .code-block',
        loading: '.result-streaming, .animate-pulse',
        error: '.text-red-500, [class*="error"]',
        sidebar_item: '.__menu-item',
        sidebar_item_trailing: '.__menu-item-trailing-btn',
        composer_btn: '.composer-btn',
        composer_submit: '.composer-submit-button-color',
        token_text_primary: '.text-token-text-primary',
        token_text_secondary: '.text-token-text-secondary',
        token_surface_hover: '.hover\\:bg-token-surface-hover'
    };

    // ========== HELPER FUNCTIONS ==========

    function getCurrentPageContext() {
        const path = new URL(location.href).pathname;
        if (path === '/' || path === '') return { page: 'home', ...SITE_MAP.home };
        if (path.startsWith('/c/')) return { page: 'chat', ...SITE_MAP.chat };
        if (path.startsWith('/gpts/editor')) return { page: 'gpt_editor', ...SITE_MAP.gpt_editor };
        if (path.startsWith('/gpts')) return { page: 'gpts', ...SITE_MAP.gpts };
        if (path === '/images' || path === '/images/') return { page: 'images', ...SITE_MAP.images };
        if (path === '/deep-research') return { page: 'deep_research', ...SITE_MAP.deep_research };
        if (path === '/codex') return { page: 'codex', ...SITE_MAP.codex };
        if (path === '/apps') return { page: 'apps', ...SITE_MAP.apps };
        if (path.startsWith('/g/g-p-')) return { page: 'project', ...SITE_MAP.project };
        if (path.startsWith('/gg/')) return { page: 'group_chat', ...SITE_MAP.group_chat };
        if (location.href.includes('#settings')) return { page: 'settings', ...SITE_MAP.settings };
        if (path.startsWith('/g/')) return { page: 'gpt_chat', description: 'Chat with a custom GPT' };
        return { page: 'unknown', description: 'Unknown ChatGPT page' };
    }

    function matchGoalScenario(userGoal) {
        const goal = userGoal.toLowerCase();
        for (const [id, scenario] of Object.entries(COMMON_GOALS)) {
            for (const kw of scenario.keywords) {
                if (goal.includes(kw)) return { id, ...scenario };
            }
        }
        return null;
    }

    function generateSiteContext() {
        const ctx = getCurrentPageContext();
        const parts = [`SITE: ChatGPT (chatgpt.com)`, `PAGE: ${ctx.page} — ${ctx.description || ''}`];

        if (ctx.key_elements) {
            const els = Object.entries(ctx.key_elements)
                .map(([name, sel]) => `  ${name}: ${sel}`)
                .join('\n');
            parts.push(`KEY_SELECTORS:\n${els}`);
        }

        if (ctx.tabs) {
            parts.push('SETTINGS_TABS: ' + ctx.tabs.join(', '));
        }

        parts.push('SIDEBAR: ' + SIDEBAR_SECTIONS.join(', '));
        parts.push('PROFILE_MENU: ' + PROFILE_MENU.map(p => p.label).join(', '));
        parts.push('MODELS: ' + Object.entries(MODELS).map(([k, v]) => `${k}(${v})`).join(', '));

        // Message action buttons if on chat page
        if (ctx.page === 'chat') {
            parts.push('MSG_ACTIONS_USER: ' + MESSAGE_ACTIONS.user.map(a => a.label).join(', '));
            parts.push('MSG_ACTIONS_ASSISTANT: ' + MESSAGE_ACTIONS.assistant.map(a => a.label).join(', '));
        }

        return parts.join('\n');
    }

    // ========== EXPORT ==========
    FP.ChatGPTKnowledge = {
        TESTIDS,
        ARIA_LABELS,
        SITE_MAP,
        MODELS,
        SIDEBAR_ITEMS,
        SIDEBAR_SECTIONS,
        PROFILE_MENU,
        MESSAGE_ACTIONS,
        COMMON_GOALS,
        CSS_PATTERNS,
        getCurrentPageContext,
        matchGoalScenario,
        generateSiteContext
    };

    console.log('[Reflow] ChatGPT Knowledge Base v2.0 loaded');
})();
