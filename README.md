# BlockTube

WebExtension for Chrome and Firefox.  
Filter and block unwanted content from YouTube™.

## Extension features

* Block videos via: **Video Title** / **Channel Name** / **Channel ID** / **Video ID**
* Block comments via **User** / **Comment content**
* Block videos/channels via context menus on videos, Shorts, the comment `...` menu (allowlist entries included), and the live-chat `Chat actions` popup (`Block Channel` only, no allowlist entries there)
* Blocked videos are removed from feeds, search, and suggestions (watch-page blocks show a message instead; `%`-watched matches are hidden only; `Disable direct access blocking` and the history-page opt-out exempt some surfaces)
* Works on `m.youtube.com` (mobile layout) as well as desktop
* Block complete channels (channel pages redirect to home)
* Shorts blocking with skip-blocked-Shorts, Movies / Mixes / Chips-shelves blocks, runtime (duration) allow/block range, hide-by-watch-progress
* Whitelist mode: show only allowlisted channels, hide everything else
* Supports both keywords and raw Regex
* Blocked playlist rows are neutered in place; autoplay can advance to the next video on block when enabled
* Block the Explore page (Trending + Explore)
* Protect extension options with a password
* Filtering hooks network data before render; Shorts covers, comment menus, and toasts apply at the DOM layer
* Advanced blocking via custom JavaScript filter (`video`, `objectType`, forced off in whitelist mode) — see below

## Install

* [**Chrome Webstore**](https://chromewebstore.google.com/detail/blocktube/bbeaicapbccfllodepmimpkgecanonai?hl=en-US)
* [**Firefox AMO**](https://addons.mozilla.org/en-US/firefox/addon/blocktube/)

### Firefox first run

Firefox does not always grant YouTube access at install. If the extension
seems to do nothing (no `Block Channel` / `Block Video` entries in video
`...` menus): open the toolbar popup and click **Grant access**,
then reload open YouTube tabs. New installs also land inside the
puzzle-piece menu — right-click the icon there and **Pin to Toolbar**.

## Guides

* [Filter syntax](docs/filters.md) — keywords, regex, comments, editor
  shortcuts, and what each filter list matches
* [Advanced blocking](docs/advanced-blocking.md) — custom JavaScript filter
  reference (`video` fields, `objectType` renderers, examples)
* [Reporting a missed block](docs/debugging.md) — capture the response,
  file a reproducible issue, turn captures into tests
* [Self-hosting](docs/self-hosting.md) — build from source and load it
  without the stores (Chrome / Firefox walkthroughs)

## Options page

Sidebar sections, one panel at a time (header shows entry counts, Save /
Discard, and an `Unsaved changes` flag):

* **General** — theme, password, blocked-message text, hide-by-watch-progress, runtime allow/block range, whitelist switch, and checkboxes (Explore/Mixes/Movies/Chips-shelves/Shorts blocks, autoplay-next, direct-access and history opt-outs, feedback, playback tweaks, menu entries, Ctrl+S shortcut).
* **Channel ID / Video ID / Channel Name / Video Title / Comments** — each
  list as a searchable table (one row per entry with its date, source, and
  an editable label; single-click remove; paging for large lists) plus a
  `Raw list` toggle for direct text editing. Drag the grip below either
  view to resize the list; the height is shared across panels and
  remembered per browser. ID panels take raw IDs only;
  name/title/comment panels take keywords or `/regex/flags` (invalid regex
  is flagged without blocking save). An `Add` box appends entries with a
  dated provenance comment.
* **Advanced** — the custom JavaScript filter behind `Enable advanced
  blocking`.
* **Whitelist** — visible only while whitelist mode is on (the switch lives
  in `General` and in the popup). Same searchable table + `Raw list` toggle
  as the other ID panels: one channel ID per row with its date, source, and
  an editable label, plus an `Add` box; an empty allowlist hides everything
  with a channel (the panel says so until you add one). While the mode
  is on, all other filter panels hide and their filters are bypassed, not
  deleted — General and Export / Import stay available, and everything
  returns when you switch back.
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
  to your filters. You can also use the comment `...` menu: alongside YouTube's
  Report entry BlockTube adds `Block Channel` / `Block comment text…` /
  `Allow Channel` (in whitelist mode, `Remove from Whitelist`). The text entry
  opens an editor prefilled with the comment so you can trim it to a keyword
  or save it as `/regex/`; visible matches are blocked immediately, no reload.
  On live-chat messages the `...` (`Chat actions`) popup offers a
  `Block Channel` entry too — blocks only (no allowlist entries there), and it
  also clears that author's messages already on screen. The author is read from
  the message itself. If YouTube omits its own Report/Block rows
  (logged-out/incognito) and never opens its popup — or opens an empty one —
  BlockTube shows a small one-row `Block Channel` menu on `...` instead. Each
  block is annotated `// Blocked by live chat menu (author name) (date)` — the
  name without its leading `@`, or the channel ID when no name is available.

* How are collaboration videos handled?  
  A collaboration video lists several creators. BlockTube treats every creator
  as a match: blocking any one of their channel IDs or names blocks the video
  wherever it appears. On a collaboration card or under the video on the watch
  page the menu entry reads `Block All Channels` and blocks every creator at
  once. With `Show individual creators in collaboration menus` enabled (the
  default) each creator also gets a `Block <creator>` entry that blocks only
  that channel.
  Exception: on a channel page's **Videos** tab YouTube sends no per-video
  collaborator data, so cards there have no per-creator entries and only offer
  `Block Channel`, which blocks the channel's page as a whole. To block one
  collab video from there, use a more specific filter (e.g. video-name).

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
  Section-level toggles (Shorts / Movies / Mixes / Chips-shelves) still apply.  
  Warning: with a small allowlist feeds can look short or sparse. BlockTube
  detects a feed that filtering left shorter than the viewport and asks
  YouTube to load the next batch for you (bounded — it stops as soon as the
  page scrolls normally again), so a short feed usually refills itself on the
  home, search, subscriptions/trending and channel pages. A feed that is
  almost entirely blocked can still only show the few videos that survive.

* Where is my allowlist?  
  In the dedicated `Whitelist` panel on the options page (visible only while
  the mode is on) — one channel ID per line. The fastest way to fill it is
  the context menu: `Allow Channel` on any video in block mode, or, with
  the mode on, removing entries again via `Remove from Whitelist`.

* What does "Disable YouTube's audio loudness normalization" do?  
  It stops YouTube from normalizing volume across videos
  (Options page > `General`, off by default).  
  Warning: enabling it modifies player responses, which may cause YouTube
  to detect the extension as an ad-blocker. Leave it off if you see
  ad-block warnings or playback issues.

## Advanced blocking (custom JavaScript filter)

Options page > `Advanced` panel. Check `Enable advanced blocking`,
edit the function, then `Save`. It runs **after** the built-in
title/channel/regex/duration matchers (percent-watched, comment, and
section-level matchers are evaluated separately; section-level blocks run
first) and only while the checkbox is checked — and it is forced off in
whitelist mode. Return truthy to block, falsy to allow:

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
  Until you do, the imported function is stored but inert. If the imported
  backup contains any non-blank JavaScript (including the untouched default
  template text), the `Export / Import` panel keeps a reminder
  up until you re-enable it.

## Development & Build

*Ubuntu*
```
# Prerequisites
sudo apt install nodejs npm
# Node 16+ (CI lints on Node 20, releases on Node 16)

# Clone Repo (this fork/branch — upstream `amitbl/blocktube` master lacks this branch)
git clone -b AllChanges https://github.com/zaXsa/blocktube
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

# Advisory readability scan: functions over 30 lines or nested deeper than 4
# (file-scope IIFE wrappers excluded; existing violations are grandfathered
# until touched — never blocks)
npm run check:length

# Build package
./tools/build.sh firefox
./tools/build.sh chrome
./tools/build.sh firefox_selfhosted

# Windows Command Prompt (same outputs; from PowerShell itself drop the
# `powershell -ExecutionPolicy Bypass -File` prefix and run .\tools\build.ps1)
powershell -ExecutionPolicy Bypass -File tools\build.ps1 -Browser chrome
powershell -ExecutionPolicy Bypass -File tools\build.ps1 -Browser firefox_selfhosted

# Output is unpacked directories (load straight into the browser) plus a
# zip package per target; <VERSION> comes from the VERSION file when
# substituted
./dist/firefox/
./dist/chrome/
./dist/firefox_selfhosted/

# Add --no-zip (build.sh) / -NoZip (build.ps1) to skip the package
# (local Chrome use — Chrome cannot load a zip anyway)

# Full walkthrough (which folder to load in which browser):
docs/self-hosting.md

# Temporary installation / debugging
Firefox: https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/
Chrome: https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked
```

## License

This project is licensed under the GPLv3 License - see the [LICENSE](LICENSE) file for details

## Acknowledgments

* Extension Icon from: http://www.designbolts.com/2013/09/08/40-free-shaded-social-media-icons/
