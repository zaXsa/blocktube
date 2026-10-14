(function (root) {
  'use strict';

  // Position-tagged annotations for the options-page filter editors.
  // Pure functions, no DOM.
  //
  // A stored filter line is an annotation when the background's compileRegex
  // ignores it: blank separators and `//` comments — including the
  // `// Blocked by context menu (<title>) (<locale date>)` lines written by
  // src/scripts/content_script.js. Classification mirrors compileRegex
  // (src/scripts/background.js): trimmed-empty or starts with `//`.
  // Annotations are metadata, never rules: the UI must display and preserve
  // them byte-identical across save round-trips and never silently drop
  // them. Table views keep them out of the editing path (edits go through
  // the preserving row helpers); raw text editing is explicit and free.
  function isAnnotationLine(line) {
    if (typeof line !== 'string') return false;
    const trimmed = line.trim();
    return trimmed === '' || trimmed.startsWith('//');
  }

  // Split stored lines into editable rules plus annotations tagged with
  // their original indices. Nothing is normalized: both sides keep the
  // original strings so merge can rebuild the input byte-identical.
  function splitAnnotations(lines) {
    if (!(lines instanceof Array)) {
      throw new TypeError('splitAnnotations expects an array of lines');
    }
    const rules = [];
    const annotations = [];
    lines.forEach((line, index) => {
      if (isAnnotationLine(line)) {
        annotations.push({ index, line });
      } else {
        rules.push(line);
      }
    });
    return { rules, annotations };
  }

  // Rebuild a stored array: annotations at original indices (test-only for now —
  // UI preserves via the untouched save path, so nothing calls this yet; kept with
  // coverage as the specified save-time fallback); rules (added/removed/reordered)
  // fill other slots in order, surplus appended. Unedited rules stay byte-identical
  // to split input, incl. interleaved comments + trailing '' separator from the
  // background (src/scripts/background.js); edited rules best-effort, never blocks save.
  function mergeAnnotations(rules, annotations) {
    if (!(rules instanceof Array)) {
      throw new TypeError('mergeAnnotations expects an array of rules');
    }
    if (!(annotations instanceof Array)) {
      throw new TypeError('mergeAnnotations expects an array of annotations');
    }
    const byIndex = new Map();
    let maxIndex = -1;
    annotations.forEach((entry) => {
      byIndex.set(entry.index, entry.line);
      if (entry.index > maxIndex) {
        maxIndex = entry.index;
      }
    });
    const out = [];
    let nextRule = 0;
    const slots = Math.max(maxIndex + 1, rules.length + annotations.length);
    for (let i = 0; i < slots; i++) {
      if (byIndex.has(i)) {
        out.push(byIndex.get(i));
      } else if (nextRule < rules.length) {
        out.push(rules[nextRule++]);
      }
    }
    while (nextRule < rules.length) {
      out.push(rules[nextRule++]);
    }
    return out;
  }

  // Raw-ID validity for the Add boxes: the same rule the background enforces
  // on context-menu entries (src/scripts/background.js) — YouTube IDs use
  // this charset, capped at 64 chars. No URL parsing, no handle resolution,
  // no network: anything else is rejected with a notice.
  function isValidFilterId(id) {
    return typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id);
  }

  // Active entries for the header counts: editable rule lines only
  // (non-empty, non-`//`). Annotations are metadata, not rules.
  function countActiveEntries(lines) {
    if (!(lines instanceof Array)) {
      throw new TypeError('countActiveEntries expects an array of lines');
    }
    return splitAnnotations(lines).rules.length;
  }

  // Lines that would fail downstream RegExp construction: `/pattern/flags`
  // lines — detected exactly like compileRegex does — that throw in
  // `new RegExp`. Plain keywords are escaped downstream and ID lists are
  // exact-matched, so only the regex-evaluated editors (title, channel name,
  // comment) need this check. Informational only: a flagged line simply
  // never matches, saving is never blocked.
  function findInvalidRegexLines(lines) {
    if (!(lines instanceof Array)) {
      throw new TypeError('findInvalidRegexLines expects an array of lines');
    }
    const bad = [];
    lines.forEach((line, index) => {
      if (typeof line !== 'string' || isAnnotationLine(line)) return;
      const parts = /^\/(.*)\/(.*)$/.exec(line.trim());
      if (parts === null) return;
      try {
        new RegExp(parts[1], parts[2]);
      } catch (e) {
        bad.push({ index, line });
      }
    });
    return bad;
  }

  // Row model for ID entity tables (OPTIONS_UI_PLAN.md Phase 8). Provenance looks like
  // `// Blocked by context menu (<text>) (<date>)` / `// Blocked by direct add () (<date>)`,
  // comment-popup as `comment menu`, Shorts taps as `short context menu`; allowlist `Allowlisted`
  // (`// Allowlisted by context menu …` / `direct add …`, via whitelist context-menu + Add-box flows).
  // Older entries predate the date: single-group `// Blocked by context menu (<text>)`. Text may
  // contain parens, so date is the LAST group; kind is the fixed word(s) after the prefix; rest stays unparsed.
  const PROVENANCE_PREFIXES = [
    `// ${BLOCKTUBE_CONSTS.VERBS.BLOCK} by `,
    `// ${BLOCKTUBE_CONSTS.VERBS.ALLOW} by `,
  ];
  const LABEL_PREFIX = '// Label:';

  // A label line, tolerating user spacing (`//Label:x` as well as
  // `// Label: x`). Returns the label text, or null when not a label line.
  function readLabel(line) {
    if (typeof line !== 'string') return null;
    const match = /^\/\/\s*Label:(.*)$/.exec(line.trim());
    return match === null ? null : match[1].trim();
  }

  function parseProvenance(line) {
    if (typeof line !== 'string') return null;
    const trimmed = line.trimStart();
    const prefix = PROVENANCE_PREFIXES.find((p) => trimmed.startsWith(p));
    if (prefix === undefined) return null;
    const rest = line.trim().slice(prefix.length);
    const kinds = ['short context menu', 'context menu', 'direct add', 'comment menu'];
    const kind = kinds.find((k) => rest === k || rest.startsWith(`${k} `));
    if (kind === undefined) return { kind: 'other', text: '', date: '', raw: line };
    const tail = rest.slice(kind.length).trim();
    const dated = /^\((.*)\)\s*\(([^()]*)\)\s*$/.exec(tail);
    if (dated !== null) return { kind, text: dated[1].trim(), date: dated[2], raw: line };
    const dateless = /^\((.*)\)\s*$/.exec(tail);
    if (dateless !== null) return { kind, text: dateless[1].trim(), date: '', raw: line };
    return { kind, text: '', date: '', raw: line };
  }

  // Fold one annotation-ish line into the pending provenance: blanks end
  // the group (clear it), parsed provenance comments arm it, unknown `//`
  // formats leave it untouched. Returns true when the line was annotation-ish.
  function foldAnnotationLine(line, index, state) {
    if (!(typeof line === 'string' && isAnnotationLine(line))) return false;
    if (line.trim() === '') {
      state.pendingProvenance = null;
    } else {
      const parsed = parseProvenance(line);
      if (parsed !== null) state.pendingProvenance = { line, index, parsed };
    }
    return true;
  }

  // Build one rule row: the label attaches only from the immediately
  // preceding `// Label:` line; the pending provenance (if any) rides along.
  function buildRuleRow(lines, line, index, pendingProvenance) {
    let label = '';
    let labelIndex = -1;
    const attached = readLabel(lines[index - 1]);
    if (attached !== null) {
      label = attached;
      labelIndex = index - 1;
    }
    return {
      ruleIndex: index,
      id: line,
      label,
      labelIndex,
      provenance: pendingProvenance === null ? null : pendingProvenance.parsed,
      provenanceLine: pendingProvenance === null ? '' : pendingProvenance.line,
      provenanceIndex: pendingProvenance === null ? -1 : pendingProvenance.index,
    };
  }

  // Split stored lines into one row per rule (blocked ID). A `// Label:` line
  // attaches only when immediately above its rule; a `// Blocked …` line
  // attaches to following rules until a blank line ends the group (context
  // menus store several IDs under one comment). Unknown `//` formats are
  // preserved verbatim in the array and simply unattributed — parsing never
  // breaks on user-customized files.
  function parseRuleRows(lines) {
    if (!(lines instanceof Array)) {
      throw new TypeError('parseRuleRows expects an array of lines');
    }
    const rows = [];
    const state = { pendingProvenance: null };
    lines.forEach((line, index) => {
      if (foldAnnotationLine(line, index, state)) return;
      rows.push(buildRuleRow(lines, line, index, state.pendingProvenance));
    });
    return rows;
  }

  // Remove a rule by its index: the rule line plus an adjacent attached
  // `// Label:` line go, and the provenance comment goes too — but only when
  // no other remaining rule still uses it (context-menu groups share one
  // comment across several IDs).
  function removeRuleLines(lines, ruleIndex) {
    if (!(lines instanceof Array)) {
      throw new TypeError('removeRuleLines expects an array of lines');
    }
    const target = lines[ruleIndex];
    if (typeof target !== 'string' || isAnnotationLine(target)) {
      throw new Error('removeRuleLines expects the index of a rule line');
    }
    const rows = parseRuleRows(lines);
    const victim = rows.find((row) => row.ruleIndex === ruleIndex);
    if (victim === undefined) {
      throw new Error('removeRuleLines expects the index of a rule line');
    }
    const drop = new Set([ruleIndex]);
    if (victim.labelIndex >= 0) drop.add(victim.labelIndex);
    if (victim.provenanceIndex >= 0) {
      const shared = rows.some(
        (row) => row !== victim && row.provenanceIndex === victim.provenanceIndex,
      );
      if (!shared) drop.add(victim.provenanceIndex);
    }
    return lines.filter((line, index) => !drop.has(index));
  }

  // Set (or clear, with empty text) the `// Label:` line of a rule.
  // Sanitized like background annotations — single line, capped at 200 —
  // plus invisible bidi/control characters stripped so a label cannot
  // visually reorder or conceal its row.
  function setRuleLabel(lines, ruleIndex, text) {
    if (!(lines instanceof Array)) {
      throw new TypeError('setRuleLabel expects an array of lines');
    }
    const target = lines[ruleIndex];
    if (typeof target !== 'string' || isAnnotationLine(target)) {
      throw new Error('setRuleLabel expects the index of a rule line');
    }
    const clean = String(text)
      .replace(/\s+/g, ' ')
      // Intentional control/bidi strip (see comment above): the range IS the
      // sanitizer, so the no-control-regex rule is disabled for this line.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
      .trim()
      .slice(0, 200);
    const out = lines.slice();
    const attached = readLabel(out[ruleIndex - 1]) !== null;
    if (attached) {
      if (clean === '') {
        out.splice(ruleIndex - 1, 1);
      } else {
        out[ruleIndex - 1] = `${LABEL_PREFIX} ${clean}`;
      }
    } else if (clean !== '') {
      out.splice(ruleIndex, 0, `${LABEL_PREFIX} ${clean}`);
    }
    return out;
  }

  root.BLOCKTUBE_ANNOTATIONS = {
    isAnnotationLine,
    splitAnnotations,
    mergeAnnotations,
    isValidFilterId,
    countActiveEntries,
    findInvalidRegexLines,
    parseProvenance,
    parseRuleRows,
    removeRuleLines,
    setRuleLabel,
  };
})(globalThis);
