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

  // Individual creator entries read as `Block <creator>` so they align with
  // the sibling rows ("Block Channel" / "Block All Channels"). The tap
  // handler resolves the creator through the custom payload; the label is
  // only used as a fallback when a renderer drops it (exact-match against
  // the known creator list, so "Block <name>" cannot be confused with
  // "Block Channel" and friends even though they share the "Block " prefix).
  const INDIVIDUAL_LABEL_PREFIX = 'Block ';

  // Sanitize a collaborator pair list for menu entries: an entry needs a
  // blockable id, duplicate ids collapse, and a missing name stays undefined
  // (the label falls back to the id). Pairing happens in paths.js, per dialog
  // item — never by zipping two independently deduped lists.
  function usableChannelPairs(pairs) {
    const channels = [];
    const seen = new Set();
    if (!(pairs instanceof Array)) return channels;
    for (let i = 0; i < pairs.length; i += 1) {
      const pair = pairs[i];
      if (!pair || typeof pair.id !== 'string' || pair.id.length === 0) continue;
      if (seen.has(pair.id)) continue;
      seen.add(pair.id);
      channels.push({
        id: pair.id,
        text: typeof pair.text === 'string' && pair.text.length > 0 ? pair.text : undefined,
      });
    }
    return channels;
  }

  // The label shown for one creator's entry.
  function individualChannelLabel(channel) {
    return (
      INDIVIDUAL_LABEL_PREFIX +
      (typeof channel.text === 'string' && channel.text.length > 0 ? channel.text : channel.id)
    );
  }

  // Resolve a `Block <creator>` label back to the channel it names. Only
  // used as a fallback when the renderer element no longer exposes the custom
  // payload; the match requires the remainder to equal a known creator, so
  // labels that happen to share the "Block " prefix (e.g. "Block Channel")
  // never resolve here.
  function individualChannelFromLabel(channels, menuAction) {
    if (typeof menuAction !== 'string' || !menuAction.startsWith(INDIVIDUAL_LABEL_PREFIX)) {
      return undefined;
    }
    const wanted = menuAction.slice(INDIVIDUAL_LABEL_PREFIX.length).trim();
    if (wanted.length === 0 || !(channels instanceof Array)) return undefined;
    for (let i = 0; i < channels.length; i += 1) {
      const channel = channels[i];
      if (!channel || typeof channel.id !== 'string') continue;
      const label =
        typeof channel.text === 'string' && channel.text.length > 0
          ? channel.text
          : channel.id;
      if (label === wanted) return channel;
    }
    return undefined;
  }

  // Labels for the channel action: one channel keeps the existing "Block
  // Channel" (no behaviour change for normal videos). A collaboration gets
  // "Block All Channels" plus, when the option is on, one entry per creator.
  // `make(label, channel?)` builds the surface-specific row; `channel` is set
  // only for individual entries.
  function channelBlockEntries(channels, showIndividuals, make) {
    const list = usableChannelPairs(channels);
    const collab = list.length > 1;
    const entries = [make(collab ? 'Block All Channels' : 'Block Channel')];
    if (collab && showIndividuals) {
      for (let i = 0; i < list.length; i += 1) {
        entries.push(make(individualChannelLabel(list[i]), list[i]));
      }
    }
    return entries;
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

  // Lockup cards share the rule paths, plus the channel-page fallback: cards on
  // a channel's own tabs carry no attribution (no avatar, no channel row), so
  // without the page channel the tap posts an undefined id the content script
  // drops — silently doing nothing — and the annotation falls back to the view
  // count, which lockupChannelName (a function rule path) already refuses. The
  // page channel fills the rest; collab stacks contribute every entry, so one tap blocks them all.
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

  // Creators listed by a lockup card's avatar-stack dialog, as reliable
  // id/name pairs. Only dialogs supply the pairing, so individual entries are
  // offered exactly where one creator can be told from another.
  function lockupChannelsFrom(renderer) {
    return usableChannelPairs(getCollaboratorChannels(renderer));
  }

  // Watch-page videoOwnerRenderer data: on a collaboration video the byline
  // dialog lists every creator. Prefer the same data payload (the menu is
  // built while filtering, before the owner element is in the DOM), then the
  // live element.
  function watchOwnerData(container, attr, currentObj) {
    if (attr === 'videoSecondaryInfoRenderer') {
      const owner = getObjectByPath(currentObj, 'owner.videoOwnerRenderer');
      if (owner) return owner;
    }
    const sibling = getObjectByPath(
      container,
      'videoSecondaryInfoRenderer.owner.videoOwnerRenderer',
    );
    if (sibling) return sibling;
    const inResponse = findOwnerRendererData(container);
    if (inResponse) return inResponse;
    const ownerRenderer = document.getElementsByTagName('ytd-video-owner-renderer')[0];
    const owner = ownerRenderer?.data || ownerRenderer?.getCurrentData?.();
    return owner?.videoOwnerRenderer || owner;
  }

  // Watch-page primary creator as an id/name pair. The owner renderer's title
  // carries the linked channel; the dialog lists every creator, but tolerate a
  // shape that lists only co-creators by always folding the owner back in.
  function ownerChannelPair(ownerData) {
    const id = getObjectByPath(
      ownerData,
      'title.runs[0].navigationEndpoint.browseEndpoint.browseId',
    );
    if (typeof id !== 'string' || id.length === 0) return undefined;
    const name = getObjectByPath(ownerData, 'title.runs[0].text');
    return { id, text: typeof name === 'string' && name.length > 0 ? name : undefined };
  }

  // Every creator on a watch-page collaboration, as reliable pairs. The
  // dialog names creators precisely, so it wins when it lists the owner too;
  // the owner is folded in only for a shape that lists co-creators alone.
  function watchChannelPairs(ownerData) {
    const pairs = getCollaboratorChannels(ownerData, OWNER_COLLAB_LIST_ITEMS_PATHS);
    const owner = ownerChannelPair(ownerData);
    if (!owner || pairs.some((pair) => pair.id === owner.id)) {
      return usableChannelPairs(pairs);
    }
    return usableChannelPairs([owner].concat(pairs));
  }

  // Reliable creator pairs for the surface whose menu is being built. Lockup
  // sheets read the avatar-stack dialog; watch-page menus read the owner
  // dialog; every other renderer has no paired source, so it gets no
  // individual entries (its "block all" still resolves at tap time).
  function menuChannelPairs(currentObj, attr, container) {
    if (attr === 'lockupViewModel') return lockupChannelsFrom(currentObj);
    if (attr === 'videoPrimaryInfoRenderer' || attr === 'videoSecondaryInfoRenderer') {
      return watchChannelPairs(watchOwnerData(container, attr, currentObj));
    }
    return [];
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
  const MOBILE_UP_NEXT_ATTRS = new Set([
    'videoWithContextRenderer',
    'compactVideoRenderer',
    'movieRenderer',
    'compactMovieRenderer',
    'playlistVideoRenderer',
    'reelItemRenderer',
    'commentRenderer',
  ]);

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

    if (MOBILE_UP_NEXT_ATTRS.has(attr)) {
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

  // Cards carrying a real menu (videoActions/actionMenu) expose their items
  // directly. Undefined when neither shape is present.
  function extractDirectMenuFlags(obj, attr) {
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
    return undefined;
  }

  function extractMenuItems(obj, attr) {
    const direct = extractDirectMenuFlags(obj, attr);
    if (direct !== undefined) return direct;
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
    return extractAttrMenuFlags(obj, attr);
  }

  // Renderer-key branch of extractMenuItems: reel topbar/response sheets live
  // behind the topbar button, everything else uses the generic menu lookup.
  function extractAttrMenuFlags(obj, attr) {
    if (attr === 'reelItemWatchResponse' || attr === 'topbar') {
      return extractReelTopbarMenuFlags(obj, attr);
    }
    return extractGenericMenuFlags(obj, attr);
  }

  // Stamp a menu container with BlockTube tap metadata. Shared by every
  // extraction branch below (lockup sheet, shorts sheet, reel overlay/topbar).
  function stampBlockTubeMetadata(target, metadata) {
    Object.defineProperty(target, 'blockTube', {
      value: { metadata },
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }

  // Reel/Shorts watch metadata is identical for the overlay and topbar sheets.
  function reelBlockMetadata(channel, video) {
    return {
      channelId: channel.id,
      channelName: channel.text,
      videoId: video.id,
      videoName: video.text,
      removeObject: true,
      isShorts: true,
      isWatch: true,
    };
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

    stampBlockTubeMetadata(sheetmodel, {
      channelId,
      channelName,
      // Reliable per-creator pairs from the avatar-stack dialog, used by the
      // individual "Block <creator>" entries when a right-hand tap cannot
      // read the row payload (label fallback, see menuOnTap).
      channels: lockupChannelsFrom(renderer),
      videoId,
      videoName,
      removeObject: true,
    });

    return items;
  }

  // Shorts-shelf branch of extractMenuItems: the sheet lives under menuOnTap
  // (not metadata.menuButton like lockupViewModel). The channel id decodes from
  // reelWatchEndpoint.params (see shortsLockupChannelId) — no channel name on
  // the card — so the channel entry is offered only when an id resolved. The
  // blockTube stamp mirrors lockupViewModel so right-hand taps share the stamped
  // path. Null when no sheet.
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

    stampBlockTubeMetadata(sheetmodel, {
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
    });

    return items;
  }

  // Watch-page branch of extractMenuItems: the reel `...` menu holds
  // listItemViewModel entries ("Description", "Save to playlist", ...), so the
  // lockup-style entries below render alongside natively. Channel resolves from
  // the reel channel bar (avatar/browse link + handle text); video id is the
  // /shorts/<id> URL, name the document title, stamp carries isWatch so taps
  // pause the reel instead of hunting a shelf card. Null when overlay has no menu (e.g. embeds).
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

    stampBlockTubeMetadata(renderer, reelBlockMetadata(channel, video));

    return items;
  }

  // Watch-page topbar branch of extractMenuItems: the VISIBLE `...` sheet lives in the
  // reel topbar's trailing-buttons MORE_VERT buttonViewModel (showSheetCommand → inlineContent
  // → sheetViewModel → listViewModel → listItems), not overlay.menu (a decoy copy nothing renders).
  // `attr` is the matched key: live swipes carry `topbar`/`overlay` top-level, prefetches wrap
  // them in `reelItemWatchResponse` — normalize first. Channel resolves from the same response's
  // overlay bar (correct per reel even for prefetches); video resolves live at tap time (see stampedMenuBlockData), so prefetch staleness cannot misattribute a tap. Null without the button (shape drift) — overlay-menu branch above stays the fallback.
  // Stamp one reel topbar sheet with BlockTube tap metadata (channel/video
  // identity + Shorts flags), so the tap handler can attribute the block.
  function stampReelTopbarSheet(sheet, channel, video) {
    stampBlockTubeMetadata(sheet, reelBlockMetadata(channel, video));
  }

  function extractReelTopbarMenuFlags(obj, attr) {
    const root = attr === 'reelItemWatchResponse' ? obj[attr] : obj;
    const found = findReelTopbarSheet(root);
    if (!found) return null;
    const overlay = getObjectByPath(root, 'overlay.reelPlayerOverlayRenderer');
    const channel = overlay
      ? reelOverlayChannelFrom(overlay)
      : { id: undefined, text: undefined };
    const video = currentShortsVideo();
    stampReelTopbarSheet(found.sheet, channel, video);
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
    attr,
    container,
  ) {
    if (isReelOverlay) {
      injectReelOverlayButtons(items, hasChannel, hasVideo, store);
      return;
    }
    if (isLockupViewModel) {
      injectLockupViewModelButtons(items, hasChannel, hasVideo, currentObj, store);
      return;
    }
    injectStandardMenuButtons(items, hasChannel, hasVideo, store, currentObj, attr, container);
  }

  // Watch-page reel entries: clone a native row and retitle it — the popup's listItem
  // transformer drops rows whose onTap it cannot render, which sank the first synthesized
  // no-op (in data, never on screen). Cloning keeps the renderable shape, but the borrowed
  // command must be neutralized (see overwriteOnTapCommand): a Block tap must NOT run
  // Description/Save/..., neither via forwardMenuTap (skipping it alone fails — the row's own
  // framework click binding still fires) nor otherwise; the feedback-only no-op is silent, hides nothing, stays unique per entry (verbatim commands collapse under param dedupe) and stamped against double-filter duplicates, with the BlockTube icon; menuOnTap's block post + overlay/skip are the whole effect (no toast); the blockTube stamp stays on the sheet (extractReelTopbarMenuFlags) / overlay renderer (extractFromReelOverlay), not per item.
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

  // Neutralize a cloned reel menu row's borrowed native command in place: the
  // clone keeps the renderable row shape, but a Block tap must never run
  // Description / Save / ... — not via forwardMenuTap and not via the
  // framework's own click binding either. Tags the row as ours.
  function neutralizeReelMenuCommand(vm, tag) {
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
      neutralizeReelMenuCommand(vm, tag);
    } catch (e) {}
    return clone;
  }

  function injectReelOverlayButtons(items, hasChannel, hasVideo, store) {
    if (!items.length) return;
    if (items.some(isOurReelEntry)) return;
    const template = items.find(
      (item) => item && item.listItemViewModel && !isOurReelEntry(item),
    );
    if (!template) return;

    const fresh = [];
    if (isWhitelistMenuMode(store)) {
      // Whitelist mode: the visible short is already allowlisted, so offer
      // removal instead of a pointless re-allow.
      if (hasChannel) fresh.push(cloneReelMenuItem(template, 'Remove from Whitelist', 'REMOVE', 'unallow'));
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

    // Collab cards expose the avatar-stack dialog, which pairs every creator
    // with its own id. Individual entries reuse the same clean context: the
    // native hide command is identical, only the payload differs.
    const channelItems = channelBlockEntries(
      hasChannel && !isWhitelistMenuMode(store) ? lockupChannelsFrom(currentObj) : [],
      showMenuEntry(OPT.MENU_COLLAB_INDIVIDUAL, store),
      (label, channel) =>
        createLockupButtonItem(
          label,
          cleanChannelContext,
          'NOT_INTERESTED',
          channel,
          channel
            ? { removeParent: false, stopPlayer: false, isShorts: false, isWatch: false }
            : undefined,
        ),
    );
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
    if (hasChannel && showMenuEntry(OPT.MENU_BLOCK_CHANNEL, store)) {
      // Appended below YouTube's own hide row ("Not interested" / "Don't
      // recommend channel"), which stays intact: blocking a channel is a
      // separate action from the native feedback command.
      for (const item of channelItems) items.push(item);
    }
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

  function createLockupButtonItem(
    title,
    rendererContext,
    imageName = 'NOT_INTERESTED',
    originalData,
    effect,
  ) {
    const item = {
      listItemViewModel: {
        title: { content: title },
        leadingImage: {
          sources: [{ clientResource: { imageName } }],
        },
        rendererContext,
      },
    };
    if (originalData) {
      item.listItemViewModel._btOriginalData = originalData;
      item.listItemViewModel._btMenuAction = 'block_channel';
      item.listItemViewModel._btEffect = effect;
    }

    return item;
  }

  function injectStandardMenuButtons(items, hasChannel, hasVideo, store, currentObj, attr, container) {
    const allowMode = isWhitelistMenuMode(store);
    const blockVideoItem = createStandardBlockItem('Block Video');
    const allowChannelItem = createStandardBlockItem('Allow Channel', 'CHECK');
    const removeChannelItem = createStandardBlockItem('Remove from Whitelist', 'REMOVE');

    // Watch-page menus are the only standard menus with a paired creator
    // source; individual entries carry their own payload and the watch-page
    // effect (stop playback, never tear down the page).
    const channelItems = channelBlockEntries(
      hasChannel && !allowMode ? menuChannelPairs(currentObj, attr, container) : [],
      showMenuEntry(OPT.MENU_COLLAB_INDIVIDUAL, store),
      (label, channel) =>
        createStandardBlockItem(
          label,
          'NOT_INTERESTED',
          channel,
          channel
            ? { removeParent: false, stopPlayer: true, isShorts: false, isWatch: false }
            : undefined,
        ),
    );

    let channelEndpoint;
    if (store.options[OPT.BLOCK_FEEDBACK]) {
      for (const item of items) {
        const endpoint = item?.menuServiceItemRenderer?.serviceEndpoint;
        if (!endpoint) continue;

        const iconType = getObjectByPath(item, 'menuServiceItemRenderer.icon.iconType');
        if (iconType === 'NOT_INTERESTED' && hasVideo) {
          blockVideoItem.menuServiceItemRenderer.serviceEndpoint = deepClone(endpoint);
        } else if (iconType === 'REMOVE' && hasChannel) {
          channelEndpoint = endpoint;
        }
      }
    }
    // The native channel-feedback command applies to every channel entry, so
    // "Block All Channels" and each individual creator confirm the same way.
    if (channelEndpoint) {
      for (const item of channelItems) {
        item.menuServiceItemRenderer.serviceEndpoint = deepClone(channelEndpoint);
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
    if (hasChannel && showMenuEntry(OPT.MENU_BLOCK_CHANNEL, store)) {
      for (const item of channelItems) items.push(item);
    }
    if (hasVideo && showMenuEntry(OPT.MENU_BLOCK_VIDEO, store)) items.push(blockVideoItem);
    if (hasChannel && showMenuEntry(OPT.MENU_ALLOW_CHANNEL, store)) items.push(allowChannelItem);
  }

  // Desktop overflow menu: a minimal menuServiceItemRenderer entry appended to
  // the video's existing overflow menu (endpoint cloned from a feedback item
  // when block_feedback is on, see injectStandardMenuButtons). Individual
  // creator entries also carry their target + effect on the renderer data,
  // which menuOnTap reads off the tapped element — the same seam mobile taps
  // use (see menuOnTapMobile).
  function createStandardBlockItem(text, iconType = 'NOT_INTERESTED', originalData, effect) {
    const renderer = {
      text: { runs: [{ text }] },
      icon: { iconType },
    };
    if (originalData) {
      renderer._btOriginalData = originalData;
      renderer._btMenuAction = 'block_channel';
      renderer._btEffect = effect;
    }
    return { menuServiceItemRenderer: renderer };
  }

  // Recognize a live-chat popup row we injected earlier (double-filter/preload
  // dedupe guard). Native rows never carry the custom action field.
  function isOurLiveChatEntry(item) {
    const renderer = item && item.menuServiceItemRenderer;
    return !!(renderer && renderer._btMenuAction === 'block_channel');
  }

  // The channel id hidden in one of the live-chat menu endpoint params: a
  // base64 protobuf with ids as length-delimited ASCII strings. YouTube also
  // percent-encodes the '=' padding and mixes standard/base64url alphabets
  // between surfaces, so normalize all three before decoding. First match only
  // — callers pick which params blob to read (see liveChatChannelIdFromMenuItems).
  function liveChatChannelIdFromParams(params) {
    if (typeof params !== 'string' || params.length === 0) return undefined;
    try {
      return ucChannelIdFromText(atob(normalizeBase64Params(params)));
    } catch (e) {
      return undefined;
    }
  }

  // The message author's channel id out of the native popup rows. YouTube's
  // own "Block" row (logged in) targets the author in
  // moderateLiveChatEndpoint params, so that is the first-choice fallback when
  // the `...` click anchor was missed. The Report form is the last resort: its
  // UC order is not dependable (it can carry the enclosing stream's owner
  // first — user-verified misblock), so it must never outrank the tapped
  // message's own renderer data or the native Block target.
  function liveChatChannelIdFromMenuItems(items) {
    let reportId;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i] || {};
      const renderer = item.menuServiceItemRenderer || item.menuNavigationItemRenderer;
      const blockId = liveChatChannelIdFromParams(
        getObjectByPath(
          renderer,
          'navigationEndpoint.confirmDialogEndpoint.content.confirmDialogRenderer.confirmButton.buttonRenderer.serviceEndpoint.moderateLiveChatEndpoint.params',
        ) ||
          getObjectByPath(renderer, 'serviceEndpoint.moderateLiveChatEndpoint.params'),
      );
      if (blockId) return blockId;
      if (reportId === undefined) {
        reportId = liveChatChannelIdFromParams(
          getObjectByPath(renderer, 'serviceEndpoint.getReportFormEndpoint.params'),
        );
      }
    }
    return reportId;
  }

  // Live chat `...` popup ("Chat actions"): the menu content arrives as a
  // dedicated /get_item_context_menu fetch made when the button is tapped —
  // too late for the usual contextMenuObjects injection, so the response is
  // enriched directly. A standard "Block Channel" row (same
  // menuServiceItemRenderer shape desktop menus use) renders natively, and the
  // custom payload rides the renderer data into menuOnTap. Whitelist mode
  // offers nothing here (no allowlist/removal entries for live chat), and
  // native rows (Report, YouTube's own Block) stay untouched.
  //
  // The author id does NOT come from this response reliably: the Report
  // params embed the message author and the enclosing stream's channel in an
  // order that cannot be trusted (a user-verified misblock showed the stream
  // owner first), and logged-out/incognito popups omit Report/Block entirely
  // (no params to decode at all). The tapped message's own renderer
  // (authorExternalChannelId, snapshotted by the capture-phase tracker at `...`
  // press time) is the authoritative source and is stamped onto the row here,
  // while the native Block/Report params remain fallbacks for a missed click.
  // The row is appended even when YouTube's own rows are absent, which is the
  // incognito case.
  function addLiveChatContextMenus(resp) {
    startLiveChatMenuTracking();
    const menu = getObjectByPath(
      resp || {},
      'liveChatItemContextMenuSupportedRenderers.menuRenderer',
    );
    if (!menu || !Array.isArray(menu.items)) return;
    if (isWhitelistMenuMode()) return;
    if (!showMenuEntry(OPT.MENU_BLOCK_CHANNEL)) return;

    const items = menu.items;
    if (items.some(isOurLiveChatEntry)) return;

    // Keep the fallback decision in step with this response (see the fallback
    // timer notes): native rows mean YouTube's popup owns the surface, none
    // means our own row gets a short grace to render.
    syncLiveChatFallbackWithResponse(items);

    const anchor = freshLiveChatMenuAnchor();
    const channelId =
      (anchor && typeof anchor.id === 'string' && anchor.id) ||
      liveChatChannelIdFromMenuItems(items);
    if (!channelId) return;

    // Keep the author name when the anchor supplied the id: the block entry's
    // annotation and toast read better with it (the popup response carries no
    // name of its own).
    const payload =
      anchor && anchor.id === channelId && anchor.text
        ? { id: channelId, text: anchor.text }
        : { id: channelId };
    items.push(
      createStandardBlockItem('Block Channel', 'NOT_INTERESTED', payload, {
        isLiveChat: true,
      }),
    );
  }

  // Live-chat message renderers whose element data carries the author's
  // channel id (authorExternalChannelId), regardless of the message kind
  // (text, membership, Super Chat, Super Sticker). Shared by the click tracker
  // and the post-tap sweep.
  const LIVE_CHAT_MESSAGE_TAGS = [
    'yt-live-chat-text-message-renderer',
    'yt-live-chat-membership-item-renderer',
    'yt-live-chat-paid-message-renderer',
    'yt-live-chat-legacy-paid-message-renderer',
    'yt-live-chat-paid-sticker-renderer',
    'yt-live-chat-purchase-message-renderer',
  ];
  const LIVE_CHAT_MESSAGE_TAG_SET = new Set(LIVE_CHAT_MESSAGE_TAGS);

  // The message whose `...` press most recently opened a popup. Renderers
  // recycle, so the author id/name are snapshotted at press time — the element
  // reference would not survive until the response/tap. The TTL mirrors the
  // comment tracker: a popup only opens as an immediate consequence of a
  // press, so an older snapshot must not serve a popup whose press was missed.
  let liveChatMenuAnchor = null;
  const LIVE_CHAT_ANCHOR_TTL_MS = 5000;

  // The current anchor when it is still fresh enough for the popup being
  // processed; stale snapshots are dropped instead of blocking the wrong author.
  function freshLiveChatMenuAnchor() {
    if (!liveChatMenuAnchor) return null;
    try {
      if (Date.now() - liveChatMenuAnchor.time > LIVE_CHAT_ANCHOR_TTL_MS) {
        liveChatMenuAnchor = null;
        return null;
      }
    } catch (e) {
      return null;
    }
    return liveChatMenuAnchor;
  }

  // Authored-message data (text/membership/Super Chat renderers all carry
  // authorExternalChannelId + authorName) from one live-chat element. The
  // stored name drops YouTube's leading `@` handle marker: it is part of the
  // display handle, not the channel name (same normalization the comment menu
  // applies to annotations).
  function liveChatAuthorDataFromElement(el) {
    try {
      if (!el) return undefined;
      const data =
        el.data || (typeof el.getCurrentData === 'function' ? el.getCurrentData() : undefined);
      const id = data && data.authorExternalChannelId;
      if (typeof id !== 'string' || id.length === 0) return undefined;
      const rawText =
        getObjectByPath(data, 'authorName.simpleText') ||
        getObjectByPath(data, 'authorName.runs[0].text');
      const text =
        typeof rawText === 'string' ? rawText.replace(/^@+/, '').trim() || rawText : rawText;
      return { id, text };
    } catch (e) {
      return undefined;
    }
  }

  // Snapshot the author of the message whose `...` was just pressed. The popup
  // fetch is an immediate consequence of that press, so the snapshot owns the
  // response that follows. Capture phase, so it settles before YouTube's own
  // button handling.
  function noteLiveChatMenuAnchor(message) {
    const data = liveChatAuthorDataFromElement(message);
    liveChatMenuAnchor = data ? { ...data, time: Date.now() } : null;
  }

  // Event-path-aware message lookup for a `...` press. Chat menu buttons live
  // behind shadow roots, so `event.target` is retargeted to the host while
  // composedPath() still carries the inner button and the authored message.
  function liveChatMessageFromEventPath(path) {
    for (let i = 0; i < path.length; i += 1) {
      const node = path[i];
      if (!node || typeof node.tagName !== 'string') continue;
      if (LIVE_CHAT_MESSAGE_TAG_SET.has(node.tagName.toLowerCase())) return node;
    }
    return undefined;
  }

  // Find the menu/`...` button in a press path. Live chat labels it "Chat
  // actions" (localized, so the /more|action|menu/ match is only a bonus) on a
  // stable `yt-icon-button#menu-button`; the id and the icon-button tag are what
  // actually cover every locale. Undefined when the press is not on a menu
  // button (message body, username, popup row). The icon-button rule is scoped
  // by the caller to presses inside an authored message, where the only icon
  // buttons are chat actions (the `...`, plus pin/remove for moderators) — the
  // Super Sticker "Buy" control is a regular button and stays out.
  function liveChatMenuButtonFromEventPath(path) {
    for (let i = 0; i < path.length; i += 1) {
      const node = path[i];
      if (!node || typeof node.getAttribute !== 'function') continue;
      if (node.id === 'menu-button') return node;
      if (hasMenuLabel(node)) return node;
      const tag = typeof node.tagName === 'string' ? node.tagName.toLowerCase() : '';
      if (tag.includes('icon-button')) return node;
    }
    return undefined;
  }

  // Capture-phase tracker: a press inside an authored message snapshots that
  // message, so the popup fetch that follows (an immediate consequence of the
  // press) can stamp the row with the right author. Presses on the popup's own
  // rows are outside every message and deliberately leave the anchor alone —
  // clearing there is what made Block fall back to the stream-owner params. A
  // menu press outside any chat message still drops the anchor (video menus
  // also say "More actions"), so a stale author cannot serve that popup.
  function trackLiveChatMenuAnchor(event) {
    try {
      const path = eventPathOf(event);
      if (!path || path.length === 0) return;
      const message = liveChatMessageFromEventPath(path);
      const button = liveChatMenuButtonFromEventPath(path);
      if (message) {
        noteLiveChatMenuAnchor(message);
        // Logged-out/incognito chat omits every native action, and YouTube may
        // then not open its popup at all. Arm our own single-row menu; it only
        // appears if the native one did not open (see armLiveChatFallbackMenu).
        if (button) armLiveChatFallbackMenu(button, message);
        else cancelLiveChatFallbackPending();
      } else if (button) {
        liveChatMenuAnchor = null;
        cancelLiveChatFallbackPending();
      }
    } catch (e) {}
  }

  // One capture listener per frame, installed when storage arms the page
  // (hooks.js storageReceived) — NOT when the first popup response arrives:
  // that would leave the first `...` press untracked, and its popup would be
  // stamped from the untrustworthy Report params (stream-owner misblock).
  // Idempotent; addLiveChatContextMenus also calls it as a safety net.
  let liveChatTrackingInstalled = false;
  function startLiveChatMenuTracking() {
    if (liveChatTrackingInstalled) return;
    try {
      if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') {
        return;
      }
      liveChatTrackingInstalled = true;
      document.addEventListener('click', trackLiveChatMenuAnchor, true);
    } catch (e) {
      liveChatTrackingInstalled = false;
    }
  }

  // !! Live-chat fallback menu (logged-out/incognito)
  //
  // Incognito/logged-out chat omits Report and YouTube's own Block rows; there
  // the `...` press can end with no popup at all, so there is no menu to append
  // a row to. Deciding this on the press alone was wrong: a logged-in popup
  // response can take longer than any fixed press delay, so the fallback showed
  // first and the native menu replaced it a moment later. The pending decision
  // now follows the popup response:
  //   - response WITH rows  -> YouTube's popup is coming; stand down for good.
  //   - response with NONE  -> no native rows to render; show ours shortly,
  //                            unless a usable popup did open (our row may
  //                            have made an empty response renderable).
  //   - no response at all  -> show ours after a longer timeout.
  const LIVE_CHAT_FALLBACK_TIMEOUT_MS = 1500;
  const LIVE_CHAT_FALLBACK_RENDER_MS = 400;
  let liveChatFallbackPending = null;
  let liveChatFallbackMenu = null;

  function cancelLiveChatFallbackPending() {
    const pending = liveChatFallbackPending;
    liveChatFallbackPending = null;
    if (!pending) return;
    try {
      if (pending.timer) clearTimeout(pending.timer);
    } catch (e) {}
  }

  // (Re)arm the pending decision. Deliberately does NOT cancel the pending
  // record: a popup response that carries no rows shortens the wait instead.
  function scheduleLiveChatFallback(pending, delay) {
    try {
      if (pending.timer) clearTimeout(pending.timer);
    } catch (e) {}
    try {
      pending.timer = setTimeout(function () {
        if (liveChatFallbackPending !== pending) return;
        liveChatFallbackPending = null;
        if (liveChatNativeMenuOpen()) return;
        showLiveChatFallbackMenu(pending.button, pending.author);
      }, delay);
    } catch (e) {
      liveChatFallbackPending = null;
    }
  }

  // Fold one popup response into the pending decision: rows mean the native
  // popup will render (and already carries our appended row), so the fallback
  // stands down for good — this is what stops the menu flashing over a
  // perfectly good native popup whose fetch was just slow. A row-less response
  // is the logged-out/incognito case: our appended row may be the only thing
  // that makes YouTube render the popup, so shorten the wait and re-check.
  function syncLiveChatFallbackWithResponse(items) {
    if (items.length > 0) {
      cancelLiveChatFallbackPending();
      closeLiveChatFallbackMenu();
    } else if (liveChatFallbackPending) {
      scheduleLiveChatFallback(liveChatFallbackPending, LIVE_CHAT_FALLBACK_RENDER_MS);
    }
  }

  function closeLiveChatFallbackMenu() {
    const open = liveChatFallbackMenu;
    liveChatFallbackMenu = null;
    if (!open) return;
    try {
      if (open.cleanup) open.cleanup();
    } catch (e) {}
    try {
      if (open.root && typeof open.root.remove === 'function') open.root.remove();
    } catch (e) {}
  }

  // A visible *usable* native menu popup in this document. Live chat renders
  // its actions menu with YouTube's usual popup wrappers; a visible one that
  // actually carries rows means the press worked and our fallback must stay out
  // of the way. The row requirement matters for the failed incognito case: an
  // empty popup shell can be laid out (and would otherwise suppress the
  // fallback, leaving the user with a blank menu). `except` skips our own
  // fallback root (which also carries role="menu").
  const LIVE_CHAT_MENU_ROW_SELECTOR = [
    'ytd-menu-service-item-renderer',
    'ytd-menu-navigation-item-renderer',
    'tp-yt-paper-item',
    '[role="menuitem"]',
    '[role="menuitemradio"]',
  ].join(', ');

  function liveChatNativeMenuOpen(except) {
    try {
      if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') {
        return false;
      }
      const nodes = document.querySelectorAll(
        'ytd-menu-popup-renderer, tp-yt-iron-dropdown, [role="menu"]',
      );
      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        if (node === except) continue;
        try {
          if (node.getAttribute && node.getAttribute('aria-hidden') === 'true') continue;
          const rect =
            typeof node.getBoundingClientRect === 'function' ? node.getBoundingClientRect() : null;
          if (!rect || rect.width <= 0 || rect.height <= 0) continue;
          const rows =
            typeof node.querySelector === 'function'
              ? node.querySelector(LIVE_CHAT_MENU_ROW_SELECTOR)
              : null;
          if (rows) return true;
        } catch (e) {}
      }
    } catch (e) {}
    return false;
  }

  function positionLiveChatFallbackMenu(root, button) {
    try {
      const margin = 8;
      const rect =
        button && typeof button.getBoundingClientRect === 'function'
          ? button.getBoundingClientRect()
          : null;
      const width = root.offsetWidth || 160;
      const height = root.offsetHeight || 40;
      const vw = window.innerWidth || (document.documentElement || {}).clientWidth || 0;
      const vh = window.innerHeight || (document.documentElement || {}).clientHeight || 0;
      let left = rect ? rect.left : margin;
      let top = rect ? rect.bottom + 4 : margin;
      if (rect && vh > 0 && top + height > vh - margin) top = rect.top - height - 4;
      if (vw > 0) left = Math.min(left, vw - width - margin);
      left = Math.max(margin, left);
      top = Math.max(margin, top);
      root.style.left = `${Math.round(left)}px`;
      root.style.top = `${Math.round(top)}px`;
    } catch (e) {}
  }

  // Post the same block payload the native-row tap produces, then run the same
  // visible effect (toast + sweep of the author's already-rendered messages).
  function blockLiveChatAuthor(author) {
    if (!author || typeof author.id !== 'string' || author.id.length === 0) return;
    try {
      if (window.blockTubeReloadRequired) {
        window.blockTubeExports.openToast(
          BLOCKTUBE_CONSTS.TOASTS.RELOAD_REQUIRED,
          5000,
        );
        return;
      }
    } catch (e) {}
    postMessage(BLOCKTUBE_CONSTS.MESSAGES.CONTEXT_BLOCK_DATA, {
      type: BLOCKTUBE_CONSTS.BLOCK_TYPES.CHANNEL,
      info: { id: author.id, text: author.text, via: BLOCKTUBE_CONSTS.VIA.LIVE_CHAT },
    });
    applyLiveChatTapEffect(BLOCKTUBE_CONSTS.BLOCK_TYPES.CHANNEL, author);
  }

  // Fallback menu chrome, styled to sit on YouTube's popup surface in the
  // current theme (the chat frame carries `dark` on <html> in dark mode).
  function styleLiveChatFallbackRoot(root, dark) {
    root.style.position = 'fixed';
    root.style.zIndex = '2147483000';
    root.style.minWidth = '160px';
    root.style.padding = '4px 0';
    root.style.background = dark ? '#282828' : '#ffffff';
    root.style.color = dark ? '#f1f1f1' : '#0f0f0f';
    root.style.border = `1px solid ${dark ? '#3f3f3f' : '#e5e5e5'}`;
    root.style.borderRadius = '8px';
    root.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.3)';
    root.style.font = '14px Roboto, Arial, sans-serif';
  }

  function createLiveChatFallbackRow(dark, onActivate) {
    const row = document.createElement('button');
    row.type = 'button';
    row.setAttribute('role', 'menuitem');
    row.textContent = 'Block Channel';
    row.style.display = 'block';
    row.style.width = '100%';
    row.style.padding = '10px 16px';
    row.style.background = 'transparent';
    row.style.color = 'inherit';
    row.style.border = '0';
    row.style.textAlign = 'left';
    row.style.cursor = 'pointer';
    row.style.font = 'inherit';
    row.style.whiteSpace = 'nowrap';
    const setHover = (on) => {
      try {
        row.style.background = on ? (dark ? '#3f3f3f' : '#f2f2f2') : 'transparent';
      } catch (e) {}
    };
    row.addEventListener('mouseenter', () => setHover(true));
    row.addEventListener('mouseleave', () => setHover(false));
    row.addEventListener('click', onActivate);
    return row;
  }

  // Dismissal wiring: Escape, a press outside the panel, remount/resize, and a
  // watcher that yields to a native popup landing late. Returns the cleanup
  // closeLiveChatFallbackMenu() runs.
  function wireLiveChatFallbackDismissal(root) {
    const onDocClick = function (event) {
      try {
        if (root.contains && typeof root.contains === 'function' && root.contains(event.target)) {
          return;
        }
      } catch (e) {}
      closeLiveChatFallbackMenu();
    };
    const onKey = function (event) {
      if (event && (event.key === 'Escape' || event.key === 'Esc')) closeLiveChatFallbackMenu();
    };
    document.addEventListener('click', onDocClick, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', closeLiveChatFallbackMenu);
    // A slow native popup can still land after the fallback appeared; close
    // ours the moment a real popup becomes visible underneath/over it.
    let watch = 0;
    try {
      watch = setInterval(function () {
        if (liveChatNativeMenuOpen(root)) closeLiveChatFallbackMenu();
      }, 250);
    } catch (e) {}
    return function cleanup() {
      document.removeEventListener('click', onDocClick, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', closeLiveChatFallbackMenu);
      try {
        if (watch) clearInterval(watch);
      } catch (e) {}
    };
  }

  // Fallback row activation: exactly the payload/effect a native-row tap
  // produces, then close our menu first so the sweep/toast runs on a clean UI.
  function activateLiveChatFallback(author, event) {
    try {
      event.preventDefault();
      event.stopPropagation();
    } catch (e) {}
    closeLiveChatFallbackMenu();
    blockLiveChatAuthor(author);
  }

  function showLiveChatFallbackMenu(button, author) {
    closeLiveChatFallbackMenu();
    try {
      if (typeof document === 'undefined' || !document.body) return;
      if (!author || typeof author.id !== 'string' || author.id.length === 0) return;
      const dark = pagePrefersDark();
      const root = document.createElement('div');
      root.setAttribute('role', 'menu');
      root.setAttribute('aria-label', 'Chat actions');
      styleLiveChatFallbackRoot(root, dark);
      const row = createLiveChatFallbackRow(dark, (event) => activateLiveChatFallback(author, event));
      root.appendChild(row);
      document.body.appendChild(root);
      positionLiveChatFallbackMenu(root, button);
      liveChatFallbackMenu = {
        root,
        button,
        cleanup: wireLiveChatFallbackDismissal(root),
      };
      try {
        row.focus({ preventScroll: true });
      } catch (e) {}
    } catch (e) {}
  }

  // Two path nodes identifying the same `...` trigger. The tracker may return
  // the icon-button host on one press and its inner button on the next, so a
  // strict identity check would miss the toggle.
  function sameMenuTrigger(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    try {
      if (typeof a.contains === 'function' && a.contains(b)) return true;
      if (typeof b.contains === 'function' && b.contains(a)) return true;
    } catch (e) {}
    return false;
  }

  function armLiveChatFallbackMenu(button, message) {
    if (isWhitelistMenuMode()) return;
    if (!showMenuEntry(OPT.MENU_BLOCK_CHANNEL)) return;
    // Pressing the same `...` again dismisses our menu, mirroring how the
    // native popup toggles off. Escape and outside clicks also close it.
    if (liveChatFallbackMenu && sameMenuTrigger(liveChatFallbackMenu.button, button)) {
      cancelLiveChatFallbackPending();
      closeLiveChatFallbackMenu();
      return;
    }
    const author = liveChatAuthorDataFromElement(message);
    if (!author) return;
    cancelLiveChatFallbackPending();
    closeLiveChatFallbackMenu();
    const pending = { author, button };
    liveChatFallbackPending = pending;
    scheduleLiveChatFallback(pending, LIVE_CHAT_FALLBACK_TIMEOUT_MS);
  }

  function deepClone(obj) {
    // Simple deep clone (for plain objects, no functions/cycles)
    return JSON.parse(JSON.stringify(obj));
  }

  function addContextMenus(obj, keys, root) {
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
      attr,
      root || obj,
    );

    // Reactive renderers re-render on property assignment, not in-place array mutation:
    // if the reel popup bound the items array before our push (eager pre-render), a plain
    // push stays invisible while the data looks right. Replacing the array reference notifies
    // Polymer (property change) and Lit-style renderers (property set) alike; lazy readers see
    // the same contents either way. Shelf sheets render lazily on open, so only reel surfaces need this.
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

  // Our own toast layer: the legacy yt-action dispatch below no longer surfaces a visible
  // toast on current YouTube, so taps relying on it confirmed with no feedback at all (the
  // "Channel Allowed" on some surfaces comes from the executed menu command itself — a
  // different system). This fixed-position div is styled property-by-property through CSSOM
  // only (no <style>, no innerHTML), so page CSP and Trusted Types stay out of the way;
  // pointer-events:none so it can never swallow clicks.
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

  // Map an injected menu action to its block-list type. Undefined for unknown
  // actions (the tap is ignored). Shared by mobile rows and desktop injected
  // entries, which both carry `_btMenuAction` on the renderer data.
  function menuActionToBlockType(menuAction) {
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

  // Mobile video-page taps confirm with an alert and stop playback for
  // blocks/removals. Allowlists keep playback going.
  function confirmSlimVideoTap(type) {
    // Allowlists keep playback going; blocks and removals stop it.
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

  // Runtime comment filtering mirrors the blacklist path only: allowlist
  // taps must never push the commenter into the channelId blacklist.
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
        BLOCKTUBE_CONSTS.TOASTS.RELOAD_REQUIRED,
        5000,
      );
      return;
    }

    const data = getObjectByPath(this, '__instance.props.data') || this.data;
    if (!data || !data._btOriginalData) {
      return;
    }

    const type = menuActionToBlockType(data._btMenuAction);
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
  const PLAYER_MENU_TAGS = new Set(['YTD-VIDEO-PRIMARY-INFO-RENDERER', 'YTD-WATCH-METADATA']);

  // The live owner renderer's data (`videoOwnerRenderer`). Both the tap path
  // and the injection-time pair lookup read it; YouTube nests the renderer
  // under videoOwnerRenderer but accept a direct shape too.
  function ownerRendererData() {
    const ownerRenderer = document.getElementsByTagName('ytd-video-owner-renderer')[0];
    const owner = ownerRenderer?.data || ownerRenderer?.getCurrentData?.();
    return owner?.videoOwnerRenderer || owner;
  }

  // Watch-page owner renderer anywhere in the response being filtered. Menu
  // injection runs before the page renders, and the primary info renderer sits
  // in a different branch than the secondary info renderer that holds the
  // owner — so neither the sibling lookup nor the DOM is available yet. The
  // walk is cached per response root: one scan, not one per renderer.
  const ownerRendererCache = new WeakMap();

  function findOwnerRendererData(root) {
    if (!root || typeof root !== 'object') return undefined;
    if (ownerRendererCache.has(root)) return ownerRendererCache.get(root);
    const found = searchOwnerRenderer(root, 0);
    ownerRendererCache.set(root, found);
    return found;
  }

  function searchOwnerRenderer(node, depth) {
    if (!node || typeof node !== 'object' || depth > 20) return undefined;
    if (!(node instanceof Array) && has.call(node, 'videoOwnerRenderer')) {
      return node.videoOwnerRenderer;
    }
    const keys = Object.keys(node);
    for (let i = 0; i < keys.length; i += 1) {
      const value = node[keys[i]];
      if (!value || typeof value !== 'object') continue;
      const found = searchOwnerRenderer(value, depth + 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  // Resolve channel/video from the now-playing player + owner renderers. The
  // player payload carries only the first creator, so a collaboration video
  // also contributes every channel from the owner's "Collaborators" dialog.
  // One Block Channel tap therefore blocks the whole collab, matching a feed
  // card tap (see lockupChannelFrom) and a channel selection. `channels` keeps
  // the dialog's id/name pairing for individual creator entries (see
  // channelBlockEntries).
  function playerMenuBlockData() {
    const pageManager = document.getElementsByTagName('ytd-page-manager')[0];
    const playerData = pageManager && (pageManager.data || pageManager.getCurrentData?.());
    const player = playerData && playerData.playerResponse;

    const ownerData = ownerRendererData();
    const ownerUCID = getObjectByPath(
      ownerData,
      'title.runs[0].navigationEndpoint.browseEndpoint.browseId',
    );
    const collaboratorIds = getCollaboratorChannelIds(
      ownerData,
      OWNER_COLLAB_LIST_ITEMS_PATHS,
    );
    const collaboratorNames = getCollaboratorChannelNames(
      ownerData,
      OWNER_COLLAB_LIST_ITEMS_PATHS,
    );

    // A menu can be prepared before the player/owner data lands (watch data
    // is filtered before the page renders). Fail open with nothing blockable
    // rather than throwing; the tap re-resolves this at click time.
    const details = (player && player.videoDetails) || {};
    return {
      channelData: {
        text: singleOrAll([details.author, ...collaboratorNames]),
        id: singleOrAll([details.channelId, ownerUCID, ...collaboratorIds]),
      },
      channels: watchChannelPairs(ownerData),
      videoData: {
        text: details.title,
        id: details.videoId,
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
      channels: usableChannelPairs(parentData.blockTube?.metadata?.channels),
      videoData,
      removeParent: false,
      stopPlayer: false,
      isShorts: parentData.blockTube?.metadata?.isShorts === true,
      isWatch,
    };
  }

  // Resolve channel/video through the rule paths for the menu's renderer.
  function ruleMenuBlockData(parentData) {
    const data = parentData || {};
    const extracted = channelAndVideoFrom(data, data._btOriginalAttr);
    // Only the lockup avatar-stack dialog supplies reliable pairs; generic
    // renderers' id/name rule arrays are collected independently, so zipping
    // them could block the wrong creator. No pairs means no individual rows.
    const channels =
      data._btOriginalAttr === 'lockupViewModel' ? lockupChannelsFrom(data) : [];
    return {
      channelData: extracted.channel,
      videoData: extracted.video,
      channels,
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
      case 'Block All Channels':
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

  // Resolve what the surface behind a tapped menu row describes: the player
  // context (DOM), a stamped lockup sheet, or the rule paths. Shared by the
  // label switch and the injected-entry path (which carries its own payload
  // but still needs nothing else). Undefined only for a missing parent.
  function resolveMenuBlockData(parentDom, parentData, isDataFromRightHandSide) {
    if (parentDom && PLAYER_MENU_TAGS.has(parentDom.tagName)) {
      return playerMenuBlockData();
    }
    if (isDataFromRightHandSide) return stampedMenuBlockData(parentData);
    return ruleMenuBlockData(parentData);
  }

  function getBlockData(parentDom, parentData, isDataFromRightHandSide, menuAction) {
    const resolved = resolveMenuBlockData(parentDom, parentData, isDataFromRightHandSide);
    const result = menuLabelToBlockTarget(
      menuAction,
      resolved.channelData,
      resolved.videoData,
    );
    if (!result) return null;

    return {
      ...result,
      removeParent: resolved.removeParent,
      stopPlayer: resolved.stopPlayer,
      isShorts: resolved.isShorts === true,
      isWatch: resolved.isWatch === true,
      channels: resolved.channels || [],
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
    if (!parentDom) {
      console.warn('Failed to extract parentDom or parentData');
      return {};
    }
    // Player-tag menus resolve their data from the live page, not from this
    // component, so a parent without data is still a usable anchor.
    return { parentDom, parentData: parentDom.data || {} };
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
  const PARENT_NODE_REMOVE_TAGS = new Set([
    'YTD-BACKSTAGE-POST-RENDERER',
    'YTD-POST-RENDERER',
  ]);
  const SELF_REMOVE_TAGS = new Set([
    'YTD-PLAYLIST-PANEL-VIDEO-RENDERER',
    'YTD-MOVIE-RENDERER',
  ]);

  function removeParentHelper(isDataFromRightHandSide, parentDom, message = 'Blocked') {
    if (PARENT_NODE_REMOVE_TAGS.has(parentDom.tagName)) {
      parentDom.parentNode.remove();
    } else if (SELF_REMOVE_TAGS.has(parentDom.tagName)) {
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
  const MENU_TAP_ACTIONS = new Set([
    'Block Channel',
    'Block All Channels',
    'Block Video',
    'Allow Channel',
    'Remove from Whitelist',
  ]);

  // Menu-tap types that take the card off the page (allow taps keep it so it
  // can be watched right away).
  function isCardRemovingTap(type) {
    return (
      type === BLOCKTUBE_CONSTS.BLOCK_TYPES.CHANNEL ||
      type === BLOCKTUBE_CONSTS.BLOCK_TYPES.VIDEO ||
      type === BLOCKTUBE_CONSTS.BLOCK_TYPES.UNALLOW
    );
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

  // Shorts shelf cards have no native hide affordance — their sheet holds only "Add to
  // queue" / "Send feedback", so the cloned feedback command that dismisses lockup cards
  // leaves a Shorts card in place. Dismiss it from the DOM instead: the card links to
  // /shorts/<videoId>, so the grid item wrapping that link gets the same "Blocked" placeholder
  // other surfaces show, plus display:none where that mechanism does not render. Fail-open:
  // any miss leaves the card for the next data load, already covered by the just-added filter entry.
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
      links = document.querySelectorAll(
        `a[href*="${BLOCKTUBE_CONSTS.SHORTS.PATH_PREFIX}${videoId}"]`,
      );
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
    if (type === BLOCKTUBE_CONSTS.BLOCK_TYPES.UNALLOW) {
      if (removeParent) {
        // Remove correct component based on parentDom
        removeParentHelper(isDataFromRightHandSide, parentDom, 'Removed from whitelist');
      } else if (stopPlayer) {
        // The player element may already be gone (menu opened from a cached
        // or prefetched payload); stopping playback is best-effort.
        document.getElementById('movie_player')?.stopVideo();
      }
    } else if (type !== BLOCKTUBE_CONSTS.BLOCK_TYPES.ALLOW) {
      if (removeParent) {
        // Remove correct component based on parentDom
        removeParentHelper(isDataFromRightHandSide, parentDom);
      } else if (stopPlayer) {
        document.getElementById('movie_player')?.stopVideo();
      }
    }
  }

  // Best-effort removal of one author's already-rendered messages from the
  // current chat. Messages fetched afterwards are covered by the new filter
  // rule through the normal get_live_chat path. Fail-open: a sweep miss simply
  // leaves older rows to the next data load.
  function sweepLiveChatAuthor(channelId) {
    if (
      !channelId ||
      typeof document === 'undefined' ||
      typeof document.querySelectorAll !== 'function'
    ) {
      return;
    }
    let nodes;
    try {
      nodes = document.querySelectorAll(LIVE_CHAT_MESSAGE_TAGS.join(','));
    } catch (e) {
      return;
    }
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      try {
        const item =
          node.data ||
          (typeof node.getCurrentData === 'function' ? node.getCurrentData() : undefined);
        if (
          item &&
          item.authorExternalChannelId === channelId &&
          typeof node.remove === 'function'
        ) {
          node.remove();
        }
      } catch (e) {}
    }
  }

  // Visible effect of a live-chat "Block Channel" tap: a toast plus the sweep
  // above (the popup closes on selection, which is YouTube's own feedback).
  function applyLiveChatTapEffect(type, data) {
    try {
      openToast('Channel blocked', 3000);
    } catch (e) {}
    if (type !== BLOCKTUBE_CONSTS.BLOCK_TYPES.CHANNEL) return;
    sweepLiveChatAuthor(data && typeof data.id === 'string' ? data.id : undefined);
  }

  // Forward the tap to YouTube's own handler when the menu entry carries a
  // service endpoint (native feedback flow).
  function forwardMenuTap(event) {
    if (this.data.serviceEndpoint) {
      if (this.onTap) this.onTap(event);
      else if (this.onTap_) this.onTap_(event);
    }
  }

  // Shorts-tap feedback for a card-removing tap: watch-page taps paint the
  // reason panel over the player, shelf taps dismiss the card. Shorts taps
  // resolve through the stamped sheet path (isShorts) or the generic rule
  // path via _btOriginalAttr — both must confirm and dismiss.
  function dismissShortsTap(type, data, parentData, isShorts, isWatch) {
    const isShortsTap = isShorts || parentData?._btOriginalAttr === 'shortsLockupViewModel';
    if (!isShortsTap || !isCardRemovingTap(type)) return;
    if (isWatch) {
      applyWatchBlockEffect(type, data, parentData);
    } else {
      dismissShortsShelfCard(
        shortsTapVideoId(parentData, type, data),
        type === BLOCKTUBE_CONSTS.BLOCK_TYPES.UNALLOW ? 'Removed from whitelist' : 'Blocked',
      );
    }
  }

  // The custom payload carried by an injected per-creator entry, read off the
  // tapped renderer element. youtube binds the click to the renderer and
  // exposes its data as `data` (mobile taps already rely on this); accept the
  // wrapped shapes too so a renderer change cannot silently drop the payload.
  function injectedMenuEntry(context) {
    const data = getObjectByPath(context, '__instance.props.data') || context?.data;
    if (!data) return null;
    let entry = data;
    if (!entry._btOriginalData) {
      if (data.menuServiceItemRenderer) entry = data.menuServiceItemRenderer;
      else if (data.listItemViewModel) entry = data.listItemViewModel;
    }
    if (!entry || !entry._btOriginalData || !entry._btMenuAction) return null;
    return {
      action: entry._btMenuAction,
      data: entry._btOriginalData,
      effect: entry._btEffect,
    };
  }

  function menuOnTap(event) {
    if (storageData === undefined) return;

    const { isDataFromRightHandSide, menuAction } = getActionMenuData(this);
    const injected = injectedMenuEntry(this);
    const individualLabel =
      typeof menuAction === 'string' && menuAction.startsWith(INDIVIDUAL_LABEL_PREFIX);

    if (!injected && !MENU_TAP_ACTIONS.has(menuAction) && !individualLabel) {
      event.preventDefault();
      return;
    }

    if (window.blockTubeReloadRequired) {
      window.blockTubeExports.openToast(
        BLOCKTUBE_CONSTS.TOASTS.RELOAD_REQUIRED,
        5000,
      );
      return;
    }

    // Get the parent dom and data from this
    const { parentDom, parentData } = getParentDomAndData(isDataFromRightHandSide, this);

    // Injected creator entries carry their own single-channel payload + card
    // effect; native entries resolve through the surface (live player data,
    // stamped sheet, or rule paths). The label fallback keeps a creator entry
    // working even when the renderer dropped the custom fields.
    let target;
    let effect;
    if (injected) {
      target = {
        type: menuActionToBlockType(injected.action),
        data: injected.data,
      };
      effect = injected.effect || {};
    } else {
      const resolved = resolveMenuBlockData(
        parentDom,
        parentData,
        isDataFromRightHandSide,
      );
      effect = resolved;
      target = menuLabelToBlockTarget(
        menuAction,
        resolved.channelData,
        resolved.videoData,
      );
      if (!target && individualLabel) {
        const channel = individualChannelFromLabel(resolved.channels, menuAction);
        if (channel) {
          target = { type: BLOCKTUBE_CONSTS.BLOCK_TYPES.CHANNEL, data: channel };
        }
      }
    }

    if (!target || target.type === undefined) {
      event.preventDefault();
      return;
    }

    // Live-chat popup taps: the row was already stamped with the tapped
    // message's author at injection time (the `...` click anchor), and this
    // tap-time override covers a replay/preloaded response that was enriched
    // before the anchor settled. The popup's own Report params are never
    // trusted first: they can carry the stream owner (user-verified misblock).
    if (effect && effect.isLiveChat === true) {
      const live = freshLiveChatMenuAnchor();
      if (live && typeof live.id === 'string' && live.id.length > 0) {
        target = { type: target.type, data: { id: live.id, text: live.text } };
      }
    }

    const { type, data } = target;
    const removeParent = effect.removeParent === true;
    const stopPlayer = effect.stopPlayer === true;
    const isShorts = effect.isShorts === true;
    const isWatch = effect.isWatch === true;

    // Notify system what data should be added to the block list. Shorts and
    // live-chat taps carry their provenance along: the options-page entry then
    // reads "Blocked by short context menu" / "Blocked by live chat menu"
    // instead of "context menu", so the surface a block came from stays visible.
    let blockInfo = data;
    if (isShorts || isWatch) blockInfo = { ...data, via: BLOCKTUBE_CONSTS.VIA.SHORTS };
    else if (effect && effect.isLiveChat === true) {
      blockInfo = { ...data, via: BLOCKTUBE_CONSTS.VIA.LIVE_CHAT };
    }
    postMessage(BLOCKTUBE_CONSTS.MESSAGES.CONTEXT_BLOCK_DATA, { type, info: blockInfo });

    applyMenuTapEffect(type, removeParent, stopPlayer, isDataFromRightHandSide, parentDom);
    dismissShortsTap(type, data, parentData, isShorts, isWatch);
    // Live-chat popup taps: toast + sweep of already-rendered messages from
    // the author just blocked (future fetches filter through the new rule).
    if (effect && effect.isLiveChat === true) applyLiveChatTapEffect(type, data);
    // Forward the tap to YouTube's own handler, except on the Shorts watch
    // page: reel entries clone a native row purely so the popup renders them,
    // and their command is neutralized at clone time — but never execute
    // anything borrowed here, so a Block tap can never open
    // Description/Save/... .
    if (!isWatch) forwardMenuTap.call(this, event);
  }

  // Visible effect of blocking the playing Short: the tap lands after the player response
  // already played, so the filter path (disablePlayer → overlay + skip) never runs for it.
  // Reproduce it here: pause first (audio stops at once), paint the reason panel over the
  // player root, then arm the same auto-advance sweep a filtered response would. When skip is
  // off or capped, pause + panel are the whole effect — the short stays covered and silent.
  // Fail-open; called only for card-removing taps (channelId/videoId/unwhitelist — see isCardRemovingTap), so allow taps never reach here.
  // Video id for a watch-page block tap: tap payload first, live Short
  // second, stamped card metadata last. Undefined when nothing resolves.
  function watchBlockVideoId(type, data, live, stamp) {
    const id =
      (type === BLOCKTUBE_CONSTS.BLOCK_TYPES.VIDEO &&
        data &&
        typeof data.id === 'string' &&
        data.id) ||
      (typeof live.id === 'string' && live.id) ||
      (typeof stamp.videoId === 'string' && stamp.videoId) ||
      undefined;
    return typeof id === 'string' && id.length > 0 ? id : undefined;
  }

  // Full attribution for the overlay panel + skip sweep from one tap.
  // Undefined when no video id resolves (nothing to paint or advance to).
  function watchBlockAttribution(type, data, parentData) {
    const live = currentShortsVideo();
    const stamp = (parentData && parentData.blockTube && parentData.blockTube.metadata) || {};
    const videoId = watchBlockVideoId(type, data, live, stamp);
    if (videoId === undefined) return undefined;
    const isVideo = type === BLOCKTUBE_CONSTS.BLOCK_TYPES.VIDEO;
    return {
      videoId,
      channelId:
        (!isVideo && data && typeof data.id === 'string' && data.id) ||
        (typeof stamp.channelId === 'string' && stamp.channelId) ||
        undefined,
      channelName: (!isVideo && data && data.text) || stamp.channelName || undefined,
      title: (isVideo && data && data.text) || live.text || stamp.videoName,
      message: isVideo ? 'Video Blocked' : 'Channel Blocked',
    };
  }

  function applyWatchBlockEffect(type, data, parentData) {
    try {
      pauseReelPlayer();
    } catch (e) {}
    if (type === BLOCKTUBE_CONSTS.BLOCK_TYPES.UNALLOW) return;
    let target;
    let message;
    let videoId;
    try {
      const attribution = watchBlockAttribution(type, data, parentData);
      if (attribution === undefined) return;
      ({ message, ...target } = attribution);
      videoId = attribution.videoId;
    } catch (e) {
      return;
    }
    // Kept separate: the overlay must still attempt the skip when painting
    // throws, and vice versa.
    try {
      showBlockedShortOverlay(target, message);
    } catch (e) {}
    try {
      skipBlockedShort(videoId);
    } catch (e) {}
  }

  // Video id of a shelf Shorts tap for the dismissal lookup: stamped metadata
  // first; on the rule branch re-resolve through the Shorts rule (a Block
  // Video tap already carries it as its payload).
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
