# Advanced blocking (custom JavaScript filter)

For anything the regular [filters](filters.md) cannot express — e.g. blocking
only when **multiple** conditions match — write a small JavaScript function.
(The built-in filters are OR: any single match blocks. AND-composition lives
here.)

## Enabling

Options page > `Advanced` panel. Check `Enable advanced blocking`, edit
the function, then `Save`. It runs **after** the built-in title/channel/regex/
duration options and only while the checkbox is checked: if those already
matched, your function is not consulted for that item.

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
* An exception inside your function is caught and logged — the item is left
  in place (fails open), never fails closed.
* Your function is `eval`'d in the page realm (YouTube's Trusted Types policy
  requires this), so treat it like code: never paste in a function you do not
  understand.

## `video` object

`video` is a normalized "friendly" object built from the YouTube renderer
currently being checked — **not** the raw YouTube JSON. Only keys the current
renderer provides are present, so always guard access (e.g.
`video.hasOwnProperty("badges")` or `video.badges !== undefined`). Missing keys
mean "not applicable here", not "empty".

| Key | Type | Notes |
| --- | ---- | ----- |
| `videoId` | `string` | e.g. `"dQw4w9WgXcQ"` |
| `channelId` | `string` | e.g. `"UC..."`. For `lockupViewModel` collab videos every collaborator is checked — a match on ANY of them blocks. |
| `channelName` | `string` | Flattened display text. For `lockupViewModel` collab videos every collaborator name is checked — blocking one name blocks the collab. |
| `title` | `string` | Flattened display text. |
| `vidLength` | `number` | Duration in seconds, parsed from YouTube's `"12:34"` text. |
| `viewCount` | `number` | Parsed from text like `"1.5M views"` / `"No views"`. `undefined` when unparsable. |
| `badges` | `string[]` | Normalized to `"verified"`, `"artist"`, `"live"`, `"members"`. Example: a members-only video exposes `["members"]`. Raw `metadataBadgeRenderer` / `badgeViewModel` styles are mapped for you. |
| `channelBadges` | `string[]` | Same normalization as `badges`, but for the channel owner. |
| `publishTimeText` | `string` | e.g. `"3 days ago"`. |
| `percentWatched` | `number` | Resume-playback percent, when YouTube provides it. |
| `comment` | `string` | Only present on comment renderers (`commentRenderer`, `commentEntityPayload`, `liveChatTextMessageRenderer`). |

## `objectType` (renderer key)

Second argument is the YouTube renderer name being filtered, e.g.
`videoRenderer`, `gridVideoRenderer`, `compactVideoRenderer`,
`lockupViewModel` (new grid), `videoCardRenderer`, `shortsLockupViewModel`,
`reelItemRenderer`, `movieRenderer` / `compactMovieRenderer`,
`playlistPanelVideoRenderer`, `commentRenderer`, `commentEntityPayload`,
`liveChatTextMessageRenderer`, and others. The same video appears under
different renderers on different surfaces (home, search, watch-page rail,
player), so avoid filtering on `objectType` unless you need to — and when you
do, accept all relevant variants.

## Examples

```js
// Block live streams
if (video.hasOwnProperty("badges") && video.badges.includes("live")) {
  return true;
}

// Block videos with more than 1M views
if (video.hasOwnProperty("viewCount") && video.viewCount > 1000000) {
  return true;
}

// Block only when MULTIPLE conditions match (title AND duration)
if (
  /spoiler/i.test(video.title || "") &&
  video.hasOwnProperty("vidLength") &&
  video.vidLength > 600
) {
  return true;
}

// Block only when title AND channel both match
if (
  (video.title || "").match("something") &&
  (video.channelName || "").match("otherthing")
) {
  return true;
}

// Leave watch-page recommendations alone, filter everything else
// (video, objectType) => objectType === "shortsLockupViewModel"
```

## Reference

If this page is outdated, `filterRules` in `src/scripts/inject/rules.js` is the
source of truth for which fields each renderer exposes. Further background:
[Advanced-Blocking wiki](https://github.com/amitbl/blocktube/wiki/Advanced-Blocking).
