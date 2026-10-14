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
      STORAGE_KEY: 'storageData',
      ENABLED_KEY: 'enabled',

      FROM_PAGE: 'blockTubePage', // page -> content: postMessage from the inject bundle
      FROM_CONTENT: 'blockTubeContent', // content -> page: sendStorage / sendReload
      STORAGE: 'storageData', // content -> page: compiled storage snapshot
      RELOAD: 'reloadRequired', // bg->content (port) or content->page: extension updated, hard-reload
      FILTERS: 'filtersData', // bg -> content (port): {storage, compiledStorage, enabled}
      CONTEXT_BLOCK_DATA: 'contextBlockData', // page -> content: block from context menu
      CONTEXT_BLOCK: 'contextBlock', // content -> bg (port): {type, entries}
      READY: 'ready', // page -> content: hooks booted, re-send storage
    }),
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
    BLOCK_TYPES: Object.freeze({
      CHANNEL: 'channelId',
      VIDEO: 'videoId',
      ALLOW: 'whitelist',
      UNALLOW: 'unwhitelist',
      COMMENT: 'comment',
    }),
  });

  const CONTEXT_BLOCK_TYPES = Object.freeze([
    BLOCKTUBE_CONSTS.BLOCK_TYPES.CHANNEL,
    BLOCKTUBE_CONSTS.BLOCK_TYPES.VIDEO,
    BLOCKTUBE_CONSTS.BLOCK_TYPES.ALLOW,
    BLOCKTUBE_CONSTS.BLOCK_TYPES.UNALLOW,
    BLOCKTUBE_CONSTS.BLOCK_TYPES.COMMENT,
  ]);

  globalThis.BLOCKTUBE_CONSTS = BLOCKTUBE_CONSTS;
  globalThis.CONTEXT_BLOCK_TYPES = CONTEXT_BLOCK_TYPES;

  // ================== src/scripts/inject/rules.js ==================

  const OPT = BLOCKTUBE_CONSTS.OPTIONS;
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
    'reelPlayerOverlayRenderer',
    'topbar',
    'reelItemWatchResponse',
    'videoCardRenderer',
    'endScreenVideoRenderer',
    'endScreenPlaylistRenderer',
    'reelItemRenderer',
    'slimVideoMetadataSectionRenderer',
    'videoWithContextRenderer',
  ];
  const contextMenuObjectsSet = new Set(contextMenuObjects);

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

  const regexProps = ['videoId', 'channelId', 'channelName', 'title', 'comment'];
  const regexPropsSet = new Set(regexProps);

  // !! Filter Rules definitions
  const paths = (properties, customFunc = undefined, related = undefined) => ({
    properties,
    customFunc,
    related,
  });

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

  const lockupAvatarMedia = 'metadata.lockupMetadataViewModel.image';
  const lockupMetadataContent =
    'metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows';

  const LOCKUP_BADGE_ICON_PATH =
    'contentImage.collectionThumbnailViewModel.primaryThumbnail.thumbnailViewModel.overlays.thumbnailOverlayBadgeViewModel.thumbnailBadges.thumbnailBadgeViewModel.icon.sources.clientResource.imageName';
  const LOCKUP_GENERATED_BADGE_ICONS = new Set(['MIX', 'COURSE']);

  const filterRules = {
    main: {
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

      postRenderer: paths({
        channelId: 'authorEndpoint.browseEndpoint.browseId',
        channelName: ['authorText'],
      }),
      backstagePostRenderer: paths({
        channelId: 'authorEndpoint.browseEndpoint.browseId',
        channelName: ['authorText'],
      }),

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

      channelRenderer: paths({ ...baseRules, title: undefined }, undefined, 'shelfRenderer'),

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

      channelMetadataRenderer: paths(
        {
          channelId: 'externalId',
          channelName: 'title',
        },
        redirectToIndex,
      ),

      gridChannelRenderer: paths({
        channelId: 'channelId',
        channelName: 'title',
      }),

      miniChannelRenderer: paths({
        channelId: 'channelId',
        channelName: 'title',
      }),

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

      chipCloudChipRenderer: paths({
        channelId: 'icon.iconType',
      }),

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

      gridShelfViewModel: paths({}),

      richSectionRenderer: paths({}),

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
      guideEntryRenderer: paths({
        channelId: ['navigationEndpoint.browseEndpoint.browseId', 'icon.iconType'],
        channelName: ['title', 'formattedTitle'],
      }),
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
      liveChatMembershipItemRenderer: paths({
        channelId: 'authorExternalChannelId',
        channelName: ['authorName'],
        comment: 'headerSubtext',
      }),
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

  function collectIndexStep(arr, idx) {
    const collected = [];
    for (let a = 0; a < arr.length; a += 1) {
      const av = arr[a];
      if (Array.isArray(av) && idx >= 0 && idx < av.length) collected.push(av[idx]);
    }
    return collected;
  }

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

  function getAllByPath(obj, path) {
    const compiled = compiledPath(path);
    let values = [obj];
    for (let i = 0; i < compiled.length; i += 1) {
      values = stepPathValues(values, compiled[i]);
      if (values.length === 0) return values;
    }
    return values;
  }

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
  const LOCKUP_COLLAB_LIST_ITEMS_PATH =
    'metadata.lockupMetadataViewModel.image.avatarStackViewModel.rendererContext.commandContext.onTap.innertubeCommand.showDialogCommand.panelLoadingStrategy.inlineContent.dialogViewModel.customContent.listViewModel.listItems';

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

  const PATH_MISS = {};

  function readPlainKey(node, key) {
    if (node instanceof Array) {
      const found = node.find((o) => o !== null && o !== undefined && has.call(o, key));
      if (found === undefined) return PATH_MISS;
      return found[key];
    }
    if (!node || !has.call(node, key)) return PATH_MISS;
    return node[key];
  }

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
  const SHORTS_ID_RE = /^\/shorts\/([A-Za-z0-9_-]{11})/;

  function currentShortsId() {
    try {
      const match = document.location.pathname.match(SHORTS_ID_RE);
      return match ? match[1] : undefined;
    } catch (e) {
      return undefined;
    }
  }

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

  function channelTextOf(text) {
    if (!text || typeof text !== 'object') return undefined;
    if (typeof text.content === 'string' && text.content.length > 0) return text.content;
    const runs = flattenRuns(text);
    if (typeof runs === 'string' && runs.length > 0) return runs;
    return undefined;
  }

  function partHasChannelLink(part) {
    const linkId = getObjectByPath(part, PART_LINK_PATH);
    return typeof linkId === 'string' && BROWSE_ID_RE.test(linkId);
  }

  function isBarePart(part) {
    return part.accessibilityLabel === undefined && part.leadingIcon === undefined;
  }

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

  function lockupLinkedChannelName(rows) {
    return findPartName(rows, partHasChannelLink);
  }

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

  function lockupBareChannelName(rows) {
    if (rows.length < 2) return undefined;
    return findPartName(rows, isBarePart);
  }

  function lockupTitleChannelName(renderer) {
    const contentType = getObjectByPath(renderer, 'contentType');
    if (typeof contentType !== 'string' || !contentType.includes('CHANNEL')) return undefined;
    const title = getObjectByPath(renderer, LOCKUP_TITLE_PATH);
    if (typeof title === 'string') return title.length > 0 ? title : undefined;
    return channelTextOf(title);
  }

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

  function parseViewCount(s) {
    if (typeof s !== 'string') return undefined;

    const clean = s
      .replace(/\u00a0/g, ' ')
      .trim()
      .toLowerCase();
    if (clean === '') return undefined;

    if (/^no\s+views?$/.test(clean)) {
      return 0;
    }

    const match = clean.match(/^([\d,.]+)\s*(thousand|million|billion|[kmb])?(?:\s+views?)?$/);
    if (!match) return undefined;

    const numStr = match[1];
    const multiplierStr = match[2];

    if ((numStr.match(/\./g) || []).length > 1) return undefined;

    const num = parseFloat(numStr.replace(/,/g, ''));
    if (Number.isNaN(num)) return undefined;

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
    rememberPageChannel(object);
    this.filterRules = ruleConfig;
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

  let noActiveFilters = false;

  function computeNoActiveFilters() {
    if (storageData.options[OPT.WHITELIST_MODE]) return false;
    if (
      storageData.options[OPT.SHORTS] ||
      storageData.options[OPT.MOVIES] ||
      storageData.options[OPT.MIXES] ||
      storageData.options[OPT.CHIPS_SHELVES]
    )
      return false;
    if (!isNaN(storageData.options[OPT.PERCENT_WATCHED_HIDE])) return false;

    const vidLength = storageData.filterData.vidLength;
    if (Array.isArray(vidLength) && (!isNaN(vidLength[0]) || !isNaN(vidLength[1]))) return false;

    for (let idx = 0; idx < regexProps.length; idx += 1) {
      const arr = storageData.filterData[regexProps[idx]];
      if (Array.isArray(arr) && arr.length > 0) return false;
    }

    return !jsFilterEnabled;
  }

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

  function testFilterEntry(entry, value) {
    if (!entry) return false;
    entry.lastIndex = 0;
    return entry.test(value);
  }

  function entriesMatchAnyValue(entries, values) {
    if (!Array.isArray(entries)) return false;
    return entries.some((entry) => entry && values.some((v) => testFilterEntry(entry, v)));
  }

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

  function findMatchingEntry(filterEntries, candidate) {
    if (!Array.isArray(filterEntries)) return undefined;
    for (let i = 0; i < filterEntries.length; i += 1) {
      const entry = filterEntries[i];
      if (entry && testFilterEntry(entry, candidate)) return entry;
    }
    return undefined;
  }

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

  function isCollabChannelAllowlisted(obj) {
    const allowlist = storageData.filterData.whitelist || [];
    if (allowlist.length === 0) return false;
    const collabIds = getCollaboratorChannelIds(obj);
    return collabIds.some((id) => allowlist.some((entry) => entry && testFilterEntry(entry, id)));
  }

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

  function matchFieldWhitelist(fieldName, value, obj, rendererKey, allValues) {
    if (fieldName !== 'channelId') return { match: null, value };
    const allowlist = storageData.filterData.whitelist || [];
    const candidates = allValues && allValues.length > 0 ? allValues : [value];
    if (entriesMatchAnyValue(allowlist, candidates)) return { match: null, value };
    if (rendererKey === 'lockupViewModel' && isCollabChannelAllowlisted(obj)) {
      return { match: null, value };
    }
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) {
      return { match: null, value };
    }
    return {
      match: { name: fieldName, value, filter: '(not allowlisted)' },
      value,
    };
  }

  function matchFieldRegex(fieldName, value, filterEntries, allValues) {
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

  function matchFieldDuration(fieldName, value, filterEntries) {
    const vidLen = parseTime(value);
    const match = matchesDurationRange(vidLen, filterEntries)
      ? { name: fieldName, value: vidLen }
      : null;
    return { match, value: vidLen };
  }

  function matchField(fieldName, value, filterEntries, obj, rendererKey, allValues) {
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

  function normalizeForJsFilter(fieldName, value) {
    if (fieldName === 'viewCount') return parseViewCount(value);
    if (fieldName === 'channelBadges' || fieldName === 'badges') return extractBadgeList(value);
    return value;
  }

  const pageChannelFallbackRenderers = new Set([
    'lockupViewModel',
    'gridVideoRenderer',
    'videoRenderer',
    'compactVideoRenderer',
  ]);

  function shouldSkipField(fieldName, filterPath, filterEntries, whitelistMode) {
    if (filterPath === undefined) return true;
    if (whitelistMode && fieldName !== 'channelId') return true;
    return (
      !whitelistMode &&
      regexPropsSet.has(fieldName) &&
      (filterEntries === undefined || (filterEntries.length === 0 && !jsFilterEnabled))
    );
  }

  function resolveFieldValue(obj, filterPath, fieldName, rendererKey) {
    const value = getFlattenByPath(obj, filterPath);
    if (value !== undefined) return value;
    if (
      fieldName === 'channelId' &&
      pageChannel !== null &&
      pageChannelFallbackRenderers.has(rendererKey)
    ) {
      return pageChannel.id;
    }
    return undefined;
  }

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

  function applyJsFilter(friendlyVideoObj, rendererKey) {
    let doBlock = false;
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

  function collabCandidates(obj, filterPath, fieldName) {
    return fieldName === 'channelId' || fieldName === 'channelName'
      ? getFlattenByPathAll(obj, filterPath)
      : undefined;
  }

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

  function matchesMovie(obj, rendererKey) {
    if (rendererKey === 'movieRenderer' || rendererKey === 'compactMovieRenderer') return true;
    return (
      rendererKey === 'videoRenderer' &&
      !getObjectByPath(obj, 'shortBylineText.runs.navigationEndpoint.browseEndpoint') &&
      obj.longBylineText &&
      obj.badges
    );
  }

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
    return hasShortsTimeOverlay(obj);
  }

  const CHIPS_SHELF_RENDERERS = new Set([
    'richShelfRenderer',
    'chipsShelfWithVideoShelfRenderer',
    'brandVideoSingletonRenderer',
    'brandVideoShelfRenderer',
    'statementBannerRenderer',
  ]);

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

  function matchesGeneratedPlaylist(obj, rendererKey) {
    if (rendererKey === 'radioRenderer' || rendererKey === 'compactRadioRenderer') return true;
    if (rendererKey !== 'lockupViewModel') return false;
    const imgName = getObjectByPath(obj, LOCKUP_BADGE_ICON_PATH);
    return imgName !== undefined && LOCKUP_GENERATED_BADGE_ICONS.has(imgName);
  }

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
        matchedFilterField = { name: 'option', filter: optionKey };
        return true;
      }
    }
    return this.isBlockedComment(filteredObject, rendererKey);
  };

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

  function collapseEmptyContainers(obj, childKey, childDel) {
    if (childDel && obj[childKey] instanceof Array && obj[childKey].length === 0) {
      return true;
    }
    if (childDel && collapseableContainersSet.has(childKey)) {
      delete obj[childKey];
      return true;
    }
    return false;
  }

  function applyMatchedRule(filterCtx, obj, rule) {
    let customRet = true;
    if (rule.customFunc !== undefined) {
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

  function matchAndDeleteRules(filterCtx, obj, keys) {
    let deletePrev = false;
    if (keys === undefined) return deletePrev;
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

  function spliceDeletedChild(obj, idx, childDel, keys) {
    if (!childDel || keys !== undefined) return;
    obj.splice(idx, 1);
    if (typeof childDel === 'string' && obj.length > 0 && obj[idx] && obj[idx][childDel]) {
      obj.splice(idx, 1);
    }
  }

  function filterChildren(filterCtx, obj, keys, len) {
    let deleted = false;
    for (let i = len - 1; i >= 0; i -= 1) {
      const idx = keys ? keys[i] : i;
      if (obj[idx] === undefined) continue;

      const childDel = filterOneChild(filterCtx, obj[idx]);
      if (childDel && keys === undefined) {
        deleted = true;
        spliceDeletedChild(obj, idx, childDel, keys);
      }

      if (collapseEmptyContainers(obj, idx, childDel)) {
        deleted = true;
      }
    }
    return deleted;
  }

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

    if (typeof obj !== 'object' || obj === null) {
      return deletePrev;
    }

    let len = 0;
    let keys;

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

  let matchedFilterField = null;

  function getMatchedFilterText() {
    if (matchedFilterField === null) return null;
    const name = matchedFilterField.name;
    const filter = matchedFilterField.filter;
    const value = matchedFilterField.value;
    if (filter !== undefined && value !== undefined) {
      const f = String(filter).slice(0, 40);
      const v = String(value).slice(0, 40);
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

  function getBlockMessage() {
    const rule = getMatchedFilterText();
    const message = storageData.options[OPT.BLOCK_MESSAGE] || 'Video blocked by BlockTube filter';
    return rule ? `${message} (${rule})` : message;
  }

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

  let shortsConsecutiveSkips = 0;
  let shortsSkipArmedFor = null;
  let shortsSkipJustFired = false;
  let shortsSkipTriggeredAt = 0;
  let shortsSkipFiredIds = new Set();
  const SHORTS_SKIP_FIRED_CAP = 100;
  const SHORTS_SKIP_CAP = 15;

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

  function skipBlockedShort(videoId) {
    if (typeof videoId !== 'string' || videoId.length === 0) return;
    try {
      if (!document.location.pathname.startsWith('/shorts/')) return;
    } catch (e) {
      return;
    }
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

  function removeYouThereMessages(playerResponse) {
    const playerMessages = getObjectByPath(playerResponse, 'messages', []);
    for (let i = playerMessages.length - 1; i >= 0; i -= 1) {
      if (has.call(playerMessages[i], 'youThereRenderer')) {
        playerMessages.splice(i, 1);
      }
    }
  }

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
      filterReelSequenceResponse(resp);
      ObjectFilter(resp, mergedFilterRules, [], true);
    } else if (url.pathname === '/youtubei/v1/guide') {
      ObjectFilter(resp, filterRules.guide, [], true);
    } else if (url.pathname === '/youtubei/v1/player') {
      playerHasBeenBlocked = false;
      ObjectFilter(resp, filterRules.ytPlayer, [playerMiscFilters]);
      maybeRevealShortsPrehide(resp);
    } else if (url.pathname === '/youtubei/v1/live_chat/get_live_chat') {
      ObjectFilter(resp, filterRules.comments, [], true);
    }
  }

  function filterSpfPlayer(obj) {
    try {
      const player_resp = getObjectByPath(obj.player, 'args.player_response');
      obj.player.args.raw_player_response = JSON.parse(player_resp);
    } catch (e) {}
    playerHasBeenBlocked = false;
    ObjectFilter(obj.player, filterRules.ytPlayer, [playerMiscFilters]);
  }

  function filterSpfPlayerResponse(obj) {
    playerHasBeenBlocked = false;
    ObjectFilter(obj.playerResponse, filterRules.ytPlayer);
  }

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
      // falls through
      default:
        rules = filterRules.main;
    }
    return { rules, postActions };
  }

  function filterSpfPayload(obj, pathname) {
    const { rules, postActions } = spfRulesFor(pathname);
    ObjectFilter(obj.response || obj.data, rules, postActions, true);
  }

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

  function isWhitelistMenuMode(store) {
    const opts = (store || storageData)?.options;
    return !!opts?.[OPT.WHITELIST_MODE];
  }

  function showMenuEntry(key, store) {
    const opts = (store || storageData)?.options;
    return opts?.[key] !== false;
  }

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

  function resolveContextMenuAttr(obj, keys) {
    if (keys === undefined) return undefined;
    for (let i = 0; i < keys.length; i += 1) {
      if (contextMenuObjectsSet.has(keys[i]) && has.call(obj, keys[i])) {
        return keys[i];
      }
    }
    return undefined;
  }

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

  const MOBILE_UP_NEXT_ATTRS = [
    'videoWithContextRenderer',
    'compactVideoRenderer',
    'movieRenderer',
    'compactMovieRenderer',
    'playlistVideoRenderer',
    'reelItemRenderer',
    'commentRenderer',
  ];

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

  function addMobileUpNextMenus(obj, attr, channelData, videoData) {
    const items = resolveMobileUpNextItems(obj, attr);
    if (!items) return;
    if (isWhitelistMenuMode()) {
      pushMobileRemovalEntry(items, attr, channelData);
      return;
    }
    pushMobileBlockEntries(items, attr, channelData, videoData);
  }

  function slimChannelButtonDefs(allowMode) {
    if (allowMode) {
      return [{ action: 'unallow_channel', label: 'Remove from Whitelist' }];
    }
    return [
      { action: 'block_channel', label: 'Block Channel', option: OPT.MENU_BLOCK_CHANNEL },
      { action: 'allow_channel', label: 'Allow Channel', option: OPT.MENU_ALLOW_CHANNEL },
    ].filter(({ option }) => option === undefined || showMenuEntry(option));
  }

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

  function buildSlimVideoButton(videoData) {
    return {
      slimMetadataButtonRenderer: {
        button: {
          buttonRenderer: buildSlimButtonRenderer(videoData, 'block_video', 'Block Video', {}),
        },
      },
    };
  }

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

  function buildMobileVideoMenu(videoButton, channelButtonsRendered, includeVideo) {
    return {
      slimVideoActionBarRenderer: {
        buttons: [...(includeVideo ? [videoButton] : []), ...channelButtonsRendered],
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

  function extractLockupMenuFlags(obj, attr) {
    const items = extractFromLockupViewModel(obj[attr]);
    if (!items) return null;
    const imgName = getObjectByPath(obj[attr], LOCKUP_BADGE_ICON_PATH);
    const isCollection = imgName !== undefined && LOCKUP_GENERATED_BADGE_ICONS.has(imgName);
    return {
      items,
      hasChannel: !isCollection,
      hasVideo: !isCollection,
      isLockupViewModel: true,
    };
  }

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

  function extractGenericMenuFlags(obj, attr) {
    return {
      items: extractFromGenericRenderer(obj[attr]),
      hasChannel: genericRendererHasChannel(obj[attr], attr),
      hasVideo: true,
      isLockupViewModel: false,
    };
  }

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
    for (let i = 0; i < fresh.length; i += 1) items.push(fresh[i]);
  }

  function injectLockupViewModelButtons(items, hasChannel, hasVideo, currentObj, store) {
    if (!items.length) return;

    const cleanChannelContext = createCleanContext(items, store, true, currentObj);
    const cleanVideoContext = createCleanContext(items, store, false, currentObj);

    const blockChannelItem = createLockupButtonItem('Block Channel', cleanChannelContext);
    const blockVideoItem = createLockupButtonItem('Block Video', cleanVideoContext);

    if (isWhitelistMenuMode(store)) {
      const removeChannelItem = createLockupButtonItem(
        'Remove from Whitelist',
        createCleanContext(items, store, true, currentObj, true, true),
        'REMOVE',
      );
      if (hasChannel) items.push(removeChannelItem);
      return;
    }

    const allowChannelItem = createLockupButtonItem(
      'Allow Channel',
      createCleanContext(items, store, true, currentObj, true),
      'CHECK',
    );
    if (hasChannel && showMenuEntry(OPT.MENU_BLOCK_CHANNEL, store)) items.push(blockChannelItem);
    if (hasVideo && showMenuEntry(OPT.MENU_BLOCK_VIDEO, store)) items.push(blockVideoItem);
    if (hasChannel && showMenuEntry(OPT.MENU_ALLOW_CHANNEL, store)) items.push(allowChannelItem);
  }

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

  function lockupToastMessage(isChannel, forAllow, forRemove, store) {
    if (!isChannel) return 'Video Blocked';
    if (forRemove) return 'Removed from whitelist';
    if (forAllow || isWhitelistMenuMode(store)) return 'Channel Allowed';
    return 'Channel Blocked';
  }

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
            hideEnclosingContainer: !forAllow || forRemove,
          },
          actions: forAllow || forRemove ? [] : [lockupToastAction(msg)],
          contentId,
        },
      };
    }
  }

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
      if (hasChannel) items.push(removeChannelItem);
      return;
    }

    if (hasChannel && showMenuEntry(OPT.MENU_BLOCK_CHANNEL, store)) items.push(blockChannelItem);
    if (hasVideo && showMenuEntry(OPT.MENU_BLOCK_VIDEO, store)) items.push(blockVideoItem);
    if (hasChannel && showMenuEntry(OPT.MENU_ALLOW_CHANNEL, store)) items.push(allowChannelItem);
  }

  function createStandardBlockItem(text, iconType = 'NOT_INTERESTED') {
    return {
      menuServiceItemRenderer: {
        text: { runs: [{ text }] },
        icon: { iconType },
      },
    };
  }

  function deepClone(obj) {
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

    if (attr === 'reelPlayerOverlayRenderer') {
      const menu = getObjectByPath(obj[attr], 'menu.menuRenderer');
      if (menu && Array.isArray(menu.items)) menu.items = menu.items.slice();
    }
    if (attr === 'reelItemWatchResponse' || attr === 'topbar') {
      const list = sheet ? getObjectByPath(sheet, 'content.listViewModel') : null;
      if (list && Array.isArray(list.listItems)) list.listItems = list.listItems.slice();
    }

    if (hasChannel || hasVideo) {
      obj[attr]._btOriginalAttr = attr;
    }
  }

  let toastTimer = 0;

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
    try {
      showDomToast(msg, duration);
    } catch (e) {}
    try {
      legacyToast(msg, duration);
    } catch (e) {}
  }

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

  function mobileActionToBlockType(menuAction) {
    switch (menuAction) {
      case 'block_channel': {
        return BLOCKTUBE_CONSTS.BLOCK_TYPES.CHANNEL;
      }
      case 'allow_channel': {
        return BLOCKTUBE_CONSTS.BLOCK_TYPES.ALLOW;
      }
      case 'unallow_channel': {
        return BLOCKTUBE_CONSTS.BLOCK_TYPES.UNALLOW;
      }
      case 'block_video': {
        return BLOCKTUBE_CONSTS.BLOCK_TYPES.VIDEO;
      }
      default:
        return undefined;
    }
  }

  function confirmSlimVideoTap(type) {
    if (type !== BLOCKTUBE_CONSTS.BLOCK_TYPES.ALLOW)
      document.getElementById('movie_player').stopVideo();
    const noun = type === BLOCKTUBE_CONSTS.BLOCK_TYPES.VIDEO ? 'Video' : 'Channel';
    const verb =
      type === BLOCKTUBE_CONSTS.BLOCK_TYPES.ALLOW
        ? 'Allowed'
        : type === BLOCKTUBE_CONSTS.BLOCK_TYPES.UNALLOW
          ? 'Removed'
          : 'Blocked';
    alert(`${noun} ${verb}`);
  }

  function filterCommentRuntime(type, data) {
    if (
      type === BLOCKTUBE_CONSTS.BLOCK_TYPES.CHANNEL &&
      data._btOriginalAttr === 'commentRenderer'
    ) {
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

  const PLAYER_MENU_TAGS = ['YTD-VIDEO-PRIMARY-INFO-RENDERER', 'YTD-WATCH-METADATA'];

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

  function stampedMenuBlockData(parentData) {
    const isWatch = parentData.blockTube?.metadata?.isWatch === true;
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

  function menuLabelToBlockTarget(menuAction, channelData, videoData) {
    switch (menuAction) {
      case 'Block Channel':
        return { type: BLOCKTUBE_CONSTS.BLOCK_TYPES.CHANNEL, data: channelData };
      case 'Allow Channel':
        return { type: BLOCKTUBE_CONSTS.BLOCK_TYPES.ALLOW, data: channelData };
      case 'Remove from Whitelist':
        return { type: BLOCKTUBE_CONSTS.BLOCK_TYPES.UNALLOW, data: channelData };
      case 'Block Video':
        return { type: BLOCKTUBE_CONSTS.BLOCK_TYPES.VIDEO, data: videoData };
      default:
        return null;
    }
  }

  function getBlockData(parentDom, parentData, isDataFromRightHandSide, menuAction) {
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

  function getRecommendedParentData(element) {
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

  function findEventSink(element) {
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

  const MENU_TAP_ACTIONS = [
    'Block Channel',
    'Block Video',
    'Allow Channel',
    'Remove from Whitelist',
  ];

  function isCardRemovingTap(type) {
    return (
      type === BLOCKTUBE_CONSTS.BLOCK_TYPES.CHANNEL ||
      type === BLOCKTUBE_CONSTS.BLOCK_TYPES.VIDEO ||
      type === BLOCKTUBE_CONSTS.BLOCK_TYPES.UNALLOW
    );
  }

  function pauseReelPlayer() {
    try {
      if (typeof document === 'undefined' || typeof document.querySelector !== 'function') {
        return;
      }
      const video = document.querySelector('video');
      if (video && typeof video.pause === 'function') video.pause();
    } catch (e) {}
  }

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

  function applyMenuTapEffect(type, removeParent, stopPlayer, isDataFromRightHandSide, parentDom) {
    if (type === BLOCKTUBE_CONSTS.BLOCK_TYPES.UNALLOW) {
      if (removeParent) {
        removeParentHelper(isDataFromRightHandSide, parentDom, 'Removed from whitelist');
      } else if (stopPlayer) {
        document.getElementById('movie_player').stopVideo();
      }
    } else if (type !== BLOCKTUBE_CONSTS.BLOCK_TYPES.ALLOW) {
      if (removeParent) {
        removeParentHelper(isDataFromRightHandSide, parentDom);
      } else if (stopPlayer) {
        document.getElementById('movie_player').stopVideo();
      }
    }
  }

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

    const { parentDom, parentData } = getParentDomAndData(isDataFromRightHandSide, this);

    const { type, data, removeParent, stopPlayer, isShorts, isWatch } = getBlockData(
      parentDom,
      parentData,
      isDataFromRightHandSide,
      menuAction,
    );

    const blockInfo = isShorts || isWatch ? { ...data, via: 'shorts' } : data;
    postMessage(BLOCKTUBE_CONSTS.MESSAGES.CONTEXT_BLOCK_DATA, { type, info: blockInfo });

    applyMenuTapEffect(type, removeParent, stopPlayer, isDataFromRightHandSide, parentDom);
    const isShortsTap = isShorts || parentData?._btOriginalAttr === 'shortsLockupViewModel';
    if (isShortsTap && isCardRemovingTap(type)) {
      if (isWatch) {
        applyWatchBlockEffect(type, data, parentData);
      } else {
        dismissShortsShelfCard(
          shortsTapVideoId(parentData, type, data),
          type === BLOCKTUBE_CONSTS.BLOCK_TYPES.UNALLOW ? 'Removed from whitelist' : 'Blocked',
        );
      }
    }
    if (!isWatch) forwardMenuTap.call(this, event);
  }

  function applyWatchBlockEffect(type, data, parentData) {
    try {
      pauseReelPlayer();
    } catch (e) {}
    if (type === BLOCKTUBE_CONSTS.BLOCK_TYPES.UNALLOW) return;
    try {
      const live = currentShortsVideo();
      const stamp = (parentData && parentData.blockTube && parentData.blockTube.metadata) || {};
      const videoId =
        (type === BLOCKTUBE_CONSTS.BLOCK_TYPES.VIDEO &&
          data &&
          typeof data.id === 'string' &&
          data.id) ||
        (typeof live.id === 'string' && live.id) ||
        (typeof stamp.videoId === 'string' && stamp.videoId) ||
        undefined;
      if (typeof videoId !== 'string' || videoId.length === 0) return;
      const channelId =
        (type !== BLOCKTUBE_CONSTS.BLOCK_TYPES.VIDEO &&
          data &&
          typeof data.id === 'string' &&
          data.id) ||
        (typeof stamp.channelId === 'string' && stamp.channelId) ||
        undefined;
      const message =
        type === BLOCKTUBE_CONSTS.BLOCK_TYPES.VIDEO ? 'Video Blocked' : 'Channel Blocked';
      try {
        showBlockedShortOverlay(
          {
            videoId,
            channelId,
            channelName:
              (type !== BLOCKTUBE_CONSTS.BLOCK_TYPES.VIDEO && data && data.text) ||
              stamp.channelName ||
              undefined,
            title:
              (type === BLOCKTUBE_CONSTS.BLOCK_TYPES.VIDEO && data && data.text) ||
              live.text ||
              stamp.videoName,
          },
          message,
        );
      } catch (e) {}
      try {
        skipBlockedShort(videoId);
      } catch (e) {}
    } catch (e) {}
  }

  function shortsTapVideoId(parentData, type, data) {
    const stamped = parentData?.blockTube?.metadata?.videoId;
    if (typeof stamped === 'string' && stamped.length > 0) return stamped;
    if (type === BLOCKTUBE_CONSTS.BLOCK_TYPES.VIDEO && data && typeof data.id === 'string')
      return data.id;
    try {
      const resolved = channelAndVideoFrom(parentData, 'shortsLockupViewModel');
      if (resolved && typeof resolved.video.id === 'string') return resolved.video.id;
    } catch (e) {}
    return undefined;
  }

  // ================== src/scripts/inject/shorts-overlay.js ==================

  let lastShortsBlock = null;
  let shortsBlockedOverlays = new Map();
  const SHORTS_BLOCKED_MAP_CAP = 100;
  let shortsOverlayEl = null;
  let shortsOverlaySyncTimer = 0;
  let shortsOverlayPendingTimer = 0;

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

  function shortsOverlayHost() {
    try {
      return shortsOverlayReelHost() || shortsOverlayPlayerHost();
    } catch (e) {
      return null;
    }
  }

  function shortsOverlayStillCurrent() {
    try {
      if (!lastShortsBlock || typeof lastShortsBlock.videoId !== 'string') return false;
      return currentShortsId() === lastShortsBlock.videoId;
    } catch (e) {
      return false;
    }
  }

  function shortsOverlayStyle(el, props) {
    try {
      const style = el.style;
      for (const key of Object.keys(props)) style[key] = props[key];
    } catch (e) {}
  }

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

  function shortsOverlayVideoNodes() {
    try {
      return shortsOverlayQueryNodes('video');
    } catch (e) {
      return [];
    }
  }

  function shortsOverlaySequenceThumbNodes() {
    try {
      return shortsOverlayQueryNodes('.reel-video-in-sequence-thumbnail');
    } catch (e) {
      return [];
    }
  }

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

  function shortsOverlayUnblankVideo() {
    const nodes = shortsOverlayVideoNodes().concat(shortsOverlaySequenceThumbNodes());
    for (let i = 0; i < nodes.length; i += 1) {
      try {
        if (nodes[i].style) nodes[i].style.opacity = '';
      } catch (e) {}
    }
  }

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

  function shortsOverlayRecordVerdict(videoId, clean) {
    try {
      if (typeof videoId === 'string' && videoId.length > 0) {
        window.__blockTubeShortsVerdict = { videoId, clean: clean === true };
      }
    } catch (e) {}
  }

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

  function shortsOverlayEnsureCovers() {
    const hosts = shortsOverlayAllHosts();
    for (let i = 0; i < hosts.length; i += 1) {
      try {
        shortsOverlayCoverHost(hosts[i]);
      } catch (e) {}
    }
  }

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

  function maybeRevealShortsPrehide(ytData) {
    try {
      if (shortsOverlayVerdictIsCleanCurrent(ytData)) {
        shortsOverlayRecordVerdict(blockedPlayerVideoId(ytData), true);
        shortsOverlayRevealPrehide();
      }
    } catch (e) {}
  }

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

  function shortsOverlayTick() {
    if (!shortsOverlayStillCurrent()) {
      removeShortsOverlay();
      return true;
    }
    if (!shortsOverlayEl) return false;
    try {
      const host = shortsOverlayHost();
      if (host && shortsOverlayEl.parentNode !== host) {
        shortsOverlayEnsureHostPositioned(host);
        host.appendChild(shortsOverlayEl);
      }
    } catch (e) {}
    return false;
  }

  function shortsOverlayClearPending() {
    try {
      if (shortsOverlayPendingTimer && typeof clearInterval === 'function') {
        clearInterval(shortsOverlayPendingTimer);
      }
    } catch (e) {}
    shortsOverlayPendingTimer = 0;
  }

  const SHORTS_REEL_GRACE_TRIES = 6;

  function shortsOverlayHasPaintTarget() {
    try {
      if (shortsOverlayStillCurrent()) return true;
      const id = currentShortsId();
      return typeof id === 'string' && shortsBlockedOverlays.has(id);
    } catch (e) {
      return false;
    }
  }

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
          shortsOverlayPaintCurrent(tries >= SHORTS_REEL_GRACE_TRIES);
          painted = shortsOverlayEl !== null;
        }
      } catch (e) {
        painted = false;
      }
      if (painted || stale || tries >= 20) shortsOverlayClearPending();
    }, 150);
  }

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
    rememberShortsBlock(attribution.videoId, message);
    if (currentShortsId() !== attribution.videoId) return;
    shortsOverlayRecordVerdict(attribution.videoId, false);
    removeShortsOverlay();
    shortsOverlayPaintCurrent();
  }

  // ================== src/scripts/inject/comment-dom.js ==================

  let commentAuthorById = {};
  let commentAuthorCount = 0;

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

  function btSampleCommentTextColor(commentEl) {
    try {
      let ref = commentEl;
      try {
        if (commentEl && typeof commentEl.querySelector === 'function') {
          ref = commentEl.querySelector('#content-text') || commentEl;
        }
      } catch (e) {}
      if (ref && typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
        const sampled = window.getComputedStyle(ref).color;
        if (typeof sampled === 'string' && sampled.length > 0) return sampled;
      }
    } catch (e) {}
    return '';
  }

  function placeholderCommentThread(commentEl, message) {
    const root = commentThreadRoot(commentEl);
    if (!root) return;
    const textColor = btSampleCommentTextColor(commentEl);
    try {
      while (root.firstChild) root.removeChild(root.firstChild);
      const note = document.createElement('div');
      note.textContent = message;
      const style = note.style;
      style.padding = '12px 16px';
      style.fontSize = '14px';
      style.fontFamily = 'Roboto, Arial, sans-serif';
      style.opacity = '0.7';
      style.color = textColor || 'var(--yt-spec-text-primary)';
      root.appendChild(note);
    } catch (e) {
      try {
        if (typeof root.remove === 'function') root.remove();
      } catch (ignored) {}
    }
  }

  let lastCommentMenuAnchor = null;
  const COMMENT_MENU_ANCHOR_TTL_MS = 5000;

  function commentMenuTapTarget(anchorEl, type) {
    const channel = resolveCommentChannel(anchorEl);
    if (!channel.id) return { anchorEl, channel: null, type };
    return { anchorEl, channel, type };
  }

  function postCommentBlock(channel, type) {
    const name = channel.text || channel.id;
    postMessage(BLOCKTUBE_CONSTS.MESSAGES.CONTEXT_BLOCK_DATA, {
      type,
      info: { id: channel.id, text: name, via: 'comment' },
    });
  }

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
    if (type === BLOCKTUBE_CONSTS.BLOCK_TYPES.COMMENT) {
      openCommentTextDialog(liveAnchor);
      return;
    }
    finishCommentMenuTap(liveAnchor, type);
  }

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
    if (target.type === BLOCKTUBE_CONSTS.BLOCK_TYPES.ALLOW) return;
    placeholderCommentThread(target.anchorEl, commentPlaceholderMessage(target.type));
  }

  function commentPlaceholderMessage(type) {
    if (type === BLOCKTUBE_CONSTS.BLOCK_TYPES.UNALLOW) return 'Removed from whitelist';
    if (type === BLOCKTUBE_CONSTS.BLOCK_TYPES.COMMENT) return 'Blocked comment (text blocked)';
    return 'Blocked comment (channel blocked)';
  }

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

  function collapseCommentText(text) {
    const raw = text === null || text === undefined ? '' : text;
    return String(raw).replace(/\s+/g, ' ').trim().slice(0, 200);
  }

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

  function onCommentMenuTap(anchorEl, type) {
    return (event) => handleCommentMenuTap(event, anchorEl, type);
  }

  const COMMENT_KEYWORD_BOUNDARY = '[ \n\r\t!@#$%^&*()_\\-=+\\[\\]\\\\\\|;:\'",\\.\\/<>\\?`~:]+';

  function escapeCommentKeyword(keyword) {
    return keyword.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
  }

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

  function styleDialogNode(node, styles) {
    try {
      const keys = Object.keys(styles);
      for (let i = 0; i < keys.length; i += 1) node.style[keys[i]] = styles[keys[i]];
    } catch (e) {}
    return node;
  }

  function dialogText(text, styles) {
    const node = document.createElement('div');
    node.textContent = text;
    return styleDialogNode(node, styles || {});
  }

  let openCommentTextBack = null;

  function closeCommentTextDialog(back) {
    try {
      if (back && typeof back.remove === 'function') back.remove();
    } catch (e) {}
    if (openCommentTextBack === back) openCommentTextBack = null;
  }

  function saveCommentTextDialog(back, anchorEl, clean) {
    postMessage(BLOCKTUBE_CONSTS.MESSAGES.CONTEXT_BLOCK_DATA, {
      type: BLOCKTUBE_CONSTS.BLOCK_TYPES.COMMENT,
      info: { id: clean, text: clean, via: 'comment' },
    });
    placeholderCommentThread(
      anchorEl,
      commentPlaceholderMessage(BLOCKTUBE_CONSTS.BLOCK_TYPES.COMMENT),
    );
    applyCommentRuleLive(clean);
    closeCommentTextDialog(back);
  }

  const LIVE_COMMENT_SELECTORS = 'ytd-comment-renderer, ytd-comment-view-model';

  function liveBlockCommentNode(node, rule) {
    try {
      if (!node || node.nodeType !== 1 || node.isConnected === false) return false;
      const text = commentFullText(node);
      if (text.length === 0 || !testFilterEntry(rule, text)) return false;
    } catch (e) {
      return false;
    }
    placeholderCommentThread(node, commentPlaceholderMessage(BLOCKTUBE_CONSTS.BLOCK_TYPES.COMMENT));
    return true;
  }

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

  const COMMENT_DIALOG_FONT = '"Overpass", "Open Sans", Helvetica, Arial, sans-serif';

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

  function clampDialogPos(left, top, boxW) {
    const vw = window.innerWidth || 800;
    return {
      left: Math.min(Math.max(left, 80 - boxW), vw - 80),
      top: Math.max(0, top),
    };
  }

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

  function makeCommentDialogMovable(panel, handle) {
    try {
      handle.addEventListener('mousedown', (event) => startCommentDialogDrag(panel, event));
    } catch (e) {}
  }

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

  function onCommentDialogKey(event, ctx) {
    try {
      if (event) event.stopPropagation();
    } catch (e) {}
    if (!event) return;
    if (event.key === 'Escape') ctx.close();
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) ctx.trySave();
  }

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

  function commentMenuEntries(store) {
    if (isWhitelistMenuMode(store)) {
      return [{ label: 'Remove from Whitelist', type: BLOCKTUBE_CONSTS.BLOCK_TYPES.UNALLOW }];
    }
    const entries = [];
    if (showMenuEntry(OPT.MENU_BLOCK_CHANNEL, store)) {
      entries.push({ label: 'Block Channel', type: BLOCKTUBE_CONSTS.BLOCK_TYPES.CHANNEL });
    }
    if (showMenuEntry(OPT.MENU_BLOCK_COMMENT, store)) {
      entries.push({ label: 'Block comment text…', type: BLOCKTUBE_CONSTS.BLOCK_TYPES.COMMENT });
    }
    if (showMenuEntry(OPT.MENU_ALLOW_CHANNEL, store)) {
      entries.push({ label: 'Allow Channel', type: BLOCKTUBE_CONSTS.BLOCK_TYPES.ALLOW });
    }
    return entries;
  }

  function commentMenuIcon(type) {
    if (type === BLOCKTUBE_CONSTS.BLOCK_TYPES.ALLOW) return 'CHECK';
    if (type === BLOCKTUBE_CONSTS.BLOCK_TYPES.UNALLOW) return 'REMOVE';
    return 'NOT_INTERESTED';
  }

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

  function commentPopupReport(scope) {
    if (!scope) return null;
    if (typeof scope.querySelectorAll !== 'function') return null;
    let items = [];
    try {
      if (typeof scope.matches === 'function' && scope.matches('[data-bt-comment-menu]')) {
        return null;
      }
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

  function injectCommentMenuEntries(scope, anchorEl, store) {
    const report = commentPopupReport(scope);
    if (!report || !report.parentNode) return 0;
    try {
      btSampleNativeMenuTheme(report);
    } catch (e) {}
    try {
      btSampleNativeRowIcon(report);
    } catch (e) {}
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

  function pathHasMenuButton(path) {
    for (let i = 0; i < path.length; i += 1) {
      const node = path[i];
      if (!node || typeof node.getAttribute !== 'function') continue;
      if (/more|action|menu/i.test(node.getAttribute('aria-label') || '')) return true;
    }
    return false;
  }

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

  function btHasNativeMenu(commentEl) {
    try {
      const hosts = commentEl.querySelectorAll('ytd-menu-renderer, #menu, #action-menu');
      for (let i = 0; i < hosts.length; i += 1) {
        try {
          const r = hosts[i].getBoundingClientRect();
          if (r && r.width > 0 && r.height > 0) return true;
        } catch (e) {}
      }
    } catch (e) {}
    try {
      const buttons = commentEl.querySelectorAll('button[aria-label], [aria-label]');
      for (let i = 0; i < buttons.length; i += 1) {
        let label = '';
        try {
          label = buttons[i].getAttribute ? buttons[i].getAttribute('aria-label') || '' : '';
        } catch (e) {}
        if (!/more|action|menu/i.test(label)) continue;
        try {
          const r = buttons[i].getBoundingClientRect();
          if (r && r.width > 0 && r.height > 0) return true;
        } catch (e) {}
      }
    } catch (e) {}
    return false;
  }

  let btFallbackMenuEl = null;
  let btFallbackCleanup = null;

  function btCloseFallbackMenu() {
    try {
      if (btFallbackCleanup) {
        const fn = btFallbackCleanup;
        btFallbackCleanup = null;
        fn();
      }
    } catch (e) {}
    try {
      if (btFallbackMenuEl && typeof btFallbackMenuEl.remove === 'function') {
        btFallbackMenuEl.remove();
      }
    } catch (e) {}
    btFallbackMenuEl = null;
  }

  let btNativeTemplateCache = null;
  let btNativeTemplateCalls = 0;

  function btFindVisibleMenuButton() {
    try {
      if (typeof document === 'undefined' || !document.querySelectorAll) return null;
      const nodes = document.querySelectorAll('button[aria-label], yt-icon-button');
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i];
        try {
          if (n.closest && n.closest('[data-bt-fallback-menu],[data-bt-fallback-btn]')) {
            continue;
          }
        } catch (e) {}
        let label = '';
        try {
          label = n.getAttribute ? n.getAttribute('aria-label') || '' : '';
        } catch (e) {}
        if (!/more|action|menu/i.test(label)) continue;
        try {
          if (typeof n.querySelector === 'function' && !n.querySelector('yt-icon')) {
            continue;
          }
        } catch (e) {}
        try {
          const r = n.getBoundingClientRect();
          if (r && r.width > 0 && r.height > 0) return n;
        } catch (e) {}
      }
    } catch (e) {}
    return null;
  }

  const BT_OFFICIAL_MENU_PATH =
    'M12 4a2 2 0 100 4 2 2 0 000-4Zm0 6a2 2 0 100 4 2 2 0 000-4Zm0 6a2 2 0 100 4 2 2 0 000-4Z';

  function btSvgWithPath(pathD, sizePx) {
    try {
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      if (!svg || typeof svg.setAttribute !== 'function') return null;
      svg.setAttribute('height', String(sizePx));
      svg.setAttribute('width', String(sizePx));
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('focusable', 'false');
      svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', pathD);
      svg.appendChild(path);
      return svg;
    } catch (e) {}
    return null;
  }

  function btWrapTriggerIcon(svg) {
    try {
      const box = document.createElement('div');
      const span = document.createElement('span');
      span.setAttribute('class', 'yt-icon-shape ytSpecIconShapeHost');
      styleDialogNode(box, {
        width: '24px',
        height: '24px',
        display: 'block',
        fill: 'currentcolor',
      });
      styleDialogNode(svg, {
        pointerEvents: 'none',
        display: 'block',
        width: '100%',
        height: '100%',
      });
      styleDialogNode(span, {
        display: 'inline-flex',
        width: '24px',
        height: '24px',
      });
      box.appendChild(svg);
      span.appendChild(box);
      return span;
    } catch (e) {}
    return null;
  }

  function btOfficialMenuIcon() {
    try {
      const svg = btSvgWithPath(BT_OFFICIAL_MENU_PATH, 24);
      if (!svg) return null;
      return btWrapTriggerIcon(svg);
    } catch (e) {}
    return null;
  }

  function btNativeTriggerTemplate() {
    try {
      if (btNativeTemplateCache) return btNativeTemplateCache;
      btNativeTemplateCalls += 1;
      if (btNativeTemplateCalls % 25 !== 1) return null;
      const t = btFindVisibleMenuButton();
      if (!t) return null;
      let w = 0;
      let h = 0;
      try {
        const r = t.getBoundingClientRect();
        w = Math.round(r.width);
        h = Math.round(r.height);
      } catch (e) {}
      if (!w || !h) return null;
      let color = '';
      try {
        if (window.getComputedStyle) color = window.getComputedStyle(t).color || '';
      } catch (e) {}
      btNativeTemplateCache = {
        w,
        h,
        color,
      };
      return btNativeTemplateCache;
    } catch (e) {}
    return null;
  }

  function btFallbackIsDark() {
    try {
      if (typeof document !== 'undefined' && document.documentElement) {
        if (typeof document.documentElement.hasAttribute === 'function') {
          if (document.documentElement.hasAttribute('dark')) return true;
        }
      }
    } catch (e) {}
    try {
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) return true;
      }
    } catch (e) {}
    return false;
  }

  let btNativeMenuTheme = null;

  function btSampleNativeMenuTheme(report) {
    try {
      if (!report || typeof report.closest !== 'function') return;
      if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
        return;
      }
      const popup = report.closest('ytd-menu-popup-renderer');
      if (!popup) return;
      const style = window.getComputedStyle(popup);
      if (!style) return;
      const bg = style.backgroundColor || '';
      const color = style.color || '';
      if (typeof bg !== 'string' || bg.length === 0) return;
      if (typeof color !== 'string' || color.length === 0) return;
      const border = typeof style.border === 'string' ? style.border : '';
      const boxShadow = typeof style.boxShadow === 'string' ? style.boxShadow : '';
      btNativeMenuTheme = { bg, color, border, boxShadow };
    } catch (e) {}
  }

  const BT_BLOCK_ICON_PATH =
    'M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1Zm0 2a9 9 0 018.246 12.605L4.755 6.661A8.99 8.99 0 0112 3ZM3.754 8.393l15.491 8.944A9 9 0 013.754 8.393Z';

  const BT_ROW_ICON_PATHS = {
    [BLOCKTUBE_CONSTS.BLOCK_TYPES.CHANNEL]: BT_BLOCK_ICON_PATH,
    [BLOCKTUBE_CONSTS.BLOCK_TYPES.COMMENT]: BT_BLOCK_ICON_PATH,
    [BLOCKTUBE_CONSTS.BLOCK_TYPES.ALLOW]: null,
    [BLOCKTUBE_CONSTS.BLOCK_TYPES.UNALLOW]: null,
  };

  function btSvgIcon(pathD, sizePx) {
    try {
      const size = sizePx > 0 ? sizePx : 24;
      const svg = btSvgWithPath(pathD, size);
      if (!svg) return null;
      const box = document.createElement('span');
      styleDialogNode(box, {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${size}px`,
        height: `${size}px`,
        flex: '0 0 auto',
      });
      styleDialogNode(svg, {
        pointerEvents: 'none',
        display: 'block',
        width: '100%',
        height: '100%',
        fill: 'currentcolor',
      });
      try {
        box.appendChild(svg);
      } catch (e) {
        return null;
      }
      return box;
    } catch (e) {}
    return null;
  }

  let btNativeRowIconPx = 0;

  function btSampleNativeRowIcon(report) {
    try {
      if (!report) return;
      let icon = null;
      try {
        icon =
          (report.shadowRoot && report.shadowRoot.querySelector('yt-icon')) ||
          (typeof report.querySelector === 'function' ? report.querySelector('yt-icon') : null);
      } catch (e) {}
      if (!icon || typeof icon.getBoundingClientRect !== 'function') return;
      const r = icon.getBoundingClientRect();
      if (r && r.width >= 16 && r.width <= 32 && r.height >= 16 && r.height <= 32) {
        btNativeRowIconPx = Math.round((r.width + r.height) / 2);
      }
    } catch (e) {}
  }
  function btMakeFallbackRowButton(label, type, colors) {
    try {
      const item = document.createElement('button');
      item.setAttribute('role', 'menuitem');
      item.setAttribute('type', 'button');
      item.setAttribute('data-bt-fallback-item', type);
      item.setAttribute('aria-label', label);
      styleDialogNode(item, {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        boxSizing: 'border-box',
        textAlign: 'left',
        padding: '8px 16px',
        fontSize: '14px',
        fontFamily: 'Roboto, Arial, sans-serif',
        color: colors.text,
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      });
      return item;
    } catch (e) {}
    return null;
  }

  function btFillFallbackRow(item, label, type) {
    try {
      const path = BT_ROW_ICON_PATHS[type];
      if (path) {
        const icon = btSvgIcon(path, btNativeRowIconPx || 24);
        if (icon) item.appendChild(icon);
      }
    } catch (e) {}
    try {
      const text = document.createElement('span');
      text.textContent = label;
      item.appendChild(text);
    } catch (e) {
      try {
        item.textContent = label;
      } catch (ignored) {}
    }
  }

  function btWireFallbackRow(item, commentEl, type, colors) {
    try {
      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = colors.hover;
      });
      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'transparent';
      });
    } catch (e) {}
    try {
      item.addEventListener('click', onCommentMenuTap(commentEl, type));
      item.addEventListener('click', () => btCloseFallbackMenu());
    } catch (e) {}
  }

  function btBuildFallbackRow(label, type, commentEl, colors) {
    const item = btMakeFallbackRowButton(label, type, colors);
    if (!item) return null;
    btFillFallbackRow(item, label, type);
    btWireFallbackRow(item, commentEl, type, colors);
    return item;
  }

  function btFallbackMenuEntries() {
    let entries = [];
    try {
      entries = commentMenuEntries(typeof storageData !== 'undefined' ? storageData : undefined);
    } catch (e) {
      entries = [];
    }
    if (!entries || entries.length === 0) {
      try {
        window.blockTubeExports.openToast('BlockTube has no comment actions enabled', 3000);
      } catch (e) {}
      return [];
    }
    return entries;
  }

  function btFallbackRowColors(dark) {
    if (btNativeMenuTheme)
      return { text: btNativeMenuTheme.color, hover: 'rgba(128, 128, 128, 0.25)' };
    if (dark) return { text: '#ffffff', hover: '#3d3d3d' };
    return { text: '#0f0f0f', hover: '#f2f2f2' };
  }

  function btMakeFallbackMenu(rowColors, dark) {
    const menu = styleDialogNode(document.createElement('div'), {
      position: 'fixed',
      display: 'block',
      minWidth: '220px',
      maxWidth: '300px',
      padding: '8px 0',
      borderRadius: '12px',
      border: btNativeMenuTheme && btNativeMenuTheme.border ? btNativeMenuTheme.border : 'none',
      backgroundColor: btNativeMenuTheme ? btNativeMenuTheme.bg : dark ? '#212121' : '#ffffff',
      color: rowColors.text,
      boxShadow:
        btNativeMenuTheme && btNativeMenuTheme.boxShadow
          ? btNativeMenuTheme.boxShadow
          : '0 4px 16px rgba(0, 0, 0, 0.3)',
      zIndex: '2147483647',
      fontFamily: 'Roboto, Arial, sans-serif',
      fontSize: '14px',
    });
    menu.setAttribute('role', 'menu');
    menu.setAttribute('data-bt-fallback-menu', '1');
    return menu;
  }

  function btFillFallbackMenu(menu, entries, commentEl, rowColors) {
    let rows = 0;
    for (let i = 0; i < entries.length; i += 1) {
      let item = null;
      try {
        item = btBuildFallbackRow(entries[i].label, entries[i].type, commentEl, rowColors);
      } catch (e) {
        item = null;
      }
      if (!item) continue;
      try {
        menu.appendChild(item);
        rows += 1;
      } catch (e) {}
    }
    return rows;
  }

  function btPlaceFallbackMenu(menu, rect, rows) {
    try {
      const vw = window.innerWidth || 800;
      const vh = window.innerHeight || 600;
      const mw = menu.offsetWidth || 220;
      const mh = menu.offsetHeight || rows * 36 + 16;
      let left = rect ? rect.left : 100;
      let top = rect ? rect.bottom + 4 : 100;
      if (left + mw > vw - 8) left = Math.max(8, vw - mw - 8);
      if (top + mh > vh - 8) top = Math.max(8, (rect ? rect.top : 100) - mh - 4);
      menu.style.left = `${Math.max(8, left)}px`;
      menu.style.top = `${Math.max(8, top)}px`;
    } catch (e) {}
  }

  function btWireFallbackMenuDismiss(menu, btn) {
    const onDocClick = (event) => {
      try {
        if (menu.contains(event.target) || (btn && btn.contains(event.target))) return;
      } catch (e) {}
      btCloseFallbackMenu();
    };
    const onKey = (event) => {
      if (event && event.key === 'Escape') btCloseFallbackMenu();
    };
    const onScroll = () => btCloseFallbackMenu();
    try {
      document.addEventListener('click', onDocClick, true);
      document.addEventListener('keydown', onKey, true);
      document.addEventListener('scroll', onScroll, true);
    } catch (e) {}
    btFallbackCleanup = () => {
      try {
        document.removeEventListener('click', onDocClick, true);
      } catch (e) {}
      try {
        document.removeEventListener('keydown', onKey, true);
      } catch (e) {}
      try {
        document.removeEventListener('scroll', onScroll, true);
      } catch (e) {}
    };
  }

  function btShowFallbackMenu(btn, commentEl) {
    btCloseFallbackMenu();
    if (typeof document === 'undefined') return;
    const entries = btFallbackMenuEntries();
    if (entries.length === 0) return;
    let rect = null;
    try {
      rect = btn.getBoundingClientRect();
    } catch (e) {}
    const dark = btNativeMenuTheme ? null : btFallbackIsDark();
    const rowColors = btFallbackRowColors(dark);
    const menu = btMakeFallbackMenu(rowColors, dark);
    const rows = btFillFallbackMenu(menu, entries, commentEl, rowColors);
    if (rows === 0) return;
    try {
      (document.body || document.documentElement).appendChild(menu);
    } catch (e) {
      return;
    }
    btPlaceFallbackMenu(menu, rect, rows);
    btFallbackMenuEl = menu;
    btWireFallbackMenuDismiss(menu, btn);
  }

  function btStyleFallbackTrigger(btn, tpl) {
    const btW = tpl && tpl.w ? `${tpl.w}px` : '40px';
    const btH = tpl && tpl.h ? `${tpl.h}px` : '40px';
    const btColor = tpl && tpl.color ? tpl.color : 'var(--yt-spec-icon-inactive, #909090)';
    styleDialogNode(btn, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: btW,
      height: btH,
      minWidth: btW,
      padding: '0',
      margin: '0',
      fontSize: '22px',
      lineHeight: '1',
      color: btColor,
      opacity: '1',
      backgroundColor: 'transparent',
      borderRadius: '50%',
      border: 'none',
      outline: 'none',
      cursor: 'pointer',
      flex: '0 0 auto',
    });
  }

  function btMakeFallbackTrigger(tpl) {
    const btn = document.createElement('button');
    btn.setAttribute('data-bt-fallback-btn', '1');
    btn.setAttribute('aria-label', 'BlockTube block comment');
    btn.setAttribute('title', 'BlockTube');
    btn.setAttribute('type', 'button');
    btStyleFallbackTrigger(btn, tpl);
    return btn;
  }

  function btFillFallbackTriggerIcon(btn) {
    try {
      const official = btOfficialMenuIcon();
      if (official) {
        btn.appendChild(official);
        return;
      }
    } catch (e) {}
    try {
      btn.textContent = '⋮';
    } catch (e) {}
  }

  function btPlaceTriggerInSlot(commentEl, btn) {
    let slot = null;
    try {
      slot = commentEl.querySelector('#action-menu');
    } catch (e) {
      return false;
    }
    if (!slot) return false;
    try {
      if (typeof slot.hasAttribute === 'function' && slot.hasAttribute('hidden')) {
        slot.removeAttribute('hidden');
      }
    } catch (e) {}
    try {
      slot.style.display = 'flex';
      slot.style.alignItems = 'center';
      slot.style.justifyContent = 'center';
      slot.style.visibility = 'visible';
      slot.appendChild(btn);
      return true;
    } catch (e) {}
    return false;
  }

  function btPlaceTriggerInHeader(commentEl, btn) {
    let header = null;
    try {
      header = commentEl.querySelector('#header');
    } catch (e) {
      return false;
    }
    if (!header) return false;
    try {
      btn.style.marginLeft = 'auto';
      btn.style.alignSelf = 'center';
      header.appendChild(btn);
      return true;
    } catch (e) {}
    return false;
  }

  function btPlaceTriggerAbsolute(commentEl, btn) {
    try {
      const pos = window.getComputedStyle
        ? window.getComputedStyle(commentEl).position
        : commentEl.style.position;
      if (pos === 'static' || !pos) commentEl.style.position = 'relative';
    } catch (e) {
      try {
        if (!commentEl.style.position) commentEl.style.position = 'relative';
      } catch (ignored) {}
    }
    try {
      btn.style.position = 'absolute';
      btn.style.top = '4px';
      btn.style.right = '4px';
      commentEl.appendChild(btn);
      return true;
    } catch (e) {}
    return false;
  }

  function btPlaceFallbackTrigger(commentEl, btn) {
    if (btPlaceTriggerInSlot(commentEl, btn)) return true;
    if (btPlaceTriggerInHeader(commentEl, btn)) return true;
    return btPlaceTriggerAbsolute(commentEl, btn);
  }

  function btWireFallbackTrigger(btn, commentEl) {
    try {
      btn.addEventListener('mouseenter', () => {
        btn.style.backgroundColor = 'rgba(128, 128, 128, 0.25)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.backgroundColor = 'transparent';
      });
      btn.addEventListener('click', (event) => {
        try {
          if (event) {
            event.preventDefault();
            event.stopPropagation();
          }
        } catch (e) {}
        btShowFallbackMenu(btn, commentEl);
      });
    } catch (e) {}
  }

  function btEnsureFallbackButton(commentEl) {
    try {
      if (!commentEl || commentEl.nodeType !== 1) return 'skip';
      if (typeof commentEl.querySelector !== 'function') return 'skip';
      if (commentEl.querySelector('[data-bt-fallback-btn]')) return 'skip';
      if (btHasNativeMenu(commentEl)) return 'native';
      const btn = btMakeFallbackTrigger(btNativeTriggerTemplate());
      btFillFallbackTriggerIcon(btn);
      if (!btPlaceFallbackTrigger(commentEl, btn)) return 'skip';
      btWireFallbackTrigger(btn, commentEl);
      return 'added';
    } catch (e) {}
    return 'skip';
  }

  function btSweepCandidates(node) {
    const candidates = [];
    try {
      if (typeof node.matches === 'function' && node.matches(LIVE_COMMENT_SELECTORS)) {
        candidates.push(node);
      }
    } catch (e) {}
    try {
      if (typeof node.querySelectorAll === 'function') {
        const found = node.querySelectorAll(LIVE_COMMENT_SELECTORS);
        for (let i = 0; i < found.length && candidates.length < 100; i += 1) {
          candidates.push(found[i]);
        }
      }
    } catch (e) {}
    return candidates;
  }

  function btSweepForFallbacks(node) {
    const out = { seen: 0, added: 0, native: 0 };
    try {
      if (!node || node.nodeType !== 1) return out;
      const candidates = btSweepCandidates(node);
      for (let i = 0; i < candidates.length; i += 1) {
        out.seen += 1;
        let verdict = 'skip';
        try {
          verdict = btEnsureFallbackButton(candidates[i]);
        } catch (e) {
          verdict = 'skip';
        }
        if (verdict === 'added') out.added += 1;
        else if (verdict === 'native') out.native += 1;
      }
    } catch (e) {}
    return out;
  }

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
          try {
            btSweepForFallbacks(added[j]);
          } catch (e) {}
        }
      }
    });
    try {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
    try {
      btSweepForFallbacks(document.documentElement);
    } catch (e) {}
  }

  // ================== src/scripts/inject/hooks.js ==================

  function chainedAccessors(owner, prop) {
    const odesc = Object.getOwnPropertyDescriptor(owner, prop);
    if (!(odesc instanceof Object)) return { prevGetter: undefined, prevSetter: undefined };
    if (odesc.configurable === false) return null;
    return {
      prevGetter: odesc.get instanceof Function ? odesc.get : undefined,
      prevSetter: odesc.set instanceof Function ? odesc.set : undefined,
    };
  }

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
          trapChain(a, remPath, state);
        }
      },
    });
  }

  function trapChain(owner, remPath, state) {
    const pos = remPath.indexOf('.');
    if (pos === -1) {
      trapChainLeaf(owner, remPath, state);
      return;
    }
    const prop = remPath.slice(0, pos);
    const v = owner[prop];
    remPath = remPath.slice(pos + 1);
    if (v instanceof Object || (typeof v === 'object' && v !== null)) {
      trapChain(v, remPath, state);
      return;
    }
    trapChainLink(owner, prop, remPath, state);
  }

  const trapObjectPath = function (path, replacementValue, onSet = undefined) {
    const state = {
      replacementValue,
      onSet,
      blocked: false,
    };
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
    trapChain(window, path, state);
  };

  // !! Globals

  window.blockTubeReloadRequired = false;

  let storageData;

  let jsFilter;
  let jsFilterEnabled = false;

  let playerHasBeenBlocked = false;
  let hooksStarted = false;
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
  function compileOneRegExp(v) {
    if (!Array.isArray(v)) return undefined;
    try {
      return RegExp(v[0], typeof v[1] === 'string' ? v[1].replace('g', '') : '');
    } catch (e) {
      console.error(`RegExp parsing error: /${v[0]}/${v[1]}`);
      return undefined;
    }
  }

  function compileRegExpProp(filterData, prop) {
    if (has.call(filterData, prop) && Array.isArray(filterData[prop])) {
      filterData[prop] = filterData[prop].map(compileOneRegExp);
    }
  }

  function transformToRegExp(data) {
    if (typeof data !== 'object' || data === null) return;
    if (typeof data.filterData !== 'object' || data.filterData === null) return;
    regexProps.forEach((p) => compileRegExpProp(data.filterData, p));
    compileRegExpProp(data.filterData, BLOCKTUBE_CONSTS.BLOCK_TYPES.ALLOW);
  }

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

  function hookGuideData() {
    if (typeof window.ytInitialGuideData === 'object' && window.ytInitialGuideData !== null) {
      ObjectFilter(window.ytInitialGuideData, filterRules.guide);
    } else {
      trapObjectPath('ytInitialGuideData', undefined, (v) => ObjectFilter(v, filterRules.guide));
    }
  }

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

  let reelSequenceScrubbing = false;

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
      scrubSequenceValue(current);
      return;
    }
    trapObjectPath('ytInitialReelWatchSequenceResponse', undefined, (v) => {
      scrubSequenceValue(v);
    });
  }

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
    for (let idx = 0; idx < regexProps.length; idx += 1) {
      const prop = data.filterData[regexProps[idx]];
      if (prop !== undefined && !Array.isArray(prop)) return false;
    }
    if (data.filterData.whitelist !== undefined && !Array.isArray(data.filterData.whitelist))
      return false;
    if (data.filterData.vidLength !== undefined && !Array.isArray(data.filterData.vidLength))
      return false;
    return (
      data.filterData.javascript === undefined || typeof data.filterData.javascript === 'string'
    );
  }

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

    if (!hooksStarted) {
      startHook();
    }
    try {
      if (typeof startCommentObserver === 'function') startCommentObserver();
    } catch (e) {}
  }
  // !! Start
  console.info(`BlockTube Init OK (${BLOCKTUBE_CONSTS.MESSAGES.FROM_CONTENT})`);

  const isMobileInterface = document.location.hostname.startsWith('m.');

  window.addEventListener('yt-navigate-start', () => {
    playerHasBeenBlocked = false;
    pageChannel = null;
    try {
      if (typeof shortsSkipNavigationStarted === 'function') shortsSkipNavigationStarted();
    } catch (e) {}
    try {
      if (typeof shortsOverlayNavigateStart === 'function') shortsOverlayNavigateStart();
    } catch (e) {}
  });

  window.addEventListener('yt-navigate-finish', () => {
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
