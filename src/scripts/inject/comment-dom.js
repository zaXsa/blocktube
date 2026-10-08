  // Comment `...` menu entries (DOM layer).
  //
  // Why this exists: YouTube's new comments architecture splits comment data
  // across a ViewModel (reference key only) and frameworkUpdates mutations
  // (the actual commentEntityPayload). The `...` popup for those comments is
  // built client-side, so there is no intercepted JSON menu to inject a
  // "Block Channel" entry into — the native popup only offers Report. The
  // legacy commentRenderer JSON injection in context-menu.js stays for old
  // renderers; this DOM layer covers the new UI regardless of renderer.
  //
  // What it does: remembers which comment's `...` was pressed, then when
  // YouTube's popup menu opens, builds BlockTube entries right after the
  // native Report entry (Block Channel / Allow Channel, or Remove from
  // Whitelist in whitelist mode). Entries are real navigation-item elements
  // with text/icon bound through `data`, so they render exactly like the
  // native one, with no <style> and no innerHTML — page CSP and Trusted
  // Types stay out of the way. Tapping an entry posts the same
  // CONTEXT_BLOCK_DATA the JSON menus post and leaves a placeholder note
  // where the thread was (no toast).
  //
  // Identity: the filter pass sees every commentEntityPayload before it
  // renders (author.channelId + properties.commentId), so it records a
  // commentId -> channel map (see rememberCommentAuthor, called from
  // object-filter.js). Menu taps join the pressed comment's commentId /
  // commentKey against that map, falling back to component data and the
  // rendered author link.

  // commentId -> { id, text }. Populated while filtering (pre-render), read
  // when a menu entry is tapped. Reset past a few thousand entries so long
  // comment sessions cannot grow it without bound.
  let commentAuthorById = {};
  let commentAuthorCount = 0;

  // Record one entity payload's author for later menu taps. Called from
  // matchFilterProperties (the caller wraps it in try/catch, so realms
  // without this fragment keep working). Never throws.
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

  // Author identity out of a comment element's component data. Tries the
  // legacy renderer shape first, then the entity-payload shape the new UI
  // resolves into component props, then a bare commentId for callers that
  // join it against the filter-time map. Never throws.
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

  // Component data off a rendered element: Polymer nodes expose `data`
  // directly, some views only via getCurrentData(), others stash it on the
  // __dataHost chain. First hit wins; anything else is an empty object.
  function commentElementData(el) {
    if (!el || typeof el !== 'object') return {};
    if (el.data && typeof el.data === 'object') return el.data;
    try {
      if (typeof el.getCurrentData === 'function') {
        const current = el.getCurrentData();
        if (current && typeof current === 'object') return current;
      }
    } catch (e) {}
    const hosted =
      getObjectByPath(el, '__dataHost.data') || getObjectByPath(el, '__data.data');
    if (hosted && typeof hosted === 'object') return hosted;
    return {};
  }

  // Last-resort identity from the rendered author link. A /channel/UC… href
  // carries the id directly; a /@handle href only names the author (the
  // tap then reports that it cannot resolve the id instead of blocking
  // the wrong channel).
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

  // Candidate lookup ids for the filter-time map: rendered commentId
  // fields plus commentKey forms (older clients key entities as
  // `comment_entity_<id>`, so the stripped key joins directly).
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

  // Full identity resolution for one comment element: component data
  // first, the filter-time map second, the rendered author link last.
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

  // The thread root owning a comment node: blocking removes the whole
  // thread (replies with it), mirroring removeParentHelper's
  // YTD-COMMENT-THREAD-RENDERER branch.
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

  // Drop the thread owning a comment node, leaving a placeholder note in
  // its place (mirrors blocked videos keeping a "Blocked" card instead of
  // vanishing). Falls back to plain removal when the placeholder cannot
  // be built.
  function placeholderCommentThread(commentEl, message) {
    const root = commentThreadRoot(commentEl);
    if (!root) return;
    try {
      while (root.firstChild) root.removeChild(root.firstChild);
      const note = document.createElement('div');
      note.textContent = message;
      const style = note.style;
      style.padding = '12px 16px';
      style.fontSize = '14px';
      style.fontFamily = 'Roboto, Arial, sans-serif';
      style.opacity = '0.7';
      root.appendChild(note);
    } catch (e) {
      try {
        if (typeof root.remove === 'function') root.remove();
      } catch (ignored) {}
    }
  }

  // The comment whose `...` was last pressed, with a timestamp. Opened
  // popups are matched to it by freshness (see the TTL below) and by
  // on-screen proximity to the anchor.
  let lastCommentMenuAnchor = null;
  const COMMENT_MENU_ANCHOR_TTL_MS = 5000;

  // One tap's block routing: the menu entry type plus the resolved
  // channel. A null channel toasts instead of posting — the content
  // script drops id-less blocks, so posting would be a silent no-op.
  function commentMenuTapTarget(anchorEl, type) {
    const channel = resolveCommentChannel(anchorEl);
    if (!channel.id) return { anchorEl, channel: null, type };
    return { anchorEl, channel, type };
  }

  // Forward one comment tap to the background. The `via` flag makes the
  // content script annotate it as a comment-menu block with a clean
  // (@-stripped) name — the comment text itself is never stored.
  function postCommentBlock(channel, type) {
    const name = channel.text || channel.id;
    postMessage(BLOCKTUBE_CONSTS.MESSAGES.CONTEXT_BLOCK_DATA, {
      type,
      info: { id: channel.id, text: name, via: 'comment' },
    });
  }

  // Tap handler for one injected menu entry. The comment is resolved
  // against the freshest `...` anchor at tap time (falling back to the
  // injection-time one): YouTube reuses popup containers and entries
  // across openings, so a captured anchor would block the previous
  // comment again. The thread stays in place with a placeholder note
  // (like blocked videos keep a "Blocked" card): allow taps keep the
  // comment itself, blocks and removals replace it.
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
    const target = commentMenuTapTarget(liveAnchor, type);
    if (!target.channel) {
      window.blockTubeExports.openToast(
        'BlockTube could not resolve this commenter (try blocking by name from Options)',
        4000,
      );
      return;
    }
    postCommentBlock(target.channel, target.type);
    if (target.type === 'whitelist') return;
    placeholderCommentThread(target.anchorEl, commentPlaceholderMessage(target.type));
  }

  // Placeholder note per tap type.
  function commentPlaceholderMessage(type) {
    if (type === 'unwhitelist') return 'Removed from whitelist';
    return 'Blocked comment (channel blocked)';
  }

  // Tap handler factory for one injected menu entry.
  function onCommentMenuTap(anchorEl, type) {
    return (event) => handleCommentMenuTap(event, anchorEl, type);
  }

  // Entries to offer in one comment popup, honoring the General toggles
  // the JSON menus honor (see showMenuEntry). Whitelist mode offers
  // removal only — visible comments are allowlisted by definition.
  function commentMenuEntries(store) {
    if (isWhitelistMenuMode(store)) {
      return [{ label: 'Remove from Whitelist', type: 'unwhitelist' }];
    }
    const entries = [];
    if (showMenuEntry(OPT.MENU_BLOCK_CHANNEL, store)) {
      entries.push({ label: 'Block Channel', type: 'channelId' });
    }
    if (showMenuEntry(OPT.MENU_ALLOW_CHANNEL, store)) {
      entries.push({ label: 'Allow Channel', type: 'whitelist' });
    }
    return entries;
  }

  // Icon per entry type, matching the JSON menus (block NOT_INTERESTED,
  // allow CHECK, remove REMOVE).
  function commentMenuIcon(type) {
    if (type === 'whitelist') return 'CHECK';
    if (type === 'unwhitelist') return 'REMOVE';
    return 'NOT_INTERESTED';
  }

  // Build one BlockTube popup entry as a real navigation-item element with
  // its text/icon bound through `data` — the way YouTube renders the
  // native Report entry. (Cloning the Report node and retitling its text
  // does not render: the visible text comes from the bound model, which a
  // clone does not carry.) Icon-rendering attributes are copied from the
  // native sibling so the same block icon shows. seed.js never hooks this
  // tag, so only our own click handler runs on it.
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

  // The native entry of one popup scope to build after, if present and
  // BlockTube has not injected there yet. Matched by Report text; on
  // non-English YouTube that text differs, so a popup with exactly one
  // entry falls back to it (comment popups carry only Report, while video
  // menus carry many entries — a single-item popup is unambiguous).
  // Duplicate protection is the injected entries themselves
  // (`data-bt-comment-menu`): YouTube reuses popup containers across
  // openings, so a marker on the scope would suppress every later menu.
  function commentPopupReport(scope) {
    if (!scope) return null;
    if (typeof scope.querySelectorAll !== 'function') return null;
    let items = [];
    try {
      if (typeof scope.matches === 'function' && scope.matches('[data-bt-comment-menu]')) {
        return null;
      }
      // Comment popups render ytd-menu-navigation-item-renderer (the
      // Report entry); the other two cover video/card popups sharing the
      // same popup renderer, so a wrong-anchor popup never matches empty.
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

  // Build the BlockTube entries right after the Report entry of one popup
  // scope. Returns the number of entries added.
  function injectCommentMenuEntries(scope, anchorEl, store) {
    const report = commentPopupReport(scope);
    if (!report || !report.parentNode) return 0;
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

  // True when the popup visibly belongs to the anchor: popups render next
  // to their `...` button, so a Report popup far from the pressed comment
  // belongs to something else (video menus carry Report too). A popup
  // that is not laid out yet passes — the anchor TTL still guards it.
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

  // A still-fresh anchor element, or null. Stale anchors are dropped so a
  // later unrelated popup can never inherit them.
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

  // Scan one added node (plus its closest containers) for a comment popup
  // menu carrying a Report entry.
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

  // Event-path-aware comment lookup for a `...` press. `...` buttons live
  // behind shadow roots, so e.target is retargeted to the host — but
  // composedPath() still carries the inner button (with its aria-label)
  // and the comment host. The path runs inside-out, so the menu button
  // must appear before the comment ancestor.
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

  // Capture-phase click tracker: remembers which comment's `...` opened
  // the popup that is about to appear.
  function trackCommentMenuAnchor(event) {
    try {
      const path =
        event && typeof event.composedPath === 'function'
          ? event.composedPath()
          : [event && event.target];
      if (!path || path.length === 0) return;
      const comment = commentFromEventPath(path);
      if (comment) lastCommentMenuAnchor = { el: comment, time: Date.now() };
    } catch (e) {}
  }

  // Watch for popup menus as comment threads stream in (continuations,
  // replies, sort changes all render late). Started once from hooks.js
  // after the first real storage payload so labels match the mode. The
  // desktop popup selectors never match mobile, so this is a no-op there
  // by construction.
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
        }
      }
    });
    try {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
  }
