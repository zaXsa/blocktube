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
    // Text blocks need no channel identity — only the comment itself, so
    // they branch off before channel resolution.
    if (type === 'comment') {
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
    if (target.type === 'whitelist') return;
    placeholderCommentThread(target.anchorEl, commentPlaceholderMessage(target.type));
  }

  // Placeholder note per tap type.
  function commentPlaceholderMessage(type) {
    if (type === 'unwhitelist') return 'Removed from whitelist';
    if (type === 'comment') return 'Blocked comment (text blocked)';
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
    try {
      const keys = Object.keys(styles);
      for (let i = 0; i < keys.length; i += 1) node.style[keys[i]] = styles[keys[i]];
    } catch (e) {}
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
      type: 'comment',
      info: { id: clean, text: clean, via: 'comment' },
    });
    placeholderCommentThread(anchorEl, commentPlaceholderMessage('comment'));
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
    placeholderCommentThread(node, commentPlaceholderMessage('comment'));
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
      return [{ label: 'Remove from Whitelist', type: 'unwhitelist' }];
    }
    const entries = [];
    if (showMenuEntry(OPT.MENU_BLOCK_CHANNEL, store)) {
      entries.push({ label: 'Block Channel', type: 'channelId' });
    }
    if (showMenuEntry(OPT.MENU_BLOCK_COMMENT, store)) {
      entries.push({ label: 'Block comment text…', type: 'comment' });
    }
    if (showMenuEntry(OPT.MENU_ALLOW_CHANNEL, store)) {
      entries.push({ label: 'Allow Channel', type: 'whitelist' });
    }
    return entries;
  }

  // Icon per entry type, matching the JSON menus (block NOT_INTERESTED,
  // allow CHECK, remove REMOVE; comment text blocks with the block icon).
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
