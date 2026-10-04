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
* Supports both keywords and raw Regex
* Does not break or limit any features of YouTube like playlist or autoplay
* Hide and block the Trending section
* Protect extension options with a password
* Filtering is done before any DOM rendering
* Advanced blocking via custom JavaScript filter (`video`, `objectType`) — see below

## Install

* [**Chrome Webstore**](https://chrome.google.com/webstore/detail/blocktube/bbeaicapbccfllodepmimpkgecanonai?hl=en-US)
* [**Firefox AMO**](https://addons.mozilla.org/en-US/firefox/addon/blocktube/)

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

## Advanced blocking (custom JavaScript filter)

Options page > `Advanced Blocking` tab. Check `Enable advanced blocking`,
edit the function, then `Save`. It only runs while that checkbox is checked.

Signature (must evaluate to a function):

```js
(video, objectType) => {
  // Add custom conditions below
  if (video.hasOwnProperty("badges") && video.badges.includes("members")) {
    return true;
  }

  // Custom conditions did not match, do not block
  return false;
}
```

* Return `true` (or any truthy value) to block, `false`/falsy to allow.
* It runs **after** the built-in title/channel/regex/duration options. If those
  already matched, your function is not consulted for that item.
* An exception inside your function is caught and logged — the item is left
  in place (fails open), never fails closed.

### `video` object

`video` is a normalized "friendly" object built from the YouTube renderer
currently being checked — **not** the raw YouTube JSON. Only keys the current
renderer provides are present, so always guard access (e.g.
`video.hasOwnProperty("badges")` or `video.badges !== undefined`). Missing keys
mean "not applicable here", not "empty".

| Key | Type | Notes |
| --- | ---- | ----- |
| `videoId` | `string` | e.g. `"dQw4w9WgXcQ"` |
| `channelId` | `string` | e.g. `"UC..."`. For `lockupViewModel` collab videos only the first creator is in `channelId`; other collaborators are still blocked via the Channel ID filter. |
| `channelName` | `string` | Flattened display text. |
| `title` | `string` | Flattened display text. |
| `vidLength` | `number` | Duration in seconds, parsed from YouTube's `"12:34"` text. |
| `viewCount` | `number` | Parsed from text like `"1.5M views"` / `"No views"`. `undefined` when unparsable. |
| `badges` | `string[]` | Normalized to `"verified"`, `"artist"`, `"live"`, `"members"`. Example: a members-only video exposes `["members"]`. Raw `metadataBadgeRenderer` / `badgeViewModel` styles are mapped for you. |
| `channelBadges` | `string[]` | Same normalization as `badges`, but for the channel owner. |
| `publishTimeText` | `string` | e.g. `"3 days ago"`. |
| `percentWatched` | `number` | Resume-playback percent, when YouTube provides it. |
| `comment` | `string` | Only present on comment renderers (`commentRenderer`, `commentEntityPayload`, `liveChatTextMessageRenderer`). |

### `objectType` (renderer key)

Second argument is the YouTube renderer name being filtered, e.g.
`videoRenderer`, `gridVideoRenderer`, `compactVideoRenderer`,
`lockupViewModel` (new grid), `videoCardRenderer`, `shortsLockupViewModel`,
`reelItemRenderer`, `movieRenderer` / `compactMovieRenderer`,
`playlistPanelVideoRenderer`, `commentRenderer`, `commentEntityPayload`,
`liveChatTextMessageRenderer`, and others. The same video appears under
different renderers on different surfaces (home, search, watch-page rail,
player), so avoid filtering on `objectType` unless you need to — and when you
do, accept all relevant variants.

More examples:

```js
// Block live streams
if (video.hasOwnProperty("badges") && video.badges.includes("live")) {
  return true;
}

// Block videos with more than 1M views
if (video.hasOwnProperty("viewCount") && video.viewCount > 1000000) {
  return true;
}

// objectType is available when you need renderer-specific logic
// (video, objectType) => objectType === "shortsLockupViewModel"
```

Full background and further examples:
[Advanced-Blocking wiki](https://github.com/amitbl/blocktube/wiki/Advanced-Blocking).
Your function is `eval`'d in the page realm (YouTube's Trusted Types policy
requires this), so treat it like code: never paste in a function you do not
understand.

## Import / Export

* `Export` downloads `blocktube_backup.json` containing all filters, options,
  and the custom JavaScript text plus its enable-flag state.
* `Import` loads such a backup file into the form — but as a safety measure it
  **always disables advanced blocking** (`Enable advanced blocking` is
  unchecked), even if the backup had it enabled. Imported JavaScript is
  arbitrary executable code, so it must never silently start running.
* After an import: open the `Advanced Blocking` tab, review the imported code,
  re-check `Enable advanced blocking` only if you trust it, then `Save`.
  Until you do, the imported function is stored but inert.

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

## Future work

* User-friendly options UI
* Sync options to cloud provider / enterprise policies
* Whitelist mode
* Dynamic rules (match multiple rules to block a video)

## License

This project is licensed under the GPLv3 License - see the [LICENSE](LICENSE) file for details

## Acknowledgments

* Extension Icon from: http://www.designbolts.com/2013/09/08/40-free-shaded-social-media-icons/
