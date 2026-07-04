// ==UserScript==
// @name         Twitch Engine-Level Max Quality Locker
// @namespace    http://tampermonkey.net/
// @version      1.6.0
// @description  Directly commands the Amazon IVS Engine to lock the highest available quality tier.
// @author       You
// @match        https://www.twitch.tv/*
// @match        https://player.twitch.tv/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

const mainWorldScript = `
(function () {
    "use strict";

    let desiredQualityName = null; // null = "always chase max"; otherwise a specific quality to defend
    let playerNotFoundCount = 0;
    let lastUserInteractionTime = 0;
    let pendingRequestName = null; // quality name we last asked the player for
    let pendingRequestTime = 0;    // when we asked for it

    // Track clicks on the settings gear / quality menu specifically — NOT any
    // click on the page. This is what lets us tell "you picked a quality" apart
    // from unrelated clicks (Next video, chat, sidebar, etc.) that happen to
    // land shortly before a quality mismatch is detected.
    const markUserInteraction = () => { lastUserInteractionTime = Date.now(); };
    window.addEventListener('click', (e) => {
        if (e.target.closest('[data-a-target="player-settings-button"]') ||
            e.target.closest('[data-a-target="player-settings-menu"]')) {
            markUserInteraction();
        }
    }, true);

    // 1. Spoof tab activity to prevent background power-saving throttling
    try {
        Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: false });
        Object.defineProperty(document, 'hidden', { value: false, writable: false });
    } catch (err) {
        console.warn('[Twitch Max Quality] ⚠️ Could not spoof visibility state:', err);
    }

    const simulateVisibility = (e) => {
        if (e.type === 'visibilitychange') {
            e.stopImmediatePropagation();
        }
    };
    window.addEventListener('visibilitychange', simulateVisibility, true);
    document.addEventListener('visibilitychange', simulateVisibility, true);

    // 2. Core Watchdog: Target the Amazon IVS Player element engine directly
    const enforceEngineMaxQuality = () => {
        try {
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

            if (!playerInstance || typeof playerInstance.getQualities !== 'function') {
                // Twitch's internals may have changed, or the player just isn't mounted yet.
                playerNotFoundCount++;
                if (playerNotFoundCount === 30) { // ~60s of consistent failures
                    console.warn('[Twitch Max Quality] ⚠️ Could not locate the player instance after repeated attempts. Twitch may have changed its player internals.');
                }
                return;
            }
            playerNotFoundCount = 0;

            const qualities = playerInstance.getQualities();
            if (!qualities || qualities.length === 0) return;

            // Pick the TRUE highest-bitrate tier rather than assuming index 0 is top.
            // Quality objects expose {bitrate, codecs, height, name, width}.
            const maxQuality = qualities.reduce(
                (best, q) => (q.bitrate > best.bitrate ? q : best),
                qualities[0]
            );

            // Resolve what we should currently be defending: max by default,
            // or the specific tier you manually picked (if it still exists in
            // this stream's quality list; falls back to max if not).
            let targetQuality = desiredQualityName
                ? (qualities.find(q => q.name === desiredQualityName) || maxQuality)
                : maxQuality;

            const currentQuality = playerInstance.getQuality();
            if (!currentQuality) return;

            // If we're already at the desired quality, nothing to do — and
            // clear any pending-request bookkeeping since we've confirmed it landed.
            if (currentQuality.name === targetQuality.name) {
                pendingRequestName = null;
                return;
            }

            const now = Date.now();
            const recentlyInteracted = (now - lastUserInteractionTime) < 5000;

            if (recentlyInteracted) {
                // A mismatch right after real input means YOU picked this quality
                // from the menu. Respect it and start defending it going forward.
                desiredQualityName = currentQuality.name;
                pendingRequestName = null;
                console.log(\`[Twitch Max Quality] 🖐️ Manual quality change detected. Now locking to and defending: \${currentQuality.name}\`);
                return;
            }

            // No recent input, so this mismatch is either an automatic change
            // (background data-saver, ad break) or our own previous request
            // still smoothly transitioning (IVS switches "at the end of the
            // current buffer" by default, which can take a few seconds).
            // Avoid re-issuing setQuality() for the same target repeatedly —
            // that can interrupt an in-flight smooth switch and prolong it.
            const alreadyRequestedRecently =
                pendingRequestName === targetQuality.name && (now - pendingRequestTime) < 8000;

            if (!alreadyRequestedRecently) {
                console.log(\`[Twitch Max Quality] 🚀 Restoring engine output to locked quality: \${targetQuality.name} (was \${currentQuality.name})\`);
                playerInstance.setQuality(targetQuality);
                pendingRequestName = targetQuality.name;
                pendingRequestTime = now;
            }
        } catch (err) {
            console.warn('[Twitch Max Quality] ⚠️ Error while enforcing quality:', err);
        }
    };

    // Run engine scan every 2 seconds (practically zero CPU consumption)
    setInterval(enforceEngineMaxQuality, 2000);

    // Reset lock state when navigating to a different channel/stream
    let currentPath = location.pathname;
    setInterval(() => {
        if (location.pathname !== currentPath) {
            currentPath = location.pathname;
            desiredQualityName = null;
            pendingRequestName = null;
            pendingRequestTime = 0;
            playerNotFoundCount = 0;
            lastUserInteractionTime = 0; // don't let the nav click itself look like a manual quality pick
        }
    }, 1000);
})();
`;

const script = document.createElement('script');
script.textContent = mainWorldScript;
(document.head || document.documentElement).appendChild(script);
script.remove();
