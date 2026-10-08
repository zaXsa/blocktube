(function () {
  'use strict';

  // BLOCKTUBE_CONSTS comes from the sibling src/scripts/consts.js, listed first
  // in this manifest entry so it runs in the same isolated-world realm here.

  // compiledStorage carries the pre-validated regex/storageData compiled by the
  // background page; globalStorage is the fallback when the extension is
  // disabled mid-session (sendStorage already returns undefined then).
  let port;
  let portValid = false;
  let suppressReconnect = false;
  let globalStorage;
  let compiledStorage;
  let enabled;
  // Set only once a real FILTERS payload has arrived; until then the extension
  // state is uninitialized and sendStorage() must NOT forward placeholders
  // (that would arm the page with empty rules before the background's storage
  // is compiled — the cold-start race that leaks the session until a reload).
  let filtersReady = false;

  const utils = {
    sendStorage() {
      if (!filtersReady) return;
      window.postMessage(
        {
          from: BLOCKTUBE_CONSTS.MESSAGES.FROM_CONTENT,
          type: BLOCKTUBE_CONSTS.MESSAGES.STORAGE,
          data: enabled ? compiledStorage || globalStorage : undefined,
        },
        document.location.origin,
      );
    },
    // The port can be mid-reconnect when a forged message lands; don't throw
    // out of the isolated-world message listener, just reconnect.
    safePortPost(msg) {
      if (suppressReconnect) {
        suppressReconnect = false;
        connectToPort();
      }
      if (!port || !portValid) {
        connectToPort();
        return;
      }
      try {
        port.postMessage(msg);
      } catch (e) {
        portValid = false;
        connectToPort();
      }
    },
    sendReload(msg, duration) {
      window.postMessage(
        {
          from: BLOCKTUBE_CONSTS.MESSAGES.FROM_CONTENT,
          type: BLOCKTUBE_CONSTS.MESSAGES.RELOAD,
          data: { msg, duration },
        },
        document.location.origin,
      );
    },
  };

  // Mode-aware provenance verb for a block type: allowlist entries read
  // "Allowlisted", removals "Removed from whitelist", blocks "Blocked". Keyed
  // off the routed type (whitelist <=> allowlisting).
  function blockProvenanceVerb(blockType) {
    if (blockType === 'whitelist') return 'Allowlisted';
    if (blockType === 'unwhitelist') return 'Removed from whitelist';
    return 'Blocked';
  }

  // Resolve the annotation text for a block: the sanitized info text, or the
  // first id when extraction missed the label (never store an empty `()` —
  // fall back to the blocked id so the annotation stays parseable).
  function blockAnnotationText(info) {
    let text = String(info.text || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
    // Extraction can still miss the label on layouts the rules don't know
    // yet (the channelId resolves via the avatar while the name path
    // doesn't). Never store an empty `()` — fall back to the blocked id so
    // the annotation stays parseable and carries at least the identity.
    if (!text) {
      const firstId = Array.isArray(info.id) ? info.id[0] : info.id;
      if (typeof firstId === 'string' && firstId.length > 0) text = firstId.slice(0, 200);
    }
    return text;
  }

  // Collect up to 100 non-empty string ids from the block info.
  function blockEntryIds(info) {
    const ids = (Array.isArray(info.id) ? info.id : [info.id]).slice(0, 100);
    const entries = [];
    ids.forEach((id) => {
      if (typeof id === 'string' && id.length > 0 && id.length <= 255) {
        entries.push(id);
      }
    });
    return entries;
  }

  // Handlers for messages coming from the injected page script
  const messageHandlers = {
    handleContextBlock(data) {
      const blockType = data && data.type;
      if (!CONTEXT_BLOCK_TYPES.includes(blockType)) return;
      if (!data.info || !data.info.id) return;

      // data.info.text flows into a comment line; strip newlines so a crafted
      // text value can't splice additional filter lines into the block list.
      const options = {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      };
      const now = new Intl.DateTimeFormat(undefined, options).format(new Date());
      // Comment-popup taps annotate their origin (`comment menu`) and drop
      // the handle-style leading @, so the entry records a clean name plus
      // where it came from: `// Blocked by comment menu (name) (date)`.
      // Anything else keeps the long-standing `context menu` wording.
      const viaComment = data.info && data.info.via === 'comment';
      const rawText = blockAnnotationText(data.info);
      const stripped = viaComment ? rawText.replace(/^@+/, '').trim() : rawText;
      const text = stripped || rawText;
      const verb = blockProvenanceVerb(blockType);
      const origin = viaComment ? 'comment menu' : 'context menu';
      const entries = [`// ${verb} by ${origin} (${text}) (${now})`];
      entries.push(...blockEntryIds(data.info));
      entries.push('');
      utils.safePortPost({
        type: BLOCKTUBE_CONSTS.MESSAGES.CONTEXT_BLOCK,
        data: { type: blockType, entries },
      });
    },
  };

  // Handle background-port messages: FILTERS arms the page, RELOAD forwards
  // the reactivation notice. Unknown types are ignored.
  function handlePortMessage(msg) {
    switch (msg.type) {
      case BLOCKTUBE_CONSTS.MESSAGES.FILTERS: {
        if (msg.data) {
          filtersReady = true;
          globalStorage = msg.data.storage;
          compiledStorage = msg.data.compiledStorage;
          enabled = msg.data.enabled;
          utils.sendStorage();
        }
        break;
      }
      case BLOCKTUBE_CONSTS.MESSAGES.RELOAD: {
        utils.sendReload();
        break;
      }
      default:
        break;
    }
  }

  // Reconnect when the background drops the port (SW restart), unless a
  // pagehide-driven disconnect is in progress or the extension is gone.
  function handlePortDisconnect(local) {
    if (chrome.runtime) {
      const le = chrome.runtime.lastError;
      if (le) void le.message;
    }
    if (local !== port) return;
    portValid = false;
    if (suppressReconnect) return;
    if (!chrome.runtime || !chrome.runtime.id) return;
    connectToPort();
  }

  function connectToPort() {
    if (portValid || suppressReconnect) return;
    if (!chrome.runtime || !chrome.runtime.id) return;
    let local;
    try {
      local = chrome.runtime.connect();
    } catch (e) {
      return;
    }
    port = local;
    portValid = true;
    // Listen for messages from background page
    local.onMessage.addListener(handlePortMessage);
    local.onDisconnect.addListener(() => handlePortDisconnect(local));
  }

  connectToPort();

  window.addEventListener('pageshow', (event) => {
    if (!event.isTrusted) return;
    if (event.persisted) {
      suppressReconnect = false;
      if (!portValid) connectToPort();
    }
  });

  window.addEventListener('pagehide', (event) => {
    if (!event.isTrusted) return;
    if (!event.persisted || !port) return;
    suppressReconnect = true;
    portValid = false;
    try {
      port.disconnect();
    } catch (e) {
      void e;
    }
    port = null;
  });

  // Listen for messages from injected page script
  window.addEventListener(
    'message',
    (event) => {
      if (event.source !== window) return;
      if (!event.data.from || event.data.from !== BLOCKTUBE_CONSTS.MESSAGES.FROM_PAGE) return;

      switch (event.data.type) {
        case BLOCKTUBE_CONSTS.MESSAGES.CONTEXT_BLOCK_DATA: {
          messageHandlers.handleContextBlock(event.data.data);
          break;
        }
        case BLOCKTUBE_CONSTS.MESSAGES.READY: {
          utils.sendStorage();
          break;
        }
        default:
          break;
      }
    },
    true,
  );
})();
