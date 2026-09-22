/*
 * GENERATED FILE - DO NOT EDIT.
 *
 * Source fragments: src/scripts/consts.js + src/scripts/inject/*.js (see
 * MODULES in tools/build-inject.js).
 * Rebuild with: npm run build:inject    |    Drift-check with: npm run check:inject
 */

(function blockTube() {
  'use strict';

  // ================== src/scripts/consts.js ==================

  const BLOCKTUBE_CONSTS = Object.freeze({
    MESSAGES: Object.freeze({
      // chrome.storage.local keys
      STORAGE_KEY: 'storageData',
      ENABLED_KEY: 'enabled',

      // window.postMessage framing
      FROM_PAGE: 'blockTubePage', // page -> content: postMessage from the inject bundle
      FROM_CONTENT: 'blockTubeContent', // content -> page: sendStorage / sendReload
      STORAGE: 'storageData', // content -> page: compiled storage snapshot
      RELOAD: 'reloadRequired', // bg->content (port) or content->page: extension updated, hard-reload
      FILTERS: 'filtersData', // bg -> content (port): {storage, compiledStorage, enabled}
      CONTEXT_BLOCK_DATA: 'contextBlockData', // page -> content: block from context menu
      CONTEXT_BLOCK: 'contextBlock', // content -> bg (port): {type, entries}
      READY: 'ready', // page -> content: hooks booted, re-send storage
    }),
    // storage.options keys referenced across realms (bg / options / inject).
    OPTIONS: Object.freeze({
      TRENDING: 'trending',
      MIXES: 'mixes',
      CHIPS_SHELVES: 'chips_shelves',
      SHORTS: 'shorts',
      MOVIES: 'movies',
      SUGGESTIONS_ONLY: 'suggestions_only',
      AUTOPLAY: 'autoplay',
      ENABLE_JAVASCRIPT: 'enable_javascript', // custom JS filter opt-in switch
      BLOCK_MESSAGE: 'block_message',
      BLOCK_FEEDBACK: 'block_feedback',
      DISABLE_DB_NORMALIZE: 'disable_db_normalize',
      DISABLE_YOU_THERE: 'disable_you_there',
      DISABLE_ON_HISTORY: 'disable_on_history',
      VIDLENGTH_TYPE: 'vidLength_type',
      PERCENT_WATCHED_HIDE: 'percent_watched_hide',
    }),
  });

  // filterData keys the CONTEXT_BLOCK path may write to; enforced in both the
  // content script and the background (page scripts can forge the type field).
  const CONTEXT_BLOCK_TYPES = Object.freeze(['channelId', 'videoId']);

  globalThis.BLOCKTUBE_CONSTS = BLOCKTUBE_CONSTS;
  globalThis.CONTEXT_BLOCK_TYPES = CONTEXT_BLOCK_TYPES;

  // ================== src/scripts/inject/rules.js ==================

  // Short alias for option keys; keep in sync with BLOCKTUBE_CONSTS.OPTIONS.
  const OPT = BLOCKTUBE_CONSTS.OPTIONS;
  // add context menu to following objects
  const contextMenuObjects = [
    'backstagePostRenderer',
    'postRenderer',
    'movieRenderer',
    'compactMovieRenderer',
    'videoRenderer',
    'gridVideoRenderer',
    'compactVideoRenderer',
    'videoPrimaryInfoRenderer',
    'commentRenderer',
    'playlistPanelVideoRenderer',
    'playlistVideoRenderer',
    'lockupViewModel',
    'videoCardRenderer',
    // Mobile
    'reelItemRenderer',
    'slimVideoMetadataSectionRenderer',
    'videoWithContextRenderer',
  ];
  const contextMenuObjectsSet = new Set(contextMenuObjects);

  // Wrapper renderers that are safe to delete as a whole when every one of
  // their children was filtered out (they contribute no layout of their own).
  const collapseableContainers = [
    'richItemRenderer',
    'content',
    'horizontalListRenderer',
    'verticalListRenderer',
    'shelfRenderer',
    'richShelfRenderer',
    'gridRenderer',
    'expandedShelfContentsRenderer',
    'comment',
    'commentThreadRenderer',
    'reelShelfRenderer',
    'richSectionRenderer',
  ];
  const collapseableContainersSet = new Set(collapseableContainers);

  // those filter properties require RegExp checking
  const regexProps = ['videoId', 'channelId', 'channelName', 'title', 'comment'];
  const regexPropsSet = new Set(regexProps);

  // Every renderer entry maps to a normalized
  //   { properties: { <filter-prop> -> path(s) }, customFunc?, related? }
  // object, so the matcher never has to sniff which shape a rule uses. The
  // builder below trims the wrapper noise for the two common cases. 'related'
  // names a wrapper renderer (e.g. 'shelfRenderer') to delete alongside.
  // !! Filter Rules definitions
  const paths = (properties, customFunc = undefined, related = undefined) => ({
    properties,
    customFunc,
    related,
  });

  const baseRules = {
    videoId: 'videoId',
    channelId: 'shortBylineText.runs.navigationEndpoint.browseEndpoint.browseId',
    channelBadges: 'ownerBadges',
    channelName: ['shortBylineText', 'longBylineText'],
    title: ['title'],
    vidLength: ['thumbnailOverlays.thumbnailOverlayTimeStatusRenderer.text'],
    viewCount: ['viewCountText'],
    badges: 'badges',
    publishTimeText: ['publishedTimeText'],
    percentWatched:
      'thumbnailOverlays.thumbnailOverlayResumePlaybackRenderer.percentDurationWatched',
  };

  const BADGE_MAP = {
    BADGE_STYLE_TYPE_VERIFIED: 'verified',
    BADGE_STYLE_TYPE_VERIFIED_ARTIST: 'artist',
    BADGE_STYLE_TYPE_LIVE_NOW: 'live',
    BADGE_STYLE_TYPE_MEMBERS_ONLY: 'members',
    BADGE_VERIFIED: 'verified',
    BADGE_VERIFIED_ARTIST: 'artist',
    BADGE_LIVE_NOW: 'live',
    BADGE_MEMBERS_ONLY: 'members',
  };

  // lockupViewModel (new grid) deep path fragments. The channelId rule falls
  // back across avatar -> first metadata row -> avatar stack; these prefixes
  // keep that intent readable in the big rule below.
  const lockupAvatarMedia = 'metadata.lockupMetadataViewModel.image';
  const lockupMetadataContent =
    'metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows';

  const filterRules = {
    main: {
      // Feed and watch-page video cards
      compactMovieRenderer: paths({
        videoId: 'videoId',
        title: ['title'],
        vidLength: 'thumbnailOverlays.thumbnailOverlayTimeStatusRenderer.text',
        badges: 'badges',
        percentWatched:
          'thumbnailOverlays.thumbnailOverlayResumePlaybackRenderer.percentDurationWatched',
      }),
      movieRenderer: paths({
        videoId: 'videoId',
        title: ['title'],
        vidLength: 'thumbnailOverlays.thumbnailOverlayTimeStatusRenderer.text',
        badges: 'badges',
        percentWatched:
          'thumbnailOverlays.thumbnailOverlayResumePlaybackRenderer.percentDurationWatched',
      }),
      gridVideoRenderer: paths(baseRules),
      videoRenderer: paths(baseRules),
      radioRenderer: paths(baseRules),
      playlistRenderer: paths(baseRules),
      gridRadioRenderer: paths(baseRules),
      compactVideoRenderer: paths(baseRules),
      compactRadioRenderer: paths(baseRules),
      playlistVideoRenderer: paths(baseRules),
      endScreenVideoRenderer: paths(baseRules),
      endScreenPlaylistRenderer: paths(baseRules),
      gridPlaylistRenderer: paths(baseRules),

      // Community posts
      postRenderer: paths({
        channelId: 'authorEndpoint.browseEndpoint.browseId',
        channelName: ['authorText'],
      }),
      backstagePostRenderer: paths({
        channelId: 'authorEndpoint.browseEndpoint.browseId',
        channelName: ['authorText'],
      }),

      // Watch page right rail
      watchCardCompactVideoRenderer: paths({
        title: 'title',
        channelId: 'subtitles.runs.navigationEndpoint.browseEndpoint.browseId',
        channelName: 'subtitles',
        videoId: 'navigationEndpoint.watchEndpoint.videoId',
      }),

      shelfRenderer: paths({
        channelId: 'endpoint.browseEndpoint.browseId',
      }),

      channelVideoPlayerRenderer: paths({
        title: 'title',
      }),

      // channel page header
      channelRenderer: paths({ ...baseRules, title: undefined }, undefined, 'shelfRenderer'),

      // watch page playlist panel
      playlistPanelVideoRenderer: paths(baseRules, blockPlaylistVid),

      videoPrimaryInfoRenderer: paths(
        {
          title: 'title',
        },
        redirectToNext,
      ),

      videoSecondaryInfoRenderer: paths(
        {
          channelId: 'owner.videoOwnerRenderer.navigationEndpoint.browseEndpoint.browseId',
          channelName: 'owner.videoOwnerRenderer.title',
        },
        redirectToNext,
      ),

      // channel page header
      channelMetadataRenderer: paths(
        {
          channelId: 'externalId',
          channelName: 'title',
        },
        redirectToIndex,
      ),

      // related channels
      gridChannelRenderer: paths({
        channelId: 'channelId',
        channelName: 'title',
      }),

      miniChannelRenderer: paths({
        channelId: 'channelId',
        channelName: 'title',
      }),

      // sidemenu subscribed channels
      guideEntryRenderer: paths({
        channelId: 'navigationEndpoint.browseEndpoint.browseId',
        channelName: ['title', 'formattedTitle'],
      }),

      universalWatchCardRenderer: paths({
        channelId:
          'header.watchCardRichHeaderRenderer.titleNavigationEndpoint.browseEndpoint.browseId',
        channelName: 'header.watchCardRichHeaderRenderer.title',
      }),

      playlist: paths(
        {
          channelId: 'shortBylineText.runs.navigationEndpoint.browseEndpoint.browseId',
          channelName: ['shortBylineText'],
          title: 'title',
        },
        redirectToIndex,
      ),

      compactChannelRecommendationCardRenderer: paths({
        channelId: 'channelEndpoint.browseEndpoint.browseId',
        channelName: ['channelTitle'],
      }),

      playerOverlayAutoplayRenderer: paths(
        {
          videoId: 'videoId',
          channelId: 'byline.runs.navigationEndpoint.browseEndpoint.browseId',
          channelName: 'byline',
          title: ['videoTitle'],
          publishTimeText: 'publishedTimeText',
          vidLength: 'thumbnailOverlays.thumbnailOverlayTimeStatusRenderer.text',
        },
        markAutoplay,
      ),

      // Shorts
      reelItemRenderer: paths({
        videoId: 'videoId',
        channelId:
          'navigationEndpoint.reelWatchEndpoint.overlay.reelPlayerOverlayRenderer.reelPlayerHeaderSupportedRenderers.reelPlayerHeaderRenderer.channelNavigationEndpoint.browseEndpoint.browseId',
        channelName:
          'navigationEndpoint.reelWatchEndpoint.overlay.reelPlayerOverlayRenderer.reelPlayerHeaderSupportedRenderers.reelPlayerHeaderRenderer.channelTitleText',
        title: ['headline'],
        publishTimeText:
          'navigationEndpoint.reelWatchEndpoint.overlay.reelPlayerOverlayRenderer.reelPlayerHeaderSupportedRenderers.reelPlayerHeaderRenderer.timestampText',
      }),

      shortsLockupViewModel: paths({
        videoId: 'onTap.innertubeCommand.reelWatchEndpoint.videoId',
        title: 'overlayMetadata.primaryText.content',
        viewCount: 'overlayMetadata.secondaryText.content',
      }),

      richShelfRenderer: paths({
        channelId: 'endpoint.browseEndpoint.browseId',
      }),

      channelFeaturedVideoRenderer: paths({
        ...baseRules,
        vidLength: 'lengthText',
      }),

      videoWithContextRenderer: paths({
        ...baseRules,
        title: 'headline',
        vidLength: ['thumbnailOverlays.thumbnailOverlayTimeStatusRenderer.text'],
        viewCount: 'shortViewCountText',
      }),

      compactChannelRenderer: paths({
        channelId: 'channelId',
        channelName: 'displayName',
        channelBadges: 'ownerBadges',
      }),

      lockupViewModel: paths({
        videoId: 'contentId',
        title: 'metadata.lockupMetadataViewModel.title.content',
        channelName: `${lockupMetadataContent}.metadataParts.text.content`,
        badges: `${lockupMetadataContent}[1].badges`,
        vidLength:
          'contentImage.thumbnailViewModel.overlays.thumbnailOverlayBadgeViewModel.thumbnailBadges.thumbnailBadgeViewModel.text',
        viewCount: `${lockupMetadataContent}[1].metadataParts.text.content`,
        channelId: [
          `${lockupAvatarMedia}.decoratedAvatarViewModel.rendererContext.commandContext.onTap.innertubeCommand.browseEndpoint.browseId`,
          `${lockupMetadataContent}.metadataParts.text.commandRuns.onTap.innertubeCommand.browseEndpoint.browseId`,
          `${lockupAvatarMedia}.avatarStackViewModel.rendererContext.commandContext.onTap.innertubeCommand.showDialogCommand.panelLoadingStrategy.inlineContent.dialogViewModel.customContent.listViewModel.listItems[0].listItemViewModel.rendererContext.commandContext.onTap.innertubeCommand.browseEndpoint.browseId`,
          `${lockupAvatarMedia}.avatarStackViewModel.rendererContext.commandContext.onTap.innertubeCommand.showDialogCommand.panelLoadingStrategy.inlineContent.dialogViewModel.customContent.listViewModel.listItems[1].listItemViewModel.rendererContext.commandContext.onTap.innertubeCommand.browseEndpoint.browseId`,
        ],
        percentWatched:
          'contentImage.thumbnailViewModel.overlays.thumbnailBottomOverlayViewModel.progressBar.thumbnailOverlayProgressBarViewModel.startPercent',
        publishTimeText: `${lockupMetadataContent}[1].metadataParts[1].text.content`,
      }),

      videoCardRenderer: paths({
        videoId: 'videoId',
        title: 'title',
        channelName: 'bylineText',
        vidLength: 'lengthText.simpleText',
        viewCount: 'metadataText.simpleText',
        channelId: ['bylineText.runs.navigationEndpoint.browseEndpoint.browseId'],
        percentWatched:
          'contentImage.thumbnailViewModel.overlays.thumbnailBottomOverlayViewModel.progressBar.thumbnailOverlayProgressBarViewModel.startPercent',
      }),

      // Mobile top chips
      chipCloudChipRenderer: paths({
        channelId: 'icon.iconType',
      }),

      // Mobile Video page data
      slimVideoMetadataSectionRenderer: paths(
        {
          videoId: 'videoId',
          title: 'contents.slimVideoInformationRenderer.title',
          channelId: 'contents.slimOwnerRenderer.navigationEndpoint.browseEndpoint.browseId',
          channelName: 'contents.slimOwnerRenderer.title',
        },
        redirectToNextMobile,
      ),

      tabRenderer: paths({
        channelId: 'endpoint.commandMetadata.webCommandMetadata.url',
      }),

      // Empty for blocking short headers
      gridShelfViewModel: paths({}),

      richSectionRenderer: paths({}),

      // Wholesale-blocked when the chips_shelves option is enabled
      // (see isExtendedMatched); these entries only make the renderer keys
      // recognizable during matching.
      chipsShelfWithVideoShelfRenderer: paths({}),
      brandVideoSingletonRenderer: paths({}),
      brandVideoShelfRenderer: paths({}),
      statementBannerRenderer: paths({}),
    },
    ytPlayer: {
      args: paths(
        {
          videoId: ['video_id', 'raw_player_response.videoDetails.videoId'],
          channelId: ['ucid', 'raw_player_response.videoDetails.channelId'],
          channelName: ['author', 'raw_player_response.videoDetails.author'],
          title: ['title', 'raw_player_response.videoDetails.title'],
          vidLength: ['length_seconds', 'raw_player_response.videoDetails.lengthSeconds'],
        },
        disableEmbedPlayer,
      ),
      videoDetails: paths(
        {
          videoId: 'videoId',
          channelId: 'channelId',
          channelName: 'author',
          title: 'title',
          vidLength: 'lengthSeconds',
        },
        disablePlayer,
      ),
      PLAYER_VARS: paths(
        {
          videoId: ['video_id'],
          channelId: [
            'raw_player_response.embedPreview.thumbnailPreviewRenderer.videoDetails.embeddedPlayerOverlayVideoDetailsRenderer.expandedRenderer.embeddedPlayerOverlayVideoDetailsExpandedRenderer.subscribeButton.subscribeButtonRenderer.channelId',
          ],
          channelName: [
            'raw_player_response.embedPreview.thumbnailPreviewRenderer.videoDetails.embeddedPlayerOverlayVideoDetailsRenderer.expandedRenderer.embeddedPlayerOverlayVideoDetailsExpandedRenderer.title',
          ],
          title: ['raw_player_response.embedPreview.thumbnailPreviewRenderer.title'],
          vidLength: [
            'raw_player_response.embedPreview.thumbnailPreviewRenderer.videoDurationSeconds',
          ],
        },
        disableEmbedPlayer,
      ),
    },
    guide: {
      // sidemenu subscribed channels
      guideEntryRenderer: paths({
        channelId: ['navigationEndpoint.browseEndpoint.browseId', 'icon.iconType'],
        channelName: ['title', 'formattedTitle'],
      }),
      // Mobile buttom navigation bar
      pivotBarItemRenderer: paths({
        channelId: 'icon.iconType',
      }),
    },
    comments: {
      commentEntityPayload: paths({
        channelId: ['author.channelId'],
        channelName: ['author.displayName'],
        comment: ['properties.content.content'],
      }),
      commentThreadRenderer: paths({}),
      commentViewModel: paths({}),
      commentRenderer: paths({
        channelId: 'authorEndpoint.browseEndpoint.browseId',
        channelName: ['authorText'],
        comment: ['contentText'],
      }),
      liveChatTextMessageRenderer: paths({
        channelId: 'authorExternalChannelId',
        channelName: ['authorName'],
        comment: 'message',
      }),
    },
  };

  const mergedFilterRules = Object.assign({}, filterRules.main, filterRules.comments);

  // ================== src/scripts/inject/paths.js ==================

  const has = Object.prototype.hasOwnProperty;
  // !! Utils

  function flattenRuns(arr) {
    if (arr.simpleText !== undefined) return arr.simpleText;
    if (!(arr.runs instanceof Array)) return arr;
    return arr.runs
      .reduce((res, v) => {
        if (has.call(v, 'text')) {
          res.push(v.text);
        }
        return res;
      }, [])
      .join(' ');
  }

  function getFlattenByPath(obj, filterPath) {
    if (filterPath === undefined) return;
    const filterPathArr = filterPath instanceof Array ? filterPath : [filterPath];
    let value;
    for (let idx = 0; idx < filterPathArr.length; idx += 1) {
      value = getObjectByPath(obj, filterPathArr[idx]);
      if (value !== undefined) return flattenRuns(value);
    }
  }

  // Collect every collaborator channel id from a lockupViewModel avatar stack.
  // Collab videos render one card per creator, and getFlattenByPath only
  // returns the first channelId it resolves.
  function getCollaboratorChannelIds(obj) {
    const listItems = getObjectByPath(
      obj,
      'metadata.lockupMetadataViewModel.image.avatarStackViewModel.rendererContext.commandContext.onTap.innertubeCommand.showDialogCommand.panelLoadingStrategy.inlineContent.dialogViewModel.customContent.listViewModel.listItems',
    );
    const ids = [];
    if (Array.isArray(listItems)) {
      for (let i = 0; i < listItems.length; i += 1) {
        const id = getObjectByPath(
          listItems[i],
          'listItemViewModel.rendererContext.commandContext.onTap.innertubeCommand.browseEndpoint.browseId',
        );
        if (id !== undefined) ids.push(id);
      }
    }
    return ids;
  }

  const pathCache = new Map();

  function compilePathSegment(v) {
    if (!/\[.*\]/.test(v)) return { key: v };
    const indices = [];
    const re = /\[(\d+)\]/g;
    let m;
    while ((m = re.exec(v)) !== null) indices.push(parseInt(m[1], 10));
    const baseMatch = v.match(/^([^[]+)/);
    return { key: baseMatch && baseMatch[1] ? baseMatch[1] : undefined, indices };
  }

  function compiledPath(path) {
    if (path instanceof Array) {
      const out = [];
      for (let i = 0; i < path.length; i += 1) out.push(compilePathSegment(path[i]));
      return out;
    }
    let compiled = pathCache.get(path);
    if (compiled === undefined) {
      compiled = path.split('.').map(compilePathSegment);
      pathCache.set(path, compiled);
    }
    return compiled;
  }

  // THE canonical dotted-path walker for this codebase (options.js `get` is a
  // mirror for the options page — it cannot import this bundle — and MUST stay
  // in sync). Semantics, in order per `seg`:
  //   1. plain token     -> own-key lookup; at an ARRAY node it resolves the
  //      FIRST element that owns the key (`[].find(has)`). Trap: on a miss it
  //      returns `def`, so typos and shape changes fail silently; and an array
  //      of non-objects can never match. Never evaluates past a miss.
  //   2. token[idx..]    -> own-key lookup on the token, then numeric indices
  //      in order; out-of-range/negative/undefined -> `def`.
  // Passing an array of paths walks each segment list in order (used per
  // renderer rule where one property may live at several possible paths).
  // String paths are compiled once and cached (see compiledPath/pathCache).
  function getObjectByPath(obj, path, def = undefined) {
    const compiled = compiledPath(path);
    let nextObj = obj;

    for (let i = 0; i < compiled.length; i += 1) {
      const seg = compiled[i];

      if (seg.indices === undefined) {
        // segment is a plain token (no bracket)
        if (nextObj instanceof Array) {
          // when we have an array of objects, find an element that contains the key v
          const found = nextObj.find((o) => has.call(o, seg.key));
          if (found === undefined) return def;
          nextObj = found[seg.key];
        } else {
          if (!nextObj || !has.call(nextObj, seg.key)) return def;
          nextObj = nextObj[seg.key];
        }
      } else {
        // navigate to base property first (if present)
        if (seg.key !== undefined) {
          if (!nextObj || !has.call(nextObj, seg.key)) return def;
          nextObj = nextObj[seg.key];
        }
        // then apply numeric indices in order
        for (let k = 0; k < seg.indices.length; k += 1) {
          const idx = seg.indices[k];
          if (!Array.isArray(nextObj) || idx < 0 || idx >= nextObj.length) return def;
          nextObj = nextObj[idx];
        }
      }
    }

    return nextObj;
  }

  // parseTime() sentinel values:
  //   -1 = time string could not be parsed (matchFilterProperties treats any
  //        vidLen <= 0 as "no duration constraint", so -1 just never matches)
  //   -2 = the literal 'SHORTS' marker YouTube uses as duration text; a Short
  //        has no real time, so the shorts option decides on its own
  const INVALID_TIME = -1;
  const SHORTS_TIME = -2;

  function parseTime(timeStr) {
    if (timeStr === 'SHORTS') {
      return SHORTS_TIME;
    }
    const parts = String(timeStr)
      .split(':')
      .map((x) => parseInt(x, 10));
    switch (parts.length) {
      case 3: {
        return parts[0] * 60 * 60 + parts[1] * 60 + parts[2];
      }
      case 2: {
        return parts[0] * 60 + parts[1];
      }
      case 1: {
        return parts[0];
      }
      default: {
        return INVALID_TIME;
      }
    }
  }

  function parseViewCount(viewCount) {
    const parts = viewCount.split(' ');
    if (parts[1] !== 'views' && parts[1] !== 'view') return undefined; // Fail if not english formatting
    const views = parts[0];

    // Handle abbreviated formats (K, M, B)
    const multipliers = {
      K: 1000,
      M: 1000000,
      B: 1000000000,
    };

    // Check if it ends with a multiplier
    const lastChar = views.slice(-1).toUpperCase();
    let multiplier = 1;
    let numericPart = views.replace(',', '');

    if (multipliers[lastChar]) {
      multiplier = multipliers[lastChar];
      numericPart = views.slice(0, -1); // Remove the letter
    }

    // Return the final count
    return numericPart * multiplier;
  }

  // ================== src/scripts/inject/object-filter.js ==================

  // !! ObjectFilter
  function ObjectFilter(object, ruleConfig, postActions = [], contextMenus = false) {
    if (!(this instanceof ObjectFilter))
      return new ObjectFilter(object, ruleConfig, postActions, contextMenus);

    this.object = object;
    this.filterRules = ruleConfig;
    // Precomputed rule-name table so matchFilterRule can scan the object's
    // own (few) keys instead of iterating every rule key per visited node.
    this.ruleNamesSet = new Set(Object.keys(ruleConfig));
    this.contextMenus = contextMenus;
    this.blockedComments = [];

    this.filter();
    try {
      postActions.forEach((x) => x.call(this));
    } catch (e) {
      console.error('postActions Exception');
      console.error(e);
    }
    return this;
  }

  // Cache: matchFilterRule can bail out entirely when no user option or filter
  // is active. storageData + jsFilterEnabled only change between (or at)
  // storageReceived, so this is only recomputed there (and when a runtime
  // context-menu block pushes a new entry into filterData).
  let noActiveFilters = false;

  // True when every rule is dormant: no extended-option renderers (shorts,
  // movies, mixes, chips shelves), no watched-percent threshold, no vidLength
  // range and no regex entries or custom function. Each check below maps to one
  // of those user option groups.
  function computeNoActiveFilters() {
    if (
      storageData.options[OPT.SHORTS] ||
      storageData.options[OPT.MOVIES] ||
      storageData.options[OPT.MIXES] ||
      storageData.options[OPT.CHIPS_SHELVES]
    )
      return false;
    if (!isNaN(storageData.options[OPT.PERCENT_WATCHED_HIDE])) return false;

    // Array guards: a forged STORAGE message (FROM_CONTENT is spoofable) can
    // leave these non-arrays; .[0]/.length on undefined would throw here.
    const vidLength = storageData.filterData.vidLength;
    if (Array.isArray(vidLength) && (!isNaN(vidLength[0]) || !isNaN(vidLength[1]))) return false;

    for (let idx = 0; idx < regexProps.length; idx += 1) {
      const arr = storageData.filterData[regexProps[idx]];
      if (Array.isArray(arr) && arr.length > 0) return false;
    }

    return !jsFilterEnabled;
  }

  // Hide videos we already watched past the threshold (percent_watched_hide).
  // playlist rows and history/library/playlist pages are exempt.
  function isPercentWatchedBlocked(fieldName, value, rendererKey) {
    return (
      fieldName === 'percentWatched' &&
      storageData.options[OPT.PERCENT_WATCHED_HIDE] &&
      rendererKey !== 'playlistPanelVideoRenderer' &&
      !['/feed/history', '/feed/library', '/playlist'].includes(document.location.pathname) &&
      parseInt(value) >= storageData.options[OPT.PERCENT_WATCHED_HIDE]
    );
  }

  // Collab videos (avatar stack): a blocked collaborator other than the first
  // creator isn't caught by the single channelId above, so test every
  // collaborator in the stack as well.
  function isCollabChannelBlocked(fieldName, rendererKey, filterEntries, obj) {
    if (fieldName !== 'channelId' || rendererKey !== 'lockupViewModel') return false;
    if (filterEntries.length === 0) return false;
    const collabIds = getCollaboratorChannelIds(obj);
    return collabIds.some((id) => filterEntries.some((entry) => entry && entry.test(id)));
  }

  // vidLength is a mandatory [min, max] duration range in seconds; a duration
  // on the range means "block" (default) while the flips of the range mean
  // "block everything outside it" (vidLength_type !== 'block').
  function matchesDurationRange(vidLen, filterEntries) {
    if (vidLen === SHORTS_TIME && storageData.options[OPT.SHORTS]) {
      return true;
    }
    if (vidLen > 0 && filterEntries.length === 2) {
      if (storageData.options[OPT.VIDLENGTH_TYPE] === 'block') {
        if (
          filterEntries[0] !== null &&
          vidLen >= filterEntries[0] &&
          filterEntries[1] !== null &&
          vidLen <= filterEntries[1]
        )
          return true;
      } else if (
        (filterEntries[0] !== null && vidLen < filterEntries[0]) ||
        (filterEntries[1] !== null && vidLen > filterEntries[1])
      )
        return true;
    }
    return false;
  }

  // Normalize badge renderers (legacy metadataBadgeRenderer or new
  // badgeViewModel) to the BADGE_MAP style token for the custom-function API.
  function extractBadgeList(value) {
    const badges = [];
    if (Array.isArray(value)) {
      value.forEach((br) => {
        const rawStyle = br?.badgeViewModel?.badgeStyle || br?.metadataBadgeRenderer?.style;
        const mapped = BADGE_MAP[rawStyle];
        if (mapped) badges.push(mapped);
      });
    }
    return badges;
  }

  ObjectFilter.prototype.matchFilterProperties = function (filterPaths, obj, rendererKey) {
    const friendlyVideoObj = {};
    matchedFilterField = null;

    if (
      document.location.pathname === '/feed/history' &&
      storageData.options[OPT.DISABLE_ON_HISTORY]
    )
      return false;

    let doBlock = false;
    for (const fieldName of Object.keys(filterPaths)) {
      const filterPath = filterPaths[fieldName];
      if (filterPath === undefined) continue;

      const filterEntries = storageData.filterData[fieldName];
      if (
        regexPropsSet.has(fieldName) &&
        (filterEntries === undefined || (filterEntries.length === 0 && !jsFilterEnabled))
      )
        continue;

      let value = getFlattenByPath(obj, filterPath);
      if (value === undefined) continue;

      if (isPercentWatchedBlocked(fieldName, value, rendererKey)) {
        matchedFilterField = { name: fieldName, value };
        doBlock = true;
        break;
      }

      if (regexPropsSet.has(fieldName) && filterEntries !== undefined) {
        const matchedEntry = filterEntries.find((entry) => entry && entry.test(value));
        if (matchedEntry) {
          matchedFilterField = { name: fieldName, value: String(matchedEntry).slice(0, 40) };
          doBlock = true;
          break;
        }
      }

      if (isCollabChannelBlocked(fieldName, rendererKey, filterEntries, obj)) {
        matchedFilterField = { name: fieldName, value };
        doBlock = true;
        break;
      }

      if (fieldName === 'vidLength') {
        const vidLen = parseTime(value);
        if (matchesDurationRange(vidLen, filterEntries)) {
          matchedFilterField = { name: fieldName, value: vidLen };
          doBlock = true;
          break;
        }
        value = vidLen;
      }

      if (jsFilterEnabled) {
        if (fieldName === 'viewCount') {
          value = parseViewCount(value);
        } else if (fieldName === 'channelBadges' || fieldName === 'badges') {
          value = extractBadgeList(value);
        }
        friendlyVideoObj[fieldName] = value;
      }
    }

    if (!doBlock && jsFilterEnabled) {
      // force return value into boolean just in case someone tries returning something else
      try {
        doBlock = !!jsFilter(friendlyVideoObj, rendererKey);
      } catch (e) {
        console.error(
          'Custom function exception',
          e,
          'friendlyVideoObj: ',
          friendlyVideoObj,
          'rendererKey: ',
          rendererKey,
        );
      }
      if (doBlock) {
        matchedFilterField = { name: 'jsFilter' };
      }
    }
    if (doBlock && rendererKey === 'commentEntityPayload') {
      this.blockedComments.push(obj.properties.commentId);
    }
    return doBlock;
  };

  // lockupViewModel (new grid) marks a Mix with a 'MIX' overlay icon; its path
  // is deep and used both by isExtendedMatched and the context-menu extractor.
  const LOCKUP_MIX_ICON_PATH =
    'contentImage.collectionThumbnailViewModel.primaryThumbnail.thumbnailViewModel.overlays.thumbnailOverlayBadgeViewModel.thumbnailBadges.thumbnailBadgeViewModel.icon.sources.clientResource.imageName';

  ObjectFilter.prototype.isExtendedMatched = function (filteredObject, rendererKey) {
    if (storageData.options[OPT.MOVIES]) {
      if (rendererKey === 'movieRenderer' || rendererKey === 'compactMovieRenderer') return true;
      if (
        rendererKey === 'videoRenderer' &&
        !getObjectByPath(
          filteredObject,
          'shortBylineText.runs.navigationEndpoint.browseEndpoint',
        ) &&
        filteredObject.longBylineText &&
        filteredObject.badges
      )
        return true;
    }
    if (
      storageData.options[OPT.SHORTS] &&
      (rendererKey === 'shortsLockupViewModel' ||
        rendererKey === 'reelItemRenderer' ||
        rendererKey === 'gridShelfViewModel')
    )
      return true;
    if (
      storageData.options[OPT.CHIPS_SHELVES] &&
      (rendererKey === 'richShelfRenderer' ||
        rendererKey === 'chipsShelfWithVideoShelfRenderer' ||
        rendererKey === 'brandVideoSingletonRenderer' ||
        rendererKey === 'brandVideoShelfRenderer' ||
        rendererKey === 'statementBannerRenderer')
    )
      return true;
    if (storageData.options[OPT.MIXES] && rendererKey === 'radioRenderer') return true;
    if (storageData.options[OPT.MIXES] && rendererKey === 'compactRadioRenderer') return true;
    if (storageData.options[OPT.MIXES] && rendererKey === 'lockupViewModel') {
      const imgName = getObjectByPath(filteredObject, LOCKUP_MIX_ICON_PATH);
      if (imgName === 'MIX') {
        return true;
      }
    }

    if (rendererKey === 'commentThreadRenderer') {
      if (
        this.blockedComments.includes(
          getObjectByPath(filteredObject, 'commentViewModel.commentViewModel.commentId'),
        )
      ) {
        return true;
      }
    }

    if (rendererKey === 'commentViewModel') {
      if (this.blockedComments.includes(getObjectByPath(filteredObject, 'commentId'))) {
        return true;
      }
    }

    return false;
  };

  ObjectFilter.prototype.matchFilterRule = function (obj, objKeys = Object.keys(obj)) {
    if (noActiveFilters) return [];

    const res = [];
    for (let i = 0; i < objKeys.length; i += 1) {
      const rendererKey = objKeys[i];
      if (!this.ruleNamesSet.has(rendererKey)) continue;

      const filteredObject = obj[rendererKey];
      if (!filteredObject) continue;

      const filterRule = this.filterRules[rendererKey];
      const filterPaths = filterRule.properties;
      const customFunc = filterRule.customFunc;
      const related = filterRule.related;

      const isMatch =
        this.isExtendedMatched(filteredObject, rendererKey) ||
        this.matchFilterProperties(filterPaths, filteredObject, rendererKey);
      if (isMatch) {
        res.push({
          name: rendererKey,
          customFunc,
          related,
        });
      }
    }
    return res;
  };

  // (b) after the recursion, empty leftover containers are pruned: (a) arrays
  // that got emptied by filtering, and special "collapseable" containers whose
  // rule requires them gone once their only child is gone.
  function collapseEmptyContainers(obj, childKey, childDel) {
    // if next child is an empty array that we filtered, mark parent for removal.
    if (childDel && obj[childKey] instanceof Array && obj[childKey].length === 0) {
      return true;
    }
    // special childs that needs removing if they're empty
    if (childDel && collapseableContainersSet.has(childKey)) {
      delete obj[childKey];
      return true;
    }
    return false;
  }

  ObjectFilter.prototype.filter = function (obj = this.object) {
    let deletePrev = false;

    // we reached the end of the object
    if (typeof obj !== 'object' || obj === null) {
      return deletePrev;
    }

    let len = 0;
    let keys;

    // If object is an array len is the number of it's members; arrays are
    // numerically keyed so they can never match a rule name -> skip matching.
    if (obj instanceof Array) {
      len = obj.length;
    } else {
      keys = Object.keys(obj);
      len = keys.length;

      // object filtering
      const matchedRules = this.matchFilterRule(obj, keys);
      matchedRules.forEach((r) => {
        let customRet = true;
        if (r.customFunc !== undefined) {
          customRet = r.customFunc.call(this, obj, r.name);
        }
        if (customRet) {
          delete obj[r.name];
          deletePrev = r.related || true;
        }
      });
    }

    // loop backwards for easier splice
    for (let i = len - 1; i >= 0; i -= 1) {
      const idx = keys ? keys[i] : i;
      if (obj[idx] === undefined) continue;

      // filter next child (skip primitives: they can never match a renderer)
      // also if current object is an array, splice child
      const child = obj[idx];
      const childDel = typeof child === 'object' && child !== null ? this.filter(child) : undefined;
      if (childDel && keys === undefined) {
        deletePrev = true;
        obj.splice(idx, 1);
        // Hack for deleting related objects with missing data
        if (typeof childDel === 'string' && obj.length > 0 && obj[idx] && obj[idx][childDel]) {
          obj.splice(idx, 1);
        }
      }

      // if next child is an empty array that we filtered, mark parent for removal.
      if (collapseEmptyContainers(obj, idx, childDel)) {
        deletePrev = true;
      }
    }

    if (this.contextMenus)
      !isMobileInterface ? addContextMenus(obj, keys) : addContextMenusMobile(obj, keys);
    return deletePrev;
  };

  // ================== src/scripts/inject/custom-filters.js ==================

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
    const message = storageData.options[OPT.BLOCK_MESSAGE] || 'Video blocked by BlockTube filter';
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

    for (const prop of Object.getOwnPropertyNames(ytData)) {
      try {
        delete ytData[prop];
      } catch (e) {}
    }
    setPlayerBlocked(ytData);
    playerHasBeenBlocked = true;
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

    let nextSection;
    for (const [, v] of nextResults.entries()) {
      if (
        has.call(v, 'itemSectionRenderer') &&
        v.itemSectionRenderer.targetId === 'watch-next-feed'
      ) {
        nextSection = v.itemSectionRenderer;
      }
    }

    const nextVideoRenderer = getObjectByPath(nextSection, 'contents.videoWithContextRenderer');
    if (!nextVideoRenderer) return;

    playerOverlay.videoTitle = nextVideoRenderer.headline;
    playerOverlay.byline = nextVideoRenderer.shortBylineText;
    playerOverlay.background = nextVideoRenderer.thumbnail;
    playerOverlay.nextButton.buttonRenderer.navigationEndpoint =
      nextVideoRenderer.navigationEndpoint;
    playerOverlay.thumbnailOverlays = nextVideoRenderer.thumbnailOverlays;
    playerOverlay.videoId = nextVideoRenderer.videoId;
    playerOverlay.shortViewCountText = nextVideoRenderer.shortViewCountText;

    const autoplaySet = getObjectByPath(
      this.object,
      'contents.singleColumnWatchNextResults.autoplay.autoplay.sets.autoplayVideo',
    );
    if (!autoplaySet) return;

    autoplaySet.commandMetadata = nextVideoRenderer.navigationEndpoint.commandMetadata;
    autoplaySet.watchEndpoint = nextVideoRenderer.navigationEndpoint.watchEndpoint;
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

    let nextSection;
    for (const [, v] of nextResults.entries()) {
      if (
        has.call(v, 'itemSectionRenderer') &&
        v.itemSectionRenderer.targetId === 'watch-next-feed'
      ) {
        nextSection = v.itemSectionRenderer;
      }
    }

    if (!nextSection) nextSection = nextResults;

    const nextAutoPlayObj = getObjectByPath(nextSection, 'contents.videoWithContextRenderer');
    if (!nextAutoPlayObj) return;

    document.location = `watch?v=${nextAutoPlayObj.videoId}`;
    delete this.object.contents;
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

  // ================== src/scripts/inject/network.js ==================

  function fetchFilter(url, resp) {
    if (storageData === undefined) return;

    if (['/youtubei/v1/search', '/youtubei/v1/browse'].includes(url.pathname)) {
      ObjectFilter(resp, filterRules.main, [], true);
    } else if (url.pathname === '/youtubei/v1/get_watch') {
      if (!(resp instanceof Array)) return;
      resp.forEach((o) => {
        if (o.responseType === 'STREAMING_WATCH_RESPONSE_TYPE_PLAYER_RESPONSE') {
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
    } else if (url.pathname === '/youtubei/v1/guide') {
      ObjectFilter(resp, filterRules.guide, [], true);
    } else if (url.pathname === '/youtubei/v1/player') {
      ObjectFilter(resp, filterRules.ytPlayer, [playerMiscFilters]);
    }
  }

  function spfFilter(url, resp) {
    if (storageData === undefined) return;

    let ytDataArr = resp.part || resp.response.parts || resp.response;
    ytDataArr = ytDataArr instanceof Array ? ytDataArr : [ytDataArr];

    ytDataArr.forEach((obj) => {
      if (has.call(obj, 'player')) {
        try {
          const player_resp = getObjectByPath(obj.player, 'args.player_response');
          obj.player.args.raw_player_response = JSON.parse(player_resp);
        } catch (e) {}
        ObjectFilter(obj.player, filterRules.ytPlayer, [playerMiscFilters]);
      }

      if (has.call(obj, 'playerResponse')) {
        ObjectFilter(obj.playerResponse, filterRules.ytPlayer);
      }

      if (has.call(obj, 'response') || has.call(obj, 'data')) {
        let rules;
        let postActions = [];
        switch (url.pathname) {
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
        ObjectFilter(obj.response || obj.data, rules, postActions, true);
      }
    });
  }

  function blockMixes(data) {
    data.filterData.channelName.push(/^YouTube$/);
  }

  function blockTrending(data) {
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
    autoPlay = autoPlay[0].autoplayVideo;
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

  // ================== src/scripts/inject/context-menu.js ==================

  // Mobile "up next" cards carry no block actions, so we inject full
  // menuServiceItemRenderer entries ourselves; YT renders the toast text
  // ("Channel blocked") in place after the tap.
  function buildBlockActionMenuItem(attr, menuAction, originalData, label, toastText) {
    return {
      menuServiceItemRenderer: {
        _btOriginalAttr: attr,
        _btMenuAction: menuAction,
        _btOriginalData: originalData,
        text: { runs: [{ text: label }] },
        icon: { iconType: 'NOT_INTERESTED' },
        trackingParams: 'Cg==',
        serviceEndpoint: {
          commandMetadata: {
            webCommandMetadata: {
              sendPost: true,
              apiUrl: 'data:text/plain;base64,Cg==',
            },
          },
          feedbackEndpoint: {
            uiActions: {
              hideEnclosingContainer: true,
            },
            actions: [
              {
                replaceEnclosingAction: {
                  item: {
                    notificationMultiActionRenderer: {
                      responseText: {
                        runs: [{ text: toastText }],
                        accessibility: {
                          accessibilityData: {
                            label: toastText,
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      },
    };
  }

  function addContextMenusMobile(obj, keys) {
    let attr;
    if (keys !== undefined) {
      for (let i = 0; i < keys.length; i += 1) {
        // same live-ownership guard as findAndExtractMenuItems
        if (contextMenuObjectsSet.has(keys[i]) && has.call(obj, keys[i])) {
          attr = keys[i];
          break;
        }
      }
    }
    if (attr === undefined) return;

    const parentData = obj[attr];
    const attrKey = attr;
    const searchIn = mergedFilterRules[attrKey].properties;

    const channelData = {
      id: getFlattenByPath(parentData, searchIn.channelId),
      text: getFlattenByPath(parentData, searchIn.channelName),
    };

    const videoData = {
      id: getFlattenByPath(parentData, searchIn.videoId),
      text: getFlattenByPath(parentData, searchIn.title),
    };

    if (
      [
        'videoWithContextRenderer',
        'compactVideoRenderer',
        'movieRenderer',
        'compactMovieRenderer',
        'playlistVideoRenderer',
        'reelItemRenderer',
        'commentRenderer',
      ].includes(attr)
    ) {
      // Mobile Up Next videos: same menuServiceItemRenderer type the desktop
      // overflow menu uses, but these cards ship no block actions, so we build
      // the full entries ourselves (see buildBlockActionMenuItem).
      let items;
      if (has.call(obj[attr], 'menu')) {
        items = getObjectByPath(obj[attr], 'menu.menuRenderer.items');
      }
      if (has.call(obj[attr], 'actionMenu')) {
        items = obj[attr].actionMenu.menuRenderer.items;
      } else if (attr === 'commentRenderer') {
        obj[attr].actionMenu = { menuRenderer: { items: [] } };
        items = obj[attr].actionMenu.menuRenderer.items;
      }

      if (!items) return;
      if (channelData.id)
        items.push(
          buildBlockActionMenuItem(
            attr,
            'block_channel',
            channelData,
            'Block Channel',
            'Channel blocked',
          ),
        );
      if (videoData.id)
        items.push(
          buildBlockActionMenuItem(attr, 'block_video', videoData, 'Block Video', 'Video blocked'),
        );
    } else if (attr === 'slimVideoMetadataSectionRenderer') {
      // Mobile Video page: the action bar under the video uses a different
      // renderer (slimMetadataButtonRenderer) than the menu-entry type above.
      const items = obj[attr].contents;
      if (!items) return;
      const mobileVideoMenu = {
        slimVideoActionBarRenderer: {
          buttons: [
            {
              slimMetadataButtonRenderer: {
                button: {
                  buttonRenderer: {
                    _btOriginalData: videoData,
                    _btOriginalAttr: 'slimVideoMetadataSectionRenderer',
                    _btMenuAction: 'block_video',
                    style: 'STYLE_DEFAULT',
                    size: 'SIZE_DEFAULT',
                    isDisabled: false,
                    text: {
                      runs: [
                        {
                          text: 'Block Video',
                        },
                      ],
                    },
                    accessibility: {
                      label: 'Block Video',
                    },
                    accessibilityData: {
                      accessibilityData: {
                        label: 'Block Video',
                      },
                    },
                    navigationEndpoint: {},
                  },
                },
              },
            },
            {
              slimMetadataButtonRenderer: {
                button: {
                  buttonRenderer: {
                    _btOriginalData: channelData,
                    _btOriginalAttr: 'slimVideoMetadataSectionRenderer',
                    _btMenuAction: 'block_channel',
                    style: 'STYLE_DEFAULT',
                    size: 'SIZE_DEFAULT',
                    isDisabled: false,
                    text: {
                      runs: [
                        {
                          text: 'Block Channel',
                        },
                      ],
                    },
                    accessibility: {
                      label: 'Block Channel',
                    },
                    accessibilityData: {
                      accessibilityData: {
                        label: 'Block Channel',
                      },
                    },
                    navigationEndpoint: {
                      commandMetadata: { webCommandMetadata: { ignoreNavigation: true } },
                      urlEndpoint: {},
                    },
                  },
                },
              },
            },
          ],
          overflowMenuText: {
            runs: [
              {
                text: 'More',
              },
            ],
          },
          overflowAccessibilityData: {
            label: 'More',
          },
        },
      };
      items.splice(2, 0, mobileVideoMenu);
    }
  }

  function extractMenuItems(obj, attr) {
    let items = null;
    let hasChannel = false;
    let hasVideo = false;
    let isLockupViewModel = false;

    if (has.call(obj[attr], 'videoActions')) {
      items = obj[attr].videoActions.menuRenderer.items;
      hasChannel = true;
      hasVideo = true;
    } else if (has.call(obj[attr], 'actionMenu')) {
      items = obj[attr].actionMenu.menuRenderer.items;
      hasChannel = true;
    } else if (attr === 'commentRenderer') {
      obj[attr].actionMenu = { menuRenderer: { items: [] } };
      items = obj[attr].actionMenu.menuRenderer.items;
      hasChannel = true;
    } else if (attr === 'lockupViewModel') {
      items = extractFromLockupViewModel(obj[attr]);
      if (!items) return null;
      const imgName = getObjectByPath(obj[attr], LOCKUP_MIX_ICON_PATH);
      if (imgName !== 'MIX') {
        hasChannel = true;
        hasVideo = true;
      }

      isLockupViewModel = true;
    } else {
      items = extractFromGenericRenderer(obj[attr]);
      hasVideo = true;

      // Determine channel presence
      if (
        attr === 'movieRenderer' ||
        attr === 'compactMovieRenderer' ||
        attr === 'reelItemRenderer'
      ) {
        hasChannel = false;
      } else if (
        has.call(obj[attr], 'shortBylineText') &&
        getObjectByPath(obj[attr], 'shortBylineText.runs.navigationEndpoint.browseEndpoint')
      ) {
        hasChannel = true;
      } else if (
        has.call(obj[attr], 'bylineText') &&
        getObjectByPath(obj[attr], 'bylineText.runs.navigationEndpoint.browseEndpoint')
      ) {
        hasChannel = true;
      }
    }

    return { items, hasChannel, hasVideo, isLockupViewModel };
  }

  // Specific extractor for lockupViewModel
  function extractFromLockupViewModel(renderer) {
    const path =
      'metadata.lockupMetadataViewModel.menuButton.buttonViewModel.onTap.innertubeCommand.showSheetCommand.panelLoadingStrategy.inlineContent.sheetViewModel';
    const sheetmodel = getObjectByPath(renderer, path);
    if (!sheetmodel) return null;

    const items = sheetmodel.content?.listViewModel?.listItems;
    if (!items) return null;

    const searchIn = mergedFilterRules['lockupViewModel'].properties;
    const channelId = getFlattenByPath(renderer, searchIn.channelId);
    const channelName = getFlattenByPath(renderer, searchIn.channelName);
    const videoId = getFlattenByPath(renderer, searchIn.videoId);
    const videoName = getFlattenByPath(renderer, searchIn.title);

    const metadataBlock = {
      metadata: {
        channelId,
        channelName,
        videoId,
        videoName,
        removeObject: true,
      },
    };

    Object.defineProperty(sheetmodel, 'blockTube', {
      value: metadataBlock,
      writable: true,
      enumerable: true,
      configurable: true,
    });

    return items;
  }

  // Generic fallback for renderers with menu.menuRenderer.items
  function extractFromGenericRenderer(renderer) {
    let items = getObjectByPath(renderer, 'menu.menuRenderer.items');
    const topLevel = getObjectByPath(renderer, 'menu.menuRenderer.topLevelButtons');

    if (!items) {
      if (!topLevel) {
        renderer.menu = { menuRenderer: { items: [] } };
      } else {
        renderer.menu.menuRenderer.items = [];
      }
      items = renderer.menu.menuRenderer.items;
    }

    return items;
  }

  function findAndExtractMenuItems(obj, keys) {
    let attr;
    if (keys !== undefined) {
      for (let i = 0; i < keys.length; i += 1) {
        // has.call(obj, key) is the LIVE check: keys is a snapshot taken before
        // rule deletion, so a key may have been deleted since it was captured.
        if (contextMenuObjectsSet.has(keys[i]) && has.call(obj, keys[i])) {
          attr = keys[i];
          break;
        }
      }
    }
    if (!attr) return null;

    const result = extractMenuItems(obj, attr);
    if (!result || !Array.isArray(result.items)) return null;

    return { ...result, attr };
  }

  function injectBlockMenuItems(items, hasChannel, hasVideo, isLockupViewModel, currentObj, store) {
    if (isLockupViewModel) {
      return injectLockupViewModelButtons(items, hasChannel, hasVideo, currentObj, store);
    }
    return injectStandardMenuButtons(items, hasChannel, hasVideo, store);
  }

  function injectLockupViewModelButtons(items, hasChannel, hasVideo, currentObj, store) {
    if (!items.length) return;

    const cleanChannelContext = createCleanContext(items, store, true, currentObj);
    const cleanVideoContext = createCleanContext(items, store, false, currentObj);

    const blockChannelItem = createLockupButtonItem('Block Channel', cleanChannelContext);
    const blockVideoItem = createLockupButtonItem('Block Video', cleanVideoContext);

    if (hasChannel) items.push(blockChannelItem);
    if (hasVideo) items.push(blockVideoItem);

    return true;
  }

  function createCleanContext(items, store, isChannel, currentObj) {
    if (store.options[OPT.BLOCK_FEEDBACK] && items.length > 0) {
      const targetIcons = isChannel ? ['REMOVE', 'DELETE'] : ['NOT_INTERESTED', 'DELETE'];
      let item;
      for (const icon of targetIcons) {
        item = items.find((i) => {
          const imageName = getObjectByPath(
            i,
            'listItemViewModel.leadingImage.sources.clientResource.imageName',
          );
          return imageName === icon;
        });
        if (item) break;
      }
      if (item) {
        return item?.listItemViewModel?.rendererContext;
      }
    }

    const baseContext = items[0]?.listItemViewModel?.rendererContext;
    if (!baseContext) return null;

    const msg = isChannel ? 'Channel Blocked' : 'Video Blocked';
    const cleanContext = deepClone(baseContext);

    if (cleanContext.commandContext?.onTap) {
      const onTap = cleanContext.commandContext?.onTap;
      onTap.innertubeCommand = {
        clickTrackingParams: '',
        commandMetadata: {
          webCommandMetadata: {
            sendPost: false,
            apiUrl: '',
          },
        },
        feedbackEndpoint: {
          feedbackToken: '',
          uiActions: {
            hideEnclosingContainer: true,
          },
          actions: [
            {
              clickTrackingParams: '',
              replaceEnclosingAction: {
                item: {
                  notificationMultiActionRenderer: {
                    responseText: {
                      accessibility: {
                        accessibilityData: {
                          label: msg,
                        },
                      },
                      simpleText: msg,
                    },
                    buttons: [],
                    trackingParams: '',
                    dismissalViewStyle: 'DISMISSAL_VIEW_STYLE_COMPACT_TALL',
                  },
                },
              },
            },
          ],
          contentId: currentObj.contentId,
        },
      };
    }

    return cleanContext;
  }

  function createLockupButtonItem(title, rendererContext) {
    const item = {
      listItemViewModel: {
        title: { content: title },
        leadingImage: {
          sources: [{ clientResource: { imageName: 'NOT_INTERESTED' } }],
        },
        rendererContext,
      },
    };

    return item;
  }

  function injectStandardMenuButtons(items, hasChannel, hasVideo, store) {
    const blockChannelItem = createStandardBlockItem('Block Channel');
    const blockVideoItem = createStandardBlockItem('Block Video');

    if (store.options[OPT.BLOCK_FEEDBACK]) {
      for (const item of items) {
        const endpoint = item?.menuServiceItemRenderer?.serviceEndpoint;
        if (!endpoint) continue;

        const iconType = getObjectByPath(item, 'menuServiceItemRenderer.icon.iconType');
        if (iconType === 'NOT_INTERESTED' && hasVideo) {
          blockVideoItem.menuServiceItemRenderer.serviceEndpoint = deepClone(endpoint);
        } else if (iconType === 'REMOVE' && hasChannel) {
          blockChannelItem.menuServiceItemRenderer.serviceEndpoint = deepClone(endpoint);
        }
      }
    }

    if (hasChannel) items.push(blockChannelItem);
    if (hasVideo) items.push(blockVideoItem);

    return false;
  }

  // Desktop overflow menu: a minimal menuServiceItemRenderer entry appended to
  // the video's existing overflow menu (endpoint cloned from a feedback item
  // when block_feedback is on, see injectStandardMenuButtons).
  function createStandardBlockItem(text) {
    return {
      menuServiceItemRenderer: {
        text: { runs: [{ text }] },
        icon: { iconType: 'NOT_INTERESTED' },
      },
    };
  }

  function deepClone(obj) {
    // Simple deep clone (for plain objects, no functions/cycles)
    return JSON.parse(JSON.stringify(obj));
  }

  function addContextMenus(obj, keys) {
    const extracted = findAndExtractMenuItems(obj, keys);
    if (!extracted) return;

    const { items, hasChannel, hasVideo, isLockupViewModel, attr } = extracted;

    injectBlockMenuItems(items, hasChannel, hasVideo, isLockupViewModel, obj[attr], storageData);

    // Attach metadata only if needed
    if (hasChannel || hasVideo) {
      obj[attr]._btOriginalAttr = attr;
    }
  }
  function openToast(msg, duration) {
    const ytdApp = document.getElementsByTagName('ytd-app')[0];
    if (ytdApp === undefined) return;
    const ytEvent = new CustomEvent('yt-action', {
      bubbles: true,
      cancelable: false,
      composed: true,
      detail: {
        actionName: 'yt-open-popup-action',
        args: [
          {
            openPopupAction: {
              durationHintMs: duration,
              popup: {
                notificationActionRenderer: {
                  responseText: {
                    runs: [
                      {
                        text: msg,
                      },
                    ],
                  },
                },
              },
              popupType: 'TOAST',
            },
          },
          ytdApp,
          undefined,
        ],
        returnValue: [],
        disableBroadcast: false,
        optionalAction: true,
      },
    });
    ytdApp.dispatchEvent(ytEvent);
  }

  function menuOnTapMobile(event) {
    if (storageData === undefined) return;

    if (window.blockTubeReloadRequired) {
      window.blockTubeExports.openToast(
        'BlockTube was updated, this tab needs to be reloaded to use this function',
        5000,
      );
      return;
    }

    const data = getObjectByPath(this, '__instance.props.data') || this.data;
    if (!data || !data._btOriginalData) {
      return;
    }

    let type;
    switch (data._btMenuAction) {
      case 'block_channel': {
        type = 'channelId';
        break;
      }
      case 'block_video': {
        type = 'videoId';
        break;
      }
      default:
        return;
    }

    postMessage(BLOCKTUBE_CONSTS.MESSAGES.CONTEXT_BLOCK_DATA, { type, info: data._btOriginalData });
    if (data._btOriginalAttr === 'slimVideoMetadataSectionRenderer') {
      document.getElementById('movie_player').stopVideo();
      alert(`${type === 'videoId' ? 'Video' : 'Channel'} Blocked`);
    }
    if (data._btOriginalAttr === 'commentRenderer') {
      const comments = document.querySelector('ytm-section-list-renderer');
      storageData.filterData.channelId.push(RegExp(`^${data._btOriginalData.id}$`));
      noActiveFilters = computeNoActiveFilters();
      ObjectFilter(comments.data, filterRules.comments, [], false);
    }
  }

  function getActionMenuData(context) {
    let menuAction = '';
    let isDataFromRightHandSide = false;

    const string = context.getElementsByTagName('yt-formatted-string');

    if (string && string.length === 1) {
      menuAction = string[0]?.getRawText() || '';
    } else {
      isDataFromRightHandSide = true;
      menuAction = context.innerText || '';
    }

    return { isDataFromRightHandSide, menuAction };
  }

  function getBlockData(parentDom, parentData, isDataFromRightHandSide, menuAction) {
    let channelData, videoData;
    let removeParent = true;
    let stopPlayer = false;

    // Video player context menu
    if (
      parentDom.tagName === 'YTD-VIDEO-PRIMARY-INFO-RENDERER' ||
      parentDom.tagName === 'YTD-WATCH-METADATA'
    ) {
      const pageManager = document.getElementsByTagName('ytd-page-manager')[0];
      const playerData = pageManager.data || pageManager.getCurrentData();
      const player = playerData.playerResponse;

      const ownerRenderer = document.getElementsByTagName('ytd-video-owner-renderer')[0];
      const owner = ownerRenderer?.data || ownerRenderer?.getCurrentData();

      const ownerUCID = getObjectByPath(
        owner,
        'videoOwnerRenderer.title.runs[0].navigationEndpoint.browseEndpoint.browseId',
      );
      let playerUCID = player.videoDetails.channelId;
      if (ownerUCID && ownerUCID !== playerUCID) {
        playerUCID = [playerUCID, ownerUCID];
      }
      channelData = {
        text: player.videoDetails.author,
        id: playerUCID,
      };
      videoData = {
        text: player.videoDetails.title,
        id: player.videoDetails.videoId,
      };

      removeParent = false;
      stopPlayer = true;
    } else if (isDataFromRightHandSide) {
      channelData = {
        id: parentData.blockTube?.metadata?.channelId,
        text: parentData.blockTube?.metadata?.channelName,
      };

      videoData = {
        id: parentData.blockTube?.metadata?.videoId,
        text: parentData.blockTube?.metadata?.videoName,
      };

      removeParent = false;
      stopPlayer = false;
    } else {
      const attrKey = parentData._btOriginalAttr;
      const searchIn = mergedFilterRules[attrKey]?.properties;

      channelData = {
        id: getFlattenByPath(parentData, searchIn.channelId),
        text: getFlattenByPath(parentData, searchIn.channelName),
      };

      videoData = {
        id: getFlattenByPath(parentData, searchIn.videoId),
        text: getFlattenByPath(parentData, searchIn.title),
      };
    }

    let result;
    switch (menuAction) {
      case 'Block Channel':
        result = { type: 'channelId', data: channelData };
        break;
      case 'Block Video':
        result = { type: 'videoId', data: videoData };
        break;
      default:
        return null;
    }

    return {
      ...result,
      removeParent,
      stopPlayer,
    };
  }

  function getParentDomAndData(isDataFromRightHandSide, element) {
    let parentDom;
    let parentData;

    if (isDataFromRightHandSide) {
      // Traverse 4 levels up to find the parent DOM
      parentDom = element?.parentElement?.parentElement?.parentElement?.parentElement;

      if (!parentDom) {
        console.warn('Could not find parentDom in recommended data context');
        return {};
      }

      const parentDomData = parentDom.componentProps?.data;
      if (!parentDomData) {
        console.warn('Could not find componentProps.data');
        return {};
      }

      const parentDomSymbols = Object.getOwnPropertySymbols(parentDomData);
      if (parentDomSymbols.length === 0) {
        console.warn('No symbols found in parentDomData');
        return {};
      }

      parentData = parentDomData[parentDomSymbols[0]]?.value;
    } else {
      // Try to find eventSink in multiple paths without using intermediate variable
      const eventSink =
        getObjectByPath(
          element.parentElement?.parentElement,
          'polymerController.forwarder_.eventSink',
        ) ||
        getObjectByPath(element.parentElement, '__dataHost.eventSink_') ||
        getObjectByPath(element.parentElement, '__dataHost.forwarder_.eventSink') ||
        getObjectByPath(element.parentElement, '__dataHost.hostElement.inst.eventSink_');

      if (!eventSink) {
        console.warn('Could not find eventSink in any expected path');
        return {};
      }

      parentDom =
        eventSink.parentComponent ||
        eventSink.parentElement.__dataHost?.hostElement ||
        eventSink.parentElement?.parentElement;
      parentData = parentDom?.data;

      if (!parentDom || !parentData) {
        console.warn('Failed to extract parentDom or parentData');
        return {};
      }
    }

    return { parentDom, parentData };
  }

  function removeParentHelper(isDataFromRightHandSide, parentDom) {
    if (['YTD-BACKSTAGE-POST-RENDERER', 'YTD-POST-RENDERER'].includes(parentDom.tagName)) {
      parentDom.parentNode.remove();
    } else if (
      ['YTD-PLAYLIST-PANEL-VIDEO-RENDERER', 'YTD-MOVIE-RENDERER'].includes(parentDom.tagName)
    ) {
      parentDom.remove();
    } else if ('YTD-COMMENT-RENDERER' === parentDom.tagName) {
      if (parentDom.parentNode.tagName === 'YTD-COMMENT-THREAD-RENDERER') {
        parentDom.parentNode.remove();
      } else {
        parentDom.remove();
      }
    } else {
      parentDom.dismissedRenderer = {
        notificationMultiActionRenderer: {
          responseText: { simpleText: 'Blocked' },
        },
      };
      parentDom.setAttribute('is-dismissed', '');
    }
  }

  function menuOnTap(event) {
    if (storageData === undefined) return;

    const { isDataFromRightHandSide, menuAction } = getActionMenuData(this);

    if (!['Block Channel', 'Block Video'].includes(menuAction)) {
      event.preventDefault();
      return;
    }

    if (window.blockTubeReloadRequired) {
      window.blockTubeExports.openToast(
        'BlockTube was updated, this tab needs to be reloaded to use this function',
        5000,
      );
      return;
    }

    // Get the parent dom and data from this
    const { parentDom, parentData } = getParentDomAndData(isDataFromRightHandSide, this);

    // Get the data and type which is used for blocking the video
    const { type, data, removeParent, stopPlayer } = getBlockData(
      parentDom,
      parentData,
      isDataFromRightHandSide,
      menuAction,
    );

    // Notify system what data should be added to the block list
    postMessage(BLOCKTUBE_CONSTS.MESSAGES.CONTEXT_BLOCK_DATA, { type, info: data });

    if (removeParent) {
      // Remove correct component based on parentDom
      removeParentHelper(isDataFromRightHandSide, parentDom);
    } else if (stopPlayer) {
      document.getElementById('movie_player').stopVideo();
    }

    if (this.data.serviceEndpoint) {
      if (this.onTap) this.onTap(event);
      else if (this.onTap_) this.onTap_(event);
    }
  }

  // ================== src/scripts/inject/hooks.js ==================

  // Install a value-trap on a dotted path only YouTube owns, so we can run
  // post-processing the moment the data becomes available (window.yt.config_,
  // ytplayer.config, ytInitialData, ...). Adapted from uBlock Origin.
  const trapObjectPath = function (path, replacementValue, onSet = undefined) {
    let blocked = false;
    // Once a value with a different type than our replacement arrives, refuse
    // every later assignment for this property (uBlock's trapper contract).
    const typeMismatch = function (value) {
      if (blocked) {
        return true;
      }
      blocked =
        value !== undefined &&
        value !== null &&
        replacementValue !== undefined &&
        replacementValue !== null &&
        typeof value !== typeof replacementValue;
      return blocked;
    };
    // https://github.com/uBlockOrigin/uBlock-issues/issues/156
    //   Support multiple trappers for the same property.
    const trapProp = function (owner, prop, configurable, handler) {
      if (handler.init(owner[prop]) === false) {
        return;
      }
      const odesc = Object.getOwnPropertyDescriptor(owner, prop);
      let prevGetter, prevSetter;
      if (odesc instanceof Object) {
        if (odesc.configurable === false) {
          return;
        }
        if (odesc.get instanceof Function) {
          prevGetter = odesc.get;
        }
        if (odesc.set instanceof Function) {
          prevSetter = odesc.set;
        }
      }
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
    };
    const trapChain = function (owner, remPath) {
      const pos = remPath.indexOf('.');
      if (pos === -1) {
        trapProp(owner, remPath, true, {
          v: undefined,
          init(v) {
            if (typeMismatch(v)) {
              return false;
            }
            this.v = v;
            return true;
          },
          getter() {
            return replacementValue;
          },
          setter(a) {
            if (onSet instanceof Function) {
              replacementValue = a;
              onSet(a);
            } else {
              if (typeMismatch(a) === false) {
                return;
              }
              replacementValue = a;
            }
          },
        });
        return;
      }
      const prop = remPath.slice(0, pos);
      const v = owner[prop];
      // remember the path that is still not reached, it must be traversed later
      remPath = remPath.slice(pos + 1);
      if (v instanceof Object || (typeof v === 'object' && v !== null)) {
        trapChain(v, remPath);
        return;
      }
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
            trapChain(a, remPath);
          }
        },
      });
    };
    trapChain(window, path);
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
  // Pre-compiled filter paths. The same path strings (from filterRules and the
  // literals below) are resolved against thousands of objects, so split + regex
  // parsing happens once per unique path instead of per call.
  function transformToRegExp(data) {
    if (typeof data !== 'object' || data === null) return;
    if (typeof data.filterData !== 'object' || data.filterData === null) return;
    regexProps.forEach((p) => {
      if (has.call(data.filterData, p) && Array.isArray(data.filterData[p])) {
        data.filterData[p] = data.filterData[p].map((v) => {
          if (!Array.isArray(v)) return undefined;
          try {
            return RegExp(v[0], typeof v[1] === 'string' ? v[1].replace('g', '') : '');
          } catch (e) {
            console.error(`RegExp parsing error: /${v[0]}/${v[1]}`);
            return undefined;
          }
        });
      }
    });
  }
  function startHook() {
    if (window.location.pathname.startsWith('/embed/')) {
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

    if (typeof window.ytInitialGuideData === 'object' && window.ytInitialGuideData !== null) {
      ObjectFilter(window.ytInitialGuideData, filterRules.guide);
    } else {
      trapObjectPath('ytInitialGuideData', undefined, (v) => ObjectFilter(v, filterRules.guide));
    }

    if (
      typeof window.ytInitialPlayerResponse === 'object' &&
      window.ytInitialPlayerResponse !== null
    ) {
      ObjectFilter(window.ytInitialPlayerResponse, filterRules.ytPlayer);
    } else {
      trapObjectPath('ytInitialPlayerResponse', undefined, (v) =>
        ObjectFilter(v, filterRules.ytPlayer),
      );
    }

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

    window.blockTubeDispatched = true;
    window.dispatchEvent(new Event('blockTubeReady'));
  }

  // Storage payload pushed by the background (via the content_script contract);
  // `options` keys are BLOCKTUBE_CONSTS.OPTIONS (alias OPT in rules.js).
  function storageReceived(data) {
    if (data === undefined) {
      window.blockTubeDispatched = true;
      window.dispatchEvent(new Event('blockTubeReady'));
      return;
    }
    // Page-forgeable message (FROM_CONTENT is public): drop anything that
    // isn't a real storage payload so a garbage shape can't throw or poison
    // storageData. Genuine payloads always pass (arrays/strings below).
    if (
      typeof data !== 'object' ||
      data === null ||
      typeof data.filterData !== 'object' ||
      data.filterData === null ||
      typeof data.options !== 'object' ||
      data.options === null
    ) {
      return;
    }
    // Non-array props would throw later at block*`.push`/match`.some`.
    for (let idx = 0; idx < regexProps.length; idx += 1) {
      const prop = data.filterData[regexProps[idx]];
      if (prop !== undefined && !Array.isArray(prop)) return;
    }
    if (data.filterData.vidLength !== undefined && !Array.isArray(data.filterData.vidLength))
      return;
    if (
      data.filterData.javascript !== undefined &&
      typeof data.filterData.javascript !== 'string'
    ) {
      return;
    }
    transformToRegExp(data);
    if (data.options[OPT.TRENDING]) blockTrending(data);
    if (data.options[OPT.MIXES]) blockMixes(data);
    if (data.options[OPT.SHORTS]) blockShorts(data);

    const shouldStartHook = storageData === undefined;
    storageData = data;

    // Enable the custom JS filter only when explicitly opted in. NOTE: the eval
    // is MAIN-realm, so it grants no extra capability there (page scripts can
    // already eval); the gate exists to keep it a deliberate user opt-in.
    const jsOptIn = storageData.options[OPT.ENABLE_JAVASCRIPT];
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

    noActiveFilters = computeNoActiveFilters();

    if (shouldStartHook && !window.blockTubeDispatched) {
      startHook();
    }
  }
  // !! Start
  console.info(`BlockTube Init OK (${BLOCKTUBE_CONSTS.MESSAGES.FROM_CONTENT})`);

  const isMobileInterface = document.location.hostname.startsWith('m.');

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
  };
})();
