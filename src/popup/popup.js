document.addEventListener('DOMContentLoaded', () => {
  const checkbox = document.getElementById('toggle-extension');
  const statusText = document.getElementById('status-text');
  const whitelistCheckbox = document.getElementById('toggle-whitelist');

  function renderToggle(state) {
    checkbox.checked = state;
    statusText.textContent = state ? 'On' : 'Off';
  }

  function renderWhitelist(state) {
    whitelistCheckbox.checked = state;
  }

  function detectColorScheme() {
    chrome.storage.local.get(BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY, (result) => {
      let uiTheme = 'light';
      const storageTheme = result[BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY]?.uiTheme;

      if (storageTheme) {
        uiTheme = storageTheme;
      } else if (!window.matchMedia) {
        uiTheme = 'light';
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        uiTheme = 'dark';
      }

      document.documentElement.setAttribute('data-theme', uiTheme);
    });
  }

  detectColorScheme();

  chrome.storage.onChanged.addListener((changes) => {
    if (Object.hasOwn(changes, BLOCKTUBE_CONSTS.MESSAGES.ENABLED_KEY)) {
      renderToggle(!!changes.enabled.newValue);
    }
    // Whitelist flag lives inside storageData.options (same flag the options
    // page binds via OPTION_BINDINGS); converge so both surfaces stay in sync.
    if (Object.hasOwn(changes, BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY)) {
      const next = changes[BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY].newValue;
      if (next && next.options) {
        renderWhitelist(!!next.options[BLOCKTUBE_CONSTS.OPTIONS.WHITELIST_MODE]);
      }
    }
  });

  // Restore the switch states from storage
  chrome.storage.local.get(
    [BLOCKTUBE_CONSTS.MESSAGES.ENABLED_KEY, BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY],
    (result) => {
      if (result[BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY]?.uiPass) {
        if (chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
          window.close();
        }
      }

      renderToggle(
        result[BLOCKTUBE_CONSTS.MESSAGES.ENABLED_KEY] === undefined
          ? true
          : !!result[BLOCKTUBE_CONSTS.MESSAGES.ENABLED_KEY],
      );
      // Missing flag (pre-whitelist installs) reads as falsy -> blacklist.
      renderWhitelist(
        !!result[BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY]?.options?.[
          BLOCKTUBE_CONSTS.OPTIONS.WHITELIST_MODE
        ],
      );
    },
  );

  // Listen for changes to the switch
  checkbox.addEventListener('change', (event) => {
    if (event.target instanceof HTMLInputElement) {
      chrome.storage.local.set({ [BLOCKTUBE_CONSTS.MESSAGES.ENABLED_KEY]: event.target.checked });
      chrome.tabs.reload(); // Reload page to apply the new state
    }
  });

  // Whitelist mode switch: read-modify-write the shared storageData blob
  // (same pre-existing pattern as theme/password writes), then reload so the
  // new mode applies immediately. The reload waits for the write to land so
  // the fresh page (and the options page via onChanged) converges on the
  // new value instead of racing it.
  whitelistCheckbox.addEventListener('change', (event) => {
    if (event.target instanceof HTMLInputElement) {
      const on = event.target.checked;
      chrome.storage.local.get(BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY, (result) => {
        const data = result[BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY] || {};
        if (!data.options || typeof data.options !== 'object') data.options = {};
        data.options[BLOCKTUBE_CONSTS.OPTIONS.WHITELIST_MODE] = on;
        chrome.storage.local.set({ [BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY]: data }, () => {
          chrome.tabs.reload(); // Reload page to apply the new state
        });
      });
    }
  });

  // Open options page
  document.getElementById('options-button').addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
      window.close();
    }
  });
});
