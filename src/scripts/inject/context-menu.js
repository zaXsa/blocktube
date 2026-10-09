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

  // Menu diagnostics (Shorts menus, tap resolution). Enable in the page
  // console with `localStorage.setItem('blocktube_debug_menus', '1')`, reload,
  // reproduce, and watch the page console for `[BlockTube menus]` lines:
  // injection reports per menu (renderer, native count, offered flags) and
  // every Block/Allow tap reports how it resolved (which branch, stamp
  // presence, resulting block target). A denied localStorage (or any exotic
  // realm) degrades to off instead of throwing.
  function btMenusDebugEnabled() {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem('blocktube_debug_menus') === '1';
    } catch (e) {
      return false;
    }
  }

  function btLogMenu(...args) {
    if (!btMenusDebugEnabled()) return;
    try {
      console.info('[BlockTube menus]', ...args);
    } catch (e) {}
  }

  // Tap-target inspector for the menu diagnostics above: reports what a tap
  // (e.g. on the native "Description" row) actually resolves from — element
  // tag, data shape, command type and whether our blockTube stamp is
  // reachable. That pinpoints "where the row was created": a row bound to
  // listItemViewModel rendererContext data shows the command keys, a classic
  // service-item row shows its serviceEndpoint, and hasStamp tells whether
  // the tap can ever reach our channel/video identity.
  function describeTapTarget(el) {
    try {
      const out = { tag: (el && el.tagName) || null };
      const data =
        (el && el.data) || (el && getObjectByPath(el, '__instance.props.data'));
      if (!data || typeof data !== 'object') {
        out.data = typeof data;
        return out;
      }
      out.dataKeys = Object.keys(data);
      const rc =
        data.rendererContext ||
        (data.listItemViewModel && data.listItemViewModel.rendererContext);
      if (rc && typeof rc === 'object') {
        out.hasRendererContext = true;
        out.hasStamp = !!(rc.blockTube || data.blockTube);
        const cmd = getObjectByPath(rc, 'commandContext.onTap.innertubeCommand');
        out.cmdKeys = cmd && typeof cmd === 'object' ? Object.keys(cmd) : typeof cmd;
      }
      const se =
        data.serviceEndpoint ||
        (data.menuServiceItemRenderer && data.menuServiceItemRenderer.serviceEndpoint);
      if (se) out.hasServiceEndpoint = true;
      return out;
    } catch (e) {
      return { error: true };
    }
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
        buildBlockActionMenuItem(attr, 'block_channel', channelData, 'Block Channel', 'Channel blocked'),
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

  // The playing Short: id from the /shorts/<id> URL, name from the document
  // title ("<title> - YouTube"). Both missing off-shorts (the menu branch
  // only runs on the overlay, which only exists there, but stay fail-open).
  function currentShortsVideo() {
    let id;
    let text;
    try {
      const match = document.location.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})/);
      id = match ? match[1] : undefined;
    } catch (e) {}
    try {
      const title = typeof document.title === 'string' ? document.title : '';
      const name = title.replace(/\s*-\s*YouTube\s*$/, '').trim();
      text = name.length > 0 ? name : undefined;
    } catch (e) {}
    return { id, text };
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
    const attr = resolveContextMenuAttr(obj, keys);
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

    if (isWhitelistMenuMode(store)) {
      // Whitelist mode: the visible cards are already allowlisted, so offer
      // removal instead of a pointless re-allow.
      const removeChannelItem = createLockupButtonItem(
        'Remove from Whitelist',
        createCleanContext(items, store, true, currentObj, true, true),
        'REMOVE',
      );
      if (hasChannel) items.push(removeChannelItem);
      return true;
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

    return true;
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
    const videoId = currentObj && getObjectByPath(currentObj, 'onTap.innertubeCommand.reelWatchEndpoint.videoId');
    if (typeof videoId === 'string') return videoId;
    return currentObj && currentObj.contentId;
  }

  function createCleanContext(items, store, isChannel, currentObj, forAllow = false, forRemove = false) {
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
    overwriteOnTapCommand(cleanContext, msg, lockupFeedbackContentId(currentObj), forAllow, forRemove);

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
      return false;
    }

    // Block mode additionally offers allowlisting, so the allowlist can be
    // built while browsing normally (an empty allowlist hides everything, so
    // there would be nothing left to allowlist from).
    if (hasChannel && showMenuEntry(OPT.MENU_BLOCK_CHANNEL, store)) items.push(blockChannelItem);
    if (hasVideo && showMenuEntry(OPT.MENU_BLOCK_VIDEO, store)) items.push(blockVideoItem);
    if (hasChannel && showMenuEntry(OPT.MENU_ALLOW_CHANNEL, store)) items.push(allowChannelItem);

    return false;
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

    const { items, hasChannel, hasVideo, isLockupViewModel, attr } = extracted;

    const nativeCount = Array.isArray(items) ? items.length : 0;
    injectBlockMenuItems(items, hasChannel, hasVideo, isLockupViewModel, obj[attr], storageData);

    // Reactive renderers re-render on property assignment, not on in-place
    // array mutation: if the reel popup bound the items array before our push
    // (eager pre-render), a plain push stays invisible while the data looks
    // right. Replacing the array reference notifies Polymer (property change)
    // and Lit-style renderers (property set) alike; lazy readers see the same
    // contents either way. Shelf sheets render lazily on open, so only the
    // reel overlay needs this.
    if (attr === 'reelPlayerOverlayRenderer') {
      const menu = getObjectByPath(obj[attr], 'menu.menuRenderer');
      if (menu && Array.isArray(menu.items)) menu.items = menu.items.slice();
    }

    btLogMenu('inject', {
      attr,
      nativeItems: nativeCount,
      totalItems: Array.isArray(items) ? items.length : 0,
      hasChannel,
      hasVideo,
    });

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

  // Create the toast div, styled property-by-property through CSSOM only
  // (no <style>, no innerHTML), so page CSP and Trusted Types stay out of
  // the way; pointer-events:none so it can never swallow clicks.
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
    return {
      channelData: {
        id: parentData.blockTube?.metadata?.channelId,
        text: parentData.blockTube?.metadata?.channelName,
      },
      videoData: {
        id: parentData.blockTube?.metadata?.videoId,
        text: parentData.blockTube?.metadata?.videoName,
      },
      removeParent: false,
      stopPlayer: false,
      isShorts: parentData.blockTube?.metadata?.isShorts === true,
      isWatch: parentData.blockTube?.metadata?.isWatch === true,
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
  const MENU_TAP_ACTIONS = ['Block Channel', 'Block Video', 'Allow Channel', 'Remove from Whitelist'];

  // Menu-tap types that take the card off the page (allow taps keep it so it
  // can be watched right away).
  function isCardRemovingTap(type) {
    return type === 'channelId' || type === 'videoId' || type === 'unwhitelist';
  }

  // Confirmation toast for Shorts taps: the reel UI does not reliably surface
  // YouTube's own feedback (no hide affordance on shelf sheets, no error
  // screen on watch), so without this a tap looks like it did nothing.
  function toastShortsTap(type) {
    try {
      openToast(
        type === 'unwhitelist'
          ? 'Removed from whitelist'
          : type === 'videoId'
            ? 'Video Blocked'
            : 'Channel Blocked',
        4000,
      );
    } catch (e) {}
  }

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

    btLogMenu('resolve', {
      menuAction,
      isDataFromRightHandSide,
      parentTag: parentDom && parentDom.tagName,
      hasStamp: !!(parentData && parentData.blockTube),
      originalAttr: parentData && parentData._btOriginalAttr,
      target: describeTapTarget(this),
    });

    // Get the data and type which is used for blocking the video
    const { type, data, removeParent, stopPlayer, isShorts, isWatch } = getBlockData(
      parentDom,
      parentData,
      isDataFromRightHandSide,
      menuAction,
    );

    btLogMenu('block', {
      type,
      id: data && data.id,
      text: data && data.text,
      removeParent,
      stopPlayer,
      isShorts,
      isWatch,
    });

    // Notify system what data should be added to the block list
    postMessage(BLOCKTUBE_CONSTS.MESSAGES.CONTEXT_BLOCK_DATA, { type, info: data });

    applyMenuTapEffect(type, removeParent, stopPlayer, isDataFromRightHandSide, parentDom);
    // Shorts taps can resolve through the stamped sheet path (isShorts) or,
    // when the tapped item renders a single formatted string, the generic rule
    // path via _btOriginalAttr — both must confirm and dismiss. The id lands
    // in the block list either way, which is why a tap can "work" yet leave
    // the card up with no feedback when only the stamp is checked.
    const isShortsTap = isShorts || parentData?._btOriginalAttr === 'shortsLockupViewModel';
    if (isShortsTap && isCardRemovingTap(type)) {
      // Guaranteed feedback first: the reel UI surfaces neither the sheet
      // feedback nor the player error screen.
      toastShortsTap(type);
      if (isWatch) {
        pauseReelPlayer();
      } else {
        dismissShortsShelfCard(
          shortsTapVideoId(parentData, type, data),
          type === 'unwhitelist' ? 'Removed from whitelist' : 'Blocked',
        );
      }
    }
    forwardMenuTap.call(this, event);
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
