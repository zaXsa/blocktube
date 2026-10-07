#!/usr/bin/env node
'use strict';
/**
 * Advisory readability scan: flags functions that are too long or nested too
 * deep. Exit 0 when clean, 1 when offenders exist, 2 on script error.
 *
 * Both checks reuse the repo's own eslint (a devDependency — run
 * `npm install` first), so the counts match `max-lines-per-function` and
 * `max-depth` exactly instead of a hand-rolled parser drifting from them:
 *
 *   lines: blank and comment-only lines don't count (skipBlankLines,
 *          skipComments), IIFE bodies do (IIFEs).
 *   depth: nesting of if/loops/switch/try blocks past the limit.
 *
 * Scope: everything under src/ EXCEPT the generated bundle (src/scripts/inject.js —
 * fix the fragment in src/scripts/inject/ instead) and the vendored CodeMirror
 * copy (src/ui/cm/). Top-level IIFE file wrappers (`(function () { ... })();`)
 * are structural file scope, not splittable units, so findings attributed to
 * the wrapper itself are suppressed — everything nested inside it is still
 * checked. (A top-level ASSIGNED function, e.g. `const f = function ...`, stays
 * flagged: that one can and should be split.) Existing violations never block
 * anything; this is advisory — run it before committing (`--staged`) or on
 * demand.
 *
 * Usage:
 *   node tools/check-length.js [--max N] [--max-depth N] [paths...]
 *   node tools/check-length.js --staged   # only files staged in git
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DEFAULT_MAX_LINES = 30;
const DEFAULT_MAX_DEPTH = 4;

// Never scanned: generated output and third-party vendor code.
const EXCLUDED_PREFIXES = ['src/ui/cm/'];
const EXCLUDED_FILES = new Set(['src/scripts/inject.js']);

function usage() {
  console.log(
    [
      'Usage: node tools/check-length.js [--max N] [--max-depth N] [paths...]',
      '       node tools/check-length.js --staged',
      '',
      `  --max N        max function body lines (default ${DEFAULT_MAX_LINES})`,
      `  --max-depth N  max block-nesting depth (default ${DEFAULT_MAX_DEPTH})`,
      '  --staged       scan only git-staged .js files instead of src/',
      '  paths...       files or dirs to scan (default: src/)',
    ].join('\n'),
  );
}

function parseArgs(argv) {
  const opts = { max: DEFAULT_MAX_LINES, maxDepth: DEFAULT_MAX_DEPTH, staged: false, paths: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      usage();
      process.exit(0);
    } else if (a === '--max') {
      opts.max = Number(argv[(i += 1)]);
    } else if (a === '--max-depth') {
      opts.maxDepth = Number(argv[(i += 1)]);
    } else if (a === '--staged') {
      opts.staged = true;
    } else if (a.startsWith('-')) {
      throw new Error(`unknown flag: ${a}`);
    } else {
      opts.paths.push(a);
    }
  }
  if (!Number.isInteger(opts.max) || opts.max < 1)
    throw new Error('--max needs a positive integer');
  if (!Number.isInteger(opts.maxDepth) || opts.maxDepth < 1) {
    throw new Error('--max-depth needs a positive integer');
  }
  return opts;
}

function isExcluded(rel) {
  if (EXCLUDED_FILES.has(rel)) return true;
  return EXCLUDED_PREFIXES.some((p) => rel === p || rel.startsWith(p));
}

function walkJs(absDir, out) {
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      walkJs(abs, out);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const rel = path.relative(ROOT, abs);
      if (!isExcluded(rel)) out.push(abs);
    }
  }
}

function filesFromPaths(paths) {
  const out = [];
  for (const p of paths) {
    const abs = path.resolve(ROOT, p);
    const st = fs.statSync(abs);
    if (st.isDirectory()) {
      walkJs(abs, out);
    } else if (abs.endsWith('.js')) {
      const rel = path.relative(ROOT, abs);
      if (!isExcluded(rel)) out.push(abs);
    }
  }
  return [...new Set(out)].sort();
}

function stagedFiles() {
  let raw;
  try {
    raw = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
  } catch {
    throw new Error('git diff --cached failed — are you inside the repo?');
  }
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter((f) => f.endsWith('.js') && !isExcluded(f) && fs.existsSync(path.join(ROOT, f)))
    .map((f) => path.join(ROOT, f))
    .sort();
}

const FUNCTION_TYPES = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  // eslint reports shorthand methods at the method head (the key), which sits
  // outside the FunctionExpression value range — include the containers so a
  // method attributes to itself instead of the enclosing file wrapper.
  'MethodDefinition',
]);

function walkAst(node, cb) {
  if (!node || typeof node.type !== 'string') return;
  cb(node);
  for (const key of Object.keys(node)) {
    if (key === 'parent') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const c of child) walkAst(c, cb);
    } else {
      walkAst(child, cb);
    }
  }
}

// A top-level `(function () { ... })();` (optionally behind !/void) is file
// scope, not a unit — returns the range starts of such wrapper callees so the
// finding attributed to the wrapper itself can be suppressed.
function findTopLevelWrappers(ast) {
  const starts = new Set();
  for (const stmt of ast.body) {
    if (stmt.type !== 'ExpressionStatement') continue;
    let expr = stmt.expression;
    while (expr && expr.type === 'UnaryExpression') expr = expr.argument;
    if (
      expr &&
      expr.type === 'CallExpression' &&
      expr.callee &&
      (expr.callee.type === 'FunctionExpression' || expr.callee.type === 'ArrowFunctionExpression')
    ) {
      starts.add(expr.callee.range[0]);
    }
  }
  return starts;
}

function locContains(loc, line, col) {
  const s = loc.start;
  const e = loc.end;
  const afterStart = line > s.line || (line === s.line && col >= s.column);
  const beforeEnd = line < e.line || (line === e.line && col <= e.column);
  return afterStart && beforeEnd;
}

// Innermost function containing the 0-based (line, col), or null. Depth hits
// are reported at the nested block, not the function head, so attribute by
// containment (smallest range wins) rather than by exact position.
function innermostFunctionAt(ast, line, col) {
  const isCandidate = (n) =>
    FUNCTION_TYPES.has(n.type) || (n.type === 'Property' && n.method === true);
  let best = null;
  walkAst(ast, (n) => {
    if (!isCandidate(n) || !locContains(n.loc, line, col)) return;
    if (!best || n.range[1] - n.range[0] < best.range[1] - best.range[0]) best = n;
  });
  return best;
}

// Drop findings that belong to a top-level IIFE file wrapper. Files are only
// parsed when they have findings, and an unparseable file keeps its findings.
function suppressWrappers(hits, espree) {
  const byFile = new Map();
  for (const h of hits) {
    if (!byFile.has(h.file)) byFile.set(h.file, []);
    byFile.get(h.file).push(h);
  }
  const kept = [];
  let suppressed = 0;
  for (const [file, fileHits] of byFile) {
    let wrappers = null;
    try {
      const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
      const ast = espree.parse(src, {
        ecmaVersion: 2020,
        sourceType: 'script',
        loc: true,
        range: true,
      });
      wrappers = findTopLevelWrappers(ast);
      if (wrappers.size > 0) {
        for (const h of fileHits) {
          const fn = innermostFunctionAt(ast, h.line, h.column - 1);
          if (fn && wrappers.has(fn.range[0])) {
            suppressed += 1;
            continue;
          }
          kept.push(h);
        }
        continue;
      }
    } catch {
      wrappers = null; // fall through: keep every finding in this file
    }
    for (const h of fileHits) kept.push(h);
  }
  return { kept, suppressed };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const files = opts.staged
    ? stagedFiles()
    : filesFromPaths(opts.paths.length > 0 ? opts.paths : ['src']);
  if (files.length === 0) {
    console.log('check:length: no .js files to scan.');
    return 0;
  }

  let ESLint;
  let espree;
  try {
    // eslint-disable-next-line global-require
    ({ ESLint } = require('eslint'));
    // eslint-disable-next-line global-require
    espree = require('espree');
  } catch {
    console.error('check:length: eslint is not installed — run `npm install` first.');
    return 2;
  }
  const eslint = new ESLint({
    useEslintrc: false,
    overrideConfig: {
      parserOptions: { ecmaVersion: 2020, sourceType: 'script' },
      env: { browser: true, es2020: true },
      rules: {
        'max-lines-per-function': [
          'error',
          { max: opts.max, skipBlankLines: true, skipComments: true, IIFEs: true },
        ],
        'max-depth': ['error', opts.maxDepth],
      },
    },
  });

  const results = await eslint.lintFiles(files);
  const hits = [];
  const skipped = [];
  for (const r of results) {
    const rel = path.relative(ROOT, r.filePath);
    for (const m of r.messages) {
      if (m.fatal) {
        skipped.push(`${rel}: ${m.message}`);
      } else if (m.ruleId === 'max-lines-per-function' || m.ruleId === 'max-depth') {
        hits.push({ file: rel, line: m.line, column: m.column, text: m.message });
      }
    }
  }
  const { kept, suppressed } = suppressWrappers(hits, espree);
  const note = suppressed > 0 ? ` (${suppressed} top-level file-wrapper finding(s) excluded)` : '';
  kept.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));

  if (kept.length === 0 && skipped.length === 0) {
    console.log(
      `check:length: clean — no function over ${opts.max} lines or deeper than ${opts.maxDepth}.${note}`,
    );
    return 0;
  }
  let current = null;
  for (const h of kept) {
    if (h.file !== current) {
      current = h.file;
      console.log(`\n${current}`);
    }
    console.log(`  ${h.line}:${h.column}  ${h.text}`);
  }
  for (const s of skipped) console.error(`  (skipped, could not parse: ${s})`);
  console.log(
    `\ncheck:length: ${kept.length} finding(s) over the limits ` +
      `(${opts.max} lines / depth ${opts.maxDepth}).${note} Advisory only — ` +
      `split one helper per pass/predicate and re-run.`,
  );
  return kept.length > 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(`check:length: ${e.message}`);
    process.exit(2);
  });
