# BlockTube

WebExtension for Chrome and Firefox.  
Filter and block unwanted content from YouTube™.

## Extension features

* Block videos via: **Video Title** / **Channel Name** / **Channel ID** / **Video ID**
* Block comments via **User** / **Comment content**
* Block videos within YouTube using context menus
* Blocked videos do not appear anywhere on the site
* Support for `m.youtube.com` on Firefox for Android and Kiwi Browser
* Block complete channels
* Whitelist mode: show only allowlisted channels, hide everything else
* Supports both keywords and raw Regex
* Does not break or limit any features of YouTube like playlist or autoplay
* Hide and block the Trending section
* Protect extension options with a password
* Filtering is done before any DOM rendering
* Advanced blocking via custom JavaScript filter (`video`, `objectType`) — see below

## Install

* [**Chrome Webstore**](https://chrome.google.com/webstore/detail/blocktube/bbeaicapbccfllodepmimpkgecanonai?hl=en-US)
* [**Firefox AMO**](https://addons.mozilla.org/en-US/firefox/addon/blocktube/)

## Guides

* [Filter syntax](docs/filters.md) — keywords, regex, comments, editor
  shortcuts, and what each filter list matches
* [Advanced blocking](docs/advanced-blocking.md) — custom JavaScript filter
  reference (`video` fields, `objectType` renderers, examples)

## Options page

Sidebar sections, one panel at a time (header shows entry counts, Save /
Discard, and an `Unsaved changes` flag):

* **General** — every other option (theme, password, runtime, checkboxes).
* **Channel ID / Video ID / Channel Name / Video Title / Comments** — each
  list as a searchable table (one row per entry with its date, source, and
  an editable label; single-click remove; paging for large lists) plus a
  `Raw list` toggle for direct text editing. ID panels take raw IDs only;
  name/title/comment panels take keywords or `/regex/flags` (invalid regex
  is flagged without blocking save). An `Add` box appends entries with a
  dated provenance comment.
* **Advanced** — the custom JavaScript filter behind `Enable advanced
  blocking`.
* **Whitelist** — visible only while whitelist mode is on (the switch lives
  in `General` and in the popup). One channel ID per line, plus an `Add`
  box; an empty allowlist hides everything with a channel. While the mode
  is on, all other panels hide and their filters are bypassed, not deleted
  — the banner says so, and everything returns when you switch back.
* **Export / Import** — backup and restore (`blocktube_backup.json`).

## FAQ
  
* What is the difference between "Channel ID" and "Channel Name"  
  Channel names on YouTube are not unique and can be duplicated/changed  
  whereas Channel ID is a unique identification string that never changes.  
  If you want to block a specific single channel the preferred method is using it's ID,  
  If you want to block multiple channels sharing similar name use it's name.

* How can I get a channel's ID?  
  Channel ID looks like this: UCXXXXXXXXXXXXXXXX  
  To get it, simply browse to a channel page and look at the URL `/channel/UCXXXXXXXXXXXXXXXXXXXX`  
  If the URL is `/user/BadChannelExample` use [This site](https://vabs.github.io/youtube-channel-name-converter/) to convert the username to the channel ID

* How to block comments from specific user?  
  Blocked channels comments are removed as well, so just add the user's name/channel ID
  to your filters

* What is the behaviour when browsing blocked channel?  
  User will be redirected to YouTube homepage.

* What is the behaviour when browsing blocked video?  
  You can choose between two options:
  - Block the entire page and leave a custom message
  - Auto redirect user to the next video

* What happens to my other filters in whitelist mode?  
  They are bypassed, not deleted. While whitelist mode is on, only
  allowlisted channels show; title/name/ID/comment filters, duration and
  watch-progress rules, and the custom JavaScript filter do nothing, but
  everything is preserved and applies again when you switch the mode off.

* Where is my allowlist?  
  In the dedicated `Whitelist` panel on the options page (visible only while
  the mode is on) — one channel ID per line. The fastest way to fill it is
  the context menu: `Allow Channel` on any video in block mode, or, with
  the mode on, removing entries again via `Remove from Whitelist`.

## Advanced blocking (custom JavaScript filter)

Options page > `Advanced` panel. Check `Enable advanced blocking`,
edit the function, then `Save`. It runs **after** the built-in
title/channel/regex/duration options and only while the checkbox is checked —
return truthy to block, falsy to allow:

```js
(video, objectType) => {
  if (video.hasOwnProperty("badges") && video.badges.includes("members")) {
    return true;
  }
  return false;
}
```

Full reference (`video` object fields, `objectType` renderer names, more
examples): [docs/advanced-blocking.md](docs/advanced-blocking.md).

## Import / Export

* `Export` downloads `blocktube_backup.json` containing all filters, options,
  and the custom JavaScript text plus its enable-flag state.
* `Import` loads such a backup file into the form — but as a safety measure it
  **always disables advanced blocking** (`Enable advanced blocking` is
  unchecked), even if the backup had it enabled. Imported JavaScript is
  arbitrary executable code, so it must never silently start running.
* After an import: open the `Advanced` panel, review the imported code,
  re-check `Enable advanced blocking` only if you trust it, then `Save`.
  Until you do, the imported function is stored but inert. If the backup
  contained a custom filter, the `Export / Import` panel keeps a reminder
  up until you re-enable it.

## Development & Build

*Ubuntu*
```
# Prerequisites
sudo apt install nodejs npm

# Clone Repo
git clone https://github.com/amitbl/blocktube
cd blocktube
npm install

### Make your changes ###
# NOTE: src/scripts/inject.js is a GENERATED bundle of the fragments in
# src/scripts/inject/*.js (src/scripts/consts.js is embedded as fragment #0).
# Never hand-edit it — edit a fragment, then regenerate:

# Regenerate the inject bundle + verify it matches the fragments
npm run build:inject
npm run check:inject

# Lint / format checks (CI gate)
npm run lint
npm run fmt:check

# Build package
./tools/build.sh firefox
./tools/build.sh chrome

# Output packages locations
./dist/firefox/blocktube_firefox_v<VERSION>.zip
./dist/chrome/blocktube_chrome_v<VERSION>.zip

# Temporary installation / debugging
Firefox: https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/
Chrome: https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked
```

## License

This project is licensed under the GPLv3 License - see the [LICENSE](LICENSE) file for details

## Acknowledgments

* Extension Icon from: http://www.designbolts.com/2013/09/08/40-free-shaded-social-media-icons/
