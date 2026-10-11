#!/usr/bin/env bash
# Before upgrading Keycloak: what changed upstream in the files this theme copies?
#
# Several templates of the theme are modified copies of the Keycloak ones (see the comment at the
# top of each .ftl, and docs/keycloak-theme.md). When Keycloak changes one of them, the copy keeps
# working but misses the change. This script extracts the upstream originals from two official
# images and prints the differences, only for the files the theme overrides, plus the parent
# theme.properties and styles.css (class names and layout the CSS relies on).
#
# Usage:  keycloak/check-upstream.sh <new-version-or-image> [baseline-version-or-image]
#         keycloak/check-upstream.sh 26.8.0
#         keycloak/check-upstream.sh 26.8.0 26.6.3        (baseline defaults to 26.6.3, the version the theme was written on)
# A bare version means quay.io/keycloak/keycloak:<version>; anything with "/" is used as an image reference.
# Needs docker (the images are pulled if missing), unzip and diff. It never starts Keycloak.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
login_dir="$here/dotnetliguria-theme/theme/dotnetliguria/login"
new_arg="${1:?usage: check-upstream.sh <new-version-or-image> [baseline-version-or-image]}"
base_arg="${2:-26.6.3}"

ref() { case "$1" in */*) echo "$1" ;; *) echo "quay.io/keycloak/keycloak:$1" ;; esac; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# extract <image> <dir>: unpacks the themes jars of the image into <dir>
extract() {
  local image="$1" dest="$2" cid
  mkdir -p "$dest/jars"
  cid="$(docker create "$image")"
  docker cp "$cid:/opt/keycloak/lib/lib/main/." "$dest/jars" >/dev/null
  docker rm "$cid" >/dev/null
  for jar in "$dest"/jars/org.keycloak.keycloak-themes-*.jar; do
    unzip -q -o "$jar" 'theme/*' -d "$dest/x"
  done
}

echo "baseline: $(ref "$base_arg")"
echo "new:      $(ref "$new_arg")"
extract "$(ref "$base_arg")" "$work/base"
extract "$(ref "$new_arg")" "$work/new"

[ -d "$work/new/x/theme/keycloak.v2/login" ] || { echo "!! the new version has no keycloak.v2 login theme: the parent of this theme is gone" >&2; exit 2; }

# The upstream file a copy comes from: keycloak.v2 first, then the base theme.
upstream() { # <root> <file>
  for t in keycloak.v2 base; do
    if [ -f "$1/x/theme/$t/login/$2" ]; then echo "$t/login/$2"; return; fi
  done
}

changed=0
check() { # <relative path under theme/> label
  local rel="$1" a="$work/base/x/theme/$1" b="$work/new/x/theme/$1"
  if [ ! -f "$b" ] && [ -f "$a" ]; then echo "!! $2: removed in the new version"; changed=1; return; fi
  if [ ! -f "$a" ] && [ -f "$b" ]; then echo "++ $2: new in the new version"; return; fi
  if diff -q "$a" "$b" >/dev/null 2>&1; then
    echo "== $2: unchanged"
  else
    echo "!! $2: CHANGED"
    diff -u "$a" "$b" > "$work/last.diff" || true   # diff exits 1 when files differ: not an error here
    head -n 80 "$work/last.diff" | sed 's/^/     /'
    changed=1
  fi
}

for f in "$login_dir"/*.ftl; do
  name="$(basename "$f")"
  rel="$(upstream "$work/base" "$name")"
  [ -n "$rel" ] || rel="$(upstream "$work/new" "$name")"
  if [ -z "$rel" ]; then echo "?? $name: no upstream original found (new file of the theme, or renamed upstream)"; continue; fi
  check "$rel" "$name ($rel)"
done
check "keycloak.v2/login/theme.properties" "keycloak.v2 theme.properties (CSS class names used by the templates)"
check "keycloak.v2/login/resources/css/styles.css" "keycloak.v2 styles.css (layout the DotNetLiguria CSS is loaded after)"

echo
if [ "$changed" = 1 ]; then
  echo "Some upstream files changed: merge the relevant changes into the copies, rebuild, and run the checklist in docs/keycloak-theme.md."
else
  echo "No upstream change in the files this theme overrides."
fi
