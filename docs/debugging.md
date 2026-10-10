# Reporting a missed block (and how captures become tests)

Something should be blocked but isn't — a video, comment, live-chat message,
Super Chat, or membership announcement? This page shows how to capture what
BlockTube needs, what to paste into the issue, and (for contributors) how that
capture turns into a regression test.

## 1. Capture the response

BlockTube filters YouTube's data responses before they render, so the useful
evidence is the response body, not a screenshot:

1. Open YouTube in a **logged-out window** (no account data in the capture).
2. Open DevTools (`F12`) → **Network** tab.
3. Reproduce the miss (load the page / scroll / let chat flow in).
4. In the Network filter box, type the endpoint for the page. BlockTube
   intercepts these (exact paths from `src/scripts/seed.js`):

   | Page                                     | Endpoint filter                    |
   | ---------------------------------------- | ---------------------------------- |
   | Home, subscriptions, channel, guide     | `/youtubei/v1/browse`              |
   | Search results                           | `/youtubei/v1/search`              |
   | Watch page column, comments, continuations| `/youtubei/v1/next`                |
   | Live chat                                | `/youtubei/v1/live_chat/get_live_chat` |
   | Video/stream metadata                    | `/youtubei/v1/player`              |
   | Watch page bootstrap                     | `/youtubei/v1/get_watch`           |
   | App guide / sidebar                      | `/youtubei/v1/guide`               |

   Older YouTube code paths use XHR endpoints instead (also intercepted):
   `/browse_ajax`, `/related_ajax`, `/service_ajax`, `/list_ajax`,
   `/guide_ajax`, `/comment_service_ajax`, `/live_chat/get_live_chat`,
   `/watch`. If the `youtubei` filter shows nothing, try these.

5. Save that single response body to a file. For most pages the filtered
   endpoint yields one response, so the whole body is fine as-is.
6. Live chat is the exception: it polls every few seconds, so the filter
   shows a stream of near-identical `get_live_chat` responses and only some
   carry chat items. Click a response → **Response** tab, then press `Ctrl+F`
   to search inside it for the renderer name (e.g.
   `liveChatPaidMessageRenderer`) or the author's channel ID, until you land
   on one that actually contains the item. (`Ctrl+Shift+F` searches source
   files instead — not what you want here.)

## 2. Trim it before sharing

Full responses are hundreds of kilobytes of tracking tokens and thumbnails.
Trim to the smallest object that still shows the item — usually one renderer
or one entry of `actions[]` / `contents[]`:

* Keep: the renderer object (`videoRenderer`, `commentRenderer`,
  `liveChatTextMessageRenderer`, …) with its author/message/title fields.
* Delete: `trackingParams`, `clickTrackingParams`, `thumbnails`/`avatar`
  URLs, `serviceTrackingParams`, `frameworkUpdates`, continuation tokens.
* Never include: anything captured while logged in (visitor data, account
  identifiers). Re-capture logged out if unsure.

## 3. What the issue needs

* Extension version (options page footer).
* Browser + version and OS (e.g. "Firefox 142 on Linux", "Chrome 155 on
  Windows") — renderer shapes and endpoints can differ per browser/app.
* The page URL (home, subscriptions, search, video, channel, stream).
* Which filter list and entry you expected to match
  (e.g. "Channel ID `UC…`", "Video title `vlog`", "Comment content `spam`").
* The trimmed renderer snippet from step 2.
* What happened instead (item stayed visible, page didn't redirect, …).

With those four, the miss is reproducible without access to your account.

## 4. Diagnosing an unexpected block (false positive)

The reverse of a miss: playback stops with
`Video blocked by BlockTube filter (...)`. The parenthesized part already
names the filter and what it matched, e.g.
`(title filter "puppy" matched "Girl Wakes Up ...")` — exact-ID blocks
collapse to `(channelId: "UC…")`. That names the culprit entry to remove or
narrow on the options page. Note the matched value is truncated to 40
characters, and a broad character range (e.g. `/[À-ỹ]/`) can fire on a
lookalike far into the title (e.g. Greek `α`, or `×` reading as `x`) — when
in doubt, test the entry against the full title in isolation.

## 5. From capture to unit test (contributors)

Renderer shapes are pinned in `test/cases/filters.js` so a YouTube field
rename fails loudly instead of silently unblocking. The pattern, using a live
chat message as the example:

```js
const liveChatPaths = {
  channelId: 'authorExternalChannelId',
  channelName: ['authorName'],
  comment: 'message',
};
const liveChatItem = () => ({
  message: { runs: [{ text: 'some text' }, { emoji: { emojiId: 'x' } }] },
  authorName: { simpleText: '@someone' },
  // Placeholder — paste the real channel ID from the capture here, but keep
  // it out of committed files (see the pre-commit hook).
  authorExternalChannelId: 'UC…',
});

suite.test('a live chat message from a blocked channel id is blocked', () => {
  reset();
  unit.setRegexFilter('channelId', ['^UC…$']);
  if (!run(liveChatPaths, liveChatItem(), 'liveChatTextMessageRenderer')) {
    throw new Error('UNDER-BLOCKED: live chat channelId regex did not match');
  }
});
```

Notes:

* The `…Paths` object must mirror the entry in `src/scripts/inject/rules.js`
  (copy it verbatim — drift between the two is exactly what the test guards).
  The real path table lives there; section 1's endpoint table tells you which
  response carries the renderer you need.
* Cover four cases per renderer: blocked by channel ID, by author/name, by
  text, and a clean item that survives (over-blocking guard).
* `flattenRuns` joins `{text}` runs and skips `{emoji}` runs; `{simpleText}`
  objects pass through — use the real shapes from the capture.
* Run `npm test` (must be 100% green) and `npm run check:inject` if you
  touched `src/scripts/inject/`. `test/` is local-only and never committed;
  paste the trimmed snippet into the issue instead.
