// ── Shared Theme Manager ──────────────────────────────────────────────────────
// Injects a floating theme toggle button and syncs the theme across all pages.

(function () {
    // SVG icons
    const ICON_MOON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    const ICON_SUN  = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

    function applyTheme(theme) {
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }

    function updateBtn(btn, theme) {
        btn.innerHTML = theme === 'light' ? ICON_SUN : ICON_MOON;
        btn.title = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
    }

    function toggleTheme() {
        const current = localStorage.getItem('theme') || 'dark';
        const next = current === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', next);
        applyTheme(next);
        
        // Update floating button if it exists
        const floatBtn = document.getElementById('_themeBtn');
        if (floatBtn) updateBtn(floatBtn, next);
        
        // Update inline button if it exists
        const inlineBtn = document.getElementById('themeBtn');
        if (inlineBtn) updateBtn(inlineBtn, next);

        // Dispatch dynamic theme event for page scripts (e.g. Chart.js redraws)
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: next }));
    }

    // Apply immediately (before paint) to prevent flash of wrong theme
    const saved = localStorage.getItem('theme') || 'dark';
    applyTheme(saved);

    // Inject immediate CSS rule to prevent duplicate buttons under any condition
    const styleRule = document.createElement('style');
    styleRule.textContent = `
        body:has(#themeBtn) #_themeBtn,
        #themeBtn ~ #_themeBtn {
            display: none !important;
        }
    `;
    document.head.appendChild(styleRule);

    // Bulletproof interval to guarantee the floating button is hidden if an inline button is present
    setInterval(function() {
        if (document.getElementById('themeBtn')) {
            const floatBtn = document.getElementById('_themeBtn');
            if (floatBtn) {
                floatBtn.style.setProperty('display', 'none', 'important');
            }
        }
    }, 100);

    // Inject button after DOM ready
    document.addEventListener('DOMContentLoaded', function () {
        const inlineBtn = document.getElementById('themeBtn');
        
        if (inlineBtn) {
            // Home page: Only use the inline top-right button inside the card.
            // Do NOT inject the redundant floating button at the bottom-right.
            updateBtn(inlineBtn, saved);
            inlineBtn.onclick = toggleTheme;
            
            const floatBtn = document.getElementById('_themeBtn');
            if (floatBtn) {
                floatBtn.style.setProperty('display', 'none', 'important');
            }
        } else {
            // Sub-pages: Inject the beautiful floating theme toggle at the bottom-right.
            const style = document.createElement('style');
            style.textContent = `
                #_themeBtn {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 9999;
                    width: 46px;
                    height: 46px;
                    border-radius: 50%;
                    border: 1px solid rgba(255,255,255,0.15);
                    background: rgba(30,30,30,0.85);
                    color: #fff;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
                    transition: transform 0.25s, box-shadow 0.25s, background 0.3s;
                }
                [data-theme="light"] #_themeBtn {
                    border-color: rgba(0,0,0,0.12);
                    background: rgba(255,255,255,0.85);
                    color: #333;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                }
                #_themeBtn:hover {
                    transform: scale(1.12) rotate(15deg);
                    box-shadow: 0 6px 25px rgba(0,123,255,0.35);
                }
            `;
            document.head.appendChild(style);

            // Double check to prevent injection if themeBtn is present
            if (!document.getElementById('themeBtn')) {
                const btn = document.createElement('button');
                btn.id = '_themeBtn';
                btn.onclick = toggleTheme;
                updateBtn(btn, saved);
                document.body.appendChild(btn);
            }
        }
    });

    // Expose globally so inline onclick still works
    window.toggleTheme = toggleTheme;
})();
