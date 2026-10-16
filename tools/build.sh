#!/usr/bin/env bash
set -euo pipefail

SCRIPT=$(realpath "$0")
BASEDIR=$(dirname "$(dirname "$SCRIPT")")

BROWSER=""
VERSION=""
MAKE_ZIP=1
UPDATE_URL=""

while [ $# -gt 0 ]; do
    case "$1" in
        firefox|firefox_selfhosted|chrome) BROWSER="$1" ;;
        --no-zip) MAKE_ZIP=0 ;;
        --update-url)
            if [ $# -lt 2 ]; then echo "missing URL after --update-url" >&2; exit 1; fi
            UPDATE_URL="$2"; shift ;;
        *) VERSION="$1" ;;
    esac
    shift
done

if [ -z "$BROWSER" ]; then
    echo "Usage: $0 {firefox|firefox_selfhosted|chrome} [version] [--no-zip] [--update-url URL]" >&2
    exit 1
fi

if [ -z "$VERSION" ]; then
    VERSION=$(cat "$BASEDIR/VERSION")
fi

copy_files() {
    mkdir -p "$DEST"
    cp -R "$BASEDIR/src"      "$DEST"
    cp -R "$BASEDIR/assets"   "$DEST"
    cp -R "$BASEDIR/LICENSE"  "$DEST"
    cp -R "$BASEDIR/VERSION"  "$DEST"
    cp "$BASEDIR/platform/$BROWSER/manifest.json" "$DEST"
}

set_version() {
    sed -i -e "s/{EXT_VERSION}/${VERSION}/" "${DEST}/manifest.json"
    sed -i -e "s/{EXT_VERSION}/${VERSION}/" "${DEST}/src/ui/options.html"
}

set_update_url() {
    if [ -n "$UPDATE_URL" ]; then
        esc=$(printf '%s' "$UPDATE_URL" | sed 's/[&|]/\\&/g')
        sed -i -e "s|\"update_url\": \"[^\"]*\"|\"update_url\": \"${esc}\"|" "${DEST}/manifest.json"
    fi
}

zipfile() {
    command -v zip >/dev/null || { echo "zip binary not found (pass --no-zip to skip the package)" >&2; exit 1; }
    cd -- "$DEST"
    zip "$DEST/blocktube_${BROWSER}_v${VERSION}.zip" -qr ./*
}

clean() {
    : "${DEST:?refusing rm -rf with empty DEST}"
    case "$DEST" in
        "$BASEDIR"/dist/*) ;;
        *) echo "refusing rm -rf outside \$BASEDIR/dist: $DEST" >&2; exit 1 ;;
    esac
    rm -rf -- "$DEST"
}

build() {
    clean
    copy_files
    set_version
    set_update_url
    if [ "$MAKE_ZIP" == "1" ]; then
        zipfile
    fi
}

DEST=$BASEDIR/dist/$BROWSER
echo "Building $BROWSER (version $VERSION) to $DEST"
build
