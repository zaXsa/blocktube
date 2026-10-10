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
  // Pending-retry ticks before the paint may fall back to the player root
  // (~150ms each: ~0.9s of waiting for the reel to upgrade first).

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

  // Reel-only host lookup (no player-root fallback): the reel the player
  // itself sits in (authoritative where the layouts nest it), then the main
  // reel renderer by id (the player lives in a separate subtree and the reel
  // carries no is-active attribute, so neither closest nor [is-active]
  // reaches it), then any reel renderer. Null until the reel upgrades into
  // the DOM. First paint waits for this (see shortsOverlayPaintCurrent) so
  // the panel appears once at full size instead of flashing small on the
  // player root and jumping a tick later.
  function shortsOverlayReelHost() {
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
      return null;
    } catch (e) {
      return null;
    }
  }

  // The player root fallback, for layouts where no reel ever appears. Paint
  // reaches it only after the reel grace period below — never first — so the
  // common case stays a single full-size paint.
  function shortsOverlayPlayerHost() {
    try {
      if (typeof document === 'undefined') return null;
      if (typeof document.getElementById === 'function') {
        return document.getElementById('shorts-player') || null;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // Full host chain for the sweep tick (reel preferred, player fallback).
  // First paint resolves the reel itself — see shortsOverlayPaintCurrent.
  // Null when the DOM offers no lookup.
  function shortsOverlayHost() {
    try {
      return shortsOverlayReelHost() || shortsOverlayPlayerHost();
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

  // Every <video> YouTube may already have decoding the blocked Short. The
  // player response ships playable streams with status OK (ytInitialPlayer
  // Response carries streamingData + thumbnails), and the reel host upgrades
  // after the response, so the reason panel alone leaves the first frame
  // visible. Hiding the element shows the black container behind it instead.
  // Fail-open throughout; exotic realms without DOM do nothing.
  function shortsOverlayVideoNodes() {
    try {
      if (typeof document === 'undefined') return [];
      if (typeof document.querySelectorAll !== 'function') return [];
      const nodes = document.querySelectorAll('video');
      if (!nodes) return [];
      if (typeof nodes.length !== 'number') return [];
      const out = [];
      for (let i = 0; i < nodes.length; i += 1) {
        if (nodes[i]) out.push(nodes[i]);
      }
      return out;
    } catch (e) {
      return [];
    }
  }

  // The upcoming-short strip renders each preload as a plain div with the
  // frame baked in as a CSS background-image
  // (.reel-video-in-sequence-thumbnail): no video, no img, invisible to the
  // video hide above. Same hide-until-verdict protocol. Fail-open throughout.
  function shortsOverlaySequenceThumbNodes() {
    try {
      if (typeof document === 'undefined') return [];
      if (typeof document.querySelectorAll !== 'function') return [];
      const nodes = document.querySelectorAll('.reel-video-in-sequence-thumbnail');
      if (!nodes) return [];
      if (typeof nodes.length !== 'number') return [];
      const out = [];
      for (let i = 0; i < nodes.length; i += 1) {
        if (nodes[i]) out.push(nodes[i]);
      }
      return out;
    } catch (e) {
      return [];
    }
  }

  // Hide the current Short's frame at once (pause stops audio too), plus the
  // preloaded strip thumbnails (they may already show a blocked next short).
  // Runs before/with the panel paint, which may wait for the reel to upgrade.
  function shortsOverlayBlankVideo() {
    const nodes = shortsOverlayVideoNodes();
    for (let i = 0; i < nodes.length; i += 1) {
      try {
        if (typeof nodes[i].pause === 'function') nodes[i].pause();
      } catch (e) {}
      try {
        if (nodes[i].style) nodes[i].style.opacity = '0';
      } catch (e) {}
    }
    const thumbs = shortsOverlaySequenceThumbNodes();
    for (let i = 0; i < thumbs.length; i += 1) {
      try {
        if (thumbs[i].style) thumbs[i].style.opacity = '0';
      } catch (e) {}
    }
  }

  // Reveal again on teardown (navigation away, unblocked landing). Never
  // autoplays — just restores the stylesheet default.
  function shortsOverlayUnblankVideo() {
    const nodes = shortsOverlayVideoNodes().concat(shortsOverlaySequenceThumbNodes());
    for (let i = 0; i < nodes.length; i += 1) {
      try {
        if (nodes[i].style) nodes[i].style.opacity = '';
      } catch (e) {}
    }
  }

  // Black-cover markers shared with the seed.js first-frame guard (which
  // carries its own copy: seed.js runs before this bundle exists, so it
  // cannot call these). Covers sit below the reason panel (2147483647).
  // data-bt-cover: a black cover div planted on a Shorts media host.
  // data-bt-revealed: the host's short earned a clean verdict; never re-cover.
  function shortsOverlayCoverHost(host) {
    try {
      if (!host || typeof host.querySelector !== 'function') return;
      if (host.hasAttribute && host.hasAttribute('data-bt-revealed')) return;
      if (host.querySelector('[data-bt-cover]')) return;
      let cover = null;
      try {
        cover = document.createElement('div');
      } catch (e) {
        return;
      }
      cover.setAttribute('data-bt-cover', '1');
      shortsOverlayStyle(cover, {
        position: 'absolute',
        top: '0',
        left: '0',
        right: '0',
        bottom: '0',
        zIndex: '2147483646',
        backgroundColor: 'rgb(0, 0, 0)',
        pointerEvents: 'none',
      });
      shortsOverlayEnsureHostPositioned(host);
      try {
        host.appendChild(cover);
      } catch (e) {}
    } catch (e) {}
  }

  // Every Shorts media host currently in the DOM. The reel renderers include
  // prefetched neighbours (off-screen); the player root covers the gap the
  // reel misses on some layouts — same host set the seed.js guard covers.
  function shortsOverlayAllHosts() {
    const hosts = [];
    try {
      if (typeof document.querySelectorAll === 'function') {
        const reels = document.querySelectorAll('ytd-reel-video-renderer');
        for (let i = 0; i < reels.length; i += 1) {
          if (reels[i] && hosts.indexOf(reels[i]) === -1) hosts.push(reels[i]);
        }
      }
    } catch (e) {}
    try {
      const player =
        typeof document.getElementById === 'function'
          ? document.getElementById('shorts-player')
          : null;
      if (player && hosts.indexOf(player) === -1) hosts.push(player);
    } catch (e) {}
    return hosts;
  }

  // Shorts media hosts holding the short on screen: the reel (preferred, the
  // same host the reason panel anchors to) plus the player root. Cover lifts
  // are scoped to these so prefetched neighbours stay covered until swiped to.
  function shortsOverlayCurrentHosts() {
    const hosts = [];
    try {
      const reel = shortsOverlayReelHost();
      if (reel) hosts.push(reel);
    } catch (e) {}
    try {
      const player = shortsOverlayPlayerHost();
      if (player && hosts.indexOf(player) === -1) hosts.push(player);
    } catch (e) {}
    return hosts;
  }

  // Record this short's verdict for the seed.js guard (which skips covering
  // hosts of a short with a clean verdict) and for the no-verdict fail-safe.
  function shortsOverlayRecordVerdict(videoId, clean) {
    try {
      if (typeof videoId === 'string' && videoId.length > 0) {
        window.__blockTubeShortsVerdict = { videoId, clean: clean === true };
      }
    } catch (e) {}
  }

  // Drop the black covers from the current hosts and mark them revealed so
  // the still-connected guard never re-covers them. Neighbour reels keep
  // their covers until their own verdict or landing. The guard observer is
  // deliberately left connected: hosts appearing later (late upgrades,
  // pre-renders) are covered on insertion unless a clean verdict says
  // otherwise — no timing anywhere in this protocol.
  function shortsOverlayRevealPrehide() {
    const hosts = shortsOverlayCurrentHosts();
    for (let i = 0; i < hosts.length; i += 1) {
      try {
        const kids = hosts[i].children;
        if (kids) {
          for (let k = kids.length - 1; k >= 0; k -= 1) {
            try {
              const kid = kids[k];
              const mark =
                kid && kid.getAttribute ? kid.getAttribute('data-bt-cover') : null;
              if (mark !== null && mark !== undefined && hosts[i].removeChild) {
                hosts[i].removeChild(kid);
              }
            } catch (e) {}
          }
        }
      } catch (e) {}
      try {
        if (hosts[i].setAttribute) hosts[i].setAttribute('data-bt-revealed', '1');
      } catch (e) {}
    }
    shortsOverlayUnblankVideo();
  }

  // Cover every unrevealed Shorts host: the swipe-start counterpart to the
  // reveal above. A swipe lands on pre-rendered reels whose covers were
  // skipped while the previous short held a clean verdict; re-covering them
  // here (synchronously at navigation start) means the landing decision —
  // keep for blocked, lift for clean — never races a paint.
  function shortsOverlayEnsureCovers() {
    const hosts = shortsOverlayAllHosts();
    for (let i = 0; i < hosts.length; i += 1) {
      try {
        shortsOverlayCoverHost(hosts[i]);
      } catch (e) {}
    }
  }

  // Swipe-start counterpart to the landing reveal below: the new short is
  // undecided again. Drop the old verdict marker and re-cover every
  // unrevealed host now (synchronously at navigation start) so the finish
  // decision never races a paint. Leaving a short also re-blanks videos and
  // strip thumbnails (pausing the departing short); the teardown/landing
  // below restores what the verdict allows. Only acts when leaving a Shorts
  // page — pausing videos anywhere else would brick playback with no Shorts
  // verdict coming to restore it. Never throws.
  function shortsOverlayNavigateStart() {
    try {
      window.__blockTubeShortsVerdict = null;
    } catch (e) {}
    try {
      if (
        typeof document === 'undefined' ||
        !document.location ||
        !document.location.pathname.startsWith('/shorts/')
      ) {
        return;
      }
      shortsOverlayEnsureCovers();
      shortsOverlayBlankVideo();
    } catch (e) {}
  }

  // A landing with no blocked paint target is a clean short: lift its covers
  // (its verdict may have arrived as a prefetch whose paint was correctly
  // skipped). Blocked landings keep their covers under the repainted panel.
  // True when revealed. Never throws.
  function shortsOverlayLandingReveal() {
    try {
      if (shortsOverlayHasPaintTarget()) return false;
      const id = currentShortsId();
      shortsOverlayRevealPrehide();
      shortsOverlayRecordVerdict(id, true);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Lift the covers when this player response is a clean verdict for the
  // short on screen. One-line call for the filter paths (initial response,
  // /player); blocked and off-screen verdicts no-op. Never throws.
  function maybeRevealShortsPrehide(ytData) {
    try {
      if (shortsOverlayVerdictIsCleanCurrent(ytData)) {
        shortsOverlayRecordVerdict(blockedPlayerVideoId(ytData), true);
        shortsOverlayRevealPrehide();
      }
    } catch (e) {}
  }

  // True when the player response belongs to the short on screen and its
  // verdict is clean: the seed.js guard may reveal the frame it hid. Strict
  // on identity (a clean prefetch for another short must not reveal the
  // current one), fail-open otherwise.
  function shortsOverlayVerdictIsCleanCurrent(ytData) {
    try {
      if (playerHasBeenBlocked) return false;
      const id = blockedPlayerVideoId(ytData);
      if (typeof id !== 'string' || id.length === 0) return false;
      return id === currentShortsId();
    } catch (e) {
      return false;
    }
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
    // Fixed width (not shrink-to-fit): a menu tap ("Channel Blocked") and a
    // filter block (long rule-carrying reason) must render the same panel.
    shortsOverlayStyle(panel, {
      width: '80%',
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
    shortsOverlayUnblankVideo();
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
        // Safety net for the player-root fallback (or a YouTube re-render
        // dropping the panel): migrate it up once the reel arrives.
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

  const SHORTS_REEL_GRACE_TRIES = 6;

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
          // Past the reel grace period the paint may use the player-root
          // fallback, so layouts without a reel still end up covered.
          shortsOverlayPaintCurrent(tries >= SHORTS_REEL_GRACE_TRIES);
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
  // `allowFallback` permits the player-root host: direct call sites omit it
  // (reel only — a small-first paint that migrates up a tick later is the
  // two-step flicker this avoids), while the pending retry passes true past
  // the grace period so reel-less layouts still get covered.
  function shortsOverlayPaintCurrent(allowFallback) {
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
    // The panel may wait for the reel to upgrade (retry below); the video
    // element exists already, so hide its frame now rather than with the paint.
    shortsOverlayBlankVideo();
    let host = null;
    try {
      host = shortsOverlayReelHost();
    } catch (e) {
      host = null;
    }
    if (!host && allowFallback === true) {
      try {
        host = shortsOverlayPlayerHost();
      } catch (e) {
        host = null;
      }
    }
    if (!host) {
      // Reel not upgraded yet (or exotic realm): retry briefly rather
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
    // Decided for the short on screen: blocked. Record it for the seed.js
    // guard (covers stay) and the no-verdict fail-safe, then paint.
    shortsOverlayRecordVerdict(attribution.videoId, false);
    removeShortsOverlay();
    shortsOverlayBlankVideo();
    shortsOverlayPaintCurrent();
  }
