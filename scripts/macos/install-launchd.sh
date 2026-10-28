#!/bin/bash
# Run the meal planner in the background on macOS: starts at login, restarts if it crashes.
# Usage: ./scripts/macos/install-launchd.sh   (run again after updating to rebuild and restart)
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PORT="${PORT:-3000}"
# shellcheck source=launchd-lib.sh
source "$APP_DIR/scripts/macos/launchd-lib.sh"
refuse_root

NPM="$(command -v npm || true)"
NODE="$(command -v node || true)"
if [ -z "$NPM" ] || [ -z "$NODE" ]; then
  echo "Node.js is not installed. Get the LTS installer from https://nodejs.org" >&2
  exit 1
fi
NODE_MAJOR="$("$NODE" -p 'process.versions.node.split(".")[0]')"
NODE_MINOR="$("$NODE" -p 'process.versions.node.split(".")[1]')"
if [ "$NODE_MAJOR" -lt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 13 ]; }; then
  echo "Node.js 22.13 or newer is needed (found $("$NODE" -v))." >&2
  exit 1
fi

# macOS privacy protection blocks background apps from Desktop, Documents and Downloads.
case "$APP_DIR" in
  "$HOME/Desktop"*|"$HOME/Documents"*|"$HOME/Downloads"*)
    echo "Move the app out of Desktop/Documents/Downloads first (e.g. to ~/MealPlan):" >&2
    echo "macOS won't let a background service read files there." >&2
    exit 1
    ;;
esac

cd "$APP_DIR"
echo "Installing dependencies and building..."
"$NPM" install --no-fund --no-audit
"$NPM" run build
mkdir -p "$APP_DIR/data"

xml() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }

mkdir -p "$(dirname "$PLIST")"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(xml "$NPM")</string>
    <string>start</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$(xml "$APP_DIR")</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$(xml "$(dirname "$NODE")"):/usr/local/bin:/usr/bin:/bin</string>
    <key>PORT</key>
    <string>$(xml "$PORT")</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>$(xml "$APP_DIR/data/server.log")</string>
  <key>StandardErrorPath</key>
  <string>$(xml "$APP_DIR/data/server.log")</string>
</dict>
</plist>
PLIST

if [ "${MEALPLAN_SKIP_LAUNCHCTL:-}" = "1" ]; then
  echo "Wrote $PLIST (not loaded)."
  exit 0
fi

health() { curl -s -m 2 -o /dev/null -w '%{http_code}' "http://localhost:$PORT/api/health" 2>/dev/null || true; }

echo "Starting the background service..."
unload_service
if [ "$(health)" = "200" ]; then
  echo "Something else is already answering on port $PORT — probably start-meal-planner.command" >&2
  echo "in an open Terminal window. Close that window (or press Ctrl+C in it) and run this again." >&2
  exit 1
fi

if ! load_service; then
  cat >&2 <<MSG

Couldn't register the meal planner with macOS (launchd).
This usually means the script ran over SSH, from a remote terminal, or with sudo.
Open Terminal on the Mac itself, logged in as you, and run:

  $APP_DIR/scripts/macos/install-launchd.sh

or load it by hand with:

  launchctl load -w "$PLIST"
MSG
  exit 1
fi

for _ in $(seq 1 30); do
  [ "$(health)" = "200" ] && break
  sleep 0.5
done
if [ "$(health)" != "200" ]; then
  echo >&2
  echo "The service was registered (via $LOADED_VIA) but the app isn't answering on port $PORT yet." >&2
  echo "Last lines of $APP_DIR/data/server.log:" >&2
  tail -n 15 "$APP_DIR/data/server.log" >&2 2>/dev/null || echo "  (no log yet)" >&2
  exit 1
fi

echo
echo "Meal planner is running in the background (via $LOADED_VIA) and will start at every login."
echo "  On this Mac:    http://localhost:$PORT"
echo "  On your phones: http://$(scutil --get LocalHostName 2>/dev/null || hostname -s).local:$PORT"
echo "  Log file:       $APP_DIR/data/server.log"
