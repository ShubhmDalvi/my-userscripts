// ==UserScript==
// @name         YouTube Music Tab Fullscreen & Auto-Hide Controls
// @namespace    https://tampermonkey.net/
// @version      2.1
// @description  Double-click the player for tab-fullscreen (Theater Mode) with auto-hiding controls. The native fullscreen button now triggers true browser fullscreen instead.
// @author       you
// @match        https://music.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=music.youtube.com
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // Disable "Leave site?" confirm dialogs on exit
  window.addEventListener('beforeunload', (e) => {
    e.stopImmediatePropagation();
  }, true);
  Object.defineProperty(window, 'onbeforeunload', {
    get() { return null; },
    set() {}
  });

  const ACTIVE_CLASS = 'ytm-theater-active';
  const IDLE_CLASS = 'ytm-idle';
  const PARENT_CLEAN_CLASS = 'ytm-parent-clean';
  let isTheater = false;
  let idleTimer = null;
  let isMouseOverControls = false;
  let originalNavBarHeight = null;

  const CSS = `
    /* ---------------------------------------------------------------
       1. Hide All Header-Related DOM Elements
       --------------------------------------------------------------- */
    html.${ACTIVE_CLASS} #nav-bar-background,
    html.${ACTIVE_CLASS} #nav-bar-divider,
    html.${ACTIVE_CLASS} ytmusic-nav-bar,
    html.${ACTIVE_CLASS} #mini-guide,
    html.${ACTIVE_CLASS} tp-yt-app-drawer,
    html.${ACTIVE_CLASS} #guide,
    html.${ACTIVE_CLASS} ytmusic-guide-renderer,
    html.${ACTIVE_CLASS} #player-bar-background {
      display: none !important;
    }

    html.${ACTIVE_CLASS} .side-panel.ytmusic-player-page {
      display: none !important;
    }

    /* Hide the top-right minimize/maximize/close buttons entirely */
    html.${ACTIVE_CLASS} ytmusic-player .player-minimize-button,
    html.${ACTIVE_CLASS} ytmusic-player .player-maximize-button,
    html.${ACTIVE_CLASS} ytmusic-player .player-close-button {
      display: none !important;
    }

    /* Fullscreen button is no longer needed in theater mode (double-click
       toggles theater mode now, and the native button does true fullscreen
       instead), so just hide it completely while theater mode is active. */
    html.${ACTIVE_CLASS} ytmusic-player .fullscreen-button {
      display: none !important;
    }

    /* Reclaim the 72px space reserved for the left sidebar guide */
    html.${ACTIVE_CLASS} ytmusic-app-layout {
      --ytmusic-guide-width: 0px !important;
    }

    html.${ACTIVE_CLASS} ytmusic-player-page {
      width: 100vw !important;
      max-width: 100vw !important;
      height: 100vh !important;
    }

    /* ---------------------------------------------------------------
       2. Clean parent layouts dynamically
       ---------------------------------------------------------------
       Strips transform, contain, and will-change from all parent wrappers
       holding the fixed player container so it can snap to absolute top (0px). */
    .${PARENT_CLEAN_CLASS} {
      transform: none !important;
      contain: none !important;
      will-change: auto !important;
    }

    /* ---------------------------------------------------------------
       3. Stretch & Center the Player
       --------------------------------------------------------------- */
    html.${ACTIVE_CLASS} ytmusic-player {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      margin: 0 !important;
      padding: 0 !important;
      z-index: 100 !important;
      background: #000 !important;

      /* Use flexbox to center both videos and album art perfectly */
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }

	html.${ACTIVE_CLASS} ytmusic-player-page #player.ytmusic-player-page,
html.${ACTIVE_CLASS} ytmusic-player#player {
  max-width: 100vw !important;
}

    /* Keep the album art at its native responsive centered square layout */
    html.${ACTIVE_CLASS} ytmusic-player #song-image {
  margin: auto !important;
  padding-top: 0 !important;
  width: min(100vw, 100vh) !important;
  height: min(100vw, 100vh) !important;
  max-width: 100vh !important;
  max-height: 100vh !important;
}

    /* Force all video wrappers to scale and fill the fixed parent */
    html.${ACTIVE_CLASS} ytmusic-player #movie_player,
    html.${ACTIVE_CLASS} ytmusic-player .html5-video-container,
    html.${ACTIVE_CLASS} ytmusic-player #song-video,
    html.${ACTIVE_CLASS} ytmusic-player video {
      width: 100% !important;
      height: 100% !important;
      max-width: 100% !important;
      max-height: 100% !important;
      top: 0 !important;
      left: 0 !important;
      object-fit: contain !important;
      background: #000 !important;
    }

    /* ---------------------------------------------------------------
       4. Position & Style Bottom Player Controls (Traditional Fullscreen Look)
       --------------------------------------------------------------- */
    html.${ACTIVE_CLASS} ytmusic-player-bar {
      position: fixed !important;
      bottom: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      margin: 0 !important;
      padding: 0 16px 8px 16px !important; /* Clean floating padding */
      box-sizing: border-box !important;
      z-index: 1000 !important;
      transform: translateY(0px) !important; /* Force neutral offset when active */
      transition: opacity 0.4s ease, transform 0.4s ease !important;

      /* Smooth transparent gradient so video bleeds through underneath */
      background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 60%, transparent 100%) !important;
      border: none !important;
    }

html.${ACTIVE_CLASS} ytmusic-player #song-image {
  position: relative !important;
}

html.${ACTIVE_CLASS} ytmusic-player #song-image #thumbnail,
html.${ACTIVE_CLASS} ytmusic-player #song-image yt-img-shadow,
html.${ACTIVE_CLASS} ytmusic-player #song-image img {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 100% !important;
  height: 100% !important;
  object-fit: contain !important;
}

    /* Smooth Slide-down Hide when Idle (bottom bar) */
    html.${ACTIVE_CLASS}.${IDLE_CLASS} ytmusic-player-bar {
      opacity: 0 !important;
      pointer-events: none !important;
      transform: translateY(40px) !important;
    }

    html.${ACTIVE_CLASS}.${IDLE_CLASS},
    html.${ACTIVE_CLASS}.${IDLE_CLASS} ytmusic-player {
      cursor: none !important;
    }

    /* Completely lock page scroll */
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

  /* ---------------------------------------------------------------
     JS Logic: Toggle Theater Mode & Handle Auto-Hide
     --------------------------------------------------------------- */

  function updateNavBarHeight(enable) {
    const layout = document.querySelector('ytmusic-app-layout');
    if (!layout) return;

    if (enable) {
      // Store the original layout value before modifying it
      if (originalNavBarHeight === null) {
        originalNavBarHeight = layout.style.getPropertyValue('--ytmusic-nav-bar-height') ||
                               window.getComputedStyle(layout).getPropertyValue('--ytmusic-nav-bar-height').trim() ||
                               '64px';
      }
      layout.style.setProperty('--ytmusic-nav-bar-height', '0px', 'important');
    } else {
      // Restore the original value cleanly
      if (originalNavBarHeight !== null) {
        if (originalNavBarHeight === '64px' || originalNavBarHeight === '') {
          layout.style.removeProperty('--ytmusic-nav-bar-height');
        } else {
          layout.style.setProperty('--ytmusic-nav-bar-height', originalNavBarHeight);
        }
        originalNavBarHeight = null;
      }
    }
  }

  function cleanParents(enable) {
    const player = document.querySelector('ytmusic-player');
    if (!player) return;

    if (enable) {
      let parent = player.parentElement;
      while (parent && parent !== document.body && parent !== document.documentElement) {
        parent.classList.add(PARENT_CLEAN_CLASS);
        parent = parent.parentElement;
      }
    } else {
      document.querySelectorAll('.' + PARENT_CLEAN_CLASS).forEach(el => {
        el.classList.remove(PARENT_CLEAN_CLASS);
      });
    }
  }

  function toggleTheaterMode(forceState) {
    if (forceState !== undefined) {
      isTheater = forceState;
    } else {
      isTheater = !isTheater;
    }

    if (isTheater) {
      document.documentElement.classList.add(ACTIVE_CLASS);
      updateNavBarHeight(true); // Set --ytmusic-nav-bar-height to 0px on ytmusic-app-layout only
      cleanParents(true); // Clean the parent chain dynamically
      resetIdleTimer();
    } else {
      document.documentElement.classList.remove(ACTIVE_CLASS);
      document.documentElement.classList.remove(IDLE_CLASS);
      updateNavBarHeight(false); // Restore original layout value
      cleanParents(false); // Restore parent chain
      clearTimeout(idleTimer);
    }
    // Nudge the window to force YTM to recalculate sizes instantly
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
  }

  function resetIdleTimer() {
    if (!isTheater) return;

    document.documentElement.classList.remove(IDLE_CLASS);
    clearTimeout(idleTimer);

    idleTimer = setTimeout(() => {
      // Don't hide the bar if the mouse is actively hovering over it
      if (!isMouseOverControls) {
        document.documentElement.classList.add(IDLE_CLASS);
      }
    }, 2000); // 2 seconds before hiding
  }

  /*
   * Watch YouTube Music's layout state. If the player page gets closed
   * or minimized natively, shut down our custom theater mode.
   */
  function watchAppLayout() {
    const layout = document.querySelector('ytmusic-app-layout');
    if (!layout) return false;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'player-ui-state') {
          const state = layout.getAttribute('player-ui-state');
          // If state is not open (e.g. mini-player or collapsed), force theater mode OFF
          if (state !== 'PLAYER_PAGE_OPEN' && state !== 'FULLSCREEN' && isTheater) {
            toggleTheaterMode(false);
          }
        }
      }
    });

    observer.observe(layout, { attributes: true, attributeFilter: ['player-ui-state'] });
    return true;
  }

  // Bootstrap layout observer for Single Page App lifecycle
  let attachedLayout = watchAppLayout();
  const bootstrapObserver = new MutationObserver(() => {
    if (!attachedLayout) attachedLayout = watchAppLayout();
  });
  bootstrapObserver.observe(document.documentElement, { childList: true, subtree: true });

  /*
   * True browser Fullscreen (separate from our CSS-driven theater mode).
   * Uses the standard Fullscreen API on <html> so it covers the whole
   * tab/OS-level, same as pressing F11 but triggerable from the icon.
   */
  function toggleTrueFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error('YTM Theater Script: fullscreen request failed:', err);
      });
    } else {
      document.exitFullscreen();
    }
  }

  /*
   * Intercept clicks on the native "Fullscreen" button before YouTube Music
   * gets them. It now ALWAYS triggers true browser fullscreen — theater
   * mode has moved to double-clicking the player (see dblclick handler
   * below), so this button no longer needs to do double duty.
   */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button[title*="full screen" i], button[aria-label*="full screen" i], .ytp-fullscreen-button, .fullscreen-button');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      toggleTrueFullscreen();
    }
  }, true);

  /*
   * Intercept double-clicks anywhere on the player surface (album art,
   * video element, or the player container itself) before YouTube Music's
   * native handler can turn it into a browser fullscreen request. We use
   * the capture phase so we run first and can stopPropagation to fully
   * block the native behavior, replacing it with theater mode instead.
   *
   * We explicitly exclude the bottom control bar (ytmusic-player-bar) and
   * the fullscreen button itself, so double-clicking play/pause, the
   * scrubber, volume, etc. still behaves normally.
   */
  document.addEventListener('dblclick', (e) => {
    if (e.target.closest('ytmusic-player-bar')) return;
    if (e.target.closest('.fullscreen-button, .ytp-fullscreen-button')) return;

    const onPlayerSurface = e.target.closest(
      'ytmusic-player, #song-video, #song-image, .html5-video-container, video, #movie_player'
    );

    if (onPlayerSurface) {
      e.preventDefault();
      e.stopPropagation();
      toggleTheaterMode();
    }
  }, true);

  /*
   * Add Keyboard Shortcuts (F to toggle, Esc to exit)
   */
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    if (e.key.toLowerCase() === 't') {
      e.preventDefault();
      e.stopPropagation();
      toggleTheaterMode();
    }

    if (e.key === 'Escape' && isTheater) {
      e.preventDefault();
      toggleTheaterMode();
    }
  }, true);

  /*
   * Track mouse movement for the auto-hide controls
   */
  document.addEventListener('mousemove', (e) => {
    if (!isTheater) return;

    // Check if mouse is in the bottom 110px of the screen (where the controls are)
    const windowHeight = window.innerHeight;
    isMouseOverControls = (e.clientY > windowHeight - 110);

    resetIdleTimer();
  });

})();