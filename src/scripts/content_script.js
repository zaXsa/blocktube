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
      if (!data.info.id) return;

      const options = {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      };
      const now = new Intl.DateTimeFormat(undefined, options).format(new Date());
      const entries = [`// Blocked by context menu (${data.info.text}) (${now})`];
      const id = Array.isArray(data.info.id) ? data.info.id : [data.info.id];
      entries.push(...id);
      entries.push('');
      port.postMessage({
        type: BLOCKTUBE_CONSTS.MESSAGES.CONTEXT_BLOCK,
        data: { type: data.type, entries },
      });
    },
  };

  function connectToPort() {
    port = chrome.runtime.connect();
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
