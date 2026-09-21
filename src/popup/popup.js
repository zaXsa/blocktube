document.addEventListener('DOMContentLoaded', () => {
  const checkbox = document.getElementById('toggle-extension');
  const statusText = document.getElementById('status-text');

  function renderToggle(state) {
    checkbox.checked = state;
    statusText.textContent = state ? 'On' : 'Off';
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
  });

  // Restore the switch state from storage
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
    },
  );

  // Listen for changes to the switch
  checkbox.addEventListener('change', (event) => {
    if (event.target instanceof HTMLInputElement) {
      chrome.storage.local.set({ [BLOCKTUBE_CONSTS.MESSAGES.ENABLED_KEY]: event.target.checked });
      chrome.tabs.reload(); // Reload page to apply the new state
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
