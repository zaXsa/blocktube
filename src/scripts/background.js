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
  [OPTS.WHITELIST_MODE]: false,
  [OPTS.MENU_ALLOW_CHANNEL]: true,
  [OPTS.MENU_BLOCK_CHANNEL]: true,
  [OPTS.MENU_BLOCK_VIDEO]: true,
  [OPTS.MENU_BLOCK_COMMENT]: true,
  [OPTS.SAVE_SHORTCUT]: false,
};

// keyed by (contextId || frameId) of the sender -> still-open content-script port
const ports = new Map();
// per-key timestamp of the last accepted CONTEXT_BLOCK write (flood throttle)
const blockTimestamps = new Map();
let enabled = true;
let compiledStorage;
// Shared definition of the empty-rule storage shape: module default placeholder,
// fresh-install boot state and the compile-failure fallback all use it.
function defaultStorage() {
  return {
    filterData: {
      videoId: [],
      channelId: [],
      channelName: [],
      comment: [],
      title: [],
      whitelist: [],
      vidLength: [null, null],
      javascript: '',
    },
    options: DEFAULT_OPTIONS,
  };
}
let storage = defaultStorage();

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

    // The allowlist compiles with the exact-ID rule but stays out of the
    // blacklist loop above; inject hydrates it separately. Absent (pre-
    // whitelist blobs) the key is omitted and inject reads it as [].
    const whitelistArr = utils.compileRegex(filterData.whitelist, 'channelId');
    if (whitelistArr) {
      sendData.filterData.whitelist = whitelistArr;
    }

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

  // Compile the current `storage` into the send shape. A corrupt filterData
  // array (non-string entries) must not kill the compile: that would leave
  // compiledStorage undefined forever and starve every port of FILTERS (the
  // guards below early-return) -> pages hang waiting on blockTubeReady. Fall
  // back to defaults and keep serving. Compile-with-failure is the one place a
  // throw can escape sanitizeStorage.
  compileOrDefaults() {
    try {
      compiledStorage = utils.compileAll(storage);
    } catch (e) {
      console.error('BlockTube: storage compilation failed, falling back to defaults', e);
      storage = defaultStorage();
      compiledStorage = utils.compileAll(storage);
    }
  },

  initFromStorage(data) {
    if (data !== undefined && Object.keys(data).length > 0) {
      const stored = data[BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY];
      const sanitized = utils.sanitizeStorage(stored, storage);
      if (stored !== undefined && stored !== null && sanitized !== stored) {
        console.warn('BlockTube: storage.filterData/options missing or invalid, keeping defaults');
      }
      storage = sanitized;
      utils.checkShape(storage);
    }
    if (data !== undefined && Object.hasOwn(data, BLOCKTUBE_CONSTS.MESSAGES.ENABLED_KEY)) {
      enabled = data[BLOCKTUBE_CONSTS.MESSAGES.ENABLED_KEY];
    }
    // Always compile (defaults when storage is empty/fresh) so no port can ever
    // observe compiledStorage === undefined after boot: a cold-started SW that
    // connects a tab before storage.get resolves must not arm it with empty
    // rules (see sendFilters guard).
    utils.compileOrDefaults();
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
    // A cold-started service worker may still be waiting on chrome.storage when
    // a tab connects. Sending a placeholder FILTERS then (compiledStorage
    // undefined) arms the page with empty rules and storageReceived later skips
    // startHook — the whole session leaks until a reload. Emit FILTERS only
    // once storage has been compiled; initFromStorage flushes every connected
    // port as soon as it has.
    if (compiledStorage === undefined) return;
    utils.safePost(port, {
      type: BLOCKTUBE_CONSTS.MESSAGES.FILTERS,
      data: { storage, compiledStorage, enabled },
    });
  },

  sendFiltersToAll() {
    if (compiledStorage === undefined) return;
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

// Drop `//` annotation lines left without a rule after a whitelist removal.
// An annotation block annotates the rules following it up to the next blank
// line (the same grouping the options page relies on: comments precede their
// ids, blank ends the group), so when every one of those rules is gone the
// comment is an orphan. Blank separators are left alone — compileRegex
// ignores them and the options editor owns the layout.
function pruneOrphanAnnotations(lines) {
  const keep = new Array(lines.length).fill(true);
  let pending = [];
  const flushOrphans = () => {
    pending.forEach((idx) => {
      keep[idx] = false;
    });
    pending = [];
  };
  lines.forEach((line, i) => {
    if (typeof line === 'string' && line.trim() === '') {
      // Blank ends the group: pending annotations with no rule under them
      // are orphans.
      flushOrphans();
    } else if (typeof line === 'string' && line.trim().startsWith('//')) {
      pending.push(i);
    } else {
      // A surviving rule (or a corrupt non-string entry, which must never
      // cost a comment) claims the pending annotations.
      pending = [];
    }
  });
  // Trailing annotations with no rule below them are orphans too.
  flushOrphans();
  return lines.filter((_, i) => keep[i]);
}

chrome.storage.local.get(
  [BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY, BLOCKTUBE_CONSTS.MESSAGES.ENABLED_KEY],
  utils.initFromStorage,
);

// Sanitize one free-text comment filter entry: single line
// (whitespace-collapsed, capped). Null when unusable — empty, or a `//`
// line that would parse as an annotation instead of a rule.
function sanitizeCommentEntry(entry) {
  if (typeof entry !== 'string') return null;
  const clean = entry.replace(/\s+/g, ' ').trim().slice(0, 200);
  if (clean.length === 0 || clean.startsWith('//')) return null;
  return clean;
}

// Sanitize forwarded context-block entries: keep the first `//` annotation
// (whitespace-collapsed, capped) plus the payload entries — up to 100
// charset-safe ids, or up to 10 free-text comment entries (each carries a
// longer budget, so the count is tighter). Comments are
// inert to filtering (compileRegex skips `//` lines); they are the annotations
// users read in the block list. Null when there is nothing to store.
function sanitizeContextBlockEntries(entries, blockType) {
  let comment;
  const safeEntries = [];
  const isText = blockType === 'comment';
  const cap = isText ? 10 : 100;
  entries.forEach((entry) => {
    if (typeof entry !== 'string' || entry.length === 0) return;
    if (entry.startsWith('//')) {
      const clean = entry.replace(/\s+/g, ' ').trim();
      if (clean && comment === undefined) comment = clean.slice(0, 200);
      return;
    }
    if (safeEntries.length >= cap) return;
    if (isText) {
      const clean = sanitizeCommentEntry(entry);
      if (clean !== null) safeEntries.push(clean);
      return;
    }
    if (entry.length <= 64 && /^[A-Za-z0-9_-]+$/.test(entry)) {
      safeEntries.push(entry);
    }
  });
  if (safeEntries.length === 0 && comment === undefined) return null;
  return { comment, safeEntries };
}

// Resolve the target filter array for a block type. `unwhitelist` removes
// from the allowlist instead of adding to its own list. Initializes a missing
// allowlist or comment list on older stored blobs; anything else non-array
// is corrupt — null.
function resolveBlockFilterArr(blockType, isRemoval) {
  const key = isRemoval ? 'whitelist' : blockType;
  const filterArr = storage.filterData[key];
  if (Array.isArray(filterArr)) return filterArr;
  // Pre-whitelist stored blobs lack the allowlist (and very old blobs the
  // comment list): initialize it so menu blocking works without an
  // options-page save first.
  // Anything else non-array is corrupt storage: never throw here.
  if ((key === 'whitelist' || key === 'comment') && storage.filterData[key] === undefined) {
    storage.filterData[key] = [];
    return storage.filterData[key];
  }
  return null;
}

// Apply an allowlist removal: drop every listed id, then drop the provenance
// comments orphaned by the removal (see pruneOrphanAnnotations). True when a
// storage write happened.
function applyWhitelistRemoval(filterArr, safeEntries) {
  // Removal never writes annotations: drop every listed id that is
  // present, then drop the provenance comments left orphaned by the
  // removal (same grouping the options page uses — see
  // pruneOrphanAnnotations). Everything else stays byte-identical.
  const doomed = new Set(safeEntries);
  if (doomed.size === 0) return false;
  const kept = filterArr.filter((line) => !doomed.has(line));
  if (kept.length === filterArr.length) return false;
  storage.filterData.whitelist = pruneOrphanAnnotations(kept);
  chrome.storage.local.set({ [BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY]: storage });
  return true;
}

// Append new ids (plus the provenance comment, unless already stored) to the
// filter array, separated as one options-editor group. True on a write; a
// repeat block of an already-listed id is a no-op (never store a lone comment
// without its id — the duplication the menu produced on second tap).
function appendBlockEntries(filterArr, safeEntries, comment) {
  const existing = new Set(filterArr);
  const newEntries = safeEntries.filter((id) => !existing.has(id));
  // A repeat allowlist/block of an already-listed id must be a no-op:
  // never store a lone provenance comment without its id (that is the
  // comment-only duplication the menu produced on second tap).
  if (newEntries.length === 0) return false;
  if (comment !== undefined && !existing.has(comment)) newEntries.unshift(comment);
  filterArr.push(...newEntries);
  // Blank line separates each context-menu group in the options editor,
  // matching the pre-hardening stored format (compileRegex ignores '').
  filterArr.push('');
  chrome.storage.local.set({ [BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY]: storage });
  return true;
}

// Handle one CONTEXT_BLOCK port message: re-validate the forwarded payload
// (the page can forge CONTEXT_BLOCK_DATA, so type must be whitelisted; ids
// must look like real YouTube ids and comment text must survive the
// per-type sanitizer — a forged `.*` would match everything),
// throttle per tab, then write or remove.
function handleContextBlockMessage(msg, key) {
  const blockType = msg.data && msg.data.type;
  if (!CONTEXT_BLOCK_TYPES.includes(blockType)) return;
  const entries = msg.data && msg.data.entries;
  if (!(entries instanceof Array) || entries.length === 0) return;

  const sanitized = sanitizeContextBlockEntries(entries, blockType);
  if (!sanitized) return;

  // `unwhitelist` removes from the allowlist instead of adding to its
  // own list.
  const isRemoval = blockType === 'unwhitelist';
  const filterArr = resolveBlockFilterArr(blockType, isRemoval);
  if (!filterArr) return;

  // Throttle per tab + dedup + bound total, so a flood can't churn
  // storage.set / recompile / broadcast or grow storage without limit.
  const now = Date.now();
  if (now - (blockTimestamps.get(key) || 0) < 1000) return;
  blockTimestamps.set(key, now);

  if (isRemoval) {
    applyWhitelistRemoval(filterArr, sanitized.safeEntries);
    return;
  }
  appendBlockEntries(filterArr, sanitized.safeEntries, sanitized.comment);
}

// Route one port message by type (currently only context blocks).
function handlePortMessage(msg, key) {
  switch (msg.type) {
    case BLOCKTUBE_CONSTS.MESSAGES.CONTEXT_BLOCK: {
      handleContextBlockMessage(msg, key);
      break;
    }
    default:
      break;
  }
}

// Drop a dead port from the registry (postMessage to closed tabs throws;
// broadcasts treat that as a non-event).
function handlePortDisconnect(key, port) {
  if (chrome.runtime && chrome.runtime.lastError) {
    void chrome.runtime.lastError.message;
  }
  if (ports.get(key) === port) {
    ports.delete(key);
  }
}

chrome.runtime.onConnect.addListener((port) => {
  const key = port.sender.contextId || port.sender.frameId;
  port.onDisconnect.addListener(() => handlePortDisconnect(key, port));
  ports.set(key, port);
  port.onMessage.addListener((msg) => handlePortMessage(msg, key));
  utils.sendFilters(port);
});

chrome.storage.onChanged.addListener((changes) => {
  if (has.call(changes, BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY)) {
    storage = utils.sanitizeStorage(
      changes[BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY].newValue,
      storage,
    );
    utils.compileOrDefaults();
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
