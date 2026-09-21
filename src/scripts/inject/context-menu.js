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
    if (store.options.block_feedback && items.length > 0) {
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

    if (store.options.block_feedback) {
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
