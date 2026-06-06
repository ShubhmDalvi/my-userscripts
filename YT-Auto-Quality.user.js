// ==UserScript==
// @name         YT Auto Quality
// @namespace    http://tampermonkey.net/
// @version      4.1.0
// @description  Forces YouTube video quality instantly using native video events.
// @author       You
// @match        https://www.youtube.com/*
// @match        https://music.youtube.com/*
// @grant        none
// @inject-into  page
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/ShubhmDalvi/my-userscripts/main/YT-Auto-Quality.user.js
// @downloadURL  https://raw.githubusercontent.com/ShubhmDalvi/my-userscripts/main/YT-Auto-Quality.user.js
// ==/UserScript==

(function () {
    "use strict";

    console.log("[YT Auto Quality] 🚀 Script successfully booted in the main page context!");

    // ─────────────────────────────────────────────────────────────────
    // ★ USER SETTINGS
    // ─────────────────────────────────────────────────────────────────
    const QUALITY_PREFERENCE = [
        "hd1080",   // try 1080p first
        "hd720",    // fall back to 720p
        "large",    // 480p
        "medium",   // 360p
        "small",    // 240p
        "tiny"      // 144p
    ];

    let currentVideoId = "";
    let isDoneForThisVideo = false;
    let manualOverride = false;

    // If you click the settings gear, we stop forcing the quality so you can change it yourself.
    document.addEventListener('click', (e) => {
        if (e.target.closest('.ytp-settings-menu') || e.target.closest('.ytp-settings-button')) {
            manualOverride = true;
            console.log("[YT Auto Quality] Settings opened. Manual override allowed for this video.");
        }
    }, true);

    function checkAndSetQuality() {
        const player = document.getElementById("movie_player");

        if (!player || typeof player.getVideoData !== 'function' || typeof player.getAvailableQualityLevels !== 'function') {
            return;
        }

        const videoData = player.getVideoData();
        const vid = videoData ? videoData.video_id : null;
        if (!vid) return;

        if (vid !== currentVideoId) {
            currentVideoId = vid;
            isDoneForThisVideo = false;
            manualOverride = false;
            console.log(`[YT Auto Quality] 🎬 New video detected: ${vid}`);
        }

        if (isDoneForThisVideo || manualOverride) return;

        const levels = player.getAvailableQualityLevels();
        if (!levels || levels.length <= 1) return;

        const target = QUALITY_PREFERENCE.find(q => levels.includes(q)) || levels[0];
        if (!target || target === 'auto') return;

        const current = player.getPlaybackQuality();

        if (current === target) {
            isDoneForThisVideo = true;
            console.log(`[YT Auto Quality] ✅ Successfully locked to ${target}`);
            return;
        }

        const state = player.getPlayerState();
        if (state !== 1 && state !== 3) return;

        try {
            if (typeof player.setPlaybackQualityRange === 'function') {
                player.setPlaybackQualityRange(target, target);
            }
            if (typeof player.setPlaybackQuality === 'function') {
                player.setPlaybackQuality(target);
            }
        } catch (e) {
            console.error("[YT Auto Quality] Error setting quality:", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // ★ THE OPTIMIZATION: INSTANT TRIGGERS
    // ─────────────────────────────────────────────────────────────────

    // 1. Fire instantly the exact millisecond the raw HTML5 video element loads or plays.
    // This eliminates the 400ms delay and catches the video on frame 1.
    document.addEventListener('playing', (e) => {
        if (e.target && e.target.tagName === 'VIDEO') checkAndSetQuality();
    }, true);

    document.addEventListener('loadeddata', (e) => {
        if (e.target && e.target.tagName === 'VIDEO') checkAndSetQuality();
    }, true);

    // 2. The safety net: Keep checking every 400ms just in case YouTube's
    //    custom player logic overrides our initial instant command.
    setInterval(checkAndSetQuality, 400);

})();