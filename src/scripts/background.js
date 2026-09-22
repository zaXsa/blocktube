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
const OPTS = BLOCKTUBE_CONSTS.OPTIONS;
const DEFAULT_OPTIONS = {
  [OPTS.TRENDING]: false,
  [OPTS.MIXES]: false,
  [OPTS.CHIPS_SHELVES]: false,
  [OPTS.SHORTS]: false,
  [OPTS.MOVIES]: false,
  [OPTS.SUGGESTIONS_ONLY]: false,
  [OPTS.AUTOPLAY]: false,
  [OPTS.ENABLE_JAVASCRIPT]: false,
  [OPTS.BLOCK_MESSAGE]: '',
  [OPTS.BLOCK_FEEDBACK]: false,
  [OPTS.DISABLE_DB_NORMALIZE]: false,
  [OPTS.DISABLE_YOU_THERE]: false,
  [OPTS.DISABLE_ON_HISTORY]: false,
  [OPTS.VIDLENGTH_TYPE]: 'allow',
  [OPTS.PERCENT_WATCHED_HIDE]: NaN,
};

// keyed by (contextId || frameId) of the sender -> still-open content-script port
const ports = new Map();
// per-key timestamp of the last accepted CONTEXT_BLOCK write (flood throttle)
const blockTimestamps = new Map();
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
    const filterData = (data && data.filterData) || {};
    const sendData = {
      filterData: {},
      options: (data && data.options) || DEFAULT_OPTIONS,
    };

    // compile regex props
    ['title', 'channelName', 'channelId', 'videoId', 'comment'].forEach((p) => {
      const dataArr = utils.compileRegex(filterData[p], p);
      if (dataArr) {
        sendData.filterData[p] = dataArr;
      }
    });

    sendData.filterData.vidLength = Array.isArray(filterData.vidLength)
      ? filterData.vidLength
      : [null, null];
    sendData.filterData.javascript =
      typeof filterData.javascript === 'string' ? filterData.javascript : '';

    return sendData;
  },

  // Tolerate corrupt/legacy storage instead of crashing the SW; needs both
  // filterData and options objects or `current` (defaults / last good) stays.
  sanitizeStorage(stored, current) {
    if (
      stored &&
      typeof stored === 'object' &&
      stored.filterData &&
      typeof stored.filterData === 'object' &&
      stored.options &&
      typeof stored.options === 'object'
    ) {
      return stored;
    }
    return current;
  },

  initFromStorage(data) {
    if (data !== undefined && Object.keys(data).length > 0) {
      const stored = data[BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY];
      const sanitized = utils.sanitizeStorage(stored, storage);
      if (stored !== undefined && stored !== null && sanitized !== stored) {
        console.warn('BlockTube: storage.filterData/options missing or invalid, keeping defaults');
      }
      storage = sanitized;
      compiledStorage = utils.compileAll(storage);
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
        // Re-validate what the content script forwarded: the page can forge
        // CONTEXT_BLOCK_DATA, so type must be whitelisted and ids must look
        // like real YouTube ids (a forged `.*` would match everything).
        const blockType = msg.data && msg.data.type;
        if (!CONTEXT_BLOCK_TYPES.includes(blockType)) break;
        const entries = msg.data && msg.data.entries;
        if (!(entries instanceof Array) || entries.length === 0) break;

        // Comments (inert to filtering: compileRegex skips `//` lines) are the
        // context-menu annotations users read in the block list. Keep the
        // first one, but re-sanitize: a forged page can send arbitrary text,
        // so strip newlines/control chars and cap length. Ids stay regex-safe
        // via whitelist charset + 64-char cap.
        let comment;
        const safeEntries = [];
        entries.forEach((entry) => {
          if (typeof entry !== 'string' || entry.length === 0) return;
          if (entry.startsWith('//')) {
            const clean = entry.replace(/\s+/g, ' ').trim();
            if (clean && comment === undefined) comment = clean.slice(0, 200);
            return;
          }
          if (entry.length <= 64 && safeEntries.length < 100 && /^[A-Za-z0-9_-]+$/.test(entry)) {
            safeEntries.push(entry);
          }
        });
        if (safeEntries.length === 0 && comment === undefined) break;

        const filterArr = storage.filterData[blockType];
        if (!Array.isArray(filterArr)) break; // corrupt storage: never throw here

        // Throttle per tab + dedup + bound total, so a flood can't churn
        // storage.set / recompile / broadcast or grow storage without limit.
        const now = Date.now();
        if (now - (blockTimestamps.get(key) || 0) < 1000) break;
        blockTimestamps.set(key, now);

        const existing = new Set(filterArr);
        const newEntries = safeEntries.filter((id) => !existing.has(id));
        if (newEntries.length === 0 && comment === undefined) break;
        if (comment !== undefined && !existing.has(comment)) newEntries.unshift(comment);
        if (newEntries.length === 0) break;
        filterArr.push(...newEntries);
        // Blank line separates each context-menu group in the options editor,
        // matching the pre-hardening stored format (compileRegex ignores '').
        filterArr.push('');
        chrome.storage.local.set({ [BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY]: storage });
        break;
      }
    }
  });
  utils.sendFilters(port);
});

chrome.storage.onChanged.addListener((changes) => {
  if (has.call(changes, BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY)) {
    storage = utils.sanitizeStorage(
      changes[BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY].newValue,
      storage,
    );
    compiledStorage = utils.compileAll(storage);
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
