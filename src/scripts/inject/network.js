  // Root shape of a reel response for the menu diagnostics (the topbar
  // branch needs a `reelItemWatchResponse` root that live responses may not
  // have — this line shows what they actually look like). Debug-gated: zero
  // work in prod. Never throws.
  function reelResponseKeys(resp) {
    try {
      if (resp === null || resp === undefined) return String(resp);
      if (typeof resp !== 'object') return typeof resp;
      if (resp instanceof Array) {
        const first = resp[0];
        return {
          array: resp.length,
          firstKeys:
            first && typeof first === 'object' ? Object.keys(first).slice(0, 15) : typeof first,
        };
      }
      return Object.keys(resp).slice(0, 15);
    } catch (e) {
      return '?';
    }
  }

  function fetchFilter(url, resp) {
    if (storageData === undefined) return;

    if (['/youtubei/v1/search', '/youtubei/v1/browse'].includes(url.pathname)) {
      ObjectFilter(resp, filterRules.main, [], true);
    } else if (url.pathname === '/youtubei/v1/get_watch') {
      if (!(resp instanceof Array)) return;
      resp.forEach((o) => {
        if (o.responseType === 'STREAMING_WATCH_RESPONSE_TYPE_PLAYER_RESPONSE') {
          playerHasBeenBlocked = false;
          ObjectFilter(o.playerResponse, filterRules.ytPlayer, [playerMiscFilters]);
        } else if (o.responseType === 'STREAMING_WATCH_RESPONSE_TYPE_WATCH_NEXT_RESPONSE') {
          const postActions = [fixAutoplay];
          if (playerHasBeenBlocked) postActions.push(redirectToNext);
          ObjectFilter(o.watchNextResponse, mergedFilterRules, postActions, true);
        }
      });
    } else if (['/youtubei/v1/next'].includes(url.pathname)) {
      const postActions = [fixAutoplay];
      if (playerHasBeenBlocked) postActions.push(redirectToNext);
      ObjectFilter(resp, mergedFilterRules, postActions, true);
    } else if (
      ['/youtubei/v1/reel/reel_item_watch', '/youtubei/v1/reel/reel_watch_sequence'].includes(
        url.pathname,
      )
    ) {
      // Swiping between Shorts loads each reel (overlay, channel bar and the
      // `...` menu the Block entries live in) through these endpoints, shaped
      // like a watch-next response. Same treatment as /next above, minus the
      // autoplay fixups (no two-column results here): filter what matches and
      // stamp the Block menu entries.
      try {
        if (btMenusDebugEnabled()) {
          btLogMenu('reel-root', { endpoint: url.pathname, keys: reelResponseKeys(resp) });
        }
      } catch (e) {}
      ObjectFilter(resp, mergedFilterRules, [], true);
    } else if (url.pathname === '/youtubei/v1/guide') {
      ObjectFilter(resp, filterRules.guide, [], true);
    } else if (url.pathname === '/youtubei/v1/player') {
      playerHasBeenBlocked = false;
      ObjectFilter(resp, filterRules.ytPlayer, [playerMiscFilters]);
    } else if (url.pathname === '/youtubei/v1/live_chat/get_live_chat') {
      ObjectFilter(resp, filterRules.comments, [], true);
    }
  }

  // One SPF part carrying an embedded player: hydrate the raw response and
  // run the player filter. Guards the JSON parse — a malformed payload passes
  // through unfiltered.
  function filterSpfPlayer(obj) {
    try {
      const player_resp = getObjectByPath(obj.player, 'args.player_response');
      obj.player.args.raw_player_response = JSON.parse(player_resp);
    } catch (e) {}
    playerHasBeenBlocked = false;
    ObjectFilter(obj.player, filterRules.ytPlayer, [playerMiscFilters]);
  }

  // One SPF part carrying a top-level playerResponse: filter it directly.
  function filterSpfPlayerResponse(obj) {
    playerHasBeenBlocked = false;
    ObjectFilter(obj.playerResponse, filterRules.ytPlayer);
  }

  // Resolve the rule set + post actions for an SPF response/data part from
  // the request pathname. Watch pages reuse the main rules with autoplay
  // fixups; unknown paths fall through to main as well.
  function spfRulesFor(pathname) {
    let rules;
    let postActions = [];
    switch (pathname) {
      case '/guide_ajax':
        rules = filterRules.guide;
        break;
      case '/comment_service_ajax':
      case '/live_chat/get_live_chat':
        rules = filterRules.comments;
        break;
      case '/watch':
        postActions = [fixAutoplay];
        if (playerHasBeenBlocked) postActions.push(redirectToNext);
      // the watch page uses the same catch-all rule set below
      // falls through
      default:
        rules = filterRules.main;
    }
    return { rules, postActions };
  }

  // One SPF part carrying response/data: filter it with the pathname's rules.
  function filterSpfPayload(obj, pathname) {
    const { rules, postActions } = spfRulesFor(pathname);
    ObjectFilter(obj.response || obj.data, rules, postActions, true);
  }

  // Filter one SPF part: player, playerResponse, and response/data shapes
  // each get their own helper above.
  function filterSpfPart(obj, pathname) {
    if (has.call(obj, 'player')) {
      filterSpfPlayer(obj);
    }

    if (has.call(obj, 'playerResponse')) {
      filterSpfPlayerResponse(obj);
    }

    if (has.call(obj, 'response') || has.call(obj, 'data')) {
      filterSpfPayload(obj, pathname);
    }
  }

  function spfFilter(url, resp) {
    if (storageData === undefined) return;

    let ytDataArr = resp.part || resp.response.parts || resp.response;
    ytDataArr = ytDataArr instanceof Array ? ytDataArr : [ytDataArr];

    ytDataArr.forEach((obj) => filterSpfPart(obj, url.pathname));
  }

  function blockMixes(data) {
    if (!Array.isArray(data.filterData.channelName)) data.filterData.channelName = [];
    data.filterData.channelName.push(/^YouTube$/);
  }

  function blockTrending(data) {
    if (!Array.isArray(data.filterData.channelId)) data.filterData.channelId = [];

    if (
      document.location.pathname === '/feed/trending' ||
      document.location.pathname === '/feed/explore'
    ) {
      redirectToIndex();
    }

    data.filterData.channelId.push(/^FEtrending$/);
    data.filterData.channelId.push(/^FEexplore$/);
    // Mobile Explore tab
    data.filterData.channelId.push(/^EXPLORE_DESTINATION$/);
  }

  function blockShorts(data) {
    if (!Array.isArray(data.filterData.channelId)) data.filterData.channelId = [];

    if (document.location.pathname.startsWith('/shorts/')) {
      redirectToIndex();
    }

    data.filterData.channelId.push(/^TAB_SHORTS$/);
    data.filterData.channelId.push(/^TAB_SHORTS_CAIRO$/);
    data.filterData.channelId.push(/^.+\/shorts$/);
  }

  // The autoplay region is present and its overlay renderer is missing (it was
  // filtered out) → the overlay needs rebuilding from the next video row.
  function autoplayOverlayPresent(object) {
    if (getObjectByPath(object, 'playerOverlays.playerOverlayRenderer.autoplay') === undefined) {
      return false;
    }
    return (
      getObjectByPath(
        object,
        'playerOverlays.playerOverlayRenderer.autoplay.playerOverlayAutoplayRenderer',
      ) === undefined
    );
  }

  // The autoplay "sets" array from the right-hand column; the overlay is
  // rebuilt from its video. Undefined when the response lacks a next row.
  function nextVideoSet(object) {
    let autoPlay = getObjectByPath(
      object,
      'contents.twoColumnWatchNextResults.autoplay.autoplay.sets',
    );
    if (autoPlay === undefined) return undefined;
    autoPlay = autoPlay[0]?.autoplayVideo;
    if (autoPlay === undefined) return undefined;
    return autoPlay;
  }

  function fixAutoplay() {
    if (!this?.object?.playerOverlays) return;
    if (isMobileInterface) return fixAutoPlayMobile.call(this);

    if (!autoplayOverlayPresent(this.object)) return;

    const autoPlay = nextVideoSet(this.object);
    if (autoPlay === undefined) return;
    try {
      const videoId = findNextVideo(this.object);
      if (videoId !== null) {
        autoPlay.videoId = videoId;
        autoPlay.watchEndpoint.videoId = videoId;
      } else {
        delete this.object.contents.twoColumnWatchNextResults.autoplay;
      }
      this.object.responseContext.webResponseContextExtensionData.webPrefetchData.navigationEndpoints =
        [];
    } catch (e) {
      delete this.object.contents.twoColumnWatchNextResults.autoplay;
    }
  }

  // Resolve the video id of the "up next" row from a watchNextResponse.
  // Returns null when no next-video renderer is present, so it can also serve
  // as a "is there a next video?" check.
  function findNextVideo(object) {
    let secondaryResults = getObjectByPath(
      object,
      'contents.twoColumnWatchNextResults.secondaryResults.secondaryResults.results',
    );
    if (secondaryResults === undefined) return null;

    const chipSection = secondaryResults.findIndex((x) => has.call(x, 'itemSectionRenderer'));
    if (chipSection !== -1) {
      secondaryResults = getObjectByPath(
        secondaryResults[chipSection],
        'itemSectionRenderer.contents',
      );
      if (secondaryResults === undefined) return null;
    }

    const compactVideoIndex = secondaryResults.findIndex((x) =>
      has.call(x, 'compactVideoRenderer'),
    );
    if (compactVideoIndex !== -1) {
      return secondaryResults[compactVideoIndex].compactVideoRenderer.videoId;
    }

    const lockupIndex = secondaryResults.findIndex((x) => has.call(x, 'lockupViewModel'));
    if (lockupIndex === -1) return null;
    return secondaryResults[lockupIndex].lockupViewModel.contentId;
  }
