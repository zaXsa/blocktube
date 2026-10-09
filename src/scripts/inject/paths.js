  const has = Object.prototype.hasOwnProperty;
  // !! Utils

  function flattenRuns(arr) {
    if (arr === null || arr === undefined) return undefined;
    if (arr.simpleText !== undefined) return arr.simpleText;
    if (!Array.isArray(arr.runs)) return arr;
    return arr.runs
      .reduce((res, v) => {
        if (has.call(v, 'text')) {
          res.push(v.text);
        }
        return res;
      }, [])
      .join(' ');
  }

  function getFlattenByPath(obj, filterPath) {
    if (filterPath === undefined) return;
    // Function-valued rule paths (e.g. lockupViewModel.channelName): called
    // with the renderer, flattened the same way so runs-shaped text still
    // joins. Lets a rule express "the part that looks like X" where no static
    // dotted path can (see lockupChannelName).
    if (typeof filterPath === 'function') {
      return flattenRuns(filterPath(obj));
    }
    const filterPathArr = filterPath instanceof Array ? filterPath : [filterPath];
    let value;
    for (let idx = 0; idx < filterPathArr.length; idx += 1) {
      value = getObjectByPath(obj, filterPathArr[idx]);
      if (value !== undefined) return flattenRuns(value);
    }
  }

  // Plain token fan-out: every array element owning the key contributes its
  // value; a plain object contributes its own-key value. Misses add nothing.
  function collectPlainKey(cur, key, next) {
    if (cur instanceof Array) {
      for (let k = 0; k < cur.length; k += 1) {
        const el = cur[k];
        if (el && typeof el === 'object' && has.call(el, key)) next.push(el[key]);
      }
    } else if (typeof cur === 'object' && has.call(cur, key)) {
      next.push(cur[key]);
    }
  }

  // Walk one numeric index across every candidate array, collecting hits.
  // Out-of-range/non-array candidates contribute nothing.
  function collectIndexStep(arr, idx) {
    const collected = [];
    for (let a = 0; a < arr.length; a += 1) {
      const av = arr[a];
      if (Array.isArray(av) && idx >= 0 && idx < av.length) collected.push(av[idx]);
    }
    return collected;
  }

  // Indexed token fan-out: own-key lookup on the token (when present), then
  // indices in order. An empty intermediate set is a miss (adds nothing).
  function collectIndexedKey(cur, seg, next) {
    let base = cur;
    if (seg.key !== undefined) {
      if (!base || typeof base !== 'object' || !has.call(base, seg.key)) return;
      base = base[seg.key];
    }
    let arr = [base];
    for (let k = 0; k < seg.indices.length; k += 1) {
      arr = collectIndexStep(arr, seg.indices[k]);
      if (arr.length === 0) return;
    }
    for (let a = 0; a < arr.length; a += 1) next.push(arr[a]);
  }

  // One compiled-segment step: fan every current value out into `next`
  // through the plain or indexed collector above.
  function stepPathValues(values, seg) {
    const next = [];
    for (let v = 0; v < values.length; v += 1) {
      const cur = values[v];
      if (cur === undefined || cur === null) continue;
      if (seg.indices === undefined) collectPlainKey(cur, seg.key, next);
      else collectIndexedKey(cur, seg, next);
    }
    return next;
  }

  // Collect EVERY value at a dotted path, not just the first. getObjectByPath
  // resolves an ARRAY node to its first element owning the key, so a second
  // collaborator id in a byline/dialog list is invisible to it. This walker
  // fans out across all array elements instead (numeric [idx] segments still
  // select one element). Used by getFlattenByPathAll for channelId/channelName,
  // where ANY listed channel may match (see upstream PR #674).
  function getAllByPath(obj, path) {
    const compiled = compiledPath(path);
    let values = [obj];
    for (let i = 0; i < compiled.length; i += 1) {
      values = stepPathValues(values, compiled[i]);
      if (values.length === 0) return values;
    }
    return values;
  }

  // Like getFlattenByPath, but returns every flattened value across every
  // path in the array — so a blocked collaborator listed second still matches.
  function getFlattenByPathAll(obj, filterPath) {
    if (filterPath === undefined) return [];
    if (typeof filterPath === 'function') {
      const single = flattenRuns(filterPath(obj));
      return single === undefined ? [] : [single];
    }
    const filterPathArr = filterPath instanceof Array ? filterPath : [filterPath];
    const out = [];
    for (let i = 0; i < filterPathArr.length; i += 1) {
      const vals = getAllByPath(obj, filterPathArr[i]);
      for (let j = 0; j < vals.length; j += 1) {
        const flat = flattenRuns(vals[j]);
        if (flat !== undefined) out.push(flat);
      }
    }
    return out;
  }
  // Avatar-stack dialog holding every collaborator on a lockupViewModel
  // collab card (same listItemViewModel shape as the search-result byline
  // dialogs in rules.js).
  const LOCKUP_COLLAB_LIST_ITEMS_PATH =
    'metadata.lockupMetadataViewModel.image.avatarStackViewModel.rendererContext.commandContext.onTap.innertubeCommand.showDialogCommand.panelLoadingStrategy.inlineContent.dialogViewModel.customContent.listViewModel.listItems';

  // Collect every collaborator channel id from a lockupViewModel avatar stack.
  // Collab videos render one card per creator, and getFlattenByPath only
  // returns the first channelId it resolves.
  function getCollaboratorChannelIds(obj) {
    const listItems = getObjectByPath(obj, LOCKUP_COLLAB_LIST_ITEMS_PATH);
    const ids = [];
    if (Array.isArray(listItems)) {
      for (let i = 0; i < listItems.length; i += 1) {
        const id = getObjectByPath(
          listItems[i],
          'listItemViewModel.rendererContext.commandContext.onTap.innertubeCommand.browseEndpoint.browseId',
        );
        if (id !== undefined) ids.push(id);
      }
    }
    return ids;
  }

  // Collect every collaborator channel NAME from a lockupViewModel avatar
  // stack. The channelName rule is a single-name function
  // (lockupChannelName), so without this a blocked name listed second never
  // matches — the channelName half of the collab gap (channelId is covered
  // by getCollaboratorChannelIds above).
  function getCollaboratorChannelNames(obj) {
    const listItems = getObjectByPath(obj, LOCKUP_COLLAB_LIST_ITEMS_PATH);
    const names = [];
    if (Array.isArray(listItems)) {
      for (let i = 0; i < listItems.length; i += 1) {
        const item = listItems[i] && listItems[i].listItemViewModel;
        if (!item || typeof item !== 'object') continue;
        const title = item.title;
        let name;
        if (title && typeof title === 'object') {
          if (typeof title.content === 'string' && title.content.length > 0) {
            name = title.content;
          } else {
            const flat = flattenRuns(title);
            if (typeof flat === 'string' && flat.length > 0) name = flat;
          }
        } else if (typeof title === 'string' && title.length > 0) {
          name = title;
        }
        if (name !== undefined) names.push(name);
      }
    }
    return names;
  }

  const pathCache = new Map();

  function compilePathSegment(v) {
    if (!/\[.*\]/.test(v)) return { key: v };
    const indices = [];
    const re = /\[(\d+)\]/g;
    let m;
    while ((m = re.exec(v)) !== null) indices.push(parseInt(m[1], 10));
    const baseMatch = v.match(/^([^[]+)/);
    return { key: baseMatch && baseMatch[1] ? baseMatch[1] : undefined, indices };
  }

  function compiledPath(path) {
    if (path instanceof Array) {
      const out = [];
      for (let i = 0; i < path.length; i += 1) out.push(compilePathSegment(path[i]));
      return out;
    }
    let compiled = pathCache.get(path);
    if (compiled === undefined) {
      compiled = path.split('.').map(compilePathSegment);
      pathCache.set(path, compiled);
    }
    return compiled;
  }

  // THE canonical dotted-path walker for this codebase (options.js `get` is a
  // mirror for the options page — it cannot import this bundle — and MUST stay
  // in sync). Plain tokens do an own-key lookup (at an ARRAY node: the FIRST
  // element owning the key); token[idx..] does the lookup then numeric indices
  // in order. Any miss returns `def`, so typos/shape changes fail silently.
  // String paths are compiled once and cached (see compiledPath/pathCache).
  // Miss sentinel: payload values come from JSON and can never be this
  // reference, so an explicit `undefined` value still reads as a hit.
  const PATH_MISS = {};

  // Plain token (no brackets): own-key lookup, or first array element owning
  // the key. Returns PATH_MISS on a miss, the value (possibly undefined) on
  // a hit.
  function readPlainKey(node, key) {
    if (node instanceof Array) {
      const found = node.find((o) => o !== null && o !== undefined && has.call(o, key));
      if (found === undefined) return PATH_MISS;
      return found[key];
    }
    if (!node || !has.call(node, key)) return PATH_MISS;
    return node[key];
  }

  // Token with numeric indices: own-key lookup on the token (when present),
  // then indices in order. Out-of-range/negative/non-array reads are misses.
  function readIndexedKey(node, key, indices) {
    let base = node;
    if (key !== undefined) {
      if (!base || !has.call(base, key)) return PATH_MISS;
      base = base[key];
    }
    for (let k = 0; k < indices.length; k += 1) {
      const idx = indices[k];
      if (!Array.isArray(base) || idx < 0 || idx >= base.length) return PATH_MISS;
      base = base[idx];
    }
    return base;
  }

  function getObjectByPath(obj, path, def = undefined) {
    const compiled = compiledPath(path);
    let nextObj = obj;
    for (let i = 0; i < compiled.length; i += 1) {
      const seg = compiled[i];
      nextObj =
        seg.indices === undefined
          ? readPlainKey(nextObj, seg.key)
          : readIndexedKey(nextObj, seg.key, seg.indices);
      if (nextObj === PATH_MISS) return def;
    }
    return nextObj;
  }

  const BROWSE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
  const LOCKUP_ROWS_PATH =
    'metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows';
  const PART_LINK_PATH = 'text.commandRuns.onTap.innertubeCommand.browseEndpoint.browseId';
  const LOCKUP_TITLE_PATH = 'metadata.lockupMetadataViewModel.title';

  // A metadata text node -> channel name, or undefined. Prefers `content`,
  // falls back to runs-joined text (flattenRuns also covers simpleText).
  function channelTextOf(text) {
    if (!text || typeof text !== 'object') return undefined;
    if (typeof text.content === 'string' && text.content.length > 0) return text.content;
    const runs = flattenRuns(text);
    if (typeof runs === 'string' && runs.length > 0) return runs;
    return undefined;
  }

  // Precise channel signal: the part links to the channel (same browseId path
  // the channelId rule reads), so it survives accessibilityLabel changes.
  function partHasChannelLink(part) {
    const linkId = getObjectByPath(part, PART_LINK_PATH);
    return typeof linkId === 'string' && BROWSE_ID_RE.test(linkId);
  }

  // Legacy heuristic: a part with neither accessibilityLabel nor leadingIcon.
  function isBarePart(part) {
    return part.accessibilityLabel === undefined && part.leadingIcon === undefined;
  }

  // Shared metadataRows walker: first part (in row order) matching `isMatch`
  // that yields text wins.
  function findPartName(rows, isMatch) {
    for (let i = 0; i < rows.length; i += 1) {
      const parts = rows[i] && rows[i].metadataParts;
      if (!Array.isArray(parts)) continue;
      for (let j = 0; j < parts.length; j += 1) {
        const part = parts[j];
        if (!part || typeof part !== 'object' || !isMatch(part)) continue;
        const name = channelTextOf(part.text);
        if (name !== undefined) return name;
      }
    }
    return undefined;
  }

  // Pass 1: the linked channel part (see partHasChannelLink).
  function lockupLinkedChannelName(rows) {
    return findPartName(rows, partHasChannelLink);
  }

  // Pass 1b: link-less channel rows (home-feed/continuation lockups omit the
  // browseEndpoint link). Like NewPipe, read index-first: with 2+ rows the
  // first row's first part is the channel by position. Single-row cards stay
  // undefined — on a channel's own tabs that row is only views/date, and
  // returning it would misread the view count as the channel.
  function lockupFirstRowChannelName(rows) {
    const partRows = [];
    for (let i = 0; i < rows.length; i += 1) {
      const parts = rows[i] && rows[i].metadataParts;
      if (Array.isArray(parts)) partRows.push(parts);
    }
    if (partRows.length < 2) return undefined;
    const first = partRows[0][0];
    if (!first || typeof first !== 'object') return undefined;
    return channelTextOf(first.text);
  }

  // Pass 2: legacy bare-label heuristic (see isBarePart), gated on >= 2 rows
  // so single-row cards can never misread the view count.
  function lockupBareChannelName(rows) {
    if (rows.length < 2) return undefined;
    return findPartName(rows, isBarePart);
  }

  // Pass 3: channel-type lockups (LOCKUP_CONTENT_TYPE_CHANNEL) have no channel
  // row at all — the channel name IS the card title.
  function lockupTitleChannelName(renderer) {
    const contentType = getObjectByPath(renderer, 'contentType');
    if (typeof contentType !== 'string' || !contentType.includes('CHANNEL')) return undefined;
    const title = getObjectByPath(renderer, LOCKUP_TITLE_PATH);
    if (typeof title === 'string') return title.length > 0 ? title : undefined;
    return channelTextOf(title);
  }

  // The channel a lockupViewModel card attributes itself to, or undefined.
  // No static dotted path expresses this: channel-less cards (a channel's own
  // /videos tab, "From <channel>" shelves) drop the channel row, so a naive
  // metadataRows path silently resolves to the VIEW COUNT instead — the wrong
  // annotation and false channelName-filter hits. Tries linked -> positional
  // -> bare-label -> avatar-stack -> channel-type title, in that order. The
  // stack pass is explicit attribution (not a positional guess), so it cannot
  // misread a view count; without it link-less collab rows resolve to
  // undefined and the channelName field is skipped entirely, letting every
  // collaborator through.
  function lockupChannelName(renderer) {
    const rows = getObjectByPath(renderer, LOCKUP_ROWS_PATH);
    if (Array.isArray(rows)) {
      const linked = lockupLinkedChannelName(rows);
      if (linked !== undefined) return linked;
      const positional = lockupFirstRowChannelName(rows);
      if (positional !== undefined) return positional;
      const bare = lockupBareChannelName(rows);
      if (bare !== undefined) return bare;
    }
    const stackNames = getCollaboratorChannelNames(renderer);
    if (stackNames.length > 0) return stackNames[0];
    return lockupTitleChannelName(renderer);
  }

  // The channel a shortsLockupViewModel card attributes itself to, or
  // undefined. Shorts shelf cards carry no byline/avatar link — the only
  // channel signal is the protobuf baked into
  // onTap.innertubeCommand.reelWatchEndpoint.params (URL-encoded base64
  // whose decoded bytes embed the UC-prefixed channel id). Decoded as
  // latin1 and scanned for the UC-prefixed id, so protobuf framing changes
  // outside the id bytes cannot break the read. No channel name exists on
  // the card (overlayMetadata is title + view count only).
  // Minimal base64 -> latin1 decoder (no atob/Buffer: the inject realm and
  // the unit sandbox do not share either). Returns undefined on bad input.
  function base64ToLatin1(input) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const clean = String(input).replace(/[^A-Za-z0-9+/=]/g, '');
    if (clean.length === 0 || clean.length % 4 !== 0) return undefined;
    let out = '';
    for (let i = 0; i < clean.length; i += 4) {
      const a = alphabet.indexOf(clean[i]);
      const b = alphabet.indexOf(clean[i + 1]);
      const c = clean[i + 2] === '=' ? 0 : alphabet.indexOf(clean[i + 2]);
      const d = clean[i + 3] === '=' ? 0 : alphabet.indexOf(clean[i + 3]);
      if (a < 0 || b < 0 || c < 0 || d < 0) return undefined;
      const triple = (a << 18) | (b << 12) | (c << 6) | d;
      out += String.fromCharCode((triple >> 16) & 0xff);
      if (clean[i + 2] !== '=') out += String.fromCharCode((triple >> 8) & 0xff);
      if (clean[i + 3] !== '=') out += String.fromCharCode(triple & 0xff);
    }
    return out;
  }

  function shortsLockupChannelId(renderer) {
    const params = getObjectByPath(
      renderer,
      'onTap.innertubeCommand.reelWatchEndpoint.params',
    );
    if (typeof params !== 'string' || params.length === 0) return undefined;
    let encoded = params;
    try {
      encoded = decodeURIComponent(params);
    } catch (e) {}
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = base64ToLatin1(normalized);
    if (typeof binary !== 'string') return undefined;
    const match = binary.match(/UC[A-Za-z0-9_-]{22}/);
    return match ? match[0] : undefined;
  }

  // The channel that owns the current page (channel pages only), remembered
  // from the last payload that carried page metadata. Video cards on a
  // channel's own tabs omit per-card attribution (no avatar, no channel row),
  // so without this neither filtering nor the context menu can tell they
  // belong to the page's channel. Continuation payloads carry no metadata
  // themselves, hence the cache; it is cleared on navigation (see hooks.js
  // yt-navigate-start) and only ever set from a real channelMetadataRenderer.
  let pageChannel = null;

  function rememberPageChannel(root) {
    if (!root || typeof root !== 'object') return;
    const md = getObjectByPath(root, 'metadata.channelMetadataRenderer');
    if (!md || typeof md !== 'object') return;
    if (typeof md.externalId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(md.externalId)) return;
    const title = typeof md.title === 'string' ? md.title : flattenRuns(md.title);
    pageChannel = {
      id: md.externalId,
      name: typeof title === 'string' && title.length > 0 ? title : undefined,
    };
  }

  // parseTime() sentinel values:
  //   -1 = time string could not be parsed (matchFilterProperties treats any
  //        vidLen <= 0 as "no duration constraint", so -1 just never matches)
  //   -2 = the literal 'SHORTS' marker YouTube uses as duration text; a Short
  //        has no real time, so the shorts option decides on its own
  const INVALID_TIME = -1;
  const SHORTS_TIME = -2;

  function parseTime(timeStr) {
    if (timeStr === 'SHORTS') {
      return SHORTS_TIME;
    }
    const parts = String(timeStr)
      .split(':')
      .map((x) => parseInt(x, 10));
    switch (parts.length) {
      case 3: {
        return parts[0] * 60 * 60 + parts[1] * 60 + parts[2];
      }
      case 2: {
        return parts[0] * 60 + parts[1];
      }
      case 1: {
        return parts[0];
      }
      default: {
        return INVALID_TIME;
      }
    }
  }

/**
 * Parses a view count string (e.g., "1.5M views", "No views", "100K", "2 million views") into an integer.
 * @param {string} s - The input string to parse.
 * @returns {number|undefined} The exact view count as a number, or undefined if invalid.
 */
function parseViewCount(s) {
  if (typeof s !== 'string') return undefined;

  // Normalize spaces (including &nbsp;) and convert to lowercase
  const clean = s.replace(/\u00a0/g, ' ').trim().toLowerCase();
  if (clean === '') return undefined;

  // 1. Handle zero views case ("No views", "No view", any spacing/casing)
  if (/^no\s+views?$/.test(clean)) {
    return 0;
  }

  // 2. Match patterns like "1.5 million views", "100K views", or just "100K"
  // Group 1: The numeric part (digits, dots, commas)
  // Group 2: The multiplier suffix (thousand/million/billion or k/m/b)
  const match = clean.match(/^([\d,.]+)\s*(thousand|million|billion|[kmb])?(?:\s+views?)?$/);
  if (!match) return undefined;

  const numStr = match[1];
  const multiplierStr = match[2];

  // Reject malformed numbers ("1.2.3") that parseFloat would silently truncate
  if ((numStr.match(/\./g) || []).length > 1) return undefined;

  // Convert string to float (remove thousands-separator commas)
  const num = parseFloat(numStr.replace(/,/g, ''));
  if (Number.isNaN(num)) return undefined;

  // Map suffixes to their corresponding numeric multipliers (kept column-aligned below).
  // prettier-ignore
  const multipliers = {
    k: 1e3, thousand: 1e3,
    m: 1e6, million:  1e6,
    b: 1e9, billion:  1e9,
  };

  const factor = multiplierStr ? multipliers[multiplierStr] : 1;
  if (factor === undefined) return undefined;

  return Math.round(num * factor);
}
