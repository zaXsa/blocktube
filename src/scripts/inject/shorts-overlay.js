  // Blocked-Shorts overlay (see SHORTS_STATUS.md §2: v1 was removed for
  // first-paint offset, z-fighting with YouTube's own error layers and
  // opacity variance; v2 anchored to the <video> rect with an overscan margin
  // that bled over the masthead/search bar).
  //
  // This version anchors one level above the Shorts player root: the main
  // reel renderer (`ytd-reel-video-renderer#reel-video-renderer`), else the
  // reel the player sits in, else `#shorts-player` itself
  // (the WEB_PLAYER_CONTEXT_CONFIG_ID_KEVLAR_SHORTS rootElementId). YouTube
  // keeps the player root in a separate subtree from the reel and lays the
  // video layer out of sync with it on some layouts, so an inset-0 child of
  // the player root alone inherits that offset gap; the reel spans the whole
  // shorts column (player area included), so the same inset-0 panel covers
  // the gap. No rect math, no scroll/resize sync, nothing above the reel
  // ever covered. (The reel carries no is-active attribute — match by id.)
  //
  // Paint is retried briefly when the host is not in the DOM yet (player
  // responses and SPA landings can precede the element upgrade), so a missed
  // first attempt shows the panel ~150ms later instead of never.
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
  // Every blocked Short by videoId (reason line), so swiping away and back
  // repaints the panel even though lastShortsBlock above now holds a
  // prefetched id. Bounded (insertion-ordered eviction) like
  // shortsSkipFiredIds, so a long session cannot grow it without limit.
  let shortsBlockedOverlays = new Map();
  const SHORTS_BLOCKED_MAP_CAP = 100;
  let shortsOverlayEl = null;
  let shortsOverlaySyncTimer = 0;
  // Pending-paint retry while the host is not in the DOM yet (see
  // shortsOverlaySchedulePaintRetry). Cleared on paint, teardown, or expiry.
  let shortsOverlayPendingTimer = 0;

  // Remember one blocked Short's reason. Never throws.
  function rememberShortsBlock(videoId, message) {
    try {
      if (typeof videoId !== 'string' || videoId.length === 0) return;
      if (shortsBlockedOverlays.has(videoId)) shortsBlockedOverlays.delete(videoId);
      shortsBlockedOverlays.set(videoId, message);
      if (shortsBlockedOverlays.size > SHORTS_BLOCKED_MAP_CAP) {
        shortsBlockedOverlays.delete(shortsBlockedOverlays.keys().next().value);
      }
    } catch (e) {}
  }

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

  // Walk from a node up to its enclosing `ytd-reel-video-renderer`, if any.
  // closest() alone is not enough: it stops at shadow-root boundaries, and
  // the player may sit inside one — so also step out through getRootNode()
  // hosts (bounded). Null when unreachable. Never throws.
  function shortsOverlayReelFrom(node) {
    try {
      if (node && typeof node.closest === 'function') {
        const reel = node.closest('ytd-reel-video-renderer');
        if (reel) return reel;
      }
    } catch (e) {}
    try {
      let root =
        node && typeof node.getRootNode === 'function' ? node.getRootNode() : null;
      let guard = 0;
      while (root && root.host && guard < 4) {
        guard += 1;
        const host = root.host;
        try {
          const tag =
            host && typeof host.tagName === 'string' ? host.tagName.toLowerCase() : '';
          if (tag === 'ytd-reel-video-renderer') return host;
          if (host && typeof host.closest === 'function') {
            const reel = host.closest('ytd-reel-video-renderer');
            if (reel) return reel;
          }
        } catch (e) {}
        try {
          root = typeof host.getRootNode === 'function' ? host.getRootNode() : null;
        } catch (e) {
          root = null;
        }
      }
    } catch (e) {}
    return null;
  }

  // The reel item behind the Shorts player. Most specific first: the reel
  // the player itself sits in (authoritative where the layouts nest it),
  // then the main reel renderer by id (the player lives in a separate
  // subtree and the reel carries no is-active attribute, so neither closest
  // nor [is-active] reaches it), then any reel renderer, then the player
  // root itself. Null when the DOM offers no lookup.
  function shortsOverlayHost() {
    try {
      if (typeof document === 'undefined') return null;
      let player = null;
      try {
        if (typeof document.getElementById === 'function') {
          player = document.getElementById('shorts-player') || null;
        }
      } catch (e) {
        player = null;
      }
      const ownReel = shortsOverlayReelFrom(player);
      if (ownReel) return ownReel;
      try {
        if (typeof document.querySelector === 'function') {
          const byId = document.querySelector('#reel-video-renderer');
          if (byId) return byId;
          const active = document.querySelector('ytd-reel-video-renderer[is-active]');
          if (active) return active;
          const anyReel = document.querySelector('ytd-reel-video-renderer');
          if (anyReel) return anyReel;
        }
      } catch (e) {}
      if (player) return player;
      return null;
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

  // The short on screen: shared currentShortsId() in paths.js (single
  // SHORTS_ID_RE for all fragments) — do not redeclare locally.

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

  // Tear the overlay down: landing reconcile (yt-navigate-finish), an
  // unblocked landing found by the sweep tick, or a new block replacing it.
  // Also drops the pending-paint retry (it belongs to the old video).
  function removeShortsOverlay() {
    try {
      if (shortsOverlaySyncTimer && typeof clearInterval === 'function') {
        clearInterval(shortsOverlaySyncTimer);
      }
    } catch (e) {}
    shortsOverlaySyncTimer = 0;
    shortsOverlayClearPending();
    if (shortsOverlayEl) {
      try {
        if (shortsOverlayEl.parentNode) shortsOverlayEl.parentNode.removeChild(shortsOverlayEl);
      } catch (e) {}
    }
    shortsOverlayEl = null;
  }

  // Sweep tick: gone elsewhere → teardown (true). Host changed or panel
  // dropped from the host (late upgrade, YouTube re-render) → move it to the
  // current host. Otherwise nothing to do — inset 0 tracks the reel without
  // any rect sync.
  function shortsOverlayTick() {
    if (!shortsOverlayStillCurrent()) {
      removeShortsOverlay();
      return true;
    }
    if (!shortsOverlayEl) return false;
    try {
      const host = shortsOverlayHost();
      if (host && shortsOverlayEl.parentNode !== host) {
        // First load can paint onto the small player root before the reel
        // exists; the tick migrates the panel up once the reel arrives.
        shortsOverlayEnsureHostPositioned(host);
        host.appendChild(shortsOverlayEl);
      }
    } catch (e) {}
    return false;
  }

  // Drop the pending-paint retry timer. Never throws.
  function shortsOverlayClearPending() {
    try {
      if (shortsOverlayPendingTimer && typeof clearInterval === 'function') {
        clearInterval(shortsOverlayPendingTimer);
      }
    } catch (e) {}
    shortsOverlayPendingTimer = 0;
  }

  // True when the short on screen has a panel to show: it is the last
  // blocked Short, or a remembered blocked one (swipe away and back). The
  // pending-paint retry keys on this so it does not give up on a remembered
  // short just because the last attribution belongs to a prefetch.
  function shortsOverlayHasPaintTarget() {
    try {
      if (shortsOverlayStillCurrent()) return true;
      const id = currentShortsId();
      return typeof id === 'string' && shortsBlockedOverlays.has(id);
    } catch (e) {
      return false;
    }
  }

  // The paint call sites (player response, SPA landing) can run before the
  // reel container upgrades into the DOM; a single-shot lookup then misses
  // and nothing retries, so the panel shows late or never. Retry briefly:
  // every 150ms for ~3s, stopping on paint, navigation away, or expiry.
  // Fail-open throughout; at most one pending timer at a time.
  function shortsOverlaySchedulePaintRetry() {
    if (shortsOverlayPendingTimer) return;
    if (typeof setInterval !== 'function') return;
    let tries = 0;
    shortsOverlayPendingTimer = setInterval(() => {
      tries += 1;
      let painted = false;
      let stale = false;
      try {
        painted = shortsOverlayEl !== null;
        stale = !shortsOverlayHasPaintTarget();
        if (!painted && !stale) {
          shortsOverlayPaintCurrent();
          painted = shortsOverlayEl !== null;
        }
      } catch (e) {
        painted = false;
      }
      if (painted || stale || tries >= 20) shortsOverlayClearPending();
    }, 150);
  }

  // Paint the stored block when it is the short on screen and no panel is
  // up. No-op otherwise (wrong video, off-shorts, no host, already painted).
  // Entry point for both the player-response path below and the
  // yt-navigate-finish hook: prefetched shorts store their attribution
  // before the swipe lands, and the landing paints them. A swipe away and
  // back also repaints: the last attribution may belong to a prefetched id
  // by then, so fall back to the remembered per-video map.
  function shortsOverlayPaintCurrent() {
    if (shortsOverlayEl) {
      shortsOverlayClearPending();
      return;
    }
    if (!shortsOverlayStillCurrent()) {
      let remembered = null;
      try {
        const id = currentShortsId();
        if (typeof id === 'string' && shortsBlockedOverlays.has(id)) {
          remembered = { videoId: id, message: shortsBlockedOverlays.get(id) };
        }
      } catch (e) {
        remembered = null;
      }
      if (!remembered) {
        shortsOverlayClearPending();
        return;
      }
      lastShortsBlock = remembered;
    }
    const host = shortsOverlayHost();
    if (!host) {
      // Container not upgraded yet (or exotic realm): retry briefly rather
      // than dropping the paint — the skip sweep still advances meanwhile.
      shortsOverlaySchedulePaintRetry();
      return;
    }
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
      shortsOverlaySchedulePaintRetry();
      return;
    }
    shortsOverlayClearPending();
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
    // Remember every blocked Short (not just the current one) so a swipe
    // away and back still repaints the panel — see shortsOverlayPaintCurrent.
    rememberShortsBlock(attribution.videoId, message);
    // A prefetch for another short must not disturb the current panel.
    if (currentShortsId() !== attribution.videoId) return;
    removeShortsOverlay();
    shortsOverlayPaintCurrent();
  }
