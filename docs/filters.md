# Filter syntax

How the five filter lists on the options page work: Video title, Channel name,
Video ID, Channel ID, Comment content. One entry per line.

## Editor shortcuts

Work while focused in one of the filter textareas:

* `Ctrl+F` — search within the list (persistent: `Enter` = next,
  `Shift+Enter` = previous, `Esc` closes)
* `F11` — toggle fullscreen editing (`Esc` exits)

## Syntax

* **Each line is one rule.** Empty lines are ignored.
* **Plain text is a case-insensitive keyword.** `vlog` matches any video whose
  title contains the word "vlog".
* **`/pattern/flags` is raw regex.** `/!{2,}/i` matches two or more `!` in a row.
  Flags work as in JavaScript, except the global (`g`) flag is stripped
  automatically — it is harmless but has no effect, so omit it.
* **Lines starting with `//` are comments and are ignored** by the filter
  engine. BlockTube itself writes these when you block via the context menu
  (`// Blocked by context menu (…) (…)` with the date), via a comment `...`
  menu (`// Blocked by comment menu (…) (…)`), or the Add box
  (`// Blocked by direct add () (…)`). Allowlist entries use the same shape
  (`// Allowlisted by context menu (…) (…)` when you allow a channel).
  Removing one via `Remove from Whitelist` writes no comment: the entry is
  dropped and its now-orphaned annotation goes with it. They are annotations, not rules: the
  options page shows them locked in the table view (freely editable in raw
  mode) and preserves them across saves.
* **`// Label: …` attaches a personal label** to the entry below it, shown
  in the table and editable there with the ✎ button. Like all `//` lines it
  never affects filtering, import, or export.
* **Invalid regex is flagged, not fatal.** A `/pattern/flags` line that fails
  `RegExp` construction shows a warning below the list naming the line
  numbers — it simply never matches. Saving is never blocked.

## Keyword boundaries

A plain keyword only matches at a word boundary (spaces, punctuation, CJK-aware
separators), so blocking `you` does not block `youtube`. If your keyword is not
separated by spaces from its surroundings — e.g. Japanese or Chinese text —
write it as regex instead of a bare keyword:

* Bare keyword `閃の軌跡` may not match inside
  `【閃の軌跡シリーズ】全・オープニング集…`
* Regex `/閃の軌跡/` matches.

## What each list matches

* **Video title** — video titles everywhere they appear, including playlist
  names and playlist entries.
* **Channel name** — channel/uploader names. This also matches comment and
  live-chat authors, so blocking a channel removes its comments too.
* **Video ID / Channel ID** — exact IDs only (e.g. `dQw4w9WgXcQ`,
  `UC…`). Every line is anchored (`^id$`); regex syntax is not interpreted
  here, so paste clean IDs. Prefer Channel ID over Channel name when you mean
  one specific channel: names can be duplicated or renamed, IDs cannot.
* **Comment content** — comment text, including live-chat messages.

Blocking a channel (by name or ID) blocks its videos, comments, playlists, and
community posts — anywhere they appear, including direct visits (you are sent
back to the YouTube homepage). On collaboration videos (several creators on
one card) a match on ANY collaborator blocks the video, and `Block Channel`
on such a card blocks every collaborator at once.

Each comment's `...` menu also carries BlockTube entries next to YouTube's
Report: `Block Channel` (same as adding the commenter's ID to the Channel ID
list), `Block comment text…` (appends to the Comment content list), plus
`Allow Channel` for building the allowlist, with the same block icon as the
video menus. In whitelist mode the menu offers `Remove from Whitelist`
instead. The entries honor the `General` menu toggles (`Show "Block comment
text" in comment menus` gates the text entry).

`Block comment text…` opens an editor prefilled with the comment: trim it to
the words you want blocked — a plain line is stored as a case-insensitive
keyword — or write it as `/pattern/flags` for raw regex (e.g. `/^exact$/`
for whole-comment matches only). Validation mirrors the background rules
(single line, 200 chars, never a `//` line, constructible regex), and saving
replaces the thread with a `Blocked comment (text blocked)` placeholder (no
toast). Blocking a channel works the same way with a `Blocked comment
(channel blocked)` placeholder; its Channel ID entry is annotated
`// Blocked by comment menu (name) (date)` — the comment text itself is
never stored there, and a leading `@` is stripped from the name. If a
commenter's ID cannot be resolved (e.g. only a `@handle` link rendered and
the author payload never passed through the filter), the tap toasts instead
of blocking: add the name to the Channel name list from the options page in
that case.

## Examples

```
// match all videos containing the word "vlog"
vlog

// match all videos containing two or more '!' in a row
/!{2,}/i

// match CJK text that has no space boundaries
/閃の軌跡/
```
