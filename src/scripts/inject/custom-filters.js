  // !! Custom filtering functions

  // Which field matched, filled in by matchFilterProperties so the error panel
  // can say what actually triggered the block.
  let matchedFilterField = null;

  function getMatchedFilterText() {
    if (matchedFilterField === null) return null;
    const value = matchedFilterField.value;
    if (value !== undefined) {
      return `${matchedFilterField.name}: ${String(value).slice(0, 40)}`;
    }
    return matchedFilterField.name;
  }

  // Keep the native error panel informative even when block_message is empty.
  function getBlockMessage() {
    const rule = getMatchedFilterText();
    const message =
      storageData.options[OPT.BLOCK_MESSAGE] || 'Video blocked by BlockTube filter';
    return rule ? `${message} (${rule})` : message;
  }

  // Mark the player response as errored so YouTube shows a reason on screen
  // instead of a blank/black player.
  function setPlayerBlocked(ytData) {
    const message = getBlockMessage();
    try {
      ytData.playabilityStatus = {
        status: 'ERROR',
        reason: message,
        errorScreen: {
          playerErrorMessageRenderer: {
            reason: {
              simpleText: message,
            },
          },
        },
      };
    } catch (e) {}
  }

  function disableEmbedPlayer(ytData) {
    if (storageData.options[OPT.SUGGESTIONS_ONLY]) {
      return false;
    }

    censorTitle();
    setPlayerBlocked(ytData);
    playerHasBeenBlocked = true;
    return true;
  }

  function disablePlayer(ytData) {
    if (storageData.options[OPT.SUGGESTIONS_ONLY]) {
      return false;
    }

    // disablePlayer deletes every prop below; resolve the attribution first
    // (the skip sweep and the overlay key on it — one sweep per video).
    const blockedAttribution = blockedPlayerAttribution(ytData);
    for (const prop of Object.getOwnPropertyNames(ytData)) {
      try {
        delete ytData[prop];
      } catch (e) {}
    }
    setPlayerBlocked(ytData);
    skipBlockedShort(blockedAttribution.videoId);
    try {
      showBlockedShortOverlay(blockedAttribution, getBlockMessage());
    } catch (e) {}
    playerHasBeenBlocked = true;
  }

  // Video id of a blocked player response, across the ytPlayer rule shapes
  // (player response root, embed/player-config args). Shared helper:
  // shorts-overlay.js blockedPlayerAttribution() reuses this — keep the name
  // and signature stable. Load order (tools/build-inject.js) guarantees this
  // fragment evaluates before shorts-overlay.js.
  function blockedPlayerVideoId(ytData) {
    const candidates = [
      'videoDetails.videoId',
      'video_id',
      'args.video_id',
      'args.raw_player_response.videoDetails.videoId',
    ];
    for (let i = 0; i < candidates.length; i += 1) {
      const id = getObjectByPath(ytData, candidates[i]);
      if (typeof id === 'string' && id.length > 0) return id;
    }
    return undefined;
  }

  // Skip state for blocked Shorts (see skipBlockedShort): consecutive
  // auto-advance counter (reset on manual navigation), the video id a sweep
  // is armed for (one sweep per video — a player response flows through
  // several ytPlayer rules), whether the last navigation was ours, and when
  // this video's advance was first triggered (a trigger is async — the
  // navigation lands later — so the sweep watches for it instead of
  // assuming).
  let shortsConsecutiveSkips = 0;
  let shortsSkipArmedFor = null;
  let shortsSkipJustFired = false;
  let shortsSkipTriggeredAt = 0;
  // Videos already auto-advanced past once: going back to one (browser back,
  // swipe-back, reel loop) must show the reason panel and stay — force-skip
  // again would make the block reason unreadable. Bounded (insertion-ordered
  // eviction) so a long session cannot grow it without limit.
  let shortsSkipFiredIds = new Set();
  const SHORTS_SKIP_FIRED_CAP = 100;
  // Give up auto-advancing after this many consecutive blocked shorts so a
  // wall of blocked content (e.g. a fully-blocked channel's reel) can never
  // machine-gun the player; the ERROR status above still stops playback.
  const SHORTS_SKIP_CAP = 15;

  // Blocked Shorts are removed, never messaged: advance the reel to the next
  // short while the reason-only overlay (shorts-overlay.js, anchored to the
  // reel item) covers the blocked one. Runs as a short fail-open
  // sweep; when it cannot advance, the overlay reason plus the ERROR status
  // above is the whole effect (the short stays covered instead of playing). Prefetched (not yet watched)
  // shorts stay silent until swiped to; non-Shorts pages keep the native
  // error screen. Exotic realms without timers never schedule the sweep.
  function skipBlockedShort(videoId) {
    if (typeof videoId !== 'string' || videoId.length === 0) return;
    try {
      if (!document.location.pathname.startsWith('/shorts/')) return;
    } catch (e) {
      return;
    }
    try {
      if (!storageData.options[OPT.SHORTS_SKIP_BLOCKED]) return;
    } catch (e) {
      return;
    }
    if (shortsSkipArmedFor === videoId) return;
    if (shortsSkipFiredIds.has(videoId)) return;
    if (shortsConsecutiveSkips >= SHORTS_SKIP_CAP) return;
    shortsSkipArmedFor = videoId;
    shortsSkipTriggeredAt = 0;
    if (typeof setInterval !== 'function') return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      let done = false;
      try {
        done = skipBlockedShortTick(videoId, tries);
      } catch (e) {
        done = false;
      }
      if (done || tries >= 24) {
        try {
          clearInterval(timer);
        } catch (e) {}
        if (shortsSkipArmedFor === videoId) shortsSkipArmedFor = null;
      }
    }, 250);
  }

  // One sweep tick: still on the blocked short? Actuate at most ONCE per
  // video and then only watch for the navigation. Two races make anything
  // more dangerous than that: a manual swipe can land while the URL still
  // shows the armed video (a tick in that window would swipe the user off an
  // innocent short), and a retry after a keys trigger can double-advance past
  // an unblocked short. So: wait out the first ticks for the URL to settle,
  // fire a single trigger, then watch (or time out). True when navigated
  // away or when no navigation followed the trigger within a few seconds.
  function skipBlockedShortTick(videoId, tries) {
    try {
      if (document.location.pathname !== `/shorts/${videoId}`) return true;
    } catch (e) {
      return true;
    }
    if (shortsSkipTriggeredAt > 0) {
      try {
        if (Date.now() - shortsSkipTriggeredAt > 4000) return true;
      } catch (e) {
        return true;
      }
      return false;
    }
    if (tries < 3) return false;
    if (advanceReelToNext()) {
      shortsConsecutiveSkips += 1;
      shortsSkipJustFired = true;
      shortsSkipTriggeredAt = Date.now();
      shortsSkipFiredIds.add(videoId);
      if (shortsSkipFiredIds.size > SHORTS_SKIP_FIRED_CAP) {
        shortsSkipFiredIds.delete(shortsSkipFiredIds.values().next().value);
      }
    }
    return false;
  }

  // Click YouTube's own Next button. True when clicked (navigation lands
  // async — the tick watches for it). Scoped to the reel containers first so
  // a page with many buttons does not pay a full-document scan per tick; the
  // document-wide fallback keeps working if YouTube renames the container.
  function clickReelNextButton() {
    try {
      const scoped = document.querySelectorAll(
        'ytd-reel-video-renderer button, #reel-video-renderer button',
      );
      if (scoped && scoped.length > 0 && pickReelNextButton(scoped)) return true;
    } catch (e) {}
    try {
      return pickReelNextButton(document.querySelectorAll('button'));
    } catch (e) {
      return false;
    }
  }

  function pickReelNextButton(buttons) {
    if (!buttons) return false;
    for (let i = 0; i < buttons.length; i += 1) {
      const label = buttons[i].getAttribute && buttons[i].getAttribute('aria-label');
      if (typeof label === 'string' && /next video/i.test(label)) {
        buttons[i].click();
        return true;
      }
    }
    return false;
  }

  // Send the ArrowDown swipe shortcut, never into text entry (that would
  // type, not swipe). True when dispatched (delivery is not confirmable —
  // the tick watches for the navigation instead).
  function sendReelSwipeKeys() {
    const active = document.activeElement;
    const tag = active && active.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (active && active.isContentEditable)) {
      return false;
    }
    const target = document.querySelector('video') || document.body;
    if (!target || typeof target.dispatchEvent !== 'function') return false;
    ['keydown', 'keyup'].forEach((eventType) => {
      target.dispatchEvent(
        new KeyboardEvent(eventType, {
          key: 'ArrowDown',
          code: 'ArrowDown',
          keyCode: 40,
          which: 40,
          bubbles: true,
          cancelable: true,
        }),
      );
    });
    return true;
  }

  // Advance the reel via YouTube's own affordances. Next button first (a
  // semantic advance regardless of focus); the ArrowDown swipe shortcut as
  // fallback. True when an advance was triggered (its navigation lands
  // async).
  function advanceReelToNext() {
    try {
      if (clickReelNextButton()) return true;
    } catch (e) {}
    try {
      return sendReelSwipeKeys();
    } catch (e) {}
    return false;
  }

  function blockPlaylistVid(pl) {
    const vid = pl.playlistPanelVideoRenderer;
    const message = getBlockMessage();

    vid.videoId = 'undefined';

    vid.unplayableText = {
      simpleText: `${message}`,
    };

    vid.thumbnail = {
      thumbnails: [
        {
          url: 'https://s.ytimg.com/yts/img/meh_mini-vfl0Ugnu3.png',
        },
      ],
    };

    delete vid.title;
    delete vid.longBylineText;
    delete vid.shortBylineText;
    delete vid.thumbnailOverlays;
  }

  // Filter one reel sequence response: the fetch reel endpoints (network.js)
  // and the initial ytInitialReelWatchSequenceResponse (hooks.js). Embedded
  // prefetched player responses carry full videoDetails — verified against a
  // real capture: exactly one videoDetails per sequence, no args/PLAYER_VARS
  // shapes, so the ytPlayer table can only match genuine players. The ytPlayer
  // pass blocks prefetches whose channel matches (wiping their stream and
  // remembering the id for the landing panel + skip sweep, exactly like a
  // /player block); the scrub then neutralizes every preloaded frame,
  // unconditionally (Shorts only — these payloads never leave Shorts).
  // playerHasBeenBlocked is preserved: a prefetch verdict must never leak
  // into the page-level flow that reads the flag after us. Fail-open.
  function filterReelSequenceResponse(resp) {
    if (!resp || typeof resp !== 'object') return;
    const wasBlocked = playerHasBeenBlocked;
    try {
      ObjectFilter(resp, filterRules.ytPlayer, []);
    } catch (e) {}
    try {
      playerHasBeenBlocked = wasBlocked;
    } catch (e) {}
    try {
      scrubReelThumbnails.call({ object: resp });
    } catch (e) {}
  }
  // Blanket video-thumbnail scrub for the reel responses (reel_item_watch,
  // reel_watch_sequence — Shorts pages only): every video frame/poster URL in
  // the payload is replaced with a neutral placeholder, unconditionally. Reel
  // entries carry no channel linkage, and the point is precisely that no
  // preloaded frame ever paints: blocked or not, the video itself still loads
  // and plays, so allowed shorts are unaffected beyond their preload image.
  // Only i.ytimg.com frame/poster URLs are touched — channel avatars (yt3)
  // and menu icons stay intact, and player responses ride a different
  // endpoint branch (streams must survive for playback). Fail-open throughout.
  function scrubReelThumbnailUrls(node) {
    try {
      if (!node || typeof node !== 'object' || node instanceof Array) return;
      for (const key of ['thumbnails', 'sources']) {
        try {
          const list = node[key];
          if (!(list instanceof Array)) continue;
          for (let i = 0; i < list.length; i += 1) {
            try {
              const item = list[i];
              if (
                item &&
                typeof item.url === 'string' &&
                item.url.indexOf('i.ytimg.com') !== -1
              ) {
                item.url = 'https://s.ytimg.com/yts/img/meh_mini-vfl0Ugnu3.png';
              }
            } catch (e) {}
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  function scrubReelThumbnails() {
    const resp = this && this.object;
    if (!resp || typeof resp !== 'object') return;
    const visitReelThumbs = (node) => {
      try {
        if (!node || typeof node !== 'object') return;
        if (node instanceof Array) {
          for (let i = 0; i < node.length; i += 1) visitReelThumbs(node[i]);
          return;
        }
        scrubReelThumbnailUrls(node);
        const keys = Object.getOwnPropertyNames(node);
        for (let i = 0; i < keys.length; i += 1) {
          try {
            visitReelThumbs(node[keys[i]]);
          } catch (e) {}
        }
      } catch (e) {}
    };
    try {
      visitReelThumbs(resp);
    } catch (e) {}
  }

  function markAutoplay(obj, name) {
    if (isMobileInterface) {
      obj.playerOverlayAutoplayRenderer._deleted = true;
      return false;
    }
    return true;
  }

  function redirectToIndex() {
    if (storageData && storageData.options[OPT.SUGGESTIONS_ONLY]) {
      return false;
    }

    if (this && this.object) this.object = undefined;
    const index = document.location.search.indexOf('&list=');
    if (index !== -1) {
      const value = document.location.search.substring(0, index);
      document.location = document.location.pathname + value;
    } else {
      document.location = '/';
    }
  }

  function censorTitle() {
    const listener = function () {
      document.title = 'YouTube';
      window.removeEventListener('yt-update-title', listener);
    };
    window.addEventListener('yt-update-title', listener);

    window.addEventListener('load', () => {
      document.title = 'YouTube';
    });
  }

  // Mobile watch-next feed section: the itemSectionRenderer whose target is
  // the watch-next feed, or undefined when the feed has no such section.
  function findWatchNextSection(nextResults) {
    for (const [, v] of nextResults.entries()) {
      if (
        has.call(v, 'itemSectionRenderer') &&
        v.itemSectionRenderer.targetId === 'watch-next-feed'
      ) {
        return v.itemSectionRenderer;
      }
    }
    return undefined;
  }

  // Copy the next-video renderer fields onto the mobile autoplay overlay so
  // playback continues from the right video after the block.
  function applyNextVideoToOverlay(playerOverlay, nextVideoRenderer) {
    playerOverlay.videoTitle = nextVideoRenderer.headline;
    playerOverlay.byline = nextVideoRenderer.shortBylineText;
    playerOverlay.background = nextVideoRenderer.thumbnail;
    playerOverlay.nextButton.buttonRenderer.navigationEndpoint =
      nextVideoRenderer.navigationEndpoint;
    playerOverlay.thumbnailOverlays = nextVideoRenderer.thumbnailOverlays;
    playerOverlay.videoId = nextVideoRenderer.videoId;
    playerOverlay.shortViewCountText = nextVideoRenderer.shortViewCountText;
  }

  // Point the mobile autoplay set at the next video's endpoints.
  function applyNextVideoToAutoplaySet(autoplaySet, nextVideoRenderer) {
    autoplaySet.commandMetadata = nextVideoRenderer.navigationEndpoint.commandMetadata;
    autoplaySet.watchEndpoint = nextVideoRenderer.navigationEndpoint.watchEndpoint;
  }

  function fixAutoPlayMobile() {
    const playerOverlay = getObjectByPath(
      this.object,
      'playerOverlays.playerOverlayRenderer.autoplay.playerOverlayAutoplayRenderer',
    );
    if (!playerOverlay._deleted) return;

    const nextResults = getObjectByPath(
      this.object,
      'contents.singleColumnWatchNextResults.results.results.contents',
    );
    if (!nextResults) return;

    const nextSection = findWatchNextSection(nextResults);
    const nextVideoRenderer = getObjectByPath(nextSection, 'contents.videoWithContextRenderer');
    if (!nextVideoRenderer) return;

    applyNextVideoToOverlay(playerOverlay, nextVideoRenderer);

    const autoplaySet = getObjectByPath(
      this.object,
      'contents.singleColumnWatchNextResults.autoplay.autoplay.sets.autoplayVideo',
    );
    if (!autoplaySet) return;

    applyNextVideoToAutoplaySet(autoplaySet, nextVideoRenderer);
  }

  // Mobile next-video redirect: navigate to the feed's next video and drop
  // the blocked contents. No-op on playlists (they provide the next row).
  function redirectMobileToNextVideo(nextSection) {
    const nextAutoPlayObj = getObjectByPath(nextSection, 'contents.videoWithContextRenderer');
    if (!nextAutoPlayObj) return;

    document.location = `watch?v=${nextAutoPlayObj.videoId}`;
    delete this.object.contents;
  }

  function redirectToNextMobile() {
    playerHasBeenBlocked = false;

    if (storageData.options[OPT.SUGGESTIONS_ONLY]) {
      return false;
    }

    const isPlaylist = new URL(document.location).searchParams.has('list');
    if (isPlaylist) return;

    const nextResults = getObjectByPath(
      this.object,
      'contents.singleColumnWatchNextResults.results.results.contents',
    );
    if (!nextResults) return;

    if (storageData.options[OPT.AUTOPLAY] !== true) {
      delete this.object.contents;
      return;
    }

    const nextSection = findWatchNextSection(nextResults) || nextResults;
    redirectMobileToNextVideo.call(this, nextSection);
  }

  // Break out of the playlist context check / navigation decision: playlists
  // provide the next row themselves, so we must NOT redirect to a plain video.
  function shouldRedirectToNextVideo() {
    return !new URL(document.location).searchParams.has('list');
  }

  function redirectToNextVideo(vidId) {
    if (vidId !== null) {
      document.location = `watch?v=${vidId}`;
    }
  }

  function redirectToNext() {
    if (isMobileInterface) return redirectToNextMobile.call(this);

    playerHasBeenBlocked = false;

    if (storageData.options[OPT.SUGGESTIONS_ONLY]) {
      return false;
    }

    censorTitle();

    const twoColumn = getObjectByPath(this.object, 'contents.twoColumnWatchNextResults');
    if (twoColumn === undefined) return;

    const primary = getObjectByPath(twoColumn, 'results.results');
    if (primary === undefined) return;
    primary.contents = [];

    if (has.call(twoColumn, 'conversationBar')) delete twoColumn.conversationBar;

    if (!shouldRedirectToNextVideo()) {
      return;
    }

    const secondary = getObjectByPath(twoColumn, 'secondaryResults');
    if (secondary === undefined) return;
    if (storageData.options[OPT.AUTOPLAY] !== true) {
      secondary.secondaryResults = undefined;
      return;
    }

    redirectToNextVideo(findNextVideo(this.object));
    secondary.secondaryResults = undefined;
  }

  // "You there?" confirm dialogs that interrupt playback on idle.
  function removeYouThereMessages(playerResponse) {
    const playerMessages = getObjectByPath(playerResponse, 'messages', []);
    for (let i = playerMessages.length - 1; i >= 0; i -= 1) {
      if (has.call(playerMessages[i], 'youThereRenderer')) {
        playerMessages.splice(i, 1);
      }
    }
  }

  // Strip loudness metadata so YouTube stops normalizing volume across videos.
  function disableLoudnessNormalization(playerResponse) {
    const audioConfig = getObjectByPath(playerResponse, 'playerConfig.audioConfig');
    if (audioConfig !== undefined) {
      audioConfig.loudnessDb = null;
      audioConfig.perceptualLoudnessDb = null;
      audioConfig.enablePerFormatLoudness = false;
    }
    const streamConfig = getObjectByPath(playerResponse, 'streamingData.adaptiveFormats', []);
    streamConfig.forEach((conf) => {
      if (conf.loudnessDb !== undefined) {
        conf.loudnessDb = 0.0;
      }
    });
  }

  function playerMiscFilters() {
    let playerResponse = getObjectByPath(this.object, 'args.raw_player_response');
    playerResponse = playerResponse ? playerResponse : this.object;

    if (storageData.options[OPT.DISABLE_YOU_THERE] === true) {
      removeYouThereMessages(playerResponse);
    }

    if (storageData.options[OPT.DISABLE_DB_NORMALIZE] === true) {
      disableLoudnessNormalization(playerResponse);
    }
  }
