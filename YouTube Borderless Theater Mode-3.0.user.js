// ==UserScript==
// @name         YouTube Borderless Theater Mode
// @namespace    https://tampermonkey.net/
// @version      3.0
// @description  Makes YouTube's native Theater Mode fill the entire browser tab (Twitch-style).
// @author       you
// @match        https://www.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  const ACTIVE_CLASS = 'ytbtm-active';

  const CSS = `
    /* ---------------------------------------------------------------
       1. Hide the top header/nav bar while in theater mode
       --------------------------------------------------------------- */
    html.${ACTIVE_CLASS} #masthead-container {
      display: none !important;
    }

    html.${ACTIVE_CLASS} #page-manager,
    html.${ACTIVE_CLASS} #content.ytd-app {
      margin-top: 0 !important;
    }

    /* ---------------------------------------------------------------
       2. Stretch the correct Theater Mode container to fill the tab
       ---------------------------------------------------------------
       In Theater Mode, the video lives in #full-bleed-container,
       NOT #player. We make this the fixed, 100vh/vw container. */
    html.${ACTIVE_CLASS} #full-bleed-container {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      max-width: 100vw !important;
      max-height: 100vh !important;
      z-index: 9999 !important;
      background: #000 !important;
    }

    /* ---------------------------------------------------------------
       3. Force all internal wrappers to inherit the 100% size
       --------------------------------------------------------------- */
    html.${ACTIVE_CLASS} #full-bleed-container #player-full-bleed-container,
    html.${ACTIVE_CLASS} #full-bleed-container #player-container,
    html.${ACTIVE_CLASS} #full-bleed-container ytd-player,
    html.${ACTIVE_CLASS} #full-bleed-container #container.ytd-player,
    html.${ACTIVE_CLASS} #full-bleed-container #movie_player,
    html.${ACTIVE_CLASS} #full-bleed-container .html5-video-container {
      width: 100% !important;
      height: 100% !important;
      max-width: 100% !important;
      max-height: 100% !important;
    }

    /* ---------------------------------------------------------------
       4. Make the video scale perfectly like Twitch
       --------------------------------------------------------------- */
    html.${ACTIVE_CLASS} video.html5-main-video {
      width: 100% !important;
      height: 100% !important;
      top: 0 !important;
      left: 0 !important;
      /* 'contain' ensures the video is as large as possible without
         cropping, automatically adding letterboxes if needed */
      object-fit: contain !important;
    }

    /* Hide the annoying "Cinematic Lighting" glow if the user has it enabled */
    html.${ACTIVE_CLASS} #cinematics-container {
      display: none !important;
    }

    /* ---------------------------------------------------------------
       5. Clean up the rest of the page layout
       --------------------------------------------------------------- */
    html.${ACTIVE_CLASS} #guide,
    html.${ACTIVE_CLASS} tp-yt-app-drawer#guide {
      display: none !important;
    }

    /* Push down everything else (comments, related videos) so they
       sit exactly below the 100vh player */
    html.${ACTIVE_CLASS} #columns {
      padding-top: 100vh !important;
    }

    html.${ACTIVE_CLASS} #primary,
    html.${ACTIVE_CLASS} #secondary {
      max-width: none !important;
    }

    html.${ACTIVE_CLASS},
    html.${ACTIVE_CLASS} body {
      overflow: hidden !important;
    }
  `;

  if (typeof GM_addStyle === 'function') {
    GM_addStyle(CSS);
  } else {
    const styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    document.documentElement.appendChild(styleEl);
  }

  /*
   * ---------------------------------------------------------------
   * JS Logic: Mirror 'theater' attribute and force window resizes
   * ---------------------------------------------------------------
   */
  function syncActiveClass(flexy) {
    const isTheater = flexy.hasAttribute('theater');
    document.documentElement.classList.toggle(ACTIVE_CLASS, isTheater);

    // YouTube's progress bar and controls rely on JS calculations.
    // Firing a few resize events ensures the controls span the new width.
    if (isTheater) {
      setTimeout(() => window.dispatchEvent(new Event('resize')), 10);
      setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
      setTimeout(() => window.dispatchEvent(new Event('resize')), 500);
    }
  }

  function watchForFlexy() {
    const flexy = document.querySelector('ytd-watch-flexy');
    if (!flexy) return false;

    syncActiveClass(flexy);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'theater') {
          syncActiveClass(flexy);
        }
      }
    });
    observer.observe(flexy, { attributes: true, attributeFilter: ['theater'] });
    return true;
  }

  let attached = watchForFlexy();
  const bootstrapObserver = new MutationObserver(() => {
    if (!attached) attached = watchForFlexy();
  });
  bootstrapObserver.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('yt-navigate-finish', () => {
    attached = watchForFlexy();
  });

  window.addEventListener('yt-navigate-start', () => {
    const flexy = document.querySelector('ytd-watch-flexy');
    if (!flexy || !document.contains(flexy)) {
      document.documentElement.classList.remove(ACTIVE_CLASS);
    }
  });
})();