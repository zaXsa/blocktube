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
    },
    options: {},
    uiPass: '',
  };

  const textAreas = ['title', 'channelName', 'channelId', 'videoId', 'comment'];

  // Panel -> filter editors it hosts, for the header counts.
  const PANEL_EDITORS = {
    'panel-channel-id': ['channelId'],
    'panel-channel-name': ['channelName'],
    'panel-video-id': ['videoId'],
    'panel-video-title': ['title'],
    'panel-comments': ['comment'],
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
    { id: 'enable_javascript',     path: `options.${OPT.ENABLE_JAVASCRIPT}`,    type: 'checkbox', default: false },

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
        const arr = getByPath(storageData, b.path, []);
        if (!Array.isArray(arr)) {
          // ensure array exists
        }
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

    // refresh CodeMirror editors after the tab becomes visible (a/19970695)
    setTimeout(() => Object.values(jsEditors).forEach((v) => v.refresh()), 1);
    $('save_btn').classList.add('disabled-btn');
    $('dirty_flag').hidden = true;
    applyReadOnlyMarks();
    updateCounts();
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

  function showAddNotice(noticeId, text) {
    const notice = $(noticeId);
    notice.textContent = text;
    notice.classList.remove('is-hidden');
    clearTimeout(notice.hideTimer);
    notice.hideTimer = setTimeout(() => {
      notice.classList.add('is-hidden');
    }, 3000);
  }

  // One-line Add box for an ID editor: raw IDs only (trimmed, validated,
  // deduped against existing non-annotation lines). Appends the ID and marks
  // dirty via the editor change event. No URL parsing, no handle resolution.
  function setupAddBox(editorKey, inputId, buttonId, noticeId) {
    const add = () => {
      const input = $(inputId);
      const id = input.value.trim();
      if (id === '') {
        showAddNotice(noticeId, 'Paste an ID first.');
        return;
      }
      if (!BLOCKTUBE_ANNOTATIONS.isValidFilterId(id)) {
        showAddNotice(noticeId, 'Invalid ID — letters, digits, _ and - only, up to 64 chars.');
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
      // (`// Blocked by context menu (<text>) (<date>)`). No handle is known
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
      const annotation = `// Blocked by direct add () (${now})`;
      const prefix = current.trim() === '' ? '' : `${current.replace(/\n+$/, '')}\n\n`;
      cm.setValue(`${prefix}${annotation}\n${id}\n`);
      applyReadOnlyMarks(editorKey);
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

  // Lock `//` annotation lines (including context-menu date lines) inside
  // the editors via read-only marks: displayed, preserved by the untouched
  // save path, never user-editable. Blank separators stay editable.
  // Marks die on setValue, so re-apply after every populate/import/Add.
  const readOnlyMarks = {};

  function applyReadOnlyMarks(editorKey) {
    const keys = editorKey === undefined ? textAreas : [editorKey];
    keys.forEach((key) => {
      const cm = jsEditors[key];
      if (!cm) return;
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
    }, 0);
  }

  function importOptions(evt) {
    const files = evt.target.files;
    const f = files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
      let json;
      try {
        json = JSON.parse(e.target.result);
        if (json.filterData && json.options) {
          populateForms(json);
          // Importing a backup must not silently enable code execution.
          $('enable_javascript').checked = false;
          saveForm();
        }
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
    } else {
      $('advanced_tab').style.display = 'none';
    }
  });

  $('options').addEventListener('change', () => {
    $('save_btn').classList.remove('disabled-btn');
    $('dirty_flag').hidden = false;
    updateCounts();
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

  setupAddBox('channelId', 'channelId_add', 'channelId_add_btn', 'channelId_add_notice');
  setupAddBox('videoId', 'videoId_add', 'videoId_add_btn', 'videoId_add_notice');
  updateCounts();
})();
