  // !! Continuation pump
  //
  // Filtering is data-layer only: blocked renderers are deleted from the JSON
  // before YouTube renders it (object-filter.js). On a feed that loses enough
  // items, the page collapses to a batch shorter than the viewport, so there is
  // nothing to scroll — and YouTube's continuation loader is geometry-driven,
  // so it never runs. The feed is stuck at the first batch.
  //
  // This fragment does NOT reissue the network flow. It nudges YouTube's own
  // loader with a single feature-detected call to the continuation item's
  // `triggerContinuation()`, which resumes YouTube's loop; that loop then
  // cascades several batches on its own. (Synthetic scroll/wheel/scrollIntoView
  // were probed and provoke nothing on a non-scrollable page, so they are not
  // used.) Everything here fails open: a renamed/absent method, a hostile realm
  // or a thrown DOM read leaves the feed exactly as it is today.

  // Infinite-scroll surfaces only; the watch page's next rail is out of scope
  // (phase 2). Route shapes: home, search, any /feed/*, channel pages.
  const PUMP_ROUTES = new Set(['/', '/results', '/feed/subscriptions', '/feed/trending']);
  const PUMP_ROUTE_PREFIXES = ['/feed/', '/channel/', '/@', '/c/', '/user/', '/playlist'];

  // Tick cadence; a single trigger cascades at least one batch, so never
  // re-nudge while one is in flight (cooldown). PUMP_MAX_STALL_MS is the one
  // hard bound on a wall of blocked batches: wall-clock, so it still holds when
  // background tabs throttle the timer (fewer ticks, same deadline).
  const PUMP_INTERVAL_MS = 700;
  const PUMP_NUDGE_COOLDOWN_MS = 2100;
  const PUMP_UNDERFILL_MARGIN = 300;
  const PUMP_MAX_STALL_MS = 15000;
  // The pump often arms from the initial payload, before YouTube has rendered
  // the feed. A missing sentinel so early means "not painted yet", not
  // "exhausted", so only give up on its absence after this grace.
  const PUMP_ARM_GRACE_MS = 6000;

  let pumpTimer = null;
  let pumpRunning = false;
  let pumpEpoch = 0;
  let pumpAttempts = 0;
  let pumpStartedAt = 0;
  let pumpLastAttemptAt = 0;
  let pumpSawItem = false;

  // Is this pathname one we may pump? Never throws (anonymous realms return
  // false and the pump simply stays off).
  function isContinuationRoute() {
    try {
      const path = document.location.pathname;
      if (PUMP_ROUTES.has(path)) return true;
      return PUMP_ROUTE_PREFIXES.some((prefix) => path.startsWith(prefix));
    } catch (e) {
      return false;
    }
  }

  // The sentinel is not a rule target, so it survives filtering while more
  // pages remain; its absence means the list is exhausted.
  function continuationItemPresent() {
    try {
      return !!document.querySelector('ytd-continuation-item-renderer');
    } catch (e) {
      return false;
    }
  }

  // A short filtered feed has no scrollbar, which is exactly what starves
  // YouTube's loader. The margin lets a nearly-full page count as filled.
  function pageUnderfilled() {
    try {
      const scroller = document.scrollingElement || document.documentElement;
      const height = Math.max(
        scroller ? scroller.scrollHeight : 0,
        document.body ? document.body.scrollHeight : 0,
      );
      const viewport = window.innerHeight || (scroller && scroller.clientHeight) || 0;
      return height <= viewport + PUMP_UNDERFILL_MARGIN;
    } catch (e) {
      return false;
    }
  }

  // Call YouTube's own continuation loader. The primary method is internal and
  // unversioned, so every rung is feature-detected + try/catched; the fallbacks
  // are the sibling 0-arg scroll handlers found live beside it. Returns true
  // when a rung was invoked.
  function nudgeContinuation() {
    try {
      const cont = document.querySelector('ytd-continuation-item-renderer');
      if (cont && typeof cont.triggerContinuation === 'function') {
        cont.triggerContinuation();
        return true;
      }
      const rich = document.querySelector('ytd-rich-grid-renderer');
      if (rich && typeof rich.onScroll === 'function') {
        rich.onScroll();
        return true;
      }
      const browse = document.querySelector('ytd-browse');
      if (browse && typeof browse.onScroll === 'function') {
        browse.onScroll();
        return true;
      }
      if (cont && typeof cont.onScroll === 'function') {
        cont.onScroll();
        return true;
      }
    } catch (e) {}
    return false;
  }

  // One-line diagnosis for a feed that stayed short through the whole budget
  // (all-blocked continuation wall). Rare enough to log; silent while healthy.
  function logContinuationGiveup() {
    try {
      console.info(
        `[BlockTube] feed still short after ${pumpAttempts} continuation attempt(s); leaving it to YouTube`,
      );
    } catch (e) {}
  }

  // One tick: stop when YouTube has no more to give or the user can scroll
  // again; otherwise nudge at most once per cooldown, bounded by total stall
  // time. Returns true when the pump should stop.
  function continuationPumpTick() {
    const hasItem = continuationItemPresent();
    if (hasItem) {
      pumpSawItem = true;
    } else {
      // Once seen, a gone sentinel means the list is exhausted; before the
      // feed has painted at all, wait out the grace instead of stopping early.
      if (pumpSawItem) return true;
      if (Date.now() - pumpStartedAt > PUMP_ARM_GRACE_MS) return true;
      return false;
    }
    if (!pageUnderfilled()) return true;
    const now = Date.now();
    if (now - pumpStartedAt > PUMP_MAX_STALL_MS) {
      logContinuationGiveup();
      return true;
    }
    // Background tabs throttle timers; wait rather than nudge blind.
    try {
      if (document.visibilityState && document.visibilityState !== 'visible') return false;
    } catch (e) {}
    if (now - pumpLastAttemptAt >= PUMP_NUDGE_COOLDOWN_MS) {
      pumpLastAttemptAt = now;
      pumpAttempts += 1;
      nudgeContinuation();
    }
    return false;
  }

  // Start the tick loop for the current page. Idempotent: a second filtered
  // response while the pump runs is ignored (the loop already covers it).
  function armContinuationPump() {
    if (pumpRunning) return;
    if (typeof setInterval !== 'function') return;
    const epoch = pumpEpoch;
    pumpAttempts = 0;
    pumpStartedAt = Date.now();
    pumpLastAttemptAt = 0;
    pumpSawItem = false;
    pumpRunning = true;
    // Clear the captured handle, not the module-level one: a navigation reset
    // followed by a re-arm reassigns pumpTimer, and this callback must never
    // clear that newer pump.
    const timer = setInterval(() => {
      let done = true;
      try {
        done = epoch !== pumpEpoch ? true : continuationPumpTick();
      } catch (e) {
        done = true;
      }
      if (done) {
        try {
          clearInterval(timer);
        } catch (e) {}
        if (pumpTimer === timer) {
          pumpTimer = null;
          pumpRunning = false;
        }
      }
    }, PUMP_INTERVAL_MS);
    pumpTimer = timer;
  }

  // Drop the loop on navigation: the next page's payload re-arms it with fresh
  // telemetry, and the epoch stops an orphaned timer from nudging the new page.
  function resetContinuationPump() {
    pumpEpoch += 1;
    pumpRunning = false;
    pumpSawItem = false;
    if (pumpTimer !== null) {
      try {
        clearInterval(pumpTimer);
      } catch (e) {}
      pumpTimer = null;
    }
  }

  // Called after filtering an infinite-scroll payload with the ObjectFilter
  // instance that ran it. Arms the pump only when that pass actually removed
  // something AND left more pages on the table — the exact stall condition.
  function maybePumpContinuation(instance) {
    try {
      if (!instance || !instance.deletedCount || !instance.sawContinuation) return;
      if (!isContinuationRoute()) return;
      armContinuationPump();
    } catch (e) {}
  }
