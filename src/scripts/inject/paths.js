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

  // Collect every collaborator channel id from a lockupViewModel avatar stack.
  // Collab videos render one card per creator, and getFlattenByPath only
  // returns the first channelId it resolves.
  function getCollaboratorChannelIds(obj) {
    const listItems = getObjectByPath(
      obj,
      'metadata.lockupMetadataViewModel.image.avatarStackViewModel.rendererContext.commandContext.onTap.innertubeCommand.showDialogCommand.panelLoadingStrategy.inlineContent.dialogViewModel.customContent.listViewModel.listItems',
    );
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
  // in sync). Semantics, in order per `seg`:
  //   1. plain token     -> own-key lookup; at an ARRAY node it resolves the
  //      FIRST element that owns the key (`[].find(has)`). Trap: on a miss it
  //      returns `def`, so typos and shape changes fail silently; and an array
  //      of non-objects can never match. Never evaluates past a miss.
  //   2. token[idx..]    -> own-key lookup on the token, then numeric indices
  //      in order; out-of-range/negative/undefined -> `def`.
  // Passing an array of paths walks each segment list in order (used per
  // renderer rule where one property may live at several possible paths).
  // String paths are compiled once and cached (see compiledPath/pathCache).
  function getObjectByPath(obj, path, def = undefined) {
    const compiled = compiledPath(path);
    let nextObj = obj;

    for (let i = 0; i < compiled.length; i += 1) {
      const seg = compiled[i];

      if (seg.indices === undefined) {
        // segment is a plain token (no bracket)
        if (nextObj instanceof Array) {
          // when we have an array of objects, find an element that contains the key v
          const found = nextObj.find((o) => has.call(o, seg.key));
          if (found === undefined) return def;
          nextObj = found[seg.key];
        } else {
          if (!nextObj || !has.call(nextObj, seg.key)) return def;
          nextObj = nextObj[seg.key];
        }
      } else {
        // navigate to base property first (if present)
        if (seg.key !== undefined) {
          if (!nextObj || !has.call(nextObj, seg.key)) return def;
          nextObj = nextObj[seg.key];
        }
        // then apply numeric indices in order
        for (let k = 0; k < seg.indices.length; k += 1) {
          const idx = seg.indices[k];
          if (!Array.isArray(nextObj) || idx < 0 || idx >= nextObj.length) return def;
          nextObj = nextObj[idx];
        }
      }
    }

    return nextObj;
  }

  // The channel a lockupViewModel card attributes itself to, or undefined.
  // A static dotted path cannot express this: channel cards carry the channel
  // in metadataRows[0], but channel-less cards (a channel's own /videos tab,
  // "From <channel>" shelves) drop that row, so
  // `metadataRows.metadataParts.text.content` silently resolves to the VIEW
  // COUNT ("3.4M") instead — the wrong annotation on allowlist/block entries
  // and false channelName-filter hits on view counts. The channel part is the
  // one whose text is a bare label: view/time parts always carry a part-level
  // accessibilityLabel (views additionally a leadingIcon), the channel part
  // never does. Single-row cards have no channel row at all.
  function lockupChannelName(renderer) {
    const rows = getObjectByPath(
      renderer,
      'metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows',
    );
    if (!Array.isArray(rows) || rows.length < 2) return undefined;
    for (let i = 0; i < rows.length; i += 1) {
      const parts = rows[i] && rows[i].metadataParts;
      if (!Array.isArray(parts)) continue;
      for (let j = 0; j < parts.length; j += 1) {
        const part = parts[j];
        if (!part || typeof part !== 'object') continue;
        if (part.accessibilityLabel !== undefined || part.leadingIcon !== undefined) continue;
        const text = part.text;
        if (!text || typeof text !== 'object') continue;
        if (typeof text.content === 'string' && text.content.length > 0) return text.content;
        const runs = flattenRuns(text);
        if (typeof runs === 'string' && runs.length > 0) return runs;
      }
    }
    return undefined;
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
