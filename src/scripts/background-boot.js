'use strict';

// Chrome MV3 service-worker entry point (platform/chrome/manifest.json).
//
// Why a wrapper: when a worker's *only* top-level script throws during
// evaluation (for example a missing import or a syntax error introduced by a
// build step), Chrome reports the opaque
//   "Service worker registration failed. Status code: 15"
// and the worker console is empty. Routing the real entry through this file
// keeps the worker registered long enough to log the actual exception, and the
// rethrow still marks the boot as failed instead of silently running without
// background.js.
//
// Firefox has no service-worker background; its manifests keep
// background.scripts = ['consts.js', 'background.js'] and never load this file.
//
// Import ONLY background.js: it already does importScripts('consts.js') and
// consts.js declares top-level `const BLOCKTUBE_CONSTS`, so importing it here
// as well evaluates it twice in the same worker scope and throws
// "Identifier 'BLOCKTUBE_CONSTS' has already been declared".
try {
  importScripts('background.js');
} catch (e) {
  console.error('BlockTube background boot failed', e);
  throw e;
}
