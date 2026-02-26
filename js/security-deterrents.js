/**
 * security-deterrents.js
 * 
 * Provides basic deterrents against casual source code inspection and DevTools usage.
 * NOTE: Absolute security of client-side code is impossible on the web.
 */

(function () {
    // 0. Access Control: Desktop Only Restricted
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 1024;
    const isDesktopOnlyPage = window.location.pathname.includes('desktop-only.html');

    if (isMobile && !isDesktopOnlyPage) {
        window.location.replace("desktop-only.html");
    }

    // 1. Disable Right-Click
    document.addEventListener('contextmenu', e => e.preventDefault(), false);

    // 2. Disable Keyboard Shortcuts
    document.onkeydown = function (e) {
        if (e.keyCode == 123) return false; // F12
        if (e.ctrlKey || e.metaKey) {
            if ([83, 85, 73, 74, 67].includes(e.keyCode)) {
                e.preventDefault();
                return false;
            }
        }
    };

    // 3. Robust DevTools Detection & Redirection
    (function () {
        const threshold = 160;
        const kick = () => {
            window.location.replace("desktop-only.html");
        };

        // Detection via Viewport Gap
        setInterval(() => {
            if (window.outerWidth - window.innerWidth > threshold || window.outerHeight - window.innerHeight > threshold) {
                kick();
            }
        }, 500);

        // Detection via Element Getter
        const element = new Image();
        Object.defineProperty(element, 'id', {
            get: function () { kick(); }
        });

        setInterval(() => {
            console.log(element);
            console.clear();
        }, 1000);
    })();

    // 4. Force Clear Console
    setInterval(() => {
        if (window.console && window.console.clear) console.clear();
    }, 1000);

    console.log("%cSecurity Active", "color: #6366f1; font-size: 20px; font-weight: bold;");
})();
