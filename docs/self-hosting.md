# Self-hosting / local install

This fork is not published to the Chrome Web Store or Firefox AMO (unlike
upstream `amitbl/blocktube`), so building from source and loading it
yourself is currently the only way to run it. Clone the repo and deal with
it yourself — no downloads, no zips supplied.

## Step by step — Chrome

1. Build it (assembles `dist/chrome/` and fills in the version — nothing
   to copy or edit by hand; `--no-zip` skips the package Chrome can't use):

   ```
   # Linux
   ./tools/build.sh chrome --no-zip

   # Windows Command Prompt
   powershell -ExecutionPolicy Bypass -File tools\build.ps1 -Browser chrome -NoZip

   # Windows PowerShell (if blocked, first run:
   # Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass)
   .\tools\build.ps1 -Browser chrome -NoZip
   ```
2. Open `chrome://extensions`.
3. Switch on **Developer mode** (toggle, top right).
4. Click **Load unpacked** and select the `dist/chrome/` folder.
5. Open YouTube — block entries should appear in video `...` menus.
   (Pin the toolbar icon if you want it visible.)

It stays loaded across restarts as long as Developer mode stays on. After a
`git pull`: repeat step 1 to rebuild, then hit the reload icon on the
extension card — no reinstall needed.

## Step by step — Firefox (temporary)

1. Build it (assembles `dist/firefox_selfhosted/` — same deal as Chrome):

   ```
   # Linux
   ./tools/build.sh firefox_selfhosted

   # Windows Command Prompt
   powershell -ExecutionPolicy Bypass -File tools\build.ps1 -Browser firefox_selfhosted

   # Windows PowerShell (if blocked, first run:
   # Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass)
   .\tools\build.ps1 -Browser firefox_selfhosted
   ```
2. Type `about:debugging#/runtime/this-firefox` in the address bar.
3. Under **This Firefox**, click **Load Temporary Add-on…**.
4. In the file picker, open `dist/firefox_selfhosted/` and select
   `manifest.json`. The extension appears in the list above.
5. Open the toolbar popup → **Grant access**, reload open YouTube tabs, and
   pin the icon from the puzzle-piece menu if you want it on the toolbar.

This install vanishes when Firefox closes — repeat steps 3–4 after a
restart. To keep it permanently, sign your own build (below).

## Firefox — make it permanent (sign it yourself)

Signing is free, and self-distributed (unlisted) extensions skip the review
queue — Mozilla signs them automatically.

About versions: every build takes its version from the `VERSION` file in the
repo root unless you pass one explicitly (`./tools/build.sh
firefox_selfhosted 0.4.9`, or `-Version 0.4.9` on Windows). This
matters here because Mozilla refuses to sign a version it has already
seen — each new signing needs a higher version than the last.

1. Package it (the zip is included by default):

   ```
   # Linux
   ./tools/build.sh firefox_selfhosted

   # Windows Command Prompt
   powershell -ExecutionPolicy Bypass -File tools\build.ps1 -Browser firefox_selfhosted

   # Windows PowerShell (if blocked, first run:
   # Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass)
   .\tools\build.ps1 -Browser firefox_selfhosted
   ```
2. Create API keys at `addons.mozilla.org` → Tools → Manage API keys.
3. Sign it (same on Linux and Windows — needs Node.js installed):
   `npx web-ext sign --source-dir dist/firefox_selfhosted --channel=unlisted --api-key <key> --api-secret <secret>`
4. Mozilla returns a signed `.xpi`. Install it via `about:addons` → gear
   icon → **Install Add-on From File**. It survives restarts.
5. Auto-update is opt-in: host your own `updates.json` and bake its URL in
   at build time (`--update-url https://…` / `-UpdateUrl https://…`), then
   add entries with `tools/build_ff_update_manifest.py <VERSION> <URL>
   <sha512:…>`. Skip this and the install just stays at your version.

Manual updates reuse the same API keys — they don't expire. Rebuild with a
higher version (see above), sign again, and install the new `.xpi` over
the old one.

## Official browser docs

* Chrome — loading unpacked extensions: https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked
* Firefox — temporary installation: https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/

## Before you build (only if you edited code)

`src/scripts/inject.js` is a **generated** bundle of `src/scripts/inject/*.js`
(`src/scripts/consts.js` is embedded as fragment #0). Never hand-edit it:

```
npm install
npm run build:inject
npm run check:inject
```

If you only changed options/popup/CSS/manifests, skip this.

## Maintainer notes

* Platforms: Linux and Windows. macOS is not supported — `build.sh` needs
  GNU `realpath` and GNU `sed`, which stock macOS lacks, and it is untested
  there.
* Version tracks are independent and this fork rarely bumps `VERSION`, so
  don't be surprised if a fresh build still says e.g. `v0.4.8` — the version
  string does not reflect how current the code is.
* `platform/firefox_selfhosted/manifest.json` carries an `update_url`
  (upstream's by default) and the `blocktube@git` extension ID. Nobody has
  to edit it: pass `--update-url` / `-UpdateUrl` at build time to bake in
  your own `updates.json`, or leave it alone if you don't want auto-update.
* Builds include the zip package by default; `--no-zip` / `-NoZip` skips
  it (local Chrome builds — Chrome cannot load a zip anyway).
