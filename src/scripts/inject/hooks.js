  // Read chained accessors off a property descriptor, refusing
  // non-configurable properties (returns null then). Missing accessors read
  // as undefined.
  function chainedAccessors(owner, prop) {
    const odesc = Object.getOwnPropertyDescriptor(owner, prop);
    if (!(odesc instanceof Object)) return { prevGetter: undefined, prevSetter: undefined };
    if (odesc.configurable === false) return null;
    return {
      prevGetter: odesc.get instanceof Function ? odesc.get : undefined,
      prevSetter: odesc.set instanceof Function ? odesc.set : undefined,
    };
  }

  // Install a value-trap on one property: the handler's init decides whether
  // to arm, then getter/setter delegate to it (chaining any pre-existing
  // accessors, per uBlock's multi-trapper contract). Refuses non-configurable
  // properties.
  function trapProp(owner, prop, configurable, handler) {
    if (handler.init(owner[prop]) === false) {
      return;
    }
    const chained = chainedAccessors(owner, prop);
    if (chained === null) return;
    const { prevGetter, prevSetter } = chained;
    Object.defineProperty(owner, prop, {
      configurable,
      get() {
        if (prevGetter !== undefined) {
          prevGetter();
        }
        return handler.getter(); // replacementValue
      },
      set(a) {
        if (prevSetter !== undefined) {
          prevSetter(a);
        }
        handler.setter(a);
      },
    });
  }

  // Leaf of a trap chain: trap the final property so reads return the
  // replacement and writes run onSet (or the type-mismatch contract).
  function trapChainLeaf(owner, prop, state) {
    trapProp(owner, prop, true, {
      v: undefined,
      init(v) {
        if (state.typeMismatch(v)) {
          return false;
        }
        this.v = v;
        return true;
      },
      getter() {
        return state.replacementValue;
      },
      setter(a) {
        if (state.onSet instanceof Function) {
          state.replacementValue = a;
          state.onSet(a);
        } else {
          if (state.typeMismatch(a) === false) {
            return;
          }
          state.replacementValue = a;
        }
      },
    });
  }

  // Mid-chain link: remember the untraversed remainder and continue from the
  // freshly assigned object once it arrives.
  function trapChainLink(owner, prop, remPath, state) {
    trapProp(owner, prop, true, {
      v: undefined,
      init(newVal) {
        this.v = newVal;
        return true;
      },
      getter() {
        return this.v;
      },
      setter(a) {
        this.v = a;
        if (a instanceof Object) {
          // continue the remaining path from the freshly assigned object
          trapChain(a, remPath, state);
        }
      },
    });
  }

  // Walk a dotted path, trapping each link so the leaf trap installs once
  // its owner object exists. State carries the mismatch gate + onSet.
  function trapChain(owner, remPath, state) {
    const pos = remPath.indexOf('.');
    if (pos === -1) {
      trapChainLeaf(owner, remPath, state);
      return;
    }
    const prop = remPath.slice(0, pos);
    const v = owner[prop];
    // remember the path that is still not reached, it must be traversed later
    remPath = remPath.slice(pos + 1);
    if (v instanceof Object || (typeof v === 'object' && v !== null)) {
      trapChain(v, remPath, state);
      return;
    }
    trapChainLink(owner, prop, remPath, state);
  }

  // Install a value-trap on a dotted path only YouTube owns, so we can run
  // post-processing the moment the data becomes available (window.yt.config_,
  // ytplayer.config, ytInitialData, ...). Adapted from uBlock Origin.
  const trapObjectPath = function (path, replacementValue, onSet = undefined) {
    const state = {
      replacementValue,
      onSet,
      blocked: false,
    };
    // Once a value with a different type than our replacement arrives, refuse
    // every later assignment for this property (uBlock's trapper contract).
    state.typeMismatch = function (value) {
      if (state.blocked) {
        return true;
      }
      state.blocked =
        value !== undefined &&
        value !== null &&
        state.replacementValue !== undefined &&
        state.replacementValue !== null &&
        typeof value !== typeof state.replacementValue;
      return state.blocked;
    };
    // https://github.com/uBlockOrigin/uBlock-issues/issues/156
    //   Support multiple trappers for the same property.
    trapChain(window, path, state);
  };

  // !! Globals

  window.blockTubeReloadRequired = false;

  // extension storageData
  let storageData;

  // JavaScript filtering
  let jsFilter;
  let jsFilterEnabled = false;

  // Set when a playback video has been blocked on this page. startHook() reads
  // it to know whether ytInitialData arrived before or after the block and
  // then redirects to the next (not blocked) video once data is available.
  let playerHasBeenBlocked = false;
  // startHook() is idempotent and only ever runs with a real storage payload in
  // place (see storageReceived); track that so a placeholder/undefined payload
  // arriving earlier can't swallow the real boot.
  let hooksStarted = false;
  // blockTubeReady must fire exactly once: seed.js defers its boot callbacks on
  // it while blockTubeDispatched is not yet true, and a re-dispatch would
  // re-run them (e.g. yt.player.Application.create, loadInitialData).
  let readyDispatched = false;

  function fireBlockTubeReady() {
    if (readyDispatched) return;
    readyDispatched = true;
    window.dispatchEvent(new Event('blockTubeReady'));
  }

  function postMessage(type, data) {
    window.postMessage(
      { from: BLOCKTUBE_CONSTS.MESSAGES.FROM_PAGE, type, data },
      document.location.origin,
    );
  }

  // YouTube serves require-trusted-types-for 'script', so plain window.eval
  // throws. A named createScript-only policy supplies the required TrustedScript
  // without weakening page-wide Trusted Types (HTML/URL still enforced).
  let ttPolicy;
  try {
    ttPolicy =
      window.trustedTypes &&
      window.trustedTypes.createPolicy &&
      window.trustedTypes.createPolicy('blocktube', { createScript: (s) => s });
  } catch (e) {}

  function blocktubeEval(code) {
    if (ttPolicy) return window.eval(ttPolicy.createScript(code));
    return window.eval(code);
  }
  // Compile one [pattern, flags] pair into a RegExp, stripping the stateful
  // `g` flag. Returns undefined for malformed entries (logged, skipped).
  function compileOneRegExp(v) {
    if (!Array.isArray(v)) return undefined;
    try {
      return RegExp(v[0], typeof v[1] === 'string' ? v[1].replace('g', '') : '');
    } catch (e) {
      console.error(`RegExp parsing error: /${v[0]}/${v[1]}`);
      return undefined;
    }
  }

  // Compile every entry of one filterData array prop in place.
  function compileRegExpProp(filterData, prop) {
    if (has.call(filterData, prop) && Array.isArray(filterData[prop])) {
      filterData[prop] = filterData[prop].map(compileOneRegExp);
    }
  }

  // Pre-compiled filter paths. The same path strings (from filterRules and the
  // literals below) are resolved against thousands of objects, so split + regex
  // parsing happens once per unique path instead of per call.
  function transformToRegExp(data) {
    if (typeof data !== 'object' || data === null) return;
    if (typeof data.filterData !== 'object' || data.filterData === null) return;
    regexProps.forEach((p) => compileRegExpProp(data.filterData, p));
    // The allowlist is compiled with the exact-ID rule upstream; hydrate it
    // the same way so channelId matching can test against RegExps.
    compileRegExpProp(data.filterData, 'whitelist');
  }

  // Embed pages: filter the PLAYER_VARS payload at once, or trap yt.config_
  // until it arrives.
  function hookEmbedConfig() {
    const ytConfigPlayerConfig = getObjectByPath(window, 'yt.config_.PLAYER_VARS');
    if (typeof ytConfigPlayerConfig === 'object' && ytConfigPlayerConfig !== null) {
      try {
        ytConfigPlayerConfig.raw_player_response = JSON.parse(
          ytConfigPlayerConfig.embedded_player_response,
        );
      } catch (e) {}
      ObjectFilter(window.yt.config_, filterRules.ytPlayer, [playerMiscFilters]);
    } else {
      trapObjectPath('yt.config_', undefined, (v) => {
        try {
          if (has.call(v, 'PLAYER_VARS')) {
            v.PLAYER_VARS.raw_player_response = JSON.parse(
              v.PLAYER_VARS.embedded_player_response,
            );
          }
        } catch (e) {}
        ObjectFilter(window.yt.config_, filterRules.ytPlayer, [playerMiscFilters]);
      });
    }
  }

  // Legacy watch-page player config: filter at once, or trap until present.
  function hookYtPlayerConfig() {
    const ytPlayerconfig = getObjectByPath(window, 'ytplayer.config');
    if (typeof ytPlayerconfig === 'object' && ytPlayerconfig !== null) {
      ObjectFilter(window.ytplayer.config, filterRules.ytPlayer, [playerMiscFilters]);
    } else {
      trapObjectPath('ytplayer.config', undefined, (v) => {
        const playerResp = getObjectByPath(v, 'args.player_response');
        if (playerResp) {
          try {
            v.args.raw_player_response = JSON.parse(playerResp);
          } catch (e) {}
        }
        ObjectFilter(window.ytplayer.config, filterRules.ytPlayer, [playerMiscFilters]);
      });
    }
  }

  // Guide data: filter at once, or trap until present.
  function hookGuideData() {
    if (typeof window.ytInitialGuideData === 'object' && window.ytInitialGuideData !== null) {
      ObjectFilter(window.ytInitialGuideData, filterRules.guide);
    } else {
      trapObjectPath('ytInitialGuideData', undefined, (v) => ObjectFilter(v, filterRules.guide));
    }
  }

  // Initial player response: filter at once (clearing the blocked flag first),
  // or trap until present. A clean verdict for the short on screen also lifts
  // the seed.js first-frame guard (blocked shorts stay hidden under the panel).
  function hookInitialPlayerResponse() {
    if (
      typeof window.ytInitialPlayerResponse === 'object' &&
      window.ytInitialPlayerResponse !== null
    ) {
      playerHasBeenBlocked = false;
      ObjectFilter(window.ytInitialPlayerResponse, filterRules.ytPlayer);
      maybeRevealShortsPrehide(window.ytInitialPlayerResponse);
    } else {
      trapObjectPath('ytInitialPlayerResponse', undefined, (v) => {
        playerHasBeenBlocked = false;
        ObjectFilter(v, filterRules.ytPlayer);
        maybeRevealShortsPrehide(v);
      });
    }
  }

  // Reentrancy guard for the sequence filter below: filtering the string
  // phase writes the filtered JSON back through the trap, which would
  // otherwise re-enter the filter on every write.
  let reelSequenceScrubbing = false;

  // Filter one reel-sequence value in whatever phase it arrives in. YouTube
  // assigns this global twice: first the escaped JSON string, later the
  // parsed object (`window[x] = JSON.parse(x)`). Strings are parsed, filtered
  // and written back (so the later parse yields an already-filtered object);
  // objects are filtered in place, which is what the reel then consumes.
  function scrubSequenceValue(v) {
    if (typeof v === 'string') {
      if (reelSequenceScrubbing) return;
      try {
        const parsed = JSON.parse(v);
        filterReelSequenceResponse(parsed);
        reelSequenceScrubbing = true;
        try {
          window.ytInitialReelWatchSequenceResponse = JSON.stringify(parsed);
        } finally {
          reelSequenceScrubbing = false;
        }
      } catch (e) {}
      return;
    }
    try {
      filterReelSequenceResponse(v);
    } catch (e) {}
  }

  // Initial reel sequence (the upcoming-shorts queue a direct Shorts load
  // embeds in the page): filter its embedded players and neutralize its
  // preloaded video frames at once, or trap until present. Shorts-only.
  function hookInitialReelSequence() {
    try {
      if (!document.location.pathname.startsWith('/shorts/')) return;
    } catch (e) {
      return;
    }
    let current = null;
    try {
      current = window.ytInitialReelWatchSequenceResponse;
    } catch (e) {
      current = null;
    }
    if (current !== undefined && current !== null) {
      // Object (parsed) or string (escaped JSON): scrubSequenceValue handles
      // both, and a present value must never be hidden behind a trap.
      scrubSequenceValue(current);
      return;
    }
    trapObjectPath('ytInitialReelWatchSequenceResponse', undefined, (v) => {
      scrubSequenceValue(v);
    });
  }

  // Initial page data: filter at once (redirecting when a block already
  // landed), or trap until present.
  function hookInitialData() {
    const postActions = [fixAutoplay];
    if (typeof window.ytInitialData === 'object' && window.ytInitialData !== null) {
      ObjectFilter(
        window.ytInitialData,
        mergedFilterRules,
        window.ytInitialData.contents && playerHasBeenBlocked
          ? postActions.concat(redirectToNext)
          : postActions,
        true,
      );
    } else {
      trapObjectPath('ytInitialData', undefined, (v) => {
        ObjectFilter(
          v,
          mergedFilterRules,
          v.contents && playerHasBeenBlocked ? postActions.concat(redirectToNext) : postActions,
          true,
        );
      });
    }
  }

  function startHook() {
    // A hostile/odd data shape must never leave the page unarmed: deferred seed
    // callbacks wait on blockTubeReady, so a mid-way failure fails open (traps
    // may be partial) and the page still boots; the error is logged. hooksStarted
    // is latched first so a retry can't double-trap.
    if (hooksStarted) return;
    hooksStarted = true;

    try {
      if (window.location.pathname.startsWith('/embed/')) {
        hookEmbedConfig();
      }
      hookYtPlayerConfig();
      hookGuideData();
      hookInitialPlayerResponse();
      hookInitialData();
      hookInitialReelSequence();
    } catch (e) {
      console.error('BlockTube startHook exception (data left in place)', e);
    }

    window.blockTubeDispatched = true;
    fireBlockTubeReady();
  }

  // Page-forgeable message (FROM_CONTENT is public): drop anything that
  // isn't a real storage payload so a garbage shape can't throw or poison
  // storageData. Genuine payloads always pass (arrays/strings below).
  // Returns true when the payload shape is safe to consume.
  function isValidStoragePayload(data) {
    if (
      typeof data !== 'object' ||
      data === null ||
      typeof data.filterData !== 'object' ||
      data.filterData === null ||
      typeof data.options !== 'object' ||
      data.options === null
    ) {
      return false;
    }
    // Non-array props would throw later at block*`.push`/match`.some`.
    for (let idx = 0; idx < regexProps.length; idx += 1) {
      const prop = data.filterData[regexProps[idx]];
      if (prop !== undefined && !Array.isArray(prop)) return false;
    }
    // The allowlist stays out of regexProps (so blacklist loops ignore it)
    // but must still be an array when present.
    if (data.filterData.whitelist !== undefined && !Array.isArray(data.filterData.whitelist))
      return false;
    if (data.filterData.vidLength !== undefined && !Array.isArray(data.filterData.vidLength))
      return false;
    return (
      data.filterData.javascript === undefined || typeof data.filterData.javascript === 'string'
    );
  }

  // Enable the custom JS filter only when explicitly opted in. NOTE: the eval
  // is MAIN-realm, so it grants no extra capability there (page scripts can
  // already eval); the gate exists to keep it a deliberate user opt-in.
  // Whitelist mode forces it off for the session: user JS that allows
  // content back in would defeat the mode and complicate the audit.
  function setupJsFilter() {
    const jsOptIn =
      storageData.options[OPT.ENABLE_JAVASCRIPT] && !storageData.options[OPT.WHITELIST_MODE];
    if (jsOptIn && storageData.filterData.javascript) {
      try {
        jsFilter = blocktubeEval(storageData.filterData.javascript);
        if (!(jsFilter instanceof Function)) {
          throw Error('Function not found');
        }
        jsFilterEnabled = jsOptIn;
      } catch (e) {
        console.error('Custom function syntax error', e);
        jsFilterEnabled = false;
      }
    } else {
      jsFilterEnabled = false;
    }
  }

  // Storage payload pushed by the background (via the content_script contract);
  // `options` keys are BLOCKTUBE_CONSTS.OPTIONS (alias OPT in rules.js).
  function storageReceived(data) {
    if (data === undefined) {
      window.blockTubeDispatched = true;
      fireBlockTubeReady();
      return;
    }
    if (!isValidStoragePayload(data)) {
      return;
    }
    transformToRegExp(data);
    if (data.options[OPT.TRENDING]) blockTrending(data);
    if (data.options[OPT.MIXES]) blockMixes(data);
    if (data.options[OPT.SHORTS]) blockShorts(data);

    storageData = data;
    setupJsFilter();

    noActiveFilters = computeNoActiveFilters();

    // Boot only with the first real payload in place: a placeholder/undefined
    // storage message (cold-started SW race) must not consume the startHook
    // slot by setting blockTubeDispatched early.
    if (!hooksStarted) {
      startHook();
    }
    // The comment `...` menu entries (comment-dom.js) need the real
    // options for their labels, so the observer starts with storage in
    // place. Guarded by typeof: the fragment may be absent in stripped builds.
    try {
      if (typeof startCommentObserver === 'function') startCommentObserver();
    } catch (e) {}
  }
  // !! Start
  console.info(`BlockTube Init OK (${BLOCKTUBE_CONSTS.MESSAGES.FROM_CONTENT})`);

  const isMobileInterface = document.location.hostname.startsWith('m.');

  window.addEventListener('yt-navigate-start', () => {
    playerHasBeenBlocked = false;
    // The page-channel cache (paths.js) is per page: continuations of the new
    // page repopulate it from fresh metadata, but until then a stale channel
    // must not attribute the new page's cards.
    pageChannel = null;
    // Shorts skip accounting + skip-fired panel teardown (see
    // shortsSkipNavigationStarted): a navigation we triggered drops its
    // reason panel now instead of carrying it into the next short, while a
    // manual one keeps the panel for the finish handler below. The
    // blocked-Shorts overlay otherwise stays up through the transition (the
    // reel element is reused across shorts — tearing down here flashes the
    // blocked video); yt-navigate-finish below reconciles it for the landed
    // short, and the sweep tick tears it down if the landing is unblocked.
    try {
      if (typeof shortsSkipNavigationStarted === 'function') shortsSkipNavigationStarted();
    } catch (e) {}
    // A swipe lands on pre-rendered reels whose covers were skipped while the
    // previous short held a clean verdict. The new short is undecided again:
    // drop the verdict marker and re-cover its hosts now (synchronously at
    // navigation start) so the finish decision below never races a paint.
    try {
      if (typeof shortsOverlayNavigateStart === 'function') shortsOverlayNavigateStart();
    } catch (e) {}
  });

  window.addEventListener('yt-navigate-finish', () => {
    // A blocked short prefetched before the swipe landed stored its
    // attribution without painting (wrong video on screen then); the landed
    // short paints now when it is a known-blocked one — including a
    // swipe-back target from the remembered map, whose player response may
    // come from cache with no ids left to trigger the player-response path.
    // Remove first so a panel carried through the transition never shows a
    // stale reason on the new short (or lingers on an unblocked one).
    // A landing with no blocked paint target is clean: lift its covers.
    try {
      if (typeof removeShortsOverlay === 'function') removeShortsOverlay();
    } catch (e) {}
    try {
      if (typeof shortsOverlayLandingReveal === 'function') shortsOverlayLandingReveal();
    } catch (e) {}
    try {
      if (typeof shortsOverlayPaintCurrent === 'function') shortsOverlayPaintCurrent();
    } catch (e) {}
  });

  // listen for messages from content script
  window.addEventListener(
    'message',
    (event) => {
      if (event.source !== window) return;
      if (!event.data.from || event.data.from !== BLOCKTUBE_CONSTS.MESSAGES.FROM_CONTENT) return;

      switch (event.data.type) {
        case BLOCKTUBE_CONSTS.MESSAGES.STORAGE: {
          storageReceived(event.data.data);
          break;
        }
        case BLOCKTUBE_CONSTS.MESSAGES.RELOAD:
          window.blockTubeReloadRequired = true;
          openToast('BlockTube was updated, Please reload this tab to reactivate it', 15000);
          break;
        default:
          break;
      }
    },
    true,
  );

  window.blockTubeExports = {
    spfFilter,
    fetchFilter,
    openToast,
    menuOnTap,
    menuOnTapMobile,
    startCommentObserver: typeof startCommentObserver === 'function' ? startCommentObserver : undefined,
    resolveCommentChannel:
      typeof resolveCommentChannel === 'function' ? resolveCommentChannel : undefined,
    rememberCommentAuthor:
      typeof rememberCommentAuthor === 'function' ? rememberCommentAuthor : undefined,
    commentMenuEntries:
      typeof commentMenuEntries === 'function' ? commentMenuEntries : undefined,
    collapseCommentText:
      typeof collapseCommentText === 'function' ? collapseCommentText : undefined,
    validateCommentEntry:
      typeof validateCommentEntry === 'function' ? validateCommentEntry : undefined,
    compileCommentRuleLive:
      typeof compileCommentRuleLive === 'function' ? compileCommentRuleLive : undefined,
  };
