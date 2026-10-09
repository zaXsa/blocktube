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
