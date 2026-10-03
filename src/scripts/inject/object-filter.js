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
    if (Array.isArray(vidLength) && (!isNaN(vidLength[0]) || !isNaN(vidLength[1])))
      return false;

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

  // The blocking rules for one field, in priority order. Returns `match` - the
  // descriptor for matchedFilterField, or null - plus `value`, the form of the
  // value the custom JS filter should receive.
  function matchField(fieldName, value, filterEntries, obj, rendererKey) {
    if (isPercentWatchedBlocked(fieldName, value, rendererKey)) {
      return { match: { name: fieldName, value }, value };
    }

    if (regexPropsSet.has(fieldName) && filterEntries !== undefined) {
      const matchedEntry = filterEntries.find((entry) => entry && entry.test(value));
      if (matchedEntry) {
        return {
          match: { name: fieldName, value: String(matchedEntry).slice(0, 40) },
          value,
        };
      }
    }

    if (isCollabChannelBlocked(fieldName, rendererKey, filterEntries, obj)) {
      return { match: { name: fieldName, value }, value };
    }

    if (fieldName === 'vidLength') {
      const vidLen = parseTime(value);
      const match = matchesDurationRange(vidLen, filterEntries)
        ? { name: fieldName, value: vidLen }
        : null;
      return { match, value: vidLen };
    }

    return { match: null, value };
  }

  // Coerce the two fields whose raw JSON is not what a filter author expects.
  function normalizeForJsFilter(fieldName, value) {
    if (fieldName === 'viewCount') return parseViewCount(value);
    if (fieldName === 'channelBadges' || fieldName === 'badges') return extractBadgeList(value);
    return value;
  }

  ObjectFilter.prototype.matchFilterProperties = function (filterPaths, obj, rendererKey) {
    const friendlyVideoObj = {};
    matchedFilterField = null;

    if (document.location.pathname === '/feed/history' && storageData.options[OPT.DISABLE_ON_HISTORY])
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

      const value = getFlattenByPath(obj, filterPath);
      if (value === undefined) continue;

      const { match, value: jsValue } = matchField(
        fieldName,
        value,
        filterEntries,
        obj,
        rendererKey,
      );
      if (match) {
        matchedFilterField = match;
        doBlock = true;
        break;
      }

      if (jsFilterEnabled) friendlyVideoObj[fieldName] = normalizeForJsFilter(fieldName, jsValue);
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
    [OPT.CHIPS_SHELVES, (obj, rendererKey) => CHIPS_SHELF_RENDERERS.has(rendererKey)],
    [OPT.MIXES, matchesGeneratedPlaylist],
  ];

  ObjectFilter.prototype.isExtendedMatched = function (filteredObject, rendererKey) {
    for (let idx = 0; idx < OPTION_MATCHERS.length; idx += 1) {
      const [optionKey, matcher] = OPTION_MATCHERS[idx];
      if (storageData.options[optionKey] && matcher(filteredObject, rendererKey)) return true;
    }
    return this.isBlockedComment(filteredObject, rendererKey);
  };

  // Comments are blocked by id, not by option. The two renderer shapes bury
  // the id at different depths.
  ObjectFilter.prototype.isBlockedComment = function (filteredObject, rendererKey) {
    let commentId;
    if (rendererKey === 'commentThreadRenderer') {
      commentId = getObjectByPath(
        filteredObject,
        'commentViewModel.commentViewModel.commentId',
      );
    } else if (rendererKey === 'commentViewModel') {
      commentId = getObjectByPath(filteredObject, 'commentId');
    } else {
      return false;
    }
    return commentId !== undefined && this.blockedComments.includes(commentId);
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
      let matchedRules = [];
      try {
        matchedRules = this.matchFilterRule(obj, keys);
      } catch (e) {
        console.error('matchFilterRule Exception (renderer left in place)');
        console.error(e);
      }
      matchedRules.forEach((r) => {
        let customRet = true;
        if (r.customFunc !== undefined) {
          try {
            customRet = r.customFunc.call(this, obj, r.name);
          } catch (e) {
            console.error('customFunc Exception (renderer left in place)');
            console.error(e);
            customRet = false;
          }
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
      let childDel;
      if (typeof child === 'object' && child !== null) {
        try {
          childDel = this.filter(child);
        } catch (e) {
          console.error('ObjectFilter child exception (subtree left in place)');
          console.error(e);
          childDel = false;
        }
      } else {
        childDel = undefined;
      }
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

    if (this.contextMenus) {
      try {
        !isMobileInterface ? addContextMenus(obj, keys) : addContextMenusMobile(obj, keys);
      } catch (e) {
        console.error('addContextMenus Exception');
        console.error(e);
      }
    }
    return deletePrev;
  };
