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
      SHORTS_SKIP_BLOCKED: 'shorts_skip_blocked',
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
      WHITELIST_MODE: 'whitelist_mode',
      MENU_ALLOW_CHANNEL: 'menu_allow_channel',
      MENU_BLOCK_CHANNEL: 'menu_block_channel',
      MENU_BLOCK_VIDEO: 'menu_block_video',
      MENU_BLOCK_COMMENT: 'menu_block_comment',
      SAVE_SHORTCUT: 'save_shortcut',
    }),
  });

  // filterData keys the CONTEXT_BLOCK path may write to; enforced in both the
  // content script and the background (page scripts can forge the type field).
  // `unwhitelist` removes ids from the allowlist instead of adding them.
  // `comment` carries free-text comment rules (sanitized per-type in the
  // background: single line, capped, never a `//` annotation line).
  const CONTEXT_BLOCK_TYPES = Object.freeze([
    'channelId',
    'videoId',
    'whitelist',
    'unwhitelist',
    'comment',
  ]);

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
    'shortsLockupViewModel',
    // Shorts watch-page overlay: menu entries only (blocking the playing
    // video is handled through the player response). No filter rule on purpose
    // — matching it would delete the reel overlay out from under the player.
    'reelPlayerOverlayRenderer',
    // Shorts reel topbar: the visible `...` sheet lives in the trailing-buttons
    // MORE_VERT buttonViewModel's inline showSheetCommand, not in
    // overlay.menu (a decoy copy). Live swipe responses carry `topbar` (and
    // `overlay`) at the top level; the embedded prefetch wraps the same
    // fields in `reelItemWatchResponse`. Menu entries only, same as above.
    'topbar',
    'reelItemWatchResponse',
    'videoCardRenderer',
    'endScreenVideoRenderer',
    'endScreenPlaylistRenderer',
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
    'watchNextEndScreenRenderer',
    'endScreen',
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

  // Search-result collaborator channels (YouTube Collaborations): a video with
  // several creators exposes the extra channels behind a byline dialog, not
  // the usual byline browseEndpoint. Based on upstream PR #674 by Sonicegorsan.
  const collabBylinePaths = ['shortBylineText', 'longBylineText', 'ownerText', 'bylineText'];
  const collabDialogPath =
    'runs.navigationEndpoint.showDialogCommand.panelLoadingStrategy.inlineContent.dialogViewModel.customContent.listViewModel.listItems.listItemViewModel';
  const collabChannelIdPaths = collabBylinePaths.map(
    (path) =>
      `${path}.${collabDialogPath}.rendererContext.commandContext.onTap.innertubeCommand.browseEndpoint.browseId`,
  );
  const collabChannelNamePaths = collabBylinePaths.map(
    (path) => `${path}.${collabDialogPath}.title.content`,
  );
  const avatarCollabPath =
    'avatar.avatarStackViewModel.rendererContext.commandContext.onTap.innertubeCommand.showDialogCommand.panelLoadingStrategy.inlineContent.dialogViewModel.customContent.listViewModel.listItems.listItemViewModel';

  const baseRules = {
    videoId: 'videoId',
    channelId: [
      'shortBylineText.runs.navigationEndpoint.browseEndpoint.browseId',
      'longBylineText.runs.navigationEndpoint.browseEndpoint.browseId',
      'ownerText.runs.navigationEndpoint.browseEndpoint.browseId',
      'bylineText.runs.navigationEndpoint.browseEndpoint.browseId',
      'channelThumbnailSupportedRenderers.channelThumbnailWithLinkRenderer.navigationEndpoint.browseEndpoint.browseId',
      'avatar.avatarStackViewModel.rendererContext.commandContext.onTap.innertubeCommand.browseEndpoint.browseId',
      `${avatarCollabPath}.rendererContext.commandContext.onTap.innertubeCommand.browseEndpoint.browseId`,
      ...collabChannelIdPaths,
    ],
    channelBadges: 'ownerBadges',
    channelName: [
      'shortBylineText',
      'longBylineText',
      'ownerText',
      'bylineText',
      `${avatarCollabPath}.title.content`,
      ...collabChannelNamePaths,
    ],
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

  // lockupViewModel tags YouTube-generated collections ('MIX', 'COURSE') with
  // a badge icon. Only collection lockups nest it, so the path discriminates.
  const LOCKUP_BADGE_ICON_PATH =
    'contentImage.collectionThumbnailViewModel.primaryThumbnail.thumbnailViewModel.overlays.thumbnailOverlayBadgeViewModel.thumbnailBadges.thumbnailBadgeViewModel.icon.sources.clientResource.imageName';
  const LOCKUP_GENERATED_BADGE_ICONS = new Set(['MIX', 'COURSE']);

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
        videoId: [
          'onTap.innertubeCommand.reelWatchEndpoint.videoId',
          'inlinePlayerData.onVisible.innertubeCommand.watchEndpoint.videoId',
        ],
        // Function path: the shelf card carries no byline/avatar link, so the
        // channel id is decoded from reelWatchEndpoint.params (see
        // shortsLockupChannelId in paths.js). No channel name exists on the
        // card — overlayMetadata is title + view count only.
        channelId: (renderer) => shortsLockupChannelId(renderer),
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
        // Function path: a static dotted path misreads the view count as the
        // channel on channel-less cards (channel tabs, channel shelves) — see
        // lockupChannelName in paths.js. Evaluated lazily, so the later
        // fragment is always loaded by call time.
        channelName: (renderer) => lockupChannelName(renderer),
        badges: `${lockupMetadataContent}[1].badges`,
        vidLength:
          'contentImage.thumbnailViewModel.overlays.thumbnailOverlayBadgeViewModel.thumbnailBadges.thumbnailBadgeViewModel.text',
        viewCount: `${lockupMetadataContent}[1].metadataParts.text.content`,
        channelId: [
          `${lockupAvatarMedia}.decoratedAvatarViewModel.rendererContext.commandContext.onTap.innertubeCommand.browseEndpoint.browseId`,
          `${lockupMetadataContent}.metadataParts.text.commandRuns.onTap.innertubeCommand.browseEndpoint.browseId`,
          `${lockupAvatarMedia}.avatarStackViewModel.rendererContext.commandContext.onTap.innertubeCommand.showDialogCommand.panelLoadingStrategy.inlineContent.dialogViewModel.customContent.listViewModel.listItems[0].listItemViewModel.rendererContext.commandContext.onTap.innertubeCommand.browseEndpoint.browseId`,
          `${lockupAvatarMedia}.avatarStackViewModel.rendererContext.commandContext.onTap.innertubeCommand.showDialogCommand.panelLoadingStrategy.inlineContent.dialogViewModel.customContent.listViewModel.listItems[1].listItemViewModel.rendererContext.commandContext.onTap.innertubeCommand.browseEndpoint.browseId`,
          // Fan-out across every stack entry so a third-or-later collaborator
          // still matches via getFlattenByPathAll (the indexed paths above
          // only cover the first two for the single-value reader).
          `${lockupAvatarMedia}.avatarStackViewModel.rendererContext.commandContext.onTap.innertubeCommand.showDialogCommand.panelLoadingStrategy.inlineContent.dialogViewModel.customContent.listViewModel.listItems.listItemViewModel.rendererContext.commandContext.onTap.innertubeCommand.browseEndpoint.browseId`,
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
      // New-member/gift announcements carry no `message`; their text lives
      // in `headerSubtext` ("Welcome to ...!"). Same author fields as above.
      liveChatMembershipItemRenderer: paths({
        channelId: 'authorExternalChannelId',
        channelName: ['authorName'],
        comment: 'headerSubtext',
      }),
      // Super Chats (paid messages) share the text-message author/message
      // shape plus purchase/color decoration, which needs no mapping.
      liveChatPaidMessageRenderer: paths({
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
    if (arr === null || arr === undefined) return undefined;
    if (arr.simpleText !== undefined) return arr.simpleText;
    if (!Array.isArray(arr.runs)) return arr;
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
    // Function-valued rule paths (e.g. lockupViewModel.channelName): called
    // with the renderer, flattened the same way so runs-shaped text still
    // joins. Lets a rule express "the part that looks like X" where no static
    // dotted path can (see lockupChannelName).
    if (typeof filterPath === 'function') {
      return flattenRuns(filterPath(obj));
    }
    const filterPathArr = filterPath instanceof Array ? filterPath : [filterPath];
    let value;
    for (let idx = 0; idx < filterPathArr.length; idx += 1) {
      value = getObjectByPath(obj, filterPathArr[idx]);
      if (value !== undefined) return flattenRuns(value);
    }
  }

  // Plain token fan-out: every array element owning the key contributes its
  // value; a plain object contributes its own-key value. Misses add nothing.
  function collectPlainKey(cur, key, next) {
    if (cur instanceof Array) {
      for (let k = 0; k < cur.length; k += 1) {
        const el = cur[k];
        if (el && typeof el === 'object' && has.call(el, key)) next.push(el[key]);
      }
    } else if (typeof cur === 'object' && has.call(cur, key)) {
      next.push(cur[key]);
    }
  }

  // Walk one numeric index across every candidate array, collecting hits.
  // Out-of-range/non-array candidates contribute nothing.
  function collectIndexStep(arr, idx) {
    const collected = [];
    for (let a = 0; a < arr.length; a += 1) {
      const av = arr[a];
      if (Array.isArray(av) && idx >= 0 && idx < av.length) collected.push(av[idx]);
    }
    return collected;
  }

  // Indexed token fan-out: own-key lookup on the token (when present), then
  // indices in order. An empty intermediate set is a miss (adds nothing).
  function collectIndexedKey(cur, seg, next) {
    let base = cur;
    if (seg.key !== undefined) {
      if (!base || typeof base !== 'object' || !has.call(base, seg.key)) return;
      base = base[seg.key];
    }
    let arr = [base];
    for (let k = 0; k < seg.indices.length; k += 1) {
      arr = collectIndexStep(arr, seg.indices[k]);
      if (arr.length === 0) return;
    }
    for (let a = 0; a < arr.length; a += 1) next.push(arr[a]);
  }

  // One compiled-segment step: fan every current value out into `next`
  // through the plain or indexed collector above.
  function stepPathValues(values, seg) {
    const next = [];
    for (let v = 0; v < values.length; v += 1) {
      const cur = values[v];
      if (cur === undefined || cur === null) continue;
      if (seg.indices === undefined) collectPlainKey(cur, seg.key, next);
      else collectIndexedKey(cur, seg, next);
    }
    return next;
  }

  // Collect EVERY value at a dotted path, not just the first. getObjectByPath
  // resolves an ARRAY node to its first element owning the key, so a second
  // collaborator id in a byline/dialog list is invisible to it. This walker
  // fans out across all array elements instead (numeric [idx] segments still
  // select one element). Used by getFlattenByPathAll for channelId/channelName,
  // where ANY listed channel may match (see upstream PR #674).
  function getAllByPath(obj, path) {
    const compiled = compiledPath(path);
    let values = [obj];
    for (let i = 0; i < compiled.length; i += 1) {
      values = stepPathValues(values, compiled[i]);
      if (values.length === 0) return values;
    }
    return values;
  }

  // Like getFlattenByPath, but returns every flattened value across every
  // path in the array — so a blocked collaborator listed second still matches.
  function getFlattenByPathAll(obj, filterPath) {
    if (filterPath === undefined) return [];
    if (typeof filterPath === 'function') {
      const single = flattenRuns(filterPath(obj));
      return single === undefined ? [] : [single];
    }
    const filterPathArr = filterPath instanceof Array ? filterPath : [filterPath];
    const out = [];
    for (let i = 0; i < filterPathArr.length; i += 1) {
      const vals = getAllByPath(obj, filterPathArr[i]);
      for (let j = 0; j < vals.length; j += 1) {
        const flat = flattenRuns(vals[j]);
        if (flat !== undefined) out.push(flat);
      }
    }
    return out;
  }
  // Avatar-stack dialog holding every collaborator on a lockupViewModel
  // collab card (same listItemViewModel shape as the search-result byline
  // dialogs in rules.js).
  const LOCKUP_COLLAB_LIST_ITEMS_PATH =
    'metadata.lockupMetadataViewModel.image.avatarStackViewModel.rendererContext.commandContext.onTap.innertubeCommand.showDialogCommand.panelLoadingStrategy.inlineContent.dialogViewModel.customContent.listViewModel.listItems';

  // Collect every collaborator channel id from a lockupViewModel avatar stack.
  // Collab videos render one card per creator, and getFlattenByPath only
  // returns the first channelId it resolves.
  function getCollaboratorChannelIds(obj) {
    const listItems = getObjectByPath(obj, LOCKUP_COLLAB_LIST_ITEMS_PATH);
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

  // Collect every collaborator channel NAME from a lockupViewModel avatar
  // stack. The channelName rule is a single-name function
  // (lockupChannelName), so without this a blocked name listed second never
  // matches — the channelName half of the collab gap (channelId is covered
  // by getCollaboratorChannelIds above).
  function getCollaboratorChannelNames(obj) {
    const listItems = getObjectByPath(obj, LOCKUP_COLLAB_LIST_ITEMS_PATH);
    const names = [];
    if (Array.isArray(listItems)) {
      for (let i = 0; i < listItems.length; i += 1) {
        const item = listItems[i] && listItems[i].listItemViewModel;
        if (!item || typeof item !== 'object') continue;
        const title = item.title;
        let name;
        if (title && typeof title === 'object') {
          if (typeof title.content === 'string' && title.content.length > 0) {
            name = title.content;
          } else {
            const flat = flattenRuns(title);
            if (typeof flat === 'string' && flat.length > 0) name = flat;
          }
        } else if (typeof title === 'string' && title.length > 0) {
          name = title;
        }
        if (name !== undefined) names.push(name);
      }
    }
    return names;
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
  // in sync). Plain tokens do an own-key lookup (at an ARRAY node: the FIRST
  // element owning the key); token[idx..] does the lookup then numeric indices
  // in order. Any miss returns `def`, so typos/shape changes fail silently.
  // String paths are compiled once and cached (see compiledPath/pathCache).
  // Miss sentinel: payload values come from JSON and can never be this
  // reference, so an explicit `undefined` value still reads as a hit.
  const PATH_MISS = {};

  // Plain token (no brackets): own-key lookup, or first array element owning
  // the key. Returns PATH_MISS on a miss, the value (possibly undefined) on
  // a hit.
  function readPlainKey(node, key) {
    if (node instanceof Array) {
      const found = node.find((o) => o !== null && o !== undefined && has.call(o, key));
      if (found === undefined) return PATH_MISS;
      return found[key];
    }
    if (!node || !has.call(node, key)) return PATH_MISS;
    return node[key];
  }

  // Token with numeric indices: own-key lookup on the token (when present),
  // then indices in order. Out-of-range/negative/non-array reads are misses.
  function readIndexedKey(node, key, indices) {
    let base = node;
    if (key !== undefined) {
      if (!base || !has.call(base, key)) return PATH_MISS;
      base = base[key];
    }
    for (let k = 0; k < indices.length; k += 1) {
      const idx = indices[k];
      if (!Array.isArray(base) || idx < 0 || idx >= base.length) return PATH_MISS;
      base = base[idx];
    }
    return base;
  }

  function getObjectByPath(obj, path, def = undefined) {
    const compiled = compiledPath(path);
    let nextObj = obj;
    for (let i = 0; i < compiled.length; i += 1) {
      const seg = compiled[i];
      nextObj =
        seg.indices === undefined
          ? readPlainKey(nextObj, seg.key)
          : readIndexedKey(nextObj, seg.key, seg.indices);
      if (nextObj === PATH_MISS) return def;
    }
    return nextObj;
  }

  const BROWSE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
  // Shared Shorts identity: the /shorts/<id> URL owns the id on every Shorts
  // surface (player responses, reel menus, overlay lifecycle). One regex and
  // two helpers here so custom-filters.js, context-menu.js and
  // shorts-overlay.js cannot drift apart. Defined early (paths.js loads
  // before all three) — later fragments must reuse these, not redeclare.
  const SHORTS_ID_RE = /^\/shorts\/([A-Za-z0-9_-]{11})/;

  // The short on screen, from the /shorts/<id> URL. Undefined off-shorts.
  // Never throws (exotic realms, missing location).
  function currentShortsId() {
    try {
      const match = document.location.pathname.match(SHORTS_ID_RE);
      return match ? match[1] : undefined;
    } catch (e) {
      return undefined;
    }
  }

  // The playing Short: id from the URL above, name from the document title
  // ("<title> - YouTube"). Both missing off-shorts. Fail-open throughout.
  function currentShortsVideo() {
    let id;
    let text;
    try {
      id = currentShortsId();
    } catch (e) {}
    try {
      const title = typeof document.title === 'string' ? document.title : '';
      const name = title.replace(/\s*-\s*YouTube\s*$/, '').trim();
      text = name.length > 0 ? name : undefined;
    } catch (e) {}
    return { id, text };
  }
  const LOCKUP_ROWS_PATH =
    'metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows';
  const PART_LINK_PATH = 'text.commandRuns.onTap.innertubeCommand.browseEndpoint.browseId';
  const LOCKUP_TITLE_PATH = 'metadata.lockupMetadataViewModel.title';

  // A metadata text node -> channel name, or undefined. Prefers `content`,
  // falls back to runs-joined text (flattenRuns also covers simpleText).
  function channelTextOf(text) {
    if (!text || typeof text !== 'object') return undefined;
    if (typeof text.content === 'string' && text.content.length > 0) return text.content;
    const runs = flattenRuns(text);
    if (typeof runs === 'string' && runs.length > 0) return runs;
    return undefined;
  }

  // Precise channel signal: the part links to the channel (same browseId path
  // the channelId rule reads), so it survives accessibilityLabel changes.
  function partHasChannelLink(part) {
    const linkId = getObjectByPath(part, PART_LINK_PATH);
    return typeof linkId === 'string' && BROWSE_ID_RE.test(linkId);
  }

  // Legacy heuristic: a part with neither accessibilityLabel nor leadingIcon.
  function isBarePart(part) {
    return part.accessibilityLabel === undefined && part.leadingIcon === undefined;
  }

  // Shared metadataRows walker: first part (in row order) matching `isMatch`
  // that yields text wins.
  function findPartName(rows, isMatch) {
    for (let i = 0; i < rows.length; i += 1) {
      const parts = rows[i] && rows[i].metadataParts;
      if (!Array.isArray(parts)) continue;
      for (let j = 0; j < parts.length; j += 1) {
        const part = parts[j];
        if (!part || typeof part !== 'object' || !isMatch(part)) continue;
        const name = channelTextOf(part.text);
        if (name !== undefined) return name;
      }
    }
    return undefined;
  }

  // Pass 1: the linked channel part (see partHasChannelLink).
  function lockupLinkedChannelName(rows) {
    return findPartName(rows, partHasChannelLink);
  }

  // Pass 1b: link-less channel rows (home-feed/continuation lockups omit the
  // browseEndpoint link). Like NewPipe, read index-first: with 2+ rows the
  // first row's first part is the channel by position. Single-row cards stay
  // undefined — on a channel's own tabs that row is only views/date, and
  // returning it would misread the view count as the channel.
  function lockupFirstRowChannelName(rows) {
    const partRows = [];
    for (let i = 0; i < rows.length; i += 1) {
      const parts = rows[i] && rows[i].metadataParts;
      if (Array.isArray(parts)) partRows.push(parts);
    }
    if (partRows.length < 2) return undefined;
    const first = partRows[0][0];
    if (!first || typeof first !== 'object') return undefined;
    return channelTextOf(first.text);
  }

  // Pass 2: legacy bare-label heuristic (see isBarePart), gated on >= 2 rows
  // so single-row cards can never misread the view count.
  function lockupBareChannelName(rows) {
    if (rows.length < 2) return undefined;
    return findPartName(rows, isBarePart);
  }

  // Pass 3: channel-type lockups (LOCKUP_CONTENT_TYPE_CHANNEL) have no channel
  // row at all — the channel name IS the card title.
  function lockupTitleChannelName(renderer) {
    const contentType = getObjectByPath(renderer, 'contentType');
    if (typeof contentType !== 'string' || !contentType.includes('CHANNEL')) return undefined;
    const title = getObjectByPath(renderer, LOCKUP_TITLE_PATH);
    if (typeof title === 'string') return title.length > 0 ? title : undefined;
    return channelTextOf(title);
  }

  // The channel a lockupViewModel card attributes itself to, or undefined.
  // No static dotted path expresses this: channel-less cards (a channel's own
  // /videos tab, "From <channel>" shelves) drop the channel row, so a naive
  // metadataRows path silently resolves to the VIEW COUNT instead — the wrong
  // annotation and false channelName-filter hits. Tries linked -> positional
  // -> bare-label -> avatar-stack -> channel-type title, in that order. The
  // stack pass is explicit attribution (not a positional guess), so it cannot
  // misread a view count; without it link-less collab rows resolve to
  // undefined and the channelName field is skipped entirely, letting every
  // collaborator through.
  function lockupChannelName(renderer) {
    const rows = getObjectByPath(renderer, LOCKUP_ROWS_PATH);
    if (Array.isArray(rows)) {
      const linked = lockupLinkedChannelName(rows);
      if (linked !== undefined) return linked;
      const positional = lockupFirstRowChannelName(rows);
      if (positional !== undefined) return positional;
      const bare = lockupBareChannelName(rows);
      if (bare !== undefined) return bare;
    }
    const stackNames = getCollaboratorChannelNames(renderer);
    if (stackNames.length > 0) return stackNames[0];
    return lockupTitleChannelName(renderer);
  }

  // The channel a shortsLockupViewModel card attributes itself to, or
  // undefined. Shorts shelf cards carry no byline/avatar link — the only
  // channel signal is the protobuf baked into
  // onTap.innertubeCommand.reelWatchEndpoint.params (URL-encoded base64
  // whose decoded bytes embed the UC-prefixed channel id). Decoded as
  // latin1 and scanned for the UC-prefixed id, so protobuf framing changes
  // outside the id bytes cannot break the read. No channel name exists on
  // the card (overlayMetadata is title + view count only).
  // Minimal base64 -> latin1 decoder (no atob/Buffer: the inject realm and
  // the unit sandbox do not share either). Returns undefined on bad input.
  function base64ToLatin1(input) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const clean = String(input).replace(/[^A-Za-z0-9+/=]/g, '');
    if (clean.length === 0 || clean.length % 4 !== 0) return undefined;
    let out = '';
    for (let i = 0; i < clean.length; i += 4) {
      const a = alphabet.indexOf(clean[i]);
      const b = alphabet.indexOf(clean[i + 1]);
      const c = clean[i + 2] === '=' ? 0 : alphabet.indexOf(clean[i + 2]);
      const d = clean[i + 3] === '=' ? 0 : alphabet.indexOf(clean[i + 3]);
      if (a < 0 || b < 0 || c < 0 || d < 0) return undefined;
      const triple = (a << 18) | (b << 12) | (c << 6) | d;
      out += String.fromCharCode((triple >> 16) & 0xff);
      if (clean[i + 2] !== '=') out += String.fromCharCode((triple >> 8) & 0xff);
      if (clean[i + 3] !== '=') out += String.fromCharCode(triple & 0xff);
    }
    return out;
  }

  function shortsLockupChannelId(renderer) {
    const params = getObjectByPath(renderer, 'onTap.innertubeCommand.reelWatchEndpoint.params');
    if (typeof params !== 'string' || params.length === 0) return undefined;
    let encoded = params;
    try {
      encoded = decodeURIComponent(params);
    } catch (e) {}
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = base64ToLatin1(normalized);
    if (typeof binary !== 'string') return undefined;
    const match = binary.match(/UC[A-Za-z0-9_-]{22}/);
    return match ? match[0] : undefined;
  }

  // The channel that owns the current page (channel pages only), remembered
  // from the last payload that carried page metadata. Video cards on a
  // channel's own tabs omit per-card attribution (no avatar, no channel row),
  // so without this neither filtering nor the context menu can tell they
  // belong to the page's channel. Continuation payloads carry no metadata
  // themselves, hence the cache; it is cleared on navigation (see hooks.js
  // yt-navigate-start) and only ever set from a real channelMetadataRenderer.
  let pageChannel = null;

  function rememberPageChannel(root) {
    if (!root || typeof root !== 'object') return;
    const md = getObjectByPath(root, 'metadata.channelMetadataRenderer');
    if (!md || typeof md !== 'object') return;
    if (typeof md.externalId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(md.externalId)) return;
    const title = typeof md.title === 'string' ? md.title : flattenRuns(md.title);
    pageChannel = {
      id: md.externalId,
      name: typeof title === 'string' && title.length > 0 ? title : undefined,
    };
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

  /**
   * Parses a view count string (e.g., "1.5M views", "No views", "100K", "2 million views") into an integer.
   * @param {string} s - The input string to parse.
   * @returns {number|undefined} The exact view count as a number, or undefined if invalid.
   */
  function parseViewCount(s) {
    if (typeof s !== 'string') return undefined;

    // Normalize spaces (including &nbsp;) and convert to lowercase
    const clean = s
      .replace(/\u00a0/g, ' ')
      .trim()
      .toLowerCase();
    if (clean === '') return undefined;

    // 1. Handle zero views case ("No views", "No view", any spacing/casing)
    if (/^no\s+views?$/.test(clean)) {
      return 0;
    }

    // 2. Match patterns like "1.5 million views", "100K views", or just "100K"
    // Group 1: The numeric part (digits, dots, commas)
    // Group 2: The multiplier suffix (thousand/million/billion or k/m/b)
    const match = clean.match(/^([\d,.]+)\s*(thousand|million|billion|[kmb])?(?:\s+views?)?$/);
    if (!match) return undefined;

    const numStr = match[1];
    const multiplierStr = match[2];

    // Reject malformed numbers ("1.2.3") that parseFloat would silently truncate
    if ((numStr.match(/\./g) || []).length > 1) return undefined;

    // Convert string to float (remove thousands-separator commas)
    const num = parseFloat(numStr.replace(/,/g, ''));
    if (Number.isNaN(num)) return undefined;

    // Map suffixes to their corresponding numeric multipliers (kept column-aligned below).
    // prettier-ignore
    const multipliers = {
    k: 1e3, thousand: 1e3,
    m: 1e6, million:  1e6,
    b: 1e9, billion:  1e9,
  };

    const factor = multiplierStr ? multipliers[multiplierStr] : 1;
    if (factor === undefined) return undefined;

    return Math.round(num * factor);
  }

  // ================== src/scripts/inject/object-filter.js ==================

  // !! ObjectFilter
  function ObjectFilter(object, ruleConfig, postActions = [], contextMenus = false) {
    if (!(this instanceof ObjectFilter))
      return new ObjectFilter(object, ruleConfig, postActions, contextMenus);

    this.object = object;
    // Channel pages stamp their id on the payload root (see rememberPageChannel
    // in paths.js); continuation payloads do not, they ride the cache.
    rememberPageChannel(object);
    this.filterRules = ruleConfig;
    // Precomputed rule-name table so matchFilterRule can scan the object's
    // own (few) keys instead of iterating every rule key per visited node.
    this.ruleNamesSet = new Set(Object.keys(ruleConfig));
    this.contextMenus = contextMenus;
    this.blockedComments = [];

    try {
      this.filter();
    } catch (e) {
      console.error('ObjectFilter exception (data left partially filtered)');
      console.error(e);
    }
    postActions.forEach((x) => {
      try {
        x.call(this);
      } catch (e) {
        console.error('postActions Exception');
        console.error(e);
      }
    });
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
    // Whitelist mode always filters — even an empty allowlist blocks
    // everything carrying a channel id — so never take the early-out that
    // would silently disable the mode.
    if (storageData.options[OPT.WHITELIST_MODE]) return false;
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
    const opts = storageData.options;
    const threshold = opts[OPT.PERCENT_WATCHED_HIDE];
    return (
      fieldName === 'percentWatched' &&
      threshold &&
      rendererKey !== 'playlistPanelVideoRenderer' &&
      !['/feed/history', '/feed/library', '/playlist'].includes(document.location.pathname) &&
      parseInt(value) >= threshold
    );
  }

  // Test one compiled filter entry against one value. Resets lastIndex first:
  // a user-supplied /g flag makes RegExp.test stateful, and testing the same
  // entry against several candidate values would otherwise alternate hits.
  function testFilterEntry(entry, value) {
    if (!entry) return false;
    entry.lastIndex = 0;
    return entry.test(value);
  }

  // True when any entry matches any candidate value (search-result collab
  // videos list several channels; the first one must not decide alone).
  function entriesMatchAnyValue(entries, values) {
    if (!Array.isArray(entries)) return false;
    return entries.some((entry) => entry && values.some((v) => testFilterEntry(entry, v)));
  }

  // Render one compiled filter entry the way the user wrote it, so the
  // watch-page block message names the actual filter. Plain keywords compile
  // to a boundary-wrapped wrapper `(^|BOUNDARY)(kw)(BOUNDARY|$)` that reads
  // like random regex; unwrap the middle group and unescape it back to the
  // keyword. Exact ids compile to `^id$`; strip the anchors. Raw `/re/flags`
  // entries have no wrapper, so String(entry) already matches the input.
  function displayFilterEntry(entry) {
    try {
      if (!entry || typeof entry.source !== 'string') return undefined;
      const src = entry.source;
      const flags = typeof entry.flags === 'string' ? entry.flags : '';
      const kwMatch = /^\(\^\|.*\)\((.*)\)\(.*\|\$\)$/.exec(src);
      if (flags === 'i' && kwMatch) {
        const raw = kwMatch[1].replace(/\\([\\^$*+?.()|[\]{}])/g, '$1');
        return raw.slice(0, 40);
      }
      if (
        flags === '' &&
        src.length >= 2 &&
        src.charAt(0) === '^' &&
        src.charAt(src.length - 1) === '$' &&
        src.indexOf('(') === -1 &&
        src.indexOf('|') === -1
      ) {
        return src.slice(1, -1).slice(0, 40);
      }
      return String(entry).slice(0, 40);
    } catch (e) {
      return undefined;
    }
  }

  // Find the first entry that tests positive against a candidate, so the
  // block message can name the actual filter (not just the matched value).
  function findMatchingEntry(filterEntries, candidate) {
    if (!Array.isArray(filterEntries)) return undefined;
    for (let i = 0; i < filterEntries.length; i += 1) {
      const entry = filterEntries[i];
      if (entry && testFilterEntry(entry, candidate)) return entry;
    }
    return undefined;
  }

  // Collab videos (avatar stack): a blocked collaborator other than the first
  // creator isn't caught by the single channelId/channelName above, so test
  // every collaborator in the stack as well. ANY match blocks, and the
  // returned descriptor names the filter that fired plus the collaborator
  // value it matched.
  function matchCollabChannel(fieldName, rendererKey, filterEntries, obj) {
    if (rendererKey !== 'lockupViewModel') return null;
    if (!Array.isArray(filterEntries) || filterEntries.length === 0) return null;
    if (fieldName === 'channelId') {
      const collabIds = getCollaboratorChannelIds(obj);
      for (let i = 0; i < collabIds.length; i += 1) {
        const id = collabIds[i];
        const entry = findMatchingEntry(filterEntries, id);
        if (entry) {
          return {
            name: fieldName,
            value: String(id).slice(0, 40),
            filter: displayFilterEntry(entry),
          };
        }
      }
      return null;
    }
    if (fieldName === 'channelName') {
      const collabNames = getCollaboratorChannelNames(obj);
      for (let i = 0; i < collabNames.length; i += 1) {
        const collabName = collabNames[i];
        const entry = findMatchingEntry(filterEntries, collabName);
        if (entry) {
          return {
            name: fieldName,
            value: String(collabName).slice(0, 40),
            filter: displayFilterEntry(entry),
          };
        }
      }
      return null;
    }
    return null;
  }

  // Whitelist mode (generous, fail-open): a card is allowed when ANY
  // collaborator id in the avatar stack matches the allowlist, even if the
  // primary channel id does not.
  function isCollabChannelAllowlisted(obj) {
    const allowlist = storageData.filterData.whitelist || [];
    if (allowlist.length === 0) return false;
    const collabIds = getCollaboratorChannelIds(obj);
    return collabIds.some((id) => allowlist.some((entry) => entry && testFilterEntry(entry, id)));
  }

  // vidLength is a mandatory [min, max] duration range in seconds; a duration
  // on the range means "block" (default) while the flips of the range mean
  // "block everything outside it" (vidLength_type !== 'block').
  function matchesDurationRange(vidLen, filterEntries) {
    const opts = storageData.options;
    if (vidLen === SHORTS_TIME && opts[OPT.SHORTS]) {
      return true;
    }
    if (vidLen > 0 && filterEntries.length === 2) {
      if (opts[OPT.VIDLENGTH_TYPE] === 'block') {
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

  // Whitelist-mode branch of matchField: only channelId is evaluated (every
  // other field is bypassed), against the allowlist first, then the collab
  // stack, then the fail-open ID-charset gate for structural renderers.
  function matchFieldWhitelist(fieldName, value, obj, rendererKey, allValues) {
    if (fieldName !== 'channelId') return { match: null, value };
    const allowlist = storageData.filterData.whitelist || [];
    const candidates = allValues && allValues.length > 0 ? allValues : [value];
    if (entriesMatchAnyValue(allowlist, candidates)) return { match: null, value };
    if (rendererKey === 'lockupViewModel' && isCollabChannelAllowlisted(obj)) {
      return { match: null, value };
    }
    // Fail-open on non-attribution values: structural renderers carry URLs
    // (tabRenderer), icon types (chips) or other non-IDs in the channelId
    // slot. Those can never match an exact-ID allowlist entry, so blocking
    // them deletes page chrome instead of content — channel tabs vanish and
    // the channel page looks like it never loads. Real channel ids and the
    // page-block pseudo-ids (FEtrending, TAB_SHORTS, ...) stay subject to
    // the check below via the shared ID charset.
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
      return { match: null, value };
    }
    return {
      match: { name: fieldName, value, filter: '(not allowlisted)' },
      value,
    };
  }

  // Regex-props branch of matchField: channelId/channelName may carry several
  // channels (search-result collab dialogs); a blocked one listed second must
  // still match. Records BOTH the user-readable filter that fired (unwrapped
  // from the compiled pattern) and the value it matched, so the player block
  // message can say e.g. `title filter "puppy" matched "Girl Wakes Up..."`.
  function matchFieldRegex(fieldName, value, filterEntries, allValues) {
    // channelId/channelName can list several channels (collab dialogs);
    // collect them all so a non-first match still blocks/allows.
    const candidates = allValues && allValues.length > 0 ? allValues : [value];
    for (let i = 0; i < candidates.length; i += 1) {
      const candidate = candidates[i];
      if (candidate === undefined) continue;
      const entry = findMatchingEntry(filterEntries, candidate);
      if (entry) {
        return {
          name: fieldName,
          value: String(candidate).slice(0, 40),
          filter: displayFilterEntry(entry),
        };
      }
    }
    return null;
  }

  // VidLength branch of matchField: parses the duration and tests the
  // mandatory [min, max] range. Returns match descriptor + numeric value.
  function matchFieldDuration(fieldName, value, filterEntries) {
    const vidLen = parseTime(value);
    const match = matchesDurationRange(vidLen, filterEntries)
      ? { name: fieldName, value: vidLen }
      : null;
    return { match, value: vidLen };
  }

  // The blocking rules for one field, in priority order. Returns `match` - the
  // descriptor for matchedFilterField, or null - plus `value`, the form of the
  // value the custom JS filter should receive.
  function matchField(fieldName, value, filterEntries, obj, rendererKey, allValues) {
    // Whitelist mode inverts channelId: block iff NO allowlist entry tests
    // positive. Every other field is bypassed here (the caller additionally
    // skips their value extraction, so only channelId costs a read).
    if (storageData.options[OPT.WHITELIST_MODE]) {
      return matchFieldWhitelist(fieldName, value, obj, rendererKey, allValues);
    }

    if (isPercentWatchedBlocked(fieldName, value, rendererKey)) {
      return { match: { name: fieldName, value }, value };
    }

    if (regexPropsSet.has(fieldName) && filterEntries !== undefined) {
      const match = matchFieldRegex(fieldName, value, filterEntries, allValues);
      if (match) return { match, value };
    }

    const collabMatch = matchCollabChannel(fieldName, rendererKey, filterEntries, obj);
    if (collabMatch) {
      return { match: collabMatch, value };
    }

    if (fieldName === 'vidLength') {
      return matchFieldDuration(fieldName, value, filterEntries);
    }

    return { match: null, value };
  }

  // Coerce the two fields whose raw JSON is not what a filter author expects.
  function normalizeForJsFilter(fieldName, value) {
    if (fieldName === 'viewCount') return parseViewCount(value);
    if (fieldName === 'channelBadges' || fieldName === 'badges') return extractBadgeList(value);
    return value;
  }

  // Per-video cards that may omit their channel on a channel's own page (no
  // avatar, no channel row — see lockupChannelName). Everywhere else the
  // fail-open rule stands: unattributed structural renderers (tabs, chips,
  // shelves) must survive, so the page-channel fallback never applies to them.
  const pageChannelFallbackRenderers = new Set([
    'lockupViewModel',
    'gridVideoRenderer',
    'videoRenderer',
    'compactVideoRenderer',
  ]);

  // Skip fields with nothing to test: undefined paths, non-channelId fields
  // in whitelist mode, and regex props with no entries and no JS filter.
  function shouldSkipField(fieldName, filterPath, filterEntries, whitelistMode) {
    if (filterPath === undefined) return true;
    // Whitelist mode evaluates channelId against the allowlist even when
    // the blacklist is empty (empty allowlist = block, not skip); every
    // other field is bypassed without value extraction.
    if (whitelistMode && fieldName !== 'channelId') return true;
    return (
      !whitelistMode &&
      regexPropsSet.has(fieldName) &&
      (filterEntries === undefined || (filterEntries.length === 0 && !jsFilterEnabled))
    );
  }

  // Resolve one field's value, falling back to the page channel for
  // unattributed per-video cards on a channel's own page (see
  // pageChannelFallbackRenderers). Returns undefined when there is nothing.
  function resolveFieldValue(obj, filterPath, fieldName, rendererKey) {
    const value = getFlattenByPath(obj, filterPath);
    if (value !== undefined) return value;
    // On a channel's own page its video cards carry no channel id; without
    // the page fallback they can neither be blacklisted nor (in whitelist
    // mode) hidden for being non-allowlisted — the page looks unblockable.
    // Structural renderers keep the fail-open rule (see
    // pageChannelFallbackRenderers): only per-video cards inherit the page.
    if (
      fieldName === 'channelId' &&
      pageChannel !== null &&
      pageChannelFallbackRenderers.has(rendererKey)
    ) {
      return pageChannel.id;
    }
    return undefined;
  }

  // Evaluate one field against its filter entries. Sets matchedFilterField and
  // returns true on a block; otherwise records the JS-filter value and false.
  function evaluateOneField(fieldName, value, filterEntries, obj, rendererKey, allValues) {
    const { match, value: jsValue } = matchField(
      fieldName,
      value,
      filterEntries,
      obj,
      rendererKey,
      allValues,
    );
    if (match) {
      matchedFilterField = match;
      return { blocked: true, jsValue };
    }
    return { blocked: false, jsValue };
  }

  // Run the user JS filter over the friendly object. Forces the return into
  // boolean and records the jsFilter match descriptor on a block.
  function applyJsFilter(friendlyVideoObj, rendererKey) {
    let doBlock = false;
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
    return doBlock;
  }

  // Collect multi-channel candidates for collab dialogs so a non-first
  // match still blocks/allows; every other field needs no extra lookup.
  function collabCandidates(obj, filterPath, fieldName) {
    // channelId/channelName can list several channels (collab dialogs);
    // collect them all so a non-first match still blocks/allows.
    return fieldName === 'channelId' || fieldName === 'channelName'
      ? getFlattenByPathAll(obj, filterPath)
      : undefined;
  }

  // Scan every field in filterPaths: resolve, evaluate, record JS values.
  // Returns the block flag; matchedFilterField is set on a property match.
  function scanFilterFields(filterPaths, obj, rendererKey, fd, whitelistMode, friendlyVideoObj) {
    for (const fieldName of Object.keys(filterPaths)) {
      const filterPath = filterPaths[fieldName];
      const filterEntries = fd[fieldName];
      if (shouldSkipField(fieldName, filterPath, filterEntries, whitelistMode)) continue;

      const value = resolveFieldValue(obj, filterPath, fieldName, rendererKey);
      if (value === undefined) continue;

      const { blocked, jsValue } = evaluateOneField(
        fieldName,
        value,
        filterEntries,
        obj,
        rendererKey,
        collabCandidates(obj, filterPath, fieldName),
      );
      if (blocked) return true;

      if (jsFilterEnabled) friendlyVideoObj[fieldName] = normalizeForJsFilter(fieldName, jsValue);
    }
    return false;
  }

  ObjectFilter.prototype.matchFilterProperties = function (filterPaths, obj, rendererKey) {
    const friendlyVideoObj = {};
    matchedFilterField = null;
    // Comment menu taps join the pressed comment against the authors seen
    // here (comment-dom.js). The try covers realms lacking that fragment.
    try {
      if (rendererKey === 'commentEntityPayload') rememberCommentAuthor(obj);
    } catch (e) {}
    const opts = storageData.options;
    const fd = storageData.filterData;

    if (document.location.pathname === '/feed/history' && opts[OPT.DISABLE_ON_HISTORY])
      return false;

    const whitelistMode = !!opts[OPT.WHITELIST_MODE];
    let doBlock = scanFilterFields(
      filterPaths,
      obj,
      rendererKey,
      fd,
      whitelistMode,
      friendlyVideoObj,
    );

    if (!doBlock && jsFilterEnabled) {
      doBlock = applyJsFilter(friendlyVideoObj, rendererKey);
    }
    if (doBlock && rendererKey === 'commentEntityPayload') {
      this.blockedComments.push(obj.properties.commentId);
    }
    return doBlock;
  };

  // Search results and the home grid deliver Shorts as plain videoRenderers,
  // with a textless time overlay, so the vidLength rule never sees them. Match
  // the overlay style instead. `overlayStyle` is a guess from the DOM
  // attribute; only `style` is confirmed. See the knowledge base.
  function hasShortsTimeOverlay(obj) {
    const style = 'SHORTS';
    const paths = [
      'thumbnailOverlays.thumbnailOverlayTimeStatusRenderer.overlayStyle',
      'thumbnailOverlays.thumbnailOverlayTimeStatusRenderer.style',
    ];
    for (let idx = 0; idx < paths.length; idx += 1) {
      if (getObjectByPath(obj, paths[idx]) === style) return true;
    }
    return false;
  }

  // A movie: its own renderer, or a video card wearing a movie's byline+badges
  // (which is how a movie appears inside search/grid results).
  function matchesMovie(obj, rendererKey) {
    if (rendererKey === 'movieRenderer' || rendererKey === 'compactMovieRenderer') return true;
    return (
      rendererKey === 'videoRenderer' &&
      !getObjectByPath(obj, 'shortBylineText.runs.navigationEndpoint.browseEndpoint') &&
      obj.longBylineText &&
      obj.badges
    );
  }

  // A Short ships in four shapes: the three dedicated renderers, a lockup
  // flagged by contentType, and a plain video card with a SHORTS overlay.
  function matchesShort(obj, rendererKey) {
    if (
      rendererKey === 'shortsLockupViewModel' ||
      rendererKey === 'reelItemRenderer' ||
      rendererKey === 'gridShelfViewModel'
    )
      return true;
    if (
      rendererKey === 'lockupViewModel' &&
      getObjectByPath(obj, 'contentType') === 'LOCKUP_CONTENT_TYPE_SHORT'
    )
      return true;
    // No rendererKey guard: the overlay marks a Short whatever shape it
    // arrives as. Only legacy video cards nest thumbnailOverlays.
    return hasShortsTimeOverlay(obj);
  }

  const CHIPS_SHELF_RENDERERS = new Set([
    'richShelfRenderer',
    'chipsShelfWithVideoShelfRenderer',
    'brandVideoSingletonRenderer',
    'brandVideoShelfRenderer',
    'statementBannerRenderer',
  ]);

  // Search "People also search for" shelves arrive as plain shelfRenderer
  // (title = entity, subtitle = "People also search for", no endpoint), so
  // the wholesale Set above never catches them. Match on the subtitle text
  // (simpleText or runs) instead of wholesale-blocking shelfRenderer, which
  // also hosts legitimate channel shelves.
  function isPeopleAlsoSearchForShelf(obj) {
    const subtitle = flattenRuns(getObjectByPath(obj, 'subtitle'));
    return (
      typeof subtitle === 'string' && subtitle.trim().toLowerCase() === 'people also search for'
    );
  }

  function matchesChipsShelf(obj, rendererKey) {
    if (CHIPS_SHELF_RENDERERS.has(rendererKey)) return true;
    if (rendererKey === 'shelfRenderer') return isPeopleAlsoSearchForShelf(obj);
    return false;
  }

  // A YouTube-generated playlist: the radio renderers, or a collection lockup
  // badged MIX/COURSE.
  function matchesGeneratedPlaylist(obj, rendererKey) {
    if (rendererKey === 'radioRenderer' || rendererKey === 'compactRadioRenderer') return true;
    if (rendererKey !== 'lockupViewModel') return false;
    const imgName = getObjectByPath(obj, LOCKUP_BADGE_ICON_PATH);
    return imgName !== undefined && LOCKUP_GENERATED_BADGE_ICONS.has(imgName);
  }

  // One entry per option, so adding a block type is a line here, not another
  // branch in the middle of a 70-line function. Order is irrelevant: every
  // matcher is an independent predicate.
  const OPTION_MATCHERS = [
    [OPT.MOVIES, matchesMovie],
    [OPT.SHORTS, matchesShort],
    [OPT.CHIPS_SHELVES, matchesChipsShelf],
    [OPT.MIXES, matchesGeneratedPlaylist],
  ];

  ObjectFilter.prototype.isExtendedMatched = function (filteredObject, rendererKey) {
    for (let idx = 0; idx < OPTION_MATCHERS.length; idx += 1) {
      const [optionKey, matcher] = OPTION_MATCHERS[idx];
      if (storageData.options[optionKey] && matcher(filteredObject, rendererKey)) {
        // Record the option so the watch-page message names it instead of
        // staying generic (or worse, reusing a stale field from an earlier video).
        matchedFilterField = { name: 'option', filter: optionKey };
        return true;
      }
    }
    return this.isBlockedComment(filteredObject, rendererKey);
  };

  // Comments are blocked by id, not by option. The two renderer shapes bury
  // the id at different depths. Records the attribution like every other
  // matcher: without this, a comment hit would leave whatever an earlier
  // renderer set behind (stale-filter log lines).
  ObjectFilter.prototype.isBlockedComment = function (filteredObject, rendererKey) {
    let commentId;
    if (rendererKey === 'commentThreadRenderer') {
      commentId = getObjectByPath(filteredObject, 'commentViewModel.commentViewModel.commentId');
    } else if (rendererKey === 'commentViewModel') {
      commentId = getObjectByPath(filteredObject, 'commentId');
    } else {
      return false;
    }
    const blocked = commentId !== undefined && this.blockedComments.includes(commentId);
    if (blocked) {
      matchedFilterField = { name: rendererKey, filter: '(blocked comment)', value: commentId };
    }
    return blocked;
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
        // Snapshot this rule's attribution: the global still holds the LAST
        // match in this node when several keys match, so a customFunc (and
        // its log line) would otherwise report a sibling renderer's filter.
        // Each descriptor is a fresh object per match, so a reference is safe.
        res.push({
          name: rendererKey,
          customFunc,
          related,
          match: matchedFilterField,
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

  // Run one matched rule's customFunc (if any) and delete the renderer on
  // success. Returns the rule's related flag (or true) when deleted.
  function applyMatchedRule(filterCtx, obj, rule) {
    let customRet = true;
    if (rule.customFunc !== undefined) {
      // Restore this rule's snapshot (see matchFilterRule): sibling matches
      // in the same node must not leak their attribution into this call.
      if (rule.match !== undefined) {
        try {
          matchedFilterField = rule.match;
        } catch (e) {}
      }
      try {
        customRet = rule.customFunc.call(filterCtx, obj, rule.name);
      } catch (e) {
        console.error('customFunc Exception (renderer left in place)');
        console.error(e);
        customRet = false;
      }
    }
    if (customRet) {
      delete obj[rule.name];
      return rule.related || true;
    }
    return false;
  }

  // Match this node's renderers against the rule table and delete hits.
  // Returns the deletePrev flag for the pruned parent, or false for arrays
  // (numerically keyed: they can never match a rule name — skipped here).
  function matchAndDeleteRules(filterCtx, obj, keys) {
    let deletePrev = false;
    if (keys === undefined) return deletePrev;
    // object filtering
    let matchedRules = [];
    try {
      matchedRules = filterCtx.matchFilterRule(obj, keys);
    } catch (e) {
      console.error('matchFilterRule Exception (renderer left in place)');
      console.error(e);
    }
    matchedRules.forEach((r) => {
      const deleted = applyMatchedRule(filterCtx, obj, r);
      if (deleted) deletePrev = deleted;
    });
    return deletePrev;
  }

  // Filter one child subtree, returning its delete flag (or undefined for
  // primitives, which can never match a renderer). Child throws leave the
  // subtree in place.
  function filterOneChild(filterCtx, child) {
    if (typeof child !== 'object' || child === null) return undefined;
    try {
      return filterCtx.filter(child);
    } catch (e) {
      console.error('ObjectFilter child exception (subtree left in place)');
      console.error(e);
      return false;
    }
  }

  // Splice a deleted array child (plus its related sibling when the flag is
  // a key name — the missing-data hack). No-op for object children.
  function spliceDeletedChild(obj, idx, childDel, keys) {
    if (!childDel || keys !== undefined) return;
    obj.splice(idx, 1);
    // Hack for deleting related objects with missing data
    if (typeof childDel === 'string' && obj.length > 0 && obj[idx] && obj[idx][childDel]) {
      obj.splice(idx, 1);
    }
  }

  // Walk children backwards (easier splice), filtering each subtree and
  // pruning emptied containers. Returns true when a child was deleted.
  function filterChildren(filterCtx, obj, keys, len) {
    let deleted = false;
    // loop backwards for easier splice
    for (let i = len - 1; i >= 0; i -= 1) {
      const idx = keys ? keys[i] : i;
      if (obj[idx] === undefined) continue;

      // filter next child (skip primitives: they can never match a renderer)
      // also if current object is an array, splice child
      const childDel = filterOneChild(filterCtx, obj[idx]);
      if (childDel && keys === undefined) {
        deleted = true;
        spliceDeletedChild(obj, idx, childDel, keys);
      }

      // if next child is an empty array that we filtered, mark parent for removal.
      if (collapseEmptyContainers(obj, idx, childDel)) {
        deleted = true;
      }
    }
    return deleted;
  }

  // Attach context-menu entries to this node when the filter runs with menus
  // enabled. Menu throws never break filtering — they are logged only.
  function maybeAddContextMenus(filterCtx, obj, keys) {
    if (!filterCtx.contextMenus) return;
    try {
      !isMobileInterface ? addContextMenus(obj, keys) : addContextMenusMobile(obj, keys);
    } catch (e) {
      console.error('addContextMenus Exception');
      console.error(e);
    }
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
      const matched = matchAndDeleteRules(this, obj, keys);
      if (matched) deletePrev = matched;
    }

    if (filterChildren(this, obj, keys, len)) deletePrev = true;

    maybeAddContextMenus(this, obj, keys);
    return deletePrev;
  };

  // ================== src/scripts/inject/custom-filters.js ==================

  // !! Custom filtering functions

  // Which field matched, filled in by matchFilterProperties so the error panel
  // can say what actually triggered the block.
  let matchedFilterField = null;

  function getMatchedFilterText() {
    if (matchedFilterField === null) return null;
    const name = matchedFilterField.name;
    const filter = matchedFilterField.filter;
    const value = matchedFilterField.value;
    // Name the actual filter that fired plus the value it matched, so a
    // title block reads e.g. `title filter "puppy" matched "Girl Wakes..."`.
    // Showing only the value looks like the user added a filter for that
    // exact title; showing only the compiled pattern reads like random regex.
    if (filter !== undefined && value !== undefined) {
      const f = String(filter).slice(0, 40);
      const v = String(value).slice(0, 40);
      // Exact-id filters (channelId/videoId `^id$`) match only themselves,
      // so naming both reads as a stutter: (channelId filter "UC..." matched
      // "UC..."). Collapse those to a single attribution.
      if (f === v) return `${name}: "${f}"`;
      return `${name} filter "${f}" matched "${v}"`;
    }
    if (filter !== undefined) {
      return `${name} filter "${String(filter).slice(0, 40)}"`;
    }
    if (value !== undefined) {
      return `${name}: ${String(value).slice(0, 40)}`;
    }
    return name;
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

  // Navigation started: consume the skip accounting for the previous short.
  // A navigation we triggered keeps the consecutive counter; a manual one
  // (new swipe, new page) resets it and disarms any pending sweep. When the
  // navigation is our own auto-advance past a blocked short, its reason
  // panel is dropped now instead of riding into the next short — the black
  // covers underneath keep the departing frame hidden until the landing
  // verdict. Returns true when the panel was dropped. Never throws.
  function shortsSkipNavigationStarted() {
    let ours = false;
    try {
      if (shortsSkipJustFired) {
        shortsSkipJustFired = false;
        ours = true;
      } else if (shortsSkipArmedFor !== null || shortsConsecutiveSkips > 0) {
        shortsConsecutiveSkips = 0;
        shortsSkipArmedFor = null;
        shortsSkipTriggeredAt = 0;
      }
    } catch (e) {
      ours = false;
    }
    if (ours) {
      try {
        if (typeof removeShortsOverlay === 'function') removeShortsOverlay();
      } catch (e) {}
    }
    return ours;
  }

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
    // Prefetches (not yet watched) arm nothing: their sweep would instantly
    // complete ("not on screen" reads as "navigated away" in the tick below)
    // and burn the one sweep per video, so a blocked short landed on later —
    // whose player response may come from cache with nothing re-triggering
    // this path — would never advance. The landing hook (hooks.js
    // yt-navigate-finish) arms the sweep when actually watched instead.
    try {
      if (currentShortsId() !== videoId) return;
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
              if (item && typeof item.url === 'string' && item.url.indexOf('i.ytimg.com') !== -1) {
                item.url = 'https://s.ytimg.com/yts/img/meh_mini-vfl0Ugnu3.png';
              }
            } catch (e) {}
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  // One node of the reel-response walk below. Fail-open throughout.
  function visitReelThumbNode(node) {
    try {
      if (!node || typeof node !== 'object') return;
      if (node instanceof Array) {
        for (let i = 0; i < node.length; i += 1) visitReelThumbNode(node[i]);
        return;
      }
      scrubReelThumbnailUrls(node);
      const keys = Object.getOwnPropertyNames(node);
      for (let i = 0; i < keys.length; i += 1) {
        try {
          visitReelThumbNode(node[keys[i]]);
        } catch (e) {}
      }
    } catch (e) {}
  }

  function scrubReelThumbnails() {
    const resp = this && this.object;
    if (!resp || typeof resp !== 'object') return;
    try {
      visitReelThumbNode(resp);
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

  // ================== src/scripts/inject/network.js ==================

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
      // like a watch-next response. The sequence filter first blocks embedded
      // prefetched players whose channel matches and neutralizes every
      // preloaded frame (those entries carry no channel linkage, and no
      // preloaded frame may ever paint); then the usual pass filters what
      // matches and stamps the Block menu entries (no autoplay fixups here —
      // there are no two-column results).
      filterReelSequenceResponse(resp);
      ObjectFilter(resp, mergedFilterRules, [], true);
    } else if (url.pathname === '/youtubei/v1/guide') {
      ObjectFilter(resp, filterRules.guide, [], true);
    } else if (url.pathname === '/youtubei/v1/player') {
      playerHasBeenBlocked = false;
      ObjectFilter(resp, filterRules.ytPlayer, [playerMiscFilters]);
      // A clean verdict for the short on screen lifts the seed.js first-frame
      // guard (blocked shorts stay hidden under the reason panel).
      maybeRevealShortsPrehide(resp);
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

  // ================== src/scripts/inject/context-menu.js ==================

  // Whitelist mode (WHITELIST_PLAN.md Phase 3): the menu offers allowlisting
  // instead of blocking — channel items post type `whitelist`, video items
  // are hidden (videos can't be allowlisted). Never both at once.
  function isWhitelistMenuMode(store) {
    const opts = (store || storageData)?.options;
    return !!opts?.[OPT.WHITELIST_MODE];
  }

  // Per-entry menu visibility (General toggles, default shown): a missing key
  // (stored blobs predate the toggles) reads as visible — the same fail-open
  // direction as the rest of the menu.
  function showMenuEntry(key, store) {
    const opts = (store || storageData)?.options;
    return opts?.[key] !== false;
  }

  // The toast notification item shown after a mobile block tap ("Channel
  // blocked" rendered in place by YouTube).
  function buildToastNotificationItem(toastText) {
    return {
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
    };
  }

  // The feedback endpoint for a mobile block entry: optionally hides the
  // enclosing card and shows the toast notification above.
  function buildBlockFeedbackEndpoint(toastText, hideContainer) {
    return {
      uiActions: {
        hideEnclosingContainer: hideContainer,
      },
      actions: [
        {
          replaceEnclosingAction: {
            item: buildToastNotificationItem(toastText),
          },
        },
      ],
    };
  }

  // The service endpoint stub mobile block entries carry (a no-op data URL —
  // the real work happens in menuOnTapMobile via the _bt* fields).
  function buildBlockServiceEndpoint(hideContainer, toastText) {
    return {
      commandMetadata: {
        webCommandMetadata: {
          sendPost: true,
          apiUrl: 'data:text/plain;base64,Cg==',
        },
      },
      feedbackEndpoint: buildBlockFeedbackEndpoint(toastText, hideContainer),
    };
  }

  // Mobile "up next" cards carry no block actions, so we inject full
  // menuServiceItemRenderer entries ourselves; YT renders the toast text
  // ("Channel blocked") in place after the tap.
  // Allow entries must NOT hide the card (the item stays visible, only the
  // toast confirms), so they pass hideContainer=false; removals keep it true.
  function buildBlockActionMenuItem(
    attr,
    menuAction,
    originalData,
    label,
    toastText,
    hideContainer = true,
    iconType = 'NOT_INTERESTED',
  ) {
    return {
      menuServiceItemRenderer: {
        _btOriginalAttr: attr,
        _btMenuAction: menuAction,
        _btOriginalData: originalData,
        text: { runs: [{ text: label }] },
        icon: { iconType },
        trackingParams: 'Cg==',
        serviceEndpoint: buildBlockServiceEndpoint(hideContainer, toastText),
      },
    };
  }

  // The first live renderer key that is both a registered context-menu target
  // and still owned by obj. `keys` is a snapshot taken before rule deletion, so
  // an entry may have been deleted from obj since it was captured.
  function resolveContextMenuAttr(obj, keys) {
    if (keys === undefined) return undefined;
    for (let i = 0; i < keys.length; i += 1) {
      if (contextMenuObjectsSet.has(keys[i]) && has.call(obj, keys[i])) {
        return keys[i];
      }
    }
    return undefined;
  }

  // Dedupe a candidate list, dropping undefined/empty values. Returns a
  // single value when exactly one remains (existing callers store a plain
  // string), an array when several collaborators are present, or undefined
  // when nothing resolved.
  function singleOrAll(values) {
    const seen = [];
    const known = new Set();
    for (let i = 0; i < values.length; i += 1) {
      const v = values[i];
      if (typeof v !== 'string' || v.length === 0 || known.has(v)) continue;
      known.add(v);
      seen.push(v);
    }
    if (seen.length === 0) return undefined;
    if (seen.length === 1) return seen[0];
    return seen;
  }

  // The channel and video a renderer describes, resolved through its filter
  // rule paths. Both block entries ("Block Channel" / "Block Video") carry
  // this pair as _btOriginalData for menuOnTap to consume later. Collab
  // cards list several channels: collect ALL of them so one "Block Channel"
  // tap blocks every collaborator instead of only the first.
  function channelAndVideoFrom(parentData, attrKey) {
    if (attrKey === 'lockupViewModel') {
      return { channel: lockupChannelFrom(parentData), video: lockupVideoFrom(parentData) };
    }
    const searchIn = mergedFilterRules[attrKey]?.properties;
    return {
      channel: {
        id: singleOrAll(getFlattenByPathAll(parentData, searchIn?.channelId)),
        text: singleOrAll(getFlattenByPathAll(parentData, searchIn?.channelName)),
      },
      video: {
        id: getFlattenByPath(parentData, searchIn?.videoId),
        text: getFlattenByPath(parentData, searchIn?.title),
      },
    };
  }

  // Lockup cards resolve through the same rule paths, plus the channel-page
  // fallback: cards on a channel's own tabs carry no attribution (no avatar,
  // no channel row), so without the page channel the menu tap posts an
  // undefined id that the content script drops — the tap silently does
  // nothing — and the annotation falls back to the view count. lockupChannelName
  // (a function rule path) already refuses the view count; the page channel
  // fills the rest. Collab stacks contribute every entry, so the tap blocks
  // all collaborators at once.
  function lockupChannelFrom(renderer) {
    const searchIn = mergedFilterRules.lockupViewModel?.properties;
    const ids = getFlattenByPathAll(renderer, searchIn?.channelId).concat(
      getCollaboratorChannelIds(renderer),
    );
    const primaryName = getFlattenByPath(renderer, searchIn?.channelName);
    const names = (primaryName === undefined ? [] : [primaryName]).concat(
      getCollaboratorChannelNames(renderer),
    );
    const id = singleOrAll(ids) || pageChannel?.id;
    const text = singleOrAll(names) || pageChannel?.name;
    return { id, text };
  }

  function lockupVideoFrom(renderer) {
    const searchIn = mergedFilterRules.lockupViewModel?.properties;
    return {
      id: getFlattenByPath(renderer, searchIn?.videoId),
      text: getFlattenByPath(renderer, searchIn?.title),
    };
  }

  // Mobile renderers whose cards ship no block actions (see
  // buildBlockActionMenuItem): the menu entries are built from scratch.
  const MOBILE_UP_NEXT_ATTRS = [
    'videoWithContextRenderer',
    'compactVideoRenderer',
    'movieRenderer',
    'compactMovieRenderer',
    'playlistVideoRenderer',
    'reelItemRenderer',
    'commentRenderer',
  ];

  // Resolve the mutable menu-items array for a mobile up-next card, creating
  // the actionMenu for comments. Undefined when the card has no menu at all.
  function resolveMobileUpNextItems(obj, attr) {
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
    return items;
  }

  // Whitelist mode: the visible cards are already allowlisted, so an
  // "Allow Channel" entry would be pointless — offer removal instead.
  function pushMobileRemovalEntry(items, attr, channelData) {
    if (channelData.id)
      items.push(
        buildBlockActionMenuItem(
          attr,
          'unallow_channel',
          channelData,
          'Remove from Whitelist',
          'Removed from whitelist',
          true,
          'REMOVE',
        ),
      );
  }

  // Block mode additionally offers allowlisting, so the allowlist can be
  // built while browsing normally.
  function pushMobileBlockEntries(items, attr, channelData, videoData) {
    if (channelData.id && showMenuEntry(OPT.MENU_BLOCK_CHANNEL))
      items.push(
        buildBlockActionMenuItem(
          attr,
          'block_channel',
          channelData,
          'Block Channel',
          'Channel blocked',
        ),
      );
    if (videoData.id && showMenuEntry(OPT.MENU_BLOCK_VIDEO))
      items.push(
        buildBlockActionMenuItem(attr, 'block_video', videoData, 'Block Video', 'Video blocked'),
      );
    if (channelData.id && showMenuEntry(OPT.MENU_ALLOW_CHANNEL))
      items.push(
        buildBlockActionMenuItem(
          attr,
          'allow_channel',
          channelData,
          'Allow Channel',
          'Channel allowed',
          false,
          'CHECK',
        ),
      );
  }

  // Mobile Up Next videos: same menuServiceItemRenderer type the desktop
  // overflow menu uses, but these cards ship no block actions, so we build
  // the full entries ourselves (see buildBlockActionMenuItem).
  function addMobileUpNextMenus(obj, attr, channelData, videoData) {
    const items = resolveMobileUpNextItems(obj, attr);
    if (!items) return;
    if (isWhitelistMenuMode()) {
      pushMobileRemovalEntry(items, attr, channelData);
      return;
    }
    pushMobileBlockEntries(items, attr, channelData, videoData);
  }

  // Channel-button definitions for the mobile video-page action bar. In
  // whitelist mode only removal is offered; in block mode the entries honor
  // their General-toggle visibility (see showMenuEntry).
  function slimChannelButtonDefs(allowMode) {
    if (allowMode) {
      return [{ action: 'unallow_channel', label: 'Remove from Whitelist' }];
    }
    return [
      { action: 'block_channel', label: 'Block Channel', option: OPT.MENU_BLOCK_CHANNEL },
      { action: 'allow_channel', label: 'Allow Channel', option: OPT.MENU_ALLOW_CHANNEL },
    ].filter(({ option }) => option === undefined || showMenuEntry(option));
  }

  // One slim action-bar buttonRenderer bound to BlockTube data: shared body
  // for the video and channel buttons (they differ only in data/action/label
  // and the navigation endpoint kind).
  function buildSlimButtonRenderer(data, action, label, navigationEndpoint) {
    return {
      _btOriginalData: data,
      _btOriginalAttr: 'slimVideoMetadataSectionRenderer',
      _btMenuAction: action,
      style: 'STYLE_DEFAULT',
      size: 'SIZE_DEFAULT',
      isDisabled: false,
      text: {
        runs: [
          {
            text: label,
          },
        ],
      },
      accessibility: {
        label,
      },
      accessibilityData: {
        accessibilityData: {
          label,
        },
      },
      navigationEndpoint,
    };
  }

  // The "Block Video" button for the mobile video-page action bar.
  function buildSlimVideoButton(videoData) {
    return {
      slimMetadataButtonRenderer: {
        button: {
          buttonRenderer: buildSlimButtonRenderer(videoData, 'block_video', 'Block Video', {}),
        },
      },
    };
  }

  // Render one channel-button definition into a slimMetadataButtonRenderer
  // entry bound to the video's channel (see addMobileSlimMenus).
  function renderSlimChannelButton({ action, label }, channelData) {
    return {
      slimMetadataButtonRenderer: {
        button: {
          buttonRenderer: buildSlimButtonRenderer(channelData, action, label, {
            commandMetadata: { webCommandMetadata: { ignoreNavigation: true } },
            urlEndpoint: {},
          }),
        },
      },
    };
  }

  // The mobile action-bar wrapper holding the video + channel buttons, with
  // a static "More" overflow label.
  function buildMobileVideoMenu(videoButton, channelButtonsRendered, includeVideo) {
    return {
      slimVideoActionBarRenderer: {
        buttons: [
          // Videos can't be allowlisted: no video button in whitelist mode.
          ...(includeVideo ? [videoButton] : []),
          ...channelButtonsRendered,
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
  }

  // Mobile Video page: the action bar under the video uses a different
  // renderer (slimMetadataButtonRenderer) than the menu-entry type above.
  function addMobileSlimMenus(obj, attr, channelData, videoData) {
    const items = obj[attr].contents;
    if (!items) return;
    const allowMode = isWhitelistMenuMode();
    const channelButtons = slimChannelButtonDefs(allowMode);
    const videoButton = buildSlimVideoButton(videoData);
    const channelButtonsRendered = channelButtons.map((def) =>
      renderSlimChannelButton(def, channelData),
    );
    const includeVideo = !allowMode && showMenuEntry(OPT.MENU_BLOCK_VIDEO);
    items.splice(2, 0, buildMobileVideoMenu(videoButton, channelButtonsRendered, includeVideo));
  }

  function addContextMenusMobile(obj, keys) {
    const attr = resolveContextMenuAttr(obj, keys);
    if (attr === undefined) return;

    const parentData = obj[attr];
    const { channel: channelData, video: videoData } = channelAndVideoFrom(parentData, attr);

    if (MOBILE_UP_NEXT_ATTRS.includes(attr)) {
      addMobileUpNextMenus(obj, attr, channelData, videoData);
    } else if (attr === 'slimVideoMetadataSectionRenderer') {
      addMobileSlimMenus(obj, attr, channelData, videoData);
    }
  }

  // Lockup branch of extractMenuItems: resolve the sheet items, then mark
  // channel/video presence unless the card is a generated collection (Mixes,
  // Courses — neither a real video nor a real channel). Null when no sheet.
  function extractLockupMenuFlags(obj, attr) {
    const items = extractFromLockupViewModel(obj[attr]);
    if (!items) return null;
    const imgName = getObjectByPath(obj[attr], LOCKUP_BADGE_ICON_PATH);
    // YouTube-generated collections (Mixes, Courses): neither a real video nor
    // a real channel, so there is nothing meaningful to add to the filters.
    const isCollection = imgName !== undefined && LOCKUP_GENERATED_BADGE_ICONS.has(imgName);
    return {
      items,
      hasChannel: !isCollection,
      hasVideo: !isCollection,
      isLockupViewModel: true,
    };
  }

  // Renderers without their own channel link (movies, reels) never attribute
  // a channel; the rest do when a byline path resolves to a browse endpoint.
  // Shorts shelf cards are NOT excluded here: they carry no byline, but their
  // channel resolves from reelWatchEndpoint.params via the channelId rule
  // (see shortsLockupChannelId) through the dedicated branch below.
  function genericRendererHasChannel(renderer, attr) {
    if (
      attr === 'movieRenderer' ||
      attr === 'compactMovieRenderer' ||
      attr === 'reelItemRenderer'
    ) {
      return false;
    }
    if (
      has.call(renderer, 'shortBylineText') &&
      getObjectByPath(renderer, 'shortBylineText.runs.navigationEndpoint.browseEndpoint')
    ) {
      return true;
    }
    return !!(
      has.call(renderer, 'bylineText') &&
      getObjectByPath(renderer, 'bylineText.runs.navigationEndpoint.browseEndpoint')
    );
  }

  // Generic branch of extractMenuItems: items always exist (created on
  // demand), video actions always apply, channel depends on the byline link.
  function extractGenericMenuFlags(obj, attr) {
    return {
      items: extractFromGenericRenderer(obj[attr]),
      hasChannel: genericRendererHasChannel(obj[attr], attr),
      hasVideo: true,
      isLockupViewModel: false,
    };
  }

  // Comment branch of extractMenuItems: comments ship no menu, so an empty
  // actionMenu is created for the block entries.
  function extractCommentMenuFlags(obj, attr) {
    obj[attr].actionMenu = { menuRenderer: { items: [] } };
    return {
      items: obj[attr].actionMenu.menuRenderer.items,
      hasChannel: true,
      hasVideo: false,
      isLockupViewModel: false,
    };
  }

  function extractMenuItems(obj, attr) {
    if (has.call(obj[attr], 'videoActions')) {
      return {
        items: obj[attr].videoActions.menuRenderer.items,
        hasChannel: true,
        hasVideo: true,
        isLockupViewModel: false,
      };
    }
    if (has.call(obj[attr], 'actionMenu')) {
      return {
        items: obj[attr].actionMenu.menuRenderer.items,
        hasChannel: true,
        hasVideo: false,
        isLockupViewModel: false,
      };
    }
    if (attr === 'commentRenderer') {
      return extractCommentMenuFlags(obj, attr);
    }
    if (attr === 'lockupViewModel') {
      return extractLockupMenuFlags(obj, attr);
    }
    if (attr === 'shortsLockupViewModel') {
      return extractShortsLockupMenuFlags(obj, attr);
    }
    if (attr === 'reelPlayerOverlayRenderer') {
      return extractReelOverlayMenuFlags(obj, attr);
    }
    if (attr === 'reelItemWatchResponse' || attr === 'topbar') {
      return extractReelTopbarMenuFlags(obj, attr);
    }
    return extractGenericMenuFlags(obj, attr);
  }

  // Specific extractor for lockupViewModel
  function extractFromLockupViewModel(renderer) {
    const path =
      'metadata.lockupMetadataViewModel.menuButton.buttonViewModel.onTap.innertubeCommand.showSheetCommand.panelLoadingStrategy.inlineContent.sheetViewModel';
    const sheetmodel = getObjectByPath(renderer, path);
    if (!sheetmodel) return null;

    const items = sheetmodel.content?.listViewModel?.listItems;
    if (!items) return null;

    const channel = lockupChannelFrom(renderer);
    const video = lockupVideoFrom(renderer);
    const channelId = channel.id;
    const channelName = channel.text;
    const videoId = video.id;
    const videoName = video.text;

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

  // Shorts-shelf branch of extractMenuItems: the sheet lives under menuOnTap
  // (not under metadata.menuButton like lockupViewModel). The channel id
  // decodes from reelWatchEndpoint.params (see shortsLockupChannelId) — there
  // is no channel name on the card — so the channel entry is offered only
  // when an id resolved. The blockTube metadata stamp mirrors lockupViewModel
  // so right-hand taps resolve through the same stamped path. Null when no
  // sheet.
  function extractShortsLockupMenuFlags(obj, attr) {
    const items = extractFromShortsLockupViewModel(obj[attr]);
    if (!items) return null;
    const { channel, video } = channelAndVideoFrom(obj[attr], 'shortsLockupViewModel');
    return {
      items,
      hasChannel: !!channel.id,
      hasVideo: !!video.id,
      isLockupViewModel: true,
    };
  }

  // Specific extractor for shortsLockupViewModel
  function extractFromShortsLockupViewModel(renderer) {
    const path =
      'menuOnTap.innertubeCommand.showSheetCommand.panelLoadingStrategy.inlineContent.sheetViewModel';
    const sheetmodel = getObjectByPath(renderer, path);
    if (!sheetmodel) return null;

    const items = sheetmodel.content?.listViewModel?.listItems;
    if (!items) return null;

    const { channel, video } = channelAndVideoFrom(renderer, 'shortsLockupViewModel');

    const metadataBlock = {
      metadata: {
        channelId: channel.id,
        channelName: channel.text,
        videoId: video.id,
        videoName: video.text,
        removeObject: true,
        // Marks taps from a Shorts shelf card: their sheet has no native
        // hide affordance, so menuOnTap dismisses the card from the DOM
        // directly (see dismissShortsShelfCard) instead of relying on the
        // cloned feedback command the way lockup cards do.
        isShorts: true,
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

  // Watch-page branch of extractMenuItems: the reel `...` menu holds
  // listItemViewModel entries ("Description", "Save to playlist", ...), so the
  // lockup-style entries below render alongside natively. The channel resolves
  // from the reel channel bar (avatar/browse link + handle text); the video id
  // is the /shorts/<id> URL and the name is the document title. The stamp
  // carries isWatch so taps pause the reel instead of hunting a shelf card.
  // Null when the overlay has no menu (e.g. embeds).
  function extractReelOverlayMenuFlags(obj, attr) {
    const items = extractFromReelOverlay(obj[attr]);
    if (!items) return null;
    const channel = reelOverlayChannelFrom(obj[attr]);
    const video = currentShortsVideo();
    return {
      items,
      hasChannel: !!channel.id,
      hasVideo: !!video.id,
      isLockupViewModel: true,
      isReelOverlay: true,
    };
  }

  // Menu items array of the reel overlay `...` menu. The blockTube stamp goes
  // on the overlay itself: right-hand taps read the symbol-keyed component
  // data wrapping it (see getRecommendedParentData), mirroring the sheet
  // stamp of the lockup branches.
  function extractFromReelOverlay(renderer) {
    const items = getObjectByPath(renderer, 'menu.menuRenderer.items');
    if (!Array.isArray(items)) return null;

    const channel = reelOverlayChannelFrom(renderer);
    const video = currentShortsVideo();

    Object.defineProperty(renderer, 'blockTube', {
      value: {
        metadata: {
          channelId: channel.id,
          channelName: channel.text,
          videoId: video.id,
          videoName: video.text,
          removeObject: true,
          isShorts: true,
          isWatch: true,
        },
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });

    return items;
  }

  // Watch-page topbar branch of extractMenuItems: the VISIBLE `...` sheet
  // lives in the reel topbar's trailing-buttons MORE_VERT buttonViewModel
  // (showSheetCommand → inlineContent → sheetViewModel → listViewModel →
  // listItems), not in overlay.menu (a decoy copy nothing renders). `attr`
  // is the matched key: live swipe responses carry `topbar` (and `overlay`)
  // at the top level, while the embedded prefetch wraps the same fields in
  // `reelItemWatchResponse` — normalize to the inner object first. Channel
  // resolves from the same response's overlay channel bar (correct per reel
  // even for prefetches); the video resolves live at tap time (see
  // stampedMenuBlockData), so prefetch staleness cannot misattribute a tap.
  // Null when the response carries no such button (shape drift) — the
  // overlay-menu branch above stays as the fallback.
  function extractReelTopbarMenuFlags(obj, attr) {
    const root = attr === 'reelItemWatchResponse' ? obj[attr] : obj;
    const found = findReelTopbarSheet(root);
    if (!found) return null;
    const overlay = getObjectByPath(root, 'overlay.reelPlayerOverlayRenderer');
    const channel = overlay ? reelOverlayChannelFrom(overlay) : { id: undefined, text: undefined };
    const video = currentShortsVideo();
    Object.defineProperty(found.sheet, 'blockTube', {
      value: {
        metadata: {
          channelId: channel.id,
          channelName: channel.text,
          videoId: video.id,
          videoName: video.text,
          removeObject: true,
          isShorts: true,
          isWatch: true,
        },
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });
    return {
      items: found.listItems,
      sheet: found.sheet,
      hasChannel: !!channel.id,
      hasVideo: !!video.id,
      isLockupViewModel: true,
      isReelOverlay: true,
    };
  }

  // The MORE_VERT trailing button of a reel response topbar, or null. Slots
  // are {topBarConditionalButtonViewModel:{button:{buttonViewModel}}} (a
  // direct {button:{buttonViewModel}} slot is accepted as fallback).
  function findReelTopbarButton(response) {
    let slots = null;
    try {
      slots = getObjectByPath(response, 'topbar.topBarViewModel.trailingButtons');
    } catch (e) {
      slots = null;
    }
    if (!Array.isArray(slots)) return null;
    const count = Math.min(slots.length, 12);
    for (let i = 0; i < count; i += 1) {
      const viewModel = reelTopbarButtonViewModel(slots[i]);
      if (viewModel && viewModel.iconName === 'MORE_VERT') return viewModel;
    }
    return null;
  }

  function reelTopbarButtonViewModel(slot) {
    try {
      const conditional = slot && slot.topBarConditionalButtonViewModel;
      const direct =
        (conditional && conditional.button && conditional.button.buttonViewModel) ||
        (slot && slot.button && slot.button.buttonViewModel);
      return direct || null;
    } catch (e) {
      return null;
    }
  }

  // Inline sheet + row list of a MORE_VERT button, or null when the button
  // carries no inline sheet (deferred shapes we do not handle).
  function findReelTopbarSheet(response) {
    const button = findReelTopbarButton(response);
    if (!button) return null;
    const sheet = getObjectByPath(
      button,
      'onTap.innertubeCommand.showSheetCommand.panelLoadingStrategy.inlineContent.sheetViewModel',
    );
    if (!sheet) return null;
    const listItems = getObjectByPath(sheet, 'content.listViewModel.listItems');
    if (!Array.isArray(listItems)) return null;
    return { sheet, listItems };
  }

  // Channel bar paths, avatar link first, handle command-runs second. The
  // metadataItems hop is an array; the dotted-path walker reads the first
  // element owning the key, which is the single channel bar.
  const REEL_CHANNEL_ID_PATHS = [
    'playerOverlay.reelPlayerOverlayViewModel.metapanel.reelMetapanelViewModel.metadataItems.reelChannelBarViewModel.decoratedAvatarViewModel.decoratedAvatarViewModel.rendererContext.commandContext.onTap.innertubeCommand.browseEndpoint.browseId',
    'playerOverlay.reelPlayerOverlayViewModel.metapanel.reelMetapanelViewModel.metadataItems.reelChannelBarViewModel.channelName.commandRuns.onTap.innertubeCommand.browseEndpoint.browseId',
  ];

  function reelOverlayChannelFrom(renderer) {
    return {
      id: getFlattenByPath(renderer, REEL_CHANNEL_ID_PATHS),
      text: getFlattenByPath(renderer, [
        'playerOverlay.reelPlayerOverlayViewModel.metapanel.reelMetapanelViewModel.metadataItems.reelChannelBarViewModel.channelName.content',
        'playerOverlay.reelPlayerOverlayViewModel.metapanel.reelMetapanelViewModel.metadataItems.reelChannelBarViewModel.channelName',
      ]),
    };
  }

  // The playing Short: shared helper in paths.js (id from the /shorts/<id>
  // URL, name from the document title). Used here for menu stamps and tap
  // resolution — do not redeclare locally.

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
    const attr = resolveContextMenuAttr(obj, keys);
    if (!attr) return null;

    const result = extractMenuItems(obj, attr);
    if (!result || !Array.isArray(result.items)) return null;

    return { ...result, attr };
  }

  function injectBlockMenuItems(
    items,
    hasChannel,
    hasVideo,
    isLockupViewModel,
    currentObj,
    store,
    isReelOverlay,
  ) {
    if (isReelOverlay) {
      injectReelOverlayButtons(items, hasChannel, hasVideo, store);
      return;
    }
    if (isLockupViewModel) {
      injectLockupViewModelButtons(items, hasChannel, hasVideo, currentObj, store);
      return;
    }
    injectStandardMenuButtons(items, hasChannel, hasVideo, store);
  }

  // Watch-page reel entries: clone a native row and retitle it. The popup's
  // listItem transformer drops rows whose onTap command it cannot render,
  // which is what the first synthesized no-op command did — hence injected
  // entries in data but never on screen. Cloning a native row keeps the
  // renderable shape, but the borrowed native command must then be
  // neutralized: tapping a Block row must NOT execute someone else's action
  // (Description/Save/... opening on a Block tap). The replacement is the
  // same feedback-only no-op the lockup sheets use (see
  // overwriteOnTapCommand): silent, no hide — menuOnTap's own block post +
  // overlay/skip are the whole effect (no toast by design). Skipping
  // forwardMenuTap alone is not enough, because the row's native handler
  // fires on its own via the framework click binding. Params stay unique per entry (rows sharing a
  // command verbatim collapse into the native row under param dedupe), and
  // each clone is stamped so a cached response filtered twice never
  // duplicates entries. Icon swapped to the BlockTube action; the blockTube
  // stamp stays on the sheet (extractReelTopbarMenuFlags) / overlay renderer
  // (extractFromReelOverlay), not per item.
  function isOurReelEntry(item) {
    try {
      return !!(
        item &&
        item.listItemViewModel &&
        item.listItemViewModel.rendererContext &&
        item.listItemViewModel.rendererContext.blockTubeReelEntry
      );
    } catch (e) {
      return false;
    }
  }

  function cloneReelMenuItem(template, title, imageName, tag) {
    const clone = deepClone(template);
    const vm = clone.listItemViewModel;
    if (vm.title) vm.title.content = title;
    else vm.title = { content: title };
    try {
      const source = vm.leadingImage && vm.leadingImage.sources && vm.leadingImage.sources[0];
      if (source && source.clientResource) source.clientResource.imageName = imageName;
    } catch (e) {}
    try {
      const context = vm.rendererContext;
      // Neutralize the borrowed native command in place: the clone keeps the
      // renderable row shape, but a Block tap must never run Description /
      // Save / ... — not via forwardMenuTap and not via the framework's own
      // click binding either.
      if (context) {
        if (!context.commandContext || typeof context.commandContext !== 'object') {
          context.commandContext = {};
        }
        if (!context.commandContext.onTap || typeof context.commandContext.onTap !== 'object') {
          context.commandContext.onTap = {};
        }
        context.commandContext.onTap.innertubeCommand = {
          clickTrackingParams: `bt-${tag}`,
          commandMetadata: { webCommandMetadata: { sendPost: false, apiUrl: '' } },
          feedbackEndpoint: {
            feedbackToken: '',
            uiActions: { hideEnclosingContainer: false },
            actions: [],
          },
        };
        context.blockTubeReelEntry = tag;
      }
      vm.trackingParams = `bt-${tag}`;
    } catch (e) {}
    return clone;
  }

  function injectReelOverlayButtons(items, hasChannel, hasVideo, store) {
    if (!items.length) return;
    if (items.some(isOurReelEntry)) return;
    const template = items.find((item) => item && item.listItemViewModel && !isOurReelEntry(item));
    if (!template) return;

    const fresh = [];
    if (isWhitelistMenuMode(store)) {
      // Whitelist mode: the visible short is already allowlisted, so offer
      // removal instead of a pointless re-allow.
      if (hasChannel)
        fresh.push(cloneReelMenuItem(template, 'Remove from Whitelist', 'REMOVE', 'unallow'));
    } else {
      if (hasChannel && showMenuEntry(OPT.MENU_BLOCK_CHANNEL, store))
        fresh.push(cloneReelMenuItem(template, 'Block Channel', 'NOT_INTERESTED', 'channel'));
      if (hasVideo && showMenuEntry(OPT.MENU_BLOCK_VIDEO, store))
        fresh.push(cloneReelMenuItem(template, 'Block Video', 'NOT_INTERESTED', 'video'));
      if (hasChannel && showMenuEntry(OPT.MENU_ALLOW_CHANNEL, store))
        fresh.push(cloneReelMenuItem(template, 'Allow Channel', 'CHECK', 'allow'));
    }
    // Appended to the bottom, after the native rows.
    for (let i = 0; i < fresh.length; i += 1) items.push(fresh[i]);
  }

  function injectLockupViewModelButtons(items, hasChannel, hasVideo, currentObj, store) {
    if (!items.length) return;

    const cleanChannelContext = createCleanContext(items, store, true, currentObj);
    const cleanVideoContext = createCleanContext(items, store, false, currentObj);

    const blockChannelItem = createLockupButtonItem('Block Channel', cleanChannelContext);
    const blockVideoItem = createLockupButtonItem('Block Video', cleanVideoContext);

    if (isWhitelistMenuMode(store)) {
      // Whitelist mode: the visible cards are already allowlisted, so offer
      // removal instead of a pointless re-allow.
      const removeChannelItem = createLockupButtonItem(
        'Remove from Whitelist',
        createCleanContext(items, store, true, currentObj, true, true),
        'REMOVE',
      );
      if (hasChannel) items.push(removeChannelItem);
      return;
    }

    // Block mode additionally offers allowlisting, so the allowlist can be
    // built while browsing normally (an empty allowlist hides everything, so
    // there would be nothing left to allowlist from).
    const allowChannelItem = createLockupButtonItem(
      'Allow Channel',
      createCleanContext(items, store, true, currentObj, true),
      'CHECK',
    );
    if (hasChannel && showMenuEntry(OPT.MENU_BLOCK_CHANNEL, store)) items.push(blockChannelItem);
    if (hasVideo && showMenuEntry(OPT.MENU_BLOCK_VIDEO, store)) items.push(blockVideoItem);
    if (hasChannel && showMenuEntry(OPT.MENU_ALLOW_CHANNEL, store)) items.push(allowChannelItem);
  }

  // Native-command fast path for real block entries: reuse YouTube's own
  // feedback item (by leading icon) when block_feedback is on. Allow/remove
  // entries must never reuse it (it hides the card). Returns the item, or
  // undefined when no feedback icon matches.
  function findNativeFeedbackItem(items, isChannel) {
    const targetIcons = isChannel ? ['REMOVE', 'DELETE'] : ['NOT_INTERESTED', 'DELETE'];
    for (const icon of targetIcons) {
      const item = items.find((i) => {
        const imageName = getObjectByPath(
          i,
          'listItemViewModel.leadingImage.sources.clientResource.imageName',
        );
        return imageName === icon;
      });
      if (item) return item;
    }
    return undefined;
  }

  // Toast text for a cloned lockup context: videos always "Video Blocked",
  // channels depend on allow/remove/whitelist mode.
  function lockupToastMessage(isChannel, forAllow, forRemove, store) {
    if (!isChannel) return 'Video Blocked';
    if (forRemove) return 'Removed from whitelist';
    if (forAllow || isWhitelistMenuMode(store)) return 'Channel Allowed';
    return 'Channel Blocked';
  }

  // The toast action shown after a cloned block tap (allow/remove entries
  // execute silently — the hide flag is their only native effect).
  function lockupToastAction(msg) {
    return {
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
    };
  }

  // Overwrite a cloned context's onTap with a no-op command carrying only
  // our feedback (toast + hide flag). Allow entries keep the card in place;
  // removals and blocks hide it.
  function overwriteOnTapCommand(cleanContext, msg, contentId, forAllow, forRemove) {
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
            // Allow entries keep the card in place; removals and blocks
            // hide it.
            hideEnclosingContainer: !forAllow || forRemove,
          },
          // No confirmation popups: allow/remove entries execute silently
          // (their hide flag above is the only native effect). Real block
          // entries keep the toast.
          actions: forAllow || forRemove ? [] : [lockupToastAction(msg)],
          contentId,
        },
      };
    }
  }

  // Resolve the card id YouTube's hide-enclosing-container feedback needs.
  // Regular lockups carry contentId; shorts shelf cards do not (they key on
  // entityId / the reelWatch videoId instead), so without this fallback the
  // feedback carries contentId: undefined and the blocked Short stays put.
  function lockupFeedbackContentId(currentObj) {
    if (currentObj && currentObj.contentId !== undefined) return currentObj.contentId;
    if (currentObj && typeof currentObj.entityId === 'string') return currentObj.entityId;
    const videoId =
      currentObj && getObjectByPath(currentObj, 'onTap.innertubeCommand.reelWatchEndpoint.videoId');
    if (typeof videoId === 'string') return videoId;
    return currentObj && currentObj.contentId;
  }

  function createCleanContext(
    items,
    store,
    isChannel,
    currentObj,
    forAllow = false,
    forRemove = false,
  ) {
    // Allow/remove entries must never reuse YouTube's native command: it
    // hides the card (the home-grid removal reported for Allow taps). They
    // always get a clone with the matching toast and hide flag, regardless
    // of the block_feedback option. Real block entries keep the identity
    // fast-path so YouTube's own feedback flow keeps working.
    if (!forAllow && !forRemove && store.options[OPT.BLOCK_FEEDBACK] && items.length > 0) {
      const item = findNativeFeedbackItem(items, isChannel);
      if (item) {
        return item?.listItemViewModel?.rendererContext;
      }
    }

    const baseContext = items[0]?.listItemViewModel?.rendererContext;
    if (!baseContext) return null;

    const msg = lockupToastMessage(isChannel, forAllow, forRemove, store);
    const cleanContext = deepClone(baseContext);
    overwriteOnTapCommand(
      cleanContext,
      msg,
      lockupFeedbackContentId(currentObj),
      forAllow,
      forRemove,
    );

    return cleanContext;
  }

  function createLockupButtonItem(title, rendererContext, imageName = 'NOT_INTERESTED') {
    const item = {
      listItemViewModel: {
        title: { content: title },
        leadingImage: {
          sources: [{ clientResource: { imageName } }],
        },
        rendererContext,
      },
    };

    return item;
  }

  function injectStandardMenuButtons(items, hasChannel, hasVideo, store) {
    const allowMode = isWhitelistMenuMode(store);
    const blockChannelItem = createStandardBlockItem('Block Channel');
    const blockVideoItem = createStandardBlockItem('Block Video');
    const allowChannelItem = createStandardBlockItem('Allow Channel', 'CHECK');
    const removeChannelItem = createStandardBlockItem('Remove from Whitelist', 'REMOVE');

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

    if (allowMode) {
      // Whitelist mode: the visible cards are already allowlisted, so offer
      // removal instead of a pointless re-allow (videos can't be allowlisted).
      if (hasChannel) items.push(removeChannelItem);
      return;
    }

    // Block mode additionally offers allowlisting, so the allowlist can be
    // built while browsing normally (an empty allowlist hides everything, so
    // there would be nothing left to allowlist from).
    if (hasChannel && showMenuEntry(OPT.MENU_BLOCK_CHANNEL, store)) items.push(blockChannelItem);
    if (hasVideo && showMenuEntry(OPT.MENU_BLOCK_VIDEO, store)) items.push(blockVideoItem);
    if (hasChannel && showMenuEntry(OPT.MENU_ALLOW_CHANNEL, store)) items.push(allowChannelItem);
  }

  // Desktop overflow menu: a minimal menuServiceItemRenderer entry appended to
  // the video's existing overflow menu (endpoint cloned from a feedback item
  // when block_feedback is on, see injectStandardMenuButtons).
  function createStandardBlockItem(text, iconType = 'NOT_INTERESTED') {
    return {
      menuServiceItemRenderer: {
        text: { runs: [{ text }] },
        icon: { iconType },
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

    const { items, hasChannel, hasVideo, isLockupViewModel, isReelOverlay, sheet, attr } =
      extracted;

    injectBlockMenuItems(
      items,
      hasChannel,
      hasVideo,
      isLockupViewModel,
      obj[attr],
      storageData,
      isReelOverlay,
    );

    // Reactive renderers re-render on property assignment, not on in-place
    // array mutation: if the reel popup bound the items array before our push
    // (eager pre-render), a plain push stays invisible while the data looks
    // right. Replacing the array reference notifies Polymer (property change)
    // and Lit-style renderers (property set) alike; lazy readers see the same
    // contents either way. Shelf sheets render lazily on open, so only the
    // reel surfaces need this.
    if (attr === 'reelPlayerOverlayRenderer') {
      const menu = getObjectByPath(obj[attr], 'menu.menuRenderer');
      if (menu && Array.isArray(menu.items)) menu.items = menu.items.slice();
    }
    if (attr === 'reelItemWatchResponse' || attr === 'topbar') {
      const list = sheet ? getObjectByPath(sheet, 'content.listViewModel') : null;
      if (list && Array.isArray(list.listItems)) list.listItems = list.listItems.slice();
    }

    // Attach metadata only if needed
    if (hasChannel || hasVideo) {
      obj[attr]._btOriginalAttr = attr;
    }
  }

  // Our own toast layer. The legacy yt-action dispatch below no longer
  // surfaces a visible toast on current YouTube, so taps that relied on it
  // confirmed with no feedback at all (the "Channel Allowed" seen on some
  // surfaces comes from the executed menu command itself — a different
  // system). This fixed-position div is styled property-by-property through
  // CSSOM only (no <style>, no innerHTML), so page CSP and Trusted Types
  // stay out of the way; pointer-events:none so it can never swallow clicks.
  let toastTimer = 0;

  // Create the toast div (see constraints above).
  function createToastElement() {
    const el = document.createElement('div');
    el.id = 'blocktube-toast';
    el.setAttribute('role', 'status');
    const style = el.style;
    style.position = 'fixed';
    style.left = '50%';
    style.bottom = '48px';
    style.transform = 'translateX(-50%)';
    style.zIndex = '2147483647';
    style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    style.color = '#fff';
    style.fontSize = '14px';
    style.fontFamily = 'Roboto, Arial, sans-serif';
    style.padding = '10px 16px';
    style.borderRadius = '8px';
    style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.4)';
    style.pointerEvents = 'none';
    style.display = 'none';
    (document.body || document.documentElement).appendChild(el);
    return el;
  }

  // Resolve the toast div, creating it on first use. Null when the DOM
  // offers no way to look it up or build it.
  function resolveToastElement() {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      return null;
    }
    if (typeof document.getElementById === 'function') {
      const existing = document.getElementById('blocktube-toast');
      if (existing) return existing;
    }
    return createToastElement();
  }

  // Show the message, then hide it after `duration`. Timer handles are
  // guarded: exotic page realms may lack them.
  function displayToastMessage(el, msg, duration) {
    el.textContent = msg;
    el.style.display = 'block';
    if (typeof clearTimeout === 'function') clearTimeout(toastTimer);
    if (typeof setTimeout === 'function') {
      toastTimer = setTimeout(() => {
        el.style.display = 'none';
      }, duration);
    }
  }

  function showDomToast(msg, duration) {
    const el = resolveToastElement();
    if (!el) return;
    displayToastMessage(el, msg, duration);
  }

  function openToast(msg, duration) {
    // Guaranteed feedback first; the legacy dispatch below is a harmless
    // no-op wherever YouTube no longer listens for it.
    try {
      showDomToast(msg, duration);
    } catch (e) {}
    try {
      legacyToast(msg, duration);
    } catch (e) {}
  }

  // The openPopupAction payload for a legacy toast: duration + message text
  // rendered as a notificationActionRenderer popup.
  function buildToastPopupAction(msg, duration) {
    return {
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
    };
  }

  // The yt-open-popup-action TOAST event payload for a message, dispatched
  // on the ytd-app element (a harmless no-op where YouTube no longer
  // listens — see showDomToast for the guaranteed feedback path).
  function buildLegacyToastEvent(msg, duration, ytdApp) {
    return new CustomEvent('yt-action', {
      bubbles: true,
      cancelable: false,
      composed: true,
      detail: {
        actionName: 'yt-open-popup-action',
        args: [buildToastPopupAction(msg, duration), ytdApp, undefined],
        returnValue: [],
        disableBroadcast: false,
        optionalAction: true,
      },
    });
  }

  function legacyToast(msg, duration) {
    const ytdApp = document.getElementsByTagName('ytd-app')[0];
    if (ytdApp === undefined) return;
    ytdApp.dispatchEvent(buildLegacyToastEvent(msg, duration, ytdApp));
  }

  // Map a mobile menu action to its block-list type. Undefined for unknown
  // actions (the tap is ignored).
  function mobileActionToBlockType(menuAction) {
    switch (menuAction) {
      case 'block_channel': {
        return 'channelId';
      }
      case 'allow_channel': {
        return 'whitelist';
      }
      case 'unallow_channel': {
        return 'unwhitelist';
      }
      case 'block_video': {
        return 'videoId';
      }
      default:
        return undefined;
    }
  }

  // Mobile video-page taps confirm with an alert and stop playback for
  // blocks/removals. Allowlists keep playback going.
  function confirmSlimVideoTap(type) {
    // Allowlists keep playback going; blocks and removals stop it.
    if (type !== 'whitelist') document.getElementById('movie_player').stopVideo();
    const noun = type === 'videoId' ? 'Video' : 'Channel';
    const verb = type === 'whitelist' ? 'Allowed' : type === 'unwhitelist' ? 'Removed' : 'Blocked';
    alert(`${noun} ${verb}`);
  }

  // Runtime comment filtering mirrors the blacklist path only: allowlist
  // taps must never push the commenter into the channelId blacklist.
  function filterCommentRuntime(type, data) {
    if (type === 'channelId' && data._btOriginalAttr === 'commentRenderer') {
      const comments = document.querySelector('ytm-section-list-renderer');
      storageData.filterData.channelId.push(RegExp(`^${data._btOriginalData.id}$`));
      noActiveFilters = computeNoActiveFilters();
      ObjectFilter(comments.data, filterRules.comments, [], false);
    }
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

    const type = mobileActionToBlockType(data._btMenuAction);
    if (type === undefined) return;

    postMessage(BLOCKTUBE_CONSTS.MESSAGES.CONTEXT_BLOCK_DATA, { type, info: data._btOriginalData });
    if (data._btOriginalAttr === 'slimVideoMetadataSectionRenderer') {
      confirmSlimVideoTap(type);
    }
    filterCommentRuntime(type, data);
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

  // Video-player tags whose menu blocks the now-playing video + channel.
  const PLAYER_MENU_TAGS = ['YTD-VIDEO-PRIMARY-INFO-RENDERER', 'YTD-WATCH-METADATA'];

  // Resolve channel/video from the now-playing player + owner renderers. The
  // owner id joins the player id when they disagree (collab/featured cases).
  function playerMenuBlockData() {
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
    return {
      channelData: {
        text: player.videoDetails.author,
        id: playerUCID,
      },
      videoData: {
        text: player.videoDetails.title,
        id: player.videoDetails.videoId,
      },
      removeParent: false,
      stopPlayer: true,
      isShorts: false,
      isWatch: false,
    };
  }

  // Resolve channel/video from the blockTube metadata stamped on lockup menus
  // (right-hand/recommended context carries no _btOriginalAttr).
  function stampedMenuBlockData(parentData) {
    const isWatch = parentData.blockTube?.metadata?.isWatch === true;
    // Watch taps resolve the video live from the URL: the stamp is written at
    // inject time, when a prefetched reel's response arrives while the URL
    // still shows the previous short — reading it then would block the wrong
    // video. The open sheet always belongs to the on-screen short, so the
    // live read is exact. The channel still comes from the stamp (the channel
    // bar is correct per reel even in prefetches).
    let videoData = {
      id: parentData.blockTube?.metadata?.videoId,
      text: parentData.blockTube?.metadata?.videoName,
    };
    if (isWatch) {
      const live = currentShortsVideo();
      if (live.id) videoData = live;
    }
    return {
      channelData: {
        id: parentData.blockTube?.metadata?.channelId,
        text: parentData.blockTube?.metadata?.channelName,
      },
      videoData,
      removeParent: false,
      stopPlayer: false,
      isShorts: parentData.blockTube?.metadata?.isShorts === true,
      isWatch,
    };
  }

  // Resolve channel/video through the rule paths for the menu's renderer.
  function ruleMenuBlockData(parentData) {
    const extracted = channelAndVideoFrom(parentData, parentData._btOriginalAttr);
    return {
      channelData: extracted.channel,
      videoData: extracted.video,
      removeParent: true,
      stopPlayer: false,
      isShorts: false,
      isWatch: false,
    };
  }

  // Map a desktop menu label to its block-list type + payload. Null for
  // unknown labels (the tap is ignored).
  function menuLabelToBlockTarget(menuAction, channelData, videoData) {
    switch (menuAction) {
      case 'Block Channel':
        return { type: 'channelId', data: channelData };
      case 'Allow Channel':
        return { type: 'whitelist', data: channelData };
      case 'Remove from Whitelist':
        return { type: 'unwhitelist', data: channelData };
      case 'Block Video':
        return { type: 'videoId', data: videoData };
      default:
        return null;
    }
  }

  function getBlockData(parentDom, parentData, isDataFromRightHandSide, menuAction) {
    // Video player context menu
    let resolved;
    if (PLAYER_MENU_TAGS.includes(parentDom.tagName)) {
      resolved = playerMenuBlockData();
    } else if (isDataFromRightHandSide) {
      resolved = stampedMenuBlockData(parentData);
    } else {
      resolved = ruleMenuBlockData(parentData);
    }

    const result = menuLabelToBlockTarget(menuAction, resolved.channelData, resolved.videoData);
    if (!result) return null;

    return {
      ...result,
      removeParent: resolved.removeParent,
      stopPlayer: resolved.stopPlayer,
      isShorts: resolved.isShorts === true,
      isWatch: resolved.isWatch === true,
    };
  }

  // Right-hand (recommended) context: traverse 4 levels up, then read the
  // symbol-keyed component data. Empty object when any hop is missing.
  function getRecommendedParentData(element) {
    // Traverse 4 levels up to find the parent DOM
    const parentDom = element?.parentElement?.parentElement?.parentElement?.parentElement;

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

    return { parentDom, parentData: parentDomData[parentDomSymbols[0]]?.value };
  }

  // Standard context: find the eventSink across the known Polymer/dataHost
  // paths, then resolve the parent component. Empty object when missing.
  function findEventSink(element) {
    // Try to find eventSink in multiple paths without using intermediate variable
    return (
      getObjectByPath(
        element.parentElement?.parentElement,
        'polymerController.forwarder_.eventSink',
      ) ||
      getObjectByPath(element.parentElement, '__dataHost.eventSink_') ||
      getObjectByPath(element.parentElement, '__dataHost.forwarder_.eventSink') ||
      getObjectByPath(element.parentElement, '__dataHost.hostElement.inst.eventSink_')
    );
  }

  // Standard context parent from the eventSink: component, host element, or
  // grandparent — whichever resolves first. Empty object when data is missing.
  function getEventSinkParentData(element) {
    const eventSink = findEventSink(element);
    if (!eventSink) {
      console.warn('Could not find eventSink in any expected path');
      return {};
    }

    const parentDom =
      eventSink.parentComponent ||
      eventSink.parentElement.__dataHost?.hostElement ||
      eventSink.parentElement?.parentElement;
    const parentData = parentDom?.data;

    if (!parentDom || !parentData) {
      console.warn('Failed to extract parentDom or parentData');
      return {};
    }
    return { parentDom, parentData };
  }

  function getParentDomAndData(isDataFromRightHandSide, element) {
    if (isDataFromRightHandSide) {
      return getRecommendedParentData(element);
    }
    return getEventSinkParentData(element);
  }

  // `message` is the inline placeholder left where the card was: "Blocked"
  // for blocks, "Removed from whitelist" for removals. Allow entries never
  // reach this helper — the card stays in place and only a toast confirms.
  function removeParentHelper(isDataFromRightHandSide, parentDom, message = 'Blocked') {
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
          responseText: { simpleText: message },
        },
      };
      parentDom.setAttribute('is-dismissed', '');
    }
  }

  // Desktop menu labels that carry a block/allow action. Anything else is a
  // native entry — prevent the tap-through and ignore it.
  const MENU_TAP_ACTIONS = [
    'Block Channel',
    'Block Video',
    'Allow Channel',
    'Remove from Whitelist',
  ];

  // Menu-tap types that take the card off the page (allow taps keep it so it
  // can be watched right away).
  function isCardRemovingTap(type) {
    return type === 'channelId' || type === 'videoId' || type === 'unwhitelist';
  }

  // No toast on Shorts taps by design: the disappearing card (shelf) and the
  // reason panel + auto-advance (watch) are the whole feedback.

  // Best-effort pause of the reel player after blocking the playing Short
  // (the watch-page equivalent of stopVideo on regular watch pages). The
  // first <video> on /shorts/ is the reel itself.
  function pauseReelPlayer() {
    try {
      if (typeof document === 'undefined' || typeof document.querySelector !== 'function') {
        return;
      }
      const video = document.querySelector('video');
      if (video && typeof video.pause === 'function') video.pause();
    } catch (e) {}
  }

  // Shorts shelf cards have no native hide affordance — their sheet holds
  // only items like "Add to queue" / "Send feedback", so the cloned feedback
  // command that dismisses lockup cards leaves a Shorts card in place.
  // Dismiss it from the DOM instead: the card links to /shorts/<videoId>, so
  // the grid item wrapping that link gets the same "Blocked" placeholder the
  // other surfaces show, plus display:none so the card is gone even where the
  // placeholder mechanism does not render. Fail-open throughout: any miss
  // leaves the card for the next data load, which the just-added filter entry
  // already covers.
  const SHORTS_CARD_SELECTORS = [
    'ytd-rich-item-renderer',
    'yt-lockup-view-model',
    'yt-shorts-lockup-view-model',
    'ytd-reel-item-renderer',
  ];

  function dismissShortsShelfCard(videoId, message = 'Blocked') {
    if (typeof videoId !== 'string' || videoId.length === 0) return;
    if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') {
      return;
    }
    let links = null;
    try {
      // Video ids are [A-Za-z0-9_-]-only, so interpolation cannot break out
      // of the attribute selector.
      links = document.querySelectorAll(`a[href*="/shorts/${videoId}"]`);
    } catch (e) {
      return;
    }
    if (!links) return;
    for (let i = 0; i < links.length; i += 1) {
      try {
        const anchor = links[i];
        if (!anchor || typeof anchor.closest !== 'function') continue;
        const card = anchor.closest(SHORTS_CARD_SELECTORS.join(','));
        if (!card) continue;
        removeParentHelper(true, card, message);
        leaveShortsBlockedPlaceholder(card, message);
      } catch (e) {}
    }
  }

  // Inline "Blocked" placeholder for a Shorts card, mirroring what regular
  // video cards show (removeParentHelper's dismissedRenderer): the card keeps
  // its grid slot with a muted box instead of vanishing silently. The box is
  // built node-by-node through CSSOM (no innerHTML), so page CSP and Trusted
  // Types stay out of the way — the same constraint as the toast layer above.
  function leaveShortsBlockedPlaceholder(card, message) {
    let height = 0;
    try {
      height = card.offsetHeight || 0;
    } catch (e) {}
    const box = document.createElement('div');
    box.textContent = message;
    const style = box.style;
    style.display = 'flex';
    style.alignItems = 'center';
    style.justifyContent = 'center';
    style.minHeight = `${height > 40 ? height : 200}px`;
    style.borderRadius = '12px';
    style.backgroundColor = 'var(--yt-spec-badge-chip-background, rgba(0, 0, 0, 0.05))';
    style.color = 'var(--yt-spec-text-secondary, #888)';
    style.fontSize = '14px';
    style.fontFamily = 'Roboto, Arial, sans-serif';
    card.textContent = '';
    card.appendChild(box);
    if (card.style) card.style.display = '';
  }

  // Apply the visible effect of a desktop menu tap: removals replace the card
  // with a placeholder, blocks do the same, allow taps keep the card in place
  // so it can be watched right away (the storage write is the whole effect).
  function applyMenuTapEffect(type, removeParent, stopPlayer, isDataFromRightHandSide, parentDom) {
    // No confirmation popups by design: allow taps keep the card in place so
    // it can be watched right away, and removals already replace the card
    // itself — the storage write above is the whole visible effect.
    if (type === 'unwhitelist') {
      if (removeParent) {
        // Remove correct component based on parentDom
        removeParentHelper(isDataFromRightHandSide, parentDom, 'Removed from whitelist');
      } else if (stopPlayer) {
        document.getElementById('movie_player').stopVideo();
      }
    } else if (type !== 'whitelist') {
      if (removeParent) {
        // Remove correct component based on parentDom
        removeParentHelper(isDataFromRightHandSide, parentDom);
      } else if (stopPlayer) {
        document.getElementById('movie_player').stopVideo();
      }
    }
  }

  // Forward the tap to YouTube's own handler when the menu entry carries a
  // service endpoint (native feedback flow).
  function forwardMenuTap(event) {
    if (this.data.serviceEndpoint) {
      if (this.onTap) this.onTap(event);
      else if (this.onTap_) this.onTap_(event);
    }
  }

  function menuOnTap(event) {
    if (storageData === undefined) return;

    const { isDataFromRightHandSide, menuAction } = getActionMenuData(this);

    if (!MENU_TAP_ACTIONS.includes(menuAction)) {
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
    const { type, data, removeParent, stopPlayer, isShorts, isWatch } = getBlockData(
      parentDom,
      parentData,
      isDataFromRightHandSide,
      menuAction,
    );

    // Notify system what data should be added to the block list. Shorts taps
    // carry their provenance along: the options-page entry then reads
    // "Blocked by short context menu" instead of "context menu", so the
    // surface a block came from stays visible.
    const blockInfo = isShorts || isWatch ? { ...data, via: 'shorts' } : data;
    postMessage(BLOCKTUBE_CONSTS.MESSAGES.CONTEXT_BLOCK_DATA, { type, info: blockInfo });

    applyMenuTapEffect(type, removeParent, stopPlayer, isDataFromRightHandSide, parentDom);
    // Shorts taps can resolve through the stamped sheet path (isShorts) or,
    // when the tapped item renders a single formatted string, the generic rule
    // path via _btOriginalAttr — both must confirm and dismiss. The id lands
    // in the block list either way, which is why a tap can "work" yet leave
    // the card up with no feedback when only the stamp is checked.
    const isShortsTap = isShorts || parentData?._btOriginalAttr === 'shortsLockupViewModel';
    if (isShortsTap && isCardRemovingTap(type)) {
      if (isWatch) {
        applyWatchBlockEffect(type, data, parentData);
      } else {
        dismissShortsShelfCard(
          shortsTapVideoId(parentData, type, data),
          type === 'unwhitelist' ? 'Removed from whitelist' : 'Blocked',
        );
      }
    }
    // Forward the tap to YouTube's own handler, except on the Shorts watch
    // page: reel entries clone a native row purely so the popup renders them,
    // and their command is neutralized at clone time — but never execute
    // anything borrowed here, so a Block tap can never open
    // Description/Save/... .
    if (!isWatch) forwardMenuTap.call(this, event);
  }

  // Visible effect of blocking the playing Short: the menu tap lands after
  // the player response already played, so the filter path (disablePlayer →
  // overlay + skip) never runs for it. Reproduce it here: pause first (audio
  // stops at once), paint the reason panel over the player root, then arm
  // the same auto-advance sweep a filtered response would. When skip is off
  // or capped, the pause + panel are the whole effect — the short stays put
  // but covered and silent instead of playing on. Fail-open throughout.
  // Called only for card-removing taps (channelId/videoId/unwhitelist — see
  // isCardRemovingTap above), so allow taps never reach here.
  function applyWatchBlockEffect(type, data, parentData) {
    try {
      pauseReelPlayer();
    } catch (e) {}
    if (type === 'unwhitelist') return;
    try {
      const live = currentShortsVideo();
      const stamp = (parentData && parentData.blockTube && parentData.blockTube.metadata) || {};
      const videoId =
        (type === 'videoId' && data && typeof data.id === 'string' && data.id) ||
        (typeof live.id === 'string' && live.id) ||
        (typeof stamp.videoId === 'string' && stamp.videoId) ||
        undefined;
      if (typeof videoId !== 'string' || videoId.length === 0) return;
      const channelId =
        (type !== 'videoId' && data && typeof data.id === 'string' && data.id) ||
        (typeof stamp.channelId === 'string' && stamp.channelId) ||
        undefined;
      const message = type === 'videoId' ? 'Video Blocked' : 'Channel Blocked';
      try {
        showBlockedShortOverlay(
          {
            videoId,
            channelId,
            channelName:
              (type !== 'videoId' && data && data.text) || stamp.channelName || undefined,
            title: (type === 'videoId' && data && data.text) || live.text || stamp.videoName,
          },
          message,
        );
      } catch (e) {}
      try {
        skipBlockedShort(videoId);
      } catch (e) {}
    } catch (e) {}
  }

  // Video id of a shelf Shorts tap for the dismissal lookup: stamped metadata
  // first; on the rule branch re-resolve through the Shorts rule (a Block
  // Video tap already carries it as its payload).
  function shortsTapVideoId(parentData, type, data) {
    const stamped = parentData?.blockTube?.metadata?.videoId;
    if (typeof stamped === 'string' && stamped.length > 0) return stamped;
    if (type === 'videoId' && data && typeof data.id === 'string') return data.id;
    try {
      const resolved = channelAndVideoFrom(parentData, 'shortsLockupViewModel');
      if (resolved && typeof resolved.video.id === 'string') return resolved.video.id;
    } catch (e) {}
    return undefined;
  }

  // ================== src/scripts/inject/shorts-overlay.js ==================

  // Blocked-Shorts overlay: one full-size reason panel anchored to the Shorts
  // media host (reel renderer preferred, `#shorts-player` fallback).
  // Earlier versions anchored to the <video> rect (v1: first-paint offset and
  // z-fighting with YouTube's own error layers) or with an overscan margin
  // (v2: bled over the masthead/search bar); this version uses no rect math,
  // no scroll/resize sync — an inset-0 child of the host tracks it. Anchor
  // one level above the Shorts player root: the main reel renderer
  // (`ytd-reel-video-renderer#reel-video-renderer`), else the reel the player
  // sits in, else `#shorts-player` itself
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
  // Block Channel / Block Video belong in the reel `...` menu). The
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
      let root = node && typeof node.getRootNode === 'function' ? node.getRootNode() : null;
      let guard = 0;
      while (root && root.host && guard < 4) {
        guard += 1;
        const host = root.host;
        try {
          const tag = host && typeof host.tagName === 'string' ? host.tagName.toLowerCase() : '';
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

  // Collect DOM nodes for a selector as a plain array. Shared by the
  // video/sequence-thumb lookups below (same fail-open traversal).
  // Fail-open throughout; exotic realms without DOM do nothing.
  function shortsOverlayQueryNodes(selector) {
    try {
      if (typeof document === 'undefined') return [];
      if (typeof document.querySelectorAll !== 'function') return [];
      const nodes = document.querySelectorAll(selector);
      if (!nodes || typeof nodes.length !== 'number') return [];
      const out = [];
      for (let i = 0; i < nodes.length; i += 1) {
        if (nodes[i]) out.push(nodes[i]);
      }
      return out;
    } catch (e) {
      return [];
    }
  }

  // Every <video> YouTube may already have decoding the blocked Short. The
  // player response ships playable streams with status OK (ytInitialPlayer
  // Response carries streamingData + thumbnails), and the reel host upgrades
  // after the response, so the reason panel alone leaves the first frame
  // visible. Hiding the element shows the black container behind it instead.
  function shortsOverlayVideoNodes() {
    try {
      return shortsOverlayQueryNodes('video');
    } catch (e) {
      return [];
    }
  }

  // The upcoming-short strip renders each preload as a plain div with the
  // frame baked in as a CSS background-image
  // (.reel-video-in-sequence-thumbnail): no video, no img, invisible to the
  // video hide above. Same hide-until-verdict protocol.
  function shortsOverlaySequenceThumbNodes() {
    try {
      return shortsOverlayQueryNodes('.reel-video-in-sequence-thumbnail');
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

  // First-frame hiding protocol (shared with the seed.js guard, which carries
  // its own copy: seed.js runs before this bundle exists, so it cannot call
  // these — keep the two in sync: attr names, cover z-index below the reason
  // panel's 2147483647, and the verdict shape on window.__blockTubeShortsVerdict).
  // Every Shorts media host gets a black cover div on appearance; covers lift
  // on a clean verdict and stay under the reason panel on a blocked one.
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

  // Every Shorts media host currently in the DOM (prefetched neighbours
  // included — the same host set the seed.js guard covers).
  function shortsOverlayAllHosts() {
    const hosts = [];
    try {
      const reels = shortsOverlayQueryNodes('ytd-reel-video-renderer');
      for (let i = 0; i < reels.length; i += 1) {
        if (hosts.indexOf(reels[i]) === -1) hosts.push(reels[i]);
      }
    } catch (e) {}
    try {
      const player = shortsOverlayPlayerHost();
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
  // the still-connected guard never re-covers them (neighbour reels keep
  // theirs until their own verdict or landing). Never throws.
  function shortsOverlayRevealPrehide() {
    const hosts = shortsOverlayCurrentHosts();
    for (let i = 0; i < hosts.length; i += 1) {
      try {
        const kids = hosts[i].children;
        if (kids) {
          for (let k = kids.length - 1; k >= 0; k -= 1) {
            try {
              const kid = kids[k];
              const mark = kid && kid.getAttribute ? kid.getAttribute('data-bt-cover') : null;
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

  // Swipe-start counterpart to the reveal above: re-cover every unrevealed
  // host now, so the landing decision (keep for blocked, lift for clean)
  // never races a paint. Needed for pre-rendered neighbours that already
  // exist — the seed observer only covers hosts on insertion.
  function shortsOverlayEnsureCovers() {
    const hosts = shortsOverlayAllHosts();
    for (let i = 0; i < hosts.length; i += 1) {
      try {
        shortsOverlayCoverHost(hosts[i]);
      } catch (e) {}
    }
  }

  // New short, undecided again: drop the old verdict, re-cover, and re-blank
  // (pausing the departing short). Only on Shorts pages — pausing videos
  // anywhere else would brick playback with no Shorts verdict coming to
  // restore it. Never throws.
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

  // True when the player response is a clean verdict for the short on screen.
  // Strict on identity: a clean prefetch for another short must not reveal
  // the current one. Fail-open otherwise.
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
    if (
      !attribution ||
      typeof attribution.videoId !== 'string' ||
      attribution.videoId.length === 0
    ) {
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
    // guard (covers stay) and the no-verdict fail-safe, then paint (which
    // blanks the video frame itself, including on the deferred-retry path).
    shortsOverlayRecordVerdict(attribution.videoId, false);
    removeShortsOverlay();
    shortsOverlayPaintCurrent();
  }

  // ================== src/scripts/inject/comment-dom.js ==================

  // Comment `...` menu entries (DOM layer).
  //
  // Why this exists: YouTube's new comments architecture splits comment data
  // across a ViewModel (reference key only) and frameworkUpdates mutations
  // (the actual commentEntityPayload). The `...` popup for those comments is
  // built client-side, so there is no intercepted JSON menu to inject a
  // "Block Channel" entry into — the native popup only offers Report. The
  // legacy commentRenderer JSON injection in context-menu.js stays for old
  // renderers; this DOM layer covers the new UI regardless of renderer.
  //
  // What it does: remembers which comment's `...` was pressed, then when
  // YouTube's popup menu opens, builds BlockTube entries right after the
  // native Report entry (Block Channel / Allow Channel, or Remove from
  // Whitelist in whitelist mode). Entries are real navigation-item elements
  // with text/icon bound through `data`, so they render exactly like the
  // native one, with no <style> and no innerHTML — page CSP and Trusted
  // Types stay out of the way. Tapping an entry posts the same
  // CONTEXT_BLOCK_DATA the JSON menus post and leaves a placeholder note
  // where the thread was (no toast).
  //
  // Identity: the filter pass sees every commentEntityPayload before it
  // renders (author.channelId + properties.commentId), so it records a
  // commentId -> channel map (see rememberCommentAuthor, called from
  // object-filter.js). Menu taps join the pressed comment's commentId /
  // commentKey against that map, falling back to component data and the
  // rendered author link.

  // commentId -> { id, text }. Populated while filtering (pre-render), read
  // when a menu entry is tapped. Reset past a few thousand entries so long
  // comment sessions cannot grow it without bound.
  let commentAuthorById = {};
  let commentAuthorCount = 0;

  // Record one entity payload's author for later menu taps. Called from
  // matchFilterProperties (the caller wraps it in try/catch, so realms
  // without this fragment keep working). Never throws.
  function rememberCommentAuthor(payload) {
    try {
      if (!payload || typeof payload !== 'object') return;
      const commentId = getObjectByPath(payload, 'properties.commentId');
      const id = getObjectByPath(payload, 'author.channelId');
      if (typeof commentId !== 'string' || commentId.length === 0) return;
      if (typeof id !== 'string' || id.length === 0) return;
      if (!commentAuthorById[commentId]) commentAuthorCount += 1;
      const name = getObjectByPath(payload, 'author.displayName');
      commentAuthorById[commentId] = {
        id,
        text: typeof name === 'string' && name.length > 0 ? name.slice(0, 200) : id,
      };
      if (commentAuthorCount > 3000) {
        commentAuthorById = {};
        commentAuthorCount = 0;
      }
    } catch (e) {}
  }

  // Author identity out of a comment element's component data. Tries the
  // legacy renderer shape first, then the entity-payload shape the new UI
  // resolves into component props, then a bare commentId for callers that
  // join it against the filter-time map. Never throws.
  function resolveCommentChannelFromData(data) {
    if (!data || typeof data !== 'object') return {};
    const out = {};
    const id =
      getObjectByPath(data, 'authorEndpoint.browseEndpoint.browseId') ||
      getObjectByPath(data, 'author.channelId') ||
      getObjectByPath(data, 'authorText.navigationEndpoint.browseEndpoint.browseId');
    if (typeof id === 'string' && id.length > 0) out.id = id;
    const text =
      getFlattenByPath(data, ['authorText', 'author.displayName']) ||
      (typeof data.authorText === 'string' ? data.authorText : undefined);
    if (typeof text === 'string' && text.length > 0) out.text = text;
    const commentId =
      getObjectByPath(data, 'commentId') ||
      getObjectByPath(data, 'properties.commentId') ||
      getObjectByPath(data, 'commentViewModel.commentViewModel.commentId');
    if (typeof commentId === 'string' && commentId.length > 0) out.commentId = commentId;
    return out;
  }

  // Component data off a rendered element: Polymer nodes expose `data`
  // directly, some views only via getCurrentData(), others stash it on the
  // __dataHost chain. First hit wins; anything else is an empty object.
  function commentElementData(el) {
    if (!el || typeof el !== 'object') return {};
    if (el.data && typeof el.data === 'object') return el.data;
    try {
      if (typeof el.getCurrentData === 'function') {
        const current = el.getCurrentData();
        if (current && typeof current === 'object') return current;
      }
    } catch (e) {}
    const hosted = getObjectByPath(el, '__dataHost.data') || getObjectByPath(el, '__data.data');
    if (hosted && typeof hosted === 'object') return hosted;
    return {};
  }

  // Last-resort identity from the rendered author link. A /channel/UC… href
  // carries the id directly; a /@handle href only names the author (the
  // tap then reports that it cannot resolve the id instead of blocking
  // the wrong channel).
  function commentChannelFromLink(el) {
    if (!el || typeof el.querySelector !== 'function') return {};
    let anchor = null;
    try {
      anchor = el.querySelector('a[href*="/channel/"]') || el.querySelector('a[href^="/@"]');
    } catch (e) {
      return {};
    }
    if (!anchor) return {};
    const href = anchor.getAttribute ? anchor.getAttribute('href') : null;
    if (typeof href !== 'string') return {};
    const channelMatch = /\/channel\/([A-Za-z0-9_-]{1,64})/.exec(href);
    if (channelMatch) {
      const text = anchor.textContent;
      const out = { id: channelMatch[1] };
      if (typeof text === 'string' && text.trim().length > 0) out.text = text.trim().slice(0, 200);
      return out;
    }
    return {};
  }

  // Candidate lookup ids for the filter-time map: rendered commentId
  // fields plus commentKey forms (older clients key entities as
  // `comment_entity_<id>`, so the stripped key joins directly).
  function commentLookupIds(el, data) {
    const ids = [];
    const push = (v) => {
      if (typeof v === 'string' && v.length > 0 && ids.indexOf(v) === -1) ids.push(v);
    };
    if (data && typeof data === 'object') {
      push(data.commentId);
      push(getObjectByPath(data, 'properties.commentId'));
      push(getObjectByPath(data, 'commentViewModel.commentViewModel.commentId'));
      const key =
        getObjectByPath(data, 'commentViewModel.commentViewModel.commentKey') ||
        getObjectByPath(data, 'commentKey');
      push(key);
      if (typeof key === 'string' && key.indexOf('comment_entity_') === 0) {
        push(key.slice('comment_entity_'.length));
      }
    }
    try {
      if (el && typeof el.getAttribute === 'function') {
        push(el.getAttribute('comment-id'));
        push(el.getAttribute('data-comment-id'));
      }
    } catch (e) {}
    return ids;
  }

  // Full identity resolution for one comment element: component data
  // first, the filter-time map second, the rendered author link last.
  function resolveCommentChannel(el) {
    const data = commentElementData(el);
    const fromData = resolveCommentChannelFromData(data);
    if (fromData.id) return fromData;
    const ids = commentLookupIds(el, data);
    for (let i = 0; i < ids.length; i += 1) {
      const hit = commentAuthorById[ids[i]];
      if (hit && hit.id) {
        return { id: hit.id, text: hit.text || fromData.text || hit.id, commentId: ids[i] };
      }
    }
    const fromLink = commentChannelFromLink(el);
    if (fromLink.id) {
      if (!fromLink.text && fromData.text) fromLink.text = fromData.text;
      return fromLink;
    }
    return fromData;
  }

  // The thread root owning a comment node: blocking removes the whole
  // thread (replies with it), mirroring removeParentHelper's
  // YTD-COMMENT-THREAD-RENDERER branch.
  function commentThreadRoot(el) {
    if (!el) return null;
    try {
      if (typeof el.closest === 'function') {
        const thread = el.closest('ytd-comment-thread-renderer');
        if (thread) return thread;
      }
    } catch (e) {}
    return el;
  }

  // Drop the thread owning a comment node, leaving a placeholder note in
  // its place (mirrors blocked videos keeping a "Blocked" card instead of
  // vanishing). Falls back to plain removal when the placeholder cannot
  // be built.
  function placeholderCommentThread(commentEl, message) {
    const root = commentThreadRoot(commentEl);
    if (!root) return;
    try {
      while (root.firstChild) root.removeChild(root.firstChild);
      const note = document.createElement('div');
      note.textContent = message;
      const style = note.style;
      style.padding = '12px 16px';
      style.fontSize = '14px';
      style.fontFamily = 'Roboto, Arial, sans-serif';
      style.opacity = '0.7';
      root.appendChild(note);
    } catch (e) {
      try {
        if (typeof root.remove === 'function') root.remove();
      } catch (ignored) {}
    }
  }

  // The comment whose `...` was last pressed, with a timestamp. Opened
  // popups are matched to it by freshness (see the TTL below) and by
  // on-screen proximity to the anchor.
  let lastCommentMenuAnchor = null;
  const COMMENT_MENU_ANCHOR_TTL_MS = 5000;

  // One tap's block routing: the menu entry type plus the resolved
  // channel. A null channel toasts instead of posting — the content
  // script drops id-less blocks, so posting would be a silent no-op.
  function commentMenuTapTarget(anchorEl, type) {
    const channel = resolveCommentChannel(anchorEl);
    if (!channel.id) return { anchorEl, channel: null, type };
    return { anchorEl, channel, type };
  }

  // Forward one comment tap to the background. The `via` flag makes the
  // content script annotate it as a comment-menu block with a clean
  // (@-stripped) name — the comment text itself is never stored.
  function postCommentBlock(channel, type) {
    const name = channel.text || channel.id;
    postMessage(BLOCKTUBE_CONSTS.MESSAGES.CONTEXT_BLOCK_DATA, {
      type,
      info: { id: channel.id, text: name, via: 'comment' },
    });
  }

  // Tap handler for one injected menu entry. The comment is resolved
  // against the freshest `...` anchor at tap time (falling back to the
  // injection-time one): YouTube reuses popup containers and entries
  // across openings, so a captured anchor would block the previous
  // comment again. The thread stays in place with a placeholder note
  // (like blocked videos keep a "Blocked" card): allow taps keep the
  // comment itself, blocks and removals replace it.
  function handleCommentMenuTap(event, anchorEl, type) {
    try {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
    } catch (e) {}
    if (storageData === undefined) return;
    if (window.blockTubeReloadRequired) {
      window.blockTubeExports.openToast(
        'BlockTube was updated, this tab needs to be reloaded to use this function',
        5000,
      );
      return;
    }
    const liveAnchor = freshCommentMenuAnchor() || anchorEl;
    // Text blocks need no channel identity — only the comment itself, so
    // they branch off before channel resolution.
    if (type === 'comment') {
      openCommentTextDialog(liveAnchor);
      return;
    }
    finishCommentMenuTap(liveAnchor, type);
  }

  // Resolve, post and placeholder one channel/allow tap.
  function finishCommentMenuTap(anchorEl, type) {
    const target = commentMenuTapTarget(anchorEl, type);
    if (!target.channel) {
      window.blockTubeExports.openToast(
        'BlockTube could not resolve this commenter (try blocking by name from Options)',
        4000,
      );
      return;
    }
    postCommentBlock(target.channel, target.type);
    if (target.type === 'whitelist') return;
    placeholderCommentThread(target.anchorEl, commentPlaceholderMessage(target.type));
  }

  // Placeholder note per tap type.
  function commentPlaceholderMessage(type) {
    if (type === 'unwhitelist') return 'Removed from whitelist';
    if (type === 'comment') return 'Blocked comment (text blocked)';
    return 'Blocked comment (channel blocked)';
  }

  // Full comment text for the editor popup: entity-payload content first,
  // rendered text second. Whitespace-collapsed and capped well above the
  // 200-char rule budget, so trimming happens in the editor, not here.
  function commentFullText(el) {
    let text;
    try {
      const data = commentElementData(el);
      text = getFlattenByPath(data, ['properties.content.content', 'contentText']);
      if (typeof text !== 'string' && el && typeof el.querySelector === 'function') {
        const node = el.querySelector('#content-text');
        if (node && typeof node.textContent === 'string') text = node.textContent;
      }
    } catch (e) {}
    if (typeof text !== 'string') return '';
    return text.replace(/\s+/g, ' ').trim().slice(0, 500);
  }

  // Collapse editor input exactly like the background sanitizer does
  // (background.js sanitizeCommentEntry), so what the popup posts is what
  // gets stored.
  function collapseCommentText(text) {
    const raw = text === null || text === undefined ? '' : text;
    return String(raw).replace(/\s+/g, ' ').trim().slice(0, 200);
  }

  // Validate one collapsed editor entry. Null when valid, otherwise the
  // error to show. Mirrors the options page: a plain line is a keyword,
  // only a /pattern/flags shape is compiled as regex (and an invalid one
  // blocks saving here instead of lingering in the list).
  function validateCommentEntry(clean) {
    if (clean.length === 0) return 'Enter some text to block.';
    if (clean.startsWith('//')) return 'Entries starting with // are annotations, not rules.';
    const parts = /^\/(.*)\/(.*)$/.exec(clean);
    if (parts === null) return null;
    try {
      RegExp(parts[1], parts[2].replace('g', ''));
    } catch (e) {
      return 'Invalid regular expression.';
    }
    return null;
  }

  // Tap handler factory for one injected menu entry.
  function onCommentMenuTap(anchorEl, type) {
    return (event) => handleCommentMenuTap(event, anchorEl, type);
  }

  // Unicode word-boundary class, mirrored from background.js compileRegex:
  // plain keywords only match beside these separators (or string ends).
  const COMMENT_KEYWORD_BOUNDARY = '[ \n\r\t!@#$%^&*()_\\-=+\\[\\]\\\\\\|;:\'",\\.\\/<>\\?`~:]+';

  // Escape one plain keyword exactly like background.js compileRegex.
  function escapeCommentKeyword(keyword) {
    return keyword.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
  }

  // Compile one collapsed editor entry to a live RegExp, mirroring
  // background.js compileRegex for the comment list: /pattern/flags is raw
  // regex, anything else a boundary-wrapped case-insensitive keyword.
  // Undefined when the entry cannot compile — never throws.
  function compileCommentRuleLive(clean) {
    const text = typeof clean === 'string' ? clean : '';
    if (text.length === 0 || text.startsWith('//')) return undefined;
    const parts = /^\/(.*)\/(.*)$/.exec(text);
    const pair =
      parts !== null
        ? [parts[1], parts[2]]
        : [
            `(^|${COMMENT_KEYWORD_BOUNDARY})(${escapeCommentKeyword(text)})(${COMMENT_KEYWORD_BOUNDARY}|$)`,
            'i',
          ];
    try {
      return compileOneRegExp(pair);
    } catch (e) {
      return undefined;
    }
  }

  // Style one dialog node through CSSOM only (no <style>, no innerHTML),
  // so page CSP and Trusted Types stay out of the way.
  function styleDialogNode(node, styles) {
    try {
      const keys = Object.keys(styles);
      for (let i = 0; i < keys.length; i += 1) node.style[keys[i]] = styles[keys[i]];
    } catch (e) {}
    return node;
  }

  // One labeled row for the editor dialog: a div carrying text, or a
  // button/textarea/checkbox built by the caller. Keeps the builder below
  // readable without a generic element factory.
  function dialogText(text, styles) {
    const node = document.createElement('div');
    node.textContent = text;
    return styleDialogNode(node, styles || {});
  }

  // The currently open editor dialog, if any. Opening a new one closes
  // the old first, so dialogs can never stack or strand an older Save.
  let openCommentTextBack = null;

  // Close and drop the editor dialog.
  function closeCommentTextDialog(back) {
    try {
      if (back && typeof back.remove === 'function') back.remove();
    } catch (e) {}
    if (openCommentTextBack === back) openCommentTextBack = null;
  }

  // Save one validated editor entry: post it as a comment rule, replace
  // the thread with a placeholder, live-block every other visible match
  // (no reload), and close. No toast — the placeholders are the
  // confirmation.
  function saveCommentTextDialog(back, anchorEl, clean) {
    postMessage(BLOCKTUBE_CONSTS.MESSAGES.CONTEXT_BLOCK_DATA, {
      type: 'comment',
      info: { id: clean, text: clean, via: 'comment' },
    });
    placeholderCommentThread(anchorEl, commentPlaceholderMessage('comment'));
    applyCommentRuleLive(clean);
    closeCommentTextDialog(back);
  }

  // Comment-level nodes for the live sweep: top-level and reply renderers
  // in both the legacy and the new view-model UI.
  const LIVE_COMMENT_SELECTORS = 'ytd-comment-renderer, ytd-comment-view-model';

  // Placeholder one rendered comment when the live rule matches its text.
  // Detached nodes (an already-placeholdered thread) are skipped.
  function liveBlockCommentNode(node, rule) {
    try {
      if (!node || node.nodeType !== 1 || node.isConnected === false) return false;
      const text = commentFullText(node);
      if (text.length === 0 || !testFilterEntry(rule, text)) return false;
    } catch (e) {
      return false;
    }
    placeholderCommentThread(node, commentPlaceholderMessage('comment'));
    return true;
  }

  // Apply one freshly saved comment rule to the comments already on the
  // page — no reload. The tapped thread is gone by now (placeholdered
  // above); every other visible match goes the same way. Returns the
  // blocked count.
  function applyCommentRuleLive(clean) {
    const rule = compileCommentRuleLive(clean);
    if (!rule || typeof document === 'undefined' || !document.querySelectorAll) return 0;
    let nodes = null;
    try {
      nodes = document.querySelectorAll(LIVE_COMMENT_SELECTORS);
    } catch (e) {
      return 0;
    }
    let blocked = 0;
    for (let i = 0; i < nodes.length; i += 1) {
      if (liveBlockCommentNode(nodes[i], rule)) blocked += 1;
    }
    return blocked;
  }

  // Revalidate the editor against the current field state. Returns the
  // collapsed entry (valid or not) for the save handler.
  function revalidateCommentTextDialog(field, error, save) {
    const clean = collapseCommentText(field.value);
    const problem = validateCommentEntry(clean);
    try {
      error.textContent = problem === null ? '' : problem;
      save.disabled = problem !== null;
      save.style.opacity = problem === null ? '1' : '0.5';
      save.style.cursor = problem === null ? 'pointer' : 'not-allowed';
    } catch (e) {}
    return clean;
  }

  // BlockTube options-page look, through CSSOM only (no <style>, no
  // innerHTML): dark panel, bordered field and buttons (style.css theme).
  const COMMENT_DIALOG_FONT = '"Overpass", "Open Sans", Helvetica, Arial, sans-serif';

  // Panel for the editor dialog: BlockTube options-page look, through
  // CSSOM only. Flex column so the field grows into extra space; the
  // resize handle lives on the panel itself (width and height together).
  function commentDialogPanel() {
    return styleDialogNode(document.createElement('div'), {
      backgroundColor: '#161b22',
      color: '#ffffff',
      fontFamily: COMMENT_DIALOG_FONT,
      fontSize: '14px',
      padding: '16px',
      borderRadius: '8px',
      border: '1px solid #30363d',
      width: 'min(680px, 94vw)',
      maxWidth: '94vw',
      maxHeight: '90vh',
      minWidth: '320px',
      minHeight: '280px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      resize: 'both',
      overflow: 'auto',
    });
  }

  // Backdrop + panel shell for the editor dialog.
  function commentDialogShell() {
    const back = styleDialogNode(document.createElement('div'), {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      zIndex: '2147483647',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });
    back.setAttribute('role', 'dialog');
    back.setAttribute('aria-label', 'BlockTube: block comment text');
    const panel = commentDialogPanel();
    back.appendChild(panel);
    return { back, panel };
  }

  // Title + hint header of the editor dialog. Returns the title node:
  // it doubles as the drag handle for moving the popup.
  function commentDialogHeader(panel) {
    const title = dialogText('Block comment text', {
      fontWeight: '600',
      textTransform: 'uppercase',
      marginBottom: '8px',
      cursor: 'move',
      userSelect: 'none',
    });
    panel.appendChild(title);
    panel.appendChild(
      dialogText(
        'Trim to the words you want blocked, exactly like the Comment content list on the options page: plain text is a case-insensitive keyword, /pattern/flags is raw regex.',
        {
          opacity: '0.7',
          marginBottom: '8px',
          fontSize: '12px',
        },
      ),
    );
    return title;
  }

  // Editable field of the editor dialog, prefilled with the comment.
  // Focus highlights the border (GitHub-dark accent); blur restores it.
  // Sizing follows the panel (which carries the resize handle): the field
  // grows into extra panel space instead of having its own handle.
  function commentDialogField(panel, initial) {
    const field = document.createElement('textarea');
    field.value = initial;
    field.rows = 8;
    styleDialogNode(field, {
      width: '100%',
      boxSizing: 'border-box',
      flex: '1 1 auto',
      minHeight: '80px',
      fontSize: '14px',
      fontFamily: COMMENT_DIALOG_FONT,
      color: '#ffffff',
      backgroundColor: '#0f0f0f',
      border: '1px solid #30363d',
      padding: '8px',
      borderRadius: '8px',
      resize: 'none',
      outline: 'none',
    });
    try {
      field.addEventListener('focus', () => {
        field.style.borderColor = '#1f6feb';
      });
      field.addEventListener('blur', () => {
        field.style.borderColor = '#30363d';
      });
    } catch (e) {}
    panel.appendChild(field);
    return field;
  }

  // Shared BlockTube-styled dialog button shape (style.css theme).
  const COMMENT_DIALOG_BUTTON = {
    fontFamily: COMMENT_DIALOG_FONT,
    fontWeight: '600',
    fontSize: 'small',
    color: '#ffffff',
    backgroundColor: '#21262d',
    paddingBlock: '.5em',
    paddingInline: '1em',
    borderRadius: '.3em',
    border: '1.5px solid transparent',
    cursor: 'pointer',
  };

  // One BlockTube-styled dialog button, with a hover lift while enabled.
  function commentDialogButton(label, extraStyles) {
    const button = document.createElement('button');
    button.textContent = label;
    styleDialogNode(button, { ...COMMENT_DIALOG_BUTTON, ...(extraStyles || {}) });
    try {
      button.addEventListener('mouseenter', () => {
        if (!button.disabled) button.style.backgroundColor = '#30363d';
      });
      button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = COMMENT_DIALOG_BUTTON.backgroundColor;
      });
    } catch (e) {}
    return button;
  }

  // Clamp one dragged panel position so the popup always stays
  // grabbable: at least 80px of width visible, top edge never above the
  // viewport top.
  function clampDialogPos(left, top, boxW) {
    const vw = window.innerWidth || 800;
    return {
      left: Math.min(Math.max(left, 80 - boxW), vw - 80),
      top: Math.max(0, top),
    };
  }

  // Track one active drag until mouse release, clamped to the viewport.
  function trackCommentDialogDrag(panel, origin) {
    const onMove = (move) => {
      try {
        const pos = clampDialogPos(
          origin.l + move.clientX - origin.x,
          origin.t + move.clientY - origin.y,
          origin.w,
        );
        panel.style.left = `${pos.left}px`;
        panel.style.top = `${pos.top}px`;
      } catch (e) {}
    };
    const onUp = () => {
      try {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      } catch (e) {}
    };
    try {
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    } catch (e) {}
  }

  // Begin one title-bar drag: lift the panel out of the centering flow at
  // its current spot and track the pointer until release. Primary button
  // only, so right/middle clicks still pass through to the page.
  function startCommentDialogDrag(panel, event) {
    if (!event || (event.button !== undefined && event.button !== 0)) return;
    let origin = null;
    try {
      const box = panel.getBoundingClientRect();
      origin = { x: event.clientX, y: event.clientY, l: box.left, t: box.top, w: box.width };
      panel.style.position = 'absolute';
      panel.style.margin = '0';
      panel.style.left = `${box.left}px`;
      panel.style.top = `${box.top}px`;
      event.preventDefault();
    } catch (e) {
      return;
    }
    trackCommentDialogDrag(panel, origin);
  }

  // Movable popup: press-drag the title bar to move the panel, release to
  // drop it. Mouse-only: the DOM comment menus this dialog hangs off are
  // desktop-only by construction.
  function makeCommentDialogMovable(panel, handle) {
    try {
      handle.addEventListener('mousedown', (event) => startCommentDialogDrag(panel, event));
    } catch (e) {}
  }

  // Error line + Cancel/Save row of the editor dialog.
  function commentDialogFooter(panel) {
    const error = dialogText('', { color: '#EF4F43', fontSize: '12px', minHeight: '18px' });
    panel.appendChild(error);
    const buttons = styleDialogNode(document.createElement('div'), {
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: '8px',
    });
    const cancel = commentDialogButton('Cancel');
    const save = commentDialogButton('Save block', { marginLeft: '8px' });
    buttons.appendChild(cancel);
    buttons.appendChild(save);
    panel.appendChild(buttons);
    return { error, cancel, save };
  }

  // Keyboard flow for the editor: Escape closes, Ctrl/Cmd+Enter saves.
  function onCommentDialogKey(event, ctx) {
    try {
      if (event) event.stopPropagation();
    } catch (e) {}
    if (!event) return;
    if (event.key === 'Escape') ctx.close();
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) ctx.trySave();
  }

  // Wire editor events: live validation, backdrop-click/Escape close,
  // Ctrl/Cmd+Enter save, Cancel/Save buttons. Returns revalidate for the
  // initial pass. Backdrop clicks in the first blink after opening are
  // ignored, so the tap (or a fast double-tap) that opened the popup can
  // never instantly dismiss it again.
  function wireCommentTextDialog(back, field, footer, anchorEl) {
    const close = () => closeCommentTextDialog(back);
    const openedAt = Date.now();
    const revalidate = () => revalidateCommentTextDialog(field, footer.error, footer.save);
    const trySave = () => {
      const clean = revalidate();
      if (validateCommentEntry(clean) === null) {
        saveCommentTextDialog(back, anchorEl, clean);
      }
    };
    field.addEventListener('input', revalidate);
    // A text-selection drag that starts in the field and releases outside
    // fires `click` on the common ancestor (the backdrop) — that must not
    // count as click-outside. Only a press that started on the backdrop
    // itself dismisses the dialog.
    let downOnBack = false;
    back.addEventListener('mousedown', (event) => {
      downOnBack = !!event && event.target === back;
    });
    back.addEventListener('click', (event) => {
      if (event && event.target === back && downOnBack && Date.now() - openedAt > 300) close();
    });
    back.addEventListener('keydown', (event) => onCommentDialogKey(event, { close, trySave }));
    footer.cancel.addEventListener('click', close);
    footer.save.addEventListener('click', trySave);
    return revalidate;
  }

  // The editable "Block comment text" popup: prefilled with the comment and
  // saved exactly like the Comment content list on the options page, with
  // live validation mirroring the background sanitizer. Resizable (drag the
  // corner), movable (drag the title), dismissed by Save/Cancel/Escape or a
  // click outside the panel.
  function openCommentTextDialog(anchorEl) {
    const initial = commentFullText(anchorEl);
    if (initial.length === 0) {
      window.blockTubeExports.openToast('BlockTube could not read this comment’s text', 4000);
      return;
    }
    if (openCommentTextBack) closeCommentTextDialog(openCommentTextBack);
    const shell = commentDialogShell();
    const title = commentDialogHeader(shell.panel);
    const field = commentDialogField(shell.panel, initial);
    const footer = commentDialogFooter(shell.panel);
    makeCommentDialogMovable(shell.panel, title);
    const revalidate = wireCommentTextDialog(shell.back, field, footer, anchorEl);
    try {
      (document.body || document.documentElement).appendChild(shell.back);
    } catch (e) {
      return;
    }
    openCommentTextBack = shell.back;
    revalidate();
    try {
      field.focus();
    } catch (e) {}
  }

  // Entries to offer in one comment popup, honoring the General toggles
  // the JSON menus honor (see showMenuEntry). Whitelist mode offers
  // removal only — visible comments are allowlisted by definition.
  function commentMenuEntries(store) {
    if (isWhitelistMenuMode(store)) {
      return [{ label: 'Remove from Whitelist', type: 'unwhitelist' }];
    }
    const entries = [];
    if (showMenuEntry(OPT.MENU_BLOCK_CHANNEL, store)) {
      entries.push({ label: 'Block Channel', type: 'channelId' });
    }
    if (showMenuEntry(OPT.MENU_BLOCK_COMMENT, store)) {
      entries.push({ label: 'Block comment text…', type: 'comment' });
    }
    if (showMenuEntry(OPT.MENU_ALLOW_CHANNEL, store)) {
      entries.push({ label: 'Allow Channel', type: 'whitelist' });
    }
    return entries;
  }

  // Icon per entry type, matching the JSON menus (block NOT_INTERESTED,
  // allow CHECK, remove REMOVE; comment text blocks with the block icon).
  function commentMenuIcon(type) {
    if (type === 'whitelist') return 'CHECK';
    if (type === 'unwhitelist') return 'REMOVE';
    return 'NOT_INTERESTED';
  }

  // Build one BlockTube popup entry as a real navigation-item element with
  // its text/icon bound through `data` — the way YouTube renders the
  // native Report entry. (Cloning the Report node and retitling its text
  // does not render: the visible text comes from the bound model, which a
  // clone does not carry.) Icon-rendering attributes are copied from the
  // native sibling so the same block icon shows. seed.js never hooks this
  // tag, so only our own click handler runs on it.
  function buildCommentMenuEntry(template, anchorEl, label, type) {
    const item = document.createElement('ytd-menu-navigation-item-renderer');
    try {
      item.setAttribute('data-bt-comment-menu', type);
      if (template && typeof template.hasAttribute === 'function') {
        const iconAttrs = ['use-icons', 'system-icons'];
        for (let i = 0; i < iconAttrs.length; i += 1) {
          if (template.hasAttribute(iconAttrs[i])) item.setAttribute(iconAttrs[i], '');
        }
      }
    } catch (e) {}
    try {
      item.data = {
        text: { runs: [{ text: label }] },
        icon: { iconType: commentMenuIcon(type) },
        trackingParams: 'Cg==',
      };
    } catch (e) {}
    try {
      item.addEventListener('click', onCommentMenuTap(anchorEl, type));
    } catch (e) {}
    return item;
  }

  // The native entry of one popup scope to build after, if present and
  // BlockTube has not injected there yet. Matched by Report text; on
  // non-English YouTube that text differs, so a popup with exactly one
  // entry falls back to it (comment popups carry only Report, while video
  // menus carry many entries — a single-item popup is unambiguous).
  // Duplicate protection is the injected entries themselves
  // (`data-bt-comment-menu`): YouTube reuses popup containers across
  // openings, so a marker on the scope would suppress every later menu.
  function commentPopupReport(scope) {
    if (!scope) return null;
    if (typeof scope.querySelectorAll !== 'function') return null;
    let items = [];
    try {
      if (typeof scope.matches === 'function' && scope.matches('[data-bt-comment-menu]')) {
        return null;
      }
      // Comment popups render ytd-menu-navigation-item-renderer (the
      // Report entry); the other two cover video/card popups sharing the
      // same popup renderer, so a wrong-anchor popup never matches empty.
      const found = scope.querySelectorAll(
        'ytd-menu-navigation-item-renderer, ytd-menu-service-item-renderer, yt-list-item-view-model',
      );
      for (let i = 0; i < found.length; i += 1) {
        if (found[i].hasAttribute && found[i].hasAttribute('data-bt-comment-menu')) return null;
        items.push(found[i]);
      }
    } catch (e) {
      return null;
    }
    for (let i = 0; i < items.length; i += 1) {
      if (/report/i.test(items[i].textContent || '')) return items[i];
    }
    if (items.length === 1) return items[0];
    return null;
  }

  // Build the BlockTube entries right after the Report entry of one popup
  // scope. Returns the number of entries added.
  function injectCommentMenuEntries(scope, anchorEl, store) {
    const report = commentPopupReport(scope);
    if (!report || !report.parentNode) return 0;
    const entries = commentMenuEntries(
      store || (typeof storageData !== 'undefined' ? storageData : undefined),
    );
    if (entries.length === 0) return 0;
    let added = 0;
    try {
      let after = report;
      for (let i = 0; i < entries.length; i += 1) {
        const item = buildCommentMenuEntry(after, anchorEl, entries[i].label, entries[i].type);
        after.parentNode.insertBefore(item, after.nextSibling);
        after = item;
        added += 1;
      }
    } catch (e) {}
    return added;
  }

  // True when the popup visibly belongs to the anchor: popups render next
  // to their `...` button, so a Report popup far from the pressed comment
  // belongs to something else (video menus carry Report too). A popup
  // that is not laid out yet passes — the anchor TTL still guards it.
  function popupNearAnchor(popup, anchorEl) {
    try {
      const pr = popup.getBoundingClientRect();
      const ar = anchorEl.getBoundingClientRect();
      if (!pr || !ar || (pr.width === 0 && pr.height === 0)) return true;
      const dx = Math.abs(pr.left + pr.width / 2 - (ar.left + ar.width / 2));
      const dy = Math.abs(pr.top - ar.top);
      return dx < 500 && dy < 500;
    } catch (e) {
      return true;
    }
  }

  // A still-fresh anchor element, or null. Stale anchors are dropped so a
  // later unrelated popup can never inherit them.
  function freshCommentMenuAnchor() {
    if (!lastCommentMenuAnchor) return null;
    try {
      if (Date.now() - lastCommentMenuAnchor.time > COMMENT_MENU_ANCHOR_TTL_MS) {
        lastCommentMenuAnchor = null;
        return null;
      }
    } catch (e) {
      return null;
    }
    return lastCommentMenuAnchor.el;
  }

  // Scan one added node (plus its closest containers) for a comment popup
  // menu carrying a Report entry.
  function maybeInjectCommentMenu(node) {
    if (!node || node.nodeType !== 1) return 0;
    const anchorEl = freshCommentMenuAnchor();
    if (!anchorEl) return 0;
    if (!popupNearAnchor(node, anchorEl)) return 0;
    const scopes = [node];
    try {
      let parent = node.parentNode;
      for (let depth = 0; depth < 3 && parent && parent.nodeType === 1; depth += 1) {
        scopes.push(parent);
        parent = parent.parentNode;
      }
    } catch (e) {}
    let injected = 0;
    for (let i = 0; i < scopes.length; i += 1) {
      try {
        injected += injectCommentMenuEntries(scopes[i], anchorEl);
        if (injected > 0) break;
      } catch (e) {}
    }
    return injected;
  }

  // Event-path-aware comment lookup for a `...` press. `...` buttons live
  // behind shadow roots, so e.target is retargeted to the host — but
  // composedPath() still carries the inner button (with its aria-label)
  // and the comment host. The path runs inside-out, so the menu button
  // must appear before the comment ancestor.
  function commentFromEventPath(path) {
    let sawMenuButton = false;
    for (let i = 0; i < path.length; i += 1) {
      const node = path[i];
      if (!node || typeof node.getAttribute !== 'function') continue;
      if (!sawMenuButton) {
        const label = node.getAttribute('aria-label') || '';
        if (/more|action|menu/i.test(label)) sawMenuButton = true;
      }
      const tag = node.tagName || '';
      if (
        tag === 'YTD-COMMENT-THREAD-RENDERER' ||
        tag === 'YTD-COMMENT-VIEW-MODEL' ||
        tag === 'YTD-COMMENT-RENDERER'
      ) {
        return sawMenuButton ? node : null;
      }
    }
    return null;
  }

  // True when a press path runs through a menu/`...` button (same
  // match as commentFromEventPath above).
  function pathHasMenuButton(path) {
    for (let i = 0; i < path.length; i += 1) {
      const node = path[i];
      if (!node || typeof node.getAttribute !== 'function') continue;
      if (/more|action|menu/i.test(node.getAttribute('aria-label') || '')) return true;
    }
    return false;
  }

  // Capture-phase click tracker: remembers which comment's `...` opened
  // the popup that is about to appear. A `...` press outside any comment
  // (video menus, etc.) drops the anchor instead, so a stale comment can
  // never inherit that popup — video menus sit close enough to the
  // comments that proximity alone cannot tell them apart.
  function trackCommentMenuAnchor(event) {
    try {
      const path =
        event && typeof event.composedPath === 'function'
          ? event.composedPath()
          : [event && event.target];
      if (!path || path.length === 0) return;
      const comment = commentFromEventPath(path);
      if (comment) {
        lastCommentMenuAnchor = { el: comment, time: Date.now() };
      } else if (pathHasMenuButton(path)) {
        lastCommentMenuAnchor = null;
      }
    } catch (e) {}
  }

  // Watch for popup menus as comment threads stream in (continuations,
  // replies, sort changes all render late). Started once from hooks.js
  // after the first real storage payload so labels match the mode. The
  // desktop popup selectors never match mobile, so this is a no-op there
  // by construction.
  let commentObserverStarted = false;

  function startCommentObserver() {
    if (commentObserverStarted) return;
    commentObserverStarted = true;
    if (typeof document === 'undefined' || !document.documentElement) return;
    try {
      document.addEventListener('click', trackCommentMenuAnchor, true);
    } catch (e) {}
    if (typeof MutationObserver !== 'function') return;
    const observer = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i += 1) {
        const added = mutations[i] && mutations[i].addedNodes;
        if (!added || added.length === 0) continue;
        for (let j = 0; j < added.length; j += 1) {
          try {
            maybeInjectCommentMenu(added[j]);
          } catch (e) {}
        }
      }
    });
    try {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
  }

  // ================== src/scripts/inject/hooks.js ==================

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
            v.PLAYER_VARS.raw_player_response = JSON.parse(v.PLAYER_VARS.embedded_player_response);
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
    // A landing WITH one is a known-blocked short whose player response may
    // have come from cache with nothing triggering the player-response path:
    // arm its auto-advance sweep here, on screen (prefetches never arm, so
    // this is the only sweep a cached landing gets).
    try {
      if (typeof removeShortsOverlay === 'function') removeShortsOverlay();
    } catch (e) {}
    try {
      if (typeof shortsOverlayLandingReveal === 'function') shortsOverlayLandingReveal();
    } catch (e) {}
    try {
      if (typeof shortsOverlayPaintCurrent === 'function') shortsOverlayPaintCurrent();
    } catch (e) {}
    try {
      if (
        typeof shortsOverlayHasPaintTarget === 'function' &&
        typeof skipBlockedShort === 'function' &&
        typeof currentShortsId === 'function' &&
        shortsOverlayHasPaintTarget()
      ) {
        const landedId = currentShortsId();
        if (typeof landedId === 'string') skipBlockedShort(landedId);
      }
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
    startCommentObserver:
      typeof startCommentObserver === 'function' ? startCommentObserver : undefined,
    resolveCommentChannel:
      typeof resolveCommentChannel === 'function' ? resolveCommentChannel : undefined,
    rememberCommentAuthor:
      typeof rememberCommentAuthor === 'function' ? rememberCommentAuthor : undefined,
    commentMenuEntries: typeof commentMenuEntries === 'function' ? commentMenuEntries : undefined,
    collapseCommentText:
      typeof collapseCommentText === 'function' ? collapseCommentText : undefined,
    validateCommentEntry:
      typeof validateCommentEntry === 'function' ? validateCommentEntry : undefined,
    compileCommentRuleLive:
      typeof compileCommentRuleLive === 'function' ? compileCommentRuleLive : undefined,
  };
})();
