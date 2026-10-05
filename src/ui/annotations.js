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
  // them byte-identical across save round-trips, never let the user edit
  // them, and never silently drop them.
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

  // Rebuild a stored array: annotations back at their original indices,
  // rules (possibly edited — added, removed, reordered) filling the other
  // slots in order, surplus rules appended at the end. With unedited rules
  // the result is byte-identical to the split input, including interleaved
  // comments and the trailing '' separator the background appends
  // (src/scripts/background.js). With edited rules this is best-effort
  // re-attachment, never a reason to block the save.
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

  root.BLOCKTUBE_ANNOTATIONS = { isAnnotationLine, splitAnnotations, mergeAnnotations };
})(globalThis);
