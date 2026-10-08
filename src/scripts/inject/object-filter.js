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

  // Collab videos (avatar stack): a blocked collaborator other than the first
  // creator isn't caught by the single channelId above, so test every
  // collaborator in the stack as well.
  function isCollabChannelBlocked(fieldName, rendererKey, filterEntries, obj) {
    if (fieldName !== 'channelId' || rendererKey !== 'lockupViewModel') return false;
    if (filterEntries.length === 0) return false;
    const collabIds = getCollaboratorChannelIds(obj);
    return collabIds.some((id) => filterEntries.some((entry) => entry && entry.test(id)));
  }

  // Whitelist mode (generous, fail-open): a card is allowed when ANY
  // collaborator id in the avatar stack matches the allowlist, even if the
  // primary channel id does not.
  function isCollabChannelAllowlisted(obj) {
    const allowlist = storageData.filterData.whitelist || [];
    if (allowlist.length === 0) return false;
    const collabIds = getCollaboratorChannelIds(obj);
    return collabIds.some((id) => allowlist.some((entry) => entry && entry.test(id)));
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
    return { match: { name: fieldName, value }, value };
  }

  // Regex-props branch of matchField: channelId/channelName may carry several
  // channels (search-result collab dialogs); a blocked one listed second must
  // still match. Returns the match descriptor or null.
  function matchFieldRegex(fieldName, value, filterEntries, allValues) {
    // channelId/channelName may carry several channels (search-result collab
    // dialogs); a blocked one listed second must still match.
    const candidates = allValues && allValues.length > 0 ? allValues : [value];
    const matchedEntry = filterEntries.find(
      (entry) => entry && candidates.some((v) => testFilterEntry(entry, v)),
    );
    if (matchedEntry) {
      return { name: fieldName, value: String(matchedEntry).slice(0, 40) };
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

    if (isCollabChannelBlocked(fieldName, rendererKey, filterEntries, obj)) {
      return { match: { name: fieldName, value }, value };
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

  // Run one matched rule's customFunc (if any) and delete the renderer on
  // success. Returns the rule's related flag (or true) when deleted.
  function applyMatchedRule(filterCtx, obj, rule) {
    let customRet = true;
    if (rule.customFunc !== undefined) {
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
