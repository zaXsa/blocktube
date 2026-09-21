'use strict';

// BLOCKTUBE_CONSTS (cross-boundary message/storage strings) — loaded into the
// service-worker global scope; see consts.js for the one-truth contract.
importScripts('consts.js');

const has = Object.prototype.hasOwnProperty;
const unicodeBoundary = '[ \n\r\t!@#$%^&*()_\\-=+\\[\\]\\\\\\|;:\'",\\.\\/<>\\?`~:]+';

// The storage.options schema (source of truth). Stored data from the options
// page ISN'T merged onto this — it replaces `storage` wholesale on load — so
// this only serves as the placeholder AND as the drift baseline for
// checkShape(). Every option key here is written by options.js saveForm()
// (src/ui/options.js) and read by the inject fragments (object-filter.js,
// custom-filters.js, context-menu.js, hooks.js/storageReceived). Keys that
// drift here are invisible at runtime, so keep this list in sync with both
// those files; the load-time shape check (utils.checkShape) reports any
// mismatch.
const DEFAULT_OPTIONS = {
  trending: false,
  mixes: false,
  chips_shelves: false,
  shorts: false,
  movies: false,
  suggestions_only: false,
  autoplay: false,
  enable_javascript: false,
  block_message: '',
  block_feedback: false,
  disable_db_normalize: false,
  disable_you_there: false,
  disable_on_history: false,
  vidLength_type: 'allow',
  percent_watched_hide: NaN,
};

// keyed by (contextId || frameId) of the sender -> still-open content-script port
const ports = new Map();
let enabled = true;
let compiledStorage;
let storage = {
  filterData: {
    videoId: [],
    channelId: [],
    channelName: [],
    comment: [],
    title: [],
    vidLength: [null, null],
    javascript: '',
  },
  options: DEFAULT_OPTIONS,
};

const utils = {
  // Returns an array of ['pattern', 'flags'] regex pairs built from the user's
  // lines: exact-match for ids, raw passthrough for /re/flags lines, and a
  // unicode-boundary-wrapped 'i' regex for plain keywords. undefined for
  // non-array input.
  compileRegex(entriesArr, type) {
    if (!(entriesArr instanceof Array)) {
      return undefined;
    }
    // empty dataset
    if (entriesArr.length === 1 && entriesArr[0] === '') return [];

    // skip empty and comments lines
    const filtered = [
      ...new Set(entriesArr.filter((x) => !(!x || x === '' || x.startsWith('//')))),
    ];

    return filtered.map((v) => {
      v = v.trim();

      // unique id
      if (['channelId', 'videoId'].includes(type)) {
        return [`^${v}$`, ''];
      }

      // raw regex
      const parts = /^\/(.*)\/(.*)$/.exec(v);
      if (parts !== null) {
        return [parts[1], parts[2]];
      }

      // regular keyword
      return [
        `(^|${unicodeBoundary})(${v.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&')})(${unicodeBoundary}|$)`,
        'i',
      ];
    });
  },

  // Copy a raw storageData into the shape sent to tabs: the regex props are
  // compiled above; vidLength/javascript pass through raw.
  compileAll(data) {
    const sendData = { filterData: {}, options: data.options };

    // compile regex props
    ['title', 'channelName', 'channelId', 'videoId', 'comment'].forEach((p) => {
      const dataArr = utils.compileRegex(data.filterData[p], p);
      if (dataArr) {
        sendData.filterData[p] = dataArr;
      }
    });

    sendData.filterData.vidLength = data.filterData.vidLength;
    sendData.filterData.javascript = data.filterData.javascript;

    return sendData;
  },

  initFromStorage(data) {
    if (data !== undefined && Object.keys(data).length > 0) {
      storage = data[BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY];
      compiledStorage = utils.compileAll(data[BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY]);
      utils.checkShape(storage);
    }
    if (data !== undefined && Object.hasOwn(data, BLOCKTUBE_CONSTS.MESSAGES.ENABLED_KEY)) {
      enabled = data[BLOCKTUBE_CONSTS.MESSAGES.ENABLED_KEY];
    }
    utils.sendFiltersToAll();
  },

  // Non-mutating drift check against DEFAULT_OPTIONS: a missing option key
  // reads as undefined downstream (which happens to behave like the default),
  // so the failure mode is "invisible until somebody changes the default".
  // Report mismatches so options.js/background.js edits that forget the other
  // site are caught instead of silently shipping.
  checkShape(stored) {
    if (!(stored && stored.options)) return;
    const missing = Object.keys(DEFAULT_OPTIONS).filter((key) => !has.call(stored.options, key));
    if (missing.length > 0) {
      console.warn(
        `BlockTube: storage.options missing keys (runtime defaults apply): ${missing.join(', ')}`,
      );
    }
  },

  // postMessage can throw when the tab that owns the port was closed; the two
  // broadcast helpers below treat that as a non-event.
  safePost(port, msg) {
    try {
      port.postMessage(msg);
    } catch (e) {
      console.error(
        'Failed posting message to a dead content-script port (tab may have been closed)',
      );
    }
  },

  sendFilters(port) {
    utils.safePost(port, {
      type: BLOCKTUBE_CONSTS.MESSAGES.FILTERS,
      data: { storage, compiledStorage, enabled },
    });
  },

  sendFiltersToAll() {
    ports.forEach((port) => {
      utils.safePost(port, {
        type: BLOCKTUBE_CONSTS.MESSAGES.FILTERS,
        data: { storage, compiledStorage, enabled },
      });
    });
  },

  sendReloadToAll() {
    ports.forEach((port) => {
      utils.safePost(port, { type: BLOCKTUBE_CONSTS.MESSAGES.RELOAD });
    });
  },
};

chrome.storage.local.get(
  [BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY, BLOCKTUBE_CONSTS.MESSAGES.ENABLED_KEY],
  utils.initFromStorage,
);

chrome.runtime.onConnect.addListener((port) => {
  const key = port.sender.contextId || port.sender.frameId;
  port.onDisconnect.addListener(() => {
    ports.delete(key);
  });
  ports.set(key, port);
  port.onMessage.addListener((msg) => {
    switch (msg.type) {
      case BLOCKTUBE_CONSTS.MESSAGES.CONTEXT_BLOCK: {
        storage.filterData[msg.data.type].push(...msg.data.entries);
        chrome.storage.local.set({ [BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY]: storage });
        break;
      }
    }
  });
  utils.sendFilters(port);
});

chrome.storage.onChanged.addListener((changes) => {
  if (has.call(changes, BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY)) {
    storage = changes[BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY].newValue;
    compiledStorage = utils.compileAll(changes[BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY].newValue);
    utils.checkShape(storage);
    utils.sendFiltersToAll();
  }
  if (has.call(changes, BLOCKTUBE_CONSTS.MESSAGES.ENABLED_KEY)) {
    enabled = changes[BLOCKTUBE_CONSTS.MESSAGES.ENABLED_KEY].newValue;
    utils.sendFiltersToAll();
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
    utils.sendReloadToAll();
  }
});
