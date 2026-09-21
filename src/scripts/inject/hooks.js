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

  // Pre-compiled filter paths. The same path strings (from filterRules and the
  // literals below) are resolved against thousands of objects, so split + regex
  // parsing happens once per unique path instead of per call.
  function transformToRegExp(data) {
    if (!has.call(data, 'filterData')) return;
    regexProps.forEach((p) => {
      if (has.call(data.filterData, p)) {
        data.filterData[p] = data.filterData[p].map((v) => {
          try {
            return RegExp(v[0], v[1].replace('g', ''));
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

  // Received from the background service worker (see the storageData/filtersData
  // contract in content_script.js). `data.options` follows the schema that
  // background.js DEFAULT_OPTIONS defines; option reads live in
  //   object-filter.js   shorts, movies, mixes, chips_shelves,
  //                      percent_watched_hide, vidLength_type, disable_on_history
  //   custom-filters.js  suggestions_only, autoplay, disable_you_there,
  //                      disable_db_normalize, block_message
  //   context-menu.js    block_feedback
  //   below              trending, mixes, shorts, enable_javascript
  // Keep option keys in sync with background.js.
  function storageReceived(data) {
    if (data === undefined) {
      window.blockTubeDispatched = true;
      window.dispatchEvent(new Event('blockTubeReady'));
      return;
    }
    transformToRegExp(data);
    if (data.options.trending) blockTrending(data);
    if (data.options.mixes) blockMixes(data);
    if (data.options.shorts) blockShorts(data);

    const shouldStartHook = storageData === undefined;
    storageData = data;

    // Enable JS filtering only if function has something in it
    if (storageData.options.enable_javascript && storageData.filterData.javascript) {
      try {
        try {
          if (window.trustedTypes && window.trustedTypes.createPolicy) {
            window.trustedTypes.createPolicy('default', {
              createHTML: (string) => string,
              createScriptURL: (string) => string,
              createScript: (string) => string,
            });
          }
        } catch (e) {}
        jsFilter = window.eval(storageData.filterData.javascript);
        if (!(jsFilter instanceof Function)) {
          throw Error('Function not found');
        }
        jsFilterEnabled = storageData.options.enable_javascript;
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
