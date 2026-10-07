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
        serviceEndpoint: {
          commandMetadata: {
            webCommandMetadata: {
              sendPost: true,
              apiUrl: 'data:text/plain;base64,Cg==',
            },
          },
          feedbackEndpoint: {
            uiActions: {
              hideEnclosingContainer: hideContainer,
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

  // The channel and video a renderer describes, resolved through its filter
  // rule paths. Both block entries ("Block Channel" / "Block Video") carry
  // this pair as _btOriginalData for menuOnTap to consume later.
  function channelAndVideoFrom(parentData, attrKey) {
    if (attrKey === 'lockupViewModel') {
      return { channel: lockupChannelFrom(parentData), video: lockupVideoFrom(parentData) };
    }
    const searchIn = mergedFilterRules[attrKey]?.properties;
    return {
      channel: {
        id: getFlattenByPath(parentData, searchIn?.channelId),
        text: getFlattenByPath(parentData, searchIn?.channelName),
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
  // fills the rest.
  function lockupChannelFrom(renderer) {
    const searchIn = mergedFilterRules.lockupViewModel?.properties;
    return {
      id: getFlattenByPath(renderer, searchIn?.channelId) || pageChannel?.id,
      text: getFlattenByPath(renderer, searchIn?.channelName) || pageChannel?.name,
    };
  }

  function lockupVideoFrom(renderer) {
    const searchIn = mergedFilterRules.lockupViewModel?.properties;
    return {
      id: getFlattenByPath(renderer, searchIn?.videoId),
      text: getFlattenByPath(renderer, searchIn?.title),
    };
  }

  function addContextMenusMobile(obj, keys) {
    const attr = resolveContextMenuAttr(obj, keys);
    if (attr === undefined) return;

    const parentData = obj[attr];
    const { channel: channelData, video: videoData } = channelAndVideoFrom(parentData, attr);

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
      const allowMode = isWhitelistMenuMode();
      if (allowMode) {
        // Whitelist mode: the visible cards are already allowlisted, so an
        // "Allow Channel" entry would be pointless — offer removal instead.
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
        return;
      }
      // Block mode additionally offers allowlisting, so the allowlist can be
      // built while browsing normally.
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
    } else if (attr === 'slimVideoMetadataSectionRenderer') {
      // Mobile Video page: the action bar under the video uses a different
      // renderer (slimMetadataButtonRenderer) than the menu-entry type above.
      const items = obj[attr].contents;
      if (!items) return;
      const allowMode = isWhitelistMenuMode();
      const channelButtons = allowMode
        ? [
            {
              action: 'unallow_channel',
              label: 'Remove from Whitelist',
            },
          ]
        : [
            {
              action: 'block_channel',
              label: 'Block Channel',
              option: OPT.MENU_BLOCK_CHANNEL,
            },
            {
              action: 'allow_channel',
              label: 'Allow Channel',
              option: OPT.MENU_ALLOW_CHANNEL,
            },
          ].filter(({ option }) => option === undefined || showMenuEntry(option));
      const videoButton = {
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
      };
      const channelButtonsRendered = channelButtons.map(({ action, label }) => ({
        slimMetadataButtonRenderer: {
          button: {
            buttonRenderer: {
              _btOriginalData: channelData,
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
              navigationEndpoint: {
                commandMetadata: { webCommandMetadata: { ignoreNavigation: true } },
                urlEndpoint: {},
              },
            },
          },
        },
      }));
      const mobileVideoMenu = {
        slimVideoActionBarRenderer: {
          buttons: [
            // Videos can't be allowlisted: no video button in whitelist mode.
            ...(allowMode || !showMenuEntry(OPT.MENU_BLOCK_VIDEO) ? [] : [videoButton]),
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
      const imgName = getObjectByPath(obj[attr], LOCKUP_BADGE_ICON_PATH);
      // YouTube-generated collections (Mixes, Courses): neither a real video nor
      // a real channel, so there is nothing meaningful to add to the filters.
      if (imgName === undefined || !LOCKUP_GENERATED_BADGE_ICONS.has(imgName)) {
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

  function createCleanContext(items, store, isChannel, currentObj, forAllow = false, forRemove = false) {
    // Allow/remove entries must never reuse YouTube's native command: it
    // hides the card (the home-grid removal reported for Allow taps). They
    // always get a clone with the matching toast and hide flag, regardless
    // of the block_feedback option. Real block entries keep the identity
    // fast-path so YouTube's own feedback flow keeps working.
    if (!forAllow && !forRemove && store.options[OPT.BLOCK_FEEDBACK] && items.length > 0) {
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

    const msg = !isChannel
      ? 'Video Blocked'
      : forRemove
        ? 'Removed from whitelist'
        : forAllow || isWhitelistMenuMode(store)
          ? 'Channel Allowed'
          : 'Channel Blocked';
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
              // Allow entries keep the card in place; removals and blocks
              // hide it.
              hideEnclosingContainer: !forAllow || forRemove,
            },
            // No confirmation popups: allow/remove entries execute silently
            // (their hide flag above is the only native effect). Real block
            // entries keep the toast.
            actions:
              forAllow || forRemove
                ? []
                : [
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

    injectBlockMenuItems(items, hasChannel, hasVideo, isLockupViewModel, obj[attr], storageData);

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

  function showDomToast(msg, duration) {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
    let el = null;
    if (typeof document.getElementById === 'function') {
      el = document.getElementById('blocktube-toast');
    }
    if (!el) {
      el = document.createElement('div');
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
    }
    el.textContent = msg;
    el.style.display = 'block';
    if (typeof clearTimeout === 'function') clearTimeout(toastTimer);
    if (typeof setTimeout === 'function') {
      toastTimer = setTimeout(() => {
        el.style.display = 'none';
      }, duration);
    }
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

  function legacyToast(msg, duration) {
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
      case 'allow_channel': {
        type = 'whitelist';
        break;
      }
      case 'unallow_channel': {
        type = 'unwhitelist';
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
      // Allowlists keep playback going; blocks and removals stop it.
      if (type !== 'whitelist') document.getElementById('movie_player').stopVideo();
      const noun = type === 'videoId' ? 'Video' : 'Channel';
      const verb =
        type === 'whitelist' ? 'Allowed' : type === 'unwhitelist' ? 'Removed' : 'Blocked';
      alert(`${noun} ${verb}`);
    }
    // Runtime comment filtering mirrors the blacklist path only: allowlist
    // taps must never push the commenter into the channelId blacklist.
    if (type === 'channelId' && data._btOriginalAttr === 'commentRenderer') {
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
      const extracted = channelAndVideoFrom(parentData, parentData._btOriginalAttr);
      channelData = extracted.channel;
      videoData = extracted.video;
    }

    let result;
    switch (menuAction) {
      case 'Block Channel':
        result = { type: 'channelId', data: channelData };
        break;
      case 'Allow Channel':
        result = { type: 'whitelist', data: channelData };
        break;
      case 'Remove from Whitelist':
        result = { type: 'unwhitelist', data: channelData };
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

  function menuOnTap(event) {
    if (storageData === undefined) return;

    const { isDataFromRightHandSide, menuAction } = getActionMenuData(this);

    if (
      !['Block Channel', 'Block Video', 'Allow Channel', 'Remove from Whitelist'].includes(
        menuAction,
      )
    ) {
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

    if (this.data.serviceEndpoint) {
      if (this.onTap) this.onTap(event);
      else if (this.onTap_) this.onTap_(event);
    }
  }
