// Must stay in sync with host_permissions in the Firefox manifests: the
// popup offers a one-click grant when YouTube access is missing. Checked
// and requested as a unit on purpose: contains() is true only when every
// origin is granted, so a partially revoked grant still surfaces the
// warning, and re-requesting already-granted origins is a no-op.
const YOUTUBE_ORIGINS = [
  'https://www.youtube.com/*',
  'https://m.youtube.com/*',
  'https://www.youtube-nocookie.com/*',
];

function renderToggle(checkbox, statusText, state) {
  checkbox.checked = state;
  statusText.textContent = state ? 'On' : 'Off';
}

function renderWhitelist(whitelistCheckbox, state) {
  whitelistCheckbox.checked = state;
}

// Resolve the UI theme: stored preference wins, otherwise the OS scheme
// (light when matchMedia is unavailable).
function resolveUiTheme(storageTheme) {
  if (storageTheme) return storageTheme;
  if (!window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function detectColorScheme() {
  chrome.storage.local.get(BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY, (result) => {
    const storageTheme = result[BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY]?.uiTheme;
    document.documentElement.setAttribute('data-theme', resolveUiTheme(storageTheme));
  });
}

// Converge the popup switches when storage changes (options-page saves
// arrive here via onChanged, so both surfaces stay in sync).
function handleStorageChanges(checkbox, statusText, whitelistCheckbox, changes) {
  if (Object.hasOwn(changes, BLOCKTUBE_CONSTS.MESSAGES.ENABLED_KEY)) {
    renderToggle(checkbox, statusText, !!changes.enabled.newValue);
  }
  // Whitelist flag lives inside storageData.options (same flag the options
  // page binds via OPTION_BINDINGS); converge so both surfaces stay in sync.
  if (Object.hasOwn(changes, BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY)) {
    const next = changes[BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY].newValue;
    if (next && next.options) {
      renderWhitelist(whitelistCheckbox, !!next.options[BLOCKTUBE_CONSTS.OPTIONS.WHITELIST_MODE]);
    }
  }
}

// Restore the switch states from storage; a uiPass flag means the options
// page should open instead (first-run handoff).
function restoreSwitchStates(checkbox, statusText, whitelistCheckbox, result) {
  if (result[BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY]?.uiPass) {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
      window.close();
    }
  }

  renderToggle(
    checkbox,
    statusText,
    result[BLOCKTUBE_CONSTS.MESSAGES.ENABLED_KEY] === undefined
      ? true
      : !!result[BLOCKTUBE_CONSTS.MESSAGES.ENABLED_KEY],
  );
  // Missing flag (pre-whitelist installs) reads as falsy -> blacklist.
  renderWhitelist(
    whitelistCheckbox,
    !!result[BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY]?.options?.[
      BLOCKTUBE_CONSTS.OPTIONS.WHITELIST_MODE
    ],
  );
}

// Enable switch + options button: persist the toggle (reloading so the new
// state applies) and open the options page on demand.
function wireStaticControls(checkbox) {
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
}

// Whitelist mode switch: read-modify-write the shared storageData blob
// (same pre-existing pattern as theme/password writes), then reload so the
// new mode applies immediately. The reload waits for the write to land so
// the fresh page (and the options page via onChanged) converges on the
// new value instead of racing it.
function wireWhitelistSwitch(whitelistCheckbox) {
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
}

// The grant prompt only applies where YouTube access is a user-revocable
// host permission (Firefox manifests declare these origins). Chrome has no
// YouTube entry in host_permissions — filtering runs via content_scripts
// matches that are always present — so a permissions.contains() check there
// is always false and would nag on every popup open. Only prompt when the
// manifest actually declares these origins.
function requiresHostGrant() {
  try {
    const declared = chrome.runtime?.getManifest?.()?.host_permissions || [];
    return YOUTUBE_ORIGINS.every((origin) => declared.includes(origin));
  } catch (e) {
    return false;
  }
}

// On Firefox MV3 the YouTube host permission is user-controlled and is not
// always granted at install: until it is, the content scripts never inject
// and the extension does nothing with no visible sign of why. Surface it
// with a one-click fix (permissions.request needs a user gesture, so it
// must run from the click handler). Chrome needs no grant (see above), so
// the notice stays hidden there.
function refreshPermissionState(permissionWarning) {
  if (!permissionWarning) return;
  if (!requiresHostGrant()) {
    permissionWarning.hidden = true;
    return;
  }
  if (!chrome.permissions || !chrome.permissions.contains) return;
  try {
    chrome.permissions.contains({ origins: YOUTUBE_ORIGINS }, (granted) => {
      if (chrome.runtime.lastError) {
        permissionWarning.hidden = true;
        return;
      }
      // Only prompt when access is definitively absent, never spuriously.
      permissionWarning.hidden = granted !== false;
    });
  } catch (e) {
    permissionWarning.hidden = true;
  }
}

// Wire the grant button: request YouTube access, then reload so the content
// scripts (document_start) inject into the fresh page.
function wireGrantButton(permissionWarning) {
  const grantButton = document.getElementById('grant-button');
  if (!grantButton) return;
  grantButton.addEventListener('click', () => {
    try {
      chrome.permissions.request({ origins: YOUTUBE_ORIGINS }, (granted) => {
        if (chrome.runtime.lastError || !granted) return;
        if (permissionWarning) permissionWarning.hidden = true;
        chrome.tabs.reload();
        window.close();
      });
    } catch (e) {
      // The button is hidden unless requiresHostGrant() passed, so a
      // rejection here just means there is nothing to recover.
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const checkbox = document.getElementById('toggle-extension');
  const statusText = document.getElementById('status-text');
  const whitelistCheckbox = document.getElementById('toggle-whitelist');
  const permissionWarning = document.getElementById('permission-warning');

  detectColorScheme();

  chrome.storage.onChanged.addListener((changes) =>
    handleStorageChanges(checkbox, statusText, whitelistCheckbox, changes),
  );

  // Restore the switch states from storage
  chrome.storage.local.get(
    [BLOCKTUBE_CONSTS.MESSAGES.ENABLED_KEY, BLOCKTUBE_CONSTS.MESSAGES.STORAGE_KEY],
    (result) => restoreSwitchStates(checkbox, statusText, whitelistCheckbox, result),
  );

  wireStaticControls(checkbox);
  wireWhitelistSwitch(whitelistCheckbox);
  refreshPermissionState(permissionWarning);
  wireGrantButton(permissionWarning);
});
