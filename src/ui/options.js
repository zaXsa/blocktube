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

  function saveForm() {
    textAreas.forEach((v) => {
      storageData.filterData[v] = multilineToArray(jsEditors[v].getValue());
    });

    const vidLenMin = parseInt($('vidLength_0').value, 10);
    const vidLenMax = parseInt($('vidLength_1').value, 10);

    storageData.filterData.vidLength = [vidLenMin, vidLenMax];
    storageData.filterData.javascript = jsEditors['javascript'].getValue();

    storageData.uiTheme = $('ui_theme').value;

    storageData.uiPass = $('pass_save').value;
    storageData.options[OPT.TRENDING] = $('disable_trending').checked;
    storageData.options[OPT.SHORTS] = $('disable_shorts').checked;
    storageData.options[OPT.MOVIES] = $('disable_movies').checked;
    storageData.options[OPT.MIXES] = $('disable_mixes').checked;
    storageData.options[OPT.CHIPS_SHELVES] = $('disable_chips_shelves').checked;
    storageData.options[OPT.AUTOPLAY] = $('autoplay').checked;
    storageData.options[OPT.SUGGESTIONS_ONLY] = $('suggestions_only').checked;
    storageData.options[OPT.DISABLE_DB_NORMALIZE] = $('disable_db_normalize').checked;
    storageData.options[OPT.DISABLE_ON_HISTORY] = $('disable_on_history').checked;
    storageData.options[OPT.DISABLE_YOU_THERE] = $('disable_you_there').checked;
    storageData.options[OPT.BLOCK_FEEDBACK] = $('block_feedback').checked;
    storageData.options[OPT.ENABLE_JAVASCRIPT] = $('enable_javascript').checked;
    storageData.options[OPT.BLOCK_MESSAGE] = $('block_message').value;
    storageData.options[OPT.VIDLENGTH_TYPE] = $('vidLength_type').value;
    storageData.options[OPT.PERCENT_WATCHED_HIDE] = parseInt($('percent_watched_hide').value, 10);

    saveData('status_save');
    detectColorScheme();
    $('save_btn').classList.add('disabled-btn');
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

    const vidLength = get('filterData.vidLength', [NaN, NaN], obj);
    $('vidLength_0').value = vidLength[0];
    $('vidLength_1').value = vidLength[1];
    $('vidLength_type').value = get(`options.${OPT.VIDLENGTH_TYPE}`, 'allow', obj);

    $('ui_theme').value = get('uiTheme', 'light', obj);
    $('pass_save').value = get('uiPass', '', obj);
    $('disable_trending').checked = get(`options.${OPT.TRENDING}`, false, obj);
    $('disable_shorts').checked = get(`options.${OPT.SHORTS}`, false, obj);
    $('disable_movies').checked = get(`options.${OPT.MOVIES}`, false, obj);
    $('disable_mixes').checked = get(`options.${OPT.MIXES}`, false, obj);
    $('disable_chips_shelves').checked = get(`options.${OPT.CHIPS_SHELVES}`, false, obj);
    $('autoplay').checked = get(`options.${OPT.AUTOPLAY}`, false, obj);
    $('disable_db_normalize').checked = get(`options.${OPT.DISABLE_DB_NORMALIZE}`, false, obj);
    $('disable_on_history').checked = get(`options.${OPT.DISABLE_ON_HISTORY}`, false, obj);
    $('disable_you_there').checked = get(`options.${OPT.DISABLE_YOU_THERE}`, false, obj);
    $('suggestions_only').checked = get(`options.${OPT.SUGGESTIONS_ONLY}`, false, obj);
    $('block_feedback').checked = get(`options.${OPT.BLOCK_FEEDBACK}`, false, obj);
    $('enable_javascript').checked = get(`options.${OPT.ENABLE_JAVASCRIPT}`, false, obj);
    $('block_message').value = get(`options.${OPT.BLOCK_MESSAGE}`, '', obj);
    $('percent_watched_hide').value = get(`options.${OPT.PERCENT_WATCHED_HIDE}`, NaN, obj);

    const jsContent = get('filterData.javascript', defaultJSFunction, obj);
    jsEditors['javascript'].setValue(jsContent);

    if ($('enable_javascript').checked) {
      $('advanced_tab').style.removeProperty('display');
    }

    // refresh CodeMirror editors after the tab becomes visible (a/19970695)
    setTimeout(() => Object.values(jsEditors).forEach((v) => v.refresh()), 1);
    $('save_btn').classList.add('disabled-btn');
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

  $('options').addEventListener('change', (evt) => {
    if (evt.target.tagName === 'INPUT' && evt.target.getAttribute('type') === 'radio') return;
    $('save_btn').classList.remove('disabled-btn');
  });

  function initTabs(name) {
    const element = document.getElementById(name);
    element.querySelectorAll("input[type='radio']").forEach((box) => {
      box.addEventListener('click', (e) => {
        element.querySelectorAll('section').forEach((tab) => {
          tab.style.display = 'none';
        });

        const tabName = e.target.getAttribute('aria-controls');
        const tab = document.getElementById(tabName);
        tab.style.display = 'block';

        tab.querySelectorAll('textarea').forEach((txtarea) => {
          const areaName = txtarea.getAttribute('id');
          if (has.call(jsEditors, areaName)) {
            jsEditors[areaName].refresh();
          }
        });
      });

      if (box.checked) {
        box.click();
      }
    });
  }

  initTabs('tabbed-filters-parent');
})();
