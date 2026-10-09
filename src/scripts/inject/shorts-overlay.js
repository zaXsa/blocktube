  // Blocked-Shorts overlay (see SHORTS_STATUS.md §2: v1 was removed for
  // first-paint offset, z-fighting with YouTube's own error layers and
  // opacity variance; v2 anchored to the <video> rect with an overscan margin
  // that bled over the masthead/search bar).
  //
  // This version anchors to the Shorts player root itself (`#shorts-player`,
  // the WEB_PLAYER_CONTEXT_CONFIG_ID_KEVLAR_SHORTS rootElementId): the panel
  // is appended as an absolutely-positioned child with inset 0, so it covers
  // exactly the whole video — no rect math, no scroll/resize sync, no offset
  // class of bugs, nothing above the player ever covered.
  //
  // Deliberately reason-only: no Block/Next buttons on the panel (a blocked
  // video needs no affordances — the skip sweep autoplays next, and
  // Block Channel / Block Video belong in the reel `...` menu, §4a). The
  // panel shows what filter blocked the short (getBlockMessage, rule
  // included) until the sweep navigates away.
  //
  // Exotic realms without DOM/timers never paint. Fail-open throughout.

  // Last blocked Short, captured in disablePlayer before it wipes the player
  // response (the overlay paint below keys on it).
  let lastShortsBlock = null;
  let shortsOverlayEl = null;
  let shortsOverlaySyncTimer = 0;

  // Attribution of a blocked player response, across the ytPlayer rule shapes
  // (player response root, embed/player-config args). The video id drives the
  // overlay lifecycle; the message carries the reason line.
  function blockedPlayerAttribution(ytData) {
    const videoId = blockedPlayerVideoId(ytData);
    const channelId =
      getObjectByPath(ytData, 'videoDetails.channelId') ||
      getObjectByPath(ytData, 'args.raw_player_response.videoDetails.channelId');
    const channelName =
      getObjectByPath(ytData, 'videoDetails.author') ||
      getObjectByPath(ytData, 'args.raw_player_response.videoDetails.author');
    const title =
      getObjectByPath(ytData, 'videoDetails.title') ||
      getObjectByPath(ytData, 'args.raw_player_response.videoDetails.title');
    return { videoId, channelId, channelName, title };
  }

  // The Shorts player root. Null when the DOM offers no way to look it up.
  function shortsOverlayHost() {
    try {
      if (typeof document === 'undefined' || typeof document.getElementById !== 'function') {
        return null;
      }
      return document.getElementById('shorts-player') || null;
    } catch (e) {
      return null;
    }
  }

  // Still on the blocked Short? The overlay lives only there; any navigation
  // (skip-fired or manual) tears it down.
  function shortsOverlayStillCurrent() {
    try {
      if (!lastShortsBlock || typeof lastShortsBlock.videoId !== 'string') return false;
      return currentShortsId() === lastShortsBlock.videoId;
    } catch (e) {
      return false;
    }
  }

  // The short on screen, from the /shorts/<id> URL. Undefined off-shorts.
  function currentShortsId() {
    try {
      const match = document.location.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})/);
      return match ? match[1] : undefined;
    } catch (e) {
      return undefined;
    }
  }

  // Style a node property-by-property through CSSOM only (no <style>, no
  // innerHTML), so page CSP and Trusted Types stay out of the way — the same
  // constraint as the toast layer in context-menu.js.
  function shortsOverlayStyle(el, props) {
    try {
      const style = el.style;
      for (const key of Object.keys(props)) style[key] = props[key];
    } catch (e) {}
  }

  // The player root must establish a positioning context for the absolute
  // inset-0 panel. It already is positioned on stock YouTube; only touch it
  // when it provably is not, and never throw.
  function shortsOverlayEnsureHostPositioned(host) {
    try {
      let position = null;
      if (typeof getComputedStyle === 'function') {
        position = getComputedStyle(host).position;
      } else if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
        position = window.getComputedStyle(host).position;
      }
      if (position === 'static' && host.style) host.style.position = 'relative';
    } catch (e) {}
  }

  // Build the reason-only overlay node for the current lastShortsBlock. Null
  // when the DOM offers no way to build it.
  function shortsOverlayBuild() {
    const block = lastShortsBlock;
    if (!block) return null;
    let root = null;
    try {
      root = document.createElement('div');
    } catch (e) {
      return null;
    }
    root.id = 'blocktube-shorts-block';
    root.setAttribute('role', 'status');
    shortsOverlayStyle(root, {
      position: 'absolute',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      zIndex: '2147483647',
      backgroundColor: 'rgb(0, 0, 0)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });

    const panel = document.createElement('div');
    shortsOverlayStyle(panel, {
      maxWidth: '80%',
      textAlign: 'center',
      padding: '16px',
    });

    const title = document.createElement('div');
    title.textContent = 'Blocked by BlockTube';
    shortsOverlayStyle(title, {
      color: '#fff',
      fontSize: '16px',
      fontWeight: 'bold',
      fontFamily: 'Roboto, Arial, sans-serif',
      marginBottom: '8px',
    });
    panel.appendChild(title);

    const reason = document.createElement('div');
    reason.textContent = block.message || 'Video blocked by BlockTube filter';
    shortsOverlayStyle(reason, {
      color: '#ccc',
      fontSize: '13px',
      fontFamily: 'Roboto, Arial, sans-serif',
      overflowWrap: 'anywhere',
    });
    panel.appendChild(reason);

    root.appendChild(panel);
    return root;
  }

  // Tear the overlay down: navigation away, or a new block replacing it.
  function removeShortsOverlay() {
    try {
      if (shortsOverlaySyncTimer && typeof clearInterval === 'function') {
        clearInterval(shortsOverlaySyncTimer);
      }
    } catch (e) {}
    shortsOverlaySyncTimer = 0;
    if (shortsOverlayEl) {
      try {
        if (shortsOverlayEl.parentNode) shortsOverlayEl.parentNode.removeChild(shortsOverlayEl);
      } catch (e) {}
    }
    shortsOverlayEl = null;
  }

  // Sweep tick: gone elsewhere → teardown (true). Panel dropped from the
  // player root (YouTube re-render) → re-append. Otherwise nothing to do —
  // inset 0 tracks the video without any rect sync.
  function shortsOverlayTick() {
    if (!shortsOverlayStillCurrent()) {
      removeShortsOverlay();
      return true;
    }
    if (!shortsOverlayEl) return false;
    try {
      const host = shortsOverlayHost();
      if (host && shortsOverlayEl.parentNode !== host) host.appendChild(shortsOverlayEl);
    } catch (e) {}
    return false;
  }

  // Paint the stored block when it is the short on screen and no panel is
  // up. No-op otherwise (wrong video, off-shorts, no host, already painted).
  // Entry point for both the player-response path below and the
  // yt-navigate-finish hook: prefetched shorts store their attribution
  // before the swipe lands, and the landing paints them.
  function shortsOverlayPaintCurrent() {
    if (shortsOverlayEl) return;
    if (!shortsOverlayStillCurrent()) return;
    const host = shortsOverlayHost();
    if (!host) return;
    let el = null;
    try {
      el = shortsOverlayBuild();
    } catch (e) {
      el = null;
    }
    if (!el) return;
    shortsOverlayEl = el;
    shortsOverlayEnsureHostPositioned(host);
    try {
      host.appendChild(shortsOverlayEl);
    } catch (e) {
      shortsOverlayEl = null;
      return;
    }
    if (typeof setInterval !== 'function') return;
    shortsOverlaySyncTimer = setInterval(() => {
      let done = false;
      try {
        done = shortsOverlayTick();
      } catch (e) {
        done = false;
      }
      if (done) {
        try {
          clearInterval(shortsOverlaySyncTimer);
        } catch (e) {}
        shortsOverlaySyncTimer = 0;
      }
    }, 250);
  }

  // Store a blocked Short's attribution + reason, painting only when it is
  // the short on screen. Player responses also arrive for prefetched (not yet
  // watched) shorts: painting those immediately would cover the wrong video
  // and get torn down on swipe with nothing repainting the landed short, so
  // they store only — the navigate-finish hook paints on landing.
  function showBlockedShortOverlay(attribution, message) {
    if (!attribution || typeof attribution.videoId !== 'string' || attribution.videoId.length === 0) {
      return;
    }
    try {
      if (!document.location.pathname.startsWith('/shorts/')) return;
    } catch (e) {
      return;
    }
    lastShortsBlock = {
      videoId: attribution.videoId,
      channelId: attribution.channelId,
      channelName: attribution.channelName,
      videoName: attribution.title,
      message,
    };
    // A prefetch for another short must not disturb the current panel.
    if (currentShortsId() !== attribution.videoId) return;
    removeShortsOverlay();
    shortsOverlayPaintCurrent();
  }
