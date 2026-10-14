#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const prettier = require('prettier');

const ROOT = path.join(__dirname, '..');
const INJECT_DIR = path.join(ROOT, 'src', 'scripts', 'inject');
const SCRIPTS_DIR = path.join(ROOT, 'src', 'scripts');
const OUT = path.join(ROOT, 'src', 'scripts', 'inject.js');

// Order matters only for load-time const initializers (each module's consts
// must be declared before they are read). consts.js (embedded data copy) ->
// rules (pure data) -> paths -> object-filter -> custom-filters -> network ->
// context-menu -> comment-dom -> hooks (lifecycle + listeners, which must stay last).
// NOTE: consts.js is EMBEDDED as fragment #0. The page/MAIN-world bundle must
// be SELF-CONTAINED — separately-injected MAIN-world content scripts do not
// reliably share top-level bindings or cross-file globals (crash history:
// `const` efd4c81 -> `globalThis property` 50cdec8 -> embed here). The
// standalone src/scripts/consts.js is still loaded first in the isolated
// world, the service worker and the options/popup pages, where it publishes
// `globalThis.BLOCKTUBE_CONSTS` for those realms.
const MODULES = [
  { path: 'src/scripts/consts.js', stripDoc: true },
  { path: 'src/scripts/inject/rules.js' },
  { path: 'src/scripts/inject/paths.js' },
  { path: 'src/scripts/inject/object-filter.js' },
  { path: 'src/scripts/inject/custom-filters.js' },
  { path: 'src/scripts/inject/network.js' },
  { path: 'src/scripts/inject/context-menu.js' },
  { path: 'src/scripts/inject/shorts-overlay.js' },
  { path: 'src/scripts/inject/comment-dom.js' },
  { path: 'src/scripts/inject/hooks.js' },
];

const HEADER = `/*
 * GENERATED FILE - DO NOT EDIT.
 *
 * Source fragments: src/scripts/consts.js + src/scripts/inject/*.js (see
 * MODULES in tools/build-inject.js).
 * Rebuild with: npm run build:inject    |    Drift-check with: npm run check:inject
 */

(function blockTube() {
  'use strict';

`;

const FOOTER = `
})();
`;

function stripDocHeader(text) {
  const lines = text.split('\n');
  let i = 0;
  // skip leading blank lines and //-only comment lines
  while (i < lines.length && (lines[i].trim() === '' || lines[i].trim().startsWith('//'))) i++;
  const rest = lines.slice(i).join('\n');
  return rest.replace(/\n{3,}/g, '\n\n').replace(/^\n/, '');
}

// Bundle diet: drop comment-only lines from the GENERATED output only.
// Sources in src/scripts/inject/*.js stay fully commented. Kept:
// - the file header banner (leading /* ... */ block),
// - fragment banners (// ================== <path> ==================),
// - `// !!` section markers (they orient readers of the bundle),
// - formatter/linter directives (`// prettier-ignore`, `// eslint-...`):
//   stripping them would change Prettier layout or lint behavior.
// Trailing (end-of-line) comments are kept. Applied AFTER the Prettier
// format step (strip after format, never before); the result is formatted
// a second time so comment removal can't leave Prettier-unstable layout
// (e.g. a comment forcing multi-line layout, then collapsed once stripped).
// Blank-line runs are collapsed to what Prettier emits.
function stripBundleComments(formatted) {
  const lines = formatted.split('\n');
  // Keep the leading header block comment verbatim (GENERATED FILE banner).
  let headerEnd = -1;
  if (lines[0].trimStart().startsWith('/*')) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('*/')) {
        headerEnd = i;
        break;
      }
    }
  }
  const head = headerEnd >= 0 ? lines.slice(0, headerEnd + 1) : [];
  const rest = headerEnd >= 0 ? lines.slice(headerEnd + 1) : lines;
  const kept = rest.filter((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//')) {
      if (line.includes('==================')) return true;
      if (trimmed.startsWith('// !!')) return true;
      if (trimmed.startsWith('// prettier-ignore')) return true;
      if (trimmed.startsWith('// eslint-')) return true;
      // Load-bearing for `eslint no-fallthrough` (e.g. `// falls through`).
      // Narrow match: the bare annotation only, not prose containing
      // "fall through" (e.g. network.js has both).
      if (/^\/\/\s*falls?\s?through[\s.,:;!]*$/i.test(trimmed)) return true;
      // Future-proof: type-checker / coverage directives must survive.
      if (/(istanbul|c8)\s+ignore|@ts-(ignore|expect-error|nocheck)/i.test(trimmed)) return true;
      return false;
    }
    // JSDoc-style block comment-only lines (the only /* */ lines outside
    // the header banner). No code can follow on these lines by construction
    // of the check (trimmed start), so dropping is runtime-neutral.
    if (
      trimmed.startsWith('/**') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*') ||
      trimmed === '*/'
    ) {
      return false;
    }
    return true;
  });
  return head
    .concat(kept)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

async function build() {
  const body = MODULES.map(({ path: p, stripDoc }) => {
    const file = path.join(ROOT, p);
    let text = fs.readFileSync(file, 'utf8').replace(/^\n+|\n+$/g, '');
    if (stripDoc) text = stripDocHeader(text);
    return `  // ================== ${p} ==================\n\n${text}`;
  }).join('\n\n');
  // Format through Prettier so the generated file satisfies `npm run fmt:check`
  // (and thus agrees with `npm run check:inject`). The node API does NOT
  // auto-discover config from filepath — resolveConfig must be merged in.
  const config = (await prettier.resolveConfig(OUT)) || {};
  const formatted = await prettier.format(HEADER + body + FOOTER, { filepath: OUT, ...config });
  const stripped = stripBundleComments(formatted);
  // Second format: comment removal can change Prettier's layout decisions
  // (a comment forcing multi-line vs collapsed single-line once stripped).
  // Re-formatting the stripped text keeps `npm run fmt:check` green.
  return prettier.format(stripped, { filepath: OUT, ...config });
}

(async () => {
  const generated = await build();

  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : undefined;
    if (current !== generated) {
      console.error(
        'MISMATCH: src/scripts/inject.js is stale vs src/scripts/inject/*.js\n' +
          'Run `npm run build:inject` and commit the regenerated file.',
      );
      process.exit(1);
    }
    console.log('OK: src/scripts/inject.js matches the fragments');
  } else {
    fs.writeFileSync(OUT, generated);
    console.log(`built ${path.relative(ROOT, OUT)}`);
  }
})();