// ==UserScript==
// @name         YT Auto Quality (Optimized)
// @namespace    http://tampermonkey.net/
// @version      4.2.0
// @description  Forces preferred YouTube video quality with continuous locking and manual override detection.
// @author       You
// @match        https://www.youtube.com/*
// @match        https://music.youtube.com/*
// @grant        none
// @inject-into  page
// @run-at       document-start
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
    let manualOverride = false;

    // ─────────────────────────────────────────────────────────────────
    // ★ MANUAL QUALITY OVERRIDE
    //
    // Opening Settings or opening the Quality submenu does NOT disable
    // the script.
    //
    // Only an actual quality selection (menuitemradio) does.
    // This applies only to the current video.
    // ─────────────────────────────────────────────────────────────────

    document.addEventListener("click", (e) => {
        const item = e.target?.closest?.(
    '.ytp-menuitem[role="menuitemradio"]'
);

if (!item) return;

const selected = (item.innerText || "")
    .replace(/\s+/g, " ")
    .trim();

// Only treat actual YouTube quality choices as manual overrides.
// Examples: Auto, 144p, 240p, 360p, 480p, 720p, 1080p, 1440p, 2160p...
const isQualitySelection =
    selected === "Auto" ||
    /^\d{3,4}p(?:\s*\(.*\))?$/.test(selected);

if (!isQualitySelection) return;

        const player = document.getElementById("movie_player");
        if (!player || typeof player.getVideoData !== "function") return;

        const videoId = player.getVideoData()?.video_id;
        if (!videoId) return;

        // Only override for the current video.
        if (videoId !== currentVideoId) {
            currentVideoId = videoId;
            manualOverride = false;
        }

        manualOverride = true;

        

        console.log(
            `[YT Auto Quality] 👤 Manual quality selection detected: ${selected}. ` +
            `Automatic locking disabled for this video.`
        );
    }, true);

    // ─────────────────────────────────────────────────────────────────
    // ★ QUALITY ENFORCEMENT
    // ─────────────────────────────────────────────────────────────────

    function checkAndSetQuality() {
        const player = document.getElementById("movie_player");

        if (!player || typeof player.getVideoData !== "function") {
            return;
        }

        let videoData;

        try {
            videoData = player.getVideoData();
        } catch {
            return;
        }

        const vid = videoData?.video_id;
        if (!vid) return;

        // New video = reset manual override.
        if (vid !== currentVideoId) {
            currentVideoId = vid;
            manualOverride = false;

            console.log(
                `[YT Auto Quality] 🎬 New video detected: ${vid}. ` +
                `Automatic quality locking enabled.`
            );
        }

        // User explicitly selected a quality for this video.
        if (manualOverride) return;

        let levels;

        try {
            levels = player.getAvailableQualityLevels?.();
        } catch {
            return;
        }

        if (!levels || !levels.length) return;

        const target =
            QUALITY_PREFERENCE.find(q => levels.includes(q)) ||
            levels[0];

        if (!target || target === "auto") return;

        let current = "";
        let label = "";

        try {
            current = player.getPlaybackQuality?.() || "";
        } catch {
            return;
        }

        try {
            label = player.getPlaybackQualityLabel?.() || "";
        } catch {}

        const isAutoMode =
            typeof label === "string" &&
            label.toLowerCase().includes("auto");

        // Already at the desired fixed quality.
        // Nothing to do this cycle.
        if (current === target && !isAutoMode) {
            return;
        }

        // Don't interfere with ended or paused videos.
        let state;

        try {
            state = player.getPlayerState?.();
        } catch {
            state = null;
        }

        if (state === 0 || state === 2) {
            return;
        }

        try {
            if (typeof player.setPlaybackQualityRange === "function") {
                player.setPlaybackQualityRange(target, target);
            }

            if (typeof player.setPlaybackQuality === "function") {
                player.setPlaybackQuality(target);
            }

            console.log(
                `[YT Auto Quality] 🔒 Enforcing ${target} ` +
                `(current: ${current || "unknown"}, label: ${label || "unknown"})`
            );
        } catch (e) {
            console.error(
                "[YT Auto Quality] Error setting quality:",
                e
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // ★ INSTANT TRIGGERS
    // ─────────────────────────────────────────────────────────────────

    document.addEventListener("playing", (e) => {
        if (e.target?.tagName === "VIDEO") {
            checkAndSetQuality();
        }
    }, true);

    document.addEventListener("loadeddata", (e) => {
        if (e.target?.tagName === "VIDEO") {
            checkAndSetQuality();
        }
    }, true);

    // ─────────────────────────────────────────────────────────────────
    // ★ CONTINUOUS LOCK
    //
    // Cheap reconciliation loop:
    // - If quality is already correct → returns immediately.
    // - If YouTube changes quality → next cycle detects it and restores
    //   the preferred quality.
    // - If user manually selects a quality → manualOverride stops all
    //   further enforcement for this video.
    // ─────────────────────────────────────────────────────────────────

    setInterval(checkAndSetQuality, 400);

})();
