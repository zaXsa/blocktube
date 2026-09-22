(function () {
  'use strict';

  // BLOCKTUBE_CONSTS comes from the sibling src/scripts/consts.js, listed first
  // in this manifest entry so it runs in the same isolated-world realm here.

  // compiledStorage carries the pre-validated regex/storageData compiled by the
  // background page; globalStorage is the fallback when the extension is
  // disabled mid-session (sendStorage already returns undefined then).
  let port;
  let globalStorage;
  let compiledStorage;
  let enabled;

  const utils = {
    sendStorage() {
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
      if (!port) {
        connectToPort();
        return;
      }
      try {
        port.postMessage(msg);
      } catch (e) {
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
      const text = String(data.info.text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200);
      const entries = [`// Blocked by context menu (${text}) (${now})`];
      const ids = (Array.isArray(data.info.id) ? data.info.id : [data.info.id]).slice(0, 100);
      ids.forEach((id) => {
        if (typeof id === 'string' && id.length > 0 && id.length <= 255) {
          entries.push(id);
        }
      });
      entries.push('');
      utils.safePortPost({
        type: BLOCKTUBE_CONSTS.MESSAGES.CONTEXT_BLOCK,
        data: { type: blockType, entries },
      });
    },
  };

  function connectToPort() {
    if (!chrome.runtime || !chrome.runtime.id) return;
    try {
      port = chrome.runtime.connect();
    } catch (e) {
      return;
    }
    // Listen for messages from background page
    port.onMessage.addListener((msg) => {
      switch (msg.type) {
        case BLOCKTUBE_CONSTS.MESSAGES.FILTERS: {
          if (msg.data) {
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
    });

    port.onDisconnect.addListener(() => {
      if (!chrome.runtime || !chrome.runtime.id) return;
      connectToPort();
    });
  }

  connectToPort();

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
