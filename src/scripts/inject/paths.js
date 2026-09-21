  const has = Object.prototype.hasOwnProperty;
  // !! Utils

  function flattenRuns(arr) {
    if (arr.simpleText !== undefined) return arr.simpleText;
    if (!(arr.runs instanceof Array)) return arr;
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

  function parseViewCount(viewCount) {
    const parts = viewCount.split(' ');
    if (parts[1] !== 'views' && parts[1] !== 'view') return undefined; // Fail if not english formatting
    const views = parts[0];

    // Handle abbreviated formats (K, M, B)
    const multipliers = {
      K: 1000,
      M: 1000000,
      B: 1000000000,
    };

    // Check if it ends with a multiplier
    const lastChar = views.slice(-1).toUpperCase();
    let multiplier = 1;
    let numericPart = views.replace(',', '');

    if (multipliers[lastChar]) {
      multiplier = multipliers[lastChar];
      numericPart = views.slice(0, -1); // Remove the letter
    }

    // Return the final count
    return numericPart * multiplier;
  }
