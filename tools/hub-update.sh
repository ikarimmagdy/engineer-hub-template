#!/usr/bin/env bash
# ============================================================
# Update this hub's engine to the latest Engineering Hub template.
#
#   tools/hub-update.sh [--ref <tag|branch>] [--dry-run] [hub-dir]
#
# Run from a hub folder (or pass its path). Fetches the template from git
# (HUB_TEMPLATE_REPO, default the private template repo; --ref defaults to main),
# or uses a local checkout when HUB_TEMPLATE_DIR is set. Then:
#   1. runs the template's tools/hub-migrate.mjs (adds missing brand.json keys
#      read from the old engine files; never removes or overwrites content),
#   2. replaces ONLY the files listed in tools/engine-files.txt,
#   3. writes content/.template-version,
#   4. runs node build.mjs.
# content/, assets/img/, README.md and project deploy scripts are never touched.
# ============================================================
set -euo pipefail

REPO="${HUB_TEMPLATE_REPO:-git@github.com-personal:ikarimmagdy/engineer-hub-template.git}"
REF="main"; DRY=0; HUB=""
while [ $# -gt 0 ]; do
  case "$1" in
    --ref) REF="$2"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
    *) HUB="$1"; shift ;;
  esac
done
HUB="$(cd "${HUB:-.}" && pwd)"
[ -f "$HUB/content/brand.json" ] || { echo "Not a hub folder (no content/brand.json): $HUB" >&2; exit 1; }

TMP=""
cleanup() { [ -z "$TMP" ] || rm -rf "$TMP"; }
trap cleanup EXIT
if [ -n "${HUB_TEMPLATE_DIR:-}" ]; then
  SRC="$(cd "$HUB_TEMPLATE_DIR" && pwd)"
  echo "==> template: local $SRC"
else
  TMP="$(mktemp -d)"; SRC="$TMP/tpl"
  echo "==> template: $REPO @ $REF"
  git clone -q --depth 1 --branch "$REF" "$REPO" "$SRC"
fi
[ -f "$SRC/tools/engine-files.txt" ] || { echo "Template has no tools/engine-files.txt" >&2; exit 1; }

VER="$(cat "$SRC/VERSION" 2>/dev/null || echo unknown)"
SHA="$(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo local)"
OLD="$(cat "$HUB/content/.template-version" 2>/dev/null | awk '{print $1}' || true)"
echo "==> hub: $HUB (engine ${OLD:-pre-v3} -> $VER $SHA)"

FILES=$(grep -v '^\s*#' "$SRC/tools/engine-files.txt" | sed '/^\s*$/d')
if [ "$DRY" = 1 ]; then
  for f in $FILES; do
    case "$f" in
      */) if [ ! -d "$HUB/$f" ]; then echo "  add     $f"; elif ! diff -rq "$SRC/$f" "$HUB/$f" >/dev/null; then echo "  update  $f"; fi ;;
      *) if [ ! -f "$HUB/$f" ]; then echo "  add     $f"; elif ! cmp -s "$SRC/$f" "$HUB/$f"; then echo "  update  $f"; fi ;;
    esac
  done
  [ -f "$SRC/tools/engine-retired.txt" ] && for f in $(grep -v '^\s*#' "$SRC/tools/engine-retired.txt" | sed '/^\s*$/d'); do
    [ -e "$HUB/$f" ] && echo "  retire  $f"
  done
  echo "==> dry run: nothing changed"; exit 0
fi

echo "==> migrating content (adds missing brand.json keys only)"
node "$SRC/tools/hub-migrate.mjs" "$HUB"

for f in $FILES; do
  case "$f" in
    */) rm -rf "${HUB:?}/$f"; mkdir -p "$HUB/$f"; cp -R "$SRC/$f." "$HUB/$f" ;;
    *) mkdir -p "$HUB/$(dirname "$f")"; cp "$SRC/$f" "$HUB/$f" ;;
  esac
done
# files and folders earlier engines installed and this one no longer has (5.0.0: the v4 front-end)
if [ -f "$SRC/tools/engine-retired.txt" ]; then
  for f in $(grep -v '^\s*#' "$SRC/tools/engine-retired.txt" | sed '/^\s*$/d'); do
    if [ -e "$HUB/$f" ]; then rm -rf "${HUB:?}/$f"; rmdir -p "$(dirname "$HUB/$f")" 2>/dev/null || true; echo "  retired $f"; fi
  done
fi
chmod +x "$HUB/sync.sh" "$HUB/tools/hub-update.sh" 2>/dev/null || true
echo "$VER $SHA $(date +%Y-%m-%d)" > "$HUB/content/.template-version"
echo "==> engine files replaced ($(echo "$FILES" | wc -l | tr -d ' ')), version recorded in content/.template-version"

echo "==> building"
(cd "$HUB" && node build.mjs)
