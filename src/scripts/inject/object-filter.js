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
      storageData.options.shorts ||
      storageData.options.movies ||
      storageData.options.mixes ||
      storageData.options.chips_shelves
    )
      return false;
    if (!isNaN(storageData.options.percent_watched_hide)) return false;

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
      storageData.options.percent_watched_hide &&
      rendererKey !== 'playlistPanelVideoRenderer' &&
      !['/feed/history', '/feed/library', '/playlist'].includes(document.location.pathname) &&
      parseInt(value) >= storageData.options.percent_watched_hide
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
    if (vidLen === SHORTS_TIME && storageData.options.shorts) {
      return true;
    }
    if (vidLen > 0 && filterEntries.length === 2) {
      if (storageData.options.vidLength_type === 'block') {
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

    if (document.location.pathname === '/feed/history' && storageData.options.disable_on_history)
      return false;

    let doBlock = Object.keys(filterPaths).some((fieldName) => {
      const filterPath = filterPaths[fieldName];
      if (filterPath === undefined) return false;

      const filterEntries = storageData.filterData[fieldName];
      if (
        regexPropsSet.has(fieldName) &&
        (filterEntries === undefined || (filterEntries.length === 0 && !jsFilterEnabled))
      )
        return false;

      let value = getFlattenByPath(obj, filterPath);
      if (value === undefined) return false;

      if (isPercentWatchedBlocked(fieldName, value, rendererKey)) return true;

      if (regexPropsSet.has(fieldName) && filterEntries.some((entry) => entry && entry.test(value)))
        return true;

      if (isCollabChannelBlocked(fieldName, rendererKey, filterEntries, obj)) return true;

      if (fieldName === 'vidLength') {
        const vidLen = parseTime(value);
        if (matchesDurationRange(vidLen, filterEntries)) return true;
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

      return false;
    });

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
    if (storageData.options.movies) {
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
      storageData.options.shorts &&
      (rendererKey === 'shortsLockupViewModel' ||
        rendererKey === 'reelItemRenderer' ||
        rendererKey === 'gridShelfViewModel')
    )
      return true;
    if (
      storageData.options.chips_shelves &&
      (rendererKey === 'richShelfRenderer' ||
        rendererKey === 'chipsShelfWithVideoShelfRenderer' ||
        rendererKey === 'brandVideoSingletonRenderer' ||
        rendererKey === 'brandVideoShelfRenderer' ||
        rendererKey === 'statementBannerRenderer')
    )
      return true;
    if (storageData.options.mixes && rendererKey === 'radioRenderer') return true;
    if (storageData.options.mixes && rendererKey === 'compactRadioRenderer') return true;
    if (storageData.options.mixes && rendererKey === 'lockupViewModel') {
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
