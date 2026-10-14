// BLOCKTUBE_CONSTS — single authored source for the cross-boundary strings
  // (message types, chrome.storage keys, from-markers). Loaded by every realm;
  // build-inject.js also embeds this file (code only, header stripped) into
  // inject.js. Keep the injection-boundary check in sync when adding a key.
  const BLOCKTUBE_CONSTS = Object.freeze({
    MESSAGES: Object.freeze({
      // chrome.storage.local keys
      STORAGE_KEY: 'storageData',
      ENABLED_KEY: 'enabled',

      // window.postMessage framing
      FROM_PAGE: 'blockTubePage', // page -> content: postMessage from the inject bundle
      FROM_CONTENT: 'blockTubeContent', // content -> page: sendStorage / sendReload
      STORAGE: 'storageData', // content -> page: compiled storage snapshot
      RELOAD: 'reloadRequired', // bg->content (port) or content->page: extension updated, hard-reload
      FILTERS: 'filtersData', // bg -> content (port): {storage, compiledStorage, enabled}
      CONTEXT_BLOCK_DATA: 'contextBlockData', // page -> content: block from context menu
      CONTEXT_BLOCK: 'contextBlock', // content -> bg (port): {type, entries}
      READY: 'ready', // page -> content: hooks booted, re-send storage
    }),
    // storage.options keys referenced across realms (bg / options / inject).
    OPTIONS: Object.freeze({
      TRENDING: 'trending',
      MIXES: 'mixes',
      CHIPS_SHELVES: 'chips_shelves',
      SHORTS: 'shorts',
      SHORTS_SKIP_BLOCKED: 'shorts_skip_blocked',
      MOVIES: 'movies',
      SUGGESTIONS_ONLY: 'suggestions_only',
      AUTOPLAY: 'autoplay',
      ENABLE_JAVASCRIPT: 'enable_javascript', // custom JS filter opt-in switch
      BLOCK_MESSAGE: 'block_message',
      BLOCK_FEEDBACK: 'block_feedback',
      DISABLE_DB_NORMALIZE: 'disable_db_normalize',
      DISABLE_YOU_THERE: 'disable_you_there',
      DISABLE_ON_HISTORY: 'disable_on_history',
      VIDLENGTH_TYPE: 'vidLength_type',
      PERCENT_WATCHED_HIDE: 'percent_watched_hide',
      WHITELIST_MODE: 'whitelist_mode',
      MENU_ALLOW_CHANNEL: 'menu_allow_channel',
      MENU_BLOCK_CHANNEL: 'menu_block_channel',
      MENU_BLOCK_VIDEO: 'menu_block_video',
      MENU_BLOCK_COMMENT: 'menu_block_comment',
      SAVE_SHORTCUT: 'save_shortcut',
    }),
    // Block-list types the CONTEXT_BLOCK path may write (page -> content ->
    // background). Channel/video are blacklist targets, allow/unallow drive
    // the allowlist, comment carries free-text comment rules. Single source
    // for every `type` comparison/return on that path — filterData keys and
    // YouTube renderer names/paths stay as-is (see STRING_CONSTS_PLAN.md).
    BLOCK_TYPES: Object.freeze({
      CHANNEL: 'channelId',
      VIDEO: 'videoId',
      ALLOW: 'whitelist',
      UNALLOW: 'unwhitelist',
      COMMENT: 'comment',
    }),
    // Provenance `via` tags on CONTEXT_BLOCK_DATA info: which surface a tap
    // came from. Read by the content script to annotate the stored entry.
    // Distinct from OPTIONS.SHORTS (the `shorts` option key) — DO NOT merge.
    VIA: Object.freeze({
      SHORTS: 'shorts',
      COMMENT: 'comment',
    }),
  });

  // filterData keys the CONTEXT_BLOCK path may write to; enforced in both the
  // content script and the background (page scripts can forge the type field).
  // `unwhitelist` removes ids from the allowlist instead of adding them.
  // `comment` carries free-text comment rules (sanitized per-type in the
  // background: single line, capped, never a `//` annotation line).
  // Derived from BLOCKTUBE_CONSTS.BLOCK_TYPES above so the two cannot drift apart.
  const CONTEXT_BLOCK_TYPES = Object.freeze([
    BLOCKTUBE_CONSTS.BLOCK_TYPES.CHANNEL,
    BLOCKTUBE_CONSTS.BLOCK_TYPES.VIDEO,
    BLOCKTUBE_CONSTS.BLOCK_TYPES.ALLOW,
    BLOCKTUBE_CONSTS.BLOCK_TYPES.UNALLOW,
    BLOCKTUBE_CONSTS.BLOCK_TYPES.COMMENT,
  ]);

  globalThis.BLOCKTUBE_CONSTS = BLOCKTUBE_CONSTS;
  globalThis.CONTEXT_BLOCK_TYPES = CONTEXT_BLOCK_TYPES;