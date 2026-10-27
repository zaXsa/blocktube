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

  // Live comment text color for the placeholder note, sampled BEFORE the
  // thread is wiped. Sampling #content-text (else the comment node itself)
  // matches the surrounding comments by construction, in any theme and
  // under recolor extensions; the yt-spec token is the fallback. Never
  // throws (empty string on any failure — the caller falls back).
  function btSampleCommentTextColor(commentEl) {
    try {
      let ref = commentEl;
      try {
        if (commentEl && typeof commentEl.querySelector === 'function') {
          ref = commentEl.querySelector('#content-text') || commentEl;
        }
      } catch (e) {}
      if (ref && typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
        const sampled = window.getComputedStyle(ref).color;
        if (typeof sampled === 'string' && sampled.length > 0) return sampled;
      }
    } catch (e) {}
    return '';
  }

  // Drop the thread owning a comment node, leaving a placeholder note in
  // its place (mirrors blocked videos keeping a "Blocked" card instead of
  // vanishing). The note is pinned to the sampled text color: it sets no
  // color of its own, so it inherited whatever the emptied root computed —
  // black in the field report's dark-theme context. Falls back to plain
  // removal when the placeholder cannot be built.
  function placeholderCommentThread(commentEl, message) {
    const root = commentThreadRoot(commentEl);
    if (!root) return;
    const textColor = btSampleCommentTextColor(commentEl);
    try {
      while (root.firstChild) root.removeChild(root.firstChild);
      const note = document.createElement('div');
      note.textContent = message;
      const style = note.style;
      style.padding = '12px 16px';
      style.fontSize = '14px';
      style.fontFamily = 'Roboto, Arial, sans-serif';
      style.opacity = '0.7';
      style.color = textColor || 'var(--yt-spec-text-primary)';
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
      info: { id: channel.id, text: name, via: BLOCKTUBE_CONSTS.VIA.COMMENT },
    });
  }

  // Tap handler for one injected entry: resolves against freshest `...`
  // anchor at tap time (fallback: injection-time one), since YouTube reuses
  // popup containers/entries across openings and a captured anchor would
  // block the previous comment again. Thread stays with a placeholder note
  // (like blocked videos keep a "Blocked" card): allow keeps comment,
  // blocks/removals replace it.
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
        BLOCKTUBE_CONSTS.TOASTS.RELOAD_REQUIRED,
        5000,
      );
      return;
    }
    const liveAnchor = freshCommentMenuAnchor() || anchorEl;
    // Text blocks need no channel identity — only the comment itself, so
    // they branch off before channel resolution.
    if (type === BLOCKTUBE_CONSTS.BLOCK_TYPES.COMMENT) {
      openCommentTextDialog(liveAnchor);
      return;
    }
    finishCommentMenuTap(liveAnchor, type);
  }

  // Resolve, post and placeholder one channel/allow tap.
  function finishCommentMenuTap(anchorEl, type) {
    const target = commentMenuTapTarget(anchorEl, type);
    if (!target.channel) {
      window.blockTubeExports.openToast(
        'BlockTube could not resolve this commenter (try blocking by name from Options)',
        4000,
      );
      return;
    }
    postCommentBlock(target.channel, target.type);
    if (target.type === BLOCKTUBE_CONSTS.BLOCK_TYPES.ALLOW) return;
    placeholderCommentThread(target.anchorEl, commentPlaceholderMessage(target.type));
  }

  // Placeholder note per tap type.
  function commentPlaceholderMessage(type) {
    if (type === BLOCKTUBE_CONSTS.BLOCK_TYPES.UNALLOW) return 'Removed from whitelist';
    if (type === BLOCKTUBE_CONSTS.BLOCK_TYPES.COMMENT) return 'Blocked comment (text blocked)';
    return 'Blocked comment (channel blocked)';
  }

  // Full comment text for the editor popup: entity-payload content first,
  // rendered text second. Whitespace-collapsed and capped well above the
  // 200-char rule budget, so trimming happens in the editor, not here.
  function commentFullText(el) {
    let text;
    try {
      const data = commentElementData(el);
      text = getFlattenByPath(data, ['properties.content.content', 'contentText']);
      if (typeof text !== 'string' && el && typeof el.querySelector === 'function') {
        const node = el.querySelector('#content-text');
        if (node && typeof node.textContent === 'string') text = node.textContent;
      }
    } catch (e) {}
    if (typeof text !== 'string') return '';
    return text.replace(/\s+/g, ' ').trim().slice(0, 500);
  }

  // Collapse editor input exactly like the background sanitizer does
  // (background.js sanitizeCommentEntry), so what the popup posts is what
  // gets stored.
  function collapseCommentText(text) {
    const raw = text === null || text === undefined ? '' : text;
    return String(raw).replace(/\s+/g, ' ').trim().slice(0, 200);
  }

  // Validate one collapsed editor entry. Null when valid, otherwise the
  // error to show. Mirrors the options page: a plain line is a keyword,
  // only a /pattern/flags shape is compiled as regex (and an invalid one
  // blocks saving here instead of lingering in the list).
  function validateCommentEntry(clean) {
    if (clean.length === 0) return 'Enter some text to block.';
    if (clean.startsWith('//')) return 'Entries starting with // are annotations, not rules.';
    const parts = /^\/(.*)\/(.*)$/.exec(clean);
    if (parts === null) return null;
    try {
      RegExp(parts[1], parts[2].replace('g', ''));
    } catch (e) {
      return 'Invalid regular expression.';
    }
    return null;
  }

  // Tap handler factory for one injected menu entry.
  function onCommentMenuTap(anchorEl, type) {
    return (event) => handleCommentMenuTap(event, anchorEl, type);
  }

  // Unicode word-boundary class, mirrored from background.js compileRegex:
  // plain keywords only match beside these separators (or string ends).
  const COMMENT_KEYWORD_BOUNDARY =
    '[ \n\r\t!@#$%^&*()_\\-=+\\[\\]\\\\\\|;:\'",\\.\\/<>\\?`~:]+';

  // Escape one plain keyword exactly like background.js compileRegex.
  function escapeCommentKeyword(keyword) {
    return keyword.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
  }

  // Compile one collapsed editor entry to a live RegExp, mirroring
  // background.js compileRegex for the comment list: /pattern/flags is raw
  // regex, anything else a boundary-wrapped case-insensitive keyword.
  // Undefined when the entry cannot compile — never throws.
  function compileCommentRuleLive(clean) {
    const text = typeof clean === 'string' ? clean : '';
    if (text.length === 0 || text.startsWith('//')) return undefined;
    const parts = /^\/(.*)\/(.*)$/.exec(text);
    const pair =
      parts !== null
        ? [parts[1], parts[2]]
        : [
            `(^|${COMMENT_KEYWORD_BOUNDARY})(${escapeCommentKeyword(text)})(${COMMENT_KEYWORD_BOUNDARY}|$)`,
            'i',
          ];
    try {
      return compileOneRegExp(pair);
    } catch (e) {
      return undefined;
    }
  }

  // Style one dialog node through CSSOM only (no <style>, no innerHTML),
  // so page CSP and Trusted Types stay out of the way.
  function styleDialogNode(node, styles) {
    assignStyleProps(node, styles);
    return node;
  }

  // One labeled row for the editor dialog: a div carrying text, or a
  // button/textarea/checkbox built by the caller. Keeps the builder below
  // readable without a generic element factory.
  function dialogText(text, styles) {
    const node = document.createElement('div');
    node.textContent = text;
    return styleDialogNode(node, styles || {});
  }

  // The currently open editor dialog, if any. Opening a new one closes
  // the old first, so dialogs can never stack or strand an older Save.
  let openCommentTextBack = null;

  // Close and drop the editor dialog.
  function closeCommentTextDialog(back) {
    try {
      if (back && typeof back.remove === 'function') back.remove();
    } catch (e) {}
    if (openCommentTextBack === back) openCommentTextBack = null;
  }

  // Save one validated editor entry: post it as a comment rule, replace
  // the thread with a placeholder, live-block every other visible match
  // (no reload), and close. No toast — the placeholders are the
  // confirmation.
  function saveCommentTextDialog(back, anchorEl, clean) {
    postMessage(BLOCKTUBE_CONSTS.MESSAGES.CONTEXT_BLOCK_DATA, {
      type: BLOCKTUBE_CONSTS.BLOCK_TYPES.COMMENT,
      info: { id: clean, text: clean, via: BLOCKTUBE_CONSTS.VIA.COMMENT },
    });
    placeholderCommentThread(anchorEl, commentPlaceholderMessage(BLOCKTUBE_CONSTS.BLOCK_TYPES.COMMENT));
    applyCommentRuleLive(clean);
    closeCommentTextDialog(back);
  }

  // Comment-level nodes for the live sweep: top-level and reply renderers
  // in both the legacy and the new view-model UI.
  const LIVE_COMMENT_SELECTORS = 'ytd-comment-renderer, ytd-comment-view-model';

  // Placeholder one rendered comment when the live rule matches its text.
  // Detached nodes (an already-placeholdered thread) are skipped.
  function liveBlockCommentNode(node, rule) {
    try {
      if (!node || node.nodeType !== 1 || node.isConnected === false) return false;
      const text = commentFullText(node);
      if (text.length === 0 || !testFilterEntry(rule, text)) return false;
    } catch (e) {
      return false;
    }
    placeholderCommentThread(node, commentPlaceholderMessage(BLOCKTUBE_CONSTS.BLOCK_TYPES.COMMENT));
    return true;
  }

  // Apply one freshly saved comment rule to the comments already on the
  // page — no reload. The tapped thread is gone by now (placeholdered
  // above); every other visible match goes the same way. Returns the
  // blocked count.
  function applyCommentRuleLive(clean) {
    const rule = compileCommentRuleLive(clean);
    if (!rule || typeof document === 'undefined' || !document.querySelectorAll) return 0;
    let nodes = null;
    try {
      nodes = document.querySelectorAll(LIVE_COMMENT_SELECTORS);
    } catch (e) {
      return 0;
    }
    let blocked = 0;
    for (let i = 0; i < nodes.length; i += 1) {
      if (liveBlockCommentNode(nodes[i], rule)) blocked += 1;
    }
    return blocked;
  }

  // Revalidate the editor against the current field state. Returns the
  // collapsed entry (valid or not) for the save handler.
  function revalidateCommentTextDialog(field, error, save) {
    const clean = collapseCommentText(field.value);
    const problem = validateCommentEntry(clean);
    try {
      error.textContent = problem === null ? '' : problem;
      save.disabled = problem !== null;
      save.style.opacity = problem === null ? '1' : '0.5';
      save.style.cursor = problem === null ? 'pointer' : 'not-allowed';
    } catch (e) {}
    return clean;
  }

  // BlockTube options-page look, through CSSOM only (no <style>, no
  // innerHTML): dark panel, bordered field and buttons (style.css theme).
  const COMMENT_DIALOG_FONT = '"Overpass", "Open Sans", Helvetica, Arial, sans-serif';

  // Panel for the editor dialog: BlockTube options-page look, through
  // CSSOM only. Flex column so the field grows into extra space; the
  // resize handle lives on the panel itself (width and height together).
  function commentDialogPanel() {
    return styleDialogNode(document.createElement('div'), {
      backgroundColor: '#161b22',
      color: '#ffffff',
      fontFamily: COMMENT_DIALOG_FONT,
      fontSize: '14px',
      padding: '16px',
      borderRadius: '8px',
      border: '1px solid #30363d',
      width: 'min(680px, 94vw)',
      maxWidth: '94vw',
      maxHeight: '90vh',
      minWidth: '320px',
      minHeight: '280px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      resize: 'both',
      overflow: 'auto',
    });
  }

  // Backdrop + panel shell for the editor dialog.
  function commentDialogShell() {
    const back = styleDialogNode(document.createElement('div'), {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      zIndex: '2147483647',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });
    back.setAttribute('role', 'dialog');
    back.setAttribute('aria-label', 'BlockTube: block comment text');
    const panel = commentDialogPanel();
    back.appendChild(panel);
    return { back, panel };
  }

  // Title + hint header of the editor dialog. Returns the title node:
  // it doubles as the drag handle for moving the popup.
  function commentDialogHeader(panel) {
    const title = dialogText('Block comment text', {
      fontWeight: '600',
      textTransform: 'uppercase',
      marginBottom: '8px',
      cursor: 'move',
      userSelect: 'none',
    });
    panel.appendChild(title);
    panel.appendChild(
      dialogText('Trim to the words you want blocked, exactly like the Comment content list on the options page: plain text is a case-insensitive keyword, /pattern/flags is raw regex.', {
        opacity: '0.7',
        marginBottom: '8px',
        fontSize: '12px',
      }),
    );
    return title;
  }

  // Editable field of the editor dialog, prefilled with the comment.
  // Focus highlights the border (GitHub-dark accent); blur restores it.
  // Sizing follows the panel (which carries the resize handle): the field
  // grows into extra panel space instead of having its own handle.
  function commentDialogField(panel, initial) {
    const field = document.createElement('textarea');
    field.value = initial;
    field.rows = 8;
    styleDialogNode(field, {
      width: '100%',
      boxSizing: 'border-box',
      flex: '1 1 auto',
      minHeight: '80px',
      fontSize: '14px',
      fontFamily: COMMENT_DIALOG_FONT,
      color: '#ffffff',
      backgroundColor: '#0f0f0f',
      border: '1px solid #30363d',
      padding: '8px',
      borderRadius: '8px',
      resize: 'none',
      outline: 'none',
    });
    try {
      field.addEventListener('focus', () => {
        field.style.borderColor = '#1f6feb';
      });
      field.addEventListener('blur', () => {
        field.style.borderColor = '#30363d';
      });
    } catch (e) {}
    panel.appendChild(field);
    return field;
  }

  // Shared BlockTube-styled dialog button shape (style.css theme).
  const COMMENT_DIALOG_BUTTON = {
    fontFamily: COMMENT_DIALOG_FONT,
    fontWeight: '600',
    fontSize: 'small',
    color: '#ffffff',
    backgroundColor: '#21262d',
    paddingBlock: '.5em',
    paddingInline: '1em',
    borderRadius: '.3em',
    border: '1.5px solid transparent',
    cursor: 'pointer',
  };

  // One BlockTube-styled dialog button, with a hover lift while enabled.
  function commentDialogButton(label, extraStyles) {
    const button = document.createElement('button');
    button.textContent = label;
    styleDialogNode(button, { ...COMMENT_DIALOG_BUTTON, ...(extraStyles || {}) });
    try {
      button.addEventListener('mouseenter', () => {
        if (!button.disabled) button.style.backgroundColor = '#30363d';
      });
      button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = COMMENT_DIALOG_BUTTON.backgroundColor;
      });
    } catch (e) {}
    return button;
  }

  // Clamp one dragged panel position so the popup always stays
  // grabbable: at least 80px of width visible, top edge never above the
  // viewport top.
  function clampDialogPos(left, top, boxW) {
    const vw = window.innerWidth || 800;
    return {
      left: Math.min(Math.max(left, 80 - boxW), vw - 80),
      top: Math.max(0, top),
    };
  }

  // Track one active drag until mouse release, clamped to the viewport.
  function trackCommentDialogDrag(panel, origin) {
    const onMove = (move) => {
      try {
        const pos = clampDialogPos(
          origin.l + move.clientX - origin.x,
          origin.t + move.clientY - origin.y,
          origin.w,
        );
        panel.style.left = `${pos.left}px`;
        panel.style.top = `${pos.top}px`;
      } catch (e) {}
    };
    const onUp = () => {
      try {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      } catch (e) {}
    };
    try {
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    } catch (e) {}
  }

  // Begin one title-bar drag: lift the panel out of the centering flow at
  // its current spot and track the pointer until release. Primary button
  // only, so right/middle clicks still pass through to the page.
  function startCommentDialogDrag(panel, event) {
    if (!event || (event.button !== undefined && event.button !== 0)) return;
    let origin = null;
    try {
      const box = panel.getBoundingClientRect();
      origin = { x: event.clientX, y: event.clientY, l: box.left, t: box.top, w: box.width };
      panel.style.position = 'absolute';
      panel.style.margin = '0';
      panel.style.left = `${box.left}px`;
      panel.style.top = `${box.top}px`;
      event.preventDefault();
    } catch (e) {
      return;
    }
    trackCommentDialogDrag(panel, origin);
  }

  // Movable popup: press-drag the title bar to move the panel, release to
  // drop it. Mouse-only: the DOM comment menus this dialog hangs off are
  // desktop-only by construction.
  function makeCommentDialogMovable(panel, handle) {
    try {
      handle.addEventListener('mousedown', (event) => startCommentDialogDrag(panel, event));
    } catch (e) {}
  }

  // Error line + Cancel/Save row of the editor dialog.
  function commentDialogFooter(panel) {
    const error = dialogText('', { color: '#EF4F43', fontSize: '12px', minHeight: '18px' });
    panel.appendChild(error);
    const buttons = styleDialogNode(document.createElement('div'), {
      display: 'flex',
      justifyContent: 'flex-end',
      marginTop: '8px',
    });
    const cancel = commentDialogButton('Cancel');
    const save = commentDialogButton('Save block', { marginLeft: '8px' });
    buttons.appendChild(cancel);
    buttons.appendChild(save);
    panel.appendChild(buttons);
    return { error, cancel, save };
  }

  // Keyboard flow for the editor: Escape closes, Ctrl/Cmd+Enter saves.
  function onCommentDialogKey(event, ctx) {
    try {
      if (event) event.stopPropagation();
    } catch (e) {}
    if (!event) return;
    if (event.key === 'Escape') ctx.close();
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) ctx.trySave();
  }

  // Wire editor events: live validation, backdrop-click/Escape close,
  // Ctrl/Cmd+Enter save, Cancel/Save buttons. Returns revalidate for the
  // initial pass. Backdrop clicks in the first blink after opening are
  // ignored, so the tap (or a fast double-tap) that opened the popup can
  // never instantly dismiss it again.
  function wireCommentTextDialog(back, field, footer, anchorEl) {
    const close = () => closeCommentTextDialog(back);
    const openedAt = Date.now();
    const revalidate = () => revalidateCommentTextDialog(field, footer.error, footer.save);
    const trySave = () => {
      const clean = revalidate();
      if (validateCommentEntry(clean) === null) {
        saveCommentTextDialog(back, anchorEl, clean);
      }
    };
    field.addEventListener('input', revalidate);
    // A text-selection drag that starts in the field and releases outside
    // fires `click` on the common ancestor (the backdrop) — that must not
    // count as click-outside. Only a press that started on the backdrop
    // itself dismisses the dialog.
    let downOnBack = false;
    back.addEventListener('mousedown', (event) => {
      downOnBack = !!event && event.target === back;
    });
    back.addEventListener('click', (event) => {
      if (event && event.target === back && downOnBack && Date.now() - openedAt > 300) close();
    });
    back.addEventListener('keydown', (event) => onCommentDialogKey(event, { close, trySave }));
    footer.cancel.addEventListener('click', close);
    footer.save.addEventListener('click', trySave);
    return revalidate;
  }

  // The editable "Block comment text" popup: prefilled with the comment and
  // saved exactly like the Comment content list on the options page, with
  // live validation mirroring the background sanitizer. Resizable (drag the
  // corner), movable (drag the title), dismissed by Save/Cancel/Escape or a
  // click outside the panel.
  function openCommentTextDialog(anchorEl) {
    const initial = commentFullText(anchorEl);
    if (initial.length === 0) {
      window.blockTubeExports.openToast('BlockTube could not read this comment’s text', 4000);
      return;
    }
    if (openCommentTextBack) closeCommentTextDialog(openCommentTextBack);
    const shell = commentDialogShell();
    const title = commentDialogHeader(shell.panel);
    const field = commentDialogField(shell.panel, initial);
    const footer = commentDialogFooter(shell.panel);
    makeCommentDialogMovable(shell.panel, title);
    const revalidate = wireCommentTextDialog(shell.back, field, footer, anchorEl);
    try {
      (document.body || document.documentElement).appendChild(shell.back);
    } catch (e) {
      return;
    }
    openCommentTextBack = shell.back;
    revalidate();
    try {
      field.focus();
    } catch (e) {}
  }

  // Entries to offer in one comment popup, honoring the General toggles
  // the JSON menus honor (see showMenuEntry). Whitelist mode offers
  // removal only — visible comments are allowlisted by definition.
  function commentMenuEntries(store) {
    if (isWhitelistMenuMode(store)) {
      return [
        { label: 'Remove from Whitelist', type: BLOCKTUBE_CONSTS.BLOCK_TYPES.UNALLOW },
      ];
    }
    const entries = [];
    if (showMenuEntry(OPT.MENU_BLOCK_CHANNEL, store)) {
      entries.push({ label: 'Block Channel', type: BLOCKTUBE_CONSTS.BLOCK_TYPES.CHANNEL });
    }
    if (showMenuEntry(OPT.MENU_BLOCK_COMMENT, store)) {
      entries.push({ label: 'Block comment text…', type: BLOCKTUBE_CONSTS.BLOCK_TYPES.COMMENT });
    }
    if (showMenuEntry(OPT.MENU_ALLOW_CHANNEL, store)) {
      entries.push({ label: 'Allow Channel', type: BLOCKTUBE_CONSTS.BLOCK_TYPES.ALLOW });
    }
    return entries;
  }

  // Icon per entry type, matching the JSON menus (block NOT_INTERESTED,
  // allow CHECK, remove REMOVE; comment text blocks with the block icon).
  function commentMenuIcon(type) {
    if (type === BLOCKTUBE_CONSTS.BLOCK_TYPES.ALLOW) return 'CHECK';
    if (type === BLOCKTUBE_CONSTS.BLOCK_TYPES.UNALLOW) return 'REMOVE';
    return 'NOT_INTERESTED';
  }

  // Build one popup entry as real navigation-item with text/icon via `data`,
  // like YouTube renders native Report (cloning Report and retitling text
  // fails: visible text comes from bound model, which a clone lacks).
  // Icon-rendering attrs copied from native sibling for same block icon.
  // seed.js never hooks this tag, so only our click handler runs on it.
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

  // Native entry of one popup scope to build after, if present and not yet
  // injected. Matched by Report text; on non-English YouTube it differs, so
  // a single-entry popup falls back to it (comment popups carry only Report
  // vs video menus' many entries — unambiguous). Duplicate guard is the
  // injected entries (`data-bt-comment-menu`): YouTube reuses popup containers,
  // so a scope marker would suppress every later menu.
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
    // A real native popup is open: sample its theme and row-icon size for
    // the fallback menu (measurement, not a guess — see
    // btSampleNativeMenuTheme / btSampleNativeRowIcon).
    try {
      btSampleNativeMenuTheme(report);
    } catch (e) {}
    try {
      btSampleNativeRowIcon(report);
    } catch (e) {}
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
      if (!sawMenuButton && hasMenuLabel(node)) sawMenuButton = true;
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

  // True when a press path runs through a menu/`...` button (same
  // match as commentFromEventPath above).
  function pathHasMenuButton(path) {
    for (let i = 0; i < path.length; i += 1) {
      if (hasMenuLabel(path[i])) return true;
    }
    return false;
  }

  // Capture-phase click tracker: remembers which comment's `...` opened
  // the popup that is about to appear. A `...` press outside any comment
  // (video menus, etc.) drops the anchor instead, so a stale comment can
  // never inherit that popup — video menus sit close enough to the
  // comments that proximity alone cannot tell them apart.
  function trackCommentMenuAnchor(event) {
    try {
      const path = eventPathOf(event);
      if (!path || path.length === 0) return;
      const comment = commentFromEventPath(path);
      if (comment) {
        lastCommentMenuAnchor = { el: comment, time: Date.now() };
      } else if (pathHasMenuButton(path)) {
        lastCommentMenuAnchor = null;
      }
    } catch (e) {}
  }

  // Fallback when native `...` missing/hidden (some regions logged out/incognito:
  // no Report, sometimes no button, so popup path never fires): own trigger per
  // comment with own menu. True when native menu visibly laid out (popup path owns
  // it); match ONLY menu candidates (any Like/Dislike/avatar button would skip every
  // comment): sized menu host or button with menu-like aria-label (same /more|action|menu/i
  // as trackCommentMenuAnchor); rect visibility since offsetParent fails in flex/YouTube layouts.
  function btHasNativeMenu(commentEl) {
    try {
      const hosts = commentEl.querySelectorAll('ytd-menu-renderer, #menu, #action-menu');
      for (let i = 0; i < hosts.length; i += 1) {
        try {
          const r = hosts[i].getBoundingClientRect();
          if (r && r.width > 0 && r.height > 0) return true;
        } catch (e) {}
      }
    } catch (e) {}
    try {
      const buttons = commentEl.querySelectorAll('button[aria-label], [aria-label]');
      for (let i = 0; i < buttons.length; i += 1) {
        let label = '';
        try {
          label = buttons[i].getAttribute ? buttons[i].getAttribute('aria-label') || '' : '';
        } catch (e) {}
        if (!/more|action|menu/i.test(label)) continue;
        try {
          const r = buttons[i].getBoundingClientRect();
          if (r && r.width > 0 && r.height > 0) return true;
        } catch (e) {}
      }
    } catch (e) {}
    return false;
  }

  // Currently open fallback menu + its cleanup (outside-click / Escape /
  // scroll dismiss). Only one open at a time.
  let btFallbackMenuEl = null;
  let btFallbackCleanup = null;

  function btCloseFallbackMenu() {
    try {
      if (btFallbackCleanup) {
        const fn = btFallbackCleanup;
        btFallbackCleanup = null;
        fn();
      }
    } catch (e) {}
    try {
      if (btFallbackMenuEl && typeof btFallbackMenuEl.remove === 'function') {
        btFallbackMenuEl.remove();
      }
    } catch (e) {}
    btFallbackMenuEl = null;
  }

  // Fallback pixel-match helpers: measure YouTube's own nodes, not guesses, so
  // trigger + menu match native `...`/Report popup in both themes. Trigger metrics
  // from one visible native icon button (once per page; miss retries every 25th call
  // so sweeps never scan whole document per comment); icon is static official SVG
  // above. Menu colors sampled from a real native popup on open (see btSampleNativeMenuTheme).
  let btNativeTemplateCache = null;
  let btNativeTemplateCalls = 0;

  // First visible native `...`-style button on the page. Video/header menus
  // still render one even where comments have none — that is the template.
  // Skips our own fallback nodes. Must contain a <yt-icon>: the previous
  // version matched a 40x40 "Show more"-style text button (aria containing
  // "more", no icon), which produced the oversized icon-less trigger.
  function btFindVisibleMenuButton() {
    try {
      if (typeof document === 'undefined' || !document.querySelectorAll) return null;
      const nodes = document.querySelectorAll('button[aria-label], yt-icon-button');
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i];
        try {
          if (n.closest && n.closest('[data-bt-fallback-menu],[data-bt-fallback-btn]')) {
            continue;
          }
        } catch (e) {}
        let label = '';
        try {
          label = n.getAttribute ? n.getAttribute('aria-label') || '' : '';
        } catch (e) {}
        if (!/more|action|menu/i.test(label)) continue;
        try {
          if (typeof n.querySelector === 'function' && !n.querySelector('yt-icon')) {
            continue;
          }
        } catch (e) {}
        try {
          const r = n.getBoundingClientRect();
          if (r && r.width > 0 && r.height > 0) return n;
        } catch (e) {}
      }
    } catch (e) {}
    return null;
  }

  // Official `...` icon, dot-for-dot from native menu button HTML (field capture:
  // <button id="button" class="style-scope yt-icon-button" aria-label="Action menu">
  // wrapping 24x24 svg of three filled circles, fill=currentcolor; icon box
  // --yt-icon-button-icon-width/height: 24px on 40px host). DOM + SVG namespace
  // (no innerHTML — CSP/Trusted Types). Replaces `⋮` glyph (thinner than filled dots)
  // and arbitrary <yt-icon> clone (wrong-icon risk); 24px box centered by 40px trigger flex, like native host.
  const BT_OFFICIAL_MENU_PATH =
    'M12 4a2 2 0 100 4 2 2 0 000-4Zm0 6a2 2 0 100 4 2 2 0 000-4Zm0 6a2 2 0 100 4 2 2 0 000-4Z';

  // One <svg> element with a single path, via the SVG namespace (no
  // innerHTML — page CSP and Trusted Types). Null when SVG DOM is
  // unavailable or any step throws. Shared by the trigger icon and the
  // menu row icons.
  function btSvgWithPath(pathD, sizePx) {
    try {
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      if (!svg || typeof svg.setAttribute !== 'function') return null;
      svg.setAttribute('height', String(sizePx));
      svg.setAttribute('width', String(sizePx));
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('focusable', 'false');
      svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', pathD);
      svg.appendChild(path);
      return svg;
    } catch (e) {}
    return null;
  }

  // 24px box + positioning span around a trigger svg, mirroring the
  // native yt-icon host structure (span.yt-icon-shape > fill div > svg).
  // Null when the wrapper cannot be built.
  function btWrapTriggerIcon(svg) {
    try {
      const box = document.createElement('div');
      const span = document.createElement('span');
      span.setAttribute('class', 'yt-icon-shape ytSpecIconShapeHost');
      styleDialogNode(box, {
        width: '24px',
        height: '24px',
        display: 'block',
        fill: 'currentcolor',
      });
      styleDialogNode(svg, {
        pointerEvents: 'none',
        display: 'block',
        width: '100%',
        height: '100%',
      });
      styleDialogNode(span, {
        display: 'inline-flex',
        width: '24px',
        height: '24px',
      });
      box.appendChild(svg);
      span.appendChild(box);
      return span;
    } catch (e) {}
    return null;
  }

  function btOfficialMenuIcon() {
    try {
      const svg = btSvgWithPath(BT_OFFICIAL_MENU_PATH, 24);
      if (!svg) return null;
      return btWrapTriggerIcon(svg);
    } catch (e) {}
    return null;
  }

  // Measured template { w, h, color } or null. w/h are measured px and
  // color is the resolved rgb() so the copy matches even in the comment
  // subtree where `inherit`/vars resolve differently (the dark-theme black
  // icon came from exactly that). Metrics only — the icon itself is always
  // the static official SVG above, and the trigger carries no YouTube
  // classes (a copied host class once pulled in a foreign border rule).
  function btNativeTriggerTemplate() {
    try {
      if (btNativeTemplateCache) return btNativeTemplateCache;
      btNativeTemplateCalls += 1;
      if (btNativeTemplateCalls % 25 !== 1) return null;
      const t = btFindVisibleMenuButton();
      if (!t) return null;
      let w = 0;
      let h = 0;
      try {
        const r = t.getBoundingClientRect();
        w = Math.round(r.width);
        h = Math.round(r.height);
      } catch (e) {}
      if (!w || !h) return null;
      let color = '';
      try {
        if (window.getComputedStyle) color = window.getComputedStyle(t).color || '';
      } catch (e) {}
      btNativeTemplateCache = {
        w,
        h,
        color,
      };
      return btNativeTemplateCache;
    } catch (e) {}
    return null;
  }

  // Menu colors sampled from a real native comment popup
  // ({ bg, color, border, boxShadow }), when one has opened on this page.
  // Null until the first sample: the fallback menu then uses the hardcoded
  // dark/light defaults below. Never guessed per-theme values — the sample
  // is the native renderer's own computed style, so theme changes and
  // per-account variations carry over automatically.
  let btNativeMenuTheme = null;

  // Sample one native popup's theme from its container. Called with the
  // Report entry of an opened native comment menu (see
  // injectCommentMenuEntries): the closest ytd-menu-popup-renderer carries
  // the background/border/shadow, its computed color the row text color.
  // Never throws.
  function btSampleNativeMenuTheme(report) {
    try {
      if (!report || typeof report.closest !== 'function') return;
      if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
        return;
      }
      const popup = report.closest('ytd-menu-popup-renderer');
      if (!popup) return;
      const style = window.getComputedStyle(popup);
      if (!style) return;
      const bg = style.backgroundColor || '';
      const color = style.color || '';
      if (typeof bg !== 'string' || bg.length === 0) return;
      if (typeof color !== 'string' || color.length === 0) return;
      const border = typeof style.border === 'string' ? style.border : '';
      const boxShadow = typeof style.boxShadow === 'string' ? style.boxShadow : '';
      btNativeMenuTheme = { bg, color, border, boxShadow };
    } catch (e) {}
  }

  // Block icon path, captured from a live native menu ([BT-ICONS] field
  // capture): the NOT_INTERESTED glyph YouTube renders for block entries,
  // on its native 24 grid. CHECK/REMOVE paths (allow / unwhitelist rows)
  // are still pending a capture — those rows stay text-only until then.
  const BT_BLOCK_ICON_PATH =
    'M12 1C5.925 1 1 5.925 1 12s4.925 11 11 11 11-4.925 11-11S18.075 1 12 1Zm0 2a9 9 0 018.246 12.605L4.755 6.661A8.99 8.99 0 0112 3ZM3.754 8.393l15.491 8.944A9 9 0 013.754 8.393Z';

  // Row icon per entry type. Missing/unknown stays text-only.
  const BT_ROW_ICON_PATHS = {
    [BLOCKTUBE_CONSTS.BLOCK_TYPES.CHANNEL]: BT_BLOCK_ICON_PATH,
    [BLOCKTUBE_CONSTS.BLOCK_TYPES.COMMENT]: BT_BLOCK_ICON_PATH,
    [BLOCKTUBE_CONSTS.BLOCK_TYPES.ALLOW]: null,
    [BLOCKTUBE_CONSTS.BLOCK_TYPES.UNALLOW]: null,
  };

  // One grid-drawn SVG icon node (no innerHTML — page CSP/Trusted Types).
  // fill=currentcolor so it tracks the row text color. 24 renders the
  // native 24 grid 1:1; anything else scales uniformly.
  function btSvgIcon(pathD, sizePx) {
    try {
      const size = sizePx > 0 ? sizePx : 24;
      const svg = btSvgWithPath(pathD, size);
      if (!svg) return null;
      const box = document.createElement('span');
      styleDialogNode(box, {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${size}px`,
        height: `${size}px`,
        flex: '0 0 auto',
      });
      styleDialogNode(svg, {
        pointerEvents: 'none',
        display: 'block',
        width: '100%',
        height: '100%',
        fill: 'currentcolor',
      });
      try {
        box.appendChild(svg);
      } catch (e) {
        return null;
      }
      return box;
    } catch (e) {}
    return null;
  }

  // Sampled native row-icon size (px, 0 until sampled). Measured off a
  // Report row's yt-icon whenever a native popup opens (see
  // btSampleNativeRowIcon); the 24 default renders the captured grid 1:1.
  let btNativeRowIconPx = 0;

  // Measure one native menu row's yt-icon box (light DOM or shadow root).
  // Called with the Report entry of an opened native comment menu.
  // Implausible sizes are ignored so a mis-hit can never distort the rows.
  function btSampleNativeRowIcon(report) {
    try {
      if (!report) return;
      let icon = null;
      try {
        icon =
          (report.shadowRoot && report.shadowRoot.querySelector('yt-icon')) ||
          (typeof report.querySelector === 'function'
            ? report.querySelector('yt-icon')
            : null);
      } catch (e) {}
      if (!icon || typeof icon.getBoundingClientRect !== 'function') return;
      const r = icon.getBoundingClientRect();
      if (r && r.width >= 16 && r.width <= 32 && r.height >= 16 && r.height <= 32) {
        btNativeRowIconPx = Math.round((r.width + r.height) / 2);
      }
    } catch (e) {}
  }
  // Bare fallback-menu row button: attrs + flex styling, no content yet.
  // Null when the button cannot be built (callers skip null rows).
  function btMakeFallbackRowButton(label, type, colors) {
    try {
      const item = document.createElement('button');
      item.setAttribute('role', 'menuitem');
      item.setAttribute('type', 'button');
      item.setAttribute('data-bt-fallback-item', type);
      item.setAttribute('aria-label', label);
      styleDialogNode(item, {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        width: '100%',
        boxSizing: 'border-box',
        textAlign: 'left',
        padding: '8px 16px',
        fontSize: '14px',
        fontFamily: 'Roboto, Arial, sans-serif',
        color: colors.text,
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      });
      return item;
    } catch (e) {}
    return null;
  }

  // Row content: captured native icon where one is known for the type
  // (text-only otherwise — allow/unwhitelist paths still pending a
  // capture), then the label. A failed label span falls back to plain
  // button text so the row never renders empty.
  function btFillFallbackRow(item, label, type) {
    try {
      const path = BT_ROW_ICON_PATHS[type];
      if (path) {
        const icon = btSvgIcon(path, btNativeRowIconPx || 24);
        if (icon) item.appendChild(icon);
      }
    } catch (e) {}
    try {
      const text = document.createElement('span');
      text.textContent = label;
      item.appendChild(text);
    } catch (e) {
      try {
        item.textContent = label;
      } catch (ignored) {}
    }
  }

  // Row behavior: hover highlight plus the tap path (same path as popup
  // entries, anchored on commentEl directly — no fresh `...` anchor exists
  // in this scenario). The tap listener is added before the dismiss one so
  // it runs first (stopPropagation, not stopImmediatePropagation).
  function btWireFallbackRow(item, commentEl, type, colors) {
    try {
      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = colors.hover;
      });
      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'transparent';
      });
    } catch (e) {}
    try {
      item.addEventListener('click', onCommentMenuTap(commentEl, type));
      item.addEventListener('click', () => btCloseFallbackMenu());
    } catch (e) {}
  }

  // One plain-HTML row for the fallback menu: a real <button> with
  // guaranteed layout (no YouTube custom-element upgrade needed), icon +
  // label in a flex row like the native rows. Null when unbuildable.
  function btBuildFallbackRow(label, type, commentEl, colors) {
    const item = btMakeFallbackRowButton(label, type, colors);
    if (!item) return null;
    btFillFallbackRow(item, label, type);
    btWireFallbackRow(item, commentEl, type, colors);
    return item;
  }

  // Menu entries for one fallback opening, honoring the General toggles.
  // Toasts and returns [] when nothing is enabled — the caller bails out.
  function btFallbackMenuEntries() {
    let entries = [];
    try {
      entries = commentMenuEntries(
        typeof storageData !== 'undefined' ? storageData : undefined,
      );
    } catch (e) {
      entries = [];
    }
    if (!entries || entries.length === 0) {
      try {
        window.blockTubeExports.openToast('BlockTube has no comment actions enabled', 3000);
      } catch (e) {}
      return [];
    }
    return entries;
  }

  // Text/hover colors for fallback rows: sampled native colors win, the
  // hardcoded pair is only the pre-sample default.
  function btFallbackRowColors(dark) {
    if (btNativeMenuTheme) return { text: btNativeMenuTheme.color, hover: 'rgba(128, 128, 128, 0.25)' };
    if (dark) return { text: '#ffffff', hover: '#3d3d3d' };
    return { text: '#0f0f0f', hover: '#f2f2f2' };
  }

  // Bare fallback menu container. Borderless by default (the native popup
  // is borderless — elevation comes from the shadow alone); sampled
  // border/shadow carry over automatically when measured.
  function btMakeFallbackMenu(rowColors, dark) {
    const menu = styleDialogNode(document.createElement('div'), {
      position: 'fixed',
      display: 'block',
      minWidth: '220px',
      maxWidth: '300px',
      padding: '8px 0',
      borderRadius: '12px',
      border:
        btNativeMenuTheme && btNativeMenuTheme.border ? btNativeMenuTheme.border : 'none',
      backgroundColor: btNativeMenuTheme ? btNativeMenuTheme.bg : dark ? '#212121' : '#ffffff',
      color: rowColors.text,
      boxShadow:
        btNativeMenuTheme && btNativeMenuTheme.boxShadow
          ? btNativeMenuTheme.boxShadow
          : '0 4px 16px rgba(0, 0, 0, 0.3)',
      zIndex: '2147483647',
      fontFamily: 'Roboto, Arial, sans-serif',
      fontSize: '14px',
    });
    menu.setAttribute('role', 'menu');
    menu.setAttribute('data-bt-fallback-menu', '1');
    return menu;
  }

  // Append one row per entry. Returns the row count (0 when unbuildable).
  function btFillFallbackMenu(menu, entries, commentEl, rowColors) {
    let rows = 0;
    for (let i = 0; i < entries.length; i += 1) {
      let item = null;
      try {
        item = btBuildFallbackRow(entries[i].label, entries[i].type, commentEl, rowColors);
      } catch (e) {
        item = null;
      }
      if (!item) continue;
      try {
        menu.appendChild(item);
        rows += 1;
      } catch (e) {}
    }
    return rows;
  }

  // Anchor the menu to the trigger rect, clamped to the viewport: below
  // the button when it fits, flipped above it otherwise.
  function btPlaceFallbackMenu(menu, rect, rows) {
    try {
      const vw = window.innerWidth || 800;
      const vh = window.innerHeight || 600;
      const mw = menu.offsetWidth || 220;
      const mh = menu.offsetHeight || rows * 36 + 16;
      let left = rect ? rect.left : 100;
      let top = rect ? rect.bottom + 4 : 100;
      if (left + mw > vw - 8) left = Math.max(8, vw - mw - 8);
      if (top + mh > vh - 8) top = Math.max(8, (rect ? rect.top : 100) - mh - 4);
      menu.style.left = `${Math.max(8, left)}px`;
      menu.style.top = `${Math.max(8, top)}px`;
    } catch (e) {}
  }

  // Dismiss wiring for the open menu: outside-click, Escape and scroll.
  // Only one menu is open at a time (see btCloseFallbackMenu).
  function btWireFallbackMenuDismiss(menu, btn) {
    const onDocClick = (event) => {
      try {
        if (menu.contains(event.target) || (btn && btn.contains(event.target))) return;
      } catch (e) {}
      btCloseFallbackMenu();
    };
    const onKey = (event) => {
      if (event && event.key === 'Escape') btCloseFallbackMenu();
    };
    const onScroll = () => btCloseFallbackMenu();
    try {
      document.addEventListener('click', onDocClick, true);
      document.addEventListener('keydown', onKey, true);
      document.addEventListener('scroll', onScroll, true);
    } catch (e) {}
    btFallbackCleanup = () => {
      try {
        document.removeEventListener('click', onDocClick, true);
      } catch (e) {}
      try {
        document.removeEventListener('keydown', onKey, true);
      } catch (e) {}
      try {
        document.removeEventListener('scroll', onScroll, true);
      } catch (e) {}
    };
  }

  // Own menu for fallback button: plain-HTML rows in plain <div> (NOT
  // ytd-menu-popup-renderer/ytd-menu-navigation-item-renderer). Custom-element version
  // rendered 0-wide outside YouTube's popup scaffold — data-bound rows need native
  // Polymer upgrade + CSS, so menu opened invisibly (field log: rows=6 menu=0x16,
  // trigger looked dead). Plain divs lay out anywhere/both themes; positioned from
  // button rect, clamped to viewport; taps reuse popup-entry paths anchored on commentEl (no fresh `...` anchor here).
  function btShowFallbackMenu(btn, commentEl) {
    btCloseFallbackMenu();
    if (typeof document === 'undefined') return;
    const entries = btFallbackMenuEntries();
    if (entries.length === 0) return;
    let rect = null;
    try {
      rect = btn.getBoundingClientRect();
    } catch (e) {}
    const dark = btNativeMenuTheme ? null : pagePrefersDark();
    const rowColors = btFallbackRowColors(dark);
    const menu = btMakeFallbackMenu(rowColors, dark);
    const rows = btFillFallbackMenu(menu, entries, commentEl, rowColors);
    if (rows === 0) return;
    try {
      (document.body || document.documentElement).appendChild(menu);
    } catch (e) {
      return;
    }
    btPlaceFallbackMenu(menu, rect, rows);
    btFallbackMenuEl = menu;
    btWireFallbackMenuDismiss(menu, btn);
  }

  // Trigger metrics + styling. Measured values win over `inherit`/vars:
  // w/h px plus the resolved rgb() color, so the copy matches the native
  // `...` even in the comment subtree where they resolve differently. The
  // default is 40px (native host size, field capture); outline:none mirrors
  // the official button — without it the focused trigger paints a focus
  // ring that reads as a border.
  function btStyleFallbackTrigger(btn, tpl) {
    const btW = tpl && tpl.w ? `${tpl.w}px` : '40px';
    const btH = tpl && tpl.h ? `${tpl.h}px` : '40px';
    const btColor = tpl && tpl.color ? tpl.color : 'var(--yt-spec-icon-inactive, #909090)';
    styleDialogNode(btn, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: btW,
      height: btH,
      minWidth: btW,
      padding: '0',
      margin: '0',
      fontSize: '22px',
      lineHeight: '1',
      color: btColor,
      opacity: '1',
      backgroundColor: 'transparent',
      borderRadius: '50%',
      border: 'none',
      outline: 'none',
      cursor: 'pointer',
      flex: '0 0 auto',
    });
  }

  // Bare trigger button: attrs set, metrics + styling applied. Deliberately
  // no YouTube classes — only inline styles, so no page (or
  // recolor-extension) rule can lend it a border.
  function btMakeFallbackTrigger(tpl) {
    const btn = document.createElement('button');
    btn.setAttribute('data-bt-fallback-btn', '1');
    btn.setAttribute('aria-label', 'BlockTube block comment');
    btn.setAttribute('title', 'BlockTube');
    btn.setAttribute('type', 'button');
    btStyleFallbackTrigger(btn, tpl);
    return btn;
  }

  // The static official SVG icon (see btOfficialMenuIcon): exact native
  // dots, never a font glyph. `⋮` text is the last resort only, for realms
  // without SVG DOM support.
  function btFillFallbackTriggerIcon(btn) {
    try {
      const official = btOfficialMenuIcon();
      if (official) {
        btn.appendChild(official);
        return;
      }
    } catch (e) {}
    try {
      btn.textContent = '⋮';
    } catch (e) {}
  }

  // Slot placement: appending to #action-menu inherits the exact native
  // position. The slot is 0x0 only because it is empty — a 40x40 child
  // gives it size. A `hidden` gate from YouTube is lifted first. True when
  // the button landed (later slots are skipped), false to fall through.
  function btPlaceTriggerInSlot(commentEl, btn) {
    let slot = null;
    try {
      slot = commentEl.querySelector('#action-menu');
    } catch (e) {
      return false;
    }
    if (!slot) return false;
    try {
      if (typeof slot.hasAttribute === 'function' && slot.hasAttribute('hidden')) {
        slot.removeAttribute('hidden');
      }
    } catch (e) {}
    try {
      slot.style.display = 'flex';
      slot.style.alignItems = 'center';
      slot.style.justifyContent = 'center';
      slot.style.visibility = 'visible';
      slot.appendChild(btn);
      return true;
    } catch (e) {}
    return false;
  }

  // Header-row placement: pushed right like the native `...`.
  function btPlaceTriggerInHeader(commentEl, btn) {
    let header = null;
    try {
      header = commentEl.querySelector('#header');
    } catch (e) {
      return false;
    }
    if (!header) return false;
    try {
      btn.style.marginLeft = 'auto';
      btn.style.alignSelf = 'center';
      header.appendChild(btn);
      return true;
    } catch (e) {}
    return false;
  }

  // Absolute placement, last resort when neither slot nor header row
  // exists. True when the button landed.
  function btPlaceTriggerAbsolute(commentEl, btn) {
    try {
      const pos = window.getComputedStyle
        ? window.getComputedStyle(commentEl).position
        : commentEl.style.position;
      if (pos === 'static' || !pos) commentEl.style.position = 'relative';
    } catch (e) {
      try {
        if (!commentEl.style.position) commentEl.style.position = 'relative';
      } catch (ignored) {}
    }
    try {
      btn.style.position = 'absolute';
      btn.style.top = '4px';
      btn.style.right = '4px';
      commentEl.appendChild(btn);
      return true;
    } catch (e) {}
    return false;
  }

  // Anchor the trigger where the native one would be: #action-menu slot,
  // else #header row, else absolute top-right. True when it landed.
  function btPlaceFallbackTrigger(commentEl, btn) {
    if (btPlaceTriggerInSlot(commentEl, btn)) return true;
    if (btPlaceTriggerInHeader(commentEl, btn)) return true;
    return btPlaceTriggerAbsolute(commentEl, btn);
  }

  // Trigger behavior: hover disc plus opening our menu on tap.
  function btWireFallbackTrigger(btn, commentEl) {
    try {
      btn.addEventListener('mouseenter', () => {
        btn.style.backgroundColor = 'rgba(128, 128, 128, 0.25)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.backgroundColor = 'transparent';
      });
      btn.addEventListener('click', (event) => {
        try {
          if (event) {
            event.preventDefault();
            event.stopPropagation();
          }
        } catch (e) {}
        btShowFallbackMenu(btn, commentEl);
      });
    } catch (e) {}
  }

  // One comment's fallback button: skips when native menu host visible (popup path
  // owns it) or button already added. Trigger carries official `...` SVG (see
  // btOfficialMenuIcon), not text glyph, anchored where native would be (#action-menu
  // slot, else #header row, else absolute top-right) to read as normal menu. Own
  // aria-label avoids "more/action/menu" so trackCommentMenuAnchor() ignores it.
  // Returns 'added' | 'native' | 'skip'.
  function btEnsureFallbackButton(commentEl) {
    try {
      if (!commentEl || commentEl.nodeType !== 1) return 'skip';
      if (typeof commentEl.querySelector !== 'function') return 'skip';
      if (commentEl.querySelector('[data-bt-fallback-btn]')) return 'skip';
      if (btHasNativeMenu(commentEl)) return 'native';
      const btn = btMakeFallbackTrigger(btNativeTriggerTemplate());
      btFillFallbackTriggerIcon(btn);
      if (!btPlaceFallbackTrigger(commentEl, btn)) return 'skip';
      btWireFallbackTrigger(btn, commentEl);
      return 'added';
    } catch (e) {}
    return 'skip';
  }

  // Comment renderers under one added node: the node itself when it is
  // one, plus its matching descendants (capped). Never throws.
  function btSweepCandidates(node) {
    const candidates = [];
    try {
      if (typeof node.matches === 'function' && node.matches(LIVE_COMMENT_SELECTORS)) {
        candidates.push(node);
      }
    } catch (e) {}
    try {
      if (typeof node.querySelectorAll === 'function') {
        const found = node.querySelectorAll(LIVE_COMMENT_SELECTORS);
        for (let i = 0; i < found.length && candidates.length < 100; i += 1) {
          candidates.push(found[i]);
        }
      }
    } catch (e) {}
    return candidates;
  }

  // Sweep one added node (plus its subtree, capped) for comment renderers
  // lacking a native menu. Returns { seen, added, native } for the summary.
  function btSweepForFallbacks(node) {
    const out = { seen: 0, added: 0, native: 0 };
    try {
      if (!node || node.nodeType !== 1) return out;
      const candidates = btSweepCandidates(node);
      for (let i = 0; i < candidates.length; i += 1) {
        out.seen += 1;
        let verdict = 'skip';
        try {
          verdict = btEnsureFallbackButton(candidates[i]);
        } catch (e) {
          verdict = 'skip';
        }
        if (verdict === 'added') out.added += 1;
        else if (verdict === 'native') out.native += 1;
      }
    } catch (e) {}
    return out;
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
          try {
            btSweepForFallbacks(added[j]);
          } catch (e) {}
        }
      }
    });
    try {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
    // Sweep comments already rendered before boot (continuations, replies
    // and sort changes arrive later through the observer above).
    try {
      btSweepForFallbacks(document.documentElement);
    } catch (e) {}
  }
