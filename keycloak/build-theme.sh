#!/usr/bin/env bash
# Builds the DotNetLiguria Keycloak login theme as a JAR:
#
#   keycloak/dist/dotnetliguria-login-theme.jar
#
# A JAR is a zip with META-INF/keycloak-themes.json and theme/dotnetliguria/login/... inside.
# Needs only bash and `zip` (or a JDK `jar` tool as a fallback). No network, no Maven, no Node.
# The file name is always the same on purpose: copying a new build over the old one in
# /opt/keycloak/providers replaces it, so two JARs that declare the same theme can never coexist.
#
# Usage:  keycloak/build-theme.sh            (from anywhere)
#         THEME_VERSION=1.2.0 keycloak/build-theme.sh
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
src="$here/dotnetliguria-theme"
out_dir="$here/dist"
out="$out_dir/dotnetliguria-login-theme.jar"
version="${THEME_VERSION:-$(git -C "$here" describe --always --dirty --tags 2>/dev/null || echo dev)}"

fail() { echo "build-theme: $*" >&2; exit 1; }

# Fail early on a broken tree, not on the Keycloak server.
for required in \
  "META-INF/keycloak-themes.json" \
  "theme/dotnetliguria/login/theme.properties" \
  "theme/dotnetliguria/login/template.ftl" \
  "theme/dotnetliguria/login/resources/css/dotnetliguria.css" \
  "theme/dotnetliguria/login/messages/messages_it.properties"; do
  [ -f "$src/$required" ] || fail "missing $required in $src"
done
grep -q '"name": *"dotnetliguria"' "$src/META-INF/keycloak-themes.json" || fail 'keycloak-themes.json does not declare the theme "dotnetliguria"'
tr -d '\r' < "$src/theme/dotnetliguria/login/theme.properties" | grep -q '^parent=keycloak\.v2$' || fail 'theme.properties: parent=keycloak.v2 expected'

have_zip() { command -v zip >/dev/null 2>&1; }
have_jar() { jar --version >/dev/null 2>&1; }   # on macOS without a JDK "jar" exists but only prints an error
have_zip || have_jar || fail 'neither "zip" nor a working JDK "jar" found in PATH; on Ubuntu/WSL install zip with: sudo apt install zip'

stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/META-INF"
cp -R "$src/META-INF/." "$stage/META-INF/"
cp -R "$src/theme" "$stage/theme"
# Editors and macOS leave files that must not travel in the JAR.
find "$stage" \( -name '.DS_Store' -o -name '*~' -o -name '*.swp' \) -delete

printf 'Manifest-Version: 1.0\r\nImplementation-Title: DotNetLiguria Keycloak login theme\r\nImplementation-Version: %s\r\n\r\n' "$version" > "$stage/META-INF/MANIFEST.MF"

# Same input, same bytes: fixed timestamps and a sorted file list.
find "$stage" -exec touch -t 202601010000 {} +

mkdir -p "$out_dir"
rm -f "$out"
if have_zip; then
  (
    cd "$stage"
    { echo META-INF/MANIFEST.MF; find META-INF theme -type f ! -name MANIFEST.MF | LC_ALL=C sort; } | zip -X -q "$out" -@
  )
else
  jar cfm "$out" "$stage/META-INF/MANIFEST.MF" -C "$stage" META-INF/keycloak-themes.json -C "$stage" theme
fi

size="$(wc -c < "$out" | tr -d ' ')"
if command -v sha256sum >/dev/null 2>&1; then sum="$(sha256sum "$out" | cut -d' ' -f1)"; else sum="$(shasum -a 256 "$out" | cut -d' ' -f1)"; fi
echo "Built $out"
echo "  version  $version"
echo "  size     $size bytes"
echo "  sha256   $sum"
if command -v unzip >/dev/null 2>&1; then
  echo "  entries  $(unzip -Z1 "$out" | wc -l | tr -d ' ') (unzip -l to list them)"
fi
