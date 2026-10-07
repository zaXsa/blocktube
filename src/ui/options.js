(function () {
  const has = Object.prototype.hasOwnProperty;
  const OPT = BLOCKTUBE_CONSTS.OPTIONS;

  const defaultJSFunction = `(video, objectType) => {
  // Add custom conditions below

  // Custom conditions did not match, do not block
  return false;
}`;

  const jsEditors = {};
  let isLoggedIn = false;
  // Shallow placeholder for storageData while the options page boots. The
  // full options schema lives in src/scripts/background.js (DEFAULT_OPTIONS,
  // its source of truth); saveForm() below writes every option key into
  // storageData.options, which background.js checkShape() vets on load.
  let storageData = {
    filterData: {
      javascript: defaultJSFunction,
      videoId: ['// Add your video ID filters below', ''],
      channelId: ['// Add your channel ID filters below', ''],
      channelName: ['// Add your channel name filters below', ''],
      comment: ['// Add your comment filters below', ''],
      title: ['// Add your video title filters below', ''],
      whitelist: ['// Add your allowlisted channel IDs below', ''],
    },
    options: {},
    uiPass: '',
  };

  const textAreas = ['title', 'channelName', 'channelId', 'videoId', 'comment', 'whitelist'];

  // Panel -> filter editors it hosts, for the header counts.
  const PANEL_EDITORS = {
    'panel-channel-id': ['channelId'],
    'panel-channel-name': ['channelName'],
    'panel-video-id': ['videoId'],
    'panel-video-title': ['title'],
    'panel-comments': ['comment'],
    'panel-whitelist': ['whitelist'],
  };
  let activePanel = 'panel-general';

  // Declarative binding: element id -> { path: dotted storage path, type: 'checkbox'|'text'|'select'|'number'|'array', default: value }
  // Types: checkbox stores boolean to .checked; text/select stores string to .value; number parses int for .value; array reads/writes numeric indices
  // Keep the column alignment below: range start/end ignore comments are not honored in JS.
  // prettier-ignore
  const OPTION_BINDINGS = [
    // checkboxes (options.*)
    { id: 'disable_trending',      path: `options.${OPT.TRENDING}`,             type: 'checkbox', default: false },
    { id: 'disable_shorts',        path: `options.${OPT.SHORTS}`,               type: 'checkbox', default: false },
    { id: 'disable_movies',        path: `options.${OPT.MOVIES}`,               type: 'checkbox', default: false },
    { id: 'disable_mixes',         path: `options.${OPT.MIXES}`,                type: 'checkbox', default: false },
    { id: 'disable_chips_shelves', path: `options.${OPT.CHIPS_SHELVES}`,        type: 'checkbox', default: false },
    { id: 'autoplay',              path: `options.${OPT.AUTOPLAY}`,             type: 'checkbox', default: false },
    { id: 'disable_db_normalize',  path: `options.${OPT.DISABLE_DB_NORMALIZE}`, type: 'checkbox', default: false },
    { id: 'disable_on_history',    path: `options.${OPT.DISABLE_ON_HISTORY}`,   type: 'checkbox', default: false },
    { id: 'disable_you_there',     path: `options.${OPT.DISABLE_YOU_THERE}`,    type: 'checkbox', default: false },
    { id: 'suggestions_only',      path: `options.${OPT.SUGGESTIONS_ONLY}`,     type: 'checkbox', default: false },
    { id: 'block_feedback',        path: `options.${OPT.BLOCK_FEEDBACK}`,       type: 'checkbox', default: false },
    { id: 'menu_allow_channel',    path: `options.${OPT.MENU_ALLOW_CHANNEL}`,   type: 'checkbox', default: true  },
    { id: 'menu_block_channel',    path: `options.${OPT.MENU_BLOCK_CHANNEL}`,   type: 'checkbox', default: true  },
    { id: 'menu_block_video',      path: `options.${OPT.MENU_BLOCK_VIDEO}`,     type: 'checkbox', default: true  },
    { id: 'enable_javascript',     path: `options.${OPT.ENABLE_JAVASCRIPT}`,    type: 'checkbox', default: false },
    { id: 'whitelist_mode',        path: `options.${OPT.WHITELIST_MODE}`,       type: 'checkbox', default: false },

    // text/select
    { id: 'block_message',  path: `options.${OPT.BLOCK_MESSAGE}`,  type: 'text',   default: ''      },
    { id: 'vidLength_type', path: `options.${OPT.VIDLENGTH_TYPE}`, type: 'select', default: 'allow' },

    // number
    { id: 'percent_watched_hide', path: `options.${OPT.PERCENT_WATCHED_HIDE}`, type: 'number', default: NaN },

    // ui
    { id: 'ui_theme',  path: 'uiTheme', type: 'select', default: 'light' },
    { id: 'pass_save', path: 'uiPass',  type: 'text',   default: ''      },

    // vidLength array [0,1]
    { id: 'vidLength_0', path: 'filterData.vidLength', type: 'array', index: 0, default: NaN },
    { id: 'vidLength_1', path: 'filterData.vidLength', type: 'array', index: 1, default: NaN },
  ];

  function detectColorScheme() {
    let theme = 'light';

    if (storageData.uiTheme) {
      theme = storageData.uiTheme;
    } else if (!window.matchMedia) {
      theme = 'light';
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      theme = 'dark';
    }

    if (!storageData.uiTheme) {
      storageData.uiTheme = theme;
      saveData();
    }

    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('.CodeMirror').forEach((area) => {
      if (theme === 'dark') {
        area.classList.add('cm-darktheme');
      } else {
        area.classList.remove('cm-darktheme');
      }
    });
  }

  function loadData() {
    chrome.storage.local.get('storageData', (data) => {
      if (Object.keys(data).length > 0) {
        storageData = data.storageData;
      }
      detectColorScheme();
      checkForLogin();
    });
  }

  function saveData(label = undefined) {
    if (!isLoggedIn) return;
    chrome.storage.local.set({ storageData }, () => {
      if (label !== undefined) setLabel(label, 'Options Saved');
    });
  }

  function setByPath(obj, path, value) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!has.call(cur, p) || typeof cur[p] !== 'object' || cur[p] === null) {
        cur[p] = {};
      }
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function getByPath(obj, path, def) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (cur === null || typeof cur !== 'object' || !has.call(cur, p)) return def;
      cur = cur[p];
    }
    return cur;
  }

  function saveForm() {
    textAreas.forEach((v) => {
      storageData.filterData[v] = multilineToArray(jsEditors[v].getValue());
    });

    storageData.filterData.javascript = jsEditors['javascript'].getValue();

    OPTION_BINDINGS.forEach((b) => {
      const el = $(b.id);
      if (!el) return;
      if (b.type === 'checkbox') {
        setByPath(storageData, b.path, el.checked);
      } else if (b.type === 'array') {
        let arr = getByPath(storageData, b.path, []);
        if (!Array.isArray(arr)) arr = [];
        arr[b.index] = parseInt(el.value, 10);
        setByPath(storageData, b.path, arr);
      } else if (b.type === 'number') {
        const val = parseInt(el.value, 10);
        setByPath(storageData, b.path, val);
      } else if (b.type === 'text' || b.type === 'select') {
        setByPath(storageData, b.path, el.value);
      }
    });

    saveData('status_save');
    detectColorScheme();
    $('save_btn').classList.add('disabled-btn');
    $('dirty_flag').hidden = true;
  }

  function loginForm() {
    const savedPass = storageData.uiPass;
    if (savedPass && savedPass === $('pass_login').value) {
      unlockPage();
      isLoggedIn = true;
    } else {
      setLabel('status_login', 'Incorrect Password');
    }
  }

  function unlockPage() {
    populateForms();
    $('options').setAttribute('style', '');
    $('login').setAttribute('style', 'display: none');
  }

  function checkForLogin() {
    if (has.call(storageData, 'uiPass') && storageData.uiPass !== '') {
      $('login').setAttribute('style', '');
    } else {
      isLoggedIn = true;
      unlockPage();
    }
  }

  function populateForms(obj = undefined) {
    // Pre-whitelist stored blobs and backups lack the allowlist: default to
    // an empty list so the editor, export, and counts see [] (Phase 1: the
    // inject realm still ignores both the flag and the list).
    if (storageData.filterData && !Array.isArray(storageData.filterData.whitelist)) {
      storageData.filterData.whitelist = [];
    }
    textAreas.forEach((v) => {
      const content = get(`filterData.${v}`, [], obj);
      jsEditors[v].setValue(content.join('\n'));
    });

    const jsContent = get('filterData.javascript', defaultJSFunction, obj);
    jsEditors['javascript'].setValue(jsContent);

    OPTION_BINDINGS.forEach((b) => {
      const el = $(b.id);
      if (!el) return;
      const val = get(b.path, b.default, obj);
      if (b.type === 'checkbox') {
        el.checked = !!val;
      } else if (b.type === 'array') {
        const arr = Array.isArray(val) ? val : [b.default, b.default];
        el.value = arr[b.index];
      } else if (b.type === 'number') {
        // keep NaN as-is for empty number fields
        el.value = isNaN(val) ? '' : val;
      } else if (b.type === 'text' || b.type === 'select') {
        el.value = val;
      }
    });

    if ($('enable_javascript').checked) {
      $('advanced_tab').style.removeProperty('display');
    }

    // refresh CodeMirror editors after the panel becomes visible (a/19970695)
    setTimeout(() => Object.values(jsEditors).forEach((v) => v.refresh()), 1);
    $('save_btn').classList.add('disabled-btn');
    $('dirty_flag').hidden = true;
    applyReadOnlyMarks();
    updateCounts();
    updateWarnings();
    Object.keys(TABLE_EDITORS).forEach((key) => {
      refreshTable(key);
      updateRawSearch(key);
      // A populate (e.g. import) while raw is open replaces content and
      // re-locks: raw stays free-editing.
      if (!$(TABLE_EDITORS[key].editorWrap).hidden) clearReadOnlyMarks(key);
    });
    updateWhitelistUI();
  }

  // !! Helpers
  function $(id) {
    return document.getElementById(id);
  }

  function multilineToArray(text) {
    // .trim() per line is intentional: it also strips the trailing newline
    // most textarea/editor values end with, so empty inputs yield [] not ['']
    return text
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((x) => x.trim());
  }

  // Mirrors src/scripts/inject/paths.js#getObjectByPath for the options page
  // (no bundle share between these two contexts): dotted-path walk with the
  // same "at an array node, find the FIRST element that owns the key" trap.
  // The trap is documented once, next to getObjectByPath; keep this in sync.
  function get(path, def = undefined, obj = undefined) {
    const paths = path instanceof Array ? path : path.split('.');
    let nextObj = obj || storageData;

    const exist = paths.every((v) => {
      if (nextObj instanceof Array) {
        const found = nextObj.find((o) => has.call(o, v));
        if (found === undefined) return false;
        nextObj = found[v];
      } else {
        if (!nextObj || !has.call(nextObj, v)) return false;
        nextObj = nextObj[v];
      }
      return true;
    });

    return exist ? nextObj : def;
  }

  function setLabel(label, text) {
    const status = $(label);
    status.textContent = text;
    status.classList.add('alert-animate');
    setTimeout(() => {
      status.textContent = '';
      status.classList.remove('alert-animate');
    }, 1000);
  }

  // Header counts: active (non-empty, non-`//`) entries per visible panel
  // plus the total across all filter editors.
  function updateCounts() {
    let total = 0;
    const perEditor = {};
    Object.values(PANEL_EDITORS).forEach((keys) => {
      keys.forEach((key) => {
        const n = BLOCKTUBE_ANNOTATIONS.countActiveEntries(jsEditors[key].getValue().split('\n'));
        perEditor[key] = n;
        total += n;
      });
    });
    const keys = PANEL_EDITORS[activePanel] || [];
    const panelTotal = keys.reduce((sum, key) => sum + (perEditor[key] || 0), 0);
    $('opt_counts').textContent =
      keys.length > 0 ? `${panelTotal} in this panel · ${total} total` : `${total} total`;
  }

  // Invalid-regex warnings below the regex-evaluated editors (after the
  // table/raw views, so showing them never shifts the list): lines that
  // would fail RegExp construction downstream (and so never match).
  // Invalid-ID warnings below the ID editors: ID lines are wrapped raw
  // (`^id$`), so a line outside the ID charset either never matches or —
  // like `.*` — matches far more than intended. Informational only in both
  // cases — saving is never blocked.
  const WARNING_EDITORS = {
    title: 'warning-title',
    channelName: 'warning-channelName',
    comment: 'warning-comment',
  };
  const WARNING_IDS = {
    channelId: 'warning-channelId',
    videoId: 'warning-videoId',
    whitelist: 'warning-whitelist',
  };

  function renderWarning(warnId, lineNumbers, message) {
    const warn = $(warnId);
    if (lineNumbers.length === 0) {
      warn.classList.add('is-hidden');
      warn.textContent = '';
      return;
    }
    warn.classList.remove('is-hidden');
    warn.textContent =
      `⚠ ${message} on line${lineNumbers.length > 1 ? 's' : ''} ${lineNumbers.join(', ')} — ` +
      'saving is still allowed.';
  }

  function updateWarnings() {
    Object.entries(WARNING_EDITORS).forEach(([key, warnId]) => {
      const bad = BLOCKTUBE_ANNOTATIONS.findInvalidRegexLines(
        jsEditors[key].getValue().split('\n'),
      );
      renderWarning(
        warnId,
        bad.map((entry) => entry.index + 1),
        'Invalid regex — these lines never match',
      );
    });
    Object.entries(WARNING_IDS).forEach(([key, warnId]) => {
      const bad = [];
      jsEditors[key]
        .getValue()
        .split('\n')
        .forEach((line, index) => {
          const trimmed = line.trim();
          if (trimmed !== '' && !trimmed.startsWith('//')) {
            if (!BLOCKTUBE_ANNOTATIONS.isValidFilterId(trimmed)) bad.push(index + 1);
          }
        });
      renderWarning(warnId, bad, 'Invalid ID — may match far more than intended');
    });
  }

  // Whitelist mode (WHITELIST_PLAN.md Phase 1): one flag, two surfaces. Mode
  // on -> the Whitelist panel, General, and Export / Import stay usable (UI
  // theme/password must never be locked out, stored General values like
  // block_message stay honored, and backup/restore stays available); every
  // other panel hides. Mode off -> the Whitelist panel hides
  // and the normal UI returns. The inject realm ignores both the flag and the
  // list in this phase.
  const WHITELIST_VISIBLE = ['panel-whitelist', 'panel-general', 'panel-data'];

  function isWhitelistModeOn() {
    const el = $('whitelist_mode');
    if (el) return el.checked === true;
    return !!get('options.whitelist_mode', false);
  }

  function updateWhitelistUI() {
    const on = isWhitelistModeOn();
    const visible = (panel) =>
      on ? WHITELIST_VISIBLE.includes(panel) : panel !== 'panel-whitelist';
    document.querySelectorAll('.opt-nav-btn').forEach((btn) => {
      btn.style.display = visible(btn.getAttribute('aria-controls')) ? '' : 'none';
    });
    if (on && !WHITELIST_VISIBLE.includes(activePanel)) {
      const wlBtn = document.querySelector('.opt-nav-btn[data-panel="panel-whitelist"]');
      if (wlBtn) wlBtn.click();
    } else if (!on && activePanel === 'panel-whitelist') {
      const genBtn = document.querySelector('.opt-nav-btn[data-panel="panel-general"]');
      if (genBtn) genBtn.click();
    }
    // The nav click above already hides the other panels; enforce again so a
    // direct call (e.g. populate before any click) still converges.
    document.querySelectorAll('.opt-panel').forEach((panel) => {
      if (!visible(panel.id)) {
        panel.style.display = 'none';
      } else {
        panel.style.display = panel.id === activePanel ? 'block' : 'none';
      }
    });
    // The newly shown panel's editor measured while hidden: refresh after
    // layout settles so the first render is never blank.
    if (jsEditors.whitelist) {
      setTimeout(() => jsEditors.whitelist.refresh(), 1);
    }
  }

  // Counts/warnings re-scan every editor (tens of ms on huge lists), so
  // the keystroke-heavy change path debounces while discrete actions
  // (navigation, populate, table edits) update immediately.
  let countsTimer = 0;

  function scheduleCounts() {
    clearTimeout(countsTimer);
    countsTimer = setTimeout(() => {
      updateCounts();
      updateWarnings();
      // Keep raw match positions accurate while typing with an active query.
      Object.keys(TABLE_EDITORS).forEach((key) => {
        if (!$(TABLE_EDITORS[key].editorWrap).hidden) updateRawSearch(key);
      });
    }, 150);
  }

  function showAddNotice(noticeId, text) {
    const notice = $(noticeId);
    notice.textContent = text;
    notice.classList.remove('is-hidden');
    clearTimeout(notice.hideTimer);
    notice.hideTimer = setTimeout(() => {
      notice.classList.add('is-hidden');
      notice.textContent = '';
    }, 3000);
  }

  // Add-box validators return a notice text, or null when acceptable.
  function validateFilterId(id) {
    if (id === '') return 'Paste an ID first.';
    if (!BLOCKTUBE_ANNOTATIONS.isValidFilterId(id)) {
      return 'Invalid ID — letters, digits, _ and - only, up to 64 chars.';
    }
    return null;
  }

  function validatePattern(id) {
    if (id === '') return 'Paste a keyword or /regex/ first.';
    const bad = BLOCKTUBE_ANNOTATIONS.findInvalidRegexLines([id]);
    return bad.length > 0 ? 'Invalid regex — check the pattern and flags.' : null;
  }

  // One-line Add box for an editor: raw IDs or keywords/regex (per
  // validator), trimmed, validated, deduped against existing non-annotation
  // lines. Appends the entry with a dated provenance comment and marks dirty
  // via the editor change event. No URL parsing, no handle resolution.
  function setupAddBox(editorKey, inputId, buttonId, noticeId, validate) {
    const add = () => {
      const input = $(inputId);
      const id = input.value.trim();
      const problem = validate(id);
      if (problem !== null) {
        showAddNotice(noticeId, problem);
        return;
      }
      const existing = BLOCKTUBE_ANNOTATIONS.splitAnnotations(
        jsEditors[editorKey].getValue().split('\n'),
      ).rules.map((line) => line.trim());
      if (existing.includes(id)) {
        showAddNotice(noticeId, 'Already in the list.');
        return;
      }
      const cm = jsEditors[editorKey];
      const current = cm.getValue();
      // Provenance comment mirroring the context-menu format
      // (`// Blocked by context menu (<text>) (<date>)`, allowlist entries
      // use `// Allowlisted …`). No handle is known
      // here, so that slot stays blank instead of repeating the ID, and the
      // locale date matches content_script.js. Groups are separated by a
      // blank line, like the context-menu groups.
      const now = new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      }).format(new Date());
      const annotation =
        editorKey === 'whitelist'
          ? `// Allowlisted by direct add () (${now})`
          : `// Blocked by direct add () (${now})`;
      const prefix = current.trim() === '' ? '' : `${current.replace(/\n+$/, '')}\n\n`;
      cm.setValue(`${prefix}${annotation}\n${id}\n`);
      applyReadOnlyMarks(editorKey);
      // The Add box stays visible in raw mode: adding must not re-lock it.
      if (TABLE_EDITORS[editorKey] && !$(TABLE_EDITORS[editorKey].editorWrap).hidden) {
        clearReadOnlyMarks(editorKey);
      }
      // A lingering search filter would hide the new row: clear it. Reveal
      // it now in table mode, or on return when adding from raw mode.
      if (TABLE_EDITORS[editorKey]) {
        const t = TABLE_EDITORS[editorKey];
        $(t.search).value = '';
        tableState[editorKey].query = '';
        tableState[editorKey].pendingAddedId = id;
      }
      refreshTable(editorKey, true);
      if (TABLE_EDITORS[editorKey] && !$(TABLE_EDITORS[editorKey].tableWrap).hidden) {
        jumpToAddedRow(editorKey);
      }
      updateRawSearch(editorKey);
      input.value = '';
      input.focus();
    };
    $(buttonId).addEventListener('click', add);
    $(inputId).addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter') {
        evt.preventDefault();
        add();
      }
    });
  }

  // Entity tables for the filter lists: one row per entry over the
  // unchanged array storage. Table mutations splice the editor's lines and
  // setValue, so dirty/counts/marks/warnings/save paths are reused untouched.
  // Rows are cheap objects; true paging keeps one page in the DOM. All row
  // content is set via textContent (raw mode allows arbitrary text).
  const TABLE_CHUNK = 150;
  const TABLE_EDITORS = {
    channelId: {
      rows: 'channelId_rows',
      scroll: 'channelId_table_scroll',
      search: 'channelId_search',
      shown: 'channelId_shown',
      toggle: 'channelId_raw_toggle',
      jumpTop: 'channelId_jump_top',
      jumpEnd: 'channelId_jump_end',
      tableWrap: 'channelId_table_wrap',
      editorWrap: 'channelId_editor_wrap',
      range: 'channelId_range',
      page: 'channelId_page',
      pages: 'channelId_pages',
      pageGo: 'channelId_page_go',
      prev: 'channelId_prev',
      next: 'channelId_next',
      top: 'channelId_top',
      end: 'channelId_end',
    },
    videoId: {
      rows: 'videoId_rows',
      scroll: 'videoId_table_scroll',
      search: 'videoId_search',
      shown: 'videoId_shown',
      toggle: 'videoId_raw_toggle',
      jumpTop: 'videoId_jump_top',
      jumpEnd: 'videoId_jump_end',
      tableWrap: 'videoId_table_wrap',
      editorWrap: 'videoId_editor_wrap',
      range: 'videoId_range',
      page: 'videoId_page',
      pages: 'videoId_pages',
      pageGo: 'videoId_page_go',
      prev: 'videoId_prev',
      next: 'videoId_next',
      top: 'videoId_top',
      end: 'videoId_end',
    },
    channelName: {
      rows: 'channelName_rows',
      scroll: 'channelName_table_scroll',
      search: 'channelName_search',
      shown: 'channelName_shown',
      toggle: 'channelName_raw_toggle',
      jumpTop: 'channelName_jump_top',
      jumpEnd: 'channelName_jump_end',
      tableWrap: 'channelName_table_wrap',
      editorWrap: 'channelName_editor_wrap',
      range: 'channelName_range',
      page: 'channelName_page',
      pages: 'channelName_pages',
      pageGo: 'channelName_page_go',
      prev: 'channelName_prev',
      next: 'channelName_next',
      top: 'channelName_top',
      end: 'channelName_end',
    },
    title: {
      rows: 'title_rows',
      scroll: 'title_table_scroll',
      search: 'title_search',
      shown: 'title_shown',
      toggle: 'title_raw_toggle',
      jumpTop: 'title_jump_top',
      jumpEnd: 'title_jump_end',
      tableWrap: 'title_table_wrap',
      editorWrap: 'title_editor_wrap',
      range: 'title_range',
      page: 'title_page',
      pages: 'title_pages',
      pageGo: 'title_page_go',
      prev: 'title_prev',
      next: 'title_next',
      top: 'title_top',
      end: 'title_end',
    },
    comment: {
      rows: 'comment_rows',
      scroll: 'comment_table_scroll',
      search: 'comment_search',
      shown: 'comment_shown',
      toggle: 'comment_raw_toggle',
      jumpTop: 'comment_jump_top',
      jumpEnd: 'comment_jump_end',
      tableWrap: 'comment_table_wrap',
      editorWrap: 'comment_editor_wrap',
      range: 'comment_range',
      page: 'comment_page',
      pages: 'comment_pages',
      pageGo: 'comment_page_go',
      prev: 'comment_prev',
      next: 'comment_next',
      top: 'comment_top',
      end: 'comment_end',
    },
    whitelist: {
      rows: 'whitelist_rows',
      scroll: 'whitelist_table_scroll',
      search: 'whitelist_search',
      shown: 'whitelist_shown',
      toggle: 'whitelist_raw_toggle',
      jumpTop: 'whitelist_jump_top',
      jumpEnd: 'whitelist_jump_end',
      tableWrap: 'whitelist_table_wrap',
      editorWrap: 'whitelist_editor_wrap',
      range: 'whitelist_range',
      page: 'whitelist_page',
      pages: 'whitelist_pages',
      pageGo: 'whitelist_page_go',
      prev: 'whitelist_prev',
      next: 'whitelist_next',
      top: 'whitelist_top',
      end: 'whitelist_end',
      // Empty-state message rendered as a placeholder row inside the table
      // (not a box above it): it vanishes on its own once items are added.
      emptyText:
        'Allowlist is empty — nothing with a channel will show until you add a channel ID.',
    },
  };
  const tableState = {};

  function tableLines(key) {
    return jsEditors[key].getValue().split('\n');
  }

  // `context menu` / `direct add` as the short "added via" tag.
  function provenanceKind(kind) {
    if (kind === 'context menu') return 'context';
    if (kind === 'direct add') return 'manual';
    return kind;
  }

  function tableRowText(row) {
    return `${String(row.id)}\n${row.label}\n${row.provenanceLine}`.toLowerCase();
  }

  function refreshTable(key, keepPosition) {
    const state = tableState[key];
    if (!state) return;
    // Anchor on the first visible row so edits keep the exact view instead
    // of throwing the user back to the top: re-locate it by ID after the
    // rebuild (indices shift).
    let anchorId = null;
    const anchorPos = state.firstVisible || state.renderStart || 0;
    if (keepPosition === true && state.filtered.length > 0 && anchorPos < state.filtered.length) {
      anchorId = String(state.filtered[anchorPos].id);
    }
    // applyTableQuery re-parses rows fresh from the editor.
    applyTableQuery(key);
    if (keepPosition === true && state.filtered.length > 0) {
      let pos = state.filtered.findIndex((row) => String(row.id) === anchorId);
      if (pos < 0) pos = Math.min(anchorPos, state.filtered.length - 1);
      if (pos > 0) goToTablePage(key, Math.floor(pos / TABLE_CHUNK) + 1);
    }
  }

  function applyTableQuery(key) {
    const state = tableState[key];
    // Always re-parse: raw typing changes lines without touching table state.
    state.rows = BLOCKTUBE_ANNOTATIONS.parseRuleRows(tableLines(key));
    const query = state.query.trim().toLowerCase();
    state.filtered =
      query === '' ? state.rows : state.rows.filter((row) => tableRowText(row).includes(query));
    goToTablePage(key, 1);
  }

  // True paging: exactly one page lives in the DOM. Nothing mutates while
  // scrolling, so the view cannot jitter, drift, or cascade.
  function renderTablePage(key) {
    const t = TABLE_EDITORS[key];
    const state = tableState[key];
    const fragment = document.createDocumentFragment();
    const end = Math.min(state.renderStart + TABLE_CHUNK, state.filtered.length);
    for (let i = state.renderStart; i < end; i++) {
      fragment.appendChild(buildTableRow(key, state.filtered[i], i + 1));
    }
    if (state.filtered.length === 0 && state.rows.length === 0 && t.emptyText) {
      const tr = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 5;
      cell.className = 'cell-empty';
      cell.textContent = t.emptyText;
      tr.appendChild(cell);
      fragment.appendChild(tr);
    }
    $(t.rows).textContent = '';
    $(t.rows).appendChild(fragment);
    state.shown = end;
    updateTableShown(key);
  }

  // Jump to a 1-based page of TABLE_CHUNK rows: renders just that window
  // (scrolling further appends from there as usual).
  function goToTablePage(key, page) {
    const t = TABLE_EDITORS[key];
    const state = tableState[key];
    const pages = Math.max(1, Math.ceil(state.filtered.length / TABLE_CHUNK));
    const safe = Math.min(Math.max(1, page || 1), pages);
    state.renderStart = (safe - 1) * TABLE_CHUNK;
    state.shown = state.renderStart;
    state.firstVisible = state.renderStart;
    $(t.rows).textContent = '';
    $(t.page).value = String(safe);
    $(t.scroll).scrollTop = 0;
    renderTablePage(key);
  }

  // Keep the page number in sync with the scroll position, derived from the
  // first visible row (exact: matches the # column). Binary search keeps it
  // cheap on large windows. Never fights the user while the page input
  // itself is focused.
  function syncTablePage(key) {
    const t = TABLE_EDITORS[key];
    const state = tableState[key];
    const scroller = $(t.scroll);
    const rows = $(t.rows).children;
    if (rows.length > 0) {
      const thead = scroller.querySelector('thead');
      const top = scroller.getBoundingClientRect().top + (thead ? thead.offsetHeight : 0);
      let lo = 0;
      let hi = rows.length - 1;
      let first = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (rows[mid].getBoundingClientRect().bottom > top) {
          first = mid;
          hi = mid - 1;
        } else {
          lo = mid + 1;
        }
      }
      state.firstVisible = state.renderStart + first;
    }
    const pageInput = $(t.page);
    if (document.activeElement !== pageInput) {
      pageInput.value = String(Math.floor((state.firstVisible || 0) / TABLE_CHUNK) + 1);
    }
    updateTableShown(key);
  }

  function updateTableShown(key) {
    const t = TABLE_EDITORS[key];
    const state = tableState[key];
    if (!$(t.editorWrap).hidden) {
      const n = (state.rawMatches || []).length;
      if (state.query.trim() === '') {
        $(t.shown).textContent = `${state.rows.length} rows`;
      } else if (n === 0) {
        $(t.shown).textContent = `0/${state.rows.length} — no matches`;
      } else {
        $(t.shown).textContent = `${state.rawIndex + 1}/${n}${state.rawCapped ? '+' : ''} matches`;
      }
      $(t.range).textContent = '';
      $(t.pages).textContent = '';
      return;
    }
    $(t.shown).textContent =
      state.query.trim() === ''
        ? `${state.shown} of ${state.rows.length}`
        : `${state.shown} of ${state.filtered.length} (from ${state.rows.length})`;
    // Footer range shows the visible window (exact, like the # column).
    const from = state.filtered.length === 0 ? 0 : (state.firstVisible || 0) + 1;
    $(t.range).textContent = `Rows ${from}–${state.shown} of ${state.filtered.length}`;
    $(t.pages).textContent = `of ${Math.max(1, Math.ceil(state.filtered.length / TABLE_CHUNK))}`;
  }

  // Raw-list search: the same toolbar query highlights matches in place
  // (nothing hidden) instead of filtering rows. Enter/Shift+Enter steps
  // through matches; the current one renders distinctly.
  const RAW_SEARCH_MAX = 1000;

  function clearRawSearch(key) {
    const state = tableState[key];
    (state.rawMarks || []).forEach((mark) => {
      try {
        mark.clear();
      } catch (e) {
        // Mark already cleared by content replacement; nothing to do.
      }
    });
    state.rawMarks = [];
    state.rawMatches = [];
    state.rawIndex = -1;
  }

  function updateRawSearch(key) {
    if (!TABLE_EDITORS[key] || !tableState[key]) return;
    const t = TABLE_EDITORS[key];
    const state = tableState[key];
    clearRawSearch(key);
    // Fresh rows: raw typing changes lines without touching table state.
    state.rows = BLOCKTUBE_ANNOTATIONS.parseRuleRows(tableLines(key));
    if ($(t.editorWrap).hidden) {
      updateTableShown(key);
      return;
    }
    const query = state.query.trim();
    if (query === '') {
      updateTableShown(key);
      return;
    }
    const cm = jsEditors[key];
    const matches = [];
    const cursor = cm.getSearchCursor(query, { line: 0, ch: 0 }, true);
    while (matches.length < RAW_SEARCH_MAX && cursor.findNext()) {
      matches.push({ from: cursor.from(), to: cursor.to() });
    }
    state.rawMatches = matches;
    state.rawCapped = matches.length >= RAW_SEARCH_MAX;
    // Same mark class as the Ctrl-F overlay: highlighting is identical.
    state.rawMarks = matches.map((match) =>
      cm.markText(match.from, match.to, { className: 'cm-searching' }),
    );
    state.rawIndex = matches.length > 0 ? 0 : -1;
    if (matches.length > 0) {
      cm.setSelection(matches[0].from, matches[0].to);
      cm.scrollIntoView({ from: matches[0].from, to: matches[0].to }, 20);
    }
    updateTableShown(key);
  }

  function stepRawSearch(key, direction) {
    const state = tableState[key];
    if (state.rawMatches.length === 0) return;
    state.rawIndex =
      (state.rawIndex + direction + state.rawMatches.length) % state.rawMatches.length;
    // Selection alone marks the current match — exactly like Ctrl-F stepping.
    const cm = jsEditors[key];
    const current = state.rawMatches[state.rawIndex];
    cm.setSelection(current.from, current.to);
    cm.scrollIntoView({ from: current.from, to: current.to }, 20);
    updateTableShown(key);
  }

  // Reveal a just-added row: jump to its page, then bring the row itself
  // into view (rather than snapping the page to the top). Consumes the
  // pending marker.
  function jumpToAddedRow(key) {
    const t = TABLE_EDITORS[key];
    const state = tableState[key];
    const id = state.pendingAddedId;
    if (!id) return;
    state.pendingAddedId = null;
    const pos = state.filtered.findIndex((row) => String(row.id) === id);
    if (pos < 0) return;
    goToTablePage(key, Math.floor(pos / TABLE_CHUNK) + 1);
    const row = state.filtered[pos];
    const tr = $(t.rows).querySelector(`tr[data-rule-index="${row.ruleIndex}"]`);
    if (tr && tr.scrollIntoView) tr.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function buildTableRow(key, row, displayIndex) {
    const tr = document.createElement('tr');
    tr.dataset.ruleIndex = String(row.ruleIndex);
    tr.dataset.entryId = String(row.id);

    const indexCell = document.createElement('td');
    indexCell.className = 'cell-index muted';
    indexCell.textContent = String(displayIndex);
    tr.appendChild(indexCell);

    const idCell = document.createElement('td');
    // Exact IDs are short and stay on one line; patterns (names, titles,
    // comments) may be long, so they wrap instead of widening the table.
    idCell.className =
      key === 'channelId' || key === 'videoId' || key === 'whitelist' ? 'cell-id' : 'cell-pattern';
    idCell.title = String(row.id);
    idCell.textContent = String(row.id);
    tr.appendChild(idCell);

    const labelCell = document.createElement('td');
    renderLabelCell(labelCell, row);
    tr.appendChild(labelCell);

    const dateCell = document.createElement('td');
    dateCell.className = 'cell-date';
    if (row.provenance !== null) {
      const date = document.createElement('div');
      if (row.provenance.date !== '') {
        date.textContent = row.provenance.date;
      } else {
        // Pre-date entries: the date was never stored, but the source is.
        date.textContent = '—';
        date.className = 'muted';
      }
      dateCell.appendChild(date);
      const via = document.createElement('div');
      via.className = 'muted small';
      via.textContent = provenanceKind(row.provenance.kind);
      dateCell.appendChild(via);
      dateCell.title = row.provenanceLine;
    } else {
      dateCell.textContent = '—';
      if (row.provenanceLine !== '') dateCell.title = row.provenanceLine;
    }
    tr.appendChild(dateCell);

    const actionCell = document.createElement('td');
    actionCell.className = 'col-action';
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'row-remove';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove this entry';
    removeBtn.dataset.action = 'remove';
    actionCell.appendChild(removeBtn);
    tr.appendChild(actionCell);
    return tr;
  }

  function renderLabelCell(cell, row) {
    cell.className = 'cell-label';
    cell.textContent = '';
    const text = document.createElement('span');
    // Without a manual label, fall back to the provenance text (e.g. the
    // video/channel title the context menu captured), muted to tell apart.
    const fallback = row.provenance !== null ? row.provenance.text : '';
    const shown = row.label !== '' ? row.label : fallback;
    if (shown === '') {
      text.textContent = '—';
      text.className = 'muted';
    } else {
      text.textContent = shown;
      if (row.label === '') text.className = 'muted';
    }
    text.title = row.provenanceLine !== '' ? `${shown} — ${row.provenanceLine}` : shown;
    cell.appendChild(text);
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'row-edit';
    editBtn.textContent = '✎';
    editBtn.title = 'Edit label';
    editBtn.dataset.action = 'edit-label';
    cell.appendChild(editBtn);
  }

  function writeTableLines(key, lines) {
    jsEditors[key].setValue(lines.join('\n'));
    applyReadOnlyMarks(key);
    refreshTable(key, true);
    updateCounts();
  }

  // Re-parse before acting: the stored lines may have changed since the row
  // was rendered (e.g. a context-menu block landing while the page is open).
  function findLiveRow(key, ruleIndex, id) {
    const row = BLOCKTUBE_ANNOTATIONS.parseRuleRows(tableLines(key)).find(
      (entry) => entry.ruleIndex === ruleIndex,
    );
    return row !== undefined && String(row.id) === id ? row : null;
  }

  function startLabelEdit(key, ruleIndex, id, tr) {
    const row = findLiveRow(key, ruleIndex, id);
    if (!row) {
      refreshTable(key);
      return;
    }
    const cell = tr.children[2];
    cell.textContent = '';
    // Captioned so the input unmistakably edits the label, not the ID.
    const caption = document.createElement('div');
    caption.className = 'muted small';
    caption.textContent = 'Label:';
    cell.appendChild(caption);
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'label-input';
    input.value = row.label;
    input.setAttribute('maxlength', '200');
    cell.appendChild(input);
    input.focus();
    input.select();
    let done = false;
    const commit = (save) => {
      if (done) return;
      done = true;
      if (save) {
        writeTableLines(
          key,
          BLOCKTUBE_ANNOTATIONS.setRuleLabel(tableLines(key), ruleIndex, input.value),
        );
      } else {
        refreshTable(key);
      }
    };
    input.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter') commit(true);
      else if (evt.key === 'Escape') commit(false);
    });
    input.addEventListener('blur', () => commit(true));
  }

  function setupTable(key) {
    const t = TABLE_EDITORS[key];
    tableState[key] = { query: '', rows: [], filtered: [], shown: 0, renderStart: 0 };
    $(t.search).addEventListener('input', (evt) => {
      tableState[key].query = evt.target.value;
      if ($(t.editorWrap).hidden) applyTableQuery(key);
      else updateRawSearch(key);
    });
    $(t.search).addEventListener('keydown', (evt) => {
      if (!$(t.editorWrap).hidden && evt.key === 'Enter') {
        evt.preventDefault();
        stepRawSearch(key, evt.shiftKey ? -1 : 1);
      }
    });
    // One page lives in the DOM, so scrolling never mutates anything: the
    // handler only syncs the page number (rAF-throttled).
    $(t.scroll).addEventListener('scroll', () => {
      const st = tableState[key];
      if (st.scrollTick) return;
      st.scrollTick = true;
      const sync = () => {
        st.scrollTick = false;
        syncTablePage(key);
      };
      if (window.requestAnimationFrame) window.requestAnimationFrame(sync);
      else sync();
    });
    $(t.rows).addEventListener('click', (evt) => {
      const btn = evt.target.closest('button[data-action]');
      if (!btn) return;
      const tr = btn.closest('tr');
      if (!tr) return;
      const ruleIndex = parseInt(tr.dataset.ruleIndex, 10);
      const id = tr.dataset.entryId;
      if (btn.dataset.action === 'remove') {
        if (findLiveRow(key, ruleIndex, id) === null) {
          refreshTable(key);
          return;
        }
        writeTableLines(key, BLOCKTUBE_ANNOTATIONS.removeRuleLines(tableLines(key), ruleIndex));
      } else if (btn.dataset.action === 'edit-label') {
        startLabelEdit(key, ruleIndex, id, tr);
      }
    });
    $(t.toggle).addEventListener('click', () => {
      const tableWrap = $(t.tableWrap);
      const editorWrap = $(t.editorWrap);
      // Pre-click state: was showing table means we are switching to raw.
      const wasShowingTable = !tableWrap.hidden;
      tableWrap.hidden = wasShowingTable;
      editorWrap.hidden = !wasShowingTable;
      $(t.toggle).value = wasShowingTable ? 'Table' : 'Raw list';
      if (wasShowingTable) {
        // Now showing raw: measure after layout settles (rAF + timeout),
        // otherwise the first render can come up blank until the next click
        // forces a re-render. Raw mode is free editing.
        const cm = jsEditors[key];
        cm.refresh();
        if (window.requestAnimationFrame) {
          window.requestAnimationFrame(() => cm.refresh());
        }
        setTimeout(() => cm.refresh(), 50);
        clearReadOnlyMarks(key);
        updateRawSearch(key);
      } else {
        // Now showing table.
        clearRawSearch(key);
        applyReadOnlyMarks(key);
        refreshTable(key);
        jumpToAddedRow(key);
      }
    });
    const goToPageInput = () => goToTablePage(key, parseInt($(t.page).value, 10));
    $(t.pageGo).addEventListener('click', goToPageInput);
    const stepPage = (direction) => {
      // goToTablePage clamps into range.
      goToTablePage(key, parseInt($(t.page).value, 10) + direction);
    };
    $(t.prev).addEventListener('click', () => stepPage(-1));
    $(t.next).addEventListener('click', () => stepPage(1));
    $(t.page).addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter') goToPageInput();
    });
    $(t.top).addEventListener('click', () => goToTablePage(key, 1));
    $(t.end).addEventListener('click', () => {
      goToTablePage(key, Math.ceil(tableState[key].filtered.length / TABLE_CHUNK));
      $(t.scroll).scrollTop = $(t.scroll).scrollHeight;
    });
    // Toolbar jumps work in both views: table pages vs raw first/last line.
    $(t.jumpTop).addEventListener('click', () => {
      if ($(t.editorWrap).hidden) {
        goToTablePage(key, 1);
        return;
      }
      const cm = jsEditors[key];
      cm.setCursor({ line: 0, ch: 0 });
      cm.scrollIntoView({ line: 0, ch: 0 }, 20);
    });
    $(t.jumpEnd).addEventListener('click', () => {
      if ($(t.editorWrap).hidden) {
        goToTablePage(key, Math.ceil(tableState[key].filtered.length / TABLE_CHUNK));
        $(t.scroll).scrollTop = $(t.scroll).scrollHeight;
        return;
      }
      const cm = jsEditors[key];
      const last = cm.lastLine();
      const endCh = (cm.getLine(last) || '').length;
      cm.setCursor({ line: last, ch: endCh });
      cm.scrollIntoView({ line: last, ch: endCh }, 20);
    });
    refreshTable(key);
  }

  // Lock `//` annotation lines inside the editors via read-only marks.
  // All six filter editors are table-backed now, so none take locks: hidden
  // in table mode (marks invisible and irrelevant) and free editing in raw
  // mode — this also avoids re-marking tens of thousands of lines.
  // Marks die on setValue; the save path preserves text regardless.
  const readOnlyMarks = {};

  function clearReadOnlyMarks(editorKey) {
    const keys = editorKey === undefined ? textAreas : [editorKey];
    keys.forEach((key) => {
      (readOnlyMarks[key] || []).forEach((mark) => {
        try {
          mark.clear();
        } catch (e) {
          // Already cleared by content replacement; nothing to do.
        }
      });
      readOnlyMarks[key] = [];
    });
  }

  function applyReadOnlyMarks(editorKey) {
    const keys = editorKey === undefined ? textAreas : [editorKey];
    keys.forEach((key) => {
      const cm = jsEditors[key];
      if (!cm) return;
      // Table-backed editors never take locks: hidden in table mode (marks
      // invisible and irrelevant — saving preserves text regardless), free
      // editing in raw mode. This also avoids re-marking tens of thousands
      // of lines on every edit.
      if (TABLE_EDITORS[key]) {
        clearReadOnlyMarks(key);
        return;
      }
      (readOnlyMarks[key] || []).forEach((mark) => mark.clear());
      const marks = [];
      const lines = cm.getValue().split('\n');
      BLOCKTUBE_ANNOTATIONS.splitAnnotations(lines).annotations.forEach((entry) => {
        if (entry.line.trim() === '' || entry.index >= cm.lineCount()) return;
        const text = cm.getLine(entry.index) || '';
        marks.push(
          cm.markText(
            { line: entry.index, ch: 0 },
            { line: entry.index, ch: text.length },
            { readOnly: true, className: 'cm-annotation-locked' },
          ),
        );
      });
      readOnlyMarks[key] = marks;
    });
  }

  function saveFile(data, fileName) {
    const a = document.createElement('a');
    const blob = new Blob([JSON.stringify(data)], { type: 'octet/stream' });
    const url = URL.createObjectURL(blob);
    setTimeout(() => {
      a.href = url;
      a.download = fileName;
      const event = new MouseEvent('click');
      a.dispatchEvent(event);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 0);
  }

  // Backup shape gate: truthiness alone would let a malformed file through
  // and persist defaults over the user's real lists. Missing lists fall back
  // to defaults in populateForms; present ones must actually be arrays.
  const BACKUP_LISTS = ['videoId', 'channelId', 'channelName', 'comment', 'title', 'whitelist'];

  function isValidBackup(json) {
    if (!json || typeof json !== 'object' || Array.isArray(json)) return false;
    const { filterData, options } = json;
    if (!filterData || typeof filterData !== 'object' || Array.isArray(filterData)) return false;
    if (!options || typeof options !== 'object' || Array.isArray(options)) return false;
    return BACKUP_LISTS.every(
      (key) => filterData[key] === undefined || Array.isArray(filterData[key]),
    );
  }

  function importOptions(evt) {
    const files = evt.target.files;
    const f = files && files[0];
    if (!(f instanceof File)) return;
    if (f.size > 5 * 1024 * 1024) {
      alert('This backup file is too large');
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => alert('Could not read the backup file');

    reader.onload = function (e) {
      let json;
      try {
        json = JSON.parse(e.target.result);
        if (!isValidBackup(json)) throw new Error('bad shape');
        populateForms(json);
        // Importing a backup must not silently enable code execution.
        $('enable_javascript').checked = false;
        // Remind only when there is actually a custom filter to miss:
        // non-blank imported JavaScript that now sits inert until
        // re-enabled. Hidden again once the user re-enables it.
        const importedJs =
          json.filterData && typeof json.filterData.javascript === 'string'
            ? json.filterData.javascript
            : '';
        const warn = $('import_js_warning');
        if (importedJs.trim() !== '') {
          warn.textContent =
            'This backup contained a custom JavaScript filter. Advanced blocking was left ' +
            'disabled for safety — review it under Advanced, then re-check Enable advanced ' +
            'blocking if you trust it.';
          warn.classList.remove('is-hidden');
        } else {
          warn.classList.add('is-hidden');
          warn.textContent = '';
        }
        saveForm();
      } catch (ex) {
        alert('This is not a valid BlockTube backup');
      }
    };
    reader.readAsText(f);
  }

  function cmResizer(cm, resizer) {
    const MIN_HEIGHT = 220;

    function heightOf(element) {
      return parseInt(window.getComputedStyle(element).height.replace(/px$/, ''));
    }

    function onDrag(e) {
      cm.display.scroller.style.maxHeight = '100%';
      cm.setSize(null, `${Math.max(MIN_HEIGHT, cm.start_h + e.y - cm.start_y)}px`);
    }

    function onRelease(e) {
      document.body.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', onRelease);
    }

    resizer.addEventListener('mousedown', function (e) {
      cm.start_y = e.y;
      cm.start_h = heightOf(cm.display.wrapper);

      document.body.addEventListener('mousemove', onDrag);
      window.addEventListener('mouseup', onRelease);
    });
  }

  textAreas.concat('javascript').forEach((v) => {
    jsEditors[v] = CodeMirror.fromTextArea($(v), {
      mode: v === 'javascript' ? 'javascript' : 'blocktube',
      matchBrackets: true,
      autoCloseBrackets: true,
      lineNumbers: true,
      styleActiveLine: true,
      lineWrapping: true,
      extraKeys: {
        // Persistent search: dialog stays open, Enter/Shift+Enter = next/prev,
        // all matches highlighted via the search overlay. Replaces the
        // one-shot default (Ctrl-F -> find) without touching cm/ vendor files.
        'Ctrl-F': 'findPersistent',
        'Cmd-F': 'findPersistent',
        'Ctrl-G': 'findPersistentNext',
        'Shift-Ctrl-G': 'findPersistentPrev',
        F11(cm) {
          if (cm.getOption('fullScreen')) {
            cm.display.scroller.style.maxHeight = cm.start_h || '200px';
          } else {
            cm.display.scroller.style.maxHeight = '100%';
          }
          cm.setOption('fullScreen', !cm.getOption('fullScreen'));
        },
        Esc(cm) {
          if (cm.getOption('fullScreen')) {
            cm.display.scroller.style.maxHeight = cm.start_h || '200px';
            cm.setOption('fullScreen', false);
          }
        },
      },
    });
    cmResizer(jsEditors[v], $(`${v}_resizer`));
    jsEditors[v].on('change', () => {
      $('options').dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  // !! Start
  document.addEventListener('DOMContentLoaded', loadData);

  $('options').addEventListener('submit', (evt) => {
    evt.preventDefault();
  });

  $('save_btn').addEventListener('click', (evt) => {
    if (evt.target.classList.contains('disabled-btn')) return;
    saveForm();
  });

  $('discard_btn').addEventListener('click', () => {
    if ($('save_btn').classList.contains('disabled-btn')) return;
    populateForms();
  });

  $('login').addEventListener('submit', (evt) => {
    evt.preventDefault();
    loginForm();
  });

  $('export').addEventListener('click', () => {
    if (isLoggedIn) {
      saveForm();
      saveFile(storageData, 'blocktube_backup.json');
    }
  });

  $('import').addEventListener('click', () => {
    if (isLoggedIn) {
      $('myfile').click();
    }
  });

  $('myfile').addEventListener('change', importOptions, false);

  $('enable_javascript').addEventListener('change', (v) => {
    if (v.target.checked) {
      $('advanced_tab').style.removeProperty('display');
      setTimeout(() => jsEditors['javascript'].refresh(), 1);
      $('import_js_warning').classList.add('is-hidden');
    } else {
      $('advanced_tab').style.display = 'none';
    }
  });

  // Whitelist mode preview: panel visibility flips with the checkbox before
  // Save (dirty tracking still goes through the form-level change listener,
  // and saveForm persists the flag like every other option). Deliberately NOT
  // written through here: isWhitelistModeOn() reads the checkbox, so the
  // preview needs no persistence, and an immediate write would make Discard
  // a lie for this one switch (storage already flipped) while every other
  // control honestly waits for Save. A popup opened mid-edit shows the stored
  // value — correct unsaved-changes semantics, converged on Save.
  $('whitelist_mode').addEventListener('change', () => {
    updateWhitelistUI();
  });

  // Cross-surface sync (WHITELIST_PLAN.md constraint 1): the popup toggles
  // the same flag via a STORAGE_KEY read-modify-write. Converge the checkbox
  // and panel visibility without touching unsaved editor content.
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes) => {
      const key = BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY;
      if (!has.call(changes, key)) return;
      const next = changes[key] && changes[key].newValue;
      if (!next || !next.options) return;
      const el = $('whitelist_mode');
      const mode = !!next.options[OPT.WHITELIST_MODE];
      if (el && el.checked !== mode) {
        el.checked = mode;
        updateWhitelistUI();
      }
    });
  }

  $('options').addEventListener('change', (evt) => {
    // Table search/Add/label inputs commit `change` events too, but they are
    // not saved state — only real option and filter edits mark dirty.
    if (evt.target.closest('.table-toolbar, .table-footer, .add-row, .table-wrap')) return;
    $('save_btn').classList.remove('disabled-btn');
    $('dirty_flag').hidden = false;
    scheduleCounts();
  });

  function initTabs(name) {
    const element = document.getElementById(name);
    element.querySelectorAll('.opt-nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        element.querySelectorAll('.opt-panel').forEach((panel) => {
          panel.style.display = 'none';
        });
        element.querySelectorAll('.opt-nav-btn').forEach((other) => {
          other.classList.remove('is-active');
        });
        btn.classList.add('is-active');

        const panel = document.getElementById(btn.getAttribute('aria-controls'));
        panel.style.display = 'block';
        activePanel = btn.getAttribute('aria-controls');
        $('opt_title').textContent = btn.textContent;
        updateCounts();

        panel.querySelectorAll('textarea').forEach((txtarea) => {
          const areaName = txtarea.getAttribute('id');
          if (has.call(jsEditors, areaName)) {
            jsEditors[areaName].refresh();
          }
        });
      });

      if (btn.classList.contains('is-active')) {
        btn.click();
      }
    });
  }

  initTabs('opt-shell');

  setupAddBox(
    'channelId',
    'channelId_add',
    'channelId_add_btn',
    'channelId_add_notice',
    validateFilterId,
  );
  setupAddBox('videoId', 'videoId_add', 'videoId_add_btn', 'videoId_add_notice', validateFilterId);
  setupAddBox(
    'channelName',
    'channelName_add',
    'channelName_add_btn',
    'channelName_add_notice',
    validatePattern,
  );
  setupAddBox('title', 'title_add', 'title_add_btn', 'title_add_notice', validatePattern);
  setupAddBox('comment', 'comment_add', 'comment_add_btn', 'comment_add_notice', validatePattern);
  setupAddBox(
    'whitelist',
    'whitelist_add',
    'whitelist_add_btn',
    'whitelist_add_notice',
    validateFilterId,
  );
  setupTable('channelId');
  setupTable('videoId');
  setupTable('channelName');
  setupTable('title');
  setupTable('comment');
  setupTable('whitelist');
  updateCounts();
})();
