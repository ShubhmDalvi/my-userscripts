// ==UserScript==
// @name         Twitch Engine-Level Max Quality Locker
// @namespace    http://tampermonkey.net/
// @version      1.5.0
// @description  Directly commands the Amazon IVS Engine to lock the highest available quality tier.
// @author       You
// @match        https://www.twitch.tv/*
// @match        https://player.twitch.tv/*
// @grant        none
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/ShubhmDalvi/my-userscripts/main/Twitch-Engine-Level-Max-Quality-Locker.user.js
// @downloadURL  https://raw.githubusercontent.com/ShubhmDalvi/my-userscripts/main/Twitch-Engine-Level-Max-Quality-Locker.user.js
// ==/UserScript==

const mainWorldScript = `
(function () {
    "use strict";

    let manualOverride = false;

    // 1. Spoof tab activity to prevent background power-saving throttling
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: false });
    Object.defineProperty(document, 'hidden', { value: false, writable: false });

    const simulateVisibility = (e) => {
        if (e.type === 'visibilitychange') {
            e.stopImmediatePropagation();
        }
    };
    window.addEventListener('visibilitychange', simulateVisibility, true);
    document.addEventListener('visibilitychange', simulateVisibility, true);

    // 2. Core Watchdog: Target the Amazon IVS Player element engine directly
    const enforceEngineMaxQuality = () => {
        if (manualOverride) return;

        const videoEl = document.querySelector('video');
        if (!videoEl) return;

        let currentElement = videoEl;
        let playerInstance = null;

        // Traverse the React element map to pull the live player reference
        while (currentElement && !playerInstance) {
            const keys = Object.keys(currentElement);
            const reactKey = keys.find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));

            if (reactKey) {
                let fiberNode = currentElement[reactKey];
                while (fiberNode) {
                    if (fiberNode.memoizedProps && fiberNode.memoizedProps.mediaPlayerInstance) {
                        playerInstance = fiberNode.memoizedProps.mediaPlayerInstance;
                        break;
                    }
                    fiberNode = fiberNode.return;
                }
            }
            if (playerInstance) break;
            currentElement = currentElement.parentElement;
        }

        // Enforce the highest indexed tier track
        if (playerInstance && typeof playerInstance.getQualities === 'function') {
            const qualities = playerInstance.getQualities();
            if (qualities && qualities.length > 0) {
                const maxQuality = qualities[0]; // Index 0 is always top tier (Source/1080p)
                const currentQuality = playerInstance.getQuality();

                if (currentQuality && currentQuality.name !== maxQuality.name) {
                    console.log(\`[Twitch Max Quality] 🚀 Auto-restored engine output to maximum resolution: \${maxQuality.name}\`);
                    playerInstance.setQuality(maxQuality);
                }
            }
        }
    };

    // Run engine scan every 2 seconds (practically zero CPU consumption)
    setInterval(enforceEngineMaxQuality, 2000);

    // 3. Keep manual options functional if you consciously click the settings gear
    window.addEventListener('click', (e) => {
        if (e.target.closest('[data-a-target="player-settings-button"]') ||
            e.target.closest('[data-a-target="player-settings-menu"]')) {
            manualOverride = true;
            console.log("[Twitch Max Quality] ⚙️ Settings opened. Auto-lock suspended for this stream session.");
        }
    }, true);

    // Reset lock limits when navigating to a different channel
    let currentPath = location.pathname;
    setInterval(() => {
        if (location.pathname !== currentPath) {
            currentPath = location.pathname;
            manualOverride = false;
        }
    }, 1000);
})();
`;

const script = document.createElement('script');
script.textContent = mainWorldScript;
(document.head || document.documentElement).appendChild(script);
script.remove();