// ==UserScript==
// @name         YouTube: Keep Video in Miniplayer on Back/Home
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Intercepts browser back button and home button clicks to send the video to the miniplayer.
// @author       You
// @match        *://*.youtube.com/*
// @exclude      *://*.youtube.com/tv*
// @exclude      *://*.youtube.com/embed/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Track the previous URL so we know if we came from a video
    let lastUrl = location.href;
    setInterval(() => { if (location.href !== lastUrl) lastUrl = location.href; }, 1000);

    const isWatchPage = (url) => url.includes('/watch');

    const isMiniplayerActive = () => {
        const miniplayer = document.querySelector('ytd-miniplayer');
        return miniplayer && miniplayer.hasAttribute('active');
    };

    const triggerMiniplayer = () => {
        document.body.dispatchEvent(new KeyboardEvent('keydown', {
            bubbles: true, cancelable: true, keyCode: 73, key: 'i', code: 'KeyI'
        }));
    };

    // ==========================================
    // 1. THE BROWSER BACK BUTTON (POPSTATE)
    // ==========================================
    window.addEventListener('popstate', (e) => {
    if (isWatchPage(lastUrl) && !isMiniplayerActive()) {
        // Only activate the miniplayer, do not block the back navigation
        triggerMiniplayer();
    }
}, true); // 'true' catches it first

    // ==========================================
    // 2. THE LOGO / HOME BUTTON CLICK
    // ==========================================
    let bypassClick = false;

    document.addEventListener('click', (e) => {
        const target = e.target;
        const clickedLogo = target.closest('a#logo, a.ytd-topbar-logo-renderer, ytd-topbar-logo-renderer');
        const clickedHomeTab = target.closest('ytd-guide-entry-renderer a[href="/"]');

        if ((clickedLogo || clickedHomeTab) && isWatchPage(location.href) && !isMiniplayerActive()) {
            if (bypassClick) {
                bypassClick = false;
                return;
            }

            e.preventDefault();
            e.stopImmediatePropagation();

            triggerMiniplayer();

            setTimeout(() => {
                bypassClick = true;
                if (clickedLogo) clickedLogo.click();
                else if (clickedHomeTab) clickedHomeTab.click();
            }, 150);
        }
    }, true);

})();
