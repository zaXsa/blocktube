#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INJECT_DIR = path.join(ROOT, 'src', 'scripts', 'inject');
const SCRIPTS_DIR = path.join(ROOT, 'src', 'scripts');
const OUT = path.join(ROOT, 'src', 'scripts', 'inject.js');

// Order matters only for load-time const initializers (each module's consts
// must be declared before they are read). consts.js (embedded data copy) ->
// rules (pure data) -> paths -> object-filter -> custom-filters -> network ->
// context-menu -> hooks (lifecycle + listeners, which must stay last).
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

function build() {
  const body = MODULES.map(({ path: p, stripDoc }) => {
    const file = path.join(ROOT, p);
    let text = fs.readFileSync(file, 'utf8').replace(/^\n+|\n+$/g, '');
    if (stripDoc) text = stripDocHeader(text);
    return `  // ================== ${p} ==================\n\n${text}`;
  }).join('\n\n');
  return HEADER + body + FOOTER;
}

const generated = build();

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