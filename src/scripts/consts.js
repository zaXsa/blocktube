// BLOCKTUBE_CONSTS — single authored source for the cross-boundary strings
  // (message types, chrome.storage keys, from-markers). Loaded by every realm;
  // build-inject.js also embeds this file (code only, header stripped) into
  // inject.js. More context: AGENTS.md.
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
  });

  // filterData keys the CONTEXT_BLOCK path may write to; enforced in both the
  // content script and the background (page scripts can forge the type field).
  const CONTEXT_BLOCK_TYPES = Object.freeze(['channelId', 'videoId']);

  globalThis.BLOCKTUBE_CONSTS = BLOCKTUBE_CONSTS;
  globalThis.CONTEXT_BLOCK_TYPES = CONTEXT_BLOCK_TYPES;